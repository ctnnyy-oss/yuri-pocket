import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppView } from '../components/CharacterRail'
import { brand } from '../config/brand'
import {
  createLocalBackup,
  deleteLocalBackup,
  listLocalBackups,
  loadAppState,
  loadLocalBackup,
  resetAppState,
  saveAppState,
} from '../data/database'
import { migrateAppState } from '../data/migrations'
import { createSeedState } from '../data/seed'
import type {
  AgentTaskStatus,
  AppSettings,
  AppState,
  LocalBackupSummary,
  LongTermMemory,
  ModelProfileInput,
  ModelProfileSummary,
  WorldNode,
} from '../domain/types'
import { requestAssistantReply } from '../services/chatApi'
import {
  checkCloudHealth,
  createCloudBackup,
  type CloudBackupSummary,
  type CloudMetadata,
  downloadCloudBackup,
  getSavedCloudToken,
  isCloudSyncConfigured,
  listCloudBackups,
  pullCloudState,
  pushCloudState,
} from '../services/cloudSync'
import {
  attachAssistantToMemoryUsageLog,
  buildPromptBundle,
  consolidateMemoryGarden,
  createManualMemory,
  createMemoryUsageLog,
  createMessage,
  createMemorySourceFromMessage,
  createMemoryTombstone,
  detectMemoryConflicts,
  getActiveCharacter,
  getConversation,
  integrateMemoryCandidate,
  isMemoryBlockedByTombstones,
  maybeCaptureMemory,
  nowIso,
  restoreMemoryRevision,
  touchRelevantMemories,
  updateConversationSummary,
  updateMemoryWithRevision,
  upsertConversation,
} from '../services/memoryEngine'
import { applyMemoryFeedback, type MemoryFeedbackAction } from '../services/memoryFeedback'
import {
  deleteModelProfile,
  fetchModelCatalog,
  listModelProfiles,
  saveModelProfile,
  testModelProfile,
  type ModelCatalogResult,
} from '../services/modelProfiles'
import { applyTrashRetention, normalizeTrashRetentionSettings } from '../services/trashRetention'
import {
  addMemoryEventToState,
  applyAgentActionsToState,
  buildTaskStatusLog,
  deliverDueReminders,
  enqueueAgentTaskActions,
  transitionTaskSteps,
} from './agentActions'
import { formatCloudStatus, formatCloudTime, formatShortDateTime } from './formatters'
import { buildViewUrl, readViewFromLocation } from './navigation'
import { buildCustomThemeVariables, themeVariables } from './theme'

type CloudBusyTask = 'checking' | 'pulling' | 'pushing' | 'backing-up'

