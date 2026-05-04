import './styles/shell.css'
import './styles/sidebar.css'
import './styles/chat.css'
import './styles/memory.css'
import './styles/guardian.css'
import './styles/settings.css'
import './styles/modal.css'
import './styles/buttons.css'
import './styles/status.css'
import './styles/social.css'
import './styles/tasks.css'
import './styles/mobile.css'
import { CloudSun, Maximize2, Minus, PanelsTopLeft, X } from 'lucide-react'
import { useState } from 'react'
import { useYuriNestApp } from './app/useYuriNestApp'
import { CharacterRail } from './components/CharacterRail'
import { AgentTaskPanel } from './components/agent/AgentTaskPanel'
import { ChatPhone } from './components/ChatPhone'
import { MobileMessageList } from './components/MobileMessageList'
import { MobileNav } from './components/MobileNav'
import { MemoryPanel } from './components/MemoryPanel'
import { GroupChatPanel } from './components/social/GroupChatPanel'
import { MomentsPanel } from './components/social/MomentsPanel'

function App() {
  const [mobileMessageListOpen, setMobileMessageListOpen] = useState(true)
  const {
    activeView,
    appStyle,
    character,
    cloudBackups,
    cloudBusy,
    cloudMeta,
    cloudStatus,
    cloudSyncConfigured,
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
    setDraft,
    state,
  } = useYuriNestApp()

  function handleViewChange(view: typeof activeView) {
    navigateView(view)
    if (view === 'chat') {
      setMobileMessageListOpen(true)
    }
  }

  function handleOpenMobileChat(characterId: string) {
    handleSelectCharacter(characterId)
    navigateView('chat')
    setMobileMessageListOpen(false)
  }

  const showMobileBottomNav = activeView !== 'chat' || mobileMessageListOpen

  return (
    <div className="app-shell" style={appStyle}>
      <header className="desktop-titlebar" aria-label="应用顶栏">
        <div className="desktop-titlebar-brand">
          <strong>百合小窝</strong>
          <span>{character.name}</span>
        </div>
        <div className="desktop-titlebar-status">
          <CloudSun size={18} />
          <span>晴</span>
          <button aria-label="布局" type="button">
            <PanelsTopLeft size={16} />
          </button>
          <button aria-label="最小化" type="button">
            <Minus size={16} />
          </button>
          <button aria-label="最大化" type="button">
            <Maximize2 size={15} />
          </button>
          <button aria-label="关闭" type="button">
            <X size={17} />
          </button>
        </div>
      </header>

      <CharacterRail
        activeCharacterId={state.activeCharacterId}
        activeView={activeView}
        characters={state.characters}
        onSelect={handleSelectCharacter}
        onViewChange={handleViewChange}
      />

      {activeView === 'chat' && mobileMessageListOpen && (
        <MobileMessageList
          activeCharacterId={state.activeCharacterId}
          characters={state.characters}
          onOpenChat={handleOpenMobileChat}
        />
      )}

      {activeView === 'chat' ? (
        <ChatPhone
          activeCharacterId={state.activeCharacterId}
          character={character}
          characters={state.characters}
          draft={draft}
          isSending={isSending}
          memories={state.memories}
          memoryUsageLogs={state.memoryUsageLogs}
          messages={conversation.messages}
          onBackToList={() => setMobileMessageListOpen(true)}
          onDraftChange={setDraft}
          onMemoryFeedback={handleMemoryFeedbackFromChat}
          onSelectCharacter={handleSelectCharacter}
          onSend={handleSend}
          settings={state.settings}
        />
      ) : activeView === 'group' ? (
        <GroupChatPanel characters={state.characters} rooms={state.agentRooms} />
      ) : activeView === 'moments' ? (
        <MomentsPanel characters={state.characters} moments={state.agentMoments} />
      ) : activeView === 'tasks' ? (
        <AgentTaskPanel
          characters={state.characters}
          onClearCompleted={handleClearCompletedTasks}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          tasks={state.agentTasks ?? []}
        />
      ) : (
        <MemoryPanel
          activeView={activeView}
          activeCharacterId={state.activeCharacterId}
          activeConversationId={conversation.id}
          characters={state.characters}
          memoryConflicts={memoryConflicts}
          memoryEvents={state.memoryEvents}
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
          modelProfiles={modelProfiles}
          modelProfileStatus={modelProfileStatus}
          modelProfileBusy={modelProfileBusy}
          onSaveModelProfile={handleSaveModelProfile}
          onDeleteModelProfile={handleDeleteModelProfile}
          onFetchModelCatalog={handleFetchModelCatalog}
          onTestModelProfile={handleTestModelProfile}
          cloudStatus={cloudStatus}
          cloudMeta={cloudMeta}
          cloudBusy={cloudBusy}
          cloudBackups={cloudBackups}
          cloudSyncConfigured={cloudSyncConfigured}
          onConnectCloud={handleConnectCloud}
          onPullCloud={handlePullCloud}
          onPushCloud={handlePushCloud}
          onRefreshCloud={handleRefreshCloud}
          onCreateCloudBackup={handleCreateCloudBackup}
          onDownloadCloudBackup={handleDownloadCloudBackup}
          onRefreshCloudBackups={handleRefreshCloudBackups}
          localBackups={localBackups}
          onCreateLocalBackup={handleCreateLocalBackup}
          onDeleteLocalBackup={handleDeleteLocalBackup}
          onRestoreLocalBackup={handleRestoreLocalBackup}
          settings={state.settings}
          trash={state.trash}
          worldNodes={state.worldNodes}
        />
      )}

      {showMobileBottomNav && <MobileNav activeView={activeView} onViewChange={handleViewChange} />}
      {notice && <div className="status-pill">{notice}</div>}
    </div>
  )
}

export default App
