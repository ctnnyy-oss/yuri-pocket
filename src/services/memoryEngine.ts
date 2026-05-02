import type {
  AppState,
  ChatMessage,
  CharacterCard,
  ConversationState,
  LongTermMemory,
  MemoryConflict,
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
  MemoryTombstone,
  MemoryUsageLog,
  PromptBundle,
  PromptContextBlock,
  WorldNode,
} from '../domain/types'
import { brand } from '../config/brand'
import {
  formatMemoryScopeLabel,
  memoryKindLabels,
  memoryLayerLabels,
  memoryMentionPolicyLabels,
  memorySensitivityLabels,
} from '../domain/memoryLabels'

export interface MemoryMaintenanceReport {
  memories: LongTermMemory[]
  mergedCount: number
  reviewedCount: number
}

interface MemoryRetrievalOptions {
  characterId?: string
  conversationId?: string
  maxItems?: number
  includeSensitive?: boolean
}

interface MemoryContextGroup {
  title: string
  category: NonNullable<PromptContextBlock['category']>
  reason: string
  items: LongTermMemory[]
  limit: number
}

export function nowIso() {
  return new Date().toISOString()
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function getActiveCharacter(state: AppState): CharacterCard {
  return state.characters.find((character) => character.id === state.activeCharacterId) ?? state.characters[0]
}

export function getConversation(state: AppState, characterId = state.activeCharacterId): ConversationState {
  const existing = state.conversations.find((conversation) => conversation.characterId === characterId)

  if (existing) return existing

  const character = state.characters.find((item) => item.id === characterId) ?? state.characters[0]
  return {
    id: createId('conversation'),
    characterId: character.id,
    messages: [
      {
        id: createId('message'),
        role: 'assistant',
        content: character.greeting,
        createdAt: nowIso(),
      },
    ],
    summary: '',
    updatedAt: nowIso(),
  }
}

export function upsertConversation(state: AppState, conversation: ConversationState): AppState {
  const exists = state.conversations.some((item) => item.id === conversation.id)
  return {
    ...state,
    conversations: exists
      ? state.conversations.map((item) => (item.id === conversation.id ? conversation : item))
      : [...state.conversations, conversation],
  }
}

export function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: createId('message'),
    role,
    content,
    createdAt: nowIso(),
  }
}

export function buildPromptBundle(state: AppState): PromptBundle {
  const character = getActiveCharacter(state)
  const conversation = getConversation(state, character.id)
  const maxMessages = Math.max(4, state.settings.maxContextMessages)
  const recentMessages = conversation.messages.slice(-maxMessages)
  const recentText = recentMessages.map((message) => message.content).join('\n')
  const activeWorldNodes = getTriggeredWorldNodes(state.worldNodes, recentText)
  const activeMemories = getActiveMemories(state.memories, recentText, {
    characterId: character.id,
    conversationId: conversation.id,
    maxItems: 12,
  })
  const memoryContextBlocks = buildMemoryContextBlocks(activeMemories, {
    characterName: character.name,
  })

  return {
    characterName: character.name,
    systemPrompt: [
      character.systemPrompt,
      `你正在${brand.fullName}里与用户聊天。不要暴露内部实现。回复要自然、简体中文、有陪伴感。`,
      '优先保持连续性、情绪承接和可执行性；当用户做项目时给清晰下一步，当用户情绪不好时先接住再处理问题。',
      '如果长期记忆和当前用户明确表达冲突，以当前用户表达为准，并在合适时提醒用户可以修改旧记忆。',
      '使用记忆时不要机械复述，也不要炫耀你记得很多。低可信记忆只能温和确认，敏感记忆只能在用户主动相关提及时谨慎使用。',
      '区分记忆层级：稳定事实可以作为长期背景；阶段事件只能当作发生过的脉络，不能升级成永久偏好；临时工作只在当前任务强相关时使用。',
      '遵守每条记忆的提及策略：只做边界的记忆只能保护对话，不要主动说出；问起再提的记忆只有用户明确询问旧事或记忆时才可提起。',
    ].join('\n'),
    contextBlocks: [
      ...memoryContextBlocks,
      ...activeWorldNodes.map((node) => ({
        title: `世界树：${node.title}`,
        content: node.content,
        category: 'world' as const,
        reason: `命中触发词：${node.keywords.join(' / ')}`,
      })),
      ...(conversation.summary
        ? [
            {
              title: '最近摘要',
              content: conversation.summary,
              category: 'summary' as const,
              reason: '压缩当前角色的最近聊天',
            },
          ]
        : []),
    ],
    messages: recentMessages,
  }
}

