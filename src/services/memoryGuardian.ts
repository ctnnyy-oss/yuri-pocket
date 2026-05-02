import type {
  AppTrash,
  LongTermMemory,
  MemoryConflict,
  MemoryKind,
  MemoryMentionPolicy,
  MemoryUsageLog,
} from '../domain/types'

export type MemoryGuardianSeverity = 'danger' | 'warning' | 'info'
export type MemoryTimelineKind = 'created' | 'updated' | 'called' | 'deleted' | 'candidate' | 'review'

export interface MemoryGuardianSummary {
  activeCount: number
  stableCount: number
  reviewCount: number
  protectedCount: number
  recentUsageCount: number
  healthScore: number
  healthLabel: string
}

export interface MemoryReviewItem {
  id: string
  memoryId: string
  title: string
  detail: string
  severity: MemoryGuardianSeverity
  suggestedAction: string
}

export interface MemoryTimelineItem {
  id: string
  memoryId?: string
  title: string
  detail: string
  at: string
  kind: MemoryTimelineKind
}

export interface MemoryGuardianLane {
  id: string
  label: string
  description: string
  count: number
}

export interface MemoryGuardianReport {
  summary: MemoryGuardianSummary
  lanes: MemoryGuardianLane[]
  reviewItems: MemoryReviewItem[]
  timelineItems: MemoryTimelineItem[]
}

interface BuildMemoryGuardianReportInput {
  memories: LongTermMemory[]
  conflicts: MemoryConflict[]
  usageLogs: MemoryUsageLog[]
  trash: AppTrash
  now?: Date
}

const stableKinds = new Set<MemoryKind>([
  'profile',
  'preference',
  'relationship',
  'project',
  'procedure',
  'world',
  'character',
  'taboo',
  'safety',
])

const sensitiveMentionPolicies = new Set<MemoryMentionPolicy>(['explicit', 'silent'])

export function buildMemoryGuardianReport({
  memories,
  conflicts,
  usageLogs,
  trash,
  now = new Date(),
}: BuildMemoryGuardianReportInput): MemoryGuardianReport {
  const visibleMemories = memories.filter((memory) => memory.status !== 'trashed' && memory.status !== 'permanently_deleted')
  const activeMemories = visibleMemories.filter((memory) => memory.status === 'active')
  const candidateMemories = visibleMemories.filter((memory) => memory.status === 'candidate')
  const protectedMemories = activeMemories.filter(isProtectedMemory)
  const recentUsageCount = usageLogs.filter((log) => daysBetween(log.createdAt, now) <= 7).length
  const reviewItems = buildReviewItems(visibleMemories, conflicts, now)
  const summary = buildSummary({
    activeCount: activeMemories.length,
    stableCount: activeMemories.filter((memory) => stableKinds.has(memory.kind)).length,
    reviewCount: reviewItems.length,
    protectedCount: protectedMemories.length,
    recentUsageCount,
    candidateCount: candidateMemories.length,
    conflictCount: conflicts.length,
    missingSourceCount: activeMemories.filter((memory) => memory.sources.length === 0).length,
    lowConfidenceCount: activeMemories.filter((memory) => memory.confidence < 0.72).length,
  })

  return {
    summary,
    lanes: [
      {
        id: 'stable',
        label: '稳定事实',
        description: '会长期帮助姐姐理解妹妹、角色和项目。',
        count: summary.stableCount,
      },
      {
        id: 'review',
        label: '待复查',
        description: '需要妹妹或姐姐确认，不应该悄悄影响长期回复。',
        count: summary.reviewCount,
      },
      {
        id: 'protected',
        label: '边界保护',
        description: '敏感、禁忌、冷却或只做安全边界的记忆。',
        count: summary.protectedCount,
      },
      {
        id: 'usage',
        label: '7天调用',
        description: '最近一周聊天实际用过的记忆调用记录。',
        count: summary.recentUsageCount,
      },
    ],
    reviewItems,
    timelineItems: buildTimelineItems(visibleMemories, usageLogs, trash, now),
  }
}

function buildSummary(input: {
  activeCount: number
  stableCount: number
  reviewCount: number
  protectedCount: number
  recentUsageCount: number
  candidateCount: number
  conflictCount: number
  missingSourceCount: number
  lowConfidenceCount: number
}): MemoryGuardianSummary {
  const penalty =
    input.reviewCount * 6 +
    input.candidateCount * 4 +
    input.conflictCount * 8 +
    input.missingSourceCount * 3 +
    input.lowConfidenceCount * 5
  const activityBonus = Math.min(input.recentUsageCount * 2, 10)
  const healthScore = clamp(Math.round(100 - penalty + activityBonus), 0, 100)

  return {
    activeCount: input.activeCount,
    stableCount: input.stableCount,
    reviewCount: input.reviewCount,
    protectedCount: input.protectedCount,
    recentUsageCount: input.recentUsageCount,
    healthScore,
    healthLabel: getHealthLabel(healthScore),
  }
}

