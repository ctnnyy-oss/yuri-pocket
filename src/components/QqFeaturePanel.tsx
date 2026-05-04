import type { CSSProperties } from 'react'
import { BellOff, Grid3X3, Plus, Search } from 'lucide-react'
import type { CharacterCard } from '../domain/types'
import type { AppView } from './CharacterRail'

interface QqFeaturePanelProps {
  activeView: AppView
  characters: CharacterCard[]
  activeCharacterId: string
  onOpenChat: (characterId: string) => void
}

const viewCopy: Record<AppView, { title: string; subtitle: string; search: string }> = {
  chat: { title: '消息', subtitle: '最近会话', search: '搜索' },
  group: { title: '频道', subtitle: '群聊与频道', search: '搜索频道' },
  moments: { title: '动态', subtitle: '好友动态', search: '搜索动态' },
  tasks: { title: '游戏', subtitle: '离线入口', search: '搜索游戏' },
  memory: { title: '联系人', subtitle: '好友与分组', search: '搜索联系人' },
  world: { title: '频道', subtitle: '兴趣频道', search: '搜索频道' },
  model: { title: '应用', subtitle: '模型与插件', search: '搜索应用' },
  settings: { title: '设置', subtitle: '本机设置', search: '搜索设置' },
  trash: { title: '回收站', subtitle: '离线记录', search: '搜索记录' },
}

const channelRows = [
  ['ai 交流群1', '用户7916今日已打卡 我也要打卡星！', '下午2:28'],
  ['公众号', '会员抽奖100%中！限量公仔等你赢', '上午11:45'],
  ['AstrBot 4群', '[有新总结] 陌沉：@折叠 可以正常识别', '下午4:07'],
  ['Clove 的小窝', '[有新总结] 花殇踢了踢 Clove', '下午4:02'],
]

const appRows = [
  ['模型设置', '管理语言、多模态、图片、语音模型'],
  ['记忆系统', '长期记忆、关系记忆、世界观资料'],
  ['人设导入', '导入角色设定与自我总结'],
  ['离线备份', '本地数据、云端同步、恢复记录'],
]

export function QqFeaturePanel({
  activeView,
  characters,
  activeCharacterId,
  onOpenChat,
}: QqFeaturePanelProps) {
  const copy = viewCopy[activeView] ?? viewCopy.chat
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0]
  const isContact = activeView === 'memory'
  const isDynamic = activeView === 'moments'
  const rows = activeView === 'model' || activeView === 'settings' || activeView === 'trash' || activeView === 'tasks'
    ? appRows
    : channelRows

  return (
    <main className="workspace qq-feature-workspace">
      <header className="qq-feature-topbar">
        <strong>{copy.title}</strong>
        <div className="qq-feature-actions">
          <button aria-label="搜索" type="button">
            <Search size={19} />
          </button>
          <button aria-label="新建" type="button">
            <Plus size={20} />
          </button>
        </div>
      </header>

      <div className="qq-feature-body">
        <section className="qq-feature-list" aria-label={copy.title}>
          <label className="qq-feature-search">
            <Search size={18} />
            <input aria-label={copy.search} placeholder={copy.search} />
          </label>

          <div className="qq-feature-section-title">
            <span>{copy.subtitle}</span>
            <small>{isContact ? characters.length : rows.length}</small>
          </div>

          <div className="qq-feature-rows">
            {isContact
              ? characters.map((character) => (
                  <button
                    className={`qq-feature-row ${character.id === activeCharacterId ? 'active' : ''}`}
                    key={character.id}
                    onClick={() => onOpenChat(character.id)}
                    type="button"
                  >
                    <span
                      className="avatar qq-feature-avatar"
                      style={{ '--avatar-accent': character.accent } as CSSProperties}
                    >
                      {character.avatar}
                    </span>
                    <span>
                      <strong>{character.name}</strong>
                      <small>{character.title}</small>
                    </span>
                    <BellOff size={17} />
                  </button>
                ))
              : rows.map((row, index) => (
                  <button className={`qq-feature-row ${index === 0 ? 'active' : ''}`} key={row[0]} type="button">
                    <span className="qq-feature-icon">
                      <Grid3X3 size={22} />
                    </span>
                    <span>
                      <strong>{row[0]}</strong>
                      <small>{row[1]}</small>
                    </span>
                    <time>{row[2] ?? '常用'}</time>
                  </button>
                ))}
          </div>
        </section>

        <section className="qq-feature-preview" aria-label="详情预览">
          {isDynamic ? (
            <div className="qq-dynamic-feed">
              {characters.slice(0, 4).map((character, index) => (
                <article className="qq-dynamic-card" key={character.id}>
                  <span
                    className="avatar qq-feature-avatar"
                    style={{ '--avatar-accent': character.accent } as CSSProperties}
                  >
                    {character.avatar}
                  </span>
                  <div>
                    <strong>{character.name}</strong>
                    <p>{index === 0 ? '今天也在百合小窝里等妹妹上线。' : character.subtitle}</p>
                    <small>{index + 1}小时前</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="qq-contact-preview">
              <span
                className="avatar qq-contact-avatar"
                style={{ '--avatar-accent': activeCharacter?.accent ?? 'var(--pink-300)' } as CSSProperties}
              >
                {activeCharacter?.avatar ?? '妹'}
              </span>
              <strong>{isContact ? activeCharacter?.name : rows[0]?.[0]}</strong>
              <p>{isContact ? activeCharacter?.subtitle : rows[0]?.[1]}</p>
              <button onClick={() => onOpenChat(activeCharacter?.id ?? activeCharacterId)} type="button">
                进入会话
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
