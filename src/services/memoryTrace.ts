import type {
  LongTermMemory,
  MemoryMentionPolicy,
  MemorySensitivity,
  MemoryStatus,
  MemoryUsageLog,
} from '../domain/types'
import {
  memoryKindLabels,
  memoryLayerLabels,
  memoryMentionPolicyLabels,
  memorySensitivityLabels,
} from '../domain/memoryLabels'
import { canApplyMemoryFeedback, type MemoryFeedbackAction } from './memoryFeedback'

export interface MessageMemoryTraceItem {
  id: string
  title: string
  meta: string
  body: string
  isCoolingDown: boolean
  mentionPolicy: MemoryMentionPolicy
  sensitivity: MemorySensitivity
  status: MemoryStatus
  enabledActions: MemoryFeedbackAction[]
}

export interface MessageMemoryTrace {
  memoryCount: number
  groupTitles: string[]
  items: MessageMemoryTraceItem[]
  missingCount: number
  createdAt: string
}

export function buildMessageMemoryTrace(
  log: MemoryUsageLog,
  memories: LongTermMemory[],
): MessageMemoryTrace {
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]))
  const items = log.memoryIds
    .map((id) => memoryById.get(id))
    .filter((memory): memory is LongTermMemory => Boolean(memory))
    .slice(0, 5)
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      meta: [
        memoryKindLabels[memory.kind],
        memoryLayerLabels[memory.layer],
        memorySensitivityLabels[memory.sensitivity],
        memoryMentionPolicyLabels[memory.mentionPolicy],
        `权重 ${memory.priority}`,
        isMemoryCoolingDown(memory.cooldownUntil) ? '冷却中' : '',
        memory.status === 'archived' ? '已归档' : '',
      ]
        .filter(Boolean)
        .join(' / '),
      body: memory.body,
      isCoolingDown: isMemoryCoolingDown(memory.cooldownUntil),
      mentionPolicy: memory.mentionPolicy,
      sensitivity: memory.sensitivity,
      status: memory.status,
      enabledActions: buildEnabledActions(memory),
    }))

  return {
    memoryCount: log.memoryIds.length,
    groupTitles: log.contextBlockTitles.map(cleanContextTitle).slice(0, 4),
    items,
    missingCount: Math.max(0, log.memoryIds.length - items.length),
    createdAt: log.createdAt,
  }
}

function cleanContextTitle(title: string): string {
  return title.replace('长期记忆：', '').replace('世界树：', '')
}

function isMemoryCoolingDown(cooldownUntil?: string): boolean {
  if (!cooldownUntil) return false
  const time = new Date(cooldownUntil).getTime()
  return !Number.isNaN(time) && time > Date.now()
}

function buildEnabledActions(memory: LongTermMemory): MemoryFeedbackAction[] {
  const actions: MemoryFeedbackAction[] = ['cooldown', 'contextual', 'explicit', 'sensitive', 'archive']
  return actions.filter((action) => canApplyMemoryFeedback(memory, action))
}
