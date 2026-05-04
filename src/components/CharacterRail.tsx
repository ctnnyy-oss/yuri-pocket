import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import {
  ArchiveRestore,
  BellOff,
  Bookmark,
  Bot,
  Brain,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  FileText,
  Folder,
  Gamepad2,
  Grid3X3,
  Hash,
  HelpCircle,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  Palette,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Star,
  UserRound,
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
  onShellAction?: (message: string) => void
}

type RailItem = { id: AppView; label: string; description: string; icon: LucideIcon; badge?: string }

const primaryNavigationItems: RailItem[] = [
  { id: 'chat', label: '消息', description: '最近会话', icon: MessageCircle, badge: '1' },
  { id: 'memory', label: '联系人', description: '好友与群聊', icon: UserRound },
  { id: 'moments', label: '收藏', description: '收藏与空间', icon: Star },
  { id: 'world', label: '频道', description: '频道广场', icon: Hash, badge: '•' },
  { id: 'group', label: '群聊', description: '群聊房间', icon: Bot },
  { id: 'tasks', label: '游戏', description: '娱乐入口占位', icon: Gamepad2 },
  { id: 'model', label: '应用', description: '模型与插件入口', icon: Grid3X3 },
]

const dockItems = [
  { label: '邮箱', icon: Mail },
  { label: '设备', icon: MonitorSmartphone },
]

const menuItems = [
  { label: '收藏', icon: Bookmark },
  { label: '文件', icon: Folder },
  { label: '调色盘', icon: Shirt },
  { label: '聊天记录管理', icon: FileText },
  { label: '检查更新', icon: ShieldCheck },
  { label: '帮助', icon: HelpCircle },
  { label: '锁定', icon: BriefcaseBusiness },
  { label: '设置', icon: Settings, view: 'settings' as AppView },
  { label: '退出账号', icon: LogOut },
]

const messagePreview = [
  '我觉得你可以把这个模型的这...',
  '梁智源：@全体成员 各位已填...',
  '姐姐刚刚有点卡住了，妹妹再...',
  '🌹',
  '[机器人名片] 池唐',
  '解题：[动画表情]',
  '先去了学校再说吧',
]

const extraThreads = [
  { name: '唐起', avatar: '唐', text: '先去了学校再说吧', time: '02/25', muted: false },
  { name: '仙界林慕溪', avatar: '溪', text: '链式代理.yaml', time: '02/23', muted: false },
  { name: '发电233三班的熊...', avatar: '熊', text: '[图片]', time: '01/05', muted: true },
  { name: '曼城是冠军', avatar: '曼', text: '[动画表情]', time: '2025/12/30', muted: false },
  { name: '王肆杰 发电23...', avatar: '王', text: 'Jend3ukie：忘了通知大家...', time: '2025/09/03', muted: true },
  { name: '清新校园，无...', avatar: '清', text: '潘江洋20240151：@全体...', time: '2025/06/24', muted: true },
]

const contactGroups = [
  { title: '我的设备', count: '2', open: false },
  { title: '机器人', count: '3', open: false },
  { title: '特别关心', count: '0/0', open: false },
  { title: '我的好友', count: '21/40', open: true },
]

const channelRows = [
  { title: 'ai 交流群1', text: '用户7916今日已打卡 我也要打卡星！', time: '下午2:28', avatar: 'AI', badge: '10' },
  { title: '公众号', text: 'QQ会员：抽奖100%中！限量公仔等你赢', time: '上午11:45', avatar: '公', badge: '' },
  { title: 'AstrBot 4群', text: '[有新总结] 陌沉：@折叠 可以正常识别', time: '下午4:07', avatar: 'A', badge: '99+' },
  { title: 'Clove 的小窝', text: '[有新总结] 花殇踢了踢 Clove', time: '下午4:02', avatar: 'C', badge: '99+' },
  { title: 'live2d 资源群', text: 'Nick 牧牧男友：心动了', time: '下午3:52', avatar: 'L', badge: '49' },
]

const appRows = [
  { title: '模型设置', text: '语言、多模态、图片、语音模型', icon: SlidersHorizontal, view: 'model' as AppView },
  { title: '记忆系统', text: '长期记忆、关系记忆、世界观资料', icon: Brain, view: 'memory' as AppView },
  { title: '人设导入', text: '导入角色设定与自我总结', icon: CircleUserRound, view: 'model' as AppView },
  { title: '外观设置', text: '主题、字体、聊天背景', icon: Palette, view: 'settings' as AppView },
  { title: '回收站', text: '误删找回与离线记录', icon: ArchiveRestore, view: 'trash' as AppView },
]

