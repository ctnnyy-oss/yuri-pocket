import { brand } from '../../config/brand'
import type { CharacterCard, MemoryScope, WorldNode } from '../../domain/types'
import type { MemoryDraft } from './memoryPanelTypes'
import { defaultProjectId, getScopeHint } from './memoryPanelUtils'

const memoryScopeOptions: Array<{ id: MemoryScope['kind']; label: string }> = [
  { id: 'global_user', label: '全局用户' },
  { id: 'relationship', label: '当前关系' },
  { id: 'character_private', label: '角色私有' },
  { id: 'project', label: '项目' },
  { id: 'world', label: '世界' },
  { id: 'world_branch', label: '世界分支' },
  { id: 'conversation', label: '当前会话' },
  { id: 'temporary', label: '临时' },
]

export function MemoryScopeEditor({
  activeCharacterId,
  activeConversationId,
  characters,
  draft,
  onChange,
  worldNodes,
}: {
  activeCharacterId: string
  activeConversationId: string
  characters: CharacterCard[]
  draft: MemoryDraft
  onChange: (draft: MemoryDraft) => void
  worldNodes: WorldNode[]
}) {
  function updateScopeKind(scopeKind: MemoryScope['kind']) {
    onChange({
      ...draft,
      scopeKind,
      characterId: draft.characterId || activeCharacterId,
      conversationId: draft.conversationId || activeConversationId,
      projectId: draft.projectId || defaultProjectId,
      worldId: draft.worldId || worldNodes[0]?.id || defaultProjectId,
      branchId: draft.branchId || 'main',
    })
  }

  return (
    <section className="scope-editor" aria-label="记忆空间编辑器">
      <div className="scope-editor-head">
        <strong>记忆空间</strong>
        <span>{getScopeHint(draft.scopeKind)}</span>
      </div>
      <div className="scope-grid">
        <label>
          <span>归属</span>
          <select
            onChange={(event) => updateScopeKind(event.target.value as MemoryScope['kind'])}
            value={draft.scopeKind}
          >
            {memoryScopeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {(draft.scopeKind === 'relationship' || draft.scopeKind === 'character_private') && (
          <label>
            <span>角色</span>
            <select
              onChange={(event) => onChange({ ...draft, characterId: event.target.value })}
              value={draft.characterId || activeCharacterId}
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {(draft.scopeKind === 'world' || draft.scopeKind === 'world_branch') && (
          <label>
            <span>世界</span>
            <select
              onChange={(event) => onChange({ ...draft, worldId: event.target.value })}
              value={draft.worldId || worldNodes[0]?.id || defaultProjectId}
            >
              {[...worldNodes.map((node) => ({ id: node.id, title: node.title })), { id: defaultProjectId, title: brand.nameEn }]
                .filter((option, index, options) => options.findIndex((item) => item.id === option.id) === index)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
            </select>
          </label>
        )}

        {draft.scopeKind === 'world_branch' && (
          <label>
            <span>分支</span>
            <input
              onChange={(event) => onChange({ ...draft, branchId: event.target.value })}
              placeholder="main / draft / CP-01"
              value={draft.branchId}
            />
          </label>
        )}

        {draft.scopeKind === 'project' && (
          <label>
            <span>项目</span>
            <input
              onChange={(event) => onChange({ ...draft, projectId: event.target.value })}
              placeholder={defaultProjectId}
              value={draft.projectId}
            />
          </label>
        )}

        {draft.scopeKind === 'conversation' && (
          <label>
            <span>会话</span>
            <input
              onChange={(event) => onChange({ ...draft, conversationId: event.target.value })}
              value={draft.conversationId || activeConversationId}
            />
          </label>
        )}
      </div>
    </section>
  )
}