export function useYuriNestApp() {
  const [state, setState] = useState<AppState>(() => createSeedState())
  const [draft, setDraft] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [activeView, setActiveView] = useState<AppView>(() => readViewFromLocation())
  const [cloudToken] = useState(() => getSavedCloudToken())
  const [cloudStatus, setCloudStatus] = useState(() => {
    if (!isCloudSyncConfigured()) return '云端后端未配置'
    return '云端直连已启用'
  })
  const [cloudMeta, setCloudMeta] = useState<CloudMetadata | null>(null)
  const [cloudBusy, setCloudBusy] = useState<CloudBusyTask | null>(null)
  const [localBackups, setLocalBackups] = useState<LocalBackupSummary[]>([])
  const [cloudBackups, setCloudBackups] = useState<CloudBackupSummary[]>([])
  const [modelProfiles, setModelProfiles] = useState<ModelProfileSummary[]>([])
  const [modelProfileStatus, setModelProfileStatus] = useState(() => {
    if (!isCloudSyncConfigured()) return '模型后端会优先使用本机 /api'
    return '模型密钥会保存到服务器保险箱'
  })
  const [modelProfileBusy, setModelProfileBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const autoCloudReadyRef = useRef(false)
  const autoModelReadyRef = useRef(false)
  const skipNextAutoPushRef = useRef(false)

  const refreshLocalBackups = useCallback(async () => {
    const backups = await listLocalBackups()
    setLocalBackups(backups)
  }, [])

  const refreshCloudBackups = useCallback(async (token: string) => {
    if (!isCloudSyncConfigured()) {
      setCloudBackups([])
      return []
    }

    const backups = await listCloudBackups(token)
    setCloudBackups(backups)
    return backups
  }, [])

  const refreshModelProfileList = useCallback(async (tokenOverride?: string) => {
    const token = (tokenOverride ?? cloudToken).trim()
    setModelProfileBusy(true)
    setModelProfileStatus('正在读取模型配置...')
    try {
      const profiles = await listModelProfiles(token)
      setModelProfiles(profiles)
      setModelProfileStatus(`已读取 ${profiles.length} 组模型配置`)
      return profiles
    } catch (error) {
      setModelProfiles([])
      setModelProfileStatus(error instanceof Error ? error.message : '读取模型配置失败')
      return []
    } finally {
      setModelProfileBusy(false)
    }
  }, [cloudToken])

  const refreshCloudMetadata = useCallback(async (token: string) => {
    if (!isCloudSyncConfigured()) {
      setCloudMeta(null)
      setCloudStatus('云端后端还没有配置')
      return null
    }

    const cleanedToken = token.trim()

    setCloudBusy('checking')
    setCloudStatus('正在检查云端状态...')
    try {
      const metadata = await checkCloudHealth(cleanedToken)
      setCloudMeta(metadata)
      setCloudStatus(formatCloudStatus(metadata))
      void refreshCloudBackups(cleanedToken)
      void refreshModelProfileList(cleanedToken)
      return metadata
    } catch (error) {
      setCloudMeta(null)
      setCloudStatus(error instanceof Error ? error.message : '检查云端失败')
      return null
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'checking' ? null : currentTask))
    }
  }, [refreshCloudBackups, refreshModelProfileList])

  const bootstrapCloudState = useCallback(async (localState: AppState) => {
    if (!isCloudSyncConfigured() || autoCloudReadyRef.current) return
    if (localState.settings.dataStorageMode === 'local') {
      setCloudMeta(null)
      setCloudStatus('当前为仅本地模式，不会自动上传云端')
      setModelProfileStatus('仅本地模式下不会自动上传云端配置')
      return
    }

    setCloudStatus('正在自动连接云端...')
    setModelProfileStatus('正在读取模型配置...')
    try {
      const snapshot = await pullCloudState(cloudToken)
      if (snapshot.state) {
        const pulledState = migrateAppState(snapshot.state)
        skipNextAutoPushRef.current = true
        setState(pulledState)
        setCloudMeta({
          hasState: true,
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
        })
        setCloudStatus(`已自动读取云端 v${snapshot.revision}`)
        setNotice('云端数据已自动同步')
      } else {
        const result = await pushCloudState(applyTrashRetention(localState), cloudToken)
        setCloudMeta({ hasState: true, revision: result.revision, updatedAt: result.updatedAt })
        setCloudStatus(`已创建云端同步 v${result.revision}`)
      }

      autoCloudReadyRef.current = true
      void refreshCloudBackups(cloudToken)
      void refreshModelProfileList(cloudToken)
    } catch (error) {
      autoCloudReadyRef.current = false
      setCloudStatus(error instanceof Error ? error.message : '自动连接云端失败')
      setModelProfileStatus('模型配置暂时没连上')
    }
  }, [cloudToken, refreshCloudBackups, refreshModelProfileList])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const initialView = readViewFromLocation()
    window.history.replaceState({ ...(window.history.state ?? {}), yuriPocketView: initialView }, '', buildViewUrl(initialView))

    function handlePopState() {
      setActiveView(readViewFromLocation())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!isReady) return

    function checkReminders() {
      let deliveredCount = 0
      setState((currentState) => {
        const result = deliverDueReminders(currentState)
        deliveredCount = result.delivered.length
        return result.state
      })

      if (deliveredCount > 0) {
        setNotice(deliveredCount === 1 ? '有一条提醒到时间了' : `有 ${deliveredCount} 条提醒到时间了`)
      }
    }

    checkReminders()
    const timer = window.setInterval(checkReminders, 30_000)
    return () => window.clearInterval(timer)
  }, [isReady])

  useEffect(() => {
    loadAppState().then((savedState) => {
      setState(savedState)
      setIsReady(true)
      void refreshLocalBackups()
    })
  }, [refreshLocalBackups])

  useEffect(() => {
    if (!isReady) return
    if (autoModelReadyRef.current) return
    autoModelReadyRef.current = true
    void refreshModelProfileList(cloudToken)
  }, [cloudToken, isReady, refreshModelProfileList])

  useEffect(() => {
    if (!isReady) return
    if (state.settings.dataStorageMode === 'local') {
      autoCloudReadyRef.current = false
      skipNextAutoPushRef.current = false
      return
    }
    if (!autoCloudReadyRef.current) void bootstrapCloudState(state)
  }, [bootstrapCloudState, isReady, state])

  useEffect(() => {
    if (
      !isReady ||
      state.settings.dataStorageMode === 'local' ||
      !isCloudSyncConfigured() ||
      !autoCloudReadyRef.current
    ) {
      return
    }
    if (skipNextAutoPushRef.current) {
      skipNextAutoPushRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      void pushCloudState(applyTrashRetention(state), cloudToken)
        .then((result) => {
          setCloudMeta({ hasState: true, revision: result.revision, updatedAt: result.updatedAt })
          setCloudStatus(`已自动同步到云端 v${result.revision}`)
        })
        .catch((error) => {
          setCloudStatus(error instanceof Error ? error.message : '自动同步云端失败')
        })
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [cloudToken, isReady, state])

  useEffect(() => {
    if (isReady) {
      saveAppState(state)
    }
  }, [isReady, state])

  const character = useMemo(() => getActiveCharacter(state), [state])
  const conversation = useMemo(() => getConversation(state, character.id), [character.id, state])
  const promptBundle = useMemo(() => buildPromptBundle(state), [state])
  const memoryConflicts = useMemo(() => detectMemoryConflicts(state.memories), [state.memories])
  const appStyle = {
    '--app-font-size': `${state.settings.fontSize}px`,
  } as CSSProperties

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

  async function handleSend() {
    const content = draft.trim()
    if (!content || isSending) return

    const userMessage = createMessage('user', content)
    const nextConversation = updateConversationSummary({
      ...conversation,
      messages: [...conversation.messages, userMessage],
      updatedAt: nowIso(),
    })
    const touchedMemories = touchRelevantMemories(state.memories, content, {
      characterId: character.id,
      conversationId: nextConversation.id,
      maxItems: 12,
    })
    const capturedMemory = state.settings.autoMemoryEnabled
      ? maybeCaptureMemory(userMessage, nextConversation, character)
      : null
    const keptMemory =
      capturedMemory &&
      capturedMemory.confidence >= state.settings.memoryConfidenceFloor &&
      !isMemoryBlockedByTombstones(capturedMemory, state.memoryTombstones)
        ? capturedMemory
        : null

    let nextState = {
      ...upsertConversation(state, nextConversation),
      memories: keptMemory ? integrateMemoryCandidate(touchedMemories, keptMemory) : touchedMemories,
    }
    if (keptMemory) {
      nextState = addMemoryEventToState(nextState, {
        type: 'captured',
        actor: 'assistant',
        title: keptMemory.title,
        detail: keptMemory.status === 'candidate' ? '自动捕捉为候选记忆，等待妹妹确认。' : '自动捕捉并写入长期记忆。',
        memoryIds: [keptMemory.id],
        characterId: character.id,
        conversationId: nextConversation.id,
      })
    }
    const requestBundle = buildPromptBundle(nextState)
    const usageLog = createMemoryUsageLog({
      bundle: requestBundle,
      conversation: nextConversation,
      character,
      userMessage,
    })
    const nextStateWithUsage = {
      ...nextState,
      memoryUsageLogs: [usageLog, ...nextState.memoryUsageLogs].slice(0, 50),
    }

    setState(nextStateWithUsage)
    setDraft('')
    setIsSending(true)
    setNotice(keptMemory ? (keptMemory.status === 'candidate' ? '发现一条待确认记忆' : '已捕捉并归档一条记忆') : '消息已送达')

    try {
      const result = await requestAssistantReply(requestBundle, nextState.settings)
      const assistantMessage = {
        ...createMessage('assistant', result.reply),
        agent: result.agent,
      }
      const repliedConversation = {
        ...nextConversation,
        messages: [...nextConversation.messages, assistantMessage],
        updatedAt: nowIso(),
      }
      const repliedState = upsertConversation(
        {
          ...nextStateWithUsage,
          memoryUsageLogs: attachAssistantToMemoryUsageLog(
            nextStateWithUsage.memoryUsageLogs,
            usageLog.id,
            assistantMessage.id,
          ),
        },
        repliedConversation,
      )
      const { state: stateWithAgentActions, appliedLabels } = applyAgentActionsToState(
        repliedState,
        result.agent?.actions,
        { character, conversation: nextConversation, userMessage },
      )
      setState(stateWithAgentActions)
      setNotice(appliedLabels.length > 0 ? `已执行：${appliedLabels.slice(0, 2).join(' / ')}` : '回复完成')
      void enqueueAgentTaskActions(result.agent?.actions)
    } catch (error) {
      const fallbackMessage = createMessage(
        'assistant',
        `模型代理刚才没接通，但本地聊天和记忆没有丢。\n\n${
          error instanceof Error ? error.message : '未知错误'
        }`,
      )
      setState(
        upsertConversation(
          {
            ...nextStateWithUsage,
            memoryUsageLogs: attachAssistantToMemoryUsageLog(
              nextStateWithUsage.memoryUsageLogs,
              usageLog.id,
              fallbackMessage.id,
            ),
          },
          {
            ...nextConversation,
            messages: [...nextConversation.messages, fallbackMessage],
            updatedAt: nowIso(),
          },
        ),
      )
      setNotice('模型代理未接通')
    } finally {
      setIsSending(false)
    }
  }

  function handleSelectCharacter(characterId: string) {
    setState((currentState) => {
      const conversationForCharacter = getConversation(currentState, characterId)
      return {
        ...upsertConversation(currentState, conversationForCharacter),
        activeCharacterId: characterId,
      }
    })
  }

  function handleUpdateTaskStatus(taskId: string, status: AgentTaskStatus) {
    setState((currentState) => ({
      ...currentState,
      agentTasks: (currentState.agentTasks ?? []).map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              steps: transitionTaskSteps(task.steps, status),
              logs: [...task.logs, buildTaskStatusLog(status)].slice(-8),
              updatedAt: nowIso(),
            }
          : task,
      ),
    }))
    setNotice(buildTaskStatusLog(status))
  }

  function handleClearCompletedTasks() {
    setState((currentState) => ({
      ...currentState,
      agentTasks: (currentState.agentTasks ?? []).filter((task) => task.status !== 'completed'),
    }))
    setNotice('已清理完成任务')
  }

  function handleAddMemory() {
    const recentUserMessages = conversation.messages.filter((message) => message.role === 'user').slice(-4)
    const recentText = recentUserMessages.map((message) => message.content).join(' / ')

    const body = recentText || '妹妹暂时还没有新的聊天内容，先保留一条空记忆位。'
    const memory = createManualMemory({
      title: '手动整理的记忆',
      body: body.slice(0, 260),
      tags: ['手动整理', character.name],
      priority: 4,
      pinned: false,
      kind: 'event',
      confidence: recentUserMessages.length > 0 ? 0.9 : 0.55,
      sources: recentUserMessages.map((message) => createMemorySourceFromMessage(message, conversation, character)),
      reason: '手动整理最近聊天',
    })

    setState((currentState) =>
      addMemoryEventToState(
        {
          ...currentState,
          memories: [memory, ...currentState.memories],
        },
        {
          type: 'created',
          actor: 'user',
          title: memory.title,
          detail: '妹妹手动从最近聊天整理出一条记忆。',
          memoryIds: [memory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      ),
    )
    setNotice('最近聊天已整理')
  }

  function handleUpdateMemory(updatedMemory: LongTermMemory) {
    setState((currentState) => {
      const previousMemory = currentState.memories.find((memory) => memory.id === updatedMemory.id)
      const nextMemories = currentState.memories.map((memory) =>
        memory.id === updatedMemory.id ? updateMemoryWithRevision(memory, updatedMemory, '妹妹手动编辑') : memory,
      )
      const eventType = previousMemory?.status === 'candidate' && updatedMemory.status === 'active' ? 'confirmed' : 'edited'
      const detail = eventType === 'confirmed' ? '候选记忆被确认生效。' : '妹妹手动修改了记忆档案。'

      return addMemoryEventToState(
        {
          ...currentState,
          memories: nextMemories,
        },
        {
          type: eventType,
          actor: 'user',
          title: updatedMemory.title,
          detail,
          memoryIds: [updatedMemory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已修改')
  }

  function handleMemoryFeedbackFromChat(memoryId: string, action: MemoryFeedbackAction) {
    const currentMemory = state.memories.find((item) => item.id === memoryId)
    if (!currentMemory) {
      setNotice('这条记忆暂时没有找到')
      return
    }

    const noticeText = applyMemoryFeedback(currentMemory, action).notice

    setState((currentState) => {
      const memory = currentState.memories.find((item) => item.id === memoryId)
      if (!memory) return currentState

      const feedback = applyMemoryFeedback(memory, action)
      const updatedMemory = updateMemoryWithRevision(
        memory,
        feedback.memory,
        feedback.revisionReason,
      )

      return addMemoryEventToState(
        {
          ...currentState,
          memories: currentState.memories.map((item) => (item.id === memoryId ? updatedMemory : item)),
        },
        {
          type: 'usage_feedback',
          actor: 'user',
          title: memory.title,
          detail: feedback.detail,
          memoryIds: [memory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice(noticeText)
  }

  function handleOrganizeMemories() {
    const report = consolidateMemoryGarden(state.memories)
    setState((currentState) =>
      addMemoryEventToState(
        {
          ...currentState,
          memories: report.memories,
        },
        {
          type: 'organized',
          actor: 'system',
          title: '后台整理',
          detail:
            report.mergedCount > 0
              ? `检查 ${report.reviewedCount} 条记忆，合并 ${report.mergedCount} 条重复内容。`
              : `检查 ${report.reviewedCount} 条记忆，暂时不需要合并。`,
          memoryIds: report.memories.slice(0, 8).map((memory) => memory.id),
          characterId: character.id,
        },
      ),
    )
    setNotice(
      report.mergedCount > 0 ? `已整理 ${report.reviewedCount} 条，合并 ${report.mergedCount} 条` : '记忆系统已检查',
    )
  }

  function handleRestoreMemoryRevision(memoryId: string, revisionId: string) {
    setState((currentState) => {
      const currentMemory = currentState.memories.find((memory) => memory.id === memoryId)
      const restoredMemory = currentMemory ? restoreMemoryRevision(currentMemory, revisionId) : null

      return addMemoryEventToState(
        {
          ...currentState,
          memories: currentState.memories.map((memory) => (memory.id === memoryId ? restoredMemory ?? memory : memory)),
        },
        {
          type: 'revision_restored',
          actor: 'user',
          title: restoredMemory?.title ?? currentMemory?.title ?? '记忆回滚',
          detail: '从版本线恢复了一版记忆内容。',
          memoryIds: [memoryId],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已回滚')
  }

  function handleTrashMemory(memoryId: string) {
    setState((currentState) => {
      const memory = currentState.memories.find((item) => item.id === memoryId)
      if (!memory) return currentState

      return addMemoryEventToState(
        {
          ...currentState,
          memories: currentState.memories.filter((item) => item.id !== memoryId),
          trash: {
            ...currentState.trash,
            memories: [{ ...memory, status: 'trashed' as const, deletedAt: nowIso() }, ...currentState.trash.memories],
          },
        },
        {
          type: 'trashed',
          actor: 'user',
          title: memory.title,
          detail: '记忆移入回收花园，仍然可以恢复。',
          memoryIds: [memory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已放入回收花园')
  }

  function handleUpdateWorldNode(updatedNode: WorldNode) {
    setState((currentState) => ({
      ...currentState,
      worldNodes: currentState.worldNodes.map((node) => (node.id === updatedNode.id ? updatedNode : node)),
    }))
    setNotice('世界树已修改')
  }

  function handleTrashWorldNode(nodeId: string) {
    setState((currentState) => {
      const node = currentState.worldNodes.find((item) => item.id === nodeId)
      if (!node) return currentState

      return {
        ...currentState,
        worldNodes: currentState.worldNodes.filter((item) => item.id !== nodeId),
        trash: {
          ...currentState.trash,
          worldNodes: [{ ...node, deletedAt: nowIso() }, ...currentState.trash.worldNodes],
        },
      }
    })
    setNotice('世界树节点已放入回收花园')
  }

  function handleRestoreMemory(memoryId: string) {
    setState((currentState) => {
      const memory = currentState.trash.memories.find((item) => item.id === memoryId)
      if (!memory) return currentState

      return addMemoryEventToState(
        {
          ...currentState,
          memories: [{ ...memory, status: 'active' as const, updatedAt: nowIso() }, ...currentState.memories],
          trash: {
            ...currentState.trash,
            memories: currentState.trash.memories.filter((item) => item.id !== memoryId),
          },
        },
        {
          type: 'restored',
          actor: 'user',
          title: memory.title,
          detail: '记忆从回收花园恢复为可用状态。',
          memoryIds: [memory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已恢复')
  }

  function handleRestoreWorldNode(nodeId: string) {
    setState((currentState) => {
      const node = currentState.trash.worldNodes.find((item) => item.id === nodeId)
      if (!node) return currentState

      const restoredNode: WorldNode = {
        id: node.id,
        title: node.title,
        keywords: node.keywords,
        content: node.content,
        priority: node.priority,
        enabled: node.enabled,
      }
      return {
        ...currentState,
        worldNodes: [restoredNode, ...currentState.worldNodes],
        trash: {
          ...currentState.trash,
          worldNodes: currentState.trash.worldNodes.filter((item) => item.id !== nodeId),
        },
      }
    })
    setNotice('世界树节点已恢复')
  }

  function handleDeleteTrashedMemory(memoryId: string) {
    setState((currentState) => {
      const deletedMemory = currentState.trash.memories.find((item) => item.id === memoryId)

      return addMemoryEventToState(
        {
          ...currentState,
          memoryTombstones: [
            ...currentState.trash.memories
              .filter((item) => item.id === memoryId)
              .map((memory) => createMemoryTombstone(memory, 'user_permanent_delete')),
            ...currentState.memoryTombstones,
          ],
          trash: {
            ...currentState.trash,
            memories: currentState.trash.memories.filter((item) => item.id !== memoryId),
          },
        },
        {
          type: 'permanently_deleted',
          actor: 'user',
          title: deletedMemory?.title ?? '彻底删除记忆',
          detail: '记忆被永久删除，并留下防复活指纹。',
          memoryIds: [memoryId],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已彻底删除')
  }

  function handleDeleteTrashedWorldNode(nodeId: string) {
    setState((currentState) => ({
      ...currentState,
      trash: {
        ...currentState.trash,
        worldNodes: currentState.trash.worldNodes.filter((item) => item.id !== nodeId),
      },
    }))
    setNotice('世界树节点已彻底删除')
  }

  function handleEmptyTrash() {
    setState((currentState) =>
      addMemoryEventToState(
        {
          ...currentState,
          memoryTombstones: [
            ...currentState.trash.memories.map((memory) => createMemoryTombstone(memory, 'empty_trash')),
            ...currentState.memoryTombstones,
          ],
          trash: {
            memories: [],
            worldNodes: [],
          },
        },
        {
          type: 'trash_emptied',
          actor: 'user',
          title: '清空回收花园',
          detail: `永久删除 ${currentState.trash.memories.length} 条回收记忆。`,
          memoryIds: currentState.trash.memories.map((memory) => memory.id),
          characterId: character.id,
        },
      ),
    )
    setNotice('回收花园已清空')
  }

  function handleUpdateSettings(settings: AppSettings) {
    if (settings.dataStorageMode === 'local' && state.settings.dataStorageMode !== 'local') {
      autoCloudReadyRef.current = false
      skipNextAutoPushRef.current = false
      setCloudMeta(null)
      setCloudStatus('当前为仅本地模式，不会自动上传云端')
      setModelProfileStatus('仅本地模式下不会上传或测试 API Key')
    }

    if (settings.dataStorageMode === 'cloud' && state.settings.dataStorageMode === 'local') {
      setCloudStatus('已切回云端同步，正在等待连接')
      setModelProfileStatus('云端同步开启后会读取模型密钥保险箱')
    }

    setState((currentState) =>
      applyTrashRetention({
        ...currentState,
        settings: normalizeTrashRetentionSettings(settings),
      }),
    )
  }

  async function makeLocalBackup(reason: string) {
    const backup = await createLocalBackup(applyTrashRetention(state), reason)
    await refreshLocalBackups()
    return backup
  }

  async function handleCreateLocalBackup() {
    try {
      const stateWithEvent = addMemoryEventToState(applyTrashRetention(state), {
        type: 'local_backup_created',
        actor: 'user',
        title: '创建本机备份',
        detail: '妹妹手动创建了一份本机保险箱备份。',
        memoryIds: [],
        characterId: character.id,
      })
      const backup = await createLocalBackup(stateWithEvent, '妹妹手动创建')
      setState(stateWithEvent)
      await refreshLocalBackups()
      setNotice(`已创建本机备份：${formatShortDateTime(backup.createdAt)}`)
    } catch {
      setNotice('本机备份创建失败')
    }
  }

  async function handleRestoreLocalBackup(backupId: string) {
    const backup = localBackups.find((item) => item.id === backupId)
    const label = backup ? `${backup.label} / ${formatShortDateTime(backup.createdAt)}` : '这份备份'
    if (!window.confirm(`恢复 ${label} 会覆盖当前本机数据。姐姐会先给当前状态再留一份备份，确定恢复吗？`)) {
      setNotice('已取消恢复备份')
      return
    }

    try {
      await makeLocalBackup('恢复本机备份前自动备份')
      const restoredState = await loadLocalBackup(backupId)
      if (!restoredState) {
        setNotice('这份本机备份没有找到')
        await refreshLocalBackups()
        return
      }

      setState(
        addMemoryEventToState(restoredState, {
          type: 'local_backup_restored',
          actor: 'user',
          title: '恢复本机备份',
          detail: `恢复 ${label}，恢复前已自动备份当前状态。`,
          memoryIds: [],
          characterId: character.id,
        }),
      )
      setNotice('已恢复本机备份')
    } catch {
      setNotice('恢复本机备份失败')
    }
  }

  async function handleDeleteLocalBackup(backupId: string) {
    if (!window.confirm('这只会删除这份本机备份，不影响当前数据。确定删除吗？')) return

    await deleteLocalBackup(backupId)
    await refreshLocalBackups()
    setNotice('本机备份已删除')
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${brand.exportPrefix}-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('数据已导出')
  }

  async function handleImport(file: File) {
    try {
      const importedState = JSON.parse(await file.text()) as AppState
      if (!Array.isArray(importedState.characters) || !Array.isArray(importedState.conversations)) {
        throw new Error('Invalid state file')
      }
      await makeLocalBackup('导入文件前自动备份')
      const migratedState = migrateAppState(importedState)
      setState(
        addMemoryEventToState(migratedState, {
          type: 'imported',
          actor: 'user',
          title: '导入数据',
          detail: '从 JSON 文件导入应用数据，导入前已自动备份当前状态。',
          memoryIds: migratedState.memories.slice(0, 8).map((memory) => memory.id),
          characterId: character.id,
        }),
      )
      setNotice('数据已导入')
    } catch {
      setNotice('导入失败，文件格式或本机备份没有通过')
    }
  }

  async function handleReset() {
    if (!window.confirm('重置会回到初始状态。姐姐会先创建本机备份，确定继续吗？')) {
      setNotice('已取消重置')
      return
    }

    try {
      await makeLocalBackup('重置前自动备份')
      const nextState = await resetAppState()
      setState(
        addMemoryEventToState(nextState, {
          type: 'reset',
          actor: 'user',
          title: '重置应用',
          detail: '回到初始状态，重置前已自动备份当前状态。',
          memoryIds: nextState.memories.map((memory) => memory.id),
          characterId: character.id,
        }),
      )
      setNotice('已回到初始状态，本机旧数据已备份')
    } catch {
      setNotice('重置失败，本机备份没有通过')
    }
  }

  async function handleConnectCloud() {
    if (state.settings.dataStorageMode === 'local') {
      setCloudStatus('当前为仅本地模式，不会连接云端')
      return
    }

    if (!isCloudSyncConfigured()) {
      setCloudStatus('云端后端还没有配置')
      return
    }

    void refreshCloudMetadata(cloudToken)
    void refreshModelProfileList(cloudToken)
    setNotice('云端连接已检查')
  }

  async function handleSaveModelProfile(profile: ModelProfileInput) {
    if (state.settings.dataStorageMode === 'local') {
      setModelProfileStatus('仅本地模式下不会上传 API Key')
      setNotice('仅本地模式不会上传模型密钥')
      return
    }

    try {
      const token = cloudToken.trim()
      setModelProfileBusy(true)
      setModelProfileStatus('正在保存模型配置...')
      const result = await saveModelProfile(token, profile)
      setModelProfiles(result.profiles)
      setState((currentState) => ({
        ...currentState,
        settings: normalizeTrashRetentionSettings({
          ...currentState.settings,
          modelProfileId: result.profile.id,
          model: result.profile.model,
        }),
      }))
      setModelProfileStatus(`已保存并启用：${result.profile.name}`)
      setNotice('模型配置已保存')
    } catch (error) {
      setModelProfileStatus(error instanceof Error ? error.message : '保存模型配置失败')
    } finally {
      setModelProfileBusy(false)
    }
  }

  async function handleDeleteModelProfile(profileId: string) {
    if (state.settings.dataStorageMode === 'local') {
      setModelProfileStatus('仅本地模式下不会改动云端模型配置')
      return
    }

    try {
      const token = cloudToken.trim()
      setModelProfileBusy(true)
      const profiles = await deleteModelProfile(token, profileId)
      setModelProfiles(profiles)
      setState((currentState) => ({
        ...currentState,
        settings:
          currentState.settings.modelProfileId === profileId
            ? normalizeTrashRetentionSettings({
                ...currentState.settings,
                modelProfileId: 'server-env',
              })
            : currentState.settings,
      }))
      setModelProfileStatus('模型配置已删除')
      setNotice('模型配置已删除')
    } catch (error) {
      setModelProfileStatus(error instanceof Error ? error.message : '删除模型配置失败')
    } finally {
      setModelProfileBusy(false)
    }
  }

  async function handleTestModelProfile(input: { profileId?: string; profile?: ModelProfileInput }) {
    if (state.settings.dataStorageMode === 'local') {
      setModelProfileStatus('仅本地模式下不会把 API Key 发到云端测试')
      setNotice('仅本地模式不会测试云端模型')
      return
    }

    try {
      const token = cloudToken.trim()
      setModelProfileBusy(true)
      setModelProfileStatus('正在测试模型连通性...')
      const result = await testModelProfile(token, input)
      setModelProfileStatus(`测试成功：${result.provider} / ${result.model}，${result.latencyMs}ms，${result.preview}`)
      setNotice('模型测试成功')
    } catch (error) {
      setModelProfileStatus(error instanceof Error ? error.message : '模型测试失败')
      setNotice('模型测试失败')
    } finally {
      setModelProfileBusy(false)
    }
  }

  async function handleFetchModelCatalog(input: { profileId?: string; profile?: ModelProfileInput }): Promise<ModelCatalogResult> {
    if (state.settings.dataStorageMode === 'local') {
      const error = new Error('仅本地模式下不会把 API Key 发到模型后端拉取列表')
      setModelProfileStatus(error.message)
      setNotice('仅本地模式不会拉取模型')
      throw error
    }

    try {
      const token = cloudToken.trim()
      setModelProfileBusy(true)
      setModelProfileStatus('正在拉取模型列表...')
      const result = await fetchModelCatalog(token, input)
      setModelProfileStatus(`已拉取 ${result.models.length} 个模型`)
      setNotice('模型列表已更新')
      return result
    } catch (error) {
      setModelProfileStatus(error instanceof Error ? error.message : '模型列表拉取失败')
      setNotice('模型列表拉取失败')
      throw error
    } finally {
      setModelProfileBusy(false)
    }
  }

  async function handlePullCloud() {
    if (cloudBusy) return
    if (state.settings.dataStorageMode === 'local') {
      setCloudStatus('当前为仅本地模式，不会从云端读取')
      return
    }

    try {
      const metadata = cloudMeta ?? (await refreshCloudMetadata(cloudToken))
      if (!metadata?.hasState) {
        setCloudStatus('云端还没有数据，可以先保存一次')
        return
      }

      const confirmed = window.confirm(
        [
          '从云端读取会覆盖这台设备当前数据。',
          `云端版本：v${metadata.revision}`,
          `最后保存：${formatCloudTime(metadata.updatedAt)}`,
          '姐姐会先给当前本机状态创建一份备份，再读取云端。确定继续吗？',
        ].join('\n'),
      )
      if (!confirmed) {
        setCloudStatus('已取消云端读取')
        return
      }

      setCloudBusy('pulling')
      setCloudStatus('正在从云端读取...')
      const snapshot = await pullCloudState(cloudToken)
      if (!snapshot.state) {
        setCloudMeta({
          hasState: false,
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
        })
        setCloudStatus('云端还没有数据，可以先保存一次')
        return
      }

      await makeLocalBackup('从云端读取前自动备份')
      const pulledState = migrateAppState(snapshot.state)
      setState(
        addMemoryEventToState(pulledState, {
          type: 'cloud_pulled',
          actor: 'user',
          title: '读取云端数据',
          detail: `从云端读取 v${snapshot.revision}，读取前已自动备份本机状态。`,
          memoryIds: pulledState.memories.slice(0, 8).map((memory) => memory.id),
          characterId: character.id,
        }),
      )
      setCloudMeta({
        hasState: true,
        revision: snapshot.revision,
        updatedAt: snapshot.updatedAt,
      })
      setCloudStatus(`已读取云端数据 v${snapshot.revision}，本机旧数据已备份`)
      setNotice('云端数据已读取')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '读取云端失败')
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'pulling' ? null : currentTask))
    }
  }

  async function handlePushCloud() {
    if (cloudBusy) return
    if (state.settings.dataStorageMode === 'local') {
      setCloudStatus('当前为仅本地模式，不会保存到云端')
      return
    }

    try {
      setCloudBusy('pushing')
      setCloudStatus('正在保存到云端...')
      const stateToPush = addMemoryEventToState(applyTrashRetention(state), {
        type: 'cloud_pushed',
        actor: 'user',
        title: '保存到云端',
        detail: '把当前本机状态保存到云端快照。',
        memoryIds: state.memories.slice(0, 8).map((memory) => memory.id),
        characterId: character.id,
      })
      const result = await pushCloudState(stateToPush, cloudToken)
      setState(stateToPush)
      setCloudMeta({
        hasState: true,
        revision: result.revision,
        updatedAt: result.updatedAt,
      })
      void refreshCloudBackups(cloudToken)
      setCloudStatus(`已保存到云端 v${result.revision}，时间 ${formatCloudTime(result.updatedAt)}`)
      setNotice('云端数据已保存')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '保存云端失败')
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'pushing' ? null : currentTask))
    }
  }

  async function handleCreateCloudBackup() {
    if (cloudBusy) return
    if (state.settings.dataStorageMode === 'local') {
      setCloudStatus('当前为仅本地模式，不会创建云端备份')
      return
    }

    try {
      setCloudBusy('backing-up')
      setCloudStatus('正在创建云端备份...')
      const backups = await createCloudBackup(cloudToken)
      setCloudBackups(backups)
      setState((currentState) =>
        addMemoryEventToState(currentState, {
          type: 'cloud_backup_created',
          actor: 'user',
          title: '创建云端备份',
          detail: `云端保险箱现有 ${backups.length} 份备份。`,
          memoryIds: [],
          characterId: character.id,
        }),
      )
      setCloudStatus('云端备份已创建')
      setNotice('云端备份已创建')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '创建云端备份失败')
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'backing-up' ? null : currentTask))
    }
  }

  async function handleRefreshCloudBackups() {
    try {
      await refreshCloudBackups(cloudToken)
      setCloudStatus('云端备份列表已刷新')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '刷新云端备份失败')
    }
  }

  async function handleDownloadCloudBackup(fileName: string) {
    try {
      const blob = await downloadCloudBackup(cloudToken, fileName)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice('云端备份已下载')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '下载云端备份失败')
    }
  }


  function handleRefreshCloud() {
    void refreshCloudMetadata(cloudToken)
  }

  return {
    activeView,
    appStyle,
    character,
    cloudBackups,
    cloudBusy,
    cloudMeta,
    cloudStatus,
    cloudSyncConfigured: isCloudSyncConfigured(),
    conversation,
    draft,
    handleAddMemory,
    handleClearCompletedTasks,
    handleConnectCloud,
    handleCreateCloudBackup,
    handleCreateLocalBackup,
    handleDeleteLocalBackup,
    handleDeleteModelProfile,
    handleDeleteTrashedMemory,
    handleDeleteTrashedWorldNode,
    handleDownloadCloudBackup,
    handleEmptyTrash,
    handleExport,
    handleFetchModelCatalog,
    handleImport,
    handleMemoryFeedbackFromChat,
    handleOrganizeMemories,
    handlePullCloud,
    handlePushCloud,
    handleRefreshCloud,
    handleRefreshCloudBackups,
    handleReset,
    handleRestoreLocalBackup,
    handleRestoreMemory,
    handleRestoreMemoryRevision,
    handleRestoreWorldNode,
    handleSaveModelProfile,
    handleSelectCharacter,
    handleSend,
    handleTestModelProfile,
    handleTrashMemory,
    handleTrashWorldNode,
    handleUpdateMemory,
    handleUpdateSettings,
    handleUpdateTaskStatus,
    handleUpdateWorldNode,
    isSending,
    localBackups,
    memoryConflicts,
    modelProfileBusy,
    modelProfileStatus,
    modelProfiles,
    navigateView,
    notice,
    promptBundle,
    setDraft,
    state,
  }
}
