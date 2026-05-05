import { Bell, Cloud, DatabaseZap, Link2, RefreshCw, ServerCog, type LucideIcon } from 'lucide-react'
import {
  type PlatformConnector,
  type PlatformNotification,
  type PlatformStatus,
  type PlatformTask,
  type PlatformTaskStatus,
} from '../../../services/platform'
import { getConnectorStatusLabel, getPermissionLabel, getPlatformTaskStatusLabel } from './helpers'

interface PlatformConsoleProps {
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
}

export function PlatformConsole({
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
}: PlatformConsoleProps) {
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
