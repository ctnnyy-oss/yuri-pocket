import { History, ShieldCheck, Sparkles } from 'lucide-react'
import type { LongTermMemory, MemoryKind } from '../../../domain/types'
import { memoryKindLabels } from '../../../domain/memoryLabels'

function buildMemoryInsight(memories: LongTermMemory[]) {
  const total = memories.length
  const sourced = memories.filter((memory) => memory.sources.length > 0).length
  const pending = memories.filter((memory) => memory.status === 'candidate').length
  const boundary = memories.filter((memory) => memory.kind === 'taboo' || memory.kind === 'safety').length
  const stable = memories.filter((memory) => memory.layer === 'stable').length
  const episode = memories.filter((memory) => memory.layer === 'episode').length
  const working = memories.filter((memory) => memory.layer === 'working').length
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
      { label: '稳定', value: `${stable}` },
      { label: '事件', value: `${episode}` },
      { label: '临时', value: `${working}` },
      { label: '平均可信', value: `${averageConfidence}%` },
      { label: '待确认', value: `${pending}` },
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

export function MemoryGardenInsight({ memories }: { memories: LongTermMemory[] }) {
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
