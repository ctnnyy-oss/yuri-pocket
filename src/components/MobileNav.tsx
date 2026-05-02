import {
  ArchiveRestore,
  Brain,
  MessageCircle,
  Palette,
  SlidersHorizontal,
  Sprout,
} from 'lucide-react'
import type { AppView } from './CharacterRail'

interface MobileNavProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
}

const mobileNavItems: Array<{ id: AppView; label: string; icon: typeof MessageCircle }> = [
  { id: 'chat', label: '聊天', icon: MessageCircle },
  { id: 'memory', label: '记忆', icon: Brain },
  { id: 'world', label: '世界树', icon: Sprout },
  { id: 'model', label: '模型', icon: SlidersHorizontal },
  { id: 'settings', label: '设置', icon: Palette },
  { id: 'trash', label: '回收', icon: ArchiveRestore },
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
