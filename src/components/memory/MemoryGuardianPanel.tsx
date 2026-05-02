import { Activity, Clock3, Eye, FileWarning, History, ListChecks, Pencil, ShieldCheck, TimerReset } from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  AppTrash,
  CharacterCard,
  LongTermMemory,
  MemoryConflict,
  MemoryEvent,
  MemoryUsageLog,
} from '../../domain/types'
import {
  buildMemoryGuardianReport,
  type MemoryGuardianSeverity,
  type MemoryTimelineKind,
} from '../../services/memoryGuardian'
import { formatScopeDisplay, formatShortTime } from './memoryPanelUtils'

interface MemoryGuardianPanelProps {
  activeCharacterId: string
  characters: CharacterCard[]
  conflicts: MemoryConflict[]
  memoryEvents: MemoryEvent[]
  memories: LongTermMemory[]
  trash: AppTrash
  usageLogs: MemoryUsageLog[]
  onEditMemory: (memory: LongTermMemory) => void
  onOpenMemory: (memory: LongTermMemory) => void
  onUpdateMemory: (memory: LongTermMemory) => void
}

const timelineKindLabels: Record<MemoryTimelineKind, string> = {
  called: '调用',
  candidate: '候选',
  created: '写入',
  deleted: '删除',
  event: '事件',
  review: '复查',
  updated: '更新',
}

export function MemoryGuardianPanel({
  activeCharacterId,
  characters,
  conflicts,
  memoryEvents,
  memories,
  trash,
  usageLogs,
  onEditMemory,
  onOpenMemory,
  onUpdateMemory,
}: MemoryGuardianPanelProps) {
  const report = buildMemoryGuardianReport({ memories, conflicts, memoryEvents, usageLogs, trash })
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]))
  const currentCharacter = characters.find((character) => character.id === activeCharacterId)
  const visibleReviewItems = report.reviewItems.slice(0, 3)
  const hiddenReviewCount = Math.max(0, report.reviewItems.length - visibleReviewItems.length)
  const visibleTimelineItems = report.timelineItems.slice(0, 5)
  const hiddenTimelineCount = Math.max(0, report.timelineItems.length - visibleTimelineItems.length)
  const hasReviewItems = report.reviewItems.length > 0

  function updateMemory(memoryId: string, patch: Partial<LongTermMemory>) {
    const memory = memoryById.get(memoryId)
    if (!memory) return
    onUpdateMemory({
      ...memory,
      ...patch,
      userEdited: true,
    })
  }

  return (
    <section className={`memory-guardian ${hasReviewItems ? 'has-review' : 'no-review'}`} aria-label="记忆守护台">
      <div className="memory-guardian-head">
        <div>
          <strong>记忆守护台</strong>
          <span>
            健康度 {report.summary.healthScore} / 100，当前是{currentCharacter?.name ?? '当前角色'}的记忆视角。
          </span>
        </div>
        <div className="guardian-score" data-state={getScoreState(report.summary.healthScore)}>
          <span>{report.summary.healthLabel}</span>
          <strong>{report.summary.healthScore}</strong>
        </div>
      </div>

      <div className="guardian-lanes">
        {report.lanes.map((lane) => (
          <div className="guardian-lane" key={lane.id}>
            <span>{lane.label}</span>
            <strong>{lane.count}</strong>
            <small>{lane.description}</small>
          </div>
        ))}
      </div>

      {!hasReviewItems && <p className="guardian-empty guardian-empty-inline">没有需要立刻复查的记忆。</p>}

      <div className="guardian-columns">
        {hasReviewItems && (
          <div className="guardian-column">
          <GuardianColumnTitle icon={<ListChecks size={15} />} title="复查队列" />
            {visibleReviewItems.map((item) => {
              const memory = memoryById.get(item.memoryId)
              return (
                <article className={`guardian-review ${item.severity}`} key={item.id}>
                  <div className="guardian-review-head">
                    <span>{getSeverityLabel(item.severity)}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <p>{item.detail}</p>
                  <small>{item.suggestedAction}</small>
                  {memory && (
                    <footer>
                      <button onClick={() => onOpenMemory(memory)} type="button">
                        <Eye size={14} />
                        档案
                      </button>
                      <button onClick={() => onEditMemory(memory)} type="button">
                        <Pencil size={14} />
                        编辑
                      </button>
                      {memory.sensitivity === 'high' && memory.mentionPolicy !== 'explicit' && (
                        <button onClick={() => updateMemory(memory.id, { mentionPolicy: 'explicit' })} type="button">
                          <ShieldCheck size={14} />
                          问起再提
                        </button>
                      )}
                      {!isCoolingDown(memory.cooldownUntil) && (
                        <button onClick={() => updateMemory(memory.id, { cooldownUntil: addDaysIso(7) })} type="button">
                          <TimerReset size={14} />
                          冷却7天
                        </button>
                      )}
                    </footer>
                  )}
                </article>
              )
            })}
            {hiddenReviewCount > 0 && <p className="guardian-more">还有 {hiddenReviewCount} 项复查留在后面。</p>}
          </div>
        )}

        <div className="guardian-column">
          <GuardianColumnTitle icon={<History size={15} />} title="记忆事件账本" />
          {report.timelineItems.length === 0 ? (
            <p className="guardian-empty">还没有记忆活动。</p>
          ) : (
            <div className="guardian-timeline">
              {visibleTimelineItems.map((item) => {
                const memory = item.memoryId ? memoryById.get(item.memoryId) : null
                return (
                  <article className="guardian-timeline-item" key={item.id}>
                    <div className="timeline-dot" data-kind={item.kind}>
                      {getTimelineIcon(item.kind)}
                    </div>
                    <div>
                      <div className="timeline-title">
                        <span>{timelineKindLabels[item.kind]}</span>
                        <strong>{item.title}</strong>
                      </div>
                      <p>{item.detail}</p>
                      <small>
                        {formatShortTime(item.at)}
                        {memory ? ` / ${formatScopeDisplay(memory.scope, characters)}` : ''}
                      </small>
                    </div>
                  </article>
                )
              })}
              {hiddenTimelineCount > 0 && <p className="guardian-more">还有 {hiddenTimelineCount} 条更早的事件已自动收起。</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function GuardianColumnTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h3 className="guardian-column-title">
      {icon}
      {title}
    </h3>
  )
}

function getScoreState(score: number): 'good' | 'fair' | 'weak' {
  if (score >= 82) return 'good'
  if (score >= 62) return 'fair'
  return 'weak'
}

function getSeverityLabel(severity: MemoryGuardianSeverity): string {
  if (severity === 'danger') return '高优先'
  if (severity === 'warning') return '待确认'
  return '可观察'
}

function getTimelineIcon(kind: MemoryTimelineKind) {
  if (kind === 'called') return <Activity size={13} />
  if (kind === 'deleted') return <FileWarning size={13} />
  return <Clock3 size={13} />
}

function addDaysIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function isCoolingDown(cooldownUntil?: string): boolean {
  if (!cooldownUntil) return false
  const time = new Date(cooldownUntil).getTime()
  return !Number.isNaN(time) && time > Date.now()
}
