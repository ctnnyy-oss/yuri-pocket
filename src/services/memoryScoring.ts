import type { LongTermMemory } from '../domain/types'
import {
  clampNumber,
  daysSince,
  estimateTextEmotionalSalience,
  getKeywordOverlap,
  getMemorySemanticSimilarity,
  getTemporalSignalOverlap,
  hasEmotionalRecallIntent,
  hasTemporalRecallIntent,
  normalizeComparable,
  nowIso,
} from './memoryUtils'

export function isCoolingDown(cooldownUntil?: string): boolean {
  if (!cooldownUntil) return false
  return new Date(cooldownUntil).getTime() > Date.now()
}

export function scoreMemory(memory: LongTermMemory, query: string): number {
  let score = memory.priority * 10
  if (memory.pinned) score += 30
  if (memory.kind === 'taboo' || memory.kind === 'safety') score += 50
  if (memory.kind === 'preference' || memory.kind === 'procedure') score += 15
  if (isCoreMemoryAnchor(memory)) score += 25
  score += Math.min(memory.sources.length, 5) * 3
  score += Math.min(memory.revisions.length, 6)
  score += Math.min(memory.accessCount, 10) * 2
  score += (memory.memoryStrength ?? estimateMemoryStrength(memory)) * 24
  score += (memory.emotionalSalience ?? estimateMemoryEmotionalSalience(memory)) * (query && hasEmotionalRecallIntent(query) ? 30 : 4)
  score += memory.confidence * 20
  if (query) {
    const text = `${memory.title} ${memory.body} ${memory.tags.join(' ')}`
    score += getKeywordOverlap(text, query) * 8
    score += getMemorySemanticSimilarity(text, query) * 28
    if (hasTemporalRecallIntent(query)) {
      score += getTemporalMemoryScore(memory, query) * 18
    }
  }
  if (memory.lastAccessedAt && !isCoreMemoryAnchor(memory)) {
    const days = daysSince(memory.lastAccessedAt)
    score -= Math.min(days * 2, 20)
  }
  return score
}

export function estimateMemoryEmotionalSalience(
  memory: Pick<LongTermMemory, 'title' | 'body' | 'tags' | 'priority' | 'pinned' | 'sensitivity'>,
): number {
  let salience = estimateTextEmotionalSalience(`${memory.title} ${memory.body} ${memory.tags.join(' ')}`)
  salience += (memory.priority / 5) * 0.08
  if (memory.pinned) salience += 0.06
  if (memory.sensitivity === 'high') salience += 0.08
  if (memory.sensitivity === 'critical') salience += 0.14
  return clampNumber(salience, 0.1, 1, 0.35)
}

export function estimateMemoryStrength(memory: Pick<LongTermMemory, 'priority' | 'pinned' | 'kind' | 'confidence' | 'sources' | 'accessCount'>): number {
  let strength = 0.24
  strength += memory.confidence * 0.28
  strength += (memory.priority / 5) * 0.18
  strength += Math.min(memory.sources.length, 5) * 0.04
  strength += Math.min(memory.accessCount, 12) * 0.018
  if (memory.pinned) strength += 0.12
  if (memory.kind === 'procedure' || memory.kind === 'preference') strength += 0.06
  if (memory.kind === 'taboo' || memory.kind === 'safety') strength += 0.12
  return clampNumber(strength, 0.1, 1, 0.5)
}

export function rehearseMemory(memory: LongTermMemory, at = nowIso()): LongTermMemory {
  const currentStrength = memory.memoryStrength ?? estimateMemoryStrength(memory)
  const nextStrength = clampNumber(currentStrength + 0.055 + Math.min(memory.sources.length, 4) * 0.008, 0.1, 1, currentStrength)
  const currentInterval = memory.reviewIntervalDays ?? (isCoreMemoryAnchor(memory) ? 14 : 7)
  const nextInterval = Math.min(
    isCoreMemoryAnchor(memory) ? 365 : 120,
    Math.max(2, Math.round(currentInterval * (1.35 + nextStrength * 0.55))),
  )

  return {
    ...memory,
    memoryStrength: nextStrength,
    reviewIntervalDays: nextInterval,
    nextReviewAt: getFutureIso(nextInterval, at),
  }
}

export function isMemoryReviewDue(memory: LongTermMemory, now = new Date()): boolean {
  if (!memory.nextReviewAt) return isCoreMemoryAnchor(memory) && (!memory.lastAccessedAt || daysSince(memory.lastAccessedAt) > 60)
  const time = new Date(memory.nextReviewAt).getTime()
  return !Number.isNaN(time) && time <= now.getTime()
}

export function isCoreMemoryAnchor(memory: LongTermMemory): boolean {
  if (memory.status !== 'active') return false
  if (memory.kind === 'taboo' || memory.kind === 'safety') return true
  if (memory.layer !== 'stable') return false
  if (memory.pinned) return true
  if (memory.priority >= 5 && memory.confidence >= 0.86) return true
  return memory.kind === 'procedure' && memory.priority >= 4 && memory.confidence >= 0.82
}

export function isMemoryMentionable(memory: LongTermMemory, query: string): boolean {
  if (memory.kind === 'taboo' || memory.kind === 'safety') return true
  if (isCoolingDown(memory.cooldownUntil)) return false

  switch (memory.mentionPolicy) {
    case 'proactive':
      return true
    case 'contextual':
      return isMemoryRelevantEnough(memory, query)
    case 'explicit':
      return isExplicitMemoryQuery(query)
    case 'silent':
      return false
    default:
      return true
  }
}

export function isMemoryRelevantEnough(memory: LongTermMemory, query: string): boolean {
  if (!query) return memory.priority >= 4 || memory.pinned

  const text = `${memory.title} ${memory.body} ${memory.tags.join(' ')}`
  return (
    memory.priority >= 4 ||
    getKeywordOverlap(text, query) > 0 ||
    getMemorySemanticSimilarity(text, query) >= 0.18 ||
    (hasTemporalRecallIntent(query) && getTemporalMemoryScore(memory, query) >= 0.5) ||
    (hasEmotionalRecallIntent(query) && (memory.emotionalSalience ?? estimateMemoryEmotionalSalience(memory)) >= 0.42) ||
    normalizeComparable(query).includes(normalizeComparable(memory.title))
  )
}

export function isExplicitMemoryQuery(query: string): boolean {
  return /(还记得|记得吗|记不记得|上次|之前|以前|记忆|档案|为什么你|你刚才为什么|想起来|回忆)/.test(query)
}

function getTemporalMemoryScore(memory: LongTermMemory, query: string): number {
  const sourceDates = memory.sources
    .map((source) => source.createdAt)
    .filter(Boolean)
    .join(' ')
  const text = `${memory.title} ${memory.body} ${memory.tags.join(' ')} ${memory.createdAt} ${memory.updatedAt} ${sourceDates}`
  return Math.min(1, getTemporalSignalOverlap(text, query) / 2)
}

function getFutureIso(days: number, from = nowIso()): string {
  const date = new Date(from)
  if (Number.isNaN(date.getTime())) return nowIso()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}
