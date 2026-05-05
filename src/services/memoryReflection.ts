import type { LongTermMemory, MemorySensitivity } from '../domain/types'
import { createLongTermMemory, maxSensitivity } from './memoryCore'
import { unique } from './memoryUtils'

interface ReflectionProfile {
  title: string
  rule: string
  reviewHint: string
  tags: string[]
}

export function buildReflectionCandidates(memories: LongTermMemory[]): LongTermMemory[] {
  const activeMemories = memories.filter((memory) => memory.status === 'active' || memory.status === 'candidate')
  const existingReflectionTopics = new Set(
    activeMemories
      .filter((memory) => memory.kind === 'reflection')
      .map((memory) => normalizeReflectionTopic(memory.title)),
  )
  const groups = new Map<string, LongTermMemory[]>()

  for (const memory of activeMemories) {
    const topic = inferReflectionTopic(memory)
    if (!topic) continue
    groups.set(topic, [...(groups.get(topic) ?? []), memory])
  }

  const candidates: LongTermMemory[] = []
  for (const [topic, items] of groups.entries()) {
    const uniqueItems = items.filter((memory, index, array) => array.findIndex((item) => item.id === memory.id) === index)
    if (uniqueItems.length < 2 || existingReflectionTopics.has(normalizeReflectionTopic(topic))) continue

    const profile = buildReflectionProfile(topic, uniqueItems)
    const sources = uniqueItems.flatMap((memory) => memory.sources).slice(0, 8)
    const evidenceTitles = uniqueItems.slice(0, 5).map((memory) => memory.title).join(' / ')
    const timeRange = formatMemoryTimeRange(uniqueItems)

    candidates.push(createLongTermMemory({
      title: profile.title,
      body: [
        `多条记忆共同指向「${topic}」。`,
        `可沉淀原则：${profile.rule}`,
        `证据：${evidenceTitles}`,
        `时间线：${timeRange}`,
        `仍需确认：${profile.reviewHint}`,
      ].join('\n'),
      tags: unique(['反思整理', '可解释反思', topic, ...profile.tags, ...uniqueItems.flatMap((memory) => memory.tags).slice(0, 6)]),
      priority: Math.min(5, Math.max(...uniqueItems.map((memory) => memory.priority), 3) + (uniqueItems.length >= 3 ? 1 : 0)),
      pinned: false,
      kind: 'reflection',
      layer: 'episode',
      confidence: uniqueItems.length >= 3 ? 0.84 : 0.78,
      status: 'candidate',
      scope: uniqueItems[0]?.scope ?? { kind: 'global_user' },
      sensitivity: uniqueItems.reduce(
        (level, memory) => maxSensitivity(level, memory.sensitivity),
        'low' as MemorySensitivity,
      ),
      mentionPolicy: 'explicit',
      origin: 'system',
      sources: sources.length > 0 ? sources : uniqueItems[0]?.sources ?? [],
      reason: '后台整理可解释反思候选',
    }))
  }

  return candidates.slice(0, 4)
}

function buildReflectionProfile(topic: string, items: LongTermMemory[]): ReflectionProfile {
  const kinds = new Set(items.map((memory) => memory.kind))
  const hasRule = kinds.has('procedure') || kinds.has('preference')

  if (topic === '记忆系统') {
    return {
      title: '整理建议：记忆系统',
      rule: '记忆需求要同时保留旧事线索、来源证据、重要程度和人工校准入口；不能只靠最近几轮上下文。',
      reviewHint: hasRule ? '确认哪些内容应升级为稳定规则，哪些只保留为阶段事件。' : '确认这些事件是否已经足够稳定，可以沉淀成长期记忆规则。',
      tags: ['记忆系统', '长期记忆', '反思'],
    }
  }

  if (topic === '架构与模块化') {
    return {
      title: '整理建议：架构与模块化',
      rule: '项目初期每次大改都要保持入口薄、职责清楚、评测可重复，避免后续维护成本堆高。',
      reviewHint: '确认是否要把这条作为项目长期维护规则。',
      tags: ['架构', '模块化', '维护'],
    }
  }

  if (topic === 'Agent 能力') {
    return {
      title: '整理建议：Agent 能力',
      rule: 'Agent 能力要有可见决策、风险闸门和工具边界，不能假装已经完成外部操作。',
      reviewHint: '确认哪些 Agent 行为应变成默认工作流。',
      tags: ['Agent', '工具', '护栏'],
    }
  }

  if (topic === '相处方式') {
    return {
      title: '整理建议：相处方式',
      rule: '姐姐回复要宠溺但靠谱，少追问，能低风险推进时主动推进，同时保留专业判断。',
      reviewHint: '确认这条是否覆盖当前相处偏好，避免旧语气规则和新规则冲突。',
      tags: ['语气', '姐姐', '妹妹'],
    }
  }

  return {
    title: `整理建议：${topic}`,
    rule: `围绕「${topic}」的多条记忆需要被审核后压缩成更稳定的项目事实、偏好或阶段事件。`,
    reviewHint: '确认这组记忆是否代表长期规律，还是只记录为一段阶段进展。',
    tags: [topic],
  }
}

function inferReflectionTopic(memory: LongTermMemory): string | null {
  const text = `${memory.title} ${memory.body} ${memory.tags.join(' ')}`
  if (/架构|模块|重构|代码整理|屎山|维护|迭代/.test(text)) return '架构与模块化'
  if (/记忆|记住|回忆|忘记|长期记忆|召回/.test(text)) return '记忆系统'
  if (/agent|Agent|智能体|工具|动作|任务|提醒|联网/.test(text)) return 'Agent 能力'
  if (/模型|API|api|密钥|中转|供应商/.test(text)) return '模型接入'
  if (/文档|文件|附件|图片|截图|PDF|pdf|docx|Word/.test(text)) return '文档与图片能力'
  if (/百合|CP|cp|双洁|剧情|人设|小说/.test(text)) return '百合创作'
  if (/语气|称呼|姐姐|妹妹|少追问|主动推进|宠溺|靠谱/.test(text)) return '相处方式'
  return null
}

function normalizeReflectionTopic(value: string): string {
  return value.replace(/^整理建议：/, '').trim()
}

function formatMemoryTimeRange(memories: LongTermMemory[]): string {
  const timestamps = memories
    .flatMap((memory) => [memory.createdAt, memory.updatedAt, ...memory.sources.map((source) => source.createdAt)])
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b)

  if (timestamps.length === 0) return '暂无明确时间证据'
  const first = formatDate(timestamps[0])
  const last = formatDate(timestamps[timestamps.length - 1])
  return first === last ? first : `${first} 至 ${last}`
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp)
}
