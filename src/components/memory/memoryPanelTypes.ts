import type {
  MemoryKind,
  MemoryLayer,
  MemoryMentionPolicy,
  MemoryScope,
  MemorySensitivity,
  MemoryStatus,
} from '../../domain/types'

export interface MemoryDraft {
  title: string
  body: string
  tags: string
  priority: number
  pinned: boolean
  kind: MemoryKind
  confidence: number
  status: MemoryStatus
  layer: MemoryLayer
  sensitivity: MemorySensitivity
  mentionPolicy: MemoryMentionPolicy
  cooldownUntil: string
  scopeKind: MemoryScope['kind']
  characterId: string
  worldId: string
  branchId: string
  projectId: string
  conversationId: string
}

export interface WorldDraft {
  title: string
  keywords: string
  content: string
  priority: number
  enabled: boolean
}
