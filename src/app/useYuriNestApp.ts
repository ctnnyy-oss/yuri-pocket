import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppView } from '../components/CharacterRail'
import { loadAppState, saveAppState } from '../data/database'
import { migrateAppState } from '../data/migrations'
import { createSeedState } from '../data/seed'
import type { AppSettings, AppState, CharacterCard } from '../domain/types'
import { isCloudSyncConfigured } from '../services/cloudSync'
import {
  buildPromptBundle,
  createId,
  detectMemoryConflicts,
  getActiveCharacter,
  getConversation,
  nowIso,
  upsertConversation,
} from '../services/memoryEngine'
import { applyTrashRetention, normalizeTrashRetentionSettings } from '../services/trashRetention'
import { deliverDueReminders } from './agentActions'
import { buildViewUrl, readViewFromLocation } from './navigation'
import { buildCustomThemeVariables, themeVariables } from './theme'
import { useAgentTasks } from './useAgentTasks'
import { useBackupRestore } from './useBackupRestore'
import { useChat } from './useChat'
import { useCloudSync } from './useCloudSync'
import { useMemoryActions } from './useMemoryActions'

export function useYuriNestApp() {
  const [state, setState] = useState<AppState>(() => createSeedState())
  const [isReady, setIsReady] = useState(false)
  const [activeView, setActiveView] = useState<AppView>(() => readViewFromLocation())
  const [notice, setNotice] = useState('')

  const character = useMemo(() => getActiveCharacter(state), [state])
  const conversation = useMemo(() => getConversation(state, character.id), [character.id, state])
  const promptBundle = useMemo(() => buildPromptBundle(state), [state])
  const memoryConflicts = useMemo(() => detectMemoryConflicts(state.memories), [state.memories])
  const appStyle = {
    '--app-font-size': `${state.settings.fontSize}px`,
  } as CSSProperties

  // ---- 子 hook ----
  const backup = useBackupRestore({ state, setState, setNotice, characterId: character.id })

  const cloud = useCloudSync({
    state,
    setState,
    setNotice,
    characterId: character.id,
    makeLocalBackup: backup.makeLocalBackup,
  })
  const { autoPush, bootstrapCloudState, initModelProfiles, onSwitchToCloud, onSwitchToLocal } = cloud
  const bootstrapStateRef = useRef(state)

  const memory = useMemoryActions({
    state,
    setState,
    setNotice,
    characterId: character.id,
    characterName: character.name,
    conversationId: conversation.id,
    conversationMessages: conversation.messages,
  })

  const chat = useChat({
    state,
    setState,
    setNotice,
    character,
    conversation,
  })

  const tasks = useAgentTasks({ setState, setNotice })

  // ---- 初始化 ----
  useEffect(() => {
    bootstrapStateRef.current = state
  }, [state])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      const view = readViewFromLocation()
      setActiveView(view)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 2_400)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!isReady) return
    const timer = setInterval(() => {
      setState((currentState) => {
        const { state: nextState, delivered } = deliverDueReminders(currentState)
        if (delivered.length > 0) {
          setNotice(`提醒到了：${delivered[0].title}`)
        }
        return nextState
      })
    }, 30_000)
    return () => clearInterval(timer)
  }, [isReady])

  useEffect(() => {
    void loadAppState().then((savedState) => {
      if (savedState) {
        setState(migrateAppState(savedState))
      }
      setIsReady(true)
    })
  }, [])

  useEffect(() => {
    if (!isReady) return
    void initModelProfiles()
  }, [initModelProfiles, isReady])

  useEffect(() => {
    if (!isReady) return
    void bootstrapCloudState(bootstrapStateRef.current)
  }, [bootstrapCloudState, isReady])

  useEffect(() => {
    if (!isReady || !isCloudSyncConfigured()) return
    if (state.settings.dataStorageMode === 'local') return

    const timer = setInterval(() => {
      autoPush(state)
    }, 1_200)
    return () => clearInterval(timer)
  }, [autoPush, character.id, isReady, state])

  useEffect(() => {
    if (!isReady) return
    void saveAppState(state)
  }, [isReady, state])

  useEffect(() => {
    const themeTokens =
      state.settings.accentTheme === 'custom'
        ? buildCustomThemeVariables(state.settings.customAccentColor)
        : themeVariables[state.settings.accentTheme] ?? themeVariables.sakura
    if (typeof document === 'undefined' || !themeTokens) return
    const root = document.documentElement
    const previous: Record<string, string> = {}
    for (const [key, value] of Object.entries(themeTokens)) {
      if (typeof value === 'string') {
        previous[key] = root.style.getPropertyValue(key)
        root.style.setProperty(key, value)
      }
    }
    root.dataset.theme = state.settings.accentTheme
    return () => {
      for (const [key, value] of Object.entries(previous)) {
        if (value) {
          root.style.setProperty(key, value)
        } else {
          root.style.removeProperty(key)
        }
      }
    }
  }, [state.settings.accentTheme, state.settings.customAccentColor])

  // ---- 导航 ----
  function navigateView(view: AppView, mode: 'push' | 'replace' = 'push') {
    setActiveView(view)
    if (typeof window === 'undefined') return
    if (readViewFromLocation() === view) return

    const url = buildViewUrl(view)
    const statePayload = { ...(window.history.state ?? {}), yuriPocketView: view }
    if (mode === 'replace') {
      window.history.replaceState(statePayload, '', url)
      return
    }
    window.history.pushState(statePayload, '', url)
  }

  // ---- 角色切换 ----
  function handleSelectCharacter(characterId: string) {
    setState((currentState) => {
      const conversationForCharacter = getConversation(currentState, characterId)
      return {
        ...upsertConversation(currentState, conversationForCharacter),
        activeCharacterId: characterId,
      }
    })
  }

  function handleCreateCharacter(input: { name: string; relation: string; mood: string; persona: string }): string {
    const now = nowIso()
    const name = input.name.trim() || '新角色'
    const relation = input.relation.trim() || '角色'
    const mood = input.mood.trim() || '等待补全'
    const persona = input.persona.trim() || '还没有导入人设。'
    const characterId = createId('character')
    const character: CharacterCard = {
      id: characterId,
      name,
      title: relation,
      subtitle: mood,
      avatar: name.slice(0, 1),
      accent: '#ef9ac6',
      relationship: relation,
      mood,
      tags: ['自定义角色', relation, name],
      systemPrompt: persona,
      greeting: `${name}已经加入百合小窝。`,
    }
    setState((currentState) => ({
      ...currentState,
      activeCharacterId: characterId,
      characters: [character, ...currentState.characters],
      conversations: [
        {
          id: createId('conversation'),
          characterId,
          messages: [
            {
              id: createId('message'),
              role: 'assistant',
              content: character.greeting,
              createdAt: now,
            },
          ],
          summary: '',
          createdAt: now,
          updatedAt: now,
        },
        ...currentState.conversations,
      ],
    }))
    setNotice(`已添加角色：${name}`)
    return characterId
  }

  // ---- 设置 ----
  function handleUpdateSettings(settings: AppSettings) {
    if (settings.dataStorageMode === 'local' && state.settings.dataStorageMode !== 'local') {
      onSwitchToLocal()
    }

    if (settings.dataStorageMode === 'cloud' && state.settings.dataStorageMode === 'local') {
      onSwitchToCloud()
    }

    setState((currentState) =>
      applyTrashRetention({
        ...currentState,
        settings: normalizeTrashRetentionSettings(settings),
      }),
    )
  }

  return {
    activeView,
    appStyle,
    character,
    cloudBackups: cloud.cloudBackups,
    cloudBusy: cloud.cloudBusy,
    cloudMeta: cloud.cloudMeta,
    cloudStatus: cloud.cloudStatus,
    cloudSyncConfigured: isCloudSyncConfigured(),
    conversation,
    draft: chat.draft,
    handleAddMemory: memory.handleAddMemory,
    handleClearCompletedTasks: tasks.handleClearCompletedTasks,
    handleConnectCloud: cloud.handleConnectCloud,
    handleCreateCharacter,
    handleCreateCloudBackup: cloud.handleCreateCloudBackup,
    handleCreateLocalBackup: backup.handleCreateLocalBackup,
    handleDeleteLocalBackup: backup.handleDeleteLocalBackup,
    handleDeleteModelProfile: cloud.handleDeleteModelProfile,
    handleDeleteTrashedMemory: memory.handleDeleteTrashedMemory,
    handleDeleteTrashedWorldNode: memory.handleDeleteTrashedWorldNode,
    handleDownloadCloudBackup: cloud.handleDownloadCloudBackup,
    handleEmptyTrash: memory.handleEmptyTrash,
    handleExport: backup.handleExport,
    handleFetchModelCatalog: cloud.handleFetchModelCatalog,
    handleImport: backup.handleImport,
    handleMemoryFeedbackFromChat: memory.handleMemoryFeedbackFromChat,
    handleOrganizeMemories: memory.handleOrganizeMemories,
    handlePullCloud: cloud.handlePullCloud,
    handlePushCloud: cloud.handlePushCloud,
    handleRefreshCloud: cloud.handleRefreshCloud,
    handleRefreshCloudBackups: cloud.handleRefreshCloudBackups,
    handleReset: backup.handleReset,
    handleRestoreLocalBackup: backup.handleRestoreLocalBackup,
    handleRestoreMemory: memory.handleRestoreMemory,
    handleRestoreMemoryRevision: memory.handleRestoreMemoryRevision,
    handleRestoreWorldNode: memory.handleRestoreWorldNode,
    handleSaveModelProfile: cloud.handleSaveModelProfile,
    handleSelectCharacter,
    handleSend: chat.handleSend,
    handleTestModelProfile: cloud.handleTestModelProfile,
    handleTrashMemory: memory.handleTrashMemory,
    handleTrashWorldNode: memory.handleTrashWorldNode,
    handleUpdateMemory: memory.handleUpdateMemory,
    handleUpdateSettings,
    handleUpdateTaskStatus: tasks.handleUpdateTaskStatus,
    handleUpdateWorldNode: memory.handleUpdateWorldNode,
    isSending: chat.isSending,
    localBackups: backup.localBackups,
    memoryConflicts,
    memoryEvents: state.memoryEvents,
    modelProfileBusy: cloud.modelProfileBusy,
    modelProfileStatus: cloud.modelProfileStatus,
    modelProfiles: cloud.modelProfiles,
    navigateView,
    notice,
    promptBundle,
    setDraft: chat.setDraft,
    state,
  }
}
