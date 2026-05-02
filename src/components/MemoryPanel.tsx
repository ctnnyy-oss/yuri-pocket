import {
  ArchiveRestore,
  BookOpen,
  Database,
  FileText,
  History,
  Keyboard,
  Link2,
  Palette,
  Pencil,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type {
  AccentTheme,
  AppSettings,
  AppTrash,
  CharacterCard,
  LocalBackupSummary,
  LongTermMemory,
  MemoryConflict,
  MemoryEvent,
  MemoryKind,
  MemoryLayer,
  MemoryMentionPolicy,
  MemorySensitivity,
  MemoryStatus,
  MemoryUsageLog,
  ModelProfileInput,
  ModelProfileSummary,
  WorldNode,
} from '../domain/types'
import type { CloudBackupSummary, CloudMetadata } from '../services/cloudSync'
import {
  memoryKindLabels,
  memoryLayerLabels,
  memoryMentionPolicyLabels,
  memorySensitivityLabels,
  memoryStatusLabels,
} from '../domain/memoryLabels'
import type { MemoryDraft, WorldDraft } from './memory/memoryPanelTypes'
import { MemoryGuardianPanel } from './memory/MemoryGuardianPanel'
import { MemoryScopeEditor } from './memory/MemoryScopeEditor'
import {
  EmptyState,
  IconTextButton,
  MemoryLayerQuickActions,
  MemoryMentionQuickActions,
  MemoryScopeQuickActions,
  RetentionButton,
  WorkspaceTitle,
} from './memory/atoms'
import { MemoryArchiveModal } from './memory/sections/MemoryArchiveModal'
import { MemoryCandidateReview } from './memory/sections/MemoryCandidateReview'
import { MemoryDiagnostics } from './memory/sections/MemoryDiagnostics'
import { MemoryGardenInsight } from './memory/sections/MemoryGardenInsight'
import { MemorySpaceOverview } from './memory/sections/MemorySpaceOverview'
import { ModelAndDataPanel } from './model/ModelAndDataPanel'
import {
  clamp,
  draftToScope,
  formatDeletedAt,
  formatScopeDisplay,
  formatShortTime,
  isCoolingDown,
  isoToLocalInput,
  localInputToIso,
  scopeToDraft,
  splitList,
} from './memory/memoryPanelUtils'
import type { AppView } from './CharacterRail'

interface MemoryPanelProps {
  memories: LongTermMemory[]
  memoryConflicts: MemoryConflict[]
  memoryEvents: MemoryEvent[]
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
  modelProfiles: ModelProfileSummary[]
  modelProfileStatus: string
  modelProfileBusy: boolean
  onRefreshModelProfiles: () => void
  onSaveModelProfile: (profile: ModelProfileInput) => Promise<void>
  onDeleteModelProfile: (profileId: string) => Promise<void>
  onTestModelProfile: (input: { profileId?: string; profile?: ModelProfileInput }) => Promise<void>
  cloudStatus: string
  cloudMeta: CloudMetadata | null
  cloudBusy: 'checking' | 'pulling' | 'pushing' | 'backing-up' | null
  cloudBackups: CloudBackupSummary[]
  cloudSyncConfigured: boolean
  onConnectCloud: () => void
  onPullCloud: () => void
  onPushCloud: () => void
  onRefreshCloud: () => void
  onCreateCloudBackup: () => void
  onDownloadCloudBackup: (fileName: string) => void
  onRefreshCloudBackups: () => void
  localBackups: LocalBackupSummary[]
  onCreateLocalBackup: () => void
  onRestoreLocalBackup: (backupId: string) => void
  onDeleteLocalBackup: (backupId: string) => void
}

const accentThemes: Array<{ id: AccentTheme; label: string; color: string }> = [
  { id: 'sakura', label: '雾粉', color: '#d97798' },
  { id: 'peach', label: '蜜桃', color: '#df8a78' },
  { id: 'lavender', label: '淡紫', color: '#a88ad8' },
  { id: 'mint', label: '薄荷', color: '#74a695' },
]

const memoryKindOptions = Object.keys(memoryKindLabels) as MemoryKind[]
const memoryLayerOptions = Object.keys(memoryLayerLabels) as MemoryLayer[]
const memoryStatusOptions = Object.keys(memoryStatusLabels).filter(
  (status) => status !== 'trashed' && status !== 'permanently_deleted',
) as MemoryStatus[]
const memorySensitivityOptions = Object.keys(memorySensitivityLabels) as MemorySensitivity[]
const memoryMentionPolicyOptions = Object.keys(memoryMentionPolicyLabels) as MemoryMentionPolicy[]
export function MemoryPanel({
  memories,
  memoryConflicts,
  memoryEvents,
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
  modelProfiles,
  modelProfileStatus,
  modelProfileBusy,
  onRefreshModelProfiles,
  onSaveModelProfile,
  onDeleteModelProfile,
  onTestModelProfile,
  cloudStatus,
  cloudMeta,
  cloudBusy,
  cloudBackups,
  cloudSyncConfigured,
  onConnectCloud,
  onPullCloud,
  onPushCloud,
  onRefreshCloud,
  onCreateCloudBackup,
  onDownloadCloudBackup,
  onRefreshCloudBackups,
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
      layer: memory.layer,
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
      layer: memoryDraft.layer,
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
          <MemoryGuardianPanel
            activeCharacterId={activeCharacterId}
            characters={characters}
            conflicts={memoryConflicts}
            memoryEvents={memoryEvents}
            memories={memories}
            onEditMemory={startMemoryEdit}
            onOpenMemory={(memory) => setSelectedMemoryId(memory.id)}
            onUpdateMemory={onUpdateMemory}
            trash={trash}
            usageLogs={memoryUsageLogs}
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
                    <MemoryScopeEditor
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
                        <span>层级</span>
                        <select
                          onChange={(event) =>
                            setMemoryDraft({ ...memoryDraft, layer: event.target.value as MemoryLayer })
                          }
                          value={memoryDraft.layer}
                        >
                          {memoryLayerOptions.map((layer) => (
                            <option key={layer} value={layer}>
                              {memoryLayerLabels[layer]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="edit-row">
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
                      <span>{memoryLayerLabels[memory.layer]}</span>
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
                      <MemoryLayerQuickActions memory={memory} onUpdateMemory={onUpdateMemory} />
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
        <ModelAndDataPanel
          cloudBackups={cloudBackups}
          cloudBusy={cloudBusy}
          cloudMeta={cloudMeta}
          cloudStatus={cloudStatus}
          cloudSyncConfigured={cloudSyncConfigured}
          localBackups={localBackups}
          modelProfileBusy={modelProfileBusy}
          modelProfileStatus={modelProfileStatus}
          modelProfiles={modelProfiles}
          onConnectCloud={onConnectCloud}
          onCreateCloudBackup={onCreateCloudBackup}
          onCreateLocalBackup={onCreateLocalBackup}
          onDeleteLocalBackup={onDeleteLocalBackup}
          onDeleteModelProfile={onDeleteModelProfile}
          onDownloadCloudBackup={onDownloadCloudBackup}
          onExport={onExport}
          onImport={onImport}
          onPullCloud={onPullCloud}
          onPushCloud={onPushCloud}
          onRefreshCloud={onRefreshCloud}
          onRefreshCloudBackups={onRefreshCloudBackups}
          onRefreshModelProfiles={onRefreshModelProfiles}
          onReset={onReset}
          onRestoreLocalBackup={onRestoreLocalBackup}
          onSaveModelProfile={onSaveModelProfile}
          onTestModelProfile={onTestModelProfile}
          onUpdateSettings={onUpdateSettings}
          settings={settings}
        />
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
