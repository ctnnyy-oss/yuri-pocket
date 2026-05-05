import { Play, RotateCcw, type LucideIcon } from 'lucide-react'
import type { AgentTask, AgentTaskStatus } from '../../../domain/types'
import type { PlatformConnector, PlatformTaskStatus } from '../../../services/platform'

export function getPrimaryAction(
  status: AgentTaskStatus,
): { label: string; status: AgentTaskStatus; icon: LucideIcon } | null {
  if (status === 'queued') return { label: '开始', status: 'running', icon: Play }
  if (status === 'failed' || status === 'blocked') return { label: '重试', status: 'queued', icon: RotateCcw }
  return null
}

export function getPriorityLabel(priority: AgentTask['priority']) {
  if (priority === 'high') return '高优先级'
  if (priority === 'low') return '低优先级'
  return '普通'
}

export function getPermissionLabel(permission: NotificationPermission | 'unsupported') {
  if (permission === 'granted') return '已开启'
  if (permission === 'denied') return '已拒绝'
  if (permission === 'unsupported') return '不支持'
  return '待授权'
}

export function getConnectorStatusLabel(connector: PlatformConnector) {
  if (connector.status === 'env_ready') return '服务器环境已配置'
  if (connector.status === 'manual_ready') return '手动状态已记录'
  if (connector.status === 'disabled') return '已停用'
  return '等待连接'
}

export function getPlatformTaskStatusLabel(status: PlatformTaskStatus) {
  if (status === 'queued') return '等待'
  if (status === 'running') return '运行'
  if (status === 'completed') return '完成'
  if (status === 'blocked') return '卡住'
  if (status === 'cancelled') return '取消'
  return '失败'
}
