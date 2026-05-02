import { brand } from '../../config/brand'
import { formatMemoryScopeLabel } from '../../domain/memoryLabels'
import type { CharacterCard, LocalBackupSummary, MemoryScope } from '../../domain/types'
import type { MemoryDraft } from './memoryPanelTypes'

export const defaultProjectId = brand.defaultProjectId

export function splitList(value: string): string[] {
  return value
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

export function formatShortTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCloudTime(value: string | null): string {
  if (!value) return '暂无记录'
  return formatShortTime(value)
}

export function getCloudBusyLabel(cloudBusy: 'checking' | 'pulling' | 'pushing' | 'backing-up'): string {
  if (cloudBusy === 'checking') return '正在检查云端...'
  if (cloudBusy === 'pulling') return '正在读取云端，当前本机数据会先自动备份'
  if (cloudBusy === 'backing-up') return '正在创建云端备份...'
  return '正在保存到云端...'
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export function formatBackupCounts(backup: LocalBackupSummary): string {
  return [
    `${backup.counts.memories} 条记忆`,
    `${backup.counts.worldNodes} 个世界树节点`,
    `${backup.counts.conversations} 个会话`,
    `${backup.counts.trashedItems} 个回收项`,
  ].join(' / ')
}

export function formatDeletedAt(value: string): string {
  return `删除于 ${formatShortTime(value)}`
}

export function isCoolingDown(value?: string): boolean {
  if (!value) return false
  const time = new Date(value).getTime()
  return !Number.isNaN(time) && time > Date.now()
}

export function addDaysIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function isoToLocalInput(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function localInputToIso(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

export function formatSourceTitle(kind: string, role?: string): string {
  if (kind === 'message') return role === 'user' ? '用户聊天原文' : '聊天消息'
  if (kind === 'manual') return '手动整理'
  if (kind === 'summary') return '会话摘要'
  if (kind === 'system') return '系统种子'
  return kind
}

export function scopeToDraft(scope: MemoryScope): Pick<
  MemoryDraft,
  'scopeKind' | 'characterId' | 'worldId' | 'branchId' | 'projectId' | 'conversationId'
> {
  switch (scope.kind) {
    case 'character_private':
    case 'relationship':
      return {
        scopeKind: scope.kind,
        characterId: scope.characterId,
        worldId: defaultProjectId,
        branchId: 'main',
        projectId: defaultProjectId,
        conversationId: '',
      }
    case 'world':
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: scope.worldId,
        branchId: 'main',
        projectId: defaultProjectId,
        conversationId: '',
      }
    case 'world_branch':
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: scope.worldId,
        branchId: scope.branchId,
        projectId: defaultProjectId,
        conversationId: '',
      }
    case 'project':
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: defaultProjectId,
        branchId: 'main',
        projectId: scope.projectId,
        conversationId: '',
      }
    case 'conversation':
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: defaultProjectId,
        branchId: 'main',
        projectId: defaultProjectId,
        conversationId: scope.conversationId,
      }
    case 'temporary':
    case 'global_user':
    default:
      return {
        scopeKind: scope.kind,
        characterId: '',
        worldId: defaultProjectId,
        branchId: 'main',
        projectId: defaultProjectId,
        conversationId: '',
      }
  }
}

export function draftToScope(
  draft: MemoryDraft,
  activeCharacterId: string,
  activeConversationId: string,
): MemoryScope {
  switch (draft.scopeKind) {
    case 'relationship':
      return { kind: 'relationship', characterId: draft.characterId || activeCharacterId }
    case 'character_private':
      return { kind: 'character_private', characterId: draft.characterId || activeCharacterId }
    case 'world':
      return { kind: 'world', worldId: draft.worldId.trim() || defaultProjectId }
    case 'world_branch':
      return {
        kind: 'world_branch',
        worldId: draft.worldId.trim() || defaultProjectId,
        branchId: draft.branchId.trim() || 'main',
      }
    case 'project':
      return { kind: 'project', projectId: draft.projectId.trim() || defaultProjectId }
    case 'conversation':
      return { kind: 'conversation', conversationId: draft.conversationId.trim() || activeConversationId }
    case 'temporary':
      return { kind: 'temporary' }
    case 'global_user':
    default:
      return { kind: 'global_user' }
  }
}

export function formatScopeDisplay(scope: MemoryScope, characters: CharacterCard[]): string {
  const characterName = (characterId: string) =>
    characters.find((character) => character.id === characterId)?.name ?? characterId

  switch (scope.kind) {
    case 'character_private':
      return `角色私有：${characterName(scope.characterId)}`
    case 'relationship':
      return `关系：${characterName(scope.characterId)}`
    case 'world':
      return `世界：${scope.worldId}`
    case 'world_branch':
      return `世界分支：${scope.worldId}/${scope.branchId}`
    case 'project':
      return `项目：${scope.projectId}`
    case 'conversation':
      return `会话：${scope.conversationId.slice(0, 12)}`
    case 'temporary':
      return '临时'
    case 'global_user':
    default:
      return formatMemoryScopeLabel(scope)
  }
}

export function getScopeHint(scopeKind: MemoryScope['kind']): string {
  switch (scopeKind) {
    case 'global_user':
      return '所有角色都能看见，适合语言、UI、长期偏好。'
    case 'relationship':
      return '只属于用户和某个角色的相处方式、称呼、默契。'
    case 'character_private':
      return '只给某个角色知道，适合角色设定和私有剧情。'
    case 'project':
      return `属于 ${brand.nameEn} 或其他长期项目的决策。`
    case 'world':
      return '属于世界观正史，不要写入现实用户画像。'
    case 'world_branch':
      return '属于某条时间线或草稿分支，避免污染正史。'
    case 'conversation':
      return '只在当前会话里有效，适合临时上下文。'
    case 'temporary':
      return '不会进入长期聊天提示，适合临时停放。'
    default:
      return '选择这条记忆该被谁看见。'
  }
}
