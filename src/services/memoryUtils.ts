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

const memoryConceptGroups = [
  ['记忆', '记住', '记得', '忘记', '遗忘', '回忆', '旧事', '往事', '关键往事', '弄丢', '丢失', '隔很久', '以前', '上次', '档案', '长期记忆', '召回'],
  ['偏好', '喜欢', '不喜欢', '讨厌', '希望', '想要', '习惯', '默认', '口味'],
  ['规则', '流程', '步骤', '办法', '方法', '工作流', 'procedure', '默认做法'],
  ['项目', '产品', '应用', '小窝', 'yuri', 'nest', '百合小窝', '开发'],
  ['架构', '模块', '模块化', '重构', '代码整理', '拆分', '维护', '迭代', '屎山'],
  ['agent', '智能体', '工具', '调用', '动作', '任务', '提醒', '手脚', '联网'],
  ['模型', 'api', 'key', '密钥', '中转', '供应商', 'openai', 'gemini', 'anthropic'],
  ['文档', '文件', '附件', 'pdf', 'docx', 'word', '表格', 'xlsx', '截图', '图片', '照片'],
  ['百合', 'cp', '双洁', '女主', '剧情', '人设', '小说', '创作'],
  ['语气', '称呼', '姐姐', '妹妹', '宠溺', '靠谱', '少追问', '主动推进'],
  ['五一', '假期', '劳动节', '五月', '5月', '5.1', '5-1', '长假', '最后一天'],
  ['情绪', '焦虑', '担心', '害怕', '生气', '难受', '委屈', '崩溃', '重要', '核心', '救赎', '在意'],
]

export function expandMemoryKeywords(keywords: string[]): string[] {
  const expanded = new Set(keywords)

  for (const group of memoryConceptGroups) {
    if (group.some((word) => keywords.includes(word.toLocaleLowerCase()) || keywords.includes(word))) {
      group.forEach((word) => expanded.add(word.toLocaleLowerCase()))
    }
  }

  return unique([...expanded])
}

export function extractMemoryKeywords(text: string): string[] {
  return expandMemoryKeywords(extractKeywords(text))
}

export function getKeywordOverlap(a: string, b: string): number {
  const stopWords = new Set([
    '姐姐',
    '妹妹',
    '这个',
    '那个',
    '就是',
    '可以',
    '需要',
    '喜欢',
    '不喜欢',
    '不要',
    '必须',
    '记忆',
    '记住',
    '记得',
    '忘记',
    '遗忘',
    '回忆',
    '旧事',
    '以前',
    '上次',
    '档案',
    '长期记忆',
    '召回',
    '往事',
    '关键往事',
    '弄丢',
    '丢失',
    '隔很久',
  ])
  const aKeywords = extractMemoryKeywords(a).filter((word) => !stopWords.has(word))
  const bKeywords = new Set(extractMemoryKeywords(b).filter((word) => !stopWords.has(word)))
  return aKeywords.filter((word) => bKeywords.has(word)).length
}

export function getMemorySemanticSimilarity(a: string, b: string): number {
  const left = buildMemorySparseVector(a)
  const right = buildMemorySparseVector(b)
  if (left.size === 0 || right.size === 0) return 0

  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  left.forEach((value, key) => {
    leftNorm += value * value
    dot += value * (right.get(key) ?? 0)
  })
  right.forEach((value) => {
    rightNorm += value * value
  })

  if (leftNorm === 0 || rightNorm === 0) return 0
  return dot / Math.sqrt(leftNorm * rightNorm)
}

export function hasTemporalRecallIntent(text: string): boolean {
  return /(什么时候|哪天|几号|第几天|时间线|顺序|之前|之后|后来|当时|五一|假期|最后一天|第一天|\d{1,2}月\d{1,2})/.test(text)
}

export function hasEmotionalRecallIntent(text: string): boolean {
  return /(焦虑|担心|害怕|生气|难受|委屈|崩溃|最在意|最重要|核心|放不下|为什么急|情绪)/.test(text)
}

export function extractTemporalSignals(text: string): string[] {
  const signals: string[] = []

  if (/(五一|劳动节|5\.1|5-1|五月一|5月1)/.test(text)) signals.push('holiday:mayday')
  if (/(最后一天|收尾|结束|最后|末尾)/.test(text)) signals.push('phase:end')
  if (/(第一天|开始|起步|最初|初期)/.test(text)) signals.push('phase:start')
  if (/(之前|以前|先前|前面)/.test(text)) signals.push('relative:before')
  if (/(之后|后来|后续|下一步)/.test(text)) signals.push('relative:after')

  const datePatterns = [
    /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/g,
    /(\d{1,2})月(\d{1,2})日?/g,
  ]

  for (const pattern of datePatterns) {
    for (const match of text.matchAll(pattern)) {
      const month = Number(match.length === 4 ? match[2] : match[1])
      const day = Number(match.length === 4 ? match[3] : match[2])
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        signals.push(`date:${month}-${day}`)
      }
    }
  }

  return unique(signals)
}

export function getTemporalSignalOverlap(a: string, b: string): number {
  const left = extractTemporalSignals(a)
  const right = new Set(extractTemporalSignals(b))
  return left.filter((signal) => right.has(signal)).length
}

export function estimateTextEmotionalSalience(text: string): number {
  const emotionalHits = [
    '焦虑',
    '担心',
    '害怕',
    '生气',
    '难受',
    '委屈',
    '崩溃',
    '重要',
    '核心',
    '救赎',
    '创伤',
    '永远',
    '必须',
    '不能',
  ].filter((word) => text.includes(word)).length
  const intensityHits = [
    '超级',
    '极其',
    '非常',
    '真的',
    '反复',
    '一直',
    '长期',
  ].filter((word) => text.includes(word)).length

  return clampNumber(0.22 + emotionalHits * 0.08 + intensityHits * 0.035, 0.1, 1, 0.35)
}

export function buildMemorySparseVector(text: string): Map<string, number> {
  const vector = new Map<string, number>()
  const keywords = extractMemoryKeywords(text)

  keywords.forEach((keyword) => addVectorWeight(vector, `kw:${keyword}`, 1.8))

  const compact = normalizeComparable(text)
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      addVectorWeight(vector, `ng:${compact.slice(index, index + size)}`, size === 2 ? 0.35 : 0.22)
    }
  }

  return vector
}

function addVectorWeight(vector: Map<string, number>, key: string, weight: number) {
  vector.set(key, (vector.get(key) ?? 0) + weight)
}
