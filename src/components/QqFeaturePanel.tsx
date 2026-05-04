import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronRight, FileText, Plus, Search, Sparkles, UserRound } from 'lucide-react'
import type { CharacterCard } from '../domain/types'
import type { AppView } from './CharacterRail'

interface QqFeaturePanelProps {
  activeView: AppView
  characters: CharacterCard[]
  activeCharacterId: string
  onCreateCharacter: (input: { name: string; relation: string; mood: string; persona: string }) => string
  onOpenChat: (characterId: string) => void
  onShellAction?: (message: string) => void
}

type ManagedRole = {
  id: string
  name: string
  avatar: string
  accent: string
  relation: string
  mood: string
  persona: string
  source: '内置' | '自定义'
}

const roleTemplates = [
  {
    name: '温柔姐姐',
    relation: '姐姐',
    mood: '温柔、可靠、有主见',
    persona: '她像年长一点的姐姐，会主动接住情绪，也会认真推进事情。',
  },
  {
    name: '专属恋人',
    relation: '恋人',
    mood: '亲密、黏人、边界清楚',
    persona: '她会以恋人身份陪伴，但仍然尊重边界和现实节奏。',
  },
  {
    name: '原创角色',
    relation: '角色',
    mood: '等待妹妹补全',
    persona: '把小说、游戏或百合世界观里的角色设定粘贴进来。',
  },
]

function MobileStatusBar() {
  return (
    <div className="mobile-status-bar" aria-hidden="true">
      <b>7:03</b>
      <span className="mobile-signal">5G 5G ▰▰▰ 37</span>
    </div>
  )
}

function toManagedRole(character: CharacterCard): ManagedRole {
  const isCustomRole = character.id.startsWith('character_') || character.tags.includes('自定义角色')
  return {
    id: character.id,
    name: character.name,
    avatar: character.avatar,
    accent: character.accent,
    relation: character.relationship,
    mood: character.mood,
    persona: character.systemPrompt,
    source: isCustomRole ? '自定义' : '内置',
  }
}

