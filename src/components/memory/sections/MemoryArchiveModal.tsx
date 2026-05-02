import { BookOpen, ClipboardList, History, Pencil, ShieldCheck, Trash2, X } from 'lucide-react'
import type { CharacterCard, LongTermMemory, MemoryUsageLog } from '../../../domain/types'
import {
  memoryKindLabels,
  memoryLayerLabels,
  memoryMentionPolicyLabels,
  memorySensitivityLabels,
  memoryStatusLabels,
} from '../../../domain/memoryLabels'
import { ArchiveMetric, IconTextButton } from '../atoms'
import { formatScopeDisplay, formatShortTime, formatSourceTitle, isCoolingDown } from '../memoryPanelUtils'

export function MemoryArchiveModal({
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
          <ArchiveMetric label="层级" value={memoryLayerLabels[memory.layer]} />
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
