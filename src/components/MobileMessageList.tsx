import type { CSSProperties } from 'react'
import { BellOff, Plus, Search } from 'lucide-react'
import type { CharacterCard } from '../domain/types'

interface MobileMessageListProps {
  characters: CharacterCard[]
  activeCharacterId: string
  onOpenChat: (characterId: string) => void
}

const threadTimes = ['下午4:07', '下午4:02', '下午3:52', '下午3:41', '下午3:30', '星期六']
const unreadBadges = ['99+', '10', '', '49', '', '']

export function MobileMessageList({
  characters,
  activeCharacterId,
  onOpenChat,
}: MobileMessageListProps) {
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]

  return (
    <section className="mobile-message-list" aria-label="手机消息列表">
      <header className="mobile-message-header">
        <div className="mobile-message-profile">
          <span
            className="avatar mobile-self-avatar"
            style={{ '--avatar-accent': activeCharacter?.accent ?? 'var(--pink-300)' } as CSSProperties}
          >
            {activeCharacter?.avatar ?? '妹'}
          </span>
          <span>
            <strong>萌！</strong>
            <small>忙碌</small>
          </span>
        </div>
        <button aria-label="新建" className="mobile-message-plus" type="button">
          <Plus size={34} strokeWidth={2.2} />
        </button>
      </header>

      <label className="mobile-message-search">
        <Search size={24} />
        <input aria-label="搜索" placeholder="搜索" />
      </label>

      <div className="mobile-message-thread-list">
        {characters.map((character, index) => {
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
                <strong>{index === 0 ? 'ai 交流群1' : character.name}</strong>
                <small>{index === 0 ? '用户7916今日已打卡 我也要打卡星！' : character.title}</small>
              </span>
              <span className="mobile-thread-meta">
                <time>{threadTimes[index % threadTimes.length]}</time>
                <BellOff size={18} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
