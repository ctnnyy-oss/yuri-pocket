import { BrainCircuit, CheckCircle2, CircleDashed, DatabaseZap, GitPullRequest, Scissors, ShieldCheck } from 'lucide-react'
import type { LongTermMemory, MemoryEmbeddingRecord, MemoryUsageLog } from '../../../domain/types'
import { getEmbeddingCacheStats } from '../../../services/memoryEmbeddingIndex'

interface RecallStep {
  label: string
  value: string
  detail: string
  status: 'ok' | 'watch' | 'action'
}

export function MemoryRecallMap({
  memoryEmbeddings,
  memories,
  usageLogs,
}: {
  memoryEmbeddings: MemoryEmbeddingRecord[]
  memories: LongTermMemory[]
  usageLogs: MemoryUsageLog[]
}) {
  const now = new Date()
  const activeMemories = memories.filter((memory) => memory.status === 'active')
  const candidateCount = memories.filter((memory) => memory.status === 'candidate').length
  const sourcedCount = memories.filter((memory) => memory.sources.length > 0).length
  const sourceCoverage = memories.length ? Math.round((sourcedCount / memories.length) * 100) : 100
  const recentUsageCount = usageLogs.filter((log) => daysSince(log.createdAt) <= 7).length
  const recentlyUsedIds = new Set(
    usageLogs
      .filter((log) => daysSince(log.createdAt) <= 30)
      .flatMap((log) => log.memoryIds),
  )
  const staleWorkingCount = activeMemories.filter(
    (memory) => memory.layer === 'working' && daysSince(memory.updatedAt) > 7,
  ).length
  const reviewDueCount = activeMemories.filter((memory) => isReviewDue(memory.nextReviewAt, now)).length
  const embeddingStats = getEmbeddingCacheStats(memories, memoryEmbeddings)
  const embeddingCoverage = Math.round(embeddingStats.coverage * 100)
  const quietActiveCount = activeMemories.filter(
    (memory) => !memory.pinned && !recentlyUsedIds.has(memory.id) && daysSince(memory.updatedAt) > 30,
  ).length
  const cleanupCount = staleWorkingCount + quietActiveCount + reviewDueCount + memories.filter((memory) => memory.status === 'archived').length

  const steps: RecallStep[] = [
    {
      label: '捕捉',
      value: `${candidateCount}`,
      detail: candidateCount > 0 ? '候选记忆等妹妹确认' : '没有未确认候选',
      status: candidateCount > 0 ? 'action' : 'ok',
    },
    {
      label: '校准',
      value: `${sourceCoverage}%`,
      detail: '记忆带来源证据',
      status: sourceCoverage >= 80 ? 'ok' : 'watch',
    },
    {
      label: '调用',
      value: `${recentUsageCount}`,
      detail: '近 7 天回复调用记录',
      status: recentUsageCount > 0 ? 'ok' : 'watch',
    },
    {
      label: '索引',
      value: `${embeddingCoverage}%`,
      detail: embeddingStats.stale > 0 ? '语义缓存待补齐' : '语义缓存已覆盖',
      status: embeddingStats.stale > 0 ? 'watch' : 'ok',
    },
    {
      label: '修剪',
      value: `${cleanupCount}`,
      detail: cleanupCount > 0 ? '可复查的临时/沉睡/待巩固记忆' : '暂时不用清理',
      status: cleanupCount > 0 ? 'action' : 'ok',
    },
  ]

  return (
    <section aria-label="记忆生命周期" className="memory-recall-map">
      <div className="memory-recall-head">
        <div>
          <strong>记忆流水线</strong>
          <span>从捕捉、校准、调用到修剪，每一步都能看见，不让记忆变成黑箱。</span>
        </div>
        <DatabaseZap size={18} />
      </div>
      <div className="memory-recall-steps">
        {steps.map((step, index) => (
          <div className={`memory-recall-step memory-recall-${step.status}`} key={step.label}>
            <span className="memory-recall-index">{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </div>
            <em>{step.value}</em>
          </div>
        ))}
      </div>
      <div className="memory-principles">
        <span>
          <ShieldCheck size={14} />
          当前表达优先
        </span>
        <span>
          <GitPullRequest size={14} />
          候选先审核
        </span>
        <span>
          <CheckCircle2 size={14} />
          来源可回看
        </span>
        <span>
          <Scissors size={14} />
          临时会过期
        </span>
        <span>
          <BrainCircuit size={14} />
          语义可扩容
        </span>
        <span>
          <CircleDashed size={14} />
          敏感少主动
        </span>
      </div>
    </section>
  )
}

function daysSince(value: string): number {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 99
  return (Date.now() - time) / 86_400_000
}

function isReviewDue(value: string | undefined, now: Date): boolean {
  if (!value) return false
  const time = new Date(value).getTime()
  return !Number.isNaN(time) && time <= now.getTime()
}
