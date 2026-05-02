import type {
  MemoryKind,
  MemoryLayer,
  MemoryMentionPolicy,
  MemoryScope,
  MemorySensitivity,
  MemoryStatus,
} from './types'

export const memoryKindLabels: Record<MemoryKind, string> = {
  profile: '用户画像',
  preference: '偏好',
  relationship: '关系',
  project: '项目',
  event: '事件',
  procedure: '规则',
  world: '世界观',
  character: '角色私有',
  taboo: '禁忌',
  safety: '安全边界',
  reflection: '反思',
}

export const memoryStatusLabels: Record<MemoryStatus, string> = {
  candidate: '待确认',
  active: '生效',
  archived: '归档',
  trashed: '回收中',
  permanently_deleted: '已遗忘',
}

export const memorySensitivityLabels: Record<MemorySensitivity, string> = {
  low: '低敏',
  medium: '中敏',
  high: '高敏',
  critical: '极敏',
}

export const memoryMentionPolicyLabels: Record<MemoryMentionPolicy, string> = {
  proactive: '可自然提起',
  contextual: '相关时使用',
  explicit: '问起再提',
  silent: '只做边界',
}

export const memoryLayerLabels: Record<MemoryLayer, string> = {
  stable: '稳定事实',
  episode: '阶段事件',
  working: '临时工作',
}

export function formatMemoryScopeLabel(scope: MemoryScope): string {
  switch (scope.kind) {
    case 'global_user':
      return '全局用户'
    case 'character_private':
      return '角色私有'
    case 'relationship':
      return '当前关系'
    case 'world':
      return '世界'
    case 'world_branch':
      return '世界分支'
    case 'project':
      return '项目'
    case 'conversation':
      return '当前会话'
    case 'temporary':
      return '临时'
    default:
      return '未知空间'
  }
}
