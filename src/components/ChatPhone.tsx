import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import {
  Camera,
  ChevronLeft,
  Image,
  Menu,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  PlusCircle,
  Search,
  Send,
  Smile,
  Video,
} from 'lucide-react'
import type {
  AppSettings,
  CharacterCard,
  ChatMessage,
  LongTermMemory,
  MemoryUsageLog,
} from '../domain/types'
import type { MemoryFeedbackAction } from '../services/memoryFeedback'
import { buildMessageMemoryTrace } from '../services/memoryTrace'
import { MessageBubble } from './MessageBubble'

interface ChatPhoneProps {
  character: CharacterCard
  characters: CharacterCard[]
  activeCharacterId: string
  messages: ChatMessage[]
  memories: LongTermMemory[]
  memoryUsageLogs: MemoryUsageLog[]
  draft: string
  isSending: boolean
  settings: AppSettings
  onDraftChange: (value: string) => void
  onBackToList?: () => void
  onSelectCharacter: (characterId: string) => void
  onMemoryFeedback: (memoryId: string, action: MemoryFeedbackAction) => void
  onSend: () => void
}

export function ChatPhone({
  character,
  characters,
  activeCharacterId,
  messages,
  memories,
  memoryUsageLogs,
  draft,
  isSending,
  settings,
  onBackToList,
  onDraftChange,
  onSelectCharacter,
  onMemoryFeedback,
  onSend,
}: ChatPhoneProps) {
  const messageListRef = useRef<HTMLDivElement>(null)
  const traceByAssistantMessageId = useMemo(() => {
    return new Map(
      memoryUsageLogs
        .filter((log) => log.assistantMessageId)
        .map((log) => [log.assistantMessageId as string, buildMessageMemoryTrace(log, memories)]),
    )
  }, [memories, memoryUsageLogs])

  function insertLineBreak(textarea: HTMLTextAreaElement) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const nextDraft = `${draft.slice(0, start)}\n${draft.slice(end)}`
    onDraftChange(nextDraft)

    requestAnimationFrame(() => {
      textarea.selectionStart = start + 1
      textarea.selectionEnd = start + 1
    })
  }

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isSending])

  return (
    <main className="workspace chat-workspace">
      <header
        className="chat-topbar"
        style={{ '--avatar-accent': character.accent } as CSSProperties}
      >
        <button aria-label="返回消息" className="mobile-chat-back" onClick={onBackToList} type="button">
          <ChevronLeft size={28} />
        </button>
        <div className="chat-topbar-main">
          <span className="chat-topbar-avatar">{character.avatar}</span>
          <div className="chat-topbar-text">
            <strong>{character.name}</strong>
            <span>{character.subtitle || character.title}</span>
          </div>
          <select
            aria-label="切换聊天角色"
            className="chat-character-select"
            onChange={(event) => onSelectCharacter(event.target.value)}
            value={activeCharacterId}
          >
            {characters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="chat-topbar-actions" aria-label="聊天工具">
          <button aria-label="搜索对话" title="搜索对话" type="button">
            <Search size={18} />
          </button>
          <button aria-label="语音通话" title="语音通话" type="button">
            <Phone size={18} />
          </button>
          <button aria-label="视频通话" title="视频通话" type="button">
            <Video size={18} />
          </button>
          <button aria-label="更多" title="更多" type="button">
            <MoreHorizontal size={20} />
          </button>
          <button aria-label="菜单" className="mobile-menu-button" title="菜单" type="button">
            <Menu size={24} />
          </button>
        </div>
      </header>

      <div className="message-list" ref={messageListRef}>
        <div className="message-column">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              character={character}
              previousMessage={messages[index - 1] ?? null}
              showDevTrace={settings.showDevTrace}
              memoryTrace={message.role === 'assistant' ? traceByAssistantMessageId.get(message.id) : undefined}
              onMemoryFeedback={onMemoryFeedback}
            />
          ))}
          {isSending && (
            <div className="chat-row chat-row-assistant">
              <span
                className="chat-row-avatar"
                style={{ '--avatar-accent': character.accent } as CSSProperties}
              >
                {character.avatar}
              </span>
              <article className="message message-assistant pending" aria-label="正在输入">
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </article>
            </div>
          )}
        </div>
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
        }}
      >
        <div className="composer-entry">
          <textarea
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return

              if (settings.enterToSend) {
                if (event.ctrlKey || event.metaKey) {
                  event.preventDefault()
                  insertLineBreak(event.currentTarget)
                  return
                }

                if (event.shiftKey) return
                event.preventDefault()
                onSend()
                return
              }

              if (event.ctrlKey || event.metaKey) {
                event.preventDefault()
                onSend()
              }
            }}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="和她说点什么"
            rows={1}
            value={draft}
          />
          <button aria-label="发送" className="composer-send" disabled={!draft.trim() || isSending} type="submit">
            <Send size={18} />
          </button>
        </div>
        <div className="composer-toolbar" aria-label="快捷工具">
          <button aria-label="语音" className="composer-tool" title="语音" type="button">
            <Mic size={20} />
          </button>
          <button aria-label="图片" className="composer-tool" title="图片" type="button">
            <Image size={20} />
          </button>
          <button aria-label="拍摄" className="composer-tool" title="拍摄" type="button">
            <Camera size={20} />
          </button>
          <button aria-label="文件" className="composer-tool" title="文件" type="button">
            <Paperclip size={20} />
          </button>
          <button aria-label="表情" className="composer-tool" title="表情" type="button">
            <Smile size={20} />
          </button>
          <button aria-label="更多" className="composer-tool" title="更多" type="button">
            <PlusCircle size={21} />
          </button>
        </div>
      </form>
    </main>
  )
}
