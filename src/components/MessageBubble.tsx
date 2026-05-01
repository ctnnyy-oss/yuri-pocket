import type { ChatMessage } from '../domain/types'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <article className={`message message-${message.role}`}>
      <p>{message.content}</p>
      <time dateTime={message.createdAt}>
        {new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(message.createdAt))}
      </time>
    </article>
  )
}
