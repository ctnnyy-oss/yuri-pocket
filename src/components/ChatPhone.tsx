import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, ListChecks, Send, Sparkles, WandSparkles } from 'lucide-react'
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

const quickPrompts = [
  { label: '现在几点', prompt: '姐姐，现在北京时间几点？今天是几月几号星期几？', icon: Clock3 },
  { label: '总结一下', prompt: '姐姐，帮妹妹把刚刚这段对话整理成简短摘要和待办。', icon: ListChecks },
  { label: '下一步', prompt: '姐姐，根据当前上下文，给妹妹三个最适合的下一步。', icon: Sparkles },
  { label: '设定检查', prompt: '姐姐，帮妹妹检查当前角色和世界观设定有没有矛盾或缺口。', icon: WandSparkles },
]

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
  const [now, setNow] = useState(() => new Date())
  const memoryBlocks = contextBlocks.filter((block) => block.memoryIds?.length)
  const memoryCount = new Set(memoryBlocks.flatMap((block) => block.memoryIds ?? [])).size
  const currentTimeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now),
    [now],
  )
  const currentDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      }).format(now),
    [now],
  )
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

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
        <div className="chat-header-actions">
          <div aria-label="当前北京时间" className="live-clock">
            <Clock3 size={15} />
            <span>{currentDateLabel}</span>
            <strong>{currentTimeLabel}</strong>
          </div>
          <div className="assistant-tools" aria-label="智能快捷能力">
            {quickPrompts.map((item) => {
              const Icon = item.icon
              return (
                <button key={item.label} onClick={() => onDraftChange(item.prompt)} type="button">
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              )
            })}
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
