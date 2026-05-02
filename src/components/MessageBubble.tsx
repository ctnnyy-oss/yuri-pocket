import type { ChatMessage } from '../domain/types'
import type { MessageMemoryTrace } from '../services/memoryTrace'

interface MessageBubbleProps {
  message: ChatMessage
  memoryTrace?: MessageMemoryTrace
  onCoolDownMemory?: (memoryId: string) => void
}

export function MessageBubble({ memoryTrace, message, onCoolDownMemory }: MessageBubbleProps) {
  return (
    <article className={`message message-${message.role}`}>
      <p>{message.content}</p>
      {memoryTrace && <MemoryTrace onCoolDownMemory={onCoolDownMemory} trace={memoryTrace} />}
      <time dateTime={message.createdAt}>
        {new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(message.createdAt))}
      </time>
    </article>
  )
}

function MemoryTrace({
  onCoolDownMemory,
  trace,
}: {
  onCoolDownMemory?: (memoryId: string) => void
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
              {onCoolDownMemory && (
                <button disabled={item.isCoolingDown} onClick={() => onCoolDownMemory(item.id)} type="button">
                  {item.isCoolingDown ? '已冷却' : '冷却7天'}
                </button>
              )}
            </div>
          ))}
          {trace.missingCount > 0 && <small>另有 {trace.missingCount} 条记忆已被删除或归档。</small>}
        </div>
      )}
    </details>
  )
}
