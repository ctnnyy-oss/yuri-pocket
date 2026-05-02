import type { ChatMessage } from '../domain/types'
import type { MemoryFeedbackAction } from '../services/memoryFeedback'
import type { MessageMemoryTrace } from '../services/memoryTrace'

interface MessageBubbleProps {
  message: ChatMessage
  memoryTrace?: MessageMemoryTrace
  onMemoryFeedback?: (memoryId: string, action: MemoryFeedbackAction) => void
}

export function MessageBubble({ memoryTrace, message, onMemoryFeedback }: MessageBubbleProps) {
  return (
    <article className={`message message-${message.role}`}>
      <p>{message.content}</p>
      {memoryTrace && <MemoryTrace onMemoryFeedback={onMemoryFeedback} trace={memoryTrace} />}
      <time dateTime={message.createdAt}>
        {new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(message.createdAt))}
      </time>
    </article>
  )
}

const memoryFeedbackLabels: Record<MemoryFeedbackAction, string> = {
  cooldown: '冷却7天',
  contextual: '少用',
  explicit: '问起再提',
  sensitive: '标敏感',
  archive: '归档',
}

function MemoryTrace({
  onMemoryFeedback,
  trace,
}: {
  onMemoryFeedback?: (memoryId: string, action: MemoryFeedbackAction) => void
  trace: MessageMemoryTrace
}) {
  const usedMemoryText = trace.memoryCount > 0 ? `调用 ${trace.memoryCount} 条记忆` : '只用最近对话'

  return (
    <details className="message-memory-trace">
      <summary>
        <span>{usedMemoryText}</span>
        {trace.groupTitles.length > 0 && <small>{trace.groupTitles.join(' / ')}</small>}
      </summary>
      {trace.items.length === 0 ? (
        <p className="trace-empty">这条回复没有注入长期记忆。</p>
      ) : (
        <div className="trace-memory-list">
          {trace.items.map((item) => (
            <div className="trace-memory-item" key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
              <p>{item.body}</p>
              {onMemoryFeedback && (
                <div aria-label="记忆反馈" className="trace-feedback-row">
                  {item.enabledActions.length > 0 ? (
                    item.enabledActions.map((action) => (
                      <button key={action} onClick={() => onMemoryFeedback(item.id, action)} type="button">
                        {memoryFeedbackLabels[action]}
                      </button>
                    ))
                  ) : (
                    <small>{item.status === 'archived' ? '已归档' : '已按保守方式使用'}</small>
                  )}
                </div>
              )}
            </div>
          ))}
          {trace.missingCount > 0 && <small>另有 {trace.missingCount} 条记忆已被删除或归档。</small>}
        </div>
      )}
    </details>
  )
}
