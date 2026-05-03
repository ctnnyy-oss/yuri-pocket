import type { CSSProperties } from 'react'
import {
  Bot,
  Brain,
  ArchiveRestore,
  HeartHandshake,
  Images,
  MessageCircle,
  MessagesSquare,
  Palette,
  Signal,
  SlidersHorizontal,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import { brand } from '../config/brand'
import type { CharacterCard } from '../domain/types'

export type AppView = 'chat' | 'group' | 'moments' | 'memory' | 'world' | 'model' | 'settings' | 'trash'

interface CharacterRailProps {
  characters: CharacterCard[]
  activeCharacterId: string
  activeView: AppView
  modelStatusLabel: string
  modelStatusDetail: string
  onViewChange: (view: AppView) => void
  onSelect: (characterId: string) => void
}

const navigationItems: Array<{ id: AppView; label: string; description: string; icon: LucideIcon }> = [
  { id: 'chat', label: '单聊', description: '和当前角色一对一', icon: MessageCircle },
  { id: 'group', label: '群聊', description: '多人角色房间', icon: MessagesSquare },
  { id: 'moments', label: '动态', description: '朋友圈式展示', icon: Images },
  { id: 'memory', label: '记忆', description: '长期记忆和摘要', icon: Brain },
  { id: 'world', label: '世界树', description: '世界观和触发词', icon: Sprout },
  { id: 'trash', label: '回收', description: '误删后找回', icon: ArchiveRestore },
  { id: 'model', label: '模型', description: '模型与数据管理', icon: SlidersHorizontal },
  { id: 'settings', label: '设置', description: '输入、字体和主题', icon: Palette },
]

export function CharacterRail({
  characters,
  activeCharacterId,
  activeView,
  modelStatusLabel,
  modelStatusDetail,
  onViewChange,
  onSelect,
}: CharacterRailProps) {
  return (
    <aside className="left-panel">
      <header className="brand-block">
        <div className="brand-mark">
          <HeartHandshake size={22} />
        </div>
        <div>
          <h1>{brand.nameZh}</h1>
          <span>{brand.versionLabel}</span>
        </div>
      </header>

      <nav className="primary-nav" aria-label="主要功能">
        {navigationItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={`nav-button ${activeView === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => onViewChange(item.id)}
              type="button"
            >
              <Icon size={18} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          )
        })}
      </nav>

      <section className="panel-section">
        <div className="section-title">
          <Bot size={16} />
          <span>聊天角色</span>
        </div>
        <div className="character-list">
          {characters.map((character) => (
            <button
              className={`character-button ${character.id === activeCharacterId ? 'active' : ''}`}
              key={character.id}
              onClick={() => {
                onSelect(character.id)
                onViewChange('chat')
              }}
              type="button"
            >
              <span className="avatar" style={{ '--avatar-accent': character.accent } as CSSProperties}>
                {character.avatar}
              </span>
              <span>
                <strong>{character.name}</strong>
                <small>{character.title}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="status-card">
        <div className="mini-row">
          <span className="mini-dot" aria-hidden="true" />
          <span>
            <strong>{modelStatusLabel}</strong>
            <small>{modelStatusDetail}</small>
          </span>
        </div>
        <Signal size={17} />
      </section>

      <p className="sidebar-footnote">桌面版采用固定工作台：左边切功能，右边专心使用。</p>
    </aside>
  )
}
