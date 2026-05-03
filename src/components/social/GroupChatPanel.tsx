import { MessagesSquare, UsersRound } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { AgentRoom, CharacterCard } from '../../domain/types'
import { EmptyState, WorkspaceTitle } from '../memory/atoms'

interface GroupChatPanelProps {
  characters: CharacterCard[]
  rooms: AgentRoom[]
}

export function GroupChatPanel({ characters, rooms }: GroupChatPanelProps) {
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id ?? '')
  const characterById = useMemo(() => new Map(characters.map((character) => [character.id, character])), [characters])
  const orderedRooms = useMemo(
    () =>
      rooms
        .map((room, index) => ({ room, index }))
        .sort((left, right) => {
          const leftHasMessages = left.room.messages.length > 0
          const rightHasMessages = right.room.messages.length > 0
          if (leftHasMessages !== rightHasMessages) return leftHasMessages ? -1 : 1
          if (leftHasMessages && rightHasMessages) {
            return new Date(right.room.updatedAt).getTime() - new Date(left.room.updatedAt).getTime()
          }
          return left.index - right.index
        })
        .map((item) => item.room),
    [rooms],
  )
  const selectedRoom = orderedRooms.find((room) => room.id === selectedRoomId) ?? orderedRooms[0]
  const selectedMessages = [...(selectedRoom?.messages ?? [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )

  return (
    <main className="workspace detail-workspace social-workspace">
      <WorkspaceTitle
        description="多人角色房间和 CP 互聊记录单独放在这里。"
        icon={<MessagesSquare size={20} />}
        title="群聊"
      />

      <section className="social-layout group-layout">
        <aside className="room-list-panel" aria-label="群聊房间">
          <div className="social-section-title">
            <UsersRound size={16} />
            <span>房间</span>
          </div>
          <div className="room-list">
            {orderedRooms.map((room) => {
              const lastMessage = room.messages[room.messages.length - 1]
              const lastAuthor = lastMessage ? characterById.get(lastMessage.authorCharacterId) : null
              const active = selectedRoom?.id === room.id

              return (
                <button
                  className={`room-list-item ${active ? 'active' : ''}`}
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  type="button"
                >
                  <span className="room-avatar-stack" aria-hidden="true">
                    {room.memberCharacterIds.slice(0, 3).map((characterId) => {
                      const character = characterById.get(characterId)
                      return (
                        <span
                          className="room-mini-avatar"
                          key={characterId}
                          style={{ '--avatar-accent': character?.accent ?? 'var(--rose)' } as CSSProperties}
                        >
                          {character?.avatar ?? '？'}
                        </span>
                      )
                    })}
                  </span>
                  <span className="room-list-copy">
                    <strong>{room.title}</strong>
                    <small>
                      {lastMessage
                        ? `${lastAuthor?.name ?? '角色'}：${lastMessage.content}`
                        : room.description}
                    </small>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="room-chat-panel">
          {selectedRoom ? (
            <>
              <header className="room-chat-head">
                <div>
                  <strong>{selectedRoom.title}</strong>
                  <span>{selectedRoom.description}</span>
                </div>
                <div className="room-member-chips">
                  {selectedRoom.memberCharacterIds.slice(0, 8).map((characterId) => {
                    const character = characterById.get(characterId)
                    return (
                      <span className="room-member-chip" key={characterId}>
                        {character?.avatar ?? '？'} {character?.name ?? '角色'}
                      </span>
                    )
                  })}
                </div>
              </header>

              <div className="room-message-list">
                {selectedMessages.length === 0 && <EmptyState text="这间房还没有群聊消息。" />}
                {selectedMessages.map((message) => {
                  const author = characterById.get(message.authorCharacterId)
                  return (
                    <article className="room-message-row" key={message.id}>
                      <span
                        className="room-message-avatar"
                        style={{ '--avatar-accent': author?.accent ?? 'var(--rose)' } as CSSProperties}
                      >
                        {author?.avatar ?? '？'}
                      </span>
                      <div className="room-message-card">
                        <header>
                          <strong>{author?.name ?? '角色'}</strong>
                          <span>{formatSocialTime(message.createdAt)}</span>
                        </header>
                        <p>{message.content}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          ) : (
            <EmptyState text="群聊房间还没有初始化。" />
          )}
        </section>
      </section>
    </main>
  )
}

function formatSocialTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
