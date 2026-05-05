import type { LongTermMemory } from '../domain/types'
import {
  buildMemorySparseVector,
  getMemorySemanticSimilarity,
  normalizeComparable,
  unique,
} from './memoryUtils'

export const MEMORY_SEMANTIC_SIGNATURE_VERSION = 1

interface MemoryVectorEntry {
  memory: LongTermMemory
  vector: Map<string, number>
  buckets: Set<string>
}

export interface MemoryVectorHit {
  memory: LongTermMemory
  similarity: number
  sharedBuckets: number
}

export interface MemoryVectorIndexStats {
  total: number
  signed: number
  signatureCoverage: number
  averageSignatureSize: number
}

export function getVectorRecallHits(
  memories: LongTermMemory[],
  query: string,
  options: { limit?: number; minSimilarity?: number } = {},
): MemoryVectorHit[] {
  if (!query.trim()) return []

  const index = buildMemoryVectorIndex(memories)
  const queryVector = buildMemorySparseVector(query)
  const queryBuckets = buildMemoryBuckets(queryVector)
  const bucketCandidates = index.filter((entry) => countSharedBuckets(entry.buckets, queryBuckets) > 0)
  const candidates = bucketCandidates.length > 0 ? mergeVectorCandidates(bucketCandidates, index) : index

  return candidates
    .map((entry) => ({
      memory: entry.memory,
      similarity: getMemorySemanticSimilarity(getMemoryVectorText(entry.memory), query),
      sharedBuckets: countSharedBuckets(entry.buckets, queryBuckets),
    }))
    .filter((hit) => hit.similarity >= (options.minSimilarity ?? 0.16))
    .sort((a, b) => b.similarity - a.similarity || b.sharedBuckets - a.sharedBuckets)
    .slice(0, options.limit ?? 6)
}

function mergeVectorCandidates(primary: MemoryVectorEntry[], fallback: MemoryVectorEntry[]): MemoryVectorEntry[] {
  const seen = new Set<string>()
  return [...primary, ...fallback].filter((entry) => {
    if (seen.has(entry.memory.id)) return false
    seen.add(entry.memory.id)
    return true
  })
}

export function buildMemorySemanticSignature(memoryOrText: LongTermMemory | string, limit = 24): string[] {
  const text = typeof memoryOrText === 'string' ? memoryOrText : getMemoryVectorText(memoryOrText)
  const vector = buildMemorySparseVector(text)

  return [...vector.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key)
}

export function getVectorIndexStats(memories: LongTermMemory[]): MemoryVectorIndexStats {
  const signedMemories = memories.filter(
    (memory) =>
      memory.semanticSignatureVersion === MEMORY_SEMANTIC_SIGNATURE_VERSION &&
      Array.isArray(memory.semanticSignature) &&
      memory.semanticSignature.length > 0,
  )
  const totalSignatureSize = signedMemories.reduce(
    (sum, memory) => sum + (memory.semanticSignature?.length ?? 0),
    0,
  )

  return {
    total: memories.length,
    signed: signedMemories.length,
    signatureCoverage: memories.length > 0 ? signedMemories.length / memories.length : 1,
    averageSignatureSize: signedMemories.length > 0 ? totalSignatureSize / signedMemories.length : 0,
  }
}

function buildMemoryVectorIndex(memories: LongTermMemory[]): MemoryVectorEntry[] {
  return memories.map((memory) => {
    const vector = buildMemorySparseVector(getMemoryVectorText(memory))
    return {
      memory,
      vector,
      buckets: buildMemoryBuckets(vector, memory),
    }
  })
}

function buildMemoryBuckets(vector: Map<string, number>, memory?: LongTermMemory): Set<string> {
  if (
    memory?.semanticSignatureVersion === MEMORY_SEMANTIC_SIGNATURE_VERSION &&
    Array.isArray(memory.semanticSignature) &&
    memory.semanticSignature.length > 0
  ) {
    return new Set(unique(memory.semanticSignature).slice(0, 18))
  }

  return new Set(
    [...vector.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([key]) => key),
  )
}

function countSharedBuckets(left: Set<string>, right: Set<string>): number {
  let count = 0
  left.forEach((value) => {
    if (right.has(value)) count += 1
  })
  return count
}

function getMemoryVectorText(memory: LongTermMemory): string {
  return normalizeComparable(`${memory.title} ${memory.body} ${memory.tags.join(' ')}`)
}
