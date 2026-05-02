import type { AppState, LongTermMemory } from '../domain/types'
import { normalizeMemories } from '../services/memoryEngine'
import { normalizeTrashRetentionSettings } from '../services/trashRetention'
import { createSeedState } from './seed'

const currentStateVersion = 15

export function migrateAppState(state: AppState): AppState {
  const defaults = createSeedState()
  const sourceVersion = Number(state.version ?? 0)
  const sourceSettings = state.settings ?? defaults.settings
  const baseMemories = normalizeMemories(state.memories ?? defaults.memories)

  const migrated = {
    ...state,
    version: currentStateVersion,
    memories: sourceVersion < 10 ? mergeMissingSeedMemories(baseMemories, defaults.memories) : baseMemories,
    trash: {
      memories: normalizeMemories(state.trash?.memories ?? defaults.trash.memories).map((memory, index) => ({
        ...memory,
        deletedAt: state.trash?.memories?.[index]?.deletedAt ?? memory.updatedAt,
      })),
      worldNodes: state.trash?.worldNodes ?? defaults.trash.worldNodes,
    },
    memoryTombstones: Array.isArray(state.memoryTombstones) ? state.memoryTombstones : defaults.memoryTombstones,
    memoryUsageLogs: Array.isArray(state.memoryUsageLogs) ? state.memoryUsageLogs : defaults.memoryUsageLogs,
    memoryEvents: Array.isArray(state.memoryEvents) ? state.memoryEvents : defaults.memoryEvents,
    settings: {
      ...defaults.settings,
      ...sourceSettings,
      model: normalizeDefaultModel(sourceSettings.model),
      modelProfileId: sourceSettings.modelProfileId || defaults.settings.modelProfileId,
      maxOutputTokens: clampNumber(sourceSettings.maxOutputTokens, 512, 32768, defaults.settings.maxOutputTokens),
    },
  }

  migrated.settings = normalizeTrashRetentionSettings(migrated.settings)
  const memoryConfidenceFloor = Number(migrated.settings.memoryConfidenceFloor)
  migrated.settings.memoryConfidenceFloor = Number.isNaN(memoryConfidenceFloor)
    ? defaults.settings.memoryConfidenceFloor
    : Math.min(Math.max(memoryConfidenceFloor, 0.5), 0.95)
  return migrated
}

function mergeMissingSeedMemories(memories: LongTermMemory[], seedMemories: LongTermMemory[]): LongTermMemory[] {
  const existingIds = new Set(memories.map((memory) => memory.id))
  const missingSeeds = normalizeMemories(seedMemories).filter((memory) => !existingIds.has(memory.id))
  return [...missingSeeds, ...memories]
}

function normalizeDefaultModel(model: string | undefined): string {
  if (!model || model === 'gpt-5.5' || model === 'deepseek/deepseek-v4-pro-free') return 'deepseek-v4-flash'
  return model
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(max, Math.max(min, numericValue))
}
