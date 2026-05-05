import { CheckCircle2, CircleDashed, Clock3, XCircle, type LucideIcon } from 'lucide-react'
import type { AgentTask, AgentTaskStatus, CharacterCard } from '../../../domain/types'
import { formatSocialTime } from '../../../app/formatters'
import { getPrimaryAction, getPriorityLabel } from './helpers'

const statusMeta: Record<AgentTaskStatus, { label: string; icon: LucideIcon }> = {
  queued: { label: '等待中', icon: CircleDashed },
  running: { label: '进行中', icon: Clock3 },
  completed: { label: '已完成', icon: CheckCircle2 },
  failed: { label: '失败', icon: XCircle },
  blocked: { label: '卡住', icon: XCircle },
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="task-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export function TaskCard({
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
