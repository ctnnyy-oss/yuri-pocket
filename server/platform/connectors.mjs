// 后台平台连接器、执行器元数据 + 通知收件箱

import { randomUUID } from 'node:crypto'
import { clampNumber, parseJson, sanitizeShortText, sanitizeBlockText } from '../shared/utils.mjs'
import { getPlatformDatabase } from './db.mjs'

const connectorDefinitions = [
  {
    id: 'google-drive',
    label: 'Google Drive',
    category: 'cloud',
    envKeys: ['GOOGLE_DRIVE_ACCESS_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS'],
  },
  {
    id: 'github',
    label: 'GitHub',
    category: 'code',
    envKeys: ['GITHUB_TOKEN', 'GH_TOKEN'],
  },
  {
    id: 'email',
    label: 'Email',
    category: 'message',
    envKeys: ['SMTP_HOST', 'IMAP_HOST'],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    category: 'schedule',
    envKeys: ['GOOGLE_CALENDAR_ACCESS_TOKEN', 'CALENDAR_TOKEN'],
  },
]

const executorDefinitions = [
  { id: 'generic', label: '后台整理', enabled: true, risk: 'low' },
  { id: 'web_fetch', label: '网页读取', enabled: true, risk: 'medium' },
  { id: 'file_scan', label: '工作区扫描', enabled: true, risk: 'medium' },
  { id: 'connector_check', label: '账号连接检查', enabled: true, risk: 'low' },
]

// ============ 连接器 ============

export function listPlatformConnectors() {
  const stored = getPlatformDatabase()
    .prepare('SELECT id, status, label, mode, updated_at AS updatedAt, metadata FROM platform_connectors')
    .all()
  const storedById = new Map(stored.map((row) => [row.id, row]))

  return connectorDefinitions.map((definition) => {
    const row = storedById.get(definition.id)
    const envReady = definition.envKeys.some((key) => Boolean(process.env[key]))
    const status = envReady ? 'env_ready' : row?.status || 'not_connected'
    return {
      id: definition.id,
      label: row?.label || definition.label,
      category: definition.category,
      status,
      connected: envReady || status === 'manual_ready',
      mode: envReady ? 'server_env' : row?.mode || 'none',
      envReady,
      updatedAt: row?.updatedAt || null,
      metadata: parseJson(row?.metadata, {}),
    }
  })
}

export function updatePlatformConnector(connectorId, input = {}) {
  const definition = connectorDefinitions.find((item) => item.id === connectorId)
  if (!definition) return null

  const action = input.action === 'disconnect' ? 'disconnect' : 'mark_manual'
  const now = new Date().toISOString()
  const status = action === 'disconnect' ? 'disabled' : 'manual_ready'
  const mode = action === 'disconnect' ? 'none' : 'manual'
  const label = sanitizeShortText(input.label, 80) || definition.label
  const metadata = JSON.stringify({
    note: action === 'disconnect' ? '连接已在应用内停用。' : '已记录为手动连接；不在仓库中保存账号密钥。',
  })

  getPlatformDatabase()
    .prepare(
      `INSERT INTO platform_connectors (id, status, label, mode, updated_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         label = excluded.label,
         mode = excluded.mode,
         updated_at = excluded.updated_at,
         metadata = excluded.metadata`,
    )
    .run(definition.id, status, label, mode, now, metadata)

  return listPlatformConnectors().find((connector) => connector.id === definition.id) ?? null
}

// ============ 执行器元数据 ============

export function listPlatformExecutors() {
  return executorDefinitions
}

// ============ 通知收件箱 ============

export function listPlatformNotifications(limit = 40) {
  return getPlatformDatabase()
    .prepare(
      `SELECT id, title, body, kind, status, task_id AS taskId, created_at AS createdAt, seen_at AS seenAt
       FROM platform_notifications
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(clampNumber(limit, 1, 160, 40))
    .map(toPlatformNotification)
}

export function markPlatformNotificationsSeen(ids = []) {
  const cleanIds = ids.map((id) => String(id)).filter(Boolean).slice(0, 80)
  if (cleanIds.length === 0) return listPlatformNotifications()

  const now = new Date().toISOString()
  const statement = getPlatformDatabase().prepare(
    `UPDATE platform_notifications SET status = 'seen', seen_at = ? WHERE id = ? AND status != 'seen'`,
  )
  for (const id of cleanIds) statement.run(now, id)
  return listPlatformNotifications()
}

export function createPlatformNotification(input) {
  const now = new Date().toISOString()
  getPlatformDatabase()
    .prepare(
      `INSERT INTO platform_notifications (id, title, body, kind, status, task_id, created_at)
       VALUES (?, ?, ?, ?, 'unseen', ?, ?)`,
    )
    .run(
      `platform-notification-${randomUUID()}`,
      sanitizeShortText(input.title, 80) || '后台通知',
      sanitizeBlockText(input.body, 400),
      sanitizeShortText(input.kind, 40) || 'task',
      input.taskId || null,
      now,
    )
}

export function getNotificationCounts() {
  const row = getPlatformDatabase()
    .prepare("SELECT COUNT(*) AS unseen FROM platform_notifications WHERE status = 'unseen'")
    .get()
  return { unseen: Number(row?.unseen || 0) }
}

function toPlatformNotification(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    status: row.status,
    taskId: row.taskId ?? null,
    createdAt: row.createdAt,
    seenAt: row.seenAt ?? null,
  }
}
