import { FileText, History, Link2, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import type { CharacterCard, LongTermMemory, WorldNode } from '../../domain/types'
import {
  memoryKindLabels,
  memoryLayerLabels,
  memoryMentionPolicyLabels,
  memorySensitivityLabels,
  memoryStatusLabels,
} from '../../domain/memoryLabels'
import {
  EmptyState,
  IconTextButton,
  MemoryLayerQuickActions,
  MemoryMentionQuickActions,
  MemoryScopeQuickActions,
} from './atoms'
import { MemoryEditForm } from './MemoryEditForm'
import type { MemoryDraft } from './memoryPanelTypes'
import { formatScopeDisplay, formatShortTime, isCoolingDown } from './memoryPanelUtils'

interface MemoryListProps {
  activeCharacterId: string
  activeConversationId: string
  characters: CharacterCard[]
  editingMemoryId: string | null
  memories: LongTermMemory[]
  memoryDraft: MemoryDraft | null
  onCancelEdit: () => void
  onDraftChange: (draft: MemoryDraft) => void
  onOpenMemory: (memoryId: string) => void
  onRestoreMemoryRevision: (memoryId: string, revisionId: string) => void
  onSaveMemory: (memory: LongTermMemory) => void
  onStartMemoryEdit: (memory: LongTermMemory) => void
  onTrashMemory: (memoryId: string) => void
  onUpdateMemory: (memory: LongTermMemory) => void
  reviewedMemories: LongTermMemory[]
  worldNodes: WorldNode[]
}

export function MemoryList({
  activeCharacterId,
  activeConversationId,
  characters,
  editingMemoryId,
  memories,
  memoryDraft,
  onCancelEdit,
  onDraftChange,
  onOpenMemory,
  onRestoreMemoryRevision,
  onSaveMemory,
  onStartMemoryEdit,
  onTrashMemory,
  onUpdateMemory,
  reviewedMemories,
  worldNodes,
}: MemoryListProps) {
  return (
    <section className="panel-stack">
      {memories.length === 0 && <EmptyState text="当前没有记忆。删掉的内容可以去回收花园找回。" />}
      {memories.length > 0 && reviewedMemories.length === 0 && (
        <EmptyState text="当前只有待确认记忆。确认后，它们才会进入长期记忆列表。" />
      )}
      {reviewedMemories.map((memory) => (
        <article className="memory-item" key={memory.id}>
          {editingMemoryId === memory.id && memoryDraft ? (
            <MemoryEditForm
              activeCharacterId={activeCharacterId}
              activeConversationId={activeConversationId}
              characters={characters}
              draft={memoryDraft}
              onCancel={onCancelEdit}
              onChange={onDraftChange}
              onSave={() => onSaveMemory(memory)}
              worldNodes={worldNodes}
            />
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
                          <button onClick={() => onRestoreMemoryRevision(memory.id, revision.id)} type="button">
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
                <IconTextButton icon={<FileText size={16} />} label="档案" onClick={() => onOpenMemory(memory.id)} />
                <IconTextButton icon={<Pencil size={16} />} label="编辑" onClick={() => onStartMemoryEdit(memory)} />
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
  )
}
