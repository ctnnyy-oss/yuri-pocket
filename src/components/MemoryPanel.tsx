import {
  AlertTriangle,
  ArchiveRestore,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  History,
  Keyboard,
  Link2,
  Palette,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { brand } from '../config/brand'
import type {
  AccentTheme,
  AppSettings,
  AppTrash,
  CharacterCard,
  LocalBackupSummary,
  LongTermMemory,
  MemoryConflict,
  MemoryKind,
  MemoryMentionPolicy,
  MemoryScope,
  MemorySensitivity,
  MemoryStatus,
  MemoryUsageLog,
  WorldNode,
} from '../domain/types'
import type { CloudMetadata } from '../services/cloudSync'
import {
  formatMemoryScopeLabel,
  memoryKindLabels,
  memoryMentionPolicyLabels,
  memorySensitivityLabels,
  memoryStatusLabels,
} from '../services/memoryEngine'
import type { AppView } from './CharacterRail'

interface MemoryPanelProps {
  memories: LongTermMemory[]
  memoryConflicts: MemoryConflict[]
  memoryUsageLogs: MemoryUsageLog[]
  worldNodes: WorldNode[]
  characters: CharacterCard[]
  activeCharacterId: string
  activeConversationId: string
  trash: AppTrash
  settings: AppSettings
  activeView: Exclude<AppView, 'chat'>
  onAddMemory: () => void
  onOrganizeMemories: () => void
  onUpdateMemory: (memory: LongTermMemory) => void
  onRestoreMemoryRevision: (memoryId: string, revisionId: string) => void
  onTrashMemory: (memoryId: string) => void
  onUpdateWorldNode: (node: WorldNode) => void
  onTrashWorldNode: (nodeId: string) => void
  onRestoreMemory: (memoryId: string) => void
  onRestoreWorldNode: (nodeId: string) => void
  onDeleteTrashedMemory: (memoryId: string) => void
  onDeleteTrashedWorldNode: (nodeId: string) => void
  onEmptyTrash: () => void
  onUpdateSettings: (settings: AppSettings) => void
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
  cloudStatus: string
  cloudMeta: CloudMetadata | null
  cloudBusy: 'checking' | 'pulling' | 'pushing' | null
  cloudSyncConfigured: boolean
  cloudTokenSet: boolean
  onConnectCloud: () => void
  onPullCloud: () => void
  onPushCloud: () => void
  onRefreshCloud: () => void
  localBackups: LocalBackupSummary[]
  onCreateLocalBackup: () => void
  onRestoreLocalBackup: (backupId: string) => void
  onDeleteLocalBackup: (backupId: string) => void
}

interface MemoryDraft {
  title: string
  body: string
  tags: string
  priority: number
  pinned: boolean
  kind: MemoryKind
  confidence: number
  status: MemoryStatus
  sensitivity: MemorySensitivity
  mentionPolicy: MemoryMentionPolicy
  cooldownUntil: string
  scopeKind: MemoryScope['kind']
  characterId: string
  worldId: string
  branchId: string
  projectId: string
  conversationId: string
}

interface WorldDraft {
  title: string
  keywords: string
  content: string
  priority: number
  enabled: boolean
}

const accentThemes: Array<{ id: AccentTheme; label: string; color: string }> = [
  { id: 'sakura', label: '雾粉', color: '#d97798' },
  { id: 'peach', label: '蜜桃', color: '#df8a78' },
  { id: 'lavender', label: '淡紫', color: '#a88ad8' },
  { id: 'mint', label: '薄荷', color: '#74a695' },
]

const memoryKindOptions = Object.keys(memoryKindLabels) as MemoryKind[]
const memoryStatusOptions = Object.keys(memoryStatusLabels).filter(
  (status) => status !== 'trashed' && status !== 'permanently_deleted',
) as MemoryStatus[]
const memorySensitivityOptions = Object.keys(memorySensitivityLabels) as MemorySensitivity[]
const memoryMentionPolicyOptions = Object.keys(memoryMentionPolicyLabels) as MemoryMentionPolicy[]
const memoryScopeOptions: Array<{ id: MemoryScope['kind']; label: string }> = [
  { id: 'global_user', label: '全局用户' },
  { id: 'relationship', label: '当前关系' },
  { id: 'character_private', label: '角色私有' },
  { id: 'project', label: '项目' },
  { id: 'world', label: '世界' },
  { id: 'world_branch', label: '世界分支' },
  { id: 'conversation', label: '当前会话' },
  { id: 'temporary', label: '临时' },
]
const defaultProjectId = brand.defaultProjectId

export function MemoryPanel({
  memories,
  memoryConflicts,
  memoryUsageLogs,
  worldNodes,
  characters,
  activeCharacterId,
  activeConversationId,
  trash,
  settings,
  activeView,
  onAddMemory,
  onOrganizeMemories,
  onUpdateMemory,
  onRestoreMemoryRevision,
  onTrashMemory,
  onUpdateWorldNode,
  onTrashWorldNode,
  onRestoreMemory,
  onRestoreWorldNode,
  onDeleteTrashedMemory,
  onDeleteTrashedWorldNode,
  onEmptyTrash,
  onUpdateSettings,
  onExport,
  onImport,
  onReset,
  cloudStatus,
  cloudMeta,
  cloudBusy,
  cloudSyncConfigured,
  cloudTokenSet,
  onConnectCloud,
  onPullCloud,
  onPushCloud,
  onRefreshCloud,
  localBackups,
  onCreateLocalBackup,
  onRestoreLocalBackup,
  onDeleteLocalBackup,
}: MemoryPanelProps) {
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraft | null>(null)
  const [editingWorldId, setEditingWorldId] = useState<string | null>(null)
  const [worldDraft, setWorldDraft] = useState<WorldDraft | null>(null)
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null)

  function startMemoryEdit(memory: LongTermMemory) {
    const scopeDraft = scopeToDraft(memory.scope)
    setEditingMemoryId(memory.id)
    setMemoryDraft({
      title: memory.title,
      body: memory.body,
      tags: memory.tags.join('，'),
      priority: memory.priority,
      pinned: memory.pinned,
      kind: memory.kind,
      confidence: memory.confidence,
      status: memory.status,
      sensitivity: memory.sensitivity,
      mentionPolicy: memory.mentionPolicy,
      cooldownUntil: memory.cooldownUntil ?? '',
      ...scopeDraft,
    })
  }

  function saveMemoryEdit(memory: LongTermMemory) {
    if (!memoryDraft) return

    onUpdateMemory({
      ...memory,
      title: memoryDraft.title.trim() || '未命名记忆',
      body: memoryDraft.body.trim(),
      tags: splitList(memoryDraft.tags),
      priority: clamp(memoryDraft.priority, 1, 5),
      pinned: memoryDraft.pinned,
      kind: memoryDraft.kind,
      confidence: clamp(memoryDraft.confidence, 0.1, 1),
      status: memoryDraft.status,
      sensitivity: memoryDraft.sensitivity,
      mentionPolicy: memoryDraft.mentionPolicy,
      cooldownUntil: memoryDraft.cooldownUntil || undefined,
      scope: draftToScope(memoryDraft, activeCharacterId, activeConversationId),
    })
    setEditingMemoryId(null)
    setMemoryDraft(null)
  }

  function startWorldEdit(node: WorldNode) {
    setEditingWorldId(node.id)
    setWorldDraft({
      title: node.title,
      keywords: node.keywords.join('，'),
      content: node.content,
      priority: node.priority,
      enabled: node.enabled,
    })
  }

  function saveWorldEdit(node: WorldNode) {
    if (!worldDraft) return

    onUpdateWorldNode({
      ...node,
      title: worldDraft.title.trim() || '未命名节点',
      keywords: splitList(worldDraft.keywords),
      content: worldDraft.content.trim(),
      priority: clamp(worldDraft.priority, 1, 5),
      enabled: worldDraft.enabled,
    })
    setEditingWorldId(null)
    setWorldDraft(null)
  }

  function cancelEdit() {
    setEditingMemoryId(null)
    setMemoryDraft(null)
    setEditingWorldId(null)
    setWorldDraft(null)
  }

  const candidateMemories = memories.filter((memory) => memory.status === 'candidate')
  const reviewedMemories = memories.filter((memory) => memory.status !== 'candidate')
  const selectedMemory = selectedMemoryId ? memories.find((memory) => memory.id === selectedMemoryId) : null

  return (
    <main className="workspace detail-workspace">
      {activeView === 'memory' && (
        <>
          <WorkspaceTitle
            description="整理妹妹和角色之间会长期用到的信息，写错了就直接改。"
            icon={<BookOpen size={20} />}
            title="花园记忆"
          />
          <div className="detail-actions">
            <button className="secondary-action" onClick={onAddMemory} type="button">
              整理最近聊天
            </button>
            <button className="quiet-action" onClick={onOrganizeMemories} type="button">
              <Sparkles size={16} />
              后台整理
            </button>
          </div>
          <MemoryGardenInsight memories={memories} />
          <MemorySpaceOverview
            activeCharacterId={activeCharacterId}
            characters={characters}
            memories={memories}
          />
          <MemoryCandidateReview
            candidates={candidateMemories}
            characters={characters}
            onArchive={(memory) =>
              onUpdateMemory({
                ...memory,
                status: 'archived',
                userEdited: true,
              })
            }
            onConfirm={(memory) =>
              onUpdateMemory({
                ...memory,
                status: 'active',
                confidence: Math.max(memory.confidence, 0.9),
                userEdited: true,
              })
            }
            onEdit={startMemoryEdit}
            onOpen={(memory) => setSelectedMemoryId(memory.id)}
            onTrash={(memory) => onTrashMemory(memory.id)}
          />
          <MemoryDiagnostics
            activeCharacterId={activeCharacterId}
            conflicts={memoryConflicts}
            memories={memories}
            onUpdateMemory={onUpdateMemory}
            usageLogs={memoryUsageLogs}
          />
          <section className="panel-stack">
            {memories.length === 0 && <EmptyState text="当前没有记忆。删掉的内容可以去回收花园找回。" />}
            {memories.length > 0 && reviewedMemories.length === 0 && (
              <EmptyState text="当前只有待确认记忆。确认后，它们才会进入长期记忆列表。" />
            )}
            {reviewedMemories.map((memory) => (
              <article className="memory-item" key={memory.id}>
                {editingMemoryId === memory.id && memoryDraft ? (
                  <div className="edit-form">
                    <label>
                      <span>标题</span>
                      <input
                        onChange={(event) => setMemoryDraft({ ...memoryDraft, title: event.target.value })}
                        value={memoryDraft.title}
                      />
                    </label>
                    <label>
                      <span>内容</span>
                      <textarea
                        onChange={(event) => setMemoryDraft({ ...memoryDraft, body: event.target.value })}
                        rows={4}
                        value={memoryDraft.body}
                      />
                    </label>
                    <label>
                      <span>标签</span>
                      <input
                        onChange={(event) => setMemoryDraft({ ...memoryDraft, tags: event.target.value })}
                        value={memoryDraft.tags}
                      />
                    </label>
                    <ScopeEditor
                      activeCharacterId={activeCharacterId}
                      activeConversationId={activeConversationId}
                      characters={characters}
                      draft={memoryDraft}
                      onChange={setMemoryDraft}
                      worldNodes={worldNodes}
                    />
                    <div className="edit-row">
                      <label>
                        <span>类型</span>
                        <select
                          onChange={(event) =>
                            setMemoryDraft({ ...memoryDraft, kind: event.target.value as MemoryKind })
                          }
                          value={memoryDraft.kind}
                        >
                          {memoryKindOptions.map((kind) => (
                            <option key={kind} value={kind}>
                              {memoryKindLabels[kind]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>可信度</span>
                        <input
                          max="1"
                          min="0.1"
                          onChange={(event) =>
                            setMemoryDraft({ ...memoryDraft, confidence: Number(event.target.value) })
                          }
                          step="0.05"
                          type="number"
                          value={memoryDraft.confidence}
                        />
                      </label>
                    </div>
                    <div className="edit-row">
                      <label>
                        <span>状态</span>
                        <select
                          onChange={(event) =>
                            setMemoryDraft({ ...memoryDraft, status: event.target.value as MemoryStatus })
                          }
                          value={memoryDraft.status}
                        >
                          {memoryStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {memoryStatusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>敏感度</span>
                        <select
                          onChange={(event) =>
                            setMemoryDraft({
                              ...memoryDraft,
                              sensitivity: event.target.value as MemorySensitivity,
                            })
                          }
                          value={memoryDraft.sensitivity}
                        >
                          {memorySensitivityOptions.map((sensitivity) => (
                            <option key={sensitivity} value={sensitivity}>
                              {memorySensitivityLabels[sensitivity]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="edit-row">
                      <label>
                        <span>提及时机</span>
                        <select
                          onChange={(event) =>
                            setMemoryDraft({
                              ...memoryDraft,
                              mentionPolicy: event.target.value as MemoryMentionPolicy,
                            })
                          }
                          value={memoryDraft.mentionPolicy}
                        >
                          {memoryMentionPolicyOptions.map((policy) => (
                            <option key={policy} value={policy}>
                              {memoryMentionPolicyLabels[policy]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>冷却到</span>
                        <input
                          onChange={(event) =>
                            setMemoryDraft({
                              ...memoryDraft,
                              cooldownUntil: localInputToIso(event.target.value),
                            })
                          }
                          type="datetime-local"
                          value={isoToLocalInput(memoryDraft.cooldownUntil)}
                        />
                      </label>
                    </div>
                    <div className="edit-row">
                      <label>
                        <span>权重</span>
                        <input
                          max="5"
                          min="1"
                          onChange={(event) =>
                            setMemoryDraft({ ...memoryDraft, priority: Number(event.target.value) })
                          }
                          type="number"
                          value={memoryDraft.priority}
                        />
                      </label>
                      <label className="compact-check">
                        <input
                          checked={memoryDraft.pinned}
                          onChange={(event) => setMemoryDraft({ ...memoryDraft, pinned: event.target.checked })}
                          type="checkbox"
                        />
                        <span>置顶</span>
                      </label>
                    </div>
                    <div className="item-actions">
                      <IconTextButton icon={<Save size={16} />} label="保存" onClick={() => saveMemoryEdit(memory)} />
                      <IconTextButton icon={<X size={16} />} label="取消" onClick={cancelEdit} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="item-head">
                      <strong>{memory.title}</strong>
                      <span>权重 {memory.priority} / {Math.round(memory.confidence * 100)}%</span>
                    </div>
                    <div className="memory-meta">
                      <span>{memoryKindLabels[memory.kind]}</span>
                      <span>{memoryStatusLabels[memory.status]}</span>
                      <span>{formatScopeDisplay(memory.scope, characters)}</span>
                      <span>{memorySensitivityLabels[memory.sensitivity]}</span>
                      <span>{memoryMentionPolicyLabels[memory.mentionPolicy]}</span>
                      {memory.pinned && <span>置顶</span>}
                      {isCoolingDown(memory.cooldownUntil) && <span>冷却中</span>}
                      <span>来源 {memory.sources.length}</span>
                      <span>版本 {memory.revisions.length}</span>
                      {memory.lastAccessedAt && <span>最近调用 {formatShortTime(memory.lastAccessedAt)}</span>}
                    </div>
                    <p>{memory.body}</p>
                    <footer>{memory.tags.join(' / ')}</footer>
                    <details className="memory-details">
                      <summary>
                        <Link2 size={15} />
                        来源与版本
                      </summary>
                      <div className="detail-grid">
                        <section>
                          <h3>
                            <ShieldCheck size={15} />
                            证据来源
                          </h3>
                          {memory.sources.length === 0 ? (
                            <small>这条记忆来自旧版本，暂时没有原始来源。</small>
                          ) : (
                            memory.sources.slice(0, 4).map((source) => (
                              <blockquote key={source.id}>
                                <span>{source.kind === 'message' ? '聊天原文' : source.kind}</span>
                                {source.excerpt}
                              </blockquote>
                            ))
                          )}
                        </section>
                        <section>
                          <h3>
                            <History size={15} />
                            版本记录
                          </h3>
                          {memory.revisions
                            .slice()
                            .reverse()
                            .slice(0, 5)
                            .map((revision) => (
                              <div className="revision-row" key={revision.id}>
                                <span>
                                  {formatShortTime(revision.createdAt)} / {revision.reason}
                                </span>
                                <button
                                  onClick={() => onRestoreMemoryRevision(memory.id, revision.id)}
                                  type="button"
                                >
                                  回滚
                                </button>
                              </div>
                            ))}
                        </section>
                      </div>
                    </details>
                    <div className="item-actions">
                      {memory.status === 'candidate' && (
                        <IconTextButton
                          icon={<ShieldCheck size={16} />}
                          label="确认保存"
                          onClick={() =>
                            onUpdateMemory({
                              ...memory,
                              status: 'active',
                              confidence: Math.max(memory.confidence, 0.9),
                              userEdited: true,
                            })
                          }
                        />
                      )}
                      <IconTextButton
                        icon={<FileText size={16} />}
                        label="档案"
                        onClick={() => setSelectedMemoryId(memory.id)}
                      />
                      <IconTextButton icon={<Pencil size={16} />} label="编辑" onClick={() => startMemoryEdit(memory)} />
                      <MemoryScopeQuickActions
                        activeCharacterId={activeCharacterId}
                        memory={memory}
                        onUpdateMemory={onUpdateMemory}
                      />
                      <MemoryMentionQuickActions memory={memory} onUpdateMemory={onUpdateMemory} />
                      <IconTextButton icon={<Trash2 size={16} />} label="删除" onClick={() => onTrashMemory(memory.id)} />
                    </div>
                  </>
                )}
              </article>
            ))}
          </section>
          {selectedMemory && (
            <MemoryArchiveModal
              memory={selectedMemory}
              characters={characters}
              onClose={() => setSelectedMemoryId(null)}
              onEdit={(memory) => {
                setSelectedMemoryId(null)
                startMemoryEdit(memory)
              }}
              onRestoreRevision={onRestoreMemoryRevision}
              onTrash={(memory) => {
                setSelectedMemoryId(null)
                onTrashMemory(memory.id)
              }}
              usageLogs={memoryUsageLogs}
            />
          )}
        </>
      )}

      {activeView === 'world' && (
        <>
          <WorkspaceTitle
            description="用关键词触发世界观、CP 原则和应用设定，不合适的节点也可以关掉或删除。"
            icon={<Database size={20} />}
            title="世界树"
          />
          <section className="panel-stack">
            {worldNodes.length === 0 && <EmptyState text="当前没有世界树节点。删掉的内容可以去回收花园找回。" />}
            {worldNodes.map((node) => (
              <article className="memory-item" key={node.id}>
                {editingWorldId === node.id && worldDraft ? (
                  <div className="edit-form">
                    <label>
                      <span>标题</span>
                      <input
                        onChange={(event) => setWorldDraft({ ...worldDraft, title: event.target.value })}
                        value={worldDraft.title}
                      />
                    </label>
                    <label>
                      <span>触发词</span>
                      <input
                        onChange={(event) => setWorldDraft({ ...worldDraft, keywords: event.target.value })}
                        value={worldDraft.keywords}
                      />
                    </label>
                    <label>
                      <span>内容</span>
                      <textarea
                        onChange={(event) => setWorldDraft({ ...worldDraft, content: event.target.value })}
                        rows={4}
                        value={worldDraft.content}
                      />
                    </label>
                    <div className="edit-row">
                      <label>
                        <span>权重</span>
                        <input
                          max="5"
                          min="1"
                          onChange={(event) => setWorldDraft({ ...worldDraft, priority: Number(event.target.value) })}
                          type="number"
                          value={worldDraft.priority}
                        />
                      </label>
                      <label className="compact-check">
                        <input
                          checked={worldDraft.enabled}
                          onChange={(event) => setWorldDraft({ ...worldDraft, enabled: event.target.checked })}
                          type="checkbox"
                        />
                        <span>启用</span>
                      </label>
                    </div>
                    <div className="item-actions">
                      <IconTextButton icon={<Save size={16} />} label="保存" onClick={() => saveWorldEdit(node)} />
                      <IconTextButton icon={<X size={16} />} label="取消" onClick={cancelEdit} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="item-head">
                      <strong>{node.title}</strong>
                      <span>{node.enabled ? '启用' : '关闭'} / 权重 {node.priority}</span>
                    </div>
                    <p>{node.content}</p>
                    <footer>{node.keywords.join(' / ')}</footer>
                    <div className="item-actions">
                      <IconTextButton icon={<Pencil size={16} />} label="编辑" onClick={() => startWorldEdit(node)} />
                      <IconTextButton icon={<Trash2 size={16} />} label="删除" onClick={() => onTrashWorldNode(node.id)} />
                    </div>
                  </>
                )}
              </article>
            ))}
          </section>
        </>
      )}

      {activeView === 'trash' && (
        <>
          <WorkspaceTitle
            description="删掉的记忆和世界树先睡在这里，后悔了可以恢复。"
            icon={<ArchiveRestore size={20} />}
            title="回收花园"
          />
          {(trash.memories.length > 0 || trash.worldNodes.length > 0) && (
            <div className="detail-actions">
              <button
                className="danger-button secondary-danger"
                onClick={() => {
                  if (window.confirm('回收花园里的内容会全部彻底删除，不能再恢复。确定吗？')) {
                    onEmptyTrash()
                  }
                }}
                type="button"
              >
                清空回收花园
              </button>
            </div>
          )}
          <section className="panel-stack">
            {trash.memories.length === 0 && trash.worldNodes.length === 0 && (
              <EmptyState text="回收花园是空的。以后误删了，姐姐会先放到这里。" />
            )}
            {trash.memories.map((memory) => (
              <article className="memory-item muted-item" key={`trash-memory-${memory.id}`}>
                <div className="item-head">
                  <strong>记忆 / {memory.title}</strong>
                  <span>{formatDeletedAt(memory.deletedAt)}</span>
                </div>
                <p>{memory.body}</p>
                <footer>{memory.tags.join(' / ')}</footer>
                <div className="item-actions">
                  <IconTextButton
                    icon={<RotateCcw size={16} />}
                    label="恢复"
                    onClick={() => onRestoreMemory(memory.id)}
                  />
                  <IconTextButton
                    danger
                    icon={<Trash2 size={16} />}
                    label="彻底删除"
                    onClick={() => {
                      if (window.confirm('这条记忆会被彻底删除，不能再恢复。确定吗？')) {
                        onDeleteTrashedMemory(memory.id)
                      }
                    }}
                  />
                </div>
              </article>
            ))}
            {trash.worldNodes.map((node) => (
              <article className="memory-item muted-item" key={`trash-world-${node.id}`}>
                <div className="item-head">
                  <strong>世界树 / {node.title}</strong>
                  <span>{formatDeletedAt(node.deletedAt)}</span>
                </div>
                <p>{node.content}</p>
                <footer>{node.keywords.join(' / ')}</footer>
                <div className="item-actions">
                  <IconTextButton
                    icon={<RotateCcw size={16} />}
                    label="恢复"
                    onClick={() => onRestoreWorldNode(node.id)}
                  />
                  <IconTextButton
                    danger
                    icon={<Trash2 size={16} />}
                    label="彻底删除"
                    onClick={() => {
                      if (window.confirm('这个世界树节点会被彻底删除，不能再恢复。确定吗？')) {
                        onDeleteTrashedWorldNode(node.id)
                      }
                    }}
                  />
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      {activeView === 'model' && (
        <>
          <WorkspaceTitle
            description="当前默认使用本机中转和免费模型，密钥只保存在本机。"
            icon={<SlidersHorizontal size={20} />}
            title="模型与数据"
          />
          <section className="settings-stack">
            <label>
              <span>模型</span>
              <input
                value={settings.model}
                onChange={(event) => onUpdateSettings({ ...settings, model: event.target.value })}
              />
            </label>
            <label>
              <span>温柔度</span>
              <input
                max="2"
                min="0"
                step="0.1"
                type="number"
                value={settings.temperature}
                onChange={(event) => onUpdateSettings({ ...settings, temperature: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>短期记忆</span>
              <input
                max="60"
                min="4"
                step="1"
                type="number"
                value={settings.maxContextMessages}
                onChange={(event) =>
                  onUpdateSettings({ ...settings, maxContextMessages: Number(event.target.value) })
                }
              />
            </label>

            <div className="settings-section">
              <div className="settings-section-title">
                <Database size={18} />
                <span>云端同步</span>
              </div>
              <p className="section-note">
                {cloudSyncConfigured
                  ? cloudTokenSet
                    ? '云端后端已配置，口令已保存在这台设备。'
                    : '云端后端已配置，第一次使用需要填写云端口令。'
                  : '当前构建还没有配置云端后端地址。'}
              </p>
              <div className="cloud-meta-strip" aria-label="云端同步状态">
                <span>
                  <strong>版本</strong>
                  {cloudMeta ? `v${cloudMeta.revision}` : '未检查'}
                </span>
                <span>
                  <strong>最后保存</strong>
                  {cloudMeta ? formatCloudTime(cloudMeta.updatedAt) : '未检查'}
                </span>
                <span>
                  <strong>云端数据</strong>
                  {cloudMeta ? (cloudMeta.hasState ? '已有快照' : '空') : '未检查'}
                </span>
              </div>
              <small className="cloud-status-line">{cloudBusy ? getCloudBusyLabel(cloudBusy) : cloudStatus}</small>
              <div className="settings-actions">
                <button disabled={!cloudSyncConfigured || Boolean(cloudBusy)} onClick={onConnectCloud} type="button">
                  <Link2 size={15} />
                  连接云端
                </button>
                <button
                  disabled={!cloudSyncConfigured || !cloudTokenSet || Boolean(cloudBusy)}
                  onClick={onRefreshCloud}
                  type="button"
                >
                  <RefreshCw size={15} />
                  检查云端
                </button>
                <button
                  disabled={!cloudSyncConfigured || !cloudTokenSet || Boolean(cloudBusy)}
                  onClick={onPushCloud}
                  type="button"
                >
                  <Save size={15} />
                  {cloudBusy === 'pushing' ? '保存中' : '保存到云端'}
                </button>
                <button
                  disabled={!cloudSyncConfigured || !cloudTokenSet || Boolean(cloudBusy)}
                  onClick={onPullCloud}
                  type="button"
                >
                  <RefreshCw size={15} />
                  {cloudBusy === 'pulling' ? '读取中' : '从云端读取'}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <ArchiveRestore size={18} />
                <span>本机保险箱</span>
              </div>
              <p className="section-note">
                从云端读取、导入文件、重置之前会自动留一份本机备份；妹妹也可以手动创建。
              </p>
              <div className="settings-actions">
                <button onClick={onCreateLocalBackup} type="button">
                  <Save size={15} />
                  创建本机备份
                </button>
              </div>
              <div className="backup-list">
                {localBackups.length === 0 ? (
                  <small>还没有本机备份。做一次读取、导入或重置前，姐姐会自动留底。</small>
                ) : (
                  localBackups.slice(0, 6).map((backup) => (
                    <article className="backup-item" key={backup.id}>
                      <div>
                        <strong>{backup.label}</strong>
                        <span>
                          {formatShortTime(backup.createdAt)} / {backup.reason}
                        </span>
                        <small>{formatBackupCounts(backup)}</small>
                      </div>
                      <div className="backup-actions">
                        <button onClick={() => onRestoreLocalBackup(backup.id)} type="button">
                          恢复
                        </button>
                        <button className="danger-button" onClick={() => onDeleteLocalBackup(backup.id)} type="button">
                          删除
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="settings-actions">
              <button onClick={onExport} type="button">
                导出
              </button>
              <label className="file-button">
                导入
                <input
                  accept="application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) onImport(file)
                    event.currentTarget.value = ''
                  }}
                  type="file"
                />
              </label>
              <button className="danger-button" onClick={onReset} type="button">
                重置
              </button>
            </div>
          </section>
        </>
      )}

      {activeView === 'settings' && (
        <>
          <WorkspaceTitle
            description="调整输入习惯、字体大小和界面颜色。"
            icon={<Settings2 size={20} />}
            title="设置"
          />
          <section className="settings-stack">
            <div className="settings-section">
              <div className="settings-section-title">
                <Keyboard size={18} />
                <span>输入习惯</span>
              </div>
              <label className="toggle-row">
                <span>
                  <strong>回车发送</strong>
                  <small>{settings.enterToSend ? 'Ctrl + Enter 换行' : 'Enter 换行，Ctrl + Enter 发送'}</small>
                </span>
                <input
                  checked={settings.enterToSend}
                  onChange={(event) => onUpdateSettings({ ...settings, enterToSend: event.target.checked })}
                  type="checkbox"
                />
              </label>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <Type size={18} />
                <span>阅读大小</span>
              </div>
              <label className="range-control">
                <span>
                  <strong>字体大小</strong>
                  <small>{settings.fontSize}px</small>
                </span>
                <input
                  max="18"
                  min="13"
                  onChange={(event) => onUpdateSettings({ ...settings, fontSize: Number(event.target.value) })}
                  step="1"
                  type="range"
                  value={settings.fontSize}
                />
              </label>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <Palette size={18} />
                <span>主题颜色</span>
              </div>
              <div className="theme-swatches">
                {accentThemes.map((theme) => (
                  <button
                    aria-label={`切换到${theme.label}`}
                    className={`swatch-button ${settings.accentTheme === theme.id ? 'active' : ''}`}
                    key={theme.id}
                    onClick={() => onUpdateSettings({ ...settings, accentTheme: theme.id })}
                    type="button"
                  >
                    <span className="swatch-dot" style={{ background: theme.color }} />
                    <span>{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <Sparkles size={18} />
                <span>记忆系统</span>
              </div>
              <label className="toggle-row">
                <span>
                  <strong>自动捕捉记忆</strong>
                  <small>只保存有长期价值的偏好、规则和项目线索</small>
                </span>
                <input
                  checked={settings.autoMemoryEnabled}
                  onChange={(event) => onUpdateSettings({ ...settings, autoMemoryEnabled: event.target.checked })}
                  type="checkbox"
                />
              </label>
              <label className="range-control">
                <span>
                  <strong>自动记忆门槛</strong>
                  <small>{Math.round(settings.memoryConfidenceFloor * 100)}%</small>
                </span>
                <input
                  max="0.95"
                  min="0.5"
                  onChange={(event) =>
                    onUpdateSettings({ ...settings, memoryConfidenceFloor: Number(event.target.value) })
                  }
                  step="0.05"
                  type="range"
                  value={settings.memoryConfidenceFloor}
                />
              </label>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <ArchiveRestore size={18} />
                <span>回收花园</span>
              </div>
              <div className="retention-options">
                <RetentionButton
                  active={settings.trashRetentionMode === 'forever'}
                  description="不会自动清理"
                  label="永久保存"
                  onClick={() => onUpdateSettings({ ...settings, trashRetentionMode: 'forever' })}
                />
                <RetentionButton
                  active={settings.trashRetentionMode === 'default'}
                  description="30 天后清理"
                  label="默认 30 天"
                  onClick={() =>
                    onUpdateSettings({ ...settings, trashRetentionMode: 'default', trashRetentionDays: 30 })
                  }
                />
                <RetentionButton
                  active={settings.trashRetentionMode === 'custom'}
                  description="1-365 天"
                  label="自定义"
                  onClick={() => onUpdateSettings({ ...settings, trashRetentionMode: 'custom' })}
                />
              </div>
              {settings.trashRetentionMode === 'custom' && (
                <label className="number-control">
                  <span>
                    <strong>保留天数</strong>
                    <small>只能设置 1 到 365 天</small>
                  </span>
                  <input
                    max="365"
                    min="1"
                    onChange={(event) =>
                      onUpdateSettings({ ...settings, trashRetentionDays: Number(event.target.value) })
                    }
                    type="number"
                    value={settings.trashRetentionDays}
                  />
                </label>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function buildMemoryInsight(memories: LongTermMemory[]) {
  const total = memories.length
  const sourced = memories.filter((memory) => memory.sources.length > 0).length
  const pending = memories.filter((memory) => memory.status === 'candidate').length
  const boundary = memories.filter((memory) => memory.kind === 'taboo' || memory.kind === 'safety').length
  const lowConfidence = memories.filter((memory) => memory.confidence < 0.72).length
  const missingSource = total - sourced
  const stale = memories.filter((memory) => !memory.pinned && memory.lastAccessedAt && daysSince(memory.lastAccessedAt) > 30).length
  const averageConfidence = total
    ? Math.round((memories.reduce((sum, memory) => sum + memory.confidence, 0) / total) * 100)
    : 0
  const sourceCoverage = total ? Math.round((sourced / total) * 100) : 0
  const topKind = getTopMemoryKind(memories)
  const topMemories = [...memories]
    .filter((memory) => memory.status === 'active')
    .sort((a, b) => scoreVisibleMemory(b) - scoreVisibleMemory(a))
    .slice(0, 3)

  const suggestions: string[] = []
  if (total === 0) {
    suggestions.push('先把一条真正重要的偏好或项目规则放进来，记忆花园就有第一颗种子。')
  }
  if (missingSource > 0) {
    suggestions.push(`有 ${missingSource} 条记忆缺少来源，后面可以补证据或手动确认。`)
  }
  if (pending > 0) {
    suggestions.push(`有 ${pending} 条候选记忆等妹妹确认，确认后才会进入聊天提示。`)
  }
  if (boundary === 0 && total > 0) {
    suggestions.push('还没有边界记忆。以后遇到“不想被提起”的内容，可以存成禁忌。')
  }
  if (lowConfidence > 0) {
    suggestions.push(`有 ${lowConfidence} 条低可信记忆，适合优先检查，避免 AI 误会妹妹。`)
  }
  if (stale > 0) {
    suggestions.push(`有 ${stale} 条非置顶记忆一个月没被想起，可以考虑降权或删除。`)
  }
  if (total > 0 && sourceCoverage >= 80 && lowConfidence === 0) {
    suggestions.push('证据链和可信度都比较稳，可以继续放心聊天，慢慢让它长熟。')
  }
  if (suggestions.length === 0) {
    suggestions.push('目前花园很干净，下一步可以多积累“妹妹明确喜欢/不喜欢”的偏好记忆。')
  }

  return {
    summary: total > 0 ? `共 ${total} 条记忆，主色调是${topKind}。` : '还在等第一条长期记忆。',
    stats: [
      { label: '总数', value: `${total}` },
      { label: '待确认', value: `${pending}` },
      { label: '平均可信', value: `${averageConfidence}%` },
      { label: '边界', value: `${boundary}` },
    ],
    suggestions: suggestions.slice(0, 3),
    topMemories,
  }
}

function getTopMemoryKind(memories: LongTermMemory[]): string {
  if (memories.length === 0) return '空白花圃'

  const counts = new Map<MemoryKind, number>()
  memories.forEach((memory) => {
    counts.set(memory.kind, (counts.get(memory.kind) ?? 0) + 1)
  })

  const [kind] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return memoryKindLabels[kind]
}

function scoreVisibleMemory(memory: LongTermMemory): number {
  return (
    Number(memory.pinned) * 80 +
    memory.priority * 14 +
    memory.confidence * 20 +
    Math.min(memory.accessCount, 30) +
    (memory.lastAccessedAt ? Math.max(0, 12 - daysSince(memory.lastAccessedAt)) : 0)
  )
}

function daysSince(value: string): number {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 99
  return (Date.now() - time) / 86_400_000
}

function MemoryGardenInsight({ memories }: { memories: LongTermMemory[] }) {
  const insight = buildMemoryInsight(memories)

  return (
    <section className="memory-insight" aria-label="记忆花园体检">
      <div className="memory-insight-head">
        <div>
          <strong>花园体检</strong>
          <span>{insight.summary}</span>
        </div>
        <Sparkles size={18} />
      </div>
      <div className="insight-grid">
        {insight.stats.map((stat) => (
          <div className="insight-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className="insight-columns">
        <div>
          <h3>
            <ShieldCheck size={15} />
            姐姐建议
          </h3>
          <ul className="insight-list">
            {insight.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>
            <History size={15} />
            最近容易被想起
          </h3>
          <div className="insight-memory-list">
            {insight.topMemories.length === 0 ? (
              <p>还没有可回看的记忆，先从最近聊天整理一条就好。</p>
            ) : (
              insight.topMemories.map((memory) => (
                <div className="insight-memory" key={memory.id}>
                  <strong>{memory.title}</strong>
                  <span>
                    {memoryKindLabels[memory.kind]} / 权重 {memory.priority} / {Math.round(memory.confidence * 100)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function MemorySpaceOverview({
  activeCharacterId,
  characters,
  memories,
}: {
  activeCharacterId: string
  characters: CharacterCard[]
  memories: LongTermMemory[]
}) {
  const activeMemories = memories.filter((memory) => memory.status === 'active' || memory.status === 'candidate')
  const globalCount = activeMemories.filter((memory) => memory.scope.kind === 'global_user').length
  const roleScopedCount = activeMemories.filter(
    (memory) =>
      (memory.scope.kind === 'relationship' || memory.scope.kind === 'character_private') &&
      memory.scope.characterId === activeCharacterId,
  ).length
  const projectCount = activeMemories.filter((memory) => memory.scope.kind === 'project').length
  const worldCount = activeMemories.filter(
    (memory) => memory.scope.kind === 'world' || memory.scope.kind === 'world_branch',
  ).length
  const misplacedRelationships = activeMemories.filter(
    (memory) => memory.kind === 'relationship' && memory.scope.kind === 'global_user',
  )
  const currentCharacter = characters.find((character) => character.id === activeCharacterId)

  return (
    <section className="space-overview" aria-label="记忆空间总览">
      <div className="space-overview-head">
        <div>
          <strong>记忆空间</strong>
          <span>
            当前角色：{currentCharacter?.name ?? '未选择'}。关系和角色私有记忆只在对应角色聊天时被想起。
          </span>
        </div>
        <Database size={18} />
      </div>
      <div className="space-stats">
        <SpaceStat label="全局" value={globalCount} />
        <SpaceStat label="当前角色" value={roleScopedCount} />
        <SpaceStat label="项目" value={projectCount} />
        <SpaceStat label="世界" value={worldCount} />
      </div>
      {misplacedRelationships.length > 0 && (
        <div className="space-warning">
          有 {misplacedRelationships.length} 条关系记忆还在全局空间，建议移到具体角色，避免串戏。
        </div>
      )}
    </section>
  )
}

function SpaceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MemoryCandidateReview({
  candidates,
  characters,
  onArchive,
  onConfirm,
  onEdit,
  onOpen,
  onTrash,
}: {
  candidates: LongTermMemory[]
  characters: CharacterCard[]
  onArchive: (memory: LongTermMemory) => void
  onConfirm: (memory: LongTermMemory) => void
  onEdit: (memory: LongTermMemory) => void
  onOpen: (memory: LongTermMemory) => void
  onTrash: (memory: LongTermMemory) => void
}) {
  if (candidates.length === 0) {
    return (
      <section className="candidate-review empty-review" aria-label="候选记忆审核中心">
        <div className="candidate-review-head">
          <div>
            <strong>候选记忆审核</strong>
            <span>暂时没有等妹妹拍板的记忆。关系和低确定性内容会先来这里排队。</span>
          </div>
          <CheckCircle2 size={18} />
        </div>
      </section>
    )
  }

  return (
    <section className="candidate-review" aria-label="候选记忆审核中心">
      <div className="candidate-review-head">
        <div>
          <strong>候选记忆审核</strong>
          <span>{candidates.length} 条记忆等妹妹确认，确认前不会进入聊天提示。</span>
        </div>
        <ShieldCheck size={18} />
      </div>
      <div className="candidate-list">
        {candidates.map((memory) => (
          <article className="candidate-card" key={memory.id}>
            <div className="candidate-card-head">
              <strong>{memory.title}</strong>
              <span>{Math.round(memory.confidence * 100)}%</span>
            </div>
            <div className="memory-meta">
              <span>{memoryKindLabels[memory.kind]}</span>
              <span>{formatScopeDisplay(memory.scope, characters)}</span>
              <span>{memorySensitivityLabels[memory.sensitivity]}</span>
              <span>{memoryMentionPolicyLabels[memory.mentionPolicy]}</span>
              {isCoolingDown(memory.cooldownUntil) && <span>冷却中</span>}
              <span>来源 {memory.sources.length}</span>
            </div>
            <p>{memory.body}</p>
            <footer>{memory.tags.join(' / ')}</footer>
            <div className="item-actions">
              <IconTextButton icon={<CheckCircle2 size={16} />} label="保存生效" onClick={() => onConfirm(memory)} />
              <IconTextButton icon={<FileText size={16} />} label="看档案" onClick={() => onOpen(memory)} />
              <IconTextButton icon={<Pencil size={16} />} label="先编辑" onClick={() => onEdit(memory)} />
              <IconTextButton icon={<ArchiveRestore size={16} />} label="暂存归档" onClick={() => onArchive(memory)} />
              <IconTextButton danger icon={<Trash2 size={16} />} label="删除" onClick={() => onTrash(memory)} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function MemoryDiagnostics({
  activeCharacterId,
  conflicts,
  memories,
  onUpdateMemory,
  usageLogs,
}: {
  activeCharacterId: string
  conflicts: MemoryConflict[]
  memories: LongTermMemory[]
  onUpdateMemory: (memory: LongTermMemory) => void
  usageLogs: MemoryUsageLog[]
}) {
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]))
  const memoryTitleById = new Map(memories.map((memory) => [memory.id, memory.title]))
  const recentLogs = usageLogs.slice(0, 4)

  function fixScopeConflict(conflict: MemoryConflict) {
    const memory = memoryById.get(conflict.memoryIds[0])
    if (!memory || memory.kind !== 'relationship') return
    onUpdateMemory({
      ...memory,
      scope: { kind: 'relationship', characterId: activeCharacterId },
      userEdited: true,
    })
  }

  function archiveDuplicate(conflict: MemoryConflict) {
    const memory = memoryById.get(conflict.memoryIds[1])
    if (!memory) return
    onUpdateMemory({
      ...memory,
      status: 'archived',
      userEdited: true,
    })
  }

  return (
    <section className="memory-diagnostics" aria-label="记忆透明日志">
      <div className="diagnostic-column">
        <h3>
          <AlertTriangle size={15} />
          冲突提醒
        </h3>
        {conflicts.length === 0 ? (
          <p>没有发现明显冲突。后面记忆变多时，姐姐会继续盯着。</p>
        ) : (
          conflicts.slice(0, 4).map((conflict) => (
            <article className="diagnostic-item warning" key={conflict.id}>
              <strong>{conflict.title}</strong>
              <span>{conflict.description}</span>
              <small>{conflict.suggestedResolution}</small>
              <footer>
                {conflict.memoryIds.map((id) => memoryTitleById.get(id) ?? '已删除记忆').join(' / ')}
              </footer>
              <div className="conflict-actions">
                {conflict.conflictType === 'scope' && (
                  <button onClick={() => fixScopeConflict(conflict)} type="button">
                    移到当前角色关系
                  </button>
                )}
                {conflict.conflictType === 'duplicate' && conflict.memoryIds.length > 1 && (
                  <button onClick={() => archiveDuplicate(conflict)} type="button">
                    归档后一条
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      <div className="diagnostic-column">
        <h3>
          <ClipboardList size={15} />
          最近调用
        </h3>
        {recentLogs.length === 0 ? (
          <p>还没有聊天调用日志。发送一条消息后，这里会显示本次用了哪些记忆。</p>
        ) : (
          recentLogs.map((log) => (
            <article className="diagnostic-item" key={log.id}>
              <strong>{formatShortTime(log.createdAt)}</strong>
              <span>
                {log.memoryIds.length > 0
                  ? `使用 ${log.memoryIds.length} 条记忆：${log.memoryIds
                      .slice(0, 4)
                      .map((id) => memoryTitleById.get(id) ?? '已删除记忆')
                      .join(' / ')}`
                  : '这次没有注入长期记忆，只用了最近对话。'}
              </span>
              {log.contextBlockTitles.length > 0 && <small>{log.contextBlockTitles.join(' / ')}</small>}
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function MemoryArchiveModal({
  characters,
  memory,
  onClose,
  onEdit,
  onRestoreRevision,
  onTrash,
  usageLogs,
}: {
  characters: CharacterCard[]
  memory: LongTermMemory
  onClose: () => void
  onEdit: (memory: LongTermMemory) => void
  onRestoreRevision: (memoryId: string, revisionId: string) => void
  onTrash: (memory: LongTermMemory) => void
  usageLogs: MemoryUsageLog[]
}) {
  const relatedLogs = usageLogs.filter((log) => log.memoryIds.includes(memory.id)).slice(0, 8)

  return (
    <div className="archive-backdrop" role="dialog" aria-modal="true" aria-label={`${memory.title} 记忆档案`}>
      <section className="archive-modal">
        <header className="archive-head">
          <div>
            <span>记忆档案</span>
            <h2>{memory.title}</h2>
          </div>
          <button aria-label="关闭记忆档案" className="icon-button archive-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="archive-meta-grid">
          <ArchiveMetric label="类型" value={memoryKindLabels[memory.kind]} />
          <ArchiveMetric label="状态" value={memoryStatusLabels[memory.status]} />
          <ArchiveMetric label="空间" value={formatScopeDisplay(memory.scope, characters)} />
          <ArchiveMetric label="敏感度" value={memorySensitivityLabels[memory.sensitivity]} />
          <ArchiveMetric label="提及时机" value={memoryMentionPolicyLabels[memory.mentionPolicy]} />
          <ArchiveMetric label="可信度" value={`${Math.round(memory.confidence * 100)}%`} />
          <ArchiveMetric label="权重" value={`${memory.priority}`} />
          <ArchiveMetric label="调用" value={`${memory.accessCount}`} />
          <ArchiveMetric
            label="冷却"
            value={memory.cooldownUntil ? (isCoolingDown(memory.cooldownUntil) ? formatShortTime(memory.cooldownUntil) : '已结束') : '无'}
          />
          <ArchiveMetric label="来源" value={`${memory.sources.length}`} />
        </div>

        <div className="archive-body">
          <section className="archive-section archive-main-text">
            <h3>
              <BookOpen size={15} />
              内容
            </h3>
            <p>{memory.body}</p>
            <footer>{memory.tags.length > 0 ? memory.tags.join(' / ') : '没有标签'}</footer>
          </section>

          <section className="archive-section">
            <h3>
              <ShieldCheck size={15} />
              来源证据
            </h3>
            {memory.sources.length === 0 ? (
              <p className="archive-muted">这条记忆还没有来源证据。</p>
            ) : (
              <div className="archive-timeline">
                {memory.sources.map((source) => (
                  <article key={source.id}>
                    <strong>{formatSourceTitle(source.kind, source.role)}</strong>
                    <span>{formatShortTime(source.createdAt)}</span>
                    <p>{source.excerpt}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="archive-section">
            <h3>
              <History size={15} />
              版本线
            </h3>
            <div className="archive-timeline">
              {memory.revisions
                .slice()
                .reverse()
                .slice(0, 8)
                .map((revision) => (
                  <article key={revision.id}>
                    <strong>{revision.reason}</strong>
                    <span>
                      {formatShortTime(revision.createdAt)} / {revision.editor}
                    </span>
                    <p>{revision.snapshot.title}</p>
                    <button onClick={() => onRestoreRevision(memory.id, revision.id)} type="button">
                      回滚到此版
                    </button>
                  </article>
                ))}
            </div>
          </section>

          <section className="archive-section">
            <h3>
              <ClipboardList size={15} />
              调用记录
            </h3>
            {relatedLogs.length === 0 ? (
              <p className="archive-muted">还没有聊天回复调用过这条记忆。</p>
            ) : (
              <div className="archive-timeline">
                {relatedLogs.map((log) => (
                  <article key={log.id}>
                    <strong>{formatShortTime(log.createdAt)}</strong>
                    <span>{log.contextBlockTitles.join(' / ') || '长期记忆'}</span>
                    <p>这次回复共注入 {log.memoryIds.length} 条长期记忆。</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="archive-actions">
          <IconTextButton icon={<Pencil size={16} />} label="编辑记忆" onClick={() => onEdit(memory)} />
          <IconTextButton danger icon={<Trash2 size={16} />} label="删除" onClick={() => onTrash(memory)} />
        </footer>
      </section>
    </div>
  )
}

function ArchiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="archive-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function WorkspaceTitle({
  description,
  icon,
  title,
}: {
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <header className="workspace-title">
      <div className="workspace-title-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}

function IconTextButton({
  danger = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={`mini-action ${danger ? 'danger-action' : ''}`} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
    </button>
  )
}

function RetentionButton({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean
  description: string
  label: string
  onClick: () => void
}) {
  return (
    <button className={`retention-button ${active ? 'active' : ''}`} onClick={onClick} type="button">
      <strong>{label}</strong>
      <small>{description}</small>
    </button>
  )
}

function ScopeEditor({
  activeCharacterId,
  activeConversationId,
  characters,
  draft,
  onChange,
  worldNodes,
}: {
  activeCharacterId: string
  activeConversationId: string
  characters: CharacterCard[]
  draft: MemoryDraft
  onChange: (draft: MemoryDraft) => void
  worldNodes: WorldNode[]
}) {
  function updateScopeKind(scopeKind: MemoryScope['kind']) {
    onChange({
      ...draft,
      scopeKind,
      characterId: draft.characterId || activeCharacterId,
      conversationId: draft.conversationId || activeConversationId,
      projectId: draft.projectId || defaultProjectId,
      worldId: draft.worldId || worldNodes[0]?.id || defaultProjectId,
      branchId: draft.branchId || 'main',
    })
  }

  return (
    <section className="scope-editor" aria-label="记忆空间编辑器">
      <div className="scope-editor-head">
        <strong>记忆空间</strong>
        <span>{getScopeHint(draft.scopeKind)}</span>
      </div>
      <div className="scope-grid">
        <label>
          <span>归属</span>
          <select
            onChange={(event) => updateScopeKind(event.target.value as MemoryScope['kind'])}
            value={draft.scopeKind}
          >
            {memoryScopeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {(draft.scopeKind === 'relationship' || draft.scopeKind === 'character_private') && (
          <label>
            <span>角色</span>
            <select
              onChange={(event) => onChange({ ...draft, characterId: event.target.value })}
              value={draft.characterId || activeCharacterId}
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {(draft.scopeKind === 'world' || draft.scopeKind === 'world_branch') && (
          <label>
            <span>世界</span>
            <select
              onChange={(event) => onChange({ ...draft, worldId: event.target.value })}
              value={draft.worldId || worldNodes[0]?.id || defaultProjectId}
            >
              {[...worldNodes.map((node) => ({ id: node.id, title: node.title })), { id: defaultProjectId, title: brand.nameEn }]
                .filter((option, index, options) => options.findIndex((item) => item.id === option.id) === index)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
            </select>
          </label>
        )}

        {draft.scopeKind === 'world_branch' && (
          <label>
            <span>分支</span>
            <input
              onChange={(event) => onChange({ ...draft, branchId: event.target.value })}
              placeholder="main / draft / CP-01"
              value={draft.branchId}
            />
          </label>
        )}

        {draft.scopeKind === 'project' && (
          <label>
            <span>项目</span>
            <input
              onChange={(event) => onChange({ ...draft, projectId: event.target.value })}
              placeholder={defaultProjectId}
              value={draft.projectId}
            />
          </label>
        )}

        {draft.scopeKind === 'conversation' && (
          <label>
            <span>会话</span>
            <input
              onChange={(event) => onChange({ ...draft, conversationId: event.target.value })}
              value={draft.conversationId || activeConversationId}
            />
          </label>
        )}
      </div>
    </section>
  )
}

function MemoryScopeQuickActions({
  activeCharacterId,
  memory,
  onUpdateMemory,
}: {
  activeCharacterId: string
  memory: LongTermMemory
  onUpdateMemory: (memory: LongTermMemory) => void
}) {
  const actions: Array<{ label: string; scope: MemoryScope }> = []

  if (
    memory.kind === 'relationship' &&
    (memory.scope.kind !== 'relationship' || memory.scope.characterId !== activeCharacterId)
  ) {
    actions.push({ label: '当前角色关系', scope: { kind: 'relationship', characterId: activeCharacterId } })
  }

  if (
    memory.kind === 'character' &&
    (memory.scope.kind !== 'character_private' || memory.scope.characterId !== activeCharacterId)
  ) {
    actions.push({ label: '当前角色私有', scope: { kind: 'character_private', characterId: activeCharacterId } })
  }

  if (
    (memory.kind === 'project' || memory.kind === 'procedure') &&
    !(memory.scope.kind === 'project' && memory.scope.projectId === defaultProjectId)
  ) {
    actions.push({ label: '项目空间', scope: { kind: 'project', projectId: defaultProjectId } })
  }

  if (memory.scope.kind !== 'global_user' && !['relationship', 'character'].includes(memory.kind)) {
    actions.push({ label: '设为全局', scope: { kind: 'global_user' } })
  }

  if (actions.length === 0) return null

  return (
    <>
      {actions.slice(0, 2).map((action) => (
        <IconTextButton
          icon={<Database size={16} />}
          key={action.label}
          label={action.label}
          onClick={() => onUpdateMemory({ ...memory, scope: action.scope, userEdited: true })}
        />
      ))}
    </>
  )
}

function MemoryMentionQuickActions({
  memory,
  onUpdateMemory,
}: {
  memory: LongTermMemory
  onUpdateMemory: (memory: LongTermMemory) => void
}) {
  const actions: Array<{ label: string; patch: Partial<LongTermMemory> }> = []

  if (memory.mentionPolicy !== 'contextual' && !['taboo', 'safety'].includes(memory.kind)) {
    actions.push({ label: '相关时提', patch: { mentionPolicy: 'contextual' } })
  }

  if (memory.sensitivity === 'high' && memory.mentionPolicy !== 'explicit' && !['taboo', 'safety'].includes(memory.kind)) {
    actions.push({ label: '问起再提', patch: { mentionPolicy: 'explicit' } })
  }

  if (!memory.cooldownUntil || !isCoolingDown(memory.cooldownUntil)) {
    actions.push({ label: '冷却7天', patch: { cooldownUntil: addDaysIso(7) } })
  } else {
    actions.push({ label: '解除冷却', patch: { cooldownUntil: undefined } })
  }

  return (
    <>
      {actions.slice(0, 2).map((action) => (
        <IconTextButton
          icon={<ShieldCheck size={16} />}
          key={action.label}
          label={action.label}
          onClick={() => onUpdateMemory({ ...memory, ...action.patch, userEdited: true })}
        />
      ))}
    </>
  )
}

function splitList(value: string): string[] {
  return value
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

function formatShortTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCloudTime(value: string | null): string {
  if (!value) return '暂无记录'
  return formatShortTime(value)
}

function getCloudBusyLabel(cloudBusy: 'checking' | 'pulling' | 'pushing'): string {
  if (cloudBusy === 'checking') return '正在检查云端...'
  if (cloudBusy === 'pulling') return '正在读取云端，当前本机数据会先自动备份'
  return '正在保存到云端...'
}

function formatBackupCounts(backup: LocalBackupSummary): string {
  return [
    `${backup.counts.memories} 条记忆`,
    `${backup.counts.worldNodes} 个世界树节点`,
    `${backup.counts.conversations} 个会话`,
    `${backup.counts.trashedItems} 个回收项`,
  ].join(' / ')
}

function formatDeletedAt(value: string): string {
  return `删除于 ${formatShortTime(value)}`
}

function isCoolingDown(value?: string): boolean {
  if (!value) return false
  const time = new Date(value).getTime()
  return !Number.isNaN(time) && time > Date.now()
}

function addDaysIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function isoToLocalInput(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function localInputToIso(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function formatSourceTitle(kind: string, role?: string): string {
  if (kind === 'message') return role === 'user' ? '用户聊天原文' : '聊天消息'
  if (kind === 'manual') return '手动整理'
  if (kind === 'summary') return '会话摘要'
  if (kind === 'system') return '系统种子'
  return kind
}

function scopeToDraft(scope: MemoryScope): Pick<
  MemoryDraft,
  'scopeKind' | 'characterId' | 'worldId' | 'branchId' | 'projectId' | 'conversationId'
> {
  switch (scope.kind) {
    case 'character_private':
    case 'relationship':
      return {
        scopeKind: scope.kind,
        characterId: scope.characterId,
        worldId: defaultProjectId,
        branchId: 'main',
        projectId: defaultProjectId,
        conversationId: '',
      }
    case 'world':
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: scope.worldId,
        branchId: 'main',
        projectId: defaultProjectId,
        conversationId: '',
      }
    case 'world_branch':
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: scope.worldId,
        branchId: scope.branchId,
        projectId: defaultProjectId,
        conversationId: '',
      }
    case 'project':
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: defaultProjectId,
        branchId: 'main',
        projectId: scope.projectId,
        conversationId: '',
      }
    case 'conversation':
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: defaultProjectId,
        branchId: 'main',
        projectId: defaultProjectId,
        conversationId: scope.conversationId,
      }
    case 'temporary':
    case 'global_user':
    default:
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: defaultProjectId,
        branchId: 'main',
        projectId: defaultProjectId,
        conversationId: '',
      }
  }
}

function draftToScope(
  draft: MemoryDraft,
  activeCharacterId: string,
  activeConversationId: string,
): MemoryScope {
  switch (draft.scopeKind) {
    case 'relationship':
      return { kind: 'relationship', characterId: draft.characterId || activeCharacterId }
    case 'character_private':
      return { kind: 'character_private', characterId: draft.characterId || activeCharacterId }
    case 'world':
      return { kind: 'world', worldId: draft.worldId.trim() || defaultProjectId }
    case 'world_branch':
      return {
        kind: 'world_branch',
        worldId: draft.worldId.trim() || defaultProjectId,
        branchId: draft.branchId.trim() || 'main',
      }
    case 'project':
      return { kind: 'project', projectId: draft.projectId.trim() || defaultProjectId }
    case 'conversation':
      return { kind: 'conversation', conversationId: draft.conversationId.trim() || activeConversationId }
    case 'temporary':
      return { kind: 'temporary' }
    case 'global_user':
    default:
      return { kind: 'global_user' }
  }
}

function formatScopeDisplay(scope: MemoryScope, characters: CharacterCard[]): string {
  const characterName = (characterId: string) =>
    characters.find((character) => character.id === characterId)?.name ?? characterId

  switch (scope.kind) {
    case 'character_private':
      return `角色私有：${characterName(scope.characterId)}`
    case 'relationship':
      return `关系：${characterName(scope.characterId)}`
    case 'world':
      return `世界：${scope.worldId}`
    case 'world_branch':
      return `世界分支：${scope.worldId}/${scope.branchId}`
    case 'project':
      return `项目：${scope.projectId}`
    case 'conversation':
      return `会话：${scope.conversationId.slice(0, 12)}`
    case 'temporary':
      return '临时'
    case 'global_user':
    default:
      return formatMemoryScopeLabel(scope)
  }
}

function getScopeHint(scopeKind: MemoryScope['kind']): string {
  switch (scopeKind) {
    case 'global_user':
      return '所有角色都能看见，适合语言、UI、长期偏好。'
    case 'relationship':
      return '只属于用户和某个角色的相处方式、称呼、默契。'
    case 'character_private':
      return '只给某个角色知道，适合角色设定和私有剧情。'
    case 'project':
      return `属于 ${brand.nameEn} 或其他长期项目的决策。`
    case 'world':
      return '属于世界观正史，不要写入现实用户画像。'
    case 'world_branch':
      return '属于某条时间线或草稿分支，避免污染正史。'
    case 'conversation':
      return '只在当前会话里有效，适合临时上下文。'
    case 'temporary':
      return '不会进入长期聊天提示，适合临时停放。'
    default:
      return '选择这条记忆该被谁看见。'
  }
}
