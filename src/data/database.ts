import { openDB } from 'idb'
import { brand } from '../config/brand'
import type { AppState, LocalBackup, LocalBackupSummary, LongTermMemory, MemoryScope } from '../domain/types'
import { normalizeMemories } from '../services/memoryEngine'
import { applyTrashRetention, normalizeTrashRetentionSettings } from '../services/trashRetention'
import { createSeedState } from './seed'

const databaseName = 'yuri-pocket'
const storeName = 'app'
const stateKey = 'state'
const backupKeyPrefix = 'backup:'
const maxLocalBackups = 12
const legacyProjectId = brand.legacyProjectId
const currentProjectId = brand.defaultProjectId

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

export async function createLocalBackup(state: AppState, reason: string): Promise<LocalBackupSummary> {
  const database = await getDatabase()
  const backup = buildLocalBackup(applyTrashRetention(state), reason)
  await database.put(storeName, backup, backupKey(backup.id))
  await pruneLocalBackups()
  return toBackupSummary(backup)
}

export async function listLocalBackups(): Promise<LocalBackupSummary[]> {
  const database = await getDatabase()
  const backups = await readLocalBackups(database)
  return backups.map(toBackupSummary)
}

export async function loadLocalBackup(backupId: string): Promise<AppState | null> {
  const database = await getDatabase()
  const backup = (await database.get(storeName, backupKey(backupId))) as LocalBackup | undefined
  return backup?.state ? migrateAppState(backup.state) : null
}

export async function deleteLocalBackup(backupId: string): Promise<void> {
  const database = await getDatabase()
  await database.delete(storeName, backupKey(backupId))
}

export function migrateAppState(state: AppState): AppState {
  const defaults = createSeedState()
  const sourceVersion = Number(state.version ?? 0)
  const baseMemories = normalizeMemories(state.memories ?? defaults.memories)
  const migratedMemories = sourceVersion < 11 ? migrateYuriNestBranding(baseMemories) : baseMemories

  const migrated = {
    ...state,
    version: 11,
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

function buildLocalBackup(state: AppState, reason: string): LocalBackup {
  const createdAt = new Date().toISOString()
  const suffix = createdAt.slice(0, 19).replace(/[T:]/g, '-')
  return {
    id: `local-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
    label: `本机备份 ${createdAt.slice(0, 10)}`,
    reason,
    createdAt,
    stateVersion: state.version,
    counts: {
      conversations: state.conversations.length,
      memories: state.memories.length,
      worldNodes: state.worldNodes.length,
      trashedItems: state.trash.memories.length + state.trash.worldNodes.length,
    },
    state,
  }
}

function toBackupSummary(backup: LocalBackup): LocalBackupSummary {
  return {
    id: backup.id,
    label: backup.label,
    reason: backup.reason,
    createdAt: backup.createdAt,
    stateVersion: backup.stateVersion,
    counts: backup.counts,
  }
}

function backupKey(backupId: string): string {
  return `${backupKeyPrefix}${backupId}`
}

async function readLocalBackups(database: Awaited<ReturnType<typeof getDatabase>>): Promise<LocalBackup[]> {
  const keys = await database.getAllKeys(storeName)
  const backupKeys = keys.filter((key): key is string => typeof key === 'string' && key.startsWith(backupKeyPrefix))
  const backups = await Promise.all(
    backupKeys.map(async (key) => (await database.get(storeName, key)) as LocalBackup | undefined),
  )
  return backups
    .filter((backup): backup is LocalBackup => Boolean(backup?.state))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

async function pruneLocalBackups(): Promise<void> {
  const database = await getDatabase()
  const backups = await readLocalBackups(database)
  await Promise.all(backups.slice(maxLocalBackups).map((backup) => database.delete(storeName, backupKey(backup.id))))
}