export function createMemoryUsageLog(input: {
  bundle: PromptBundle
  conversation: ConversationState
  character: CharacterCard
  userMessage: ChatMessage
  assistantMessage?: ChatMessage
}): MemoryUsageLog {
  const memoryIds = unique(input.bundle.contextBlocks.flatMap((block) => block.memoryIds ?? []))

  return {
    id: createId('usage'),
    conversationId: input.conversation.id,
    characterId: input.character.id,
    userMessageId: input.userMessage.id,
    assistantMessageId: input.assistantMessage?.id,
    memoryIds,
    contextBlockTitles: input.bundle.contextBlocks
      .filter((block) => block.memoryIds?.length)
      .map((block) => block.title),
    createdAt: nowIso(),
  }
}

export function attachAssistantToMemoryUsageLog(
  logs: MemoryUsageLog[],
  usageLogId: string,
  assistantMessageId: string,
): MemoryUsageLog[] {
  return logs.map((log) => (log.id === usageLogId ? { ...log, assistantMessageId } : log))
}

export function getTriggeredWorldNodes(nodes: WorldNode[], text: string): WorldNode[] {
  const lowerText = text.toLocaleLowerCase()
  return nodes
    .filter((node) => node.enabled)
    .filter((node) => node.keywords.some((keyword) => lowerText.includes(keyword.toLocaleLowerCase())))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6)
}

export function getActiveMemories(
  memories: LongTermMemory[],
  query = '',
  options: MemoryRetrievalOptions = {},
): LongTermMemory[] {
  const normalized = memories
    .map((memory) => normalizeMemory(memory))
    .filter((memory) => memory.status === 'active')
    .filter((memory) => isMemoryAllowedInContext(memory, options))
    .filter((memory) => isMemoryMentionable(memory, query))
    .filter((memory) => options.includeSensitive || memory.kind === 'taboo' || memory.kind === 'safety' || memory.sensitivity !== 'critical')

  const groups = buildMemoryRetrievalGroups(normalized, query)
  const selected: LongTermMemory[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    const items = group.items
      .sort((a, b) => scoreMemory(b, query) - scoreMemory(a, query))
      .slice(0, group.limit)

    for (const memory of items) {
      if (seen.has(memory.id)) continue
      seen.add(memory.id)
      selected.push(memory)
    }
  }

  return selected
    .sort((a, b) => {
      const firstRank = getMemoryGroupRank(a)
      const secondRank = getMemoryGroupRank(b)
      return firstRank === secondRank ? scoreMemory(b, query) - scoreMemory(a, query) : firstRank - secondRank
    })
    .slice(0, options.maxItems ?? 10)
}

