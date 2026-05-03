import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const TASK_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'blocked', 'cancelled'])
const TASK_PRIORITIES = new Set(['low', 'medium', 'high'])
const TASK_KINDS = new Set(['generic', 'web_fetch', 'file_scan', 'connector_check'])
const WORKER_INTERVAL_MS = 5_000
const MAX_TASK_LOGS = 24
const MAX_TASK_STEPS = 8
const WEB_FETCH_TIMEOUT_MS = 10_000

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
  {
    id: 'generic',
    label: '后台整理',
    enabled: true,
    risk: 'low',
  },
  {
    id: 'web_fetch',
    label: '网页读取',
    enabled: true,
    risk: 'medium',
  },
  {
    id: 'file_scan',
    label: '工作区扫描',
    enabled: true,
    risk: 'medium',
  },
  {
    id: 'connector_check',
    label: '账号连接检查',
    enabled: true,
    risk: 'low',
  },
]

let platformDatabase
let workerTimer
let workerBusy = false

export function initializePlatform() {
  getPlatformDatabase()
}

export function startPlatformWorker() {
  initializePlatform()
  if (workerTimer) return
  workerTimer = setInterval(() => {
    void processNextPlatformTask()
  }, WORKER_INTERVAL_MS)
  void processNextPlatformTask()
}

export function getPlatformStatus() {
  const counts = getTaskCounts()
  const notifications = getNotificationCounts()
  return {
    ok: true,
    worker: {
      enabled: Boolean(workerTimer),
      intervalMs: WORKER_INTERVAL_MS,
    },
    queue: counts,
    notifications,
    connectors: listPlatformConnectors(),
    executors: listPlatformExecutors(),
  }
}

export function listPlatformTasks(limit = 80) {
  return getPlatformDatabase()
    .prepare(
      `SELECT id, title, detail, kind, status, priority, source, created_at AS createdAt,
              updated_at AS updatedAt, started_at AS startedAt, completed_at AS completedAt,
              result, error, logs, steps
       FROM platform_tasks
       ORDER BY
         CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'blocked' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END,
         CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         updated_at DESC
       LIMIT ?`,
    )
    .all(clampNumber(limit, 1, 240, 80))
    .map(toPlatformTask)
}

