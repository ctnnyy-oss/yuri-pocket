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
import { useYuriNestApp } from './app/useYuriNestApp'
import { CharacterRail } from './components/CharacterRail'
import { AgentTaskPanel } from './components/agent/AgentTaskPanel'
import { ChatPhone } from './components/ChatPhone'
import { MobileNav } from './components/MobileNav'
import { MemoryPanel } from './components/MemoryPanel'
import { GroupChatPanel } from './components/social/GroupChatPanel'
import { MomentsPanel } from './components/social/MomentsPanel'

function App() {
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
    promptBundle,
    setDraft,
    state,
  } = useYuriNestApp()

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
          memories={state.memories}
          memoryUsageLogs={state.memoryUsageLogs}
          messages={conversation.messages}
          onDraftChange={setDraft}
          onMemoryFeedback={handleMemoryFeedbackFromChat}
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

      <MobileNav activeView={activeView} onViewChange={navigateView} />
      {notice && <div className="status-pill">{notice}</div>}
    </div>
  )
}

export default App
