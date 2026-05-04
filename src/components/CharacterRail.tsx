import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import {
  ArchiveRestore,
  Brain,
  ClipboardList,
  HeartHandshake,
  Images,
  MessageCircle,
  MessagesSquare,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import { brand } from '../config/brand'
import type { CharacterCard } from '../domain/types'

export type AppView = 'chat' | 'group' | 'moments' | 'tasks' | 'memory' | 'world' | 'model' | 'settings' | 'trash'

interface CharacterRailProps {
  characters: CharacterCard[]
  activeCharacterId: string
  activeView: AppView
  onViewChange: (view: AppView) => void
  onSelect: (characterId: string) => void
}

const navigationItems: Array<{ id: AppView; label: string; description: string; icon: LucideIcon }> = [
  { id: 'chat', label: '单聊', description: '和当前角色一对一', icon: MessageCircle },
  { id: 'group', label: '群聊', description: '多人角色房间', icon: MessagesSquare },
  { id: 'moments', label: '动态', description: '朋友圈式展示', icon: Images },
  { id: 'tasks', label: '任务', description: 'Agent 后台队列', icon: ClipboardList },
  { id: 'memory', label: '记忆', description: '长期记忆和摘要', icon: Brain },
  { id: 'world', label: '世界树', description: '世界观和触发词', icon: Sprout },
  { id: 'trash', label: '回收', description: '误删后找回', icon: ArchiveRestore },
  { id: 'model', label: '模型', description: '模型接入管理', icon: SlidersHorizontal },
  { id: 'settings', label: '设置', description: '输入、字体和主题', icon: Palette },
]

const primaryNavigationItems = navigationItems.slice(0, 4)
const utilityNavigationItems = navigationItems.slice(4)

export function CharacterRail({
  characters,
  activeCharacterId,
  activeView,
  onViewChange,
  onSelect,
}: CharacterRailProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]
  const activeViewLabel = navigationItems.find((item) => item.id === activeView)?.label ?? '消息'
  const filteredCharacters = useMemo(() => {
    if (!normalizedQuery) return characters
    return characters.filter((character) => {
      const haystack = [
        character.name,
        character.title,
        character.subtitle,
        character.relationship,
        character.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [characters, normalizedQuery])

  return (
    <aside className="left-panel">
      <div className="qq-icon-rail">
        <button
          aria-label={brand.nameZh}
          className="brand-mark qq-brand-button"
          onClick={() => onViewChange('chat')}
          title={brand.nameZh}
          type="button"
        >
          <HeartHandshake size={22} />
        </button>

        <nav className="primary-nav" aria-label="主要功能">
          {primaryNavigationItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                aria-label={item.label}
                className={`nav-button ${activeView === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => onViewChange(item.id)}
                title={item.description}
                type="button"
              >
                <Icon size={22} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <nav className="primary-nav utility-nav" aria-label="更多功能">
          {utilityNavigationItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              aria-label={item.label}
              className={`nav-button ${activeView === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={item.description}
              type="button"
            >
              <Icon size={21} />
              <span>{item.label}</span>
            </button>
          )
        })}
        </nav>
      </div>

      <section className="conversation-pane" aria-label="消息列表">
        <header className="conversation-pane-head">
          <div className="conversation-profile">
            <span
              className="avatar conversation-profile-avatar"
              style={{ '--avatar-accent': activeCharacter?.accent ?? 'var(--pink-300)' } as CSSProperties}
            >
              {activeCharacter?.avatar ?? '妹'}
            </span>
            <span>
              <strong>{activeCharacter?.name ?? brand.nameZh}</strong>
              <small>{activeCharacter?.mood ?? brand.versionLabel}</small>
            </span>
          </div>
          <button
            aria-label="整理最近聊天"
            className="conversation-add-button"
            onClick={() => onViewChange('memory')}
            title="整理最近聊天"
            type="button"
          >
            <Plus size={19} />
          </button>
        </header>

        <label className="conversation-search">
          <Search size={17} />
          <input
            aria-label="搜索角色"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索角色 / CP / 功能"
            value={query}
          />
        </label>

        <div className="section-title">
          <span>{activeView === 'chat' ? '消息' : activeViewLabel}</span>
          <small>{filteredCharacters.length} 个角色</small>
        </div>

        <div className="character-list conversation-list">
          {filteredCharacters.map((character) => (
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
              <span className="conversation-copy">
                <strong>{character.name}</strong>
                <small>{character.title}</small>
                <em>{character.subtitle}</em>
              </span>
              <time>{character.id === activeCharacterId ? '当前' : '常驻'}</time>
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}