function buildReviewItems(
  memories: LongTermMemory[],
  conflicts: MemoryConflict[],
  now: Date,
): MemoryReviewItem[] {
  const items: MemoryReviewItem[] = []
  const conflictMemoryIds = new Set(conflicts.flatMap((conflict) => conflict.memoryIds))

  memories.forEach((memory) => {
    if (memory.status === 'candidate') {
      items.push({
        id: `candidate-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: '这条还是候选记忆，确认前不会进入聊天提示。',
        severity: 'warning',
        suggestedAction: '确认、编辑后保存，或删除它。',
      })
    }

    if (conflictMemoryIds.has(memory.id)) {
      items.push({
        id: `conflict-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: '这条记忆卷入了冲突提醒，可能重复、相反或放错空间。',
        severity: 'danger',
        suggestedAction: '打开档案检查来源，再决定合并、迁移或归档。',
      })
    }

    if (memory.status !== 'active') return

    if (memory.confidence < 0.72) {
      items.push({
        id: `confidence-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: `可信度只有 ${Math.round(memory.confidence * 100)}%，不适合长期无脑相信。`,
        severity: 'warning',
        suggestedAction: '补充来源、提高可信度，或先归档。',
      })
    }

    if (memory.sources.length === 0) {
      items.push({
        id: `source-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: '缺少来源证据，后面很难判断它是不是旧版本遗留。',
        severity: 'info',
        suggestedAction: '手动确认内容，或等后续补来源。',
      })
    }

    if (memory.sensitivity === 'high' && !sensitiveMentionPolicies.has(memory.mentionPolicy)) {
      items.push({
        id: `sensitive-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: '高敏记忆不适合自然主动提起。',
        severity: 'danger',
        suggestedAction: '改成“问起再提”或“只做边界”。',
      })
    }

    if (memory.kind === 'relationship' && memory.scope.kind === 'global_user') {
      items.push({
        id: `scope-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: '关系记忆还在全局空间，多角色聊天时容易串戏。',
        severity: 'warning',
        suggestedAction: '迁移到当前角色关系或角色私有空间。',
      })
    }

    if (!memory.pinned && memory.accessCount === 0 && daysBetween(memory.updatedAt, now) > 45) {
      items.push({
        id: `stale-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: '这条记忆很久没有被调用，可能已经过期或权重过高。',
        severity: 'info',
        suggestedAction: '复查是否还需要保留，或者降权归档。',
      })
    }
  })

  return dedupeReviewItems(items).slice(0, 8)
}

function buildTimelineItems(
  memories: LongTermMemory[],
  usageLogs: MemoryUsageLog[],
  trash: AppTrash,
  now: Date,
): MemoryTimelineItem[] {
  const memoryTitleById = new Map(memories.map((memory) => [memory.id, memory.title]))
  const items: MemoryTimelineItem[] = []

  memories.forEach((memory) => {
    items.push({
      id: `created-${memory.id}`,
      memoryId: memory.id,
      title: memory.title,
      detail: memory.status === 'candidate' ? '捕捉为候选记忆，等待确认。' : '写入长期记忆。',
      at: memory.createdAt,
      kind: memory.status === 'candidate' ? 'candidate' : 'created',
    })

    if (Math.abs(new Date(memory.updatedAt).getTime() - new Date(memory.createdAt).getTime()) > 60_000) {
      items.push({
        id: `updated-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: `最近更新，当前权重 ${memory.priority}，可信度 ${Math.round(memory.confidence * 100)}%。`,
        at: memory.updatedAt,
        kind: 'updated',
      })
    }

    if (memory.lastAccessedAt) {
      items.push({
        id: `accessed-${memory.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: `聊天提示中累计调用 ${memory.accessCount} 次。`,
        at: memory.lastAccessedAt,
        kind: 'called',
      })
    }

    memory.revisions.slice(-2).forEach((revision) => {
      items.push({
        id: `revision-${memory.id}-${revision.id}`,
        memoryId: memory.id,
        title: memory.title,
        detail: `版本记录：${revision.reason}`,
        at: revision.createdAt,
        kind: 'updated',
      })
    })
  })

  usageLogs.slice(0, 10).forEach((log) => {
    items.push({
      id: `usage-${log.id}`,
      title: log.memoryIds.length > 0 ? '本轮聊天调用了长期记忆' : '本轮聊天只使用最近对话',
      detail:
        log.memoryIds.length > 0
          ? log.memoryIds
              .slice(0, 4)
              .map((id) => memoryTitleById.get(id) ?? '已删除记忆')
              .join(' / ')
          : '没有注入长期记忆。',
      at: log.createdAt,
      kind: 'called',
    })
  })

  trash.memories.forEach((memory) => {
    items.push({
      id: `deleted-${memory.id}`,
      memoryId: memory.id,
      title: memory.title,
      detail: '移入回收花园，仍可恢复。',
      at: memory.deletedAt,
      kind: 'deleted',
    })
  })

  return items
    .filter((item) => !Number.isNaN(new Date(item.at).getTime()) && new Date(item.at).getTime() <= now.getTime() + 60_000)
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 12)
}

function isProtectedMemory(memory: LongTermMemory): boolean {
  if (memory.kind === 'taboo' || memory.kind === 'safety') return true
  if (memory.sensitivity === 'critical' || memory.sensitivity === 'high') return true
  if (memory.mentionPolicy === 'silent' || memory.mentionPolicy === 'explicit') return true
  return Boolean(memory.cooldownUntil && new Date(memory.cooldownUntil).getTime() > Date.now())
}

function dedupeReviewItems(items: MemoryReviewItem[]): MemoryReviewItem[] {
  const rank: Record<MemoryGuardianSeverity, number> = { danger: 0, warning: 1, info: 2 }
  const bestByMemory = new Map<string, MemoryReviewItem>()

  items.forEach((item) => {
    const previous = bestByMemory.get(item.memoryId)
    if (!previous || rank[item.severity] < rank[previous.severity]) {
      bestByMemory.set(item.memoryId, item)
    }
  })

  return [...bestByMemory.values()].sort((left, right) => rank[left.severity] - rank[right.severity])
}

function getHealthLabel(score: number): string {
  if (score >= 88) return '很稳'
  if (score >= 72) return '可用'
  if (score >= 54) return '待打理'
  return '需要姐姐清园'
}

function daysBetween(value: string, now: Date): number {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 999
  return (now.getTime() - time) / 86_400_000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
