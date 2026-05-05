// 后台任务 CRUD：列表、创建、更新、规范化、状态步骤管理

import { randomUUID } from 'node:crypto'
import { clampNumber, parseJson, sanitizeShortText, sanitizeBlockText, formatLogTime } from '../shared/utils.mjs'
import {
  getPlatformDatabase,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_KINDS,
  MAX_TASK_LOGS,
  MAX_TASK_STEPS,
} from './db.mjs'

// ============ 公共 API ============

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

  return readPlatformTask(task.id)
}

export function getTaskCounts() {
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

// ============ Worker 调用的内部函数（exported 以便 worker 复用） ============

export function readPlatformTask(taskId) {
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

export function readNextQueuedTask() {
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

export function markTaskRunning(task) {
  const now = new Date().toISOString()
  const logs = [...task.logs, `${formatLogTime(now)} 后台执行器开始处理。`].slice(-MAX_TASK_LOGS)
  getPlatformDatabase()
    .prepare('UPDATE platform_tasks SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ?, logs = ?, steps = ? WHERE id = ?')
    .run('running', now, now, JSON.stringify(logs), JSON.stringify(transitionTaskSteps(task.steps, 'running')), task.id)
}

export function applyTaskOutcome(task, outcome) {
  const now = new Date().toISOString()
  const status = outcome.status || 'completed'
  const logs = [
    ...task.logs,
    `${formatLogTime(now)} ${status === 'completed' ? '后台执行完成。' : '后台执行需要补充。'}`,
  ].slice(-MAX_TASK_LOGS)
  const nextSteps = transitionTaskSteps(task.steps, status)

  getPlatformDatabase()
    .prepare(
      `UPDATE platform_tasks
       SET status = ?, updated_at = ?, completed_at = ?, result = ?, error = ?, logs = ?, steps = ?
       WHERE id = ?`,
    )
    .run(status, now, now, outcome.result || '', outcome.error || '', JSON.stringify(logs), JSON.stringify(nextSteps), task.id)

  return { status, statusLabel: status === 'completed' ? '后台任务完成' : '后台任务需要处理' }
}

// ============ 输入规范化 ============

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

export function extractFirstUrl(text) {
  return String(text).match(/https?:\/\/[^\s"'<>]+/i)?.[0] || ''
}