export function touchRelevantMemories(
  memories: LongTermMemory[],
  query: string,
  options: MemoryRetrievalOptions = {},
): LongTermMemory[] {
  const touchedAt = nowIso()
  const activeIds = new Set(getActiveMemories(memories, query, options).map((memory) => memory.id))

  return memories.map((memory) => {
    const normalized = normalizeMemory(memory)
    if (!activeIds.has(normalized.id)) return normalized

    return {
      ...normalized,
      accessCount: normalized.accessCount + 1,
      lastAccessedAt: touchedAt,
    }
  })
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

export function updateMemoryWithRevision(
  previousMemory: LongTermMemory,
  updatedMemory: LongTermMemory,
  reason: string,
): LongTermMemory {
  const previous = normalizeMemory(previousMemory)
  const updated = normalizeMemory({
    ...previous,
    ...updatedMemory,
    sources: updatedMemory.sources?.length ? updatedMemory.sources : previous.sources,
    revisions: previous.revisions,
    userEdited: true,
    updatedAt: nowIso(),
  })

  return appendMemoryRevision(updated, reason, 'manual')
}

export function restoreMemoryRevision(memory: LongTermMemory, revisionId: string): LongTermMemory {
  const normalized = normalizeMemory(memory)
  const revision = normalized.revisions.find((item) => item.id === revisionId)
  if (!revision) return normalized

  return appendMemoryRevision(
    {
      ...normalized,
      ...revision.snapshot,
      updatedAt: nowIso(),
    },
    `回滚到 ${new Date(revision.createdAt).toLocaleString('zh-CN')}`,
    'manual',
  )
}

export function normalizeMemory(memory: LongTermMemory): LongTermMemory {
  const kind = memory.kind ?? inferMemoryKind(memory)
  const confidence = clampNumber(memory.confidence ?? 0.82, 0.1, 1, 0.82)
  const sources = Array.isArray(memory.sources) ? memory.sources : []
  const scope = normalizeMemoryScope(memory.scope ?? inferMemoryScope(kind))
  const status = memory.status ?? 'active'
  const layer = memory.layer ?? inferMemoryLayer(kind, scope)
  const sensitivity = memory.sensitivity ?? inferSensitivity(kind, `${memory.title} ${memory.body}`)
  const mentionPolicy = memory.mentionPolicy ?? inferMentionPolicy(kind, sensitivity)
  const normalized: LongTermMemory = {
    ...memory,
    kind,
    status,
    layer,
    scope,
    sensitivity,
    mentionPolicy,
    cooldownUntil: memory.cooldownUntil,
    confidence,
    origin: memory.origin ?? 'imported',
    sources,
    accessCount: memory.accessCount ?? 0,
    lastAccessedAt: memory.lastAccessedAt,
    revisions: Array.isArray(memory.revisions) ? memory.revisions : [],
    priority: clampNumber(memory.priority, 1, 5, 3),
    tags: Array.isArray(memory.tags) ? memory.tags : [],
    pinned: Boolean(memory.pinned),
    updatedAt: memory.updatedAt ?? memory.createdAt ?? nowIso(),
    createdAt: memory.createdAt ?? nowIso(),
  }

  if (normalized.revisions.length > 0) return normalized

  return {
    ...normalized,
    revisions: [createMemoryRevision(normalized, '升级为可追溯记忆', normalized.origin)],
  }
}

export function normalizeMemories(memories: LongTermMemory[]): LongTermMemory[] {
  return memories.map((memory) => normalizeMemory(memory))
}

export function detectMemoryConflicts(memories: LongTermMemory[]): MemoryConflict[] {
  const activeMemories = memories
    .map((memory) => normalizeMemory(memory))
    .filter((memory) => memory.status === 'active' || memory.status === 'candidate')
  const conflicts: MemoryConflict[] = []

  for (const memory of activeMemories) {
    if (memory.kind === 'relationship' && memory.scope.kind === 'global_user') {
      conflicts.push({
        id: `conflict-scope-${memory.id}`,
        memoryIds: [memory.id],
        conflictType: 'scope',
        status: 'unresolved',
        title: '关系记忆缺少角色边界',
        description: `“${memory.title}” 是关系类记忆，但还在全局空间，后面多角色时可能串戏。`,
        suggestedResolution: '编辑这条记忆，把它移动到当前角色关系或角色私有空间。',
        requiresUserConfirmation: false,
        createdAt: nowIso(),
      })
    }
  }

  for (let index = 0; index < activeMemories.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < activeMemories.length; otherIndex += 1) {
      const first = activeMemories[index]
      const second = activeMemories[otherIndex]
      if (first.id === second.id) continue
      if (serializeMemoryScope(first.scope) !== serializeMemoryScope(second.scope)) continue
      if (first.kind !== second.kind) continue

      if (isPotentialDuplicate(first, second) && normalizeComparable(first.body) !== normalizeComparable(second.body)) {
        conflicts.push({
          id: `conflict-duplicate-${first.id}-${second.id}`,
          memoryIds: [first.id, second.id],
          conflictType: 'duplicate',
          status: 'unresolved',
          title: '相似记忆可能重复',
          description: `“${first.title}” 和 “${second.title}” 很像，但内容不完全一致。`,
          suggestedResolution: '保留更准确的一条，或手动合并后删除另一条。',
          requiresUserConfirmation: false,
          createdAt: nowIso(),
        })
        continue
      }

      if (hasOppositePreference(first, second)) {
        conflicts.push({
          id: `conflict-value-${first.id}-${second.id}`,
          memoryIds: [first.id, second.id],
          conflictType: 'value',
          status: 'unresolved',
          title: '偏好方向可能相反',
          description: `“${first.title}” 和 “${second.title}” 可能表达了相反偏好。`,
          suggestedResolution: '以妹妹当前真实偏好为准，编辑旧记忆、归档旧记忆，或把其中一条改成特定场景偏好。',
          requiresUserConfirmation: true,
          createdAt: nowIso(),
        })
      }
    }
  }

  return conflicts.slice(0, 12)
}

