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
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useYuriNestApp } from './app/useYuriNestApp'
import { CharacterRail } from './components/CharacterRail'
import { ChatPhone } from './components/ChatPhone'
import { MobileMessageList } from './components/MobileMessageList'
import { MobileNav } from './components/MobileNav'
import { QqFeaturePanel } from './components/QqFeaturePanel'

function App() {
  const [mobileMessageListOpen, setMobileMessageListOpen] = useState(true)
  const {
    activeView,
    appStyle,
    character,
    conversation,
    draft,
    handleMemoryFeedbackFromChat,
    handleSelectCharacter,
    handleSend,
    isSending,
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
  const shellClassName = `app-shell ${activeView === 'chat' ? 'chat-mode' : 'feature-mode'}`

  return (
    <div className={shellClassName} style={appStyle}>
      <header className="desktop-titlebar" aria-label="应用顶栏">
        <div className="desktop-titlebar-brand">
          <strong className="desktop-titlebar-logo">AIQ</strong>
          <span
            className="desktop-titlebar-avatar"
            style={{ '--avatar-accent': character.accent } as CSSProperties}
          >
            {character.avatar}
          </span>
          <span className="desktop-titlebar-profile">
            <b>{character.name}</b>
            <small>百合无限好</small>
          </span>
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
      ) : (
        <QqFeaturePanel
          activeCharacterId={state.activeCharacterId}
          activeView={activeView}
          characters={state.characters}
          onOpenChat={handleOpenMobileChat}
        />
      )}

      {showMobileBottomNav && <MobileNav activeView={activeView} onViewChange={handleViewChange} />}
      {notice && <div className="status-pill">{notice}</div>}
    </div>
  )
}

export default App
