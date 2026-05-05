import type { LongTermMemory, MemoryEmbeddingRecord } from '../domain/types'
import {
  buildMemorySparseVector,
  createId,
  normalizeComparable,
  nowIso,
} from './memoryUtils'
import { MEMORY_SEMANTIC_SIGNATURE_VERSION } from './memoryVectorIndex'

export const MEMORY_EMBEDDING_MODEL = 'local-semantic-hash-v1'
export const MEMORY_EMBEDDING_DIMENSIONS = 64

export interface MemoryEmbeddingProvider {
  id: string
  dimensions?: number
  embedTexts: (texts: string[]) => Promise<number[][]>
}

export interface MemoryEmbeddingHit {
  memory: LongTermMemory
  similarity: number
  sharedBuckets: number
}

export interface MemoryEmbeddingCacheStats {
  totalMemories: number
  cached: number
  stale: number
  coverage: number
  model: string
  dimensions: number
}

export function refreshLocalMemoryEmbeddingCache(
  memories: LongTermMemory[],
  records: MemoryEmbeddingRecord[] = [],
): MemoryEmbeddingRecord[] {
  const refreshedLocal = refreshMemoryEmbeddingRecords(
    memories,
    records.filter((record) => record.model === MEMORY_EMBEDDING_MODEL),
    (text) => buildLocalMemoryEmbedding(text),
  )
  return [...refreshedLocal, ...keepCompatibleExternalRecords(memories, records)]
}

export async function refreshMemoryEmbeddingCache(
  memories: LongTermMemory[],
  records: MemoryEmbeddingRecord[] = [],
  provider?: MemoryEmbeddingProvider,
): Promise<MemoryEmbeddingRecord[]> {
  if (!provider) return refreshLocalMemoryEmbeddingCache(memories, records)

  const reusable = new Map(records.map((record) => [record.memoryId, record]))
  const next: MemoryEmbeddingRecord[] = []
  const missing: Array<{ memory: LongTermMemory; text: string; hash: string }> = []

  for (const memory of memories) {
    const text = getMemoryEmbeddingText(memory)
    const hash = hashEmbeddingText(text)
    const existing = reusable.get(memory.id)
    if (isReusableEmbeddingRecord(existing, memory, hash, provider.id, provider.dimensions)) {
      next.push(existing)
      continue
    }
    missing.push({ memory, text, hash })
  }

  const vectors = missing.length > 0 ? await provider.embedTexts(missing.map((item) => item.text)) : []
  missing.forEach((item, index) => {
    const vector = vectors[index] ?? []
    next.push(createEmbeddingRecord(item.memory, item.hash, provider.id, provider.dimensions ?? vector.length, vector))
  })

  return next
}

export function getEmbeddingRecallHits(
  memories: LongTermMemory[],
  query: string,
  records: MemoryEmbeddingRecord[],
  options: { limit?: number; minSimilarity?: number } = {},
): MemoryEmbeddingHit[] {
  if (!query.trim()) return []

  const queryVector = buildLocalMemoryEmbedding(query)
  return getEmbeddingRecallHitsForVector(memories, queryVector, records, {
    ...options,
    model: MEMORY_EMBEDDING_MODEL,
  })
}

