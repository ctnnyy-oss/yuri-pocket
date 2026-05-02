import type { MemoryEvent, MemoryEventActor, MemoryEventType } from '../domain/types'

const maxMemoryEvents = 240

export interface CreateMemoryEventInput {
  type: MemoryEventType
  actor?: MemoryEventActor
  title: string
  detail: string
  memoryIds?: string[]
  characterId?: string
  conversationId?: string
}

export function createMemoryEvent(input: CreateMemoryEventInput): MemoryEvent {
  return {
    id: `memory-event-${crypto.randomUUID()}`,
    type: input.type,
    actor: input.actor ?? 'system',
    title: input.title,
    detail: input.detail,
    memoryIds: input.memoryIds ?? [],
    createdAt: new Date().toISOString(),
    characterId: input.characterId,
    conversationId: input.conversationId,
  }
}

export function appendMemoryEvent(events: MemoryEvent[], event: MemoryEvent): MemoryEvent[] {
  return [event, ...events].slice(0, maxMemoryEvents)
}

export function appendMemoryEvents(events: MemoryEvent[], nextEvents: MemoryEvent[]): MemoryEvent[] {
  return [...nextEvents, ...events].slice(0, maxMemoryEvents)
}

export function getMemoryEventTypeLabel(type: MemoryEventType): string {
  switch (type) {
    case 'created':
      return '写入'
    case 'captured':
      return '捕捉'
    case 'confirmed':
      return '确认'
    case 'edited':
      return '编辑'
    case 'organized':
      return '整理'
    case 'revision_restored':
      return '回滚'
    case 'trashed':
      return '回收'
    case 'restored':
      return '恢复'
    case 'permanently_deleted':
      return '遗忘'
    case 'trash_emptied':
      return '清空'
    case 'imported':
      return '导入'
    case 'reset':
      return '重置'
    case 'cloud_pushed':
      return '云存'
    case 'cloud_pulled':
      return '云取'
    case 'cloud_backup_created':
      return '云备份'
    case 'local_backup_created':
      return '本机备份'
    case 'local_backup_restored':
      return '本机恢复'
    default:
      return '事件'
  }
}
