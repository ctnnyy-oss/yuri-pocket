import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { CharacterRail, type AppView } from './components/CharacterRail'
import { ChatPhone } from './components/ChatPhone'
import { MemoryPanel } from './components/MemoryPanel'
import {
  createLocalBackup,
  deleteLocalBackup,
  listLocalBackups,
  loadAppState,
  loadLocalBackup,
  migrateAppState,
  resetAppState,
  saveAppState,
} from './data/database'
import { createSeedState } from './data/seed'
import type { AccentTheme, AppSettings, AppState, LocalBackupSummary, LongTermMemory, WorldNode } from './domain/types'
import { requestAssistantReply } from './services/chatApi'
import {
  checkCloudHealth,
  type CloudMetadata,
  getSavedCloudToken,
  isCloudSyncConfigured,
  pullCloudState,
  pushCloudState,
  saveCloudToken,
} from './services/cloudSync'
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
} from './services/memoryEngine'
import { applyTrashRetention, normalizeTrashRetentionSettings } from './services/trashRetention'

const themeVariables: Record<AccentTheme, CSSProperties> = {
  sakura: {
    '--page-bg': '#fff6f8',
    '--rose': '#d97798',
    '--rose-strong': '#bd5f82',
    '--rose-soft': '#ffe5ec',
    '--line-strong': '#e5b7c6',
    '--soft-shadow': '0 18px 52px rgba(175, 96, 126, 0.13)',
  } as CSSProperties,
  peach: {
    '--page-bg': '#fff7f2',
    '--rose': '#df8a78',
    '--rose-strong': '#c96e5e',
    '--rose-soft': '#ffe9e1',
    '--line-strong': '#edc3b6',
    '--soft-shadow': '0 18px 52px rgba(185, 106, 86, 0.12)',
  } as CSSProperties,
  lavender: {
    '--page-bg': '#faf7ff',
    '--rose': '#a88ad8',
    '--rose-strong': '#8566b8',
    '--rose-soft': '#f0e9ff',
    '--line-strong': '#d1c0ec',
    '--soft-shadow': '0 18px 52px rgba(122, 92, 173, 0.12)',
  } as CSSProperties,
  mint: {
    '--page-bg': '#f4fbf8',
    '--rose': '#74a695',
    '--rose-strong': '#558b78',
    '--rose-soft': '#e4f4ee',
    '--line-strong': '#b9d9cc',
    '--soft-shadow': '0 18px 52px rgba(78, 134, 113, 0.12)',
  } as CSSProperties,
}

const appViews: AppView[] = ['chat', 'memory', 'world', 'model', 'settings', 'trash']
type CloudBusyTask = 'checking' | 'pulling' | 'pushing'

function readViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'chat'

  const hashView = window.location.hash.replace(/^#\/?/, '')
  if (appViews.includes(hashView as AppView)) return hashView as AppView

  const queryView = new URLSearchParams(window.location.search).get('view')
  if (queryView && appViews.includes(queryView as AppView)) return queryView as AppView

  return 'chat'
}

function buildViewUrl(view: AppView): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('view')
  url.hash = view === 'chat' ? '' : view
  return `${url.pathname}${url.search}${url.hash}`
}

