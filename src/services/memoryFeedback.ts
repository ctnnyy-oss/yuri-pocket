import type { LongTermMemory, MemorySensitivity } from '../domain/types'

export type MemoryFeedbackAction = 'cooldown' | 'contextual' | 'explicit' | 'sensitive' | 'archive'

export interface MemoryFeedbackResult {
  detail: string
  memory: LongTermMemory
  notice: string
  revisionReason: string
}

export function applyMemoryFeedback(memory: LongTermMemory, action: MemoryFeedbackAction): MemoryFeedbackResult {
  switch (action) {
    case 'cooldown':
      return {
        detail: '妹妹在聊天记忆透镜中让这条记忆冷却 7 天，避免继续误用。',
        memory: adjustMemoryFeedbackSignals({
          ...memory,
          cooldownUntil: addDaysIso(7),
          userEdited: true,
        }, action),
        notice: '这条记忆已冷却 7 天',
        revisionReason: '聊天记忆透镜冷却',
      }
    case 'contextual':
      return {
        detail: '妹妹在聊天记忆透镜中把这条记忆改为只在相关话题时使用。',
        memory: adjustMemoryFeedbackSignals({
          ...memory,
          mentionPolicy: 'contextual',
          priority: Math.min(memory.priority, 4),
          userEdited: true,
        }, action),
        notice: '这条记忆以后会少主动出现',
        revisionReason: '聊天记忆透镜减少提及',
      }
    case 'explicit':
      return {
        detail: '妹妹在聊天记忆透镜中把这条记忆改为问起再提。',
        memory: adjustMemoryFeedbackSignals({
          ...memory,
          mentionPolicy: 'explicit',
          sensitivity: maxSensitivity(memory.sensitivity, 'medium'),
          userEdited: true,
        }, action),
        notice: '这条记忆已改成问起再提',
        revisionReason: '聊天记忆透镜改为问起再提',
      }
    case 'sensitive':
      return {
        detail: '妹妹在聊天记忆透镜中把这条记忆标为高敏，并限制为问起再提。',
        memory: adjustMemoryFeedbackSignals({
          ...memory,
          mentionPolicy: 'explicit',
          sensitivity: maxSensitivity(memory.sensitivity, 'high'),
          userEdited: true,
        }, action),
        notice: '这条记忆已设为高敏',
        revisionReason: '聊天记忆透镜标为敏感',
      }
    case 'archive':
      return {
        detail: '妹妹在聊天记忆透镜中把这条记忆归档，保留档案但停止参与聊天检索。',
        memory: adjustMemoryFeedbackSignals({
          ...memory,
          cooldownUntil: undefined,
          status: 'archived',
          userEdited: true,
        }, action),
        notice: '这条记忆已归档',
        revisionReason: '聊天记忆透镜归档',
      }
    default:
      return {
        detail: '妹妹在聊天记忆透镜中反馈了这条记忆的使用方式。',
        memory,
        notice: '记忆反馈已记录',
        revisionReason: '聊天记忆透镜反馈',
      }
  }
}

function adjustMemoryFeedbackSignals(memory: LongTermMemory, action: MemoryFeedbackAction): LongTermMemory {
  const currentStrength = memory.memoryStrength ?? 0.5
  const currentSalience = memory.emotionalSalience ?? 0.35

  if (action === 'archive') {
    return {
      ...memory,
      memoryStrength: clampSignal(currentStrength - 0.22),
      emotionalSalience: clampSignal(currentSalience - 0.18),
      reviewIntervalDays: Math.max(memory.reviewIntervalDays ?? 14, 30),
    }
  }

  if (action === 'cooldown') {
    return {
      ...memory,
      memoryStrength: clampSignal(currentStrength - 0.12),
      emotionalSalience: clampSignal(currentSalience - 0.08),
      reviewIntervalDays: Math.max(memory.reviewIntervalDays ?? 7, 14),
    }
  }

  if (action === 'contextual' || action === 'explicit') {
    return {
      ...memory,
      memoryStrength: clampSignal(currentStrength - 0.06),
      emotionalSalience: clampSignal(currentSalience - 0.04),
    }
  }

  if (action === 'sensitive') {
    return {
      ...memory,
      emotionalSalience: clampSignal(currentSalience + 0.08),
    }
  }

  return memory
}

function clampSignal(value: number): number {
  return Math.min(Math.max(value, 0.1), 1)
}

function addDaysIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
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

export function canApplyMemoryFeedback(
  memory: Pick<LongTermMemory, 'cooldownUntil' | 'mentionPolicy' | 'sensitivity' | 'status'>,
  action: MemoryFeedbackAction,
): boolean {
  if (memory.status === 'archived') return false

  switch (action) {
    case 'cooldown':
      return !isCoolingDown(memory.cooldownUntil)
    case 'contextual':
      return memory.mentionPolicy === 'proactive'
    case 'explicit':
      return memory.mentionPolicy !== 'explicit' && memory.mentionPolicy !== 'silent'
    case 'sensitive':
      return memory.sensitivity !== 'high' && memory.sensitivity !== 'critical'
    case 'archive':
      return true
    default:
      return false
  }
}

function isCoolingDown(cooldownUntil?: string): boolean {
  if (!cooldownUntil) return false
  const time = new Date(cooldownUntil).getTime()
  return !Number.isNaN(time) && time > Date.now()
}
