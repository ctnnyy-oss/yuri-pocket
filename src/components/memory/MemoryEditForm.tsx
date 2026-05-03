import { Save, X } from 'lucide-react'
import type {
  CharacterCard,
  MemoryKind,
  MemoryLayer,
  MemoryMentionPolicy,
  MemorySensitivity,
  MemoryStatus,
  WorldNode,
} from '../../domain/types'
import {
  memoryKindLabels,
  memoryLayerLabels,
  memoryMentionPolicyLabels,
  memorySensitivityLabels,
  memoryStatusLabels,
} from '../../domain/memoryLabels'
import { IconTextButton } from './atoms'
import { MemoryScopeEditor } from './MemoryScopeEditor'
import type { MemoryDraft } from './memoryPanelTypes'
import { isoToLocalInput, localInputToIso } from './memoryPanelUtils'

const memoryKindOptions = Object.keys(memoryKindLabels) as MemoryKind[]
const memoryLayerOptions = Object.keys(memoryLayerLabels) as MemoryLayer[]
const memoryStatusOptions = Object.keys(memoryStatusLabels).filter(
  (status) => status !== 'trashed' && status !== 'permanently_deleted',
) as MemoryStatus[]
const memorySensitivityOptions = Object.keys(memorySensitivityLabels) as MemorySensitivity[]
const memoryMentionPolicyOptions = Object.keys(memoryMentionPolicyLabels) as MemoryMentionPolicy[]

interface MemoryEditFormProps {
  activeCharacterId: string
  activeConversationId: string
  characters: CharacterCard[]
  draft: MemoryDraft
  onCancel: () => void
  onChange: (draft: MemoryDraft) => void
  onSave: () => void
  worldNodes: WorldNode[]
}

export function MemoryEditForm({
  activeCharacterId,
  activeConversationId,
  characters,
  draft,
  onCancel,
  onChange,
  onSave,
  worldNodes,
}: MemoryEditFormProps) {
  return (
    <div className="edit-form">
      <label>
        <span>标题</span>
        <input onChange={(event) => onChange({ ...draft, title: event.target.value })} value={draft.title} />
      </label>
      <label>
        <span>内容</span>
        <textarea onChange={(event) => onChange({ ...draft, body: event.target.value })} rows={4} value={draft.body} />
      </label>
      <label>
        <span>标签</span>
        <input onChange={(event) => onChange({ ...draft, tags: event.target.value })} value={draft.tags} />
      </label>
      <MemoryScopeEditor
        activeCharacterId={activeCharacterId}
        activeConversationId={activeConversationId}
        characters={characters}
        draft={draft}
        onChange={onChange}
        worldNodes={worldNodes}
      />
      <div className="edit-row">
        <label>
          <span>类型</span>
          <select onChange={(event) => onChange({ ...draft, kind: event.target.value as MemoryKind })} value={draft.kind}>
            {memoryKindOptions.map((kind) => (
              <option key={kind} value={kind}>
                {memoryKindLabels[kind]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>层级</span>
          <select
            onChange={(event) => onChange({ ...draft, layer: event.target.value as MemoryLayer })}
            value={draft.layer}
          >
            {memoryLayerOptions.map((layer) => (
              <option key={layer} value={layer}>
                {memoryLayerLabels[layer]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="edit-row">
        <label>
          <span>可信度</span>
          <input
            max="1"
            min="0.1"
            onChange={(event) => onChange({ ...draft, confidence: Number(event.target.value) })}
            step="0.05"
            type="number"
            value={draft.confidence}
          />
        </label>
        <label>
          <span>状态</span>
          <select
            onChange={(event) => onChange({ ...draft, status: event.target.value as MemoryStatus })}
            value={draft.status}
          >
            {memoryStatusOptions.map((status) => (
              <option key={status} value={status}>
                {memoryStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>敏感度</span>
          <select
            onChange={(event) =>
              onChange({
                ...draft,
                sensitivity: event.target.value as MemorySensitivity,
              })
            }
            value={draft.sensitivity}
          >
            {memorySensitivityOptions.map((sensitivity) => (
              <option key={sensitivity} value={sensitivity}>
                {memorySensitivityLabels[sensitivity]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="edit-row">
        <label>
          <span>提及时机</span>
          <select
            onChange={(event) =>
              onChange({
                ...draft,
                mentionPolicy: event.target.value as MemoryMentionPolicy,
              })
            }
            value={draft.mentionPolicy}
          >
            {memoryMentionPolicyOptions.map((policy) => (
              <option key={policy} value={policy}>
                {memoryMentionPolicyLabels[policy]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>冷却到</span>
          <input
            onChange={(event) =>
              onChange({
                ...draft,
                cooldownUntil: localInputToIso(event.target.value),
              })
            }
            type="datetime-local"
            value={isoToLocalInput(draft.cooldownUntil)}
          />
        </label>
      </div>
      <div className="edit-row">
        <label>
          <span>权重</span>
          <input
            max="5"
            min="1"
            onChange={(event) => onChange({ ...draft, priority: Number(event.target.value) })}
            type="number"
            value={draft.priority}
          />
        </label>
        <label className="compact-check">
          <input
            checked={draft.pinned}
            onChange={(event) => onChange({ ...draft, pinned: event.target.checked })}
            type="checkbox"
          />
          <span>置顶</span>
        </label>
      </div>
      <div className="item-actions">
        <IconTextButton icon={<Save size={16} />} label="保存" onClick={onSave} />
        <IconTextButton icon={<X size={16} />} label="取消" onClick={onCancel} />
      </div>
    </div>
  )
}
