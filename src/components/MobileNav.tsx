import {
  Brain,
  MessageCircle,
  Settings,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type { AppView } from './CharacterRail'

interface MobileNavProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
}

const fixedNavItems: Array<{ id: AppView; label: string; icon: LucideIcon }> = [
  { id: 'chat', label: '聊天', icon: MessageCircle },
  { id: 'role', label: '角色', icon: UserRound },
  { id: 'model', label: '模型', icon: SlidersHorizontal },
  { id: 'memory', label: '记忆', icon: Brain },
  { id: 'settings', label: '设置', icon: Settings },
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
