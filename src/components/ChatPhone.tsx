import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { LoaderCircle, Send, SlidersHorizontal, Sparkles } from 'lucide-react'
import type {
  AppSettings,
  CharacterCard,
  ChatMessage,
  LongTermMemory,
  MemoryUsageLog,
  PromptContextBlock,
} from '../domain/types'
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
  onCoolDownMemory: (memoryId: string) => void
  onSend: () => void
  onSettingsClick: () => void
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
  onCoolDownMemory,
  onSend,
  onSettingsClick,
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

  return (
    <main className="workspace chat-workspace">
      <header className="workspace-header">
        <div className="phone-contact">
          <span className="avatar large" style={{ '--avatar-accent': character.accent } as CSSProperties}>
            {character.avatar}
          </span>
          <div>
            <strong>{character.name}</strong>
            <span>{character.subtitle}</span>
          </div>
        </div>
        <button aria-label="模型设置" className="icon-button" onClick={onSettingsClick} type="button">
          <SlidersHorizontal size={19} />
        </button>
      </header>

      <div className="context-row">
        {contextBlocks.length === 0 && <span>短期对话</span>}
        {contextBlocks.slice(0, 5).map((block, index) => (
          <span key={`${block.title}-${index}`}>{block.title.replace('长期记忆：', '').replace('世界树：', '')}</span>
        ))}
      </div>

      <section className="memory-lens" aria-label="本轮记忆调用">
        <div className="memory-lens-title">
          <Sparkles size={15} />
          <strong>本轮记忆</strong>
          <span>{memoryCount > 0 ? `${memoryCount} 条长期记忆待调用` : '只使用最近对话'}</span>
        </div>
        {memoryBlocks.length > 0 && (
          <div className="memory-lens-list">
            {memoryBlocks.slice(0, 4).map((block) => (
              <div className="memory-lens-item" key={block.title}>
                <strong>{block.title}</strong>
                <span>{block.reason ?? '按当前角色和话题筛选'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="message-list" ref={messageListRef}>
        <div className="message-column">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              memoryTrace={message.role === 'assistant' ? traceByAssistantMessageId.get(message.id) : undefined}
              message={message}
              onCoolDownMemory={onCoolDownMemory}
            />
          ))}
          {isSending && (
            <article className="message message-assistant pending">
              <LoaderCircle size={16} />
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
