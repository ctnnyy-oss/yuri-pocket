// 记忆引擎入口 — re-export 所有公共 API
// 子模块：memoryCore / memoryRetrieval / promptBuilder

import type {
  AppState,
  ChatMessage,
  ConversationState,
  LongTermMemory,
  MemoryConflict,
} from '../domain/types'
import {
  createId,
  nowIso,
  normalizeMemory,
  normalizeComparable,
  isPotentialDuplicate,
  hasOppositePreference,
  serializeMemoryScope,
} from './memoryCore'

// ---- re-export 子模块公共 API ----

export type { MemoryMaintenanceReport } from './memoryCore'

export {
  nowIso,
  createId,
  normalizeMemory,
  normalizeMemories,
  createManualMemory,
  createMemorySourceFromMessage,
  updateMemoryWithRevision,
  restoreMemoryRevision,
  integrateMemoryCandidate,
  consolidateMemoryGarden,
  createMemoryTombstone,
  isMemoryBlockedByTombstones,
  maybeCaptureMemory,
  classifyMemory,
  inferMemoryKind,
  isExplicitMemoryQuery,
  serializeMemoryScope,
  isCoreMemoryAnchor,
} from './memoryCore'

export {
  getTriggeredWorldNodes,
  getActiveMemories,
  touchRelevantMemories,
} from './memoryRetrieval'

export {
  buildPromptBundle,
  createMemoryUsageLog,
  attachAssistantToMemoryUsageLog,
  getMemoryUsageLogLimit,
} from './promptBuilder'

// ---- 对话管理（留在入口） ----

export function getActiveCharacter(state: AppState) {
  return state.characters.find((character) => character.id === state.activeCharacterId) ?? state.characters[0]
}

export function getConversation(state: AppState, characterId: string): ConversationState {
  const existing = state.conversations.find((conversation) => conversation.characterId === characterId)
  if (existing) return existing

  return {
    id: createId('conv'),
    characterId,
    messages: [],
    summary: '',
    createdAt: nowIso(),
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

export function createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return {
    id: createId('msg'),
    role,
    content,
    createdAt: nowIso(),
  }
}

export function updateConversationSummary(conversation: ConversationState): ConversationState {
  const userMessages = conversation.messages.filter((message) => message.role === 'user').slice(-4)
  const summary = userMessages.map((message) => message.content).join(' / ').slice(0, 280)

  return {
    ...conversation,
    summary,
  }
}

// ---- 冲突检测 ----

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
        description: `"${memory.title}" 是关系类记忆，但还在全局空间，后面多角色时可能串戏。`,
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

      if (hasOppositePreference(first, second)) {
        conflicts.push({
          id: `conflict-value-${first.id}-${second.id}`,
          memoryIds: [first.id, second.id],
          conflictType: 'value',
          status: 'unresolved',
          title: '偏好方向可能相反',
          description: `"${first.title}" 和 "${second.title}" 可能表达了相反偏好。`,
          suggestedResolution: '以妹妹当前真实偏好为准，编辑旧记忆、归档旧记忆，或把其中一条改成特定场景偏好。',
          requiresUserConfirmation: true,
          createdAt: nowIso(),
        })
        continue
      }

      if (isPotentialDuplicate(first, second) && normalizeComparable(first.body) !== normalizeComparable(second.body)) {
        conflicts.push({
          id: `conflict-duplicate-${first.id}-${second.id}`,
          memoryIds: [first.id, second.id],
          conflictType: 'duplicate',
          status: 'unresolved',
          title: '相似记忆可能重复',
          description: `"${first.title}" 和 "${second.title}" 很像，但内容不完全一致。`,
          suggestedResolution: '保留更准确的一条，或手动合并后删除另一条。',
          requiresUserConfirmation: false,
          createdAt: nowIso(),
        })
      }
    }
  }

  return conflicts.slice(0, 12)
}
