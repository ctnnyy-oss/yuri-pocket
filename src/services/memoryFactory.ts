import type {
  CharacterCard,
  ChatMessage,
  ConversationState,
  LongTermMemory,
  MemoryKind,
  MemoryLayer,
  MemoryMentionPolicy,
  MemoryScope,
  MemorySensitivity,
  MemorySource,
  MemoryStatus,
  MemoryTombstone,
} from '../domain/types'
import { createId, extractKeywords, nowIso, unique } from './memoryUtils'
import {
  classifyMemory,
  getAutoMemoryStatus,
  inferMemoryLayer,
  inferMemoryScope,
  inferMentionPolicy,
  inferSensitivity,
  normalizeMemory,
} from './memoryInference'
import {
  createLongTermMemory,
  fingerprintMemory,
  isPotentialDuplicate,
  mergeMemories,
  scoreMemory,
} from './memoryCore'
import { buildReflectionCandidates } from './memoryReflection'

export type MemoryMaintenanceReport = {
  memories: LongTermMemory[]
  mergedCount: number
  reflectedCount: number
  reviewedCount: number
}

export function createManualMemory(input: {
  title: string
  body: string
  tags: string[]
  priority: number
  pinned?: boolean
  kind?: MemoryKind
  layer?: MemoryLayer
  confidence?: number
  status?: MemoryStatus
  scope?: MemoryScope
  sensitivity?: MemorySensitivity
  mentionPolicy?: MemoryMentionPolicy
  cooldownUntil?: string
  sources?: MemorySource[]
  reason?: string
}): LongTermMemory {
  const kind = input.kind ?? 'event'
  const sensitivity = input.sensitivity ?? inferSensitivity(kind, input.body)
  return createLongTermMemory({
    title: input.title,
    body: input.body,
    tags: input.tags,
    priority: input.priority,
    pinned: input.pinned ?? false,
    kind,
    layer: input.layer ?? inferMemoryLayer(kind, input.scope),
    confidence: input.confidence ?? 0.92,
    status: input.status ?? 'active',
    scope: input.scope ?? inferMemoryScope(kind),
    sensitivity,
    mentionPolicy: input.mentionPolicy ?? inferMentionPolicy(kind, sensitivity),
    cooldownUntil: input.cooldownUntil,
    origin: 'manual',
    sources: input.sources ?? [
      {
        id: createId('source'),
        kind: 'manual',
        excerpt: input.body.slice(0, 180),
        createdAt: nowIso(),
      },
    ],
    reason: input.reason ?? '手动创建',
  })
}

export function createMemorySourceFromMessage(
  message: ChatMessage,
  conversation?: ConversationState,
  character?: CharacterCard,
): MemorySource {
  return {
    id: createId('source'),
    kind: 'message',
    excerpt: message.content.slice(0, 220),
    createdAt: message.createdAt,
    conversationId: conversation?.id,
    characterId: character?.id ?? conversation?.characterId,
    messageId: message.id,
    role: message.role,
  }
}

export function createMemoryTombstone(memory: LongTermMemory, reason: string): MemoryTombstone {
  return {
    id: createId('tombstone'),
    memoryId: memory.id,
    fingerprint: fingerprintMemory(memory),
    reason,
    createdAt: nowIso(),
  }
}

export function isMemoryBlockedByTombstones(memory: LongTermMemory, tombstones: MemoryTombstone[]): boolean {
  if (!tombstones.length) return false
  const fp = fingerprintMemory(memory)
  return tombstones.some(
    (tombstone) =>
      tombstone.memoryId === memory.id ||
      tombstone.fingerprint === fp,
  )
}

export function maybeCaptureMemory(
  message: ChatMessage,
  conversation?: ConversationState,
  character?: CharacterCard,
): LongTermMemory | null {
  if (message.role !== 'user') return null

  const content = message.content.trim()
  const payload = extractMemoryPayload(content)
  const explicitMemoryCommand = hasExplicitMemoryCommand(content)
  const signal = explicitMemoryCommand
    ? classifyMemory(payload) ?? inferExplicitMemorySignal(payload)
    : classifyMemory(content)

  if (!signal || content.length < 6) return null
  if (payload.length < 4) return null

  const source = createMemorySourceFromMessage(message, conversation, character)
  return createLongTermMemory({
    title: buildMemoryTitle(signal.kind, payload),
    body: payload.slice(0, 360),
    tags: buildMemoryTags(signal.kind, payload, character?.name),
    priority: signal.kind === 'procedure' || signal.kind === 'project' ? 5 : 4,
    pinned: signal.kind === 'procedure',
    kind: signal.kind,
    confidence: signal.confidence,
    status: signal.status,
    scope: inferMemoryScope(signal.kind, conversation, character),
    sensitivity: signal.sensitivity,
    origin: 'auto',
    sources: [source],
    reason: '自动捕捉',
  })
}

