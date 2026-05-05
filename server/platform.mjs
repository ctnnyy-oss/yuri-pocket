// 后台平台 facade —— 实际实现按职责拆到 platform/ 子目录。
// 旧调用方继续 `import { ... } from './platform.mjs'` 不需要改。

import { getPlatformDatabase } from './platform/db.mjs'
import {
  listPlatformTasks,
  createPlatformTask as _createPlatformTask,
  updatePlatformTask as _updatePlatformTask,
  getTaskCounts,
} from './platform/tasks.mjs'
import {
  listPlatformConnectors,
  updatePlatformConnector,
  listPlatformExecutors,
  listPlatformNotifications,
  markPlatformNotificationsSeen,
  getNotificationCounts,
} from './platform/connectors.mjs'
import {
  startPlatformWorker as _startPlatformWorker,
  processNextPlatformTask,
  isWorkerRunning,
  getWorkerIntervalMs,
} from './platform/worker.mjs'

// ============ 启动 / 状态 ============

export function initializePlatform() {
  getPlatformDatabase()
}

export function startPlatformWorker() {
  initializePlatform()
  _startPlatformWorker()
}

export function getPlatformStatus() {
  return {
    ok: true,
    worker: {
      enabled: isWorkerRunning(),
      intervalMs: getWorkerIntervalMs(),
    },
    queue: getTaskCounts(),
    notifications: getNotificationCounts(),
    connectors: listPlatformConnectors(),
    executors: listPlatformExecutors(),
  }
}

// ============ 任务 ============
// createPlatformTask / updatePlatformTask 入队后立刻 nudge worker 处理一次，
// 这层包装保留原 platform.mjs 的副作用，避免 tasks.mjs 反向 import worker.mjs 造成循环依赖。

export function createPlatformTask(input = {}) {
  const task = _createPlatformTask(input)
  void processNextPlatformTask()
  return task
}

export function updatePlatformTask(taskId, input = {}) {
  const result = _updatePlatformTask(taskId, input)
  if (result?.status === 'queued') void processNextPlatformTask()
  return result
}

export { listPlatformTasks }

// ============ 通知 / 连接器 / 执行器 ============

export {
  listPlatformNotifications,
  markPlatformNotificationsSeen,
  listPlatformConnectors,
  updatePlatformConnector,
  listPlatformExecutors,
}
