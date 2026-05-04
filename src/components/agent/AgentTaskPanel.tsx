import {
  Bell,
  CheckCircle2,
  CircleDashed,
  Cloud,
  Clock3,
  DatabaseZap,
  Link2,
  Play,
  RefreshCw,
  RotateCcw,
  ServerCog,
  Trash2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentTask, AgentTaskStatus, CharacterCard } from '../../domain/types'
import { formatSocialTime } from '../../app/formatters'
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

interface AgentTaskPanelProps {
  tasks: AgentTask[]
  characters: CharacterCard[]
  onUpdateTaskStatus: (taskId: string, status: AgentTaskStatus) => void
  onClearCompleted: () => void
}

const statusMeta: Record<AgentTaskStatus, { label: string; icon: LucideIcon }> = {
  queued: { label: '等待中', icon: CircleDashed },
  running: { label: '进行中', icon: Clock3 },
  completed: { label: '已完成', icon: CheckCircle2 },
  failed: { label: '失败', icon: XCircle },
  blocked: { label: '卡住', icon: XCircle },
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="task-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function PlatformConsole({
  busy,
  connectors,
  executors,
  notificationPermission,
  notifications,
  notice,
  onCreateProbe,
  onRefresh,
  onRequestNotifications,
  onToggleConnector,
  onUpdateTaskStatus,
  status,
  tasks,
}: {
  busy: boolean
  connectors: PlatformConnector[]
  executors: Array<{ id: string; label: string; enabled: boolean; risk: string }>
  notificationPermission: NotificationPermission | 'unsupported'
  notifications: PlatformNotification[]
  notice: string
  onCreateProbe: () => void
  onRefresh: () => void
  onRequestNotifications: () => void
  onToggleConnector: (connector: PlatformConnector) => void
  onUpdateTaskStatus: (taskId: string, status: PlatformTaskStatus) => void
  status: PlatformStatus | null
  tasks: PlatformTask[]
}) {
  const queued = status?.queue.queued ?? 0
  const running = status?.queue.running ?? 0
  const connectedCount = connectors.filter((connector) => connector.connected).length
  const unseenCount = notifications.filter((notification) => notification.status === 'unseen').length

  return (
    <section className="platform-console">
      <div className="platform-console-head">
        <div>
          <span className="eyebrow">Agent Platform</span>
          <h3>后台平台</h3>
        </div>
        <div className="platform-actions">
          <button disabled={busy} onClick={onRefresh} type="button">
            <RefreshCw size={15} />
            <span>刷新</span>
          </button>
          <button disabled={busy} onClick={onCreateProbe} type="button">
            <DatabaseZap size={15} />
            <span>自检</span>
          </button>
          <button disabled={busy || notificationPermission === 'granted'} onClick={onRequestNotifications} type="button">
            <Bell size={15} />
            <span>{notificationPermission === 'granted' ? '通知已开' : '开启通知'}</span>
          </button>
        </div>
      </div>

      <div className="platform-grid">
        <PlatformTile
          detail={`${running} 运行 / ${queued} 等待`}
          icon={DatabaseZap}
          label="后台队列"
          value={status?.worker.enabled ? '运行中' : '未连接'}
        />
        <PlatformTile
          detail={`${unseenCount} 条未读`}
          icon={Bell}
          label="系统通知"
          value={getPermissionLabel(notificationPermission)}
        />
        <PlatformTile detail={`${connectedCount}/${connectors.length}`} icon={Link2} label="账号连接" value="连接器" />
        <PlatformTile detail={`${executors.filter((item) => item.enabled).length} 个可用`} icon={ServerCog} label="执行器" value="本地" />
      </div>

      {notice ? <div className="platform-notice">{notice}</div> : null}

      <div className="platform-columns">
        <section className="platform-card">
          <div className="platform-card-title">
            <Cloud size={16} />
            <strong>后台任务</strong>
          </div>
          <div className="platform-task-list">
            {tasks.length === 0 ? (
              <span className="platform-empty-line">暂无后台任务</span>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <PlatformTaskRow key={task.id} onUpdateTaskStatus={onUpdateTaskStatus} task={task} />
              ))
            )}
          </div>
        </section>

        <section className="platform-card">
          <div className="platform-card-title">
            <Link2 size={16} />
            <strong>账号连接</strong>
          </div>
          <div className="connector-list">
            {connectors.map((connector) => (
              <button
                className={`connector-item ${connector.connected ? 'connected' : ''}`}
                key={connector.id}
                onClick={() => onToggleConnector(connector)}
                type="button"
              >
                <span>
                  <strong>{connector.label}</strong>
                  <small>{getConnectorStatusLabel(connector)}</small>
                </span>
                <em>{connector.connected ? '已接入' : '未接入'}</em>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function PlatformTile({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="platform-tile">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function PlatformTaskRow({
  onUpdateTaskStatus,
  task,
}: {
  onUpdateTaskStatus: (taskId: string, status: PlatformTaskStatus) => void
  task: PlatformTask
}) {
  return (
    <article className={`platform-task-row ${task.status}`}>
      <div>
        <strong>{task.title}</strong>
        <span>{task.result || task.error || task.detail}</span>
      </div>
      <div className="platform-task-row-actions">
        <em>{getPlatformTaskStatusLabel(task.status)}</em>
        {task.status === 'blocked' || task.status === 'failed' ? (
          <button onClick={() => onUpdateTaskStatus(task.id, 'queued')} type="button">
            重试
          </button>
        ) : null}
        {task.status === 'queued' || task.status === 'running' ? (
          <button onClick={() => onUpdateTaskStatus(task.id, 'cancelled')} type="button">
            取消
          </button>
        ) : null}
      </div>
    </article>
  )
}

function TaskCard({
  task,
  characters,
  onUpdateTaskStatus,
}: {
  task: AgentTask
  characters: CharacterCard[]
  onUpdateTaskStatus: (taskId: string, status: AgentTaskStatus) => void
}) {
  const StatusIcon = statusMeta[task.status].icon
  const character = task.characterId ? characters.find((item) => item.id === task.characterId) : null
  const nextPrimaryAction = getPrimaryAction(task.status)
  const PrimaryActionIcon = nextPrimaryAction?.icon

  return (
    <article className={`task-card ${task.status}`}>
      <div className="task-card-head">
        <div className="task-title-block">
          <span className={`task-status ${task.status}`}>
            <StatusIcon size={14} />
            {statusMeta[task.status].label}
          </span>
          <h3>{task.title}</h3>
          <p>{task.detail}</p>
        </div>
        <span className={`task-priority ${task.priority}`}>{getPriorityLabel(task.priority)}</span>
      </div>

      <div className="task-meta-row">
        <span>{character ? character.name : 'Agent'}</span>
        <span>{formatSocialTime(task.updatedAt)}</span>
        {task.handoff ? <span>{task.handoff}</span> : null}
      </div>

      {task.steps.length > 0 ? (
        <ol className="task-steps">
          {task.steps.map((step) => (
            <li className={step.status} key={step.id}>
              <span />
              <div>
                <strong>{step.title}</strong>
                {step.detail ? <small>{step.detail}</small> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {task.logs.length > 0 ? (
        <div className="task-log">
          {task.logs.slice(-3).map((log, index) => (
            <span key={`${task.id}-log-${index}`}>{log}</span>
          ))}
        </div>
      ) : null}

      <div className="task-actions">
        {nextPrimaryAction ? (
          <button onClick={() => onUpdateTaskStatus(task.id, nextPrimaryAction.status)} type="button">
            {PrimaryActionIcon ? <PrimaryActionIcon size={15} /> : null}
            <span>{nextPrimaryAction.label}</span>
          </button>
        ) : null}
        {task.status === 'running' ? (
          <button onClick={() => onUpdateTaskStatus(task.id, 'blocked')} type="button">
            <XCircle size={15} />
            <span>标记卡住</span>
          </button>
        ) : null}
        {task.status !== 'completed' ? (
          <button onClick={() => onUpdateTaskStatus(task.id, 'completed')} type="button">
            <CheckCircle2 size={15} />
            <span>完成</span>
          </button>
        ) : null}
      </div>
    </article>
  )
}

function getPrimaryAction(status: AgentTaskStatus): { label: string; status: AgentTaskStatus; icon: LucideIcon } | null {
  if (status === 'queued') return { label: '开始', status: 'running', icon: Play }
  if (status === 'failed' || status === 'blocked') return { label: '重试', status: 'queued', icon: RotateCcw }
  return null
}

function getPriorityLabel(priority: AgentTask['priority']) {
  if (priority === 'high') return '高优先级'
  if (priority === 'low') return '低优先级'
  return '普通'
}

function getPermissionLabel(permission: NotificationPermission | 'unsupported') {
  if (permission === 'granted') return '已开启'
  if (permission === 'denied') return '已拒绝'
  if (permission === 'unsupported') return '不支持'
  return '待授权'
}

function getConnectorStatusLabel(connector: PlatformConnector) {
  if (connector.status === 'env_ready') return '服务器环境已配置'
  if (connector.status === 'manual_ready') return '手动状态已记录'
  if (connector.status === 'disabled') return '已停用'
  return '等待连接'
}

function getPlatformTaskStatusLabel(status: PlatformTaskStatus) {
  if (status === 'queued') return '等待'
  if (status === 'running') return '运行'
  if (status === 'completed') return '完成'
  if (status === 'blocked') return '卡住'
  if (status === 'cancelled') return '取消'
  return '失败'
}