export function integrateMemoryCandidate(
  memories: LongTermMemory[],
  candidate: LongTermMemory,
): LongTermMemory[] {
  const normalizedCandidate = normalizeMemory(candidate)
  const normalizedMemories = memories.map((memory) => normalizeMemory(memory))
  const duplicateIndex = normalizedMemories.findIndex((memory) => isPotentialDuplicate(memory, normalizedCandidate))

  if (duplicateIndex === -1) {
    return [normalizedCandidate, ...normalizedMemories]
  }

  const merged = mergeMemories(normalizedMemories[duplicateIndex], normalizedCandidate, '自动合并相似记忆')
  return normalizedMemories.map((memory, index) => (index === duplicateIndex ? merged : memory))
}

export function consolidateMemoryGarden(memories: LongTermMemory[]): MemoryMaintenanceReport {
  const sorted = memories
    .map((memory) => normalizeMemory(memory))
    .sort((a, b) => scoreMemory(b, '') - scoreMemory(a, ''))
  const consolidated: LongTermMemory[] = []
  let mergedCount = 0

  for (const memory of sorted) {
    const duplicateIndex = consolidated.findIndex((item) => isPotentialDuplicate(item, memory))
    if (duplicateIndex === -1) {
      consolidated.push(memory)
      continue
    }

    consolidated[duplicateIndex] = mergeMemories(consolidated[duplicateIndex], memory, '后台整理合并')
    mergedCount += 1
  }
  const reflected = buildReflectionCandidates(consolidated)

  return {
    memories: [...reflected, ...consolidated],
    mergedCount,
    reflectedCount: reflected.length,
    reviewedCount: sorted.length,
  }
}

function buildMemoryTitle(kind: MemoryKind, content: string): string {
  const prefix: Record<string, string> = {
    taboo: '禁忌',
    safety: '安全边界',
    preference: '偏好',
    procedure: '规则',
    project: '项目',
    relationship: '关系',
    character: '角色',
    world: '世界观',
    event: '事件',
    reflection: '反思',
    profile: '档案',
  }
  return `${prefix[kind] ?? '记忆'}：${content.slice(0, 30)}`
}

function buildMemoryTags(kind: MemoryKind, content: string, characterName?: string): string[] {
  const tags: string[] = [kind]
  if (characterName) tags.push(characterName)
  const keywords = extractKeywords(content).slice(0, 3)
  tags.push(...keywords)
  return unique(tags)
}

export function extractMemoryPayload(content: string): string {
  const explicitCommandPattern =
    /(?:帮我|请|麻烦|顺手)?\s*(?:记住|记一下|写进记忆|加入记忆|保存到记忆|别忘了?)\s*[：:，,。 ]*/gu
  let explicitPayloadStart = -1

  for (const match of content.matchAll(explicitCommandPattern)) {
    explicitPayloadStart = (match.index ?? 0) + match[0].length
  }

  if (explicitPayloadStart >= 0) {
    return cleanMemoryPayload(content.slice(explicitPayloadStart))
  }

  return cleanMemoryPayload(content
    .replace(/^(姐姐|妹妹|你)?\s*(帮我|给我|请)?\s*(记住|记一下|写进记忆|加入记忆|保存到记忆|别忘了?|以后|下次|默认)\s*[：:，,。 ]*/u, '')
    .replace(/^(我的|我|妹妹)\s*(偏好|规则|习惯|设定)\s*(是|就是|：|:)?\s*/u, '$1$2是')
    .replace(/^(请|麻烦)?\s*(以后|下次)\s*/u, '')
  )
}

function hasExplicitMemoryCommand(content: string): boolean {
  return /(?:记住|记一下|写进记忆|加入记忆|保存到记忆|别忘了?|帮我记住|请记住|顺手记住)/u.test(content)
}

function inferExplicitMemorySignal(payload: string): NonNullable<ReturnType<typeof classifyMemory>> {
  const kind: MemoryKind = /(暗号|称呼|昵称|关系|姐姐|妹妹|恋人|朋友|家人)/.test(payload)
    ? 'relationship'
    : /(项目|应用|百合小窝|Yuri Nest|架构|模型|Agent|云服务器)/i.test(payload)
      ? 'project'
      : /(角色|人设|世界观|CP|百合)/i.test(payload)
        ? 'world'
        : 'preference'
  const sensitivity = inferSensitivity(kind, payload)

  return {
    kind,
    confidence: 0.82,
    sensitivity,
    status: getAutoMemoryStatus(kind, sensitivity, 'candidate'),
  }
}

function cleanMemoryPayload(content: string): string {
  return content
    .replace(/^(这件事|这一点|一下|内容是|就是|是)\s*[：:，,。 ]*/u, '')
    .trim()
}
