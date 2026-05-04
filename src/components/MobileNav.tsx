import {
  Images,
  MessageCircle,
  MessagesSquare,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type { AppView } from './CharacterRail'

interface MobileNavProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
}

const fixedNavItems: Array<{ id: AppView; label: string; icon: LucideIcon }> = [
  { id: 'chat', label: '消息', icon: MessageCircle },
  { id: 'group', label: '频道', icon: MessagesSquare },
  { id: 'memory', label: '联系人', icon: UserRound },
  { id: 'moments', label: '动态', icon: Images },
]

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  function handleNavigate(view: AppView) {
    onViewChange(view)
  }

  return (
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
            <Icon size={24} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
