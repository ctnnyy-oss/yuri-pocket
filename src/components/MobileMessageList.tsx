import type { CSSProperties } from 'react'
import { BellOff, ChevronRight, Plus, Search } from 'lucide-react'
import type { CharacterCard, ConversationState } from '../domain/types'

interface MobileMessageListProps {
  characters: CharacterCard[]
  conversations: ConversationState[]
  activeCharacterId: string
  onOpenChat: (characterId: string) => void
  onOpenGroupChat?: (group: { name: string; text: string }) => void
  onShellAction?: (message: string) => void
}

const threadTimes = ['下午5:42', '星期六', '星期三', '04/11', '04/03', '03/26', '03/22']
const groupThreads = [
  { name: '三对CP茶会', avatar: '群', text: '六位角色都在这里，当前可拉起本地群聊', time: '下午5:49', badge: '6' },
  { name: '百合创作小屋', avatar: '百', text: '只保留项目需要的群聊入口', time: '星期六', badge: '' },
]

function MobileStatusBar() {
  return (
    <div className="mobile-status-bar" aria-hidden="true">
      <b>7:03</b>
      <span className="mobile-signal">5G 5G ▰▰▰ 37</span>
    </div>
  )
}

function isGroupCharacter(character: CharacterCard) {
  return character.relationship === '群聊'
}

function formatThreadTime(value?: string, fallback = '今天') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getLastConversationText(conversation?: ConversationState, fallback = '还没有聊天记录') {
  const lastMessage = conversation?.messages.at(-1)
  if (!lastMessage?.content) return fallback
  return lastMessage.content.replace(/\s+/g, ' ').slice(0, 24)
}

function getUnreadCount(conversation?: ConversationState) {
  return Math.max(0, conversation?.unreadCount ?? 0)
}

function formatUnreadBadge(count: number) {
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
}

export function MobileMessageList({
  characters,
  conversations,
  activeCharacterId,
  onOpenChat,
  onOpenGroupChat,
}: MobileMessageListProps) {
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]
  const roleCharacters = characters.filter((character) => !isGroupCharacter(character))
  const groupCharacters = characters.filter(isGroupCharacter)
  const conversationByCharacterId = new Map(conversations.map((conversation) => [conversation.characterId, conversation]))
  const defaultGroupNames = new Set(groupThreads.map((thread) => thread.name))
  const visibleGroups = [
    ...groupThreads.map((thread) => {
      const existing = groupCharacters.find((character) => character.name === thread.name)
      const conversation = conversationByCharacterId.get(existing?.id ?? '')
      return {
        ...thread,
        avatar: existing?.avatar ?? thread.avatar,
        text: existing ? getLastConversationText(conversation, existing.mood) : thread.text,
        time: existing ? formatThreadTime(conversation?.updatedAt, thread.time) : thread.time,
        characterId: existing?.id ?? '',
        updatedAt: conversation?.updatedAt ?? '',
      }
    }),
    ...groupCharacters
      .filter((character) => !defaultGroupNames.has(character.name))
      .map((character) => ({
        name: character.name,
        avatar: character.avatar,
        text: getLastConversationText(conversationByCharacterId.get(character.id), character.mood || character.title),
        time: formatThreadTime(conversationByCharacterId.get(character.id)?.updatedAt),
        badge: '',
        characterId: character.id,
        updatedAt: conversationByCharacterId.get(character.id)?.updatedAt ?? '',
      })),
  ].sort((left, right) => {
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0
    return rightTime - leftTime
  })
  const visibleRoleCharacters = [...roleCharacters].sort((left, right) => {
    const leftTime = new Date(conversationByCharacterId.get(left.id)?.updatedAt ?? '').getTime() || 0
    const rightTime = new Date(conversationByCharacterId.get(right.id)?.updatedAt ?? '').getTime() || 0
    return rightTime - leftTime
  })

  return (
    <section className="mobile-message-list" aria-label="手机消息列表">
      <MobileStatusBar />
      <header
        className="mobile-message-header"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('.mobile-message-plus')) {
            onOpenGroupChat?.({ name: '新群聊', text: '本地创建的多人聊天，可以先把角色拉进来试聊' })
          }
        }}
      >
        <button className="mobile-message-profile" type="button">
          <span
            className="avatar mobile-self-avatar"
            style={{ '--avatar-accent': activeCharacter?.accent ?? 'var(--pink-300)' } as CSSProperties}
          >
            {activeCharacter?.avatar ?? '萌'}
          </span>
          <span>
            <strong>萌！</strong>
            <small>📖 学习中 <ChevronRight size={13} /></small>
          </span>
        </button>
        <button aria-label="新建" className="mobile-message-plus" type="button">
          <Plus size={42} strokeWidth={1.8} />
        </button>
      </header>

      <label className="mobile-message-search">
        <Search size={28} />
        <input aria-label="搜索" placeholder="搜索" />
      </label>

      <div className="mobile-message-thread-list">
        {visibleGroups.map((thread, index) => (
          <button
            className={`mobile-message-thread ${thread.characterId === activeCharacterId ? 'active' : ''}`}
            key={thread.name}
            onClick={() => {
              if (thread.characterId) {
                onOpenChat(thread.characterId)
                return
              }
              onOpenGroupChat?.({ name: thread.name, text: thread.text })
            }}
            type="button"
          >
            <span className="avatar mobile-thread-avatar system-avatar">
              {thread.avatar}
              {thread.badge && <b>{thread.badge}</b>}
            </span>
            <span className="mobile-thread-copy">
              <strong>{thread.name}</strong>
              <small>{thread.text}</small>
            </span>
            <span className="mobile-thread-meta">
              <time>{thread.time}</time>
              {index > 0 && <BellOff size={18} />}
            </span>
          </button>
        ))}
        {visibleRoleCharacters.map((character, index) => {
          const isActive = character.id === activeCharacterId
          const conversation = conversationByCharacterId.get(character.id)
          const badge = formatUnreadBadge(getUnreadCount(conversation))

          return (
            <button
              className={`mobile-message-thread ${isActive ? 'active' : ''}`}
              key={character.id}
              onClick={() => onOpenChat(character.id)}
              type="button"
            >
              <span
                className="avatar mobile-thread-avatar"
                style={{ '--avatar-accent': character.accent } as CSSProperties}
              >
                {character.avatar}
                {badge && <b>{badge}</b>}
              </span>
              <span className="mobile-thread-copy">
                <strong>{character.name}</strong>
                <small>{getLastConversationText(conversation, character.title)}</small>
              </span>
              <span className="mobile-thread-meta">
                <time>{formatThreadTime(conversation?.updatedAt, threadTimes[index % threadTimes.length])}</time>
                {index > 4 && <BellOff size={18} />}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
