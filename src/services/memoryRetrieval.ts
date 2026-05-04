import type { LongTermMemory, PromptContextBlock, WorldNode } from '../domain/types'
import { memoryKindLabels } from '../domain/memoryLabels'
import {
  normalizeMemory,
  scoreMemory,
  isMemoryAllowedInContext,
  isMemoryMentionable,
  isMemoryRelevantEnough,
  formatMemoryForPrompt,
  getMemoryGroupRank,
  nowIso,
} from './memoryCore'

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

export function buildMemoryContextBlocks(
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
