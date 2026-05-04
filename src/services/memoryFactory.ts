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

export type MemoryMaintenanceReport = {
  memories: LongTermMemory[]
  mergedCount: number
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
  const signal = classifyMemory(content)
  if (!signal || content.length < 6) return null

  const source = createMemorySourceFromMessage(message, conversation, character)
  return createLongTermMemory({
    title: buildMemoryTitle(signal.kind, content),
    body: content.slice(0, 360),
    tags: buildMemoryTags(signal.kind, content, character?.name),
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

  return {
    memories: consolidated,
    mergedCount,
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
