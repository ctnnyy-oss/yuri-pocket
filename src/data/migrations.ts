import { brand } from '../config/brand'
import type { AppState, LongTermMemory, MemoryScope } from '../domain/types'
import { normalizeMemories } from '../services/memoryEngine'
import { normalizeTrashRetentionSettings } from '../services/trashRetention'
import { createSeedState } from './seed'

const currentStateVersion = 11
const legacyProjectId = brand.legacyProjectId
const currentProjectId = brand.defaultProjectId

export function migrateAppState(state: AppState): AppState {
  const defaults = createSeedState()
  const sourceVersion = Number(state.version ?? 0)
  const sourceSettings = state.settings ?? defaults.settings
  const baseMemories = normalizeMemories(state.memories ?? defaults.memories)
  const migratedMemories = sourceVersion < 11 ? migrateYuriNestBranding(baseMemories) : baseMemories

  const migrated = {
    ...state,
    version: currentStateVersion,
    memories: sourceVersion < 10 ? mergeMissingSeedMemories(migratedMemories, defaults.memories) : migratedMemories,
    trash: {
      memories: (sourceVersion < 11
        ? migrateYuriNestBranding(normalizeMemories(state.trash?.memories ?? defaults.trash.memories))
        : normalizeMemories(state.trash?.memories ?? defaults.trash.memories)
      ).map((memory, index) => ({
        ...memory,
        deletedAt: state.trash?.memories?.[index]?.deletedAt ?? memory.updatedAt,
      })),
      worldNodes: state.trash?.worldNodes ?? defaults.trash.worldNodes,
    },
    memoryTombstones: Array.isArray(state.memoryTombstones) ? state.memoryTombstones : defaults.memoryTombstones,
    memoryUsageLogs: Array.isArray(state.memoryUsageLogs) ? state.memoryUsageLogs : defaults.memoryUsageLogs,
    settings: {
      ...defaults.settings,
      ...sourceSettings,
      model: sourceSettings.model === 'gpt-5.5' ? 'deepseek/deepseek-v4-pro-free' : sourceSettings.model,
    },
  }

  migrated.settings = normalizeTrashRetentionSettings(migrated.settings)
  const memoryConfidenceFloor = Number(migrated.settings.memoryConfidenceFloor)
  migrated.settings.memoryConfidenceFloor = Number.isNaN(memoryConfidenceFloor)
    ? defaults.settings.memoryConfidenceFloor
    : Math.min(Math.max(memoryConfidenceFloor, 0.5), 0.95)
  return migrated
}

function migrateYuriNestBranding(memories: LongTermMemory[]): LongTermMemory[] {
  return memories.map((memory) => {
    const scope = migrateLegacyScope(memory.scope)
    const shouldRefreshSeedText = memory.origin === 'seed' && !memory.userEdited

    return {
      ...memory,
      title: shouldRefreshSeedText ? replaceLegacyBrandText(memory.title) : memory.title,
      body: shouldRefreshSeedText ? replaceLegacyBrandText(memory.body) : memory.body,
      tags: shouldRefreshSeedText ? memory.tags.map(replaceLegacyBrandText) : memory.tags,
      scope,
      sources: shouldRefreshSeedText
        ? memory.sources.map((source) => ({
            ...source,
            excerpt: replaceLegacyBrandText(source.excerpt),
          }))
        : memory.sources,
      revisions: shouldRefreshSeedText
        ? memory.revisions.map((revision) => ({
            ...revision,
            snapshot: {
              ...revision.snapshot,
              title: replaceLegacyBrandText(revision.snapshot.title),
              body: replaceLegacyBrandText(revision.snapshot.body),
              tags: revision.snapshot.tags.map(replaceLegacyBrandText),
              scope: migrateLegacyScope(revision.snapshot.scope),
            },
          }))
        : memory.revisions,
    }
  })
}

function migrateLegacyScope(scope: MemoryScope): MemoryScope {
  if (scope.kind === 'project' && scope.projectId === legacyProjectId) {
    return { ...scope, projectId: currentProjectId }
  }
  if (scope.kind === 'world' && scope.worldId === legacyProjectId) {
    return { ...scope, worldId: currentProjectId }
  }
  if (scope.kind === 'world_branch' && scope.worldId === legacyProjectId) {
    return { ...scope, worldId: currentProjectId }
  }
  return scope
}

function replaceLegacyBrandText(value: string): string {
  return value
    .replace(/Sakura Pocket/g, 'Yuri Nest')
    .replace(/百合口袋/g, '百合小窝')
    .replace(/百合小手机/g, '百合小窝')
}

function mergeMissingSeedMemories(memories: LongTermMemory[], seedMemories: LongTermMemory[]): LongTermMemory[] {
  const existingIds = new Set(memories.map((memory) => memory.id))
  const missingSeeds = normalizeMemories(seedMemories).filter((memory) => !existingIds.has(memory.id))
  return [...missingSeeds, ...memories]
}

