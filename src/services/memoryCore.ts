import type {
  LongTermMemory,
  MemoryKind,
  MemoryLayer,
  MemoryMentionPolicy,
  MemoryOrigin,
  MemoryRevision,
  MemoryScope,
  MemorySensitivity,
  MemorySnapshot,
  MemorySource,
  MemoryStatus,
} from '../domain/types'
import {
  formatMemoryScopeLabel,
  memoryLayerLabels,
  memoryMentionPolicyLabels,
  memorySensitivityLabels,
} from '../domain/memoryLabels'
import {
  clampNumber,
  createId,
  daysSince,
  getKeywordOverlap,
  normalizeComparable,
  nowIso,
  unique,
} from './memoryUtils'
import {
  inferMemoryLayer,
  inferMentionPolicy,
  normalizeMemory,
  normalizeMemoryScope,
} from './memoryInference'

// re-export everything consumers need from sub-modules
export {
  nowIso,
  createId,
  daysSince,
  clampNumber,
  unique,
  normalizeComparable,
  extractKeywords,
  getKeywordOverlap,
} from './memoryUtils'

export {
  inferMemoryScope,
  inferMemoryLayer,
  inferMemoryKind,
  inferSensitivity,
  inferMentionPolicy,
  getAutoMemoryStatus,
  classifyMemory,
  normalizeMemory,
  normalizeMemories,
  normalizeMemoryScope,
} from './memoryInference'

export {
  createManualMemory,
  createMemorySourceFromMessage,
  createMemoryTombstone,
  isMemoryBlockedByTombstones,
  maybeCaptureMemory,
  integrateMemoryCandidate,
  consolidateMemoryGarden,
} from './memoryFactory'

export type { MemoryMaintenanceReport } from './memoryFactory'

// ============ 记忆创建（内部） ============

export function createLongTermMemory(input: {
  title: string
  body: string
  tags: string[]
  priority: number
  pinned: boolean
  kind: MemoryKind
  layer?: MemoryLayer
  confidence: number
  status: MemoryStatus
  scope: MemoryScope
  sensitivity: MemorySensitivity
  mentionPolicy?: MemoryMentionPolicy
  cooldownUntil?: string
  origin: MemoryOrigin
  sources: MemorySource[]
  reason: string
}): LongTermMemory {
  const createdAt = nowIso()
  const memory: LongTermMemory = {
    id: createId('memory'),
    title: input.title.trim() || '未命名记忆',
    body: input.body.trim(),
    tags: unique(input.tags),
    priority: clampNumber(input.priority, 1, 5, 3),
    pinned: input.pinned,
    kind: input.kind,
    status: input.status,
    layer: input.layer ?? inferMemoryLayer(input.kind, input.scope),
    scope: normalizeMemoryScope(input.scope),
    sensitivity: input.sensitivity,
    mentionPolicy: input.mentionPolicy ?? inferMentionPolicy(input.kind, input.sensitivity),
    cooldownUntil: input.cooldownUntil,
    confidence: clampNumber(input.confidence, 0.1, 1, 0.82),
    origin: input.origin,
    sources: input.sources,
    accessCount: 0,
    revisions: [],
    createdAt,
    updatedAt: createdAt,
  }

  return {
    ...memory,
    revisions: [createMemoryRevision(memory, input.reason, input.origin)],
  }
}

// ============ 记忆版本 ============

export function appendMemoryRevision(memory: LongTermMemory, reason: string, editor: MemoryOrigin): LongTermMemory {
  const normalized = normalizeMemory(memory)
  const revision = createMemoryRevision(normalized, reason, editor)

  return {
    ...normalized,
    revisions: [...normalized.revisions, revision].slice(-24),
  }
}

function createMemoryRevision(memory: LongTermMemory, reason: string, editor: MemoryOrigin): MemoryRevision {
  return {
    id: createId('revision'),
    createdAt: nowIso(),
    reason,
    editor,
    snapshot: snapshotMemory(memory),
    sourceIds: memory.sources.map((source) => source.id),
  }
}

