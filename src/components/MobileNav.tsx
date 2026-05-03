import {
  Brain,
  Images,
  MessageCircle,
  MessagesSquare,
  Palette,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import type { AppView } from './CharacterRail'

interface MobileNavProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
}

const mobileNavItems: Array<{ id: AppView; label: string; icon: LucideIcon }> = [
  { id: 'chat', label: '单聊', icon: MessageCircle },
  { id: 'group', label: '群聊', icon: MessagesSquare },
  { id: 'moments', label: '动态', icon: Images },
  { id: 'memory', label: '记忆', icon: Brain },
  { id: 'world', label: '世界树', icon: Sprout },
  { id: 'settings', label: '设置', icon: Palette },
]

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {mobileNavItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            className={`mobile-nav-item ${activeView === item.id ? 'active' : ''}`}
            key={item.id}
            onClick={() => onViewChange(item.id)}
            type="button"
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
