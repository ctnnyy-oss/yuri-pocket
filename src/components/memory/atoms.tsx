import { Database, History, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LongTermMemory, MemoryLayer, MemoryScope } from '../../domain/types'
import { addDaysIso, defaultProjectId, isCoolingDown } from './memoryPanelUtils'

export function WorkspaceTitle({
  description,
  icon,
  title,
}: {
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <header className="workspace-title">
      <div className="workspace-title-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}

export function SpaceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function ArchiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="archive-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function IconTextButton({
  danger = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={`mini-action ${danger ? 'danger-action' : ''}`} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function RetentionButton({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean
  description: string
  label: string
  onClick: () => void
}) {
  return (
    <button className={`retention-button ${active ? 'active' : ''}`} onClick={onClick} type="button">
      <strong>{label}</strong>
      <small>{description}</small>
    </button>
  )
}

export function MemoryScopeQuickActions({
  activeCharacterId,
  memory,
  onUpdateMemory,
}: {
  activeCharacterId: string
  memory: LongTermMemory
  onUpdateMemory: (memory: LongTermMemory) => void
}) {
  const actions: Array<{ label: string; scope: MemoryScope }> = []

  if (
    memory.kind === 'relationship' &&
    (memory.scope.kind !== 'relationship' || memory.scope.characterId !== activeCharacterId)
  ) {
    actions.push({ label: '当前角色关系', scope: { kind: 'relationship', characterId: activeCharacterId } })
  }

  if (
    memory.kind === 'character' &&
    (memory.scope.kind !== 'character_private' || memory.scope.characterId !== activeCharacterId)
  ) {
    actions.push({ label: '当前角色私有', scope: { kind: 'character_private', characterId: activeCharacterId } })
  }

  if (
    (memory.kind === 'project' || memory.kind === 'procedure') &&
    !(memory.scope.kind === 'project' && memory.scope.projectId === defaultProjectId)
  ) {
    actions.push({ label: '项目空间', scope: { kind: 'project', projectId: defaultProjectId } })
  }

  if (memory.scope.kind !== 'global_user' && !['relationship', 'character'].includes(memory.kind)) {
    actions.push({ label: '设为全局', scope: { kind: 'global_user' } })
  }

  if (actions.length === 0) return null

  return (
    <>
      {actions.slice(0, 2).map((action) => (
        <IconTextButton
          icon={<Database size={16} />}
          key={action.label}
          label={action.label}
          onClick={() => onUpdateMemory({ ...memory, scope: action.scope, userEdited: true })}
        />
      ))}
    </>
  )
}

export function MemoryMentionQuickActions({
  memory,
  onUpdateMemory,
}: {
  memory: LongTermMemory
  onUpdateMemory: (memory: LongTermMemory) => void
}) {
  const actions: Array<{ label: string; patch: Partial<LongTermMemory> }> = []

  if (memory.mentionPolicy !== 'contextual' && !['taboo', 'safety'].includes(memory.kind)) {
    actions.push({ label: '相关时提', patch: { mentionPolicy: 'contextual' } })
  }

  if (memory.sensitivity === 'high' && memory.mentionPolicy !== 'explicit' && !['taboo', 'safety'].includes(memory.kind)) {
    actions.push({ label: '问起再提', patch: { mentionPolicy: 'explicit' } })
  }

  if (!memory.cooldownUntil || !isCoolingDown(memory.cooldownUntil)) {
    actions.push({ label: '冷却7天', patch: { cooldownUntil: addDaysIso(7) } })
  } else {
    actions.push({ label: '解除冷却', patch: { cooldownUntil: undefined } })
  }

  return (
    <>
      {actions.slice(0, 2).map((action) => (
        <IconTextButton
          icon={<ShieldCheck size={16} />}
          key={action.label}
          label={action.label}
          onClick={() => onUpdateMemory({ ...memory, ...action.patch, userEdited: true })}
        />
      ))}
    </>
  )
}

export function MemoryLayerQuickActions({
  memory,
  onUpdateMemory,
}: {
  memory: LongTermMemory
  onUpdateMemory: (memory: LongTermMemory) => void
}) {
  const actions: Array<{ label: string; layer: MemoryLayer }> = []

  if ((memory.kind === 'event' || memory.kind === 'reflection') && memory.layer !== 'episode') {
    actions.push({ label: '转为事件', layer: 'episode' })
  }

  if (
    ['profile', 'preference', 'procedure', 'relationship', 'project', 'world', 'character', 'taboo', 'safety'].includes(
      memory.kind,
    ) &&
    memory.layer !== 'stable'
  ) {
    actions.push({ label: '转为稳定', layer: 'stable' })
  }

  if (memory.scope.kind === 'temporary' && memory.layer !== 'working') {
    actions.push({ label: '转为临时', layer: 'working' })
  }

  if (actions.length === 0) return null

  return (
    <>
      {actions.slice(0, 1).map((action) => (
        <IconTextButton
          icon={<History size={16} />}
          key={action.label}
          label={action.label}
          onClick={() => onUpdateMemory({ ...memory, layer: action.layer, userEdited: true })}
        />
      ))}
    </>
  )
}