function snapshotMemory(memory: LongTermMemory): MemorySnapshot {
  return {
    title: memory.title,
    body: memory.body,
    tags: memory.tags,
    priority: memory.priority,
    pinned: memory.pinned,
    kind: memory.kind,
    confidence: memory.confidence,
    status: memory.status,
    layer: memory.layer,
    scope: memory.scope,
    sensitivity: memory.sensitivity,
    mentionPolicy: memory.mentionPolicy,
    cooldownUntil: memory.cooldownUntil,
  }
}

export function updateMemoryWithRevision(
  _previousMemory: LongTermMemory,
  updatedMemory: LongTermMemory,
  reason: string,
): LongTermMemory {
  return appendMemoryRevision(
    {
      ...updatedMemory,
      updatedAt: nowIso(),
    },
    reason,
    'manual',
  )
}

export function restoreMemoryRevision(memory: LongTermMemory, revisionId: string): LongTermMemory | null {
  const revision = memory.revisions.find((rev) => rev.id === revisionId)
  if (!revision) return null

  return appendMemoryRevision(
    {
      ...memory,
      ...revision.snapshot,
      updatedAt: nowIso(),
    },
    `从版本 ${revisionId} 恢复`,
    'manual',
  )
}

// ============ 墓碑指纹 ============

export function fingerprintMemory(memory: LongTermMemory): string {
  return normalizeComparable(`${memory.title}|${memory.body}|${memory.tags.join(',')}`)
}

// ============ 记忆合并工具 ============

export function mergeBody(primary: string, incoming: string): string {
  const cleanPrimary = primary.trim()
  const cleanIncoming = incoming.trim()
  if (!cleanIncoming || normalizeComparable(cleanPrimary).includes(normalizeComparable(cleanIncoming))) {
    return cleanPrimary
  }
  if (!cleanPrimary) return cleanIncoming
  return `${cleanPrimary}\n补充：${cleanIncoming}`.slice(0, 720)
}

