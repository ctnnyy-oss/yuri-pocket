import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import {
  BellOff,
  Brain,
  ChevronRight,
  ListTodo,
  MessageCircle,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { brand } from '../config/brand'
import type { CharacterCard, ConversationState } from '../domain/types'

export type AppView = 'chat' | 'role' | 'group' | 'moments' | 'tasks' | 'memory' | 'world' | 'model' | 'settings' | 'trash'

interface CharacterRailProps {
  characters: CharacterCard[]
  activeCharacterId: string
  conversations: ConversationState[]
  activeView: AppView
  onViewChange: (view: AppView) => void
  onSelect: (characterId: string) => void
  onOpenGroupChat?: (group: { name: string; text: string }) => void
  onShellAction?: (message: string) => void
}

type RailItem = { id: AppView; label: string; description: string; icon: LucideIcon; badge?: string }

const primaryNavigationItems: RailItem[] = [
  { id: 'chat', label: '聊天', description: '最近聊天', icon: MessageCircle, badge: '1' },
  { id: 'role', label: '角色', description: '角色管理', icon: UserRound },
  { id: 'model', label: '模型', description: '模型配置', icon: SlidersHorizontal },
  { id: 'memory', label: '记忆', description: '记忆系统', icon: Brain },
  { id: 'settings', label: '设置', description: '应用设置', icon: Settings },
]

const channelRows = [
  { id: 'group:cp-tea', title: '三对CP茶会', text: '六位角色都在这里，当前可拉起本地群聊', time: '今天', avatar: '群', badge: '6' },
  { id: 'group:yuri-room', title: '百合创作小屋', text: '只保留项目需要的群聊入口', time: '星期六', avatar: '百', badge: '' },
]

const appRows = [
  { title: '模型管理', text: 'URL、API Key、官方或第三方协议', icon: SlidersHorizontal, view: 'model' as AppView },
  { title: '记忆管理', text: '长期记忆、关系记忆、世界观资料', icon: Brain, view: 'memory' as AppView },
  { title: 'Agent 任务', text: '后台队列、自检和任务推进状态', icon: ListTodo, view: 'tasks' as AppView },
  { title: '设置中心', text: '不属于聊天、角色、模型、记忆的入口都放这里', icon: Settings, view: 'settings' as AppView },
]

function characterThreadTime(index: number, active: boolean) {
  if (active) return '昨天20:21'
  return ['星期三', '03/19', '03/18', '03/18', '03/16', '02/25', '02/23'][index % 7]
}

function formatThreadTime(value?: string, fallback = '今天') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getLastConversationText(conversation?: ConversationState, fallback = '还没有聊天记录') {
  const lastMessage = conversation?.messages.at(-1)
  if (!lastMessage?.content) return fallback
  return lastMessage.content.replace(/\s+/g, ' ').slice(0, 28)
}

function isGroupCharacter(character: CharacterCard) {
  return character.relationship === '群聊'
}

export function CharacterRail({
  characters,
  activeCharacterId,
  conversations,
  activeView,
  onShellAction,
  onOpenGroupChat,
  onViewChange,
  onSelect,
}: CharacterRailProps) {
  const [query, setQuery] = useState('')
  const [pinnedThreadIds, setPinnedThreadIds] = useState<Set<string>>(() => new Set())
  const [pinTimer, setPinTimer] = useState<number | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]
  const roleCharacters = useMemo(() => characters.filter((character) => !isGroupCharacter(character)), [characters])
  const groupCharacters = useMemo(() => characters.filter(isGroupCharacter), [characters])
  const conversationByCharacterId = useMemo(() => {
    return new Map(conversations.map((conversation) => [conversation.characterId, conversation]))
  }, [conversations])
  const filteredCharacters = useMemo(() => {
    if (!normalizedQuery) return roleCharacters
    return roleCharacters.filter((character) => {
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
  }, [normalizedQuery, roleCharacters])
  const filteredChannelRows = useMemo(() => {
    const defaultTitles = new Set(channelRows.map((row) => row.title))
    const defaultRows = channelRows.map((row) => {
      const existing = groupCharacters.find((character) => character.name === row.title)
      return {
        ...row,
        id: existing ? `group:${existing.id}` : row.id,
        avatar: existing?.avatar ?? row.avatar,
        text: existing ? getLastConversationText(conversationByCharacterId.get(existing.id), existing.mood) : row.text,
        time: existing ? formatThreadTime(conversationByCharacterId.get(existing.id)?.updatedAt, row.time) : row.time,
        characterId: existing?.id ?? '',
        updatedAt: conversationByCharacterId.get(existing?.id ?? '')?.updatedAt ?? '',
      }
    })
    const customRows = groupCharacters
      .filter((character) => !defaultTitles.has(character.name))
      .map((character, index) => ({
        id: `group:${character.id}`,
        title: character.name,
        text: character.mood || character.title,
        time: formatThreadTime(conversationByCharacterId.get(character.id)?.updatedAt, index === 0 ? '刚刚' : '今天'),
        avatar: character.avatar,
        badge: '',
        characterId: character.id,
        updatedAt: conversationByCharacterId.get(character.id)?.updatedAt ?? '',
      }))
    const rows = [...defaultRows, ...customRows]
    if (!normalizedQuery) return rows
    return rows.filter((row) => `${row.title} ${row.text}`.toLowerCase().includes(normalizedQuery))
  }, [conversationByCharacterId, groupCharacters, normalizedQuery])
  const chatThreads = useMemo(() => {
    const characterThreads = filteredCharacters.map((character, index) => ({
      id: `character:${character.id}`,
      type: 'character' as const,
      rank: index * 2 + 1,
      name: character.name,
      avatar: character.avatar,
      accent: character.accent,
      preview: getLastConversationText(conversationByCharacterId.get(character.id), character.title),
      time: formatThreadTime(conversationByCharacterId.get(character.id)?.updatedAt, characterThreadTime(index, character.id === activeCharacterId)),
      muted: index === 5,
      characterId: character.id,
      updatedAt: conversationByCharacterId.get(character.id)?.updatedAt ?? '',
    }))
    const groupThreads = filteredChannelRows.map((row, index) => ({
      id: row.id,
      type: 'group' as const,
      rank: index * 2,
      name: row.title,
      avatar: row.avatar,
      accent: '#f2c5de',
      preview: row.text,
      time: row.time,
      muted: index > 0,
      badge: row.badge,
      characterId: row.characterId,
      updatedAt: row.updatedAt,
    }))

    return [...characterThreads, ...groupThreads].sort((left, right) => {
      const leftPinned = pinnedThreadIds.has(left.id)
      const rightPinned = pinnedThreadIds.has(right.id)
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0
      if (leftTime !== rightTime) return rightTime - leftTime
      return left.rank - right.rank
    })
  }, [activeCharacterId, conversationByCharacterId, filteredCharacters, filteredChannelRows, pinnedThreadIds])

  function togglePinnedThread(threadId: string) {
    setPinnedThreadIds((current) => {
      const next = new Set(current)
      if (next.has(threadId)) {
        next.delete(threadId)
      } else {
        next.add(threadId)
      }
      return next
    })
  }

  function startPinGesture(threadId: string) {
    if (typeof window === 'undefined') return
    const timer = window.setTimeout(() => {
      togglePinnedThread(threadId)
      onShellAction?.('已切换置顶状态')
      setPinTimer(null)
    }, 560)
    setPinTimer(timer)
  }

  function cancelPinGesture() {
    if (pinTimer === null || typeof window === 'undefined') return
    window.clearTimeout(pinTimer)
    setPinTimer(null)
  }

  return (
    <aside className="left-panel">
      <div className="qq-icon-rail">
        <button
          aria-label={brand.nameZh}
          className="qq-brand-button"
          onClick={() => onViewChange('chat')}
          title={brand.nameZh}
          type="button"
        >
          <span>AIQ</span>
        </button>

        <nav className="primary-nav" aria-label="主要功能">
          {primaryNavigationItems.map((item) => {
            const Icon = item.icon
            const active = activeView === item.id
            return (
              <button
                aria-label={item.label}
                className={`nav-button ${active ? 'active' : ''}`}
                key={item.id}
                onClick={() => onViewChange(item.id)}
                title={item.description}
                type="button"
              >
                <Icon size={25} strokeWidth={2.1} />
                {item.badge && <b className={item.badge === '•' ? 'nav-dot' : ''}>{item.badge}</b>}
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="qq-rail-spacer" />
      </div>

      <section className="conversation-pane" aria-label="QQ 侧边内容">
        <div className="conversation-search-row">
          <label className="conversation-search">
            <Search size={18} />
            <input
              aria-label="搜索"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索"
              value={query}
            />
          </label>
          <button
            aria-label="新建"
            className="conversation-add-button"
            onClick={() => {
              if (activeView === 'role') {
                onShellAction?.('这里后续会弹出：添加角色 / 导入人设')
                return
              }
              if (activeView === 'chat') {
                onOpenGroupChat?.({ name: '新群聊', text: '本地创建的多人聊天，可以先把角色拉进来试聊' })
                return
              }
              onShellAction?.('当前入口已放入设置中心规划')
            }}
            title={activeView === 'role' ? '添加角色' : '新建聊天'}
            type="button"
          >
            <Plus size={20} />
          </button>
        </div>

        {activeView === 'chat' && (
          <div className="character-list conversation-list">
            {chatThreads.map((thread) => {
              const active = thread.characterId === activeCharacterId
              const pinned = pinnedThreadIds.has(thread.id)
              return (
                <button
                  className={`character-button ${active ? 'active' : ''} ${thread.type === 'group' ? 'ghost' : ''}`}
                  key={thread.id}
                  onClick={() => {
                    if (thread.type === 'character') {
                      onSelect(thread.characterId)
                      onViewChange('chat')
                      return
                    }
                    if (thread.characterId) {
                      onSelect(thread.characterId)
                      onViewChange('chat')
                      return
                    }
                    onOpenGroupChat?.({ name: thread.name, text: thread.preview })
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    togglePinnedThread(thread.id)
                  }}
                  onPointerDown={() => startPinGesture(thread.id)}
                  onPointerLeave={cancelPinGesture}
                  onPointerUp={cancelPinGesture}
                  title="长按或右键切换置顶"
                  type="button"
                >
                  <span className="avatar" style={{ '--avatar-accent': thread.accent } as CSSProperties}>
                    {thread.avatar}
                    {'badge' in thread && thread.badge && <b>{thread.badge}</b>}
                  </span>
                  <span className="conversation-copy">
                    <strong>{thread.name}</strong>
                    <small>{thread.preview}</small>
                  </span>
                  <span className="conversation-meta">
                    <time>{pinned ? '置顶' : thread.time}</time>
                    {thread.muted && <BellOff size={17} />}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {activeView === 'role' && (
          <div className="qq-contact-pane qq-contact-pane-simple">
            <div className="qq-role-actions">
              <button onClick={() => onShellAction?.('添加角色入口已占位，后续可创建姐姐、恋人或自定义角色')} type="button">添加角色</button>
              <button onClick={() => onShellAction?.('导入人设入口已占位，后续可粘贴设定或导入文件')} type="button">导入人设</button>
            </div>
            <div className="qq-contact-friends">
              {roleCharacters.map((character) => (
                <button
                  className={character.id === activeCharacterId ? 'active' : ''}
                  key={character.id}
                  onClick={() => {
                    onSelect(character.id)
                    onShellAction?.('角色卡片已选中，后续可在这里编辑人设、头像、关系和默认模型')
                  }}
                  type="button"
                >
                  <span className="avatar" style={{ '--avatar-accent': character.accent } as CSSProperties}>
                    {character.avatar}
                  </span>
                  <span>
                    <strong>{character.name}</strong>
                    <small>{character.mood}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeView === 'group' && (
          <div className="character-list conversation-list">
            {channelRows.map((row, index) => (
              <button className={`character-button ${index === 0 ? 'active' : ''}`} key={row.title} type="button">
                <span className="avatar channel-avatar">
                  {row.avatar}
                  {row.badge && <b>{row.badge}</b>}
                </span>
                <span className="conversation-copy">
                  <strong>{row.title}</strong>
                  <small>{row.text}</small>
                </span>
                <span className="conversation-meta">
                  <time>{row.time}</time>
                  <BellOff size={17} />
                </span>
              </button>
            ))}
          </div>
        )}

        {activeView !== 'chat' && activeView !== 'role' && activeView !== 'group' && (
          <div className="qq-app-pane">
            {appRows.map((row) => {
              const Icon = row.icon
              return (
                <button
                  className={activeView === row.view ? 'active' : ''}
                  key={row.title}
                  onClick={() => onViewChange(row.view)}
                  type="button"
                >
                  <span className="qq-app-pane-icon">
                    <Icon size={22} />
                  </span>
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.text}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              )
            })}
          </div>
        )}

        <footer className="conversation-pane-foot">
          <span className="avatar" style={{ '--avatar-accent': activeCharacter?.accent ?? '#d85b8a' } as CSSProperties}>
            {activeCharacter?.avatar ?? '宁'}
          </span>
          <span>{activeCharacter?.name ?? '宁安'}</span>
        </footer>
      </section>
    </aside>
  )
}
