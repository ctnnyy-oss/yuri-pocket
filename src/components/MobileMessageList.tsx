import type { CSSProperties } from 'react'
import { BellOff, ChevronRight, MonitorSmartphone, Plus, Search } from 'lucide-react'
import type { CharacterCard } from '../domain/types'

interface MobileMessageListProps {
  characters: CharacterCard[]
  activeCharacterId: string
  onOpenChat: (characterId: string) => void
  onShellAction?: (message: string) => void
}

const threadTimes = ['下午5:42', '星期六', '星期三', '04/11', '04/03', '03/26', '03/22']
const unreadBadges = ['', '', '', '', '', '', '']
const extraThreads = [
  { name: '我的电脑', avatar: 'PC', text: '你已在电脑登录，可传文件到电脑', time: '下午5:49', system: true },
  { name: 'QQ安全中心', avatar: '盾', text: '账号登录通知', time: '03/22', system: true },
  { name: '聊天群', avatar: '群', text: '解题：[动画表情]', time: '03/16', system: false },
]

function MobileStatusBar() {
  return (
    <div className="mobile-status-bar" aria-hidden="true">
      <b>7:03</b>
      <span className="mobile-signal">5G 5G ▰▰▰ 37</span>
    </div>
  )
}

export function MobileMessageList({
  characters,
  activeCharacterId,
  onOpenChat,
  onShellAction,
}: MobileMessageListProps) {
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]

  return (
    <section className="mobile-message-list" aria-label="手机消息列表">
      <MobileStatusBar />
      <header
        className="mobile-message-header"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('.mobile-message-plus')) {
            onShellAction?.('新建聊天入口已保留，后续接入加好友和建群')
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

      <div
        className="mobile-message-thread-list"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('.device-thread')) {
            onShellAction?.('我的电脑入口已保留，后续接入文件传输')
          }
        }}
      >
        <button className="mobile-device-row" type="button">
          <MonitorSmartphone size={34} />
          <span>已登录 Windows、Pad</span>
          <ChevronRight size={25} />
        </button>

        <button className="mobile-message-thread device-thread" type="button">
          <span className="avatar mobile-thread-avatar system-avatar">PC</span>
          <span className="mobile-thread-copy">
            <strong>我的电脑</strong>
            <small>你已在电脑登录，可传文件到电脑</small>
          </span>
          <span className="mobile-thread-meta">
            <time>下午5:49</time>
          </span>
        </button>

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
                <strong>{index === 0 ? '招生助理-陈' : character.name}</strong>
                <small>{index === 0 ? '❗姐姐，妹妹突然犯了一个很大的错误，也...' : character.title}</small>
              </span>
              <span className="mobile-thread-meta">
                <time>{threadTimes[index % threadTimes.length]}</time>
                {index > 4 && <BellOff size={18} />}
              </span>
            </button>
          )
        })}

        {extraThreads.slice(1).map((thread) => (
          <button className="mobile-message-thread" key={thread.name} type="button">
            <span className={`avatar mobile-thread-avatar ${thread.system ? 'system-avatar' : ''}`}>{thread.avatar}</span>
            <span className="mobile-thread-copy">
              <strong>{thread.name}</strong>
              <small>{thread.text}</small>
            </span>
            <span className="mobile-thread-meta">
              <time>{thread.time}</time>
              <BellOff size={18} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