export function getEmbeddingRecallHitsForVector(
  memories: LongTermMemory[],
  queryVector: number[],
  records: MemoryEmbeddingRecord[],
  options: { limit?: number; minSimilarity?: number; model?: string } = {},
): MemoryEmbeddingHit[] {
  if (queryVector.length === 0) return []

  const recordByMemoryId = getRecordByMemoryId(records, options.model)
  const queryBuckets = buildEmbeddingBuckets(queryVector)
  const entries = memories
    .map((memory) => {
      const record = recordByMemoryId.get(memory.id)
      return record ? { memory, record, buckets: buildEmbeddingBuckets(record.vector) } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  const bucketCandidates = entries.filter((entry) => countSharedBuckets(entry.buckets, queryBuckets) > 0)
  const candidates = bucketCandidates.length > 0 ? mergeEmbeddingCandidates(bucketCandidates, entries) : entries

  return candidates
    .map((entry) => ({
      memory: entry.memory,
      similarity: cosineSimilarity(entry.record.vector, queryVector),
      sharedBuckets: countSharedBuckets(entry.buckets, queryBuckets),
    }))
    .filter((hit) => hit.similarity >= (options.minSimilarity ?? 0.18))
    .sort((a, b) => b.similarity - a.similarity || b.sharedBuckets - a.sharedBuckets)
    .slice(0, options.limit ?? 6)
}

export function getEmbeddingCacheStats(
  memories: LongTermMemory[],
  records: MemoryEmbeddingRecord[] = [],
  model = MEMORY_EMBEDDING_MODEL,
): MemoryEmbeddingCacheStats {
  const recordByMemoryId = getRecordByMemoryId(records, model)
  let cached = 0
  let stale = 0

  memories.forEach((memory) => {
    const text = getMemoryEmbeddingText(memory)
    const record = recordByMemoryId.get(memory.id)
    if (isReusableEmbeddingRecord(record, memory, hashEmbeddingText(text), model, model === MEMORY_EMBEDDING_MODEL ? MEMORY_EMBEDDING_DIMENSIONS : undefined)) {
      cached += 1
    } else {
      stale += 1
    }
  })

  return {
    totalMemories: memories.length,
    cached,
    stale,
    coverage: memories.length > 0 ? cached / memories.length : 1,
    model,
    dimensions: records.find((record) => record.model === model)?.dimensions ?? MEMORY_EMBEDDING_DIMENSIONS,
  }
}

export function getMemoryEmbeddingInput(memory: LongTermMemory): string {
  return `${memory.title}\n${memory.body}\n标签：${memory.tags.join(' / ')}`
}

export function upsertMemoryEmbeddingRecordsFromVectors(
  memories: LongTermMemory[],
  records: MemoryEmbeddingRecord[],
  model: string,
  vectors: number[][],
): MemoryEmbeddingRecord[] {
  const targetIds = new Set(memories.map((memory) => memory.id))
  const keptRecords = records.filter((record) => record.model !== model || !targetIds.has(record.memoryId))
  const nextRecords = memories
    .map((memory, index) => {
      const vector = vectors[index] ?? []
      if (vector.length === 0) return null
      return createEmbeddingRecord(memory, hashEmbeddingText(getMemoryEmbeddingText(memory)), model, vector.length, vector)
    })
    .filter((record): record is MemoryEmbeddingRecord => Boolean(record))
  return [...keptRecords, ...nextRecords]
}

function refreshMemoryEmbeddingRecords(
  memories: LongTermMemory[],
  records: MemoryEmbeddingRecord[],
  embedText: (text: string) => number[],
): MemoryEmbeddingRecord[] {
  const reusable = new Map(records.map((record) => [record.memoryId, record]))

  return memories.map((memory) => {
    const text = getMemoryEmbeddingText(memory)
    const hash = hashEmbeddingText(text)
    const existing = reusable.get(memory.id)
    if (isReusableEmbeddingRecord(existing, memory, hash, MEMORY_EMBEDDING_MODEL, MEMORY_EMBEDDING_DIMENSIONS)) {
      return existing
    }
    return createEmbeddingRecord(memory, hash, MEMORY_EMBEDDING_MODEL, MEMORY_EMBEDDING_DIMENSIONS, embedText(text))
  })
}

function createEmbeddingRecord(
  memory: LongTermMemory,
  textHash: string,
  model: string,
  dimensions: number,
  vector: number[],
): MemoryEmbeddingRecord {
  const createdAt = nowIso()
  return {
    id: createId('embedding'),
    memoryId: memory.id,
    model,
    dimensions,
    textHash,
    signatureVersion: memory.semanticSignatureVersion ?? MEMORY_SEMANTIC_SIGNATURE_VERSION,
    vector: normalizeVector(vector, dimensions),
    createdAt,
    updatedAt: createdAt,
  }
}

function isReusableEmbeddingRecord(
  record: MemoryEmbeddingRecord | undefined,
  memory: LongTermMemory,
  textHash: string,
  model: string,
  dimensions?: number,
): record is MemoryEmbeddingRecord {
  return Boolean(
    record &&
    record.model === model &&
    (dimensions === undefined || record.dimensions === dimensions) &&
    record.textHash === textHash &&
    record.signatureVersion === (memory.semanticSignatureVersion ?? MEMORY_SEMANTIC_SIGNATURE_VERSION) &&
    record.vector.length === record.dimensions &&
    record.vector.length > 0,
  )
}

function buildLocalMemoryEmbedding(text: string): number[] {
  const vector = new Array<number>(MEMORY_EMBEDDING_DIMENSIONS).fill(0)
  buildMemorySparseVector(text).forEach((weight, key) => {
    const hash = stableHash(key)
    const index = hash % MEMORY_EMBEDDING_DIMENSIONS
    const sign = hash % 2 === 0 ? 1 : -1
    vector[index] += sign * weight
  })
  return normalizeVector(vector, MEMORY_EMBEDDING_DIMENSIONS)
}

function normalizeVector(vector: number[], dimensions: number): number[] {
  const normalized = vector.slice(0, dimensions)
  while (normalized.length < dimensions) normalized.push(0)
  const norm = Math.sqrt(normalized.reduce((sum, value) => sum + value * value, 0))
  if (norm === 0) return normalized
  return normalized.map((value) => Number((value / norm).toFixed(6)))
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length)
  let score = 0
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index]
  }
  return score
}

function buildEmbeddingBuckets(vector: number[]): Set<string> {
  return new Set(
    vector
      .map((value, index) => ({ key: `${index}:${value >= 0 ? 'p' : 'n'}`, value: Math.abs(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((bucket) => bucket.key),
  )
}

function countSharedBuckets(left: Set<string>, right: Set<string>): number {
  let count = 0
  left.forEach((value) => {
    if (right.has(value)) count += 1
  })
  return count
}

function mergeEmbeddingCandidates<T extends { memory: LongTermMemory }>(primary: T[], fallback: T[]): T[] {
  const seen = new Set<string>()
  return [...primary, ...fallback].filter((entry) => {
    if (seen.has(entry.memory.id)) return false
    seen.add(entry.memory.id)
    return true
  })
}

function getRecordByMemoryId(records: MemoryEmbeddingRecord[], model = MEMORY_EMBEDDING_MODEL): Map<string, MemoryEmbeddingRecord> {
  return new Map(
    records
      .filter((record) => record.model === model)
      .map((record) => [record.memoryId, record]),
  )
}

function keepCompatibleExternalRecords(
  memories: LongTermMemory[],
  records: MemoryEmbeddingRecord[],
): MemoryEmbeddingRecord[] {
  const memoryIds = new Set(memories.map((memory) => memory.id))
  return records.filter((record) => record.model !== MEMORY_EMBEDDING_MODEL && memoryIds.has(record.memoryId))
}

function getMemoryEmbeddingText(memory: LongTermMemory): string {
  return normalizeComparable(`${memory.title} ${memory.body} ${memory.tags.join(' ')}`)
}

function hashEmbeddingText(text: string): string {
  return stableHash(normalizeComparable(text)).toString(36)
}

function stableHash(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}