export function createMemoryTombstone(
  memory: LongTermMemory,
  reason: MemoryTombstone['reason'],
): MemoryTombstone {
  const normalized = normalizeMemory(memory)
  return {
    id: createId('tombstone'),
    memoryFingerprint: fingerprintMemory(normalized),
    scope: normalized.scope,
    deletedAt: nowIso(),
    reason,
    blockReExtraction: true,
  }
}

export function isMemoryBlockedByTombstones(memory: LongTermMemory, tombstones: MemoryTombstone[]): boolean {
  const fingerprint = fingerprintMemory(normalizeMemory(memory))
  return tombstones.some((tombstone) => tombstone.blockReExtraction && tombstone.memoryFingerprint === fingerprint)
}

export function updateConversationSummary(conversation: ConversationState): ConversationState {
  const userMessages = conversation.messages.filter((message) => message.role === 'user').slice(-4)
  const summary = userMessages.map((message) => message.content).join(' / ').slice(0, 280)

  return {
    ...conversation,
    summary,
  }
}

function createLongTermMemory(input: {
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

function appendMemoryRevision(memory: LongTermMemory, reason: string, editor: MemoryOrigin): LongTermMemory {
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

function formatMemoryForPrompt(memory: LongTermMemory): string {
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

function classifyMemory(
  content: string,
): { kind: MemoryKind; confidence: number; sensitivity: MemorySensitivity; status: MemoryStatus } | null {
  if (/(禁忌|边界|不要提|别提|别主动提|不要再提|不能提|雷点)/.test(content)) {
    return { kind: 'taboo', confidence: 0.92, sensitivity: 'high', status: 'active' }
  }

  if (/(记住|别忘|以后|下次|默认|一直|长期|规则|不要|必须|应该)/.test(content)) {
    const kind = /(回复|语气|风格|规则|不要|必须|应该)/.test(content) ? 'procedure' : 'preference'
    const sensitivity = inferSensitivity(kind, content)
    return { kind, confidence: 0.9, sensitivity, status: getAutoMemoryStatus(kind, sensitivity, 'active') }
  }

  if (/(我喜欢|我不喜欢|我讨厌|偏好|习惯|颜色|字体|UI|界面)/i.test(content)) {
    return { kind: 'preference', confidence: 0.84, sensitivity: 'low', status: 'active' }
  }

  if (/(百合帝国|项目|架构|应用|产品|百合小窝|Yuri Nest|小手机|世界树|记忆系统)/i.test(content)) {
    return { kind: 'project', confidence: 0.82, sensitivity: 'low', status: 'active' }
  }

  if (/(姐姐|妹妹|角色|关系|CP|陪伴)/.test(content) && content.length > 18) {
    return { kind: 'relationship', confidence: 0.72, sensitivity: 'medium', status: 'candidate' }
  }

  return null
}

function getAutoMemoryStatus(
  kind: MemoryKind,
  sensitivity: MemorySensitivity,
  fallback: MemoryStatus,
): MemoryStatus {
  if (kind === 'taboo' || kind === 'safety') return 'active'
  if (kind === 'relationship' || sensitivity === 'high' || sensitivity === 'critical') return 'candidate'
  return fallback
}

function buildMemoryTitle(kind: MemoryKind, content: string): string {
  const cleaned = content
    .replace(/^(姐姐|妹妹|请|麻烦|帮我|一定要|记住|别忘了?|以后|下次|默认|就是)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const fragment = cleaned.slice(0, 18) || memoryKindLabels[kind]
  return `${memoryKindLabels[kind]}：${fragment}`
}

function buildMemoryTags(kind: MemoryKind, content: string, characterName?: string): string[] {
  const tags = [memoryKindLabels[kind]]
  if (characterName) tags.push(characterName)
  if (/百合|CP|世界树/.test(content)) tags.push('百合')
  if (/UI|界面|颜色|字体/.test(content)) tags.push('界面')
  if (/架构|项目|产品|迭代|百合小窝|Yuri Nest/i.test(content)) tags.push('产品')
  if (/回复|语气|风格/.test(content)) tags.push('交流方式')
  return unique(tags)
}

function inferMemoryKind(memory: LongTermMemory): MemoryKind {
  const text = `${memory.title} ${memory.body} ${memory.tags?.join(' ') ?? ''}`
  if (/(禁忌|边界|不要提|别提|雷点)/.test(text)) return 'taboo'
  if (/(安全|危机|求助|风险)/.test(text)) return 'safety'
  if (/(规则|回复|语气|风格|不要|必须|应该)/.test(text)) return 'procedure'
  if (/(喜欢|不喜欢|偏好|习惯|颜色|字体|UI|界面)/i.test(text)) return 'preference'
  if (/(百合帝国|项目|架构|应用|产品|百合小窝|Yuri Nest|小手机|迭代)/i.test(text)) return 'project'
  if (/(世界树|世界观|CP|角色设定|百合)/.test(text)) return 'world'
  if (/(姐姐|妹妹|关系|陪伴)/.test(text)) return 'relationship'
  return 'event'
}

function scoreMemory(memory: LongTermMemory, query: string): number {
  const normalized = normalizeMemory(memory)
  const lowerQuery = query.toLocaleLowerCase()
  const haystack = `${normalized.title} ${normalized.body} ${normalized.tags.join(' ')}`.toLocaleLowerCase()
  const tagHits = normalized.tags.filter((tag) => lowerQuery.includes(tag.toLocaleLowerCase())).length
  const titleHit = lowerQuery && lowerQuery.includes(normalized.title.toLocaleLowerCase().slice(0, 8)) ? 1 : 0
  const directHit = lowerQuery && haystack.includes(lowerQuery.slice(0, 20)) ? 1 : 0
  const recency = normalized.lastAccessedAt ? Math.max(0, 6 - daysSince(normalized.lastAccessedAt)) : 0
  const sensitivityPenalty = normalized.sensitivity === 'critical' ? 35 : normalized.sensitivity === 'high' ? 14 : 0
  const mentionPenalty =
    normalized.mentionPolicy === 'explicit' ? 18 : normalized.mentionPolicy === 'silent' ? 60 : normalized.mentionPolicy === 'contextual' ? 4 : 0
  const typePriority = normalized.kind === 'taboo' || normalized.kind === 'safety' ? 45 : normalized.kind === 'relationship' ? 18 : 0
  const layerPriority = normalized.layer === 'stable' ? 12 : normalized.layer === 'episode' ? 2 : -10

  return (
    Number(normalized.pinned) * 60 +
    typePriority +
    layerPriority +
    normalized.priority * 11 +
    normalized.confidence * 18 +
    tagHits * 18 +
    titleHit * 10 +
    directHit * 6 +
    Math.min(normalized.accessCount, 30) * 0.35 +
    recency -
    sensitivityPenalty -
    mentionPenalty
  )
}

function isPotentialDuplicate(a: LongTermMemory, b: LongTermMemory): boolean {
  if (a.id === b.id) return true
  if (serializeMemoryScope(a.scope) !== serializeMemoryScope(b.scope)) return false

  const aBody = normalizeComparable(a.body)
  const bBody = normalizeComparable(b.body)
  if (aBody.length > 8 && bBody.length > 8 && (aBody.includes(bBody) || bBody.includes(aBody))) return true

  const titleMatch = normalizeComparable(a.title) === normalizeComparable(b.title)
  const tagOverlap = a.tags.some((tag) => b.tags.includes(tag))
  return titleMatch && (tagOverlap || a.kind === b.kind)
}

function mergeMemories(primary: LongTermMemory, incoming: LongTermMemory, reason: string): LongTermMemory {
  const body = mergeBody(primary.body, incoming.body)
  const merged: LongTermMemory = {
    ...primary,
    body,
    tags: unique([...primary.tags, ...incoming.tags]),
    priority: Math.max(primary.priority, incoming.priority),
    pinned: primary.pinned || incoming.pinned,
    confidence: Math.max(primary.confidence, incoming.confidence),
    sensitivity: maxSensitivity(primary.sensitivity, incoming.sensitivity),
    status: primary.status === 'active' || incoming.status === 'active' ? 'active' : primary.status,
    layer: mergeMemoryLayer(primary.layer, incoming.layer),
    sources: mergeSources(primary.sources, incoming.sources),
    accessCount: primary.accessCount + incoming.accessCount,
    lastAccessedAt: primary.lastAccessedAt ?? incoming.lastAccessedAt,
    revisions: [...primary.revisions, ...incoming.revisions].slice(-22),
    updatedAt: nowIso(),
  }

  return appendMemoryRevision(merged, reason, 'system')
}

function buildMemoryContextBlocks(
  memories: LongTermMemory[],
  options: { characterName?: string } = {},
): PromptContextBlock[] {
  const groups: MemoryContextGroup[] = [
    {
      title: '记忆边界：禁忌与安全',
      category: 'boundary',
      reason: '最高优先级，用来避免冒犯和危险误用',
      items: memories.filter((memory) => memory.kind === 'taboo' || memory.kind === 'safety'),
      limit: 4,
    },
    {
      title: '用户稳定记忆',
      category: 'stable',
      reason: '全局偏好和长期规则，帮助减少重复说明',
      items: memories.filter(
        (memory) =>
          memory.layer === 'stable' &&
          (memory.kind === 'profile' || memory.kind === 'preference' || memory.kind === 'procedure'),
      ),
      limit: 3,
    },
    {
      title: options.characterName ? `当前关系：${options.characterName}` : '关系与角色记忆',
      category: 'relationship',
      reason: '只取当前角色可见的关系和私有设定，避免串戏',
      items: memories.filter((memory) => memory.layer === 'stable' && (memory.kind === 'relationship' || memory.kind === 'character')),
      limit: 3,
    },
    {
      title: '项目与世界记忆',
      category: 'project',
      reason: '当前话题相关的项目决策和世界观规则',
      items: memories.filter((memory) => memory.layer !== 'working' && (memory.kind === 'project' || memory.kind === 'world')),
      limit: 3,
    },
    {
      title: '相关事件与反思',
      category: 'event',
      reason: '当前会话附近的经历、阶段进展和反思',
      items: memories.filter((memory) => memory.layer === 'episode' || memory.kind === 'event' || memory.kind === 'reflection'),
      limit: 3,
    },
  ]

  return groups
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const items = group.items.slice(0, group.limit)
      return {
        title: group.title,
        category: group.category,
        reason: group.reason,
        memoryIds: items.map((memory) => memory.id),
        content: items
          .map((memory) => `- ${memoryKindLabels[memory.kind]} / ${memory.title}\n${formatMemoryForPrompt(memory)}`)
          .join('\n\n'),
      }
    })
}

function buildMemoryRetrievalGroups(memories: LongTermMemory[], query: string): MemoryContextGroup[] {
  const relevantMemories = memories.filter((memory) => isMemoryRelevantEnough(memory, query))

  return [
    {
      title: '记忆边界：禁忌与安全',
      category: 'boundary',
      reason: '最高优先级，用来避免冒犯和危险误用',
      items: memories.filter((memory) => memory.kind === 'taboo' || memory.kind === 'safety'),
      limit: 4,
    },
    {
      title: '用户稳定记忆',
      category: 'stable',
      reason: '全局偏好和长期规则，帮助减少重复说明',
      items: relevantMemories.filter(
        (memory) =>
          memory.layer === 'stable' &&
          (memory.kind === 'profile' || memory.kind === 'preference' || memory.kind === 'procedure'),
      ),
      limit: 4,
    },
    {
      title: '关系与角色记忆',
      category: 'relationship',
      reason: '只取当前角色可见的关系和私有设定，避免串戏',
      items: relevantMemories.filter(
        (memory) => memory.layer === 'stable' && (memory.kind === 'relationship' || memory.kind === 'character'),
      ),
      limit: 3,
    },
    {
      title: '项目与世界记忆',
      category: 'project',
      reason: '当前话题相关的项目决策和世界观规则',
      items: relevantMemories.filter((memory) => memory.layer !== 'working' && (memory.kind === 'project' || memory.kind === 'world')),
      limit: 4,
    },
    {
      title: '相关事件与反思',
      category: 'event',
      reason: '当前会话附近的经历、阶段进展和反思',
      items: relevantMemories.filter(
        (memory) => memory.layer === 'episode' || memory.kind === 'event' || memory.kind === 'reflection' || memory.layer === 'working',
      ),
      limit: 3,
    },
  ]
}

function getMemoryGroupRank(memory: LongTermMemory): number {
  if (memory.kind === 'taboo' || memory.kind === 'safety') return 0
  if (memory.layer === 'working') return 5
  if (memory.kind === 'profile' || memory.kind === 'preference' || memory.kind === 'procedure') return 1
  if (memory.kind === 'relationship' || memory.kind === 'character') return 2
  if (memory.kind === 'project' || memory.kind === 'world') return 3
  return 4
}

function isMemoryRelevantEnough(memory: LongTermMemory, query: string): boolean {
  if (memory.pinned) return true
  if (memory.layer === 'working') {
    return Boolean(
      query.trim() &&
        (memory.priority >= 4 ||
          getKeywordOverlap(`${memory.title} ${memory.body} ${memory.tags.join(' ')}`, query) > 0 ||
          normalizeComparable(query).includes(normalizeComparable(memory.title))),
    )
  }
  if (!query.trim()) return memory.priority >= 4
  if (memory.kind === 'relationship' || memory.kind === 'character') return true
  if (memory.kind === 'profile' || memory.kind === 'preference' || memory.kind === 'procedure') {
    return memory.priority >= 3 || getKeywordOverlap(`${memory.title} ${memory.body} ${memory.tags.join(' ')}`, query) > 0
  }

  const text = `${memory.title} ${memory.body} ${memory.tags.join(' ')}`
  return memory.priority >= 4 || getKeywordOverlap(text, query) > 0 || normalizeComparable(query).includes(normalizeComparable(memory.title))
}

function inferMemoryScope(
  kind: MemoryKind,
  conversation?: ConversationState,
  character?: CharacterCard,
): MemoryScope {
  if (kind === 'relationship' && character) return { kind: 'relationship', characterId: character.id }
  if (kind === 'character' && character) return { kind: 'character_private', characterId: character.id }
  if (kind === 'world') return { kind: 'world', worldId: brand.defaultProjectId }
  if (kind === 'project') return { kind: 'project', projectId: brand.defaultProjectId }
  if (kind === 'event' && conversation) return { kind: 'conversation', conversationId: conversation.id }
  return { kind: 'global_user' }
}

function inferMemoryLayer(kind: MemoryKind, scope?: MemoryScope): MemoryLayer {
  if (scope?.kind === 'temporary') return 'working'
  if (kind === 'event' || kind === 'reflection') return 'episode'
  if (scope?.kind === 'conversation') return 'working'
  return 'stable'
}

function normalizeMemoryScope(scope: MemoryScope): MemoryScope {
  if (!scope || typeof scope !== 'object' || !('kind' in scope)) return { kind: 'global_user' }
  if (scope.kind === 'character_private' && !scope.characterId) return { kind: 'global_user' }
  if (scope.kind === 'relationship' && !scope.characterId) return { kind: 'global_user' }
  if (scope.kind === 'world' && !scope.worldId) return { kind: 'world', worldId: brand.defaultProjectId }
  if (scope.kind === 'world_branch' && (!scope.worldId || !scope.branchId)) return { kind: 'world', worldId: brand.defaultProjectId }
  if (scope.kind === 'project' && !scope.projectId) return { kind: 'project', projectId: brand.defaultProjectId }
  if (scope.kind === 'conversation' && !scope.conversationId) return { kind: 'global_user' }
  return scope
}

function isMemoryAllowedInContext(
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

function isMemoryMentionable(memory: LongTermMemory, query: string): boolean {
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

function isExplicitMemoryQuery(query: string): boolean {
  return /(还记得|记得吗|记不记得|上次|之前|以前|记忆|档案|为什么你|你刚才为什么|想起来|回忆)/.test(query)
}

function isCoolingDown(cooldownUntil?: string): boolean {
  if (!cooldownUntil) return false
  const time = new Date(cooldownUntil).getTime()
  return !Number.isNaN(time) && time > Date.now()
}

function inferSensitivity(kind: MemoryKind, text: string): MemorySensitivity {
  if (kind === 'safety') return 'critical'
  if (kind === 'taboo') return 'high'
  if (/(创伤|隐私|身体|健康|家庭|地址|学校|宿舍|焦虑|抑郁|自杀|性|真名|身份证|银行卡|密码)/.test(text)) {
    return 'high'
  }
  if (kind === 'relationship' || kind === 'profile' || kind === 'character') return 'medium'
  return 'low'
}

function inferMentionPolicy(kind: MemoryKind, sensitivity: MemorySensitivity): MemoryMentionPolicy {
  if (kind === 'taboo' || kind === 'safety') return 'silent'
  if (sensitivity === 'critical') return 'silent'
  if (sensitivity === 'high') return 'explicit'
  if (kind === 'event' || kind === 'reflection' || kind === 'relationship' || kind === 'character') return 'contextual'
  return 'proactive'
}

function serializeMemoryScope(scope: MemoryScope): string {
  switch (scope.kind) {
    case 'character_private':
    case 'relationship':
      return `${scope.kind}:${scope.characterId}`
    case 'world':
      return `${scope.kind}:${scope.worldId}`
    case 'world_branch':
      return `${scope.kind}:${scope.worldId}:${scope.branchId}`
    case 'project':
      return `${scope.kind}:${scope.projectId}`
    case 'conversation':
      return `${scope.kind}:${scope.conversationId}`
    default:
      return scope.kind
  }
}

function maxSensitivity(a: MemorySensitivity, b: MemorySensitivity): MemorySensitivity {
  const rank: Record<MemorySensitivity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }
  return rank[a] >= rank[b] ? a : b
}

function mergeMemoryLayer(a: MemoryLayer, b: MemoryLayer): MemoryLayer {
  const rank: Record<MemoryLayer, number> = {
    stable: 3,
    episode: 2,
    working: 1,
  }
  return rank[a] >= rank[b] ? a : b
}

function fingerprintMemory(memory: LongTermMemory): string {
  const input = normalizeComparable(`${serializeMemoryScope(memory.scope)}:${memory.title}:${memory.body}`)
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return `mem-${hash.toString(16)}`
}

function hasOppositePreference(first: LongTermMemory, second: LongTermMemory): boolean {
  if (!['preference', 'procedure', 'profile'].includes(first.kind)) return false
  const firstText = `${first.title} ${first.body}`
  const secondText = `${second.title} ${second.body}`
  const firstPolarity = getPolarity(firstText)
  const secondPolarity = getPolarity(secondText)
  if (firstPolarity === 'neutral' || secondPolarity === 'neutral' || firstPolarity === secondPolarity) return false

  return getKeywordOverlap(firstText, secondText) >= 2
}

function getPolarity(text: string): 'positive' | 'negative' | 'neutral' {
  const negative = /(不喜欢|讨厌|不要|别|关闭|禁止|不想|不需要|不希望|取消)/.test(text)
  const positive = /(喜欢|需要|希望|开启|保留|默认|必须|应该|想要)/.test(text)
  if (negative && !positive) return 'negative'
  if (positive && !negative) return 'positive'
  if (negative && positive) return text.search(/不喜欢|讨厌|不要|别|关闭|禁止|不想|不需要|不希望|取消/) < text.search(/喜欢|需要|希望|开启|保留|默认|必须|应该|想要/)
    ? 'negative'
    : 'positive'
  return 'neutral'
}

function getKeywordOverlap(a: string, b: string): number {
  const stopWords = new Set(['姐姐', '妹妹', '这个', '那个', '就是', '可以', '需要', '喜欢', '不喜欢', '不要', '必须'])
  const aKeywords = extractKeywords(a).filter((word) => !stopWords.has(word))
  const bKeywords = new Set(extractKeywords(b).filter((word) => !stopWords.has(word)))
  return aKeywords.filter((word) => bKeywords.has(word)).length
}

function extractKeywords(text: string): string[] {
  const compact = text.replace(/[^\p{Script=Han}a-zA-Z0-9]+/gu, ' ')
  const latin = compact.match(/[a-zA-Z0-9]{2,}/g) ?? []
  const han = compact.match(/\p{Script=Han}{2,}/gu) ?? []
  const hanPairs = han.flatMap((chunk) => {
    const pairs: string[] = []
    for (let index = 0; index < chunk.length - 1; index += 1) {
      pairs.push(chunk.slice(index, index + 2))
    }
    return pairs
  })
  return unique([...latin.map((word) => word.toLocaleLowerCase()), ...han, ...hanPairs])
}

function mergeBody(primary: string, incoming: string): string {
  const cleanPrimary = primary.trim()
  const cleanIncoming = incoming.trim()
  if (!cleanIncoming || normalizeComparable(cleanPrimary).includes(normalizeComparable(cleanIncoming))) {
    return cleanPrimary
  }
  if (!cleanPrimary) return cleanIncoming
  return `${cleanPrimary}\n补充：${cleanIncoming}`.slice(0, 720)
}

function mergeSources(a: MemorySource[], b: MemorySource[]): MemorySource[] {
  const seen = new Set<string>()
  return [...a, ...b].filter((source) => {
    const key = source.messageId ?? source.excerpt
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeComparable(value: string): string {
  return value.toLocaleLowerCase().replace(/\s|[，。！？、,.!?/\\'"“”‘’：:；;]/g, '')
}

function daysSince(value: string): number {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 99
  return (Date.now() - time) / 86_400_000
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback
  return Math.min(Math.max(value, min), max)
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
