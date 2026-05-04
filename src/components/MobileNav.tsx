import {
  ArchiveRestore,
  Brain,
  CircleUserRound,
  ClipboardList,
  Images,
  MessageCircle,
  MessagesSquare,
  Palette,
  SlidersHorizontal,
  Sprout,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { AppView } from './CharacterRail'

interface MobileNavProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
}

const fixedNavItems: Array<{ id: AppView; label: string; icon: LucideIcon }> = [
  { id: 'chat', label: '消息', icon: MessageCircle },
  { id: 'group', label: '群聊', icon: MessagesSquare },
  { id: 'memory', label: '记忆', icon: Brain },
  { id: 'moments', label: '动态', icon: Images },
]

const moreNavItems: Array<{ id: AppView; label: string; description: string; icon: LucideIcon }> = [
  { id: 'tasks', label: '任务', description: '后台队列', icon: ClipboardList },
  { id: 'world', label: '世界树', description: '设定资料', icon: Sprout },
  { id: 'model', label: '模型', description: '接口配置', icon: SlidersHorizontal },
  { id: 'settings', label: '设置', description: '外观与数据', icon: Palette },
  { id: 'trash', label: '回收站', description: '误删找回', icon: ArchiveRestore },
]

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = moreNavItems.some((item) => item.id === activeView)

  function handleNavigate(view: AppView) {
    setMoreOpen(false)
    onViewChange(view)
  }

  return (
    <>
      {moreOpen && (
        <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}>
          <section
            aria-label="我的功能"
            className="mobile-more-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <strong>我的</strong>
              <button aria-label="关闭" onClick={() => setMoreOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="mobile-more-grid">
              {moreNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    className={activeView === item.id ? 'active' : ''}
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    type="button"
                  >
                    <Icon size={21} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      )}

      <nav className="mobile-nav" aria-label="移动端导航">
        {fixedNavItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={`mobile-nav-item ${activeView === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              type="button"
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
        <button
          aria-expanded={moreOpen}
          className={`mobile-nav-item ${moreActive || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen((open) => !open)}
          type="button"
        >
          <CircleUserRound size={20} />
          <span>我的</span>
        </button>
      </nav>
    </>
  )
}
