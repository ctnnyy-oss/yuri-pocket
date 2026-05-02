import type { LongTermMemory, MemoryUsageLog } from '../domain/types'
import { memoryKindLabels, memoryLayerLabels } from '../domain/memoryLabels'

export interface MessageMemoryTraceItem {
  id: string
  title: string
  meta: string
  body: string
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
      meta: `${memoryKindLabels[memory.kind]} / ${memoryLayerLabels[memory.layer]} / 权重 ${memory.priority}`,
      body: memory.body,
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
