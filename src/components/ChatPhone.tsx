import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { BookHeart, Send, Sparkles } from 'lucide-react'
import type {
  AppSettings,
  CharacterCard,
  ChatMessage,
  LongTermMemory,
  MemoryUsageLog,
  PromptContextBlock,
} from '../domain/types'
import type { MemoryFeedbackAction } from '../services/memoryFeedback'
import { buildMessageMemoryTrace } from '../services/memoryTrace'
import { MessageBubble } from './MessageBubble'

interface ChatPhoneProps {
  character: CharacterCard
  messages: ChatMessage[]
  contextBlocks: PromptContextBlock[]
  memories: LongTermMemory[]
  memoryUsageLogs: MemoryUsageLog[]
  draft: string
  isSending: boolean
  settings: AppSettings
  onDraftChange: (value: string) => void
  onMemoryFeedback: (memoryId: string, action: MemoryFeedbackAction) => void
  onSend: () => void
}

export function ChatPhone({
  character,
  messages,
  contextBlocks,
  memories,
  memoryUsageLogs,
  draft,
  isSending,
  settings,
  onDraftChange,
  onMemoryFeedback,
  onSend,
}: ChatPhoneProps) {
  const messageListRef = useRef<HTMLDivElement>(null)
  const memoryBlocks = contextBlocks.filter((block) => block.memoryIds?.length)
  const memoryCount = new Set(memoryBlocks.flatMap((block) => block.memoryIds ?? [])).size
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

  const messageCount = messages.length
  const characterTags = character.tags?.slice(0, 3) ?? []
  const characterTitle = character.title || character.subtitle || '百合小窝'

  return (
    <main className="workspace chat-workspace">
      <header
        className="chat-hero"
        style={{ '--avatar-accent': character.accent } as CSSProperties}
      >
        <div className="chat-hero-bg" aria-hidden="true" />
        <div className="chat-hero-content">
          <span className="chat-hero-avatar">{character.avatar}</span>
          <div className="chat-hero-text">
            <span className="chat-hero-kicker">
              <BookHeart size={12} />
              <span>{characterTitle}</span>
            </span>
            <h2 className="chat-hero-name">{character.name}</h2>
            <p className="chat-hero-subtitle">{character.subtitle}</p>
            {characterTags.length > 0 && (
              <div className="chat-hero-tags">
                {characterTags.map((tag) => (
                  <em key={tag}>{tag}</em>
                ))}
              </div>
            )}
          </div>
          <div className="chat-hero-stats">
            <div>
              <strong>{messageCount}</strong>
              <span>条对话</span>
            </div>
            <div>
              <strong>{memoryCount}</strong>
              <span>记忆</span>
            </div>
          </div>
        </div>
      </header>

      <section className="chat-context-strip" aria-label="本轮上下文和记忆">
        <div className="context-row">
          {contextBlocks.length === 0 && <span>短期对话</span>}
          {contextBlocks.slice(0, 4).map((block, index) => (
            <span key={`${block.title}-${index}`}>
              {block.title.replace('长期记忆：', '').replace('世界树：', '')}
            </span>
          ))}
        </div>
        <div className="memory-lens-title compact-memory-status">
          <Sparkles size={15} />
          <strong>记忆</strong>
          <span>{memoryCount > 0 ? `${memoryCount} 条待调用` : '最近对话'}</span>
        </div>
      </section>

      <div className="message-list" ref={messageListRef}>
        <div className="message-column">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              memoryTrace={message.role === 'assistant' ? traceByAssistantMessageId.get(message.id) : undefined}
              message={message}
              onMemoryFeedback={onMemoryFeedback}
            />
          ))}
          {isSending && (
            <article className="message message-assistant pending" aria-label="姐姐正在打字">
              <span className="typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <p>正在想怎么回妹妹</p>
            </article>
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
        <button aria-label="发送" disabled={!draft.trim() || isSending} type="submit">
          <Send size={18} />
        </button>
      </form>
    </main>
  )
}