export function createPlatformTask(input = {}) {
  const now = new Date().toISOString()
  const task = normalizePlatformTaskInput(input)
  const id = `platform-task-${randomUUID()}`
  const logs = [`${formatLogTime(now)} 已进入后台队列。`]
  const steps = normalizeTaskSteps(task.steps, task.kind)

  getPlatformDatabase()
    .prepare(
      `INSERT INTO platform_tasks
        (id, title, detail, kind, status, priority, source, created_at, updated_at, logs, steps)
       VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, task.title, task.detail, task.kind, task.priority, task.source, now, now, JSON.stringify(logs), JSON.stringify(steps))

  void processNextPlatformTask()
  return readPlatformTask(id)
}

export function updatePlatformTask(taskId, input = {}) {
  const task = readPlatformTask(taskId)
  if (!task) return null

  const status = TASK_STATUSES.has(input.status) ? input.status : task.status
  const now = new Date().toISOString()
  const logs = [...task.logs, `${formatLogTime(now)} 状态改为 ${status}。`].slice(-MAX_TASK_LOGS)
  const nextSteps = transitionTaskSteps(task.steps, status)

  getPlatformDatabase()
    .prepare(
      `UPDATE platform_tasks
       SET status = ?, updated_at = ?, logs = ?, steps = ?,
           completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN ? ELSE completed_at END
       WHERE id = ?`,
    )
    .run(status, now, JSON.stringify(logs), JSON.stringify(nextSteps), status, now, task.id)

  if (status === 'queued') void processNextPlatformTask()
  return readPlatformTask(task.id)
}

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

export function listPlatformExecutors() {
  return executorDefinitions
}

async function processNextPlatformTask() {
  if (workerBusy) return
  workerBusy = true

  try {
    const task = readNextQueuedTask()
    if (!task) return

    markTaskRunning(task)
    const runningTask = readPlatformTask(task.id)
    const outcome = await runPlatformTask(runningTask)
    completePlatformTask(runningTask, outcome)
  } catch (error) {
    console.error(error)
  } finally {
    workerBusy = false
  }
}

function readNextQueuedTask() {
  const row = getPlatformDatabase()
    .prepare(
      `SELECT id, title, detail, kind, status, priority, source, created_at AS createdAt,
              updated_at AS updatedAt, started_at AS startedAt, completed_at AS completedAt,
              result, error, logs, steps
       FROM platform_tasks
       WHERE status = 'queued'
       ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at ASC
       LIMIT 1`,
    )
    .get()
  return row ? toPlatformTask(row) : null
}

function readPlatformTask(taskId) {
  const row = getPlatformDatabase()
    .prepare(
      `SELECT id, title, detail, kind, status, priority, source, created_at AS createdAt,
              updated_at AS updatedAt, started_at AS startedAt, completed_at AS completedAt,
              result, error, logs, steps
       FROM platform_tasks
       WHERE id = ?`,
    )
    .get(String(taskId))
  return row ? toPlatformTask(row) : null
}

function markTaskRunning(task) {
  const now = new Date().toISOString()
  const logs = [...task.logs, `${formatLogTime(now)} 后台执行器开始处理。`].slice(-MAX_TASK_LOGS)
  getPlatformDatabase()
    .prepare('UPDATE platform_tasks SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ?, logs = ?, steps = ? WHERE id = ?')
    .run('running', now, now, JSON.stringify(logs), JSON.stringify(transitionTaskSteps(task.steps, 'running')), task.id)
}

function completePlatformTask(task, outcome) {
  const now = new Date().toISOString()
  const status = outcome.status || 'completed'
  const logs = [...task.logs, `${formatLogTime(now)} ${status === 'completed' ? '后台执行完成。' : '后台执行需要补充。'}`].slice(
    -MAX_TASK_LOGS,
  )
  const nextSteps = transitionTaskSteps(task.steps, status)

  getPlatformDatabase()
    .prepare(
      `UPDATE platform_tasks
       SET status = ?, updated_at = ?, completed_at = ?, result = ?, error = ?, logs = ?, steps = ?
       WHERE id = ?`,
    )
    .run(status, now, now, outcome.result || '', outcome.error || '', JSON.stringify(logs), JSON.stringify(nextSteps), task.id)

  createPlatformNotification({
    title: status === 'completed' ? '后台任务完成' : '后台任务需要处理',
    body: `${task.title}：${outcome.result || outcome.error || '已有新状态。'}`.slice(0, 220),
    kind: status === 'completed' ? 'task_completed' : 'task_blocked',
    taskId: task.id,
  })
}

async function runPlatformTask(task) {
  if (task.kind === 'web_fetch') return runWebFetchTask(task)
  if (task.kind === 'file_scan') return runFileScanTask(task)
  if (task.kind === 'connector_check') return runConnectorCheckTask()
  return runGenericTask(task)
}

async function runWebFetchTask(task) {
  const url = extractFirstUrl(`${task.title}\n${task.detail}`)
  if (!url) {
    return {
      status: 'blocked',
      error: '缺少可读取的公开 URL。',
      result: '任务已保留在后台，需要补充链接后继续。',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEB_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'YuriNestAgent/0.1' },
      signal: controller.signal,
    })
    const text = await response.text()
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim()
    const preview = stripHtml(text).slice(0, 360)
    return {
      result: [`读取 ${url}`, title ? `标题：${title}` : '', preview ? `摘录：${preview}` : '页面没有可读文本摘录。']
        .filter(Boolean)
        .join('\n'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function runFileScanTask() {
  const root = resolve(process.cwd())
  const files = scanWorkspaceFiles(root)
  const extensionCounts = new Map()
  for (const file of files) {
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'no-ext' : 'no-ext'
    extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1)
  }

  const topExtensions = Array.from(extensionCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([ext, count]) => `${ext}:${count}`)
    .join(' / ')

  return {
    result: `扫描 ${files.length} 个工作区文件。主要类型：${topExtensions || '暂无'}。`,
  }
}

function runConnectorCheckTask() {
  const connectors = listPlatformConnectors()
  const connected = connectors.filter((connector) => connector.connected)
  return {
    result:
      connected.length > 0
        ? `已连接：${connected.map((connector) => connector.label).join(' / ')}。`
        : '当前没有可用账号连接；可先用服务器环境变量或手动状态登记接入。',
  }
}

function runGenericTask(task) {
  return {
    result: `已记录并完成后台整理切片：${task.detail || task.title}`.slice(0, 420),
  }
}

function createPlatformNotification(input) {
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

function getPlatformDatabase() {
  if (platformDatabase) return platformDatabase

  const databasePath = resolve(process.env.YURI_NEST_DB_PATH || './data/yuri-nest.sqlite')
  mkdirSync(dirname(databasePath), { recursive: true })
  platformDatabase = new DatabaseSync(databasePath)
  platformDatabase.exec(`
    CREATE TABLE IF NOT EXISTS platform_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      result TEXT,
      error TEXT,
      logs TEXT NOT NULL,
      steps TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      task_id TEXT,
      created_at TEXT NOT NULL,
      seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS platform_connectors (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      label TEXT NOT NULL,
      mode TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata TEXT NOT NULL
    );
  `)
  return platformDatabase
}

function normalizePlatformTaskInput(input) {
  const title = sanitizeShortText(input.title, 90) || '后台任务'
  const detail = sanitizeBlockText(input.detail, 1_200) || title
  return {
    title,
    detail,
    kind: TASK_KINDS.has(input.kind) ? input.kind : inferTaskKind(`${title}\n${detail}`),
    priority: TASK_PRIORITIES.has(input.priority) ? input.priority : 'medium',
    source: input.source === 'agent' || input.source === 'user' ? input.source : 'user',
    steps: Array.isArray(input.steps) ? input.steps : [],
  }
}

function normalizeTaskSteps(steps, kind) {
  const fallbackSteps = {
    generic: ['接收任务', '后台处理', '写入结果'],
    web_fetch: ['提取链接', '读取网页', '整理摘录'],
    file_scan: ['确认范围', '扫描文件', '汇总类型'],
    connector_check: ['读取连接', '检查状态', '输出结果'],
  }

  return (steps.length > 0 ? steps : fallbackSteps[kind] || fallbackSteps.generic)
    .map((step) => sanitizeShortText(step, 80))
    .filter(Boolean)
    .slice(0, MAX_TASK_STEPS)
    .map((title) => ({
      id: `platform-step-${randomUUID()}`,
      title,
      status: 'queued',
    }))
}

function inferTaskKind(text) {
  if (extractFirstUrl(text)) return 'web_fetch'
  if (/文件|目录|工作区|扫描|统计文件|读取文件/.test(text)) return 'file_scan'
  if (/账号|连接|Google|Drive|GitHub|邮箱|日历|connector|同步/.test(text)) return 'connector_check'
  return 'generic'
}

function transitionTaskSteps(steps, status) {
  if (!Array.isArray(steps)) return []
  if (status === 'completed') return steps.map((step) => ({ ...step, status: 'completed' }))
  if (status === 'blocked' || status === 'failed' || status === 'cancelled') {
    return steps.map((step) => (step.status === 'running' ? { ...step, status } : step))
  }
  if (status === 'running') {
    let activated = false
    return steps.map((step) => {
      if (step.status === 'completed') return step
      if (!activated) {
        activated = true
        return { ...step, status: 'running' }
      }
      return { ...step, status: 'queued' }
    })
  }
  return steps.map((step) => (step.status === 'completed' ? step : { ...step, status: 'queued' }))
}

function toPlatformTask(row) {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    result: row.result || '',
    error: row.error || '',
    logs: parseJson(row.logs, []),
    steps: parseJson(row.steps, []),
  }
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

function getTaskCounts() {
  const rows = getPlatformDatabase().prepare('SELECT status, COUNT(*) AS count FROM platform_tasks GROUP BY status').all()
  const counts = Object.fromEntries(rows.map((row) => [row.status, row.count]))
  return {
    queued: counts.queued || 0,
    running: counts.running || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    blocked: counts.blocked || 0,
  }
}

function getNotificationCounts() {
  const row = getPlatformDatabase().prepare("SELECT COUNT(*) AS unseen FROM platform_notifications WHERE status = 'unseen'").get()
  return {
    unseen: Number(row?.unseen || 0),
  }
}

function scanWorkspaceFiles(root) {
  const ignored = new Set(['.git', 'node_modules', 'dist', 'data', 'secrets', '.playwright-cli'])
  const files = []

  function visit(directory) {
    if (files.length >= 2_000) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue
      const fullPath = join(directory, entry.name)
      if (!isInsideRoot(root, fullPath)) continue
      if (entry.isDirectory()) {
        visit(fullPath)
      } else if (entry.isFile()) {
        const stats = statSync(fullPath)
        files.push({
          name: entry.name,
          path: relative(root, fullPath),
          size: stats.size,
        })
      }
    }
  }

  if (existsSync(root)) visit(root)
  return files
}

function isInsideRoot(root, target) {
  const relativePath = relative(root, resolve(target))
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.includes(`..${sep}`))
}

function extractFirstUrl(text) {
  return String(text).match(/https?:\/\/[^\s"'<>]+/i)?.[0] || ''
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function sanitizeShortText(value, maxLength) {
  return Array.from(String(value || '').replace(/[\r\n\t]/g, ' ').trim()).slice(0, maxLength).join('')
}

function sanitizeBlockText(value, maxLength) {
  return Array.from(String(value || '').replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim()).slice(0, maxLength).join('')
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function formatLogTime(value) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
