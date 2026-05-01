import { openDB } from 'idb'
import type { AppState, LongTermMemory } from '../domain/types'
import { normalizeMemories } from '../services/memoryEngine'
import { applyTrashRetention, normalizeTrashRetentionSettings } from '../services/trashRetention'
import { createSeedState } from './seed'

const databaseName = 'yuri-pocket'
const storeName = 'app'
const stateKey = 'state'

async function getDatabase() {
  return openDB(databaseName, 1, {
    upgrade(database) {
      database.createObjectStore(storeName)
    },
  })
}

export async function loadAppState(): Promise<AppState> {
  const database = await getDatabase()
  const savedState = await database.get(storeName, stateKey)
  return applyTrashRetention(migrateAppState(savedState ?? createSeedState()))
}

export async function saveAppState(state: AppState): Promise<void> {
  const database = await getDatabase()
  await database.put(storeName, applyTrashRetention(state), stateKey)
}

export async function resetAppState(): Promise<AppState> {
  const nextState = createSeedState()
  await saveAppState(nextState)
  return nextState
}

export function migrateAppState(state: AppState): AppState {
  const defaults = createSeedState()
  const sourceVersion = Number(state.version ?? 0)
  const baseMemories = normalizeMemories(state.memories ?? defaults.memories)

  const migrated = {
    ...state,
    version: 10,
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
    settings: {
      ...defaults.settings,
      ...state.settings,
      model: state.settings.model === 'gpt-5.5' ? 'deepseek/deepseek-v4-pro-free' : state.settings.model,
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
