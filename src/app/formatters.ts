import type { CloudMetadata } from '../services/cloudSync'

export function formatCloudStatus(metadata: CloudMetadata): string {
  if (!metadata.hasState) return '云端已连接，暂时还没有保存过数据'
  return `云端有数据 v${metadata.revision}，最后保存 ${formatCloudTime(metadata.updatedAt)}`
}

export function formatCloudTime(value: string | null): string {
  if (!value) return '暂无记录'
  return formatShortDateTime(value)
}

export function formatShortDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