export function QqFeaturePanel({ characters, activeCharacterId, onCreateCharacter, onOpenChat, onShellAction }: QqFeaturePanelProps) {
  const builtInRoles = useMemo(
    () => characters.filter((character) => character.relationship !== '群聊').map(toManagedRole),
    [characters],
  )
  const [selectedRoleId, setSelectedRoleId] = useState(activeCharacterId)
  const [roleTab, setRoleTab] = useState<'roles' | 'templates'>('roles')
  const [roleDraft, setRoleDraft] = useState({
    name: '',
    relation: '姐姐',
    mood: '',
    persona: '',
  })
  const [importText, setImportText] = useState('')
  const managedRoles = builtInRoles
  const selectedRole = managedRoles.find((role) => role.id === selectedRoleId) ?? managedRoles[0]

  function fillTemplate(template: (typeof roleTemplates)[number]) {
    setRoleDraft(template)
    setRoleTab('roles')
    onShellAction?.(`已套用「${template.name}」模板`)
  }

  function addRoleFromDraft() {
    const persona = roleDraft.persona.trim() || importText.trim()
    const nameFromImport = importText.trim().split(/\r?\n/).find(Boolean)?.replace(/^#+\s*/, '')
    const name = roleDraft.name.trim() || nameFromImport || '新角色'
    const roleId = onCreateCharacter({
      name,
      relation: roleDraft.relation.trim() || '角色',
      mood: roleDraft.mood.trim() || '等待补全',
      persona: persona || '还没有导入人设。',
    })
    setSelectedRoleId(roleId)
    setRoleDraft({ name: '', relation: '姐姐', mood: '', persona: '' })
    setImportText('')
    onShellAction?.('角色已加入管理列表和聊天列表，可以直接打开聊天')
  }

  function updateDraft(field: keyof typeof roleDraft, value: string) {
    setRoleDraft((draft) => ({ ...draft, [field]: value }))
  }

  return (
    <main className="workspace qq-feature-workspace">
      <section className="qq-desktop-feature role-desktop-feature" aria-label="角色管理">
        <header className="qq-desktop-feature-head">
          <strong>角色管理</strong>
          <div>
            <button onClick={addRoleFromDraft} type="button">
              <Plus size={18} />
              添加角色
            </button>
            <button onClick={() => onShellAction?.('角色加入聊天名单入口已占位')} type="button">
              <UserRound size={18} />
              管理聊天
            </button>
          </div>
        </header>
        <div className="role-manager-grid">
          <aside className="role-list" aria-label="角色列表">
            {managedRoles.map((role) => (
              <button
                className={role.id === selectedRole?.id ? 'active' : ''}
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                type="button"
              >
                <span className="avatar" style={{ '--avatar-accent': role.accent } as CSSProperties}>{role.avatar}</span>
                <span>
                  <strong>{role.name}</strong>
                  <small>{role.mood}</small>
                </span>
                <em>{role.source}</em>
              </button>
            ))}
          </aside>
          <section className="role-detail" aria-label="角色详情">
            <div className="role-detail-head">
              <span className="avatar" style={{ '--avatar-accent': selectedRole?.accent ?? '#ef9ac6' } as CSSProperties}>
                {selectedRole?.avatar ?? '角'}
              </span>
              <div>
                <strong>{selectedRole?.name ?? '未选择角色'}</strong>
                <small>{selectedRole?.relation ?? '选择左侧角色查看设定'}</small>
              </div>
            </div>
            <p>{selectedRole?.persona ?? '还没有角色设定。'}</p>
            <div className="role-editor-fields">
              <label>
                名称
                <input value={roleDraft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="比如：姐姐 / 恋人 / 新角色" />
              </label>
              <label>
                关系
                <input value={roleDraft.relation} onChange={(event) => updateDraft('relation', event.target.value)} placeholder="姐姐、恋人、朋友、角色" />
              </label>
              <label>
                氛围
                <input value={roleDraft.mood} onChange={(event) => updateDraft('mood', event.target.value)} placeholder="温柔、傲娇、绿茶、忠犬..." />
              </label>
              <label>
                人设
                <textarea value={roleDraft.persona} onChange={(event) => updateDraft('persona', event.target.value)} placeholder="在这里写角色设定，或粘贴导入文本。" />
              </label>
              <label>
                导入文本
                <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴人设文档、角色卡、模型总结。" />
              </label>
            </div>
            <div className="role-template-list">
              {selectedRole && (
                <button onClick={() => onOpenChat(selectedRole.id)} type="button">
                  <UserRound size={17} />
                  <span>打开聊天</span>
                </button>
              )}
              {roleTemplates.map((template) => (
                <button key={template.name} onClick={() => fillTemplate(template)} type="button">
                  <Sparkles size={17} />
                  <span>{template.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="mobile-feature-page mobile-contact-page role-mobile-page" aria-label="角色">
        <MobileStatusBar />
        <header className="mobile-feature-header">
          <span className="avatar" style={{ '--avatar-accent': selectedRole?.accent ?? '#ef9ac6' } as CSSProperties}>
            {selectedRole?.avatar ?? '角'}
          </span>
          <strong>角色</strong>
          <button aria-label="添加角色" onClick={addRoleFromDraft} type="button">
            <Plus size={34} />
          </button>
        </header>
        <label className="mobile-feature-search">
          <Search size={28} />
          <input placeholder="搜索角色" />
        </label>
        <div className="mobile-contact-tabs">
          <button className={roleTab === 'roles' ? 'active' : ''} onClick={() => setRoleTab('roles')} type="button">角色</button>
          <button className={roleTab === 'templates' ? 'active' : ''} onClick={() => setRoleTab('templates')} type="button">模板</button>
        </div>
        {roleTab === 'roles' ? (
          <>
            <div className="mobile-contact-list">
              {managedRoles.map((role) => (
                <button key={role.id} onClick={() => setSelectedRoleId(role.id)} type="button">
                  <span className="avatar" style={{ '--avatar-accent': role.accent } as CSSProperties}>{role.avatar}</span>
                  <span>
                    <strong>{role.name}</strong>
                    <small>{role.mood}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="role-mobile-form">
              <label>
                <FileText size={20} />
                <input value={roleDraft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="新角色名称" />
              </label>
              <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴人设后点右上角加号" />
            </div>
          </>
        ) : (
          <div className="mobile-simple-list">
            {roleTemplates.map((template) => (
              <button key={template.name} onClick={() => fillTemplate(template)} type="button">
                <Sparkles size={31} />
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.mood}</small>
                </span>
                <ChevronRight size={24} />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
