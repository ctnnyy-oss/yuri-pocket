import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  ChevronLeft,
  Clock3,
  File,
  Gift,
  Image,
  Laugh,
  Menu,
  Mic,
  MonitorUp,
  MoreHorizontal,
  Paintbrush,
  Paperclip,
  Phone,
  Plus,
  PlusCircle,
  Search,
  Send,
  Smile,
  Star,
  ToggleLeft,
  Video,
  WalletCards,
} from 'lucide-react'
import type {
  AppSettings,
  CharacterCard,
  ChatMessage,
  LongTermMemory,
  MemoryUsageLog,
} from '../domain/types'
import type { MemoryFeedbackAction } from '../services/memoryFeedback'
import { buildMessageMemoryTrace } from '../services/memoryTrace'
import { MessageBubble } from './MessageBubble'

interface ChatPhoneProps {
  character: CharacterCard
  characters: CharacterCard[]
  activeCharacterId: string
  messages: ChatMessage[]
  memories: LongTermMemory[]
  memoryUsageLogs: MemoryUsageLog[]
  draft: string
  isSending: boolean
  settings: AppSettings
  onDraftChange: (value: string) => void
  onBackToList?: () => void
  onSelectCharacter: (characterId: string) => void
  onMemoryFeedback: (memoryId: string, action: MemoryFeedbackAction) => void
  onSend: () => void
  onShellAction?: (message: string) => void
}

type ToolPanel = 'emoji' | 'sticker' | 'more' | 'info' | 'settings' | null

const emojiRows = [
  '🥰',
  '🙂',
  '😱',
  '☺️',
  '🥺',
  '😊',
  '🤢',
  '😂',
  '😭',
  '😎',
  '🤔',
  '👍',
  '🙄',
  '🤨',
  '🥳',
  '😵‍💫',
  '🤧',
  '😳',
]

const stickers = ['(>△<)', 'QwQ', '摸摸', '抱抱', '收到', '贴贴', '猫猫探头', '努力中', '已打卡', '+1', '晚安', '姐姐在']

const moreTools = [
  { label: '相册', icon: Image },
  { label: '拍摄', icon: Camera },
  { label: '文件', icon: File },
  { label: '收藏', icon: Star },
  { label: '礼物', icon: Gift },
  { label: '钱包', icon: WalletCards },
  { label: '聊天记录', icon: Clock3 },
  { label: '聊天背景', icon: Paintbrush },
]

const chatSettingRows = [
  { label: '设置置顶', value: 'off', switcher: true },
  { label: '特别关心', value: 'NEW 未开启' },
  { label: '隐藏会话', value: 'off', switcher: true },
  { label: '消息免打扰', value: 'off', switcher: true },
  { label: '消息通知设置', value: '通知预览、提示音等' },
  { label: '设置当前聊天背景', value: '' },
  { label: '删除聊天记录', value: '', danger: false },
  { label: '被骚扰了？举报该用户', value: '', link: true },
]

function MobileStatusBar() {
  return (
    <div className="mobile-status-bar" aria-hidden="true">
      <b>7:03</b>
      <span className="mobile-signal">5G 5G ▰▰▰ 37</span>
    </div>
  )
}

