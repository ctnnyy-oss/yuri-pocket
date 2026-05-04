export function nowIso() {
  return new Date().toISOString()
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function daysSince(value: string): number {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 99
  return (Date.now() - time) / 86_400_000
}

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback
  return Math.min(Math.max(value, min), max)
}

export function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function normalizeComparable(value: string): string {
  return value.toLocaleLowerCase().replace(/\s|[，。！？、,.!?/\\'"""''：:；;]/g, '')
}

export function extractKeywords(text: string): string[] {
  const compact = text.replace(/[^\p{Script=Han}a-zA-Z0-9]+/gu, ' ')
  const latin = compact.match(/[a-zA-Z0-9]{2,}/g) ?? []
  const han = compact.match(/\p{Script=Han}{2,}/gu) ?? []
  const hanPairs = han.flatMap((chunk) => {
    const pairs: string[] = []
    for (let index = 0; index < chunk.length - 1; index += 1) {
      pairs.push(chunk.slice(index, index + 2))
    }
    return pairs
  })
  return unique([...latin.map((word) => word.toLocaleLowerCase()), ...han, ...hanPairs])
}

export function getKeywordOverlap(a: string, b: string): number {
  const stopWords = new Set(['姐姐', '妹妹', '这个', '那个', '就是', '可以', '需要', '喜欢', '不喜欢', '不要', '必须'])
  const aKeywords = extractKeywords(a).filter((word) => !stopWords.has(word))
  const bKeywords = new Set(extractKeywords(b).filter((word) => !stopWords.has(word)))
  return aKeywords.filter((word) => bKeywords.has(word)).length
}