function App() {
  const [state, setState] = useState<AppState>(() => createSeedState())
  const [draft, setDraft] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [activeView, setActiveView] = useState<AppView>(() => readViewFromLocation())
  const [cloudToken, setCloudToken] = useState(() => getSavedCloudToken())
  const [cloudStatus, setCloudStatus] = useState(() => {
    if (!isCloudSyncConfigured()) return '云端后端未配置'
    return getSavedCloudToken() ? '云端口令已保存' : '云端待连接'
  })
  const [cloudMeta, setCloudMeta] = useState<CloudMetadata | null>(null)
  const [cloudBusy, setCloudBusy] = useState<CloudBusyTask | null>(null)
  const [localBackups, setLocalBackups] = useState<LocalBackupSummary[]>([])
  const [notice, setNotice] = useState('花园已就绪')

  const refreshLocalBackups = useCallback(async () => {
    const backups = await listLocalBackups()
    setLocalBackups(backups)
  }, [])

  const refreshCloudMetadata = useCallback(async (token: string) => {
    if (!isCloudSyncConfigured()) {
      setCloudMeta(null)
      setCloudStatus('云端后端还没有配置')
      return null
    }

    const cleanedToken = token.trim()
    if (!cleanedToken) {
      setCloudMeta(null)
      setCloudStatus('云端待连接')
      return null
    }

    setCloudBusy('checking')
    setCloudStatus('正在检查云端状态...')
    try {
      const metadata = await checkCloudHealth(cleanedToken)
      setCloudMeta(metadata)
      setCloudStatus(formatCloudStatus(metadata))
      return metadata
    } catch (error) {
      setCloudMeta(null)
      setCloudStatus(error instanceof Error ? error.message : '检查云端失败')
      return null
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'checking' ? null : currentTask))
    }
  }, [])

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
    loadAppState().then((savedState) => {
      setState(savedState)
      setIsReady(true)
      void refreshLocalBackups()
    })
  }, [refreshLocalBackups])

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
    ...themeVariables[state.settings.accentTheme],
    '--app-font-size': `${state.settings.fontSize}px`,
  } as CSSProperties

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

    const nextState = {
      ...upsertConversation(state, nextConversation),
      memories: keptMemory ? integrateMemoryCandidate(touchedMemories, keptMemory) : touchedMemories,
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
      const reply = await requestAssistantReply(requestBundle, nextState.settings)
      const assistantMessage = createMessage('assistant', reply)
      const repliedConversation = {
        ...nextConversation,
        messages: [...nextConversation.messages, assistantMessage],
        updatedAt: nowIso(),
      }
      setState(
        upsertConversation(
          {
            ...nextStateWithUsage,
            memoryUsageLogs: attachAssistantToMemoryUsageLog(
              nextStateWithUsage.memoryUsageLogs,
              usageLog.id,
              assistantMessage.id,
            ),
          },
          repliedConversation,
        ),
      )
      setNotice('回复完成')
    } catch (error) {
      const fallbackMessage = createMessage(
        'assistant',
        `模型代理刚才没接通，但本地聊天和记忆没有丢。\n\n${
          error instanceof Error ? error.message : '未知错误'
        }`,
      )
      setState(
        upsertConversation(nextStateWithUsage, {
          ...nextConversation,
          messages: [...nextConversation.messages, fallbackMessage],
          updatedAt: nowIso(),
        }),
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

    setState((currentState) => ({
      ...currentState,
      memories: [memory, ...currentState.memories],
    }))
    setNotice('最近聊天已整理')
  }

  function handleUpdateMemory(updatedMemory: LongTermMemory) {
    setState((currentState) => ({
      ...currentState,
      memories: currentState.memories.map((memory) =>
        memory.id === updatedMemory.id ? updateMemoryWithRevision(memory, updatedMemory, '妹妹手动编辑') : memory,
      ),
    }))
    setNotice('记忆已修改')
  }

  function handleOrganizeMemories() {
    const report = consolidateMemoryGarden(state.memories)
    setState((currentState) => ({
      ...currentState,
      memories: report.memories,
    }))
    setNotice(
      report.mergedCount > 0 ? `已整理 ${report.reviewedCount} 条，合并 ${report.mergedCount} 条` : '记忆系统已检查',
    )
  }

  function handleRestoreMemoryRevision(memoryId: string, revisionId: string) {
    setState((currentState) => ({
      ...currentState,
      memories: currentState.memories.map((memory) =>
        memory.id === memoryId ? restoreMemoryRevision(memory, revisionId) : memory,
      ),
    }))
    setNotice('记忆已回滚')
  }

  function handleTrashMemory(memoryId: string) {
    setState((currentState) => {
      const memory = currentState.memories.find((item) => item.id === memoryId)
      if (!memory) return currentState

      return {
        ...currentState,
        memories: currentState.memories.filter((item) => item.id !== memoryId),
        trash: {
          ...currentState.trash,
          memories: [{ ...memory, status: 'trashed' as const, deletedAt: nowIso() }, ...currentState.trash.memories],
        },
      }
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

      return {
        ...currentState,
        memories: [{ ...memory, status: 'active' as const, updatedAt: nowIso() }, ...currentState.memories],
        trash: {
          ...currentState.trash,
          memories: currentState.trash.memories.filter((item) => item.id !== memoryId),
        },
      }
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
    setState((currentState) => ({
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
    }))
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
    setState((currentState) => ({
      ...currentState,
      memoryTombstones: [
        ...currentState.trash.memories.map((memory) => createMemoryTombstone(memory, 'empty_trash')),
        ...currentState.memoryTombstones,
      ],
      trash: {
        memories: [],
        worldNodes: [],
      },
    }))
    setNotice('回收花园已清空')
  }

  function handleUpdateSettings(settings: AppSettings) {
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
      const backup = await makeLocalBackup('妹妹手动创建')
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

      setState(restoredState)
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
    anchor.download = `yuri-pocket-${new Date().toISOString().slice(0, 10)}.json`
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
      setState(migrateAppState(importedState))
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
      setState(nextState)
      setNotice('已回到初始状态，本机旧数据已备份')
    } catch {
      setNotice('重置失败，本机备份没有通过')
    }
  }

  async function handleConnectCloud() {
    if (!isCloudSyncConfigured()) {
      setCloudStatus('云端后端还没有配置')
      return
    }

    const token = window.prompt('输入姐姐给妹妹保存的云端口令')
    if (token === null) return

    const cleanedToken = token.trim()
    saveCloudToken(cleanedToken)
    setCloudToken(cleanedToken)
    if (!cleanedToken) {
      setCloudMeta(null)
      setCloudStatus('云端口令已清除')
      return
    }

    setCloudStatus('云端口令已保存')
    void refreshCloudMetadata(cleanedToken)
  }

  async function handlePullCloud() {
    if (cloudBusy) return

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
      setState(migrateAppState(snapshot.state))
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

    try {
      setCloudBusy('pushing')
      setCloudStatus('正在保存到云端...')
      const result = await pushCloudState(applyTrashRetention(state), cloudToken)
      setCloudMeta({
        hasState: true,
        revision: result.revision,
        updatedAt: result.updatedAt,
      })
      setCloudStatus(`已保存到云端 v${result.revision}，时间 ${formatCloudTime(result.updatedAt)}`)
      setNotice('云端数据已保存')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '保存云端失败')
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'pushing' ? null : currentTask))
    }
  }

  return (
    <div className="app-shell" style={appStyle}>
      <CharacterRail
        activeCharacterId={state.activeCharacterId}
        activeView={activeView}
        characters={state.characters}
        onSelect={handleSelectCharacter}
        onViewChange={navigateView}
      />

      {activeView === 'chat' ? (
        <ChatPhone
          character={character}
          contextBlocks={promptBundle.contextBlocks}
          draft={draft}
          isSending={isSending}
          messages={conversation.messages}
          onDraftChange={setDraft}
          onSend={handleSend}
          onSettingsClick={() => navigateView('settings')}
          settings={state.settings}
        />
      ) : (
        <MemoryPanel
          activeView={activeView}
          activeCharacterId={state.activeCharacterId}
          activeConversationId={conversation.id}
          characters={state.characters}
          memoryConflicts={memoryConflicts}
          memoryUsageLogs={state.memoryUsageLogs}
          memories={state.memories}
          onAddMemory={handleAddMemory}
          onDeleteTrashedMemory={handleDeleteTrashedMemory}
          onDeleteTrashedWorldNode={handleDeleteTrashedWorldNode}
          onEmptyTrash={handleEmptyTrash}
          onExport={handleExport}
          onImport={handleImport}
          onOrganizeMemories={handleOrganizeMemories}
          onReset={handleReset}
          onRestoreMemoryRevision={handleRestoreMemoryRevision}
          onRestoreMemory={handleRestoreMemory}
          onRestoreWorldNode={handleRestoreWorldNode}
          onTrashMemory={handleTrashMemory}
          onTrashWorldNode={handleTrashWorldNode}
          onUpdateMemory={handleUpdateMemory}
          onUpdateSettings={handleUpdateSettings}
          onUpdateWorldNode={handleUpdateWorldNode}
          cloudStatus={cloudStatus}
          cloudMeta={cloudMeta}
          cloudBusy={cloudBusy}
          cloudSyncConfigured={isCloudSyncConfigured()}
          cloudTokenSet={Boolean(cloudToken)}
          onConnectCloud={handleConnectCloud}
          onPullCloud={handlePullCloud}
          onPushCloud={handlePushCloud}
          onRefreshCloud={() => void refreshCloudMetadata(cloudToken)}
          localBackups={localBackups}
          onCreateLocalBackup={handleCreateLocalBackup}
          onDeleteLocalBackup={handleDeleteLocalBackup}
          onRestoreLocalBackup={handleRestoreLocalBackup}
          settings={state.settings}
          trash={state.trash}
          worldNodes={state.worldNodes}
        />
      )}

      <div className="status-pill">{notice}</div>
    </div>
  )
}

function formatCloudStatus(metadata: CloudMetadata): string {
  if (!metadata.hasState) return '云端已连接，暂时还没有保存过数据'
  return `云端有数据 v${metadata.revision}，最后保存 ${formatCloudTime(metadata.updatedAt)}`
}

function formatCloudTime(value: string | null): string {
  if (!value) return '暂无记录'
  return formatShortDateTime(value)
}

function formatShortDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default App