export function ChatPhone({
  character,
  characters,
  activeCharacterId,
  messages,
  memories,
  memoryUsageLogs,
  draft,
  isSending,
  settings,
  onDraftChange,
  onBackToList,
  onSelectCharacter,
  onMemoryFeedback,
  onSend,
  onShellAction,
}: ChatPhoneProps) {
  const [activePanel, setActivePanel] = useState<ToolPanel>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const traceByAssistantMessageId = useMemo(() => {
    return new Map(
      memoryUsageLogs
        .filter((log) => log.assistantMessageId)
        .map((log) => [log.assistantMessageId as string, buildMessageMemoryTrace(log, memories)]),
    )
  }, [memories, memoryUsageLogs])

  function togglePanel(panel: Exclude<ToolPanel, null>) {
    setActivePanel((current) => (current === panel ? null : panel))
  }

  function insertLineBreak(textarea: HTMLTextAreaElement) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const nextDraft = `${draft.slice(0, start)}\n${draft.slice(end)}`
    onDraftChange(nextDraft)

    requestAnimationFrame(() => {
      textarea.selectionStart = start + 1
      textarea.selectionEnd = start + 1
    })
  }

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isSending])

  return (
    <main className="workspace chat-workspace">
      <MobileStatusBar />
      <header
        className="chat-topbar"
        onClick={(event) => {
          const actionButton = (event.target as HTMLElement).closest('.chat-topbar-actions button')
          if (!actionButton || actionButton.classList.contains('mobile-menu-button')) return
          onShellAction?.('通话、视频和协作入口已保留，后续接入实时模型能力')
        }}
        style={{ '--avatar-accent': character.accent } as CSSProperties}
      >
        <button aria-label="返回消息" className="mobile-chat-back" onClick={onBackToList} type="button">
          <ChevronLeft size={34} />
        </button>
        <div className="chat-topbar-main">
          <span className="chat-topbar-avatar">{character.avatar}</span>
          <div className="chat-topbar-text">
            <strong>{character.name}</strong>
            <span>{character.subtitle || character.title}</span>
          </div>
          <select
            aria-label="切换聊天角色"
            className="chat-character-select"
            onChange={(event) => onSelectCharacter(event.target.value)}
            value={activeCharacterId}
          >
            {characters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="chat-topbar-actions" aria-label="聊天工具">
          <button aria-label="语音通话" title="语音通话" type="button">
            <Phone size={20} />
          </button>
          <button aria-label="视频通话" title="视频通话" type="button">
            <Video size={20} />
          </button>
          <button aria-label="屏幕分享" title="屏幕分享" type="button">
            <MonitorUp size={20} />
          </button>
          <button aria-label="发起协作" title="发起协作" type="button">
            <PlusCircle size={21} />
          </button>
          <button aria-label="更多" title="更多" type="button">
            <MoreHorizontal size={22} />
          </button>
          <button
            aria-label="聊天信息"
            className="mobile-menu-button"
            onClick={() => togglePanel('info')}
            title="聊天信息"
            type="button"
          >
            <Menu size={30} />
          </button>
        </div>
      </header>

      <div className="message-list" ref={messageListRef}>
        <div className="message-column">
          <div className="chat-time-separator">2026/03/18 13:10</div>
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              character={character}
              previousMessage={messages[index - 1] ?? null}
              showDevTrace={settings.showDevTrace}
              memoryTrace={message.role === 'assistant' ? traceByAssistantMessageId.get(message.id) : undefined}
              onMemoryFeedback={onMemoryFeedback}
            />
          ))}
          {messages.length <= 1 && (
            <div className="chat-row chat-row-user qq-demo-user">
              <span className="chat-row-avatar">妹</span>
              <article className="message message-user">
                <p>姐姐在吗 QAQ</p>
              </article>
            </div>
          )}
          <div className="chat-row chat-row-assistant qq-demo-stickers">
            <span
              className="chat-row-avatar"
              style={{ '--avatar-accent': character.accent } as CSSProperties}
            >
              {character.avatar}
            </span>
            <article className="message message-assistant sticker-message">😊</article>
          </div>
          {isSending && (
            <div className="chat-row chat-row-assistant">
              <span
                className="chat-row-avatar"
                style={{ '--avatar-accent': character.accent } as CSSProperties}
              >
                {character.avatar}
              </span>
              <article className="message message-assistant pending" aria-label="正在输入">
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </article>
            </div>
          )}
        </div>
      </div>

      {activePanel === 'info' && (
        <aside className="chat-side-drawer" aria-label="聊天信息">
          <header>
            <button aria-label="关闭" onClick={() => setActivePanel(null)} type="button">
              <ChevronLeft size={26} />
            </button>
            <strong>聊天信息</strong>
            <button aria-label="更多" type="button">
              <MoreHorizontal size={24} />
            </button>
          </header>
          <section className="chat-info-hero">
            <span className="avatar" style={{ '--avatar-accent': character.accent } as CSSProperties}>
              {character.avatar}
            </span>
            <div>
              <strong>{character.name}</strong>
              <small>QQ：3400470281</small>
            </div>
            <GridDots />
          </section>
          <section className="chat-info-card">
            <h3>群成员 <span>3人</span></h3>
            <div className="chat-member-row">
              {characters.slice(0, 3).map((item) => (
                <span key={item.id}>
                  <i className="avatar" style={{ '--avatar-accent': item.accent } as CSSProperties}>{item.avatar}</i>
                  {item.name}
                </span>
              ))}
              <span><i>+</i>邀请</span>
              <span><i>-</i>移除</span>
            </div>
          </section>
          <button className="chat-info-card row" onClick={() => setActivePanel('settings')} type="button">
            查找聊天记录
            <small>图片、视频、文件等</small>
          </button>
          <button className="chat-info-card row" type="button">
            群应用
            <small>文件、相册、精华消息</small>
          </button>
        </aside>
      )}

      {activePanel === 'settings' && (
        <aside className="chat-side-drawer settings-drawer" aria-label="聊天设置">
          <header>
            <button aria-label="返回聊天信息" onClick={() => setActivePanel('info')} type="button">
              <ChevronLeft size={26} />
            </button>
            <strong>聊天设置</strong>
            <span />
          </header>
          <section className="chat-info-card settings-head">
            <span className="avatar" style={{ '--avatar-accent': character.accent } as CSSProperties}>
              {character.avatar}
            </span>
            <strong>{character.name}</strong>
          </section>
          <section className="chat-setting-list">
            {chatSettingRows.map((row) => (
              <button className={row.link ? 'link-row' : row.danger ? 'danger-row' : ''} key={row.label} type="button">
                <span>{row.label}</span>
                {row.switcher ? (
                  <ToggleLeft size={46} />
                ) : row.value ? (
                  <small>{row.value}</small>
                ) : null}
              </button>
            ))}
          </section>
        </aside>
      )}

      <form
        className={`composer ${activePanel ? 'with-tool-panel' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
        }}
      >
        <div className="composer-entry">
          <textarea
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return

              if (settings.enterToSend) {
                if (event.ctrlKey || event.metaKey) {
                  event.preventDefault()
                  insertLineBreak(event.currentTarget)
                  return
                }

                if (event.shiftKey) return
                event.preventDefault()
                onSend()
                return
              }

              if (event.ctrlKey || event.metaKey) {
                event.preventDefault()
                onSend()
              }
            }}
            onChange={(event) => onDraftChange(event.target.value)}
            onFocus={() => {
              if (activePanel !== 'info' && activePanel !== 'settings') setActivePanel(null)
            }}
            placeholder=""
            rows={1}
            value={draft}
          />
          <button aria-label="发送" className="composer-send" disabled={!draft.trim() || isSending} type="submit">
            <span>发送</span>
            <Send size={18} />
          </button>
        </div>
        <div className="composer-toolbar" aria-label="快捷工具">
          <button aria-label="语音" className="composer-tool" title="语音" type="button">
            <Mic size={24} />
          </button>
          <button
            aria-label="图片"
            className={`composer-tool ${activePanel === 'sticker' ? 'active' : ''}`}
            onClick={() => togglePanel('sticker')}
            title="图片"
            type="button"
          >
            <Image size={24} />
          </button>
          <button aria-label="拍摄" className="composer-tool" title="拍摄" type="button">
            <Camera size={24} />
          </button>
          <button aria-label="文件" className="composer-tool" onClick={() => togglePanel('more')} title="文件" type="button">
            <Paperclip size={23} />
          </button>
          <button
            aria-label="表情"
            className={`composer-tool ${activePanel === 'emoji' ? 'active' : ''}`}
            onClick={() => togglePanel('emoji')}
            title="表情"
            type="button"
          >
            <Smile size={24} />
          </button>
          <button
            aria-label="更多"
            className={`composer-tool ${activePanel === 'more' ? 'active' : ''}`}
            onClick={() => togglePanel('more')}
            title="更多"
            type="button"
          >
            <Plus size={26} />
          </button>
        </div>

        {(activePanel === 'emoji' || activePanel === 'sticker' || activePanel === 'more') && (
          <section className="chat-tool-panel" aria-label="聊天工具面板">
            {activePanel === 'emoji' && (
              <>
                <h3>最近使用</h3>
                <div className="emoji-grid">
                  {emojiRows.map((emoji) => (
                    <button key={emoji} onClick={() => onDraftChange(`${draft}${emoji}`)} type="button">
                      {emoji}
                    </button>
                  ))}
                </div>
                <h3>超级表情</h3>
                <div className="emoji-grid compact">
                  {emojiRows.slice(6).map((emoji) => (
                    <button key={`super-${emoji}`} onClick={() => onDraftChange(`${draft}${emoji}`)} type="button">
                      {emoji}
                    </button>
                  ))}
                  <button type="button">...</button>
                </div>
                <div className="emoji-tabs">
                  <Search size={23} />
                  <Smile size={23} />
                  <Laugh size={23} />
                  <Star size={23} />
                  <b>GIF</b>
                  <b>AI</b>
                </div>
              </>
            )}

            {activePanel === 'sticker' && (
              <>
                <div className="sticker-grid">
                  <button className="sticker-add" type="button">+</button>
                  <button className="sticker-add" type="button">☺</button>
                  {stickers.map((sticker) => (
                    <button key={sticker} onClick={() => onDraftChange(`${draft}${sticker}`)} type="button">
                      <span>{sticker}</span>
                    </button>
                  ))}
                </div>
                <div className="emoji-tabs">
                  <Search size={23} />
                  <Smile size={23} />
                  <Laugh size={23} />
                  <Star size={23} />
                  <b>GIF</b>
                  <b>AI</b>
                </div>
              </>
            )}

            {activePanel === 'more' && (
              <div className="more-tool-grid">
                {moreTools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <button
                      key={tool.label}
                      onClick={() => onShellAction?.(`${tool.label}入口已保留，后续接入真实功能`)}
                      type="button"
                    >
                      <Icon size={24} />
                      <span>{tool.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </form>
    </main>
  )
}

function GridDots() {
  return (
    <span className="grid-dots" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
