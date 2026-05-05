import {
  Clock3,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentTask, AgentTaskStatus, CharacterCard } from '../../domain/types'
import {
  createPlatformTask,
  getBrowserNotificationPermission,
  getPlatformStatus,
  listPlatformNotifications,
  listPlatformTasks,
  markPlatformNotificationsSeen,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  updatePlatformConnector,
  updatePlatformTask,
  type PlatformConnector,
  type PlatformNotification,
  type PlatformStatus,
  type PlatformTask,
  type PlatformTaskStatus,
} from '../../services/platform'
import { PlatformConsole } from './taskPanel/PlatformConsole'
import { Metric, TaskCard } from './taskPanel/TaskCard'

interface AgentTaskPanelProps {
  tasks: AgentTask[]
  characters: CharacterCard[]
  onUpdateTaskStatus: (taskId: string, status: AgentTaskStatus) => void
  onClearCompleted: () => void
}

const statusOrder: AgentTaskStatus[] = ['running', 'queued', 'blocked', 'failed', 'completed']

export function AgentTaskPanel({ tasks, characters, onUpdateTaskStatus, onClearCompleted }: AgentTaskPanelProps) {
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null)
  const [platformTasks, setPlatformTasks] = useState<PlatformTask[]>([])
  const [platformNotifications, setPlatformNotifications] = useState<PlatformNotification[]>([])
  const [notificationPermission, setNotificationPermission] = useState(() => getBrowserNotificationPermission())
  const [platformBusy, setPlatformBusy] = useState(false)
  const [platformNotice, setPlatformNotice] = useState('')
  const sortedTasks = [...tasks].sort((a, b) => {
    const statusDelta = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
    if (statusDelta !== 0) return statusDelta
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
  const activeCount = tasks.filter((task) => !['completed', 'failed'].includes(task.status)).length
  const runningCount = tasks.filter((task) => task.status === 'running').length
  const completedCount = tasks.filter((task) => task.status === 'completed').length
  const platformConnectors = useMemo(() => platformStatus?.connectors ?? [], [platformStatus])
  const platformExecutors = useMemo(() => platformStatus?.executors ?? [], [platformStatus])

  const refreshPlatform = useCallback(async () => {
    try {
      setPlatformBusy(true)
      const [status, nextTasks, notifications] = await Promise.all([
        getPlatformStatus(),
        listPlatformTasks(),
        listPlatformNotifications(),
      ])
      setPlatformStatus(status)
      setPlatformTasks(nextTasks)
      setPlatformNotifications(notifications)

      const unseen = notifications.filter((item) => item.status === 'unseen').slice(0, 3)
      if (notificationPermission === 'granted' && unseen.length > 0) {
        await Promise.all(unseen.map((item) => showBrowserNotification(item.title, item.body)))
        const nextNotifications = await markPlatformNotificationsSeen(unseen.map((item) => item.id))
        setPlatformNotifications(nextNotifications)
      }
      setPlatformNotice('')
    } catch (error) {
      setPlatformNotice(error instanceof Error ? error.message : '后台平台暂时没有接通')
    } finally {
      setPlatformBusy(false)
    }
  }, [notificationPermission])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refreshPlatform()
    }, 0)
    const timer = window.setInterval(() => {
      void refreshPlatform()
    }, 10_000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
    }
  }, [refreshPlatform])

  async function handleRequestNotifications() {
    const permission = await requestBrowserNotificationPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') {
      await showBrowserNotification('百合小窝后台通知', '通知权限已开启。')
      await refreshPlatform()
      return
    }
    setPlatformNotice(permission === 'unsupported' ? '当前浏览器不支持通知' : '通知权限没有开启')
  }

  async function handleCreatePlatformProbe() {
    try {
      setPlatformBusy(true)
      await createPlatformTask({
        title: '后台平台自检',
        detail: '检查后台队列、通知、账号连接和执行器状态。',
        kind: 'connector_check',
        priority: 'medium',
        source: 'user',
      })
      await refreshPlatform()
    } catch (error) {
      setPlatformNotice(error instanceof Error ? error.message : '后台任务创建失败')
    } finally {
      setPlatformBusy(false)
    }
  }

  async function handleUpdatePlatformTask(taskId: string, status: PlatformTaskStatus) {
    try {
      setPlatformBusy(true)
      await updatePlatformTask(taskId, status)
      await refreshPlatform()
    } catch (error) {
      setPlatformNotice(error instanceof Error ? error.message : '后台任务更新失败')
    } finally {
      setPlatformBusy(false)
    }
  }

  async function handleToggleConnector(connector: PlatformConnector) {
    try {
      setPlatformBusy(true)
      const next = await updatePlatformConnector(connector.id, connector.connected ? 'disconnect' : 'mark_manual')
      setPlatformStatus((current) => (current ? { ...current, connectors: next.connectors } : current))
      setPlatformNotice(connector.connected ? '连接已停用' : '连接状态已记录')
      await refreshPlatform()
    } catch (error) {
      setPlatformNotice(error instanceof Error ? error.message : '连接器更新失败')
    } finally {
      setPlatformBusy(false)
    }
  }

  return (
    <main className="detail-workspace task-workspace">
      <header className="task-hero">
        <div>
          <span className="eyebrow">Agent Queue</span>
          <h2>任务队列</h2>
        </div>
        <button className="task-clear-button" disabled={completedCount === 0} onClick={onClearCompleted} type="button">
          <Trash2 size={16} />
          <span>清理已完成</span>
        </button>
      </header>

      <section className="task-metrics" aria-label="任务统计">
        <Metric label="活跃任务" value={activeCount} />
        <Metric label="进行中" value={runningCount} />
        <Metric label="已完成" value={completedCount} />
      </section>

      <PlatformConsole
        busy={platformBusy}
        connectors={platformConnectors}
        executors={platformExecutors}
        notificationPermission={notificationPermission}
        notifications={platformNotifications}
        notice={platformNotice}
        onCreateProbe={handleCreatePlatformProbe}
        onRefresh={refreshPlatform}
        onRequestNotifications={handleRequestNotifications}
        onToggleConnector={handleToggleConnector}
        onUpdateTaskStatus={handleUpdatePlatformTask}
        status={platformStatus}
        tasks={platformTasks}
      />

      {sortedTasks.length === 0 ? (
        <section className="task-empty">
          <Clock3 size={28} />
          <strong>还没有任务</strong>
          <span>等待新的 Agent 任务。</span>
        </section>
      ) : (
        <section className="task-list" aria-label="Agent 任务列表">
          {sortedTasks.map((task) => (
            <TaskCard
              characters={characters}
              key={task.id}
              onUpdateTaskStatus={onUpdateTaskStatus}
              task={task}
            />
          ))}
        </section>
      )}
    </main>
  )
}
