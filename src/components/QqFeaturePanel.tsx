import type { CSSProperties } from 'react'
import {
  Bell,
  BellOff,
  Bookmark,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Folder,
  Grid3X3,
  Heart,
  Image,
  Moon,
  Plus,
  Search,
  Settings,
  Shield,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  UserPlus,
} from 'lucide-react'
import type { CharacterCard } from '../domain/types'
import type { AppView } from './CharacterRail'

interface QqFeaturePanelProps {
  activeView: AppView
  characters: CharacterCard[]
  activeCharacterId: string
  onOpenChat: (characterId: string) => void
}

const mobileTitle: Record<AppView, string> = {
  chat: '消息',
  group: '频道',
  moments: '动态',
  tasks: '应用',
  memory: '联系人',
  world: '频道',
  model: '我的',
  settings: '设置',
  trash: '回收站',
}

const possibleFriends = [
  ['南栀', '♂ 22岁', '7位共同好友', '天蝎座'],
  ['一代柯_', '♂ 21岁', '在北京', '天蝎座'],
]

const settingGroups = [
  {
    title: '功能',
    rows: [
      ['消息通知', '', Bell],
      ['模式选择', '普通模式', SlidersHorizontal],
      ['个性装扮与特权外显', '', Shirt],
      ['通用', '', Grid3X3],
    ],
  },
  {
    title: '隐私',
    rows: [
      ['隐私设置', '', Shield],
      ['个人信息收集清单', '', Bookmark],
      ['第三方个人信息共享清单', '', Sparkles],
      ['个人信息保护设置', '', Shield],
    ],
  },
]

function MobileStatusBar() {
  return (
    <div className="mobile-status-bar" aria-hidden="true">
      <b>7:03</b>
      <span className="mobile-dynamic-island">AI</span>
      <span className="mobile-signal">5G 5G ▰▰▰ 37</span>
    </div>
  )
}

export function QqFeaturePanel({
  activeView,
  characters,
  activeCharacterId,
  onOpenChat,
}: QqFeaturePanelProps) {
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]

  return (
    <main className="workspace qq-feature-workspace">
      <DesktopFeature activeView={activeView} activeCharacter={activeCharacter} characters={characters} onOpenChat={onOpenChat} />
      <MobileFeature activeView={activeView} activeCharacter={activeCharacter} characters={characters} onOpenChat={onOpenChat} />
    </main>
  )
}

