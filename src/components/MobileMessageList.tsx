import type { CSSProperties } from 'react'
import { BellOff, ChevronRight, Plus, Search } from 'lucide-react'
import type { CharacterCard } from '../domain/types'

interface MobileMessageListProps {
  characters: CharacterCard[]
  activeCharacterId: string
  onOpenChat: (characterId: string) => void
  onOpenGroupChat?: (group: { name: string; text: string }) => void
  onShellAction?: (message: string) => void
}

const threadTimes = ['下午5:42', '星期六', '星期三', '04/11', '04/03', '03/26', '03/22']
const unreadBadges = ['', '', '', '', '', '', '']
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

export function MobileMessageList({
  characters,
  activeCharacterId,
  onOpenChat,
  onOpenGroupChat,
}: MobileMessageListProps) {
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]
  const roleCharacters = characters.filter((character) => !isGroupCharacter(character))
  const groupCharacters = characters.filter(isGroupCharacter)
  const defaultGroupNames = new Set(groupThreads.map((thread) => thread.name))
  const visibleGroups = [
    ...groupThreads.map((thread) => {
      const existing = groupCharacters.find((character) => character.name === thread.name)
      return {
        ...thread,
        avatar: existing?.avatar ?? thread.avatar,
        text: existing?.mood ?? thread.text,
        characterId: existing?.id ?? '',
      }
    }),
    ...groupCharacters
      .filter((character) => !defaultGroupNames.has(character.name))
      .map((character) => ({
        name: character.name,
        avatar: character.avatar,
        text: character.mood || character.title,
        time: '今天',
        badge: '',
        characterId: character.id,
      })),
  ]

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
        {roleCharacters.map((character, index) => {
          const isActive = character.id === activeCharacterId
          const badge = unreadBadges[index % unreadBadges.length]

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
                <small>{character.title}</small>
              </span>
              <span className="mobile-thread-meta">
                <time>{threadTimes[index % threadTimes.length]}</time>
                {index > 4 && <BellOff size={18} />}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