function characterThreadTime(index: number, active: boolean) {
  if (active) return '昨天20:21'
  return ['星期三', '03/19', '03/18', '03/18', '03/16', '02/25', '02/23'][index % 7]
}

export function CharacterRail({
  characters,
  activeCharacterId,
  activeView,
  onShellAction,
  onViewChange,
  onSelect,
}: CharacterRailProps) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const normalizedQuery = query.trim().toLowerCase()
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]
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
            const active = activeView === item.id || (activeView === 'settings' && item.id === 'model')
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

        <div className="qq-dock-icons" aria-label="扩展入口">
          {dockItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                aria-label={item.label}
                key={item.label}
                onClick={() => onShellAction?.(`${item.label}入口已保留，后续接入真实功能`)}
                title={item.label}
                type="button"
              >
                <Icon size={22} />
              </button>
            )
          })}
          <button
            aria-expanded={menuOpen}
            aria-label="菜单"
            className={menuOpen ? 'active' : ''}
            onClick={() => setMenuOpen((open) => !open)}
            title="菜单"
            type="button"
          >
            <Menu size={24} />
            <i />
          </button>
        </div>

        {menuOpen && (
          <div className="desktop-rail-menu" role="menu">
            <div className="desktop-rail-menu-shortcuts">
              {menuItems.slice(0, 3).map((item) => {
                const Icon = item.icon
                return (
                  <button key={item.label} type="button">
                    <Icon size={21} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
            {menuItems.slice(3).map((item) => {
              const Icon = item.icon
              return (
                <button
                  className="desktop-rail-menu-row"
                  key={item.label}
                  onClick={() => {
                    if (item.view) {
                      onViewChange(item.view)
                      return
                    }
                    onShellAction?.(`${item.label}入口已保留，后续接入真实功能`)
                  }}
                  type="button"
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.label === '设置' && <b>!</b>}
                  {item.label === '帮助' && <ChevronRight size={17} />}
                </button>
              )
            })}
          </div>
        )}
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
            onClick={() => onViewChange(activeView === 'chat' ? 'memory' : 'chat')}
            title="新建"
            type="button"
          >
            <Plus size={20} />
          </button>
        </div>

        {activeView === 'chat' && (
          <div className="character-list conversation-list">
            {filteredCharacters.map((character, index) => {
              const active = character.id === activeCharacterId
              return (
                <button
                  className={`character-button ${active ? 'active' : ''}`}
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
                    <strong>{index === 0 ? '招生助理-陈' : character.name}</strong>
                    <small>{messagePreview[index % messagePreview.length]}</small>
                  </span>
                  <span className="conversation-meta">
                    <time>{characterThreadTime(index, active)}</time>
                    {index === 5 && <BellOff size={17} />}
                  </span>
                </button>
              )
            })}
            {extraThreads.map((thread) => (
              <button className="character-button ghost" key={thread.name} type="button">
                <span className="avatar muted-avatar">{thread.avatar}</span>
                <span className="conversation-copy">
                  <strong>{thread.name}</strong>
                  <small>{thread.text}</small>
                </span>
                <span className="conversation-meta">
                  <time>{thread.time}</time>
                  {thread.muted && <BellOff size={17} />}
                </span>
              </button>
            ))}
          </div>
        )}

        {activeView === 'memory' && (
          <div className="qq-contact-pane">
            <button className="qq-contact-manager" type="button">
              <UserRound size={18} />
              好友管理器
            </button>
            <button className="qq-contact-notice" type="button">
              好友通知
              <ChevronRight size={18} />
            </button>
            <button className="qq-contact-notice" type="button">
              群通知
              <ChevronRight size={18} />
            </button>
            <div className="qq-contact-tabs">
              <button className="active" type="button">好友</button>
              <button type="button">群聊</button>
            </div>
            <div className="qq-contact-groups">
              {contactGroups.map((group) => (
                <section key={group.title}>
                  <button className="qq-contact-group-title" type="button">
                    {group.open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                    <span>{group.title}</span>
                    <small>{group.count}</small>
                  </button>
                  {group.open && (
                    <div className="qq-contact-friends">
                      {characters.map((character) => (
                        <button
                          className={character.id === activeCharacterId ? 'active' : ''}
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
                            <small>{character.mood}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}

        {(activeView === 'group' || activeView === 'world') && (
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

        {activeView !== 'chat' && activeView !== 'memory' && activeView !== 'group' && activeView !== 'world' && (
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
            {activeCharacter?.avatar ?? '姐'}
          </span>
          <span>{activeCharacter?.name ?? '姐姐大人'}</span>
        </footer>
      </section>
    </aside>
  )
}