function DesktopFeature({
  activeView,
  activeCharacter,
  characters,
  onOpenChat,
}: {
  activeView: AppView
  activeCharacter: CharacterCard
  characters: CharacterCard[]
  onOpenChat: (characterId: string) => void
}) {
  const isContact = activeView === 'memory'
  const title = mobileTitle[activeView] ?? '消息'

  if (isContact) {
    return (
      <section className="qq-desktop-feature" aria-label="联系人详情">
        <div className="qq-desktop-empty">
          <span>AIQ</span>
        </div>
      </section>
    )
  }

  if (activeView === 'moments') {
    return (
      <section className="qq-desktop-feature qq-desktop-dynamic" aria-label="动态">
        <header>
          <strong>动态</strong>
          <div>
            <Sparkles size={22} />
            <Grid3X3 size={22} />
          </div>
        </header>
        <div className="qq-desktop-dynamic-feed">
          {characters.slice(0, 4).map((character, index) => (
            <article key={character.id}>
              <span className="avatar" style={{ '--avatar-accent': character.accent } as CSSProperties}>{character.avatar}</span>
              <div>
                <strong>{character.name}</strong>
                <p>{index === 0 ? '分享新鲜事：今天也在百合小窝里等妹妹上线。' : character.subtitle}</p>
                <small>前天20:01 · {296 + index * 7} 浏览</small>
              </div>
              <button type="button">...</button>
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="qq-desktop-feature" aria-label={title}>
      <header className="qq-desktop-feature-head">
        <strong>{title}</strong>
        <div>
          <Search size={20} />
          <Plus size={21} />
        </div>
      </header>
      <div className="qq-desktop-center-card">
        <span className="avatar qq-contact-avatar" style={{ '--avatar-accent': activeCharacter.accent } as CSSProperties}>
          {activeCharacter.avatar}
        </span>
        <strong>{activeView === 'model' ? '应用与模型' : activeCharacter.name}</strong>
        <p>{activeView === 'model' ? '模型、记忆、人设导入和离线功能都先作为 QQ 风格入口保留。' : activeCharacter.subtitle}</p>
        <button onClick={() => onOpenChat(activeCharacter.id)} type="button">进入会话</button>
      </div>
    </section>
  )
}

function MobileFeature({
  activeView,
  activeCharacter,
  characters,
  onOpenChat,
}: {
  activeView: AppView
  activeCharacter: CharacterCard
  characters: CharacterCard[]
  onOpenChat: (characterId: string) => void
}) {
  if (activeView === 'memory') {
    return (
      <section className="mobile-feature-page mobile-contact-page" aria-label="联系人">
        <MobileStatusBar />
        <header className="mobile-feature-header">
          <span className="avatar" style={{ '--avatar-accent': activeCharacter.accent } as CSSProperties}>
            {activeCharacter.avatar}
          </span>
          <strong>联系人</strong>
          <button aria-label="添加好友" type="button">
            <UserPlus size={31} />
          </button>
        </header>
        <label className="mobile-feature-search">
          <Search size={28} />
          <input placeholder="搜索" />
        </label>
        <section className="possible-friends">
          <button className="possible-title" type="button">
            可能想认识的人
            <ChevronRight size={24} />
          </button>
          {possibleFriends.map((friend) => (
            <div className="possible-row" key={friend[0]}>
              <span className="avatar">{friend[0].slice(0, 1)}</span>
              <div>
                <strong>{friend[0]}</strong>
                <p>
                  <span>{friend[1]}</span>
                  <span>{friend[2]}</span>
                  <span>{friend[3]}</span>
                </p>
              </div>
              <button type="button">添加</button>
              <button aria-label="关闭" type="button">×</button>
            </div>
          ))}
        </section>
        <div className="mobile-contact-notice">
          <button type="button">新朋友 <ChevronRight size={24} /></button>
          <button type="button">群通知 <ChevronRight size={24} /></button>
        </div>
        <div className="mobile-contact-tabs">
          {['分组', '好友', '群聊', '频道', '机器人', '设备'].map((tab, index) => (
            <button className={index === 0 ? 'active' : ''} key={tab} type="button">{tab}</button>
          ))}
        </div>
        <div className="mobile-contact-list">
          <button className="mobile-contact-group" type="button">▶ 特别关心 <span>0/0</span></button>
          <button className="mobile-contact-group open" type="button">▼ 我的好友 <span>21/40</span></button>
          {characters.map((character) => (
            <button key={character.id} onClick={() => onOpenChat(character.id)} type="button">
              <span className="avatar" style={{ '--avatar-accent': character.accent } as CSSProperties}>{character.avatar}</span>
              <span>
                <strong>{character.name}</strong>
                <small>{character.mood}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    )
  }

  if (activeView === 'moments') {
    return (
      <section className="mobile-feature-page mobile-dynamics-page" aria-label="动态">
        <MobileStatusBar />
        <header className="mobile-feature-header">
          <span className="avatar" style={{ '--avatar-accent': activeCharacter.accent } as CSSProperties}>
            {activeCharacter.avatar}
          </span>
          <strong>动态</strong>
          <span className="mobile-header-icons">
            <Sparkles size={30} />
            <Grid3X3 size={30} />
          </span>
        </header>
        <label className="mobile-feature-search">
          <Search size={28} />
          <input placeholder="搜索" />
        </label>
        <div className="mobile-simple-list">
          <button type="button"><Star size={32} />空间动态 <ChevronRight size={24} /></button>
          <button type="button"><Sparkles size={32} />脑洞秀 <ChevronRight size={24} /></button>
          <button type="button"><Heart size={32} />经典农场 <ChevronRight size={24} /></button>
        </div>
      </section>
    )
  }

  if (activeView === 'group' || activeView === 'world') {
    return (
      <section className="mobile-feature-page mobile-channel-page" aria-label="频道">
        <MobileStatusBar />
        <header className="mobile-feature-header">
          <span className="avatar" style={{ '--avatar-accent': activeCharacter.accent } as CSSProperties}>
            {activeCharacter.avatar}
          </span>
          <strong>频道</strong>
          <button type="button"><Plus size={38} /></button>
        </header>
        <label className="mobile-feature-search">
          <Search size={28} />
          <input placeholder="搜索" />
        </label>
        <div className="mobile-channel-list">
          {['ai 交流群1', '公众号', 'AstrBot 4群', 'Clove 的小窝', 'live2d 资源群', 'AI 塑造未来-4群'].map((name, index) => (
            <button key={name} type="button">
              <span className="avatar">{index === 1 ? '公' : '群'}</span>
              <span>
                <strong>{name}</strong>
                <small>{index === 1 ? 'QQ会员：抽奖100%中！限量公仔等你赢' : '[有新总结] 可以正常识别'}</small>
              </span>
              <time>下午{index + 2}:0{index}</time>
              <BellOff size={18} />
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="mobile-feature-page mobile-settings-page" aria-label={mobileTitle[activeView]}>
      <MobileStatusBar />
      <header className="mobile-feature-header centered">
        <button aria-label="返回" type="button"><ChevronLeft size={36} /></button>
        <strong>{activeView === 'settings' ? '设置' : '我的'}</strong>
        <span />
      </header>
      {activeView !== 'settings' && <MobileProfile activeCharacter={activeCharacter} />}
      {activeView === 'settings' ? (
        <SettingsList />
      ) : (
        <div className="mobile-profile-entries">
          <button type="button"><Image size={31} />相册 <ChevronRight size={24} /></button>
          <button type="button"><Bookmark size={31} />收藏 <ChevronRight size={24} /></button>
          <button type="button"><Folder size={31} />文件 <ChevronRight size={24} /></button>
          <button type="button"><WalletIcon />钱包 <ChevronRight size={24} /></button>
          <button type="button"><Shirt size={31} />个性装扮 <ChevronRight size={24} /></button>
          <div className="mobile-profile-actions">
            <button type="button"><Settings size={30} />设置</button>
            <button type="button"><Moon size={30} />夜间</button>
            <button type="button"><Sun size={30} />温江</button>
          </div>
        </div>
      )}
    </section>
  )
}

function MobileProfile({ activeCharacter }: { activeCharacter: CharacterCard }) {
  return (
    <section className="mobile-profile-card">
      <span className="avatar" style={{ '--avatar-accent': activeCharacter.accent } as CSSProperties}>
        {activeCharacter.avatar}
      </span>
      <div>
        <strong>{activeCharacter.name}</strong>
        <small>{activeCharacter.subtitle}</small>
        <p>
          <span>她的山她的海</span>
          <span>百合</span>
          <span>更多</span>
        </p>
      </div>
      <button type="button"><Grid3X3 size={25} /></button>
    </section>
  )
}

function SettingsList() {
  return (
    <div className="mobile-settings-list">
      <label className="mobile-feature-search">
        <Search size={28} />
        <input placeholder="搜索" />
      </label>
      <button className="settings-account" type="button">
        <CircleUserRound size={30} />
        <span>账号与安全</span>
        <span className="avatar">姐</span>
        <ChevronRight size={25} />
      </button>
      {settingGroups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <div>
            {group.rows.map(([label, value, Icon]) => (
              <button key={label as string} type="button">
                <Icon size={29} />
                <span>{label as string}</span>
                {value && <small>{value as string}</small>}
                <ChevronRight size={24} />
              </button>
            ))}
          </div>
        </section>
      ))}
      <button className="settings-single" type="button">关于 QQ 与帮助 <ChevronRight size={24} /></button>
      <button className="settings-single" type="button">退出当前账号 <ChevronRight size={24} /></button>
    </div>
  )
}

function WalletIcon() {
  return <Bot size={31} />
}