export function mergeSources(a: MemorySource[], b: MemorySource[]): MemorySource[] {
  const seen = new Set<string>()
  return [...a, ...b].filter((source) => {
    const key = source.messageId ?? source.excerpt
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function maxSensitivity(a: MemorySensitivity, b: MemorySensitivity): MemorySensitivity {
  const order: MemorySensitivity[] = ['low', 'medium', 'high', 'critical']
  return order[Math.max(order.indexOf(a), order.indexOf(b))]
}

export function mergeMemoryLayer(a: MemoryLayer, b: MemoryLayer): MemoryLayer {
  const order: MemoryLayer[] = ['working', 'episode', 'stable']
  return order[Math.max(order.indexOf(a), order.indexOf(b))]
}

export function serializeMemoryScope(scope: MemoryScope): string {
  switch (scope.kind) {
    case 'global_user':
      return 'global_user'
    case 'character_private':
      return `character_private:${scope.characterId}`
    case 'relationship':
      return `relationship:${scope.characterId}`
    case 'conversation':
      return `conversation:${scope.conversationId}`
    case 'project':
      return `project:${scope.projectId}`
    case 'world':
      return `world:${scope.worldId}`
    case 'world_branch':
      return `world_branch:${scope.worldId}:${scope.branchId}`
    case 'temporary':
      return 'temporary'
    default:
      return 'global_user'
  }
}

// ============ 冲突检测工具 ============

export function hasOppositePreference(first: LongTermMemory, second: LongTermMemory): boolean {
  const firstPolarity = getPolarity(first.body)
  const secondPolarity = getPolarity(second.body)
  return (
    (firstPolarity === 'positive' && secondPolarity === 'negative') ||
    (firstPolarity === 'negative' && secondPolarity === 'positive')
  )
}

export function getPolarity(text: string): 'positive' | 'negative' | 'neutral' {
  const negative = /(不喜欢|讨厌|不要|别|关闭|禁止|不想|不需要|不希望|取消)/.test(text)
  const positive = /(喜欢|需要|希望|开启|保留|默认|必须|应该|想要)/.test(text)
  if (negative && !positive) return 'negative'
  if (positive && !negative) return 'positive'
  if (negative && positive) return text.search(/不喜欢|讨厌|不要|别|关闭|禁止|不想|不需要|不希望|取消/) < text.search(/喜欢|需要|希望|开启|保留|默认|必须|应该|想要/)
    ? 'negative'
    : 'positive'
  return 'neutral'
}

// ============ 冷却 ============

export function isCoolingDown(cooldownUntil?: string): boolean {
  if (!cooldownUntil) return false
  return new Date(cooldownUntil).getTime() > Date.now()
}

// ============ 记忆评分与检索辅助 ============

export function scoreMemory(memory: LongTermMemory, query: string): number {
  let score = memory.priority * 10
  if (memory.pinned) score += 30
  if (memory.kind === 'taboo' || memory.kind === 'safety') score += 50
  if (memory.kind === 'preference' || memory.kind === 'procedure') score += 15
  score += Math.min(memory.accessCount, 10) * 2
  score += memory.confidence * 20
  if (query) {
    const text = `${memory.title} ${memory.body} ${memory.tags.join(' ')}`
    score += getKeywordOverlap(text, query) * 8
  }
  if (memory.lastAccessedAt) {
    const days = daysSince(memory.lastAccessedAt)
    score -= Math.min(days * 2, 20)
  }
  return score
}

export function isMemoryAllowedInContext(
  memory: LongTermMemory,
  options: { characterId?: string; conversationId?: string },
): boolean {
  switch (memory.scope.kind) {
    case 'global_user':
    case 'project':
    case 'world':
    case 'world_branch':
      return true
    case 'relationship':
    case 'character_private':
      return Boolean(options.characterId && memory.scope.characterId === options.characterId)
    case 'conversation':
      return Boolean(options.conversationId && memory.scope.conversationId === options.conversationId)
    case 'temporary':
      return false
    default:
      return false
  }
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
  return memory.priority >= 4 || getKeywordOverlap(text, query) > 0 || normalizeComparable(query).includes(normalizeComparable(memory.title))
}

export function isExplicitMemoryQuery(query: string): boolean {
  return /(还记得|记得吗|记不记得|上次|之前|以前|记忆|档案|为什么你|你刚才为什么|想起来|回忆)/.test(query)
}

export function getMemoryGroupRank(memory: LongTermMemory): number {
  if (memory.kind === 'taboo' || memory.kind === 'safety') return 0
  if (memory.layer === 'working') return 5
  if (memory.kind === 'profile' || memory.kind === 'preference' || memory.kind === 'procedure') return 1
  if (memory.kind === 'relationship' || memory.kind === 'character') return 2
  if (memory.kind === 'project' || memory.kind === 'world') return 3
  return 4
}

export function formatMemoryForPrompt(memory: LongTermMemory): string {
  const source = memory.sources[0]?.excerpt
  return [
    memory.body,
    `标签：${memory.tags.join(' / ') || '无'}`,
    `层级：${memoryLayerLabels[memory.layer]}`,
    `空间：${formatMemoryScopeLabel(memory.scope)}；敏感度：${memorySensitivityLabels[memory.sensitivity]}`,
    `提及策略：${memoryMentionPolicyLabels[memory.mentionPolicy]}${memory.cooldownUntil ? `；冷却到：${new Date(memory.cooldownUntil).toLocaleString('zh-CN')}` : ''}`,
    `权重：${memory.priority}；可信度：${Math.round(memory.confidence * 100)}%；来源：${source || '手动整理'}`,
  ].join('\n')
}

export function isPotentialDuplicate(a: LongTermMemory, b: LongTermMemory): boolean {
  if (a.id === b.id) return true
  if (normalizeComparable(a.body) === normalizeComparable(b.body)) return true
  if (a.kind === b.kind && getKeywordOverlap(a.body, b.body) >= 3) return true
  return false
}

export function mergeMemories(primary: LongTermMemory, incoming: LongTermMemory, reason: string): LongTermMemory {
  const merged: LongTermMemory = {
    ...primary,
    body: mergeBody(primary.body, incoming.body),
    tags: unique([...primary.tags, ...incoming.tags]),
    priority: Math.max(primary.priority, incoming.priority),
    pinned: primary.pinned || incoming.pinned,
    confidence: Math.max(primary.confidence, incoming.confidence),
    sensitivity: maxSensitivity(primary.sensitivity, incoming.sensitivity),
    layer: mergeMemoryLayer(primary.layer, incoming.layer),
    sources: mergeSources(primary.sources, incoming.sources),
    updatedAt: nowIso(),
  }

  return appendMemoryRevision(merged, reason, 'system')
}
