import { Database } from 'lucide-react'
import type { CharacterCard, LongTermMemory } from '../../../domain/types'
import { SpaceStat } from '../atoms'

export function MemorySpaceOverview({
  activeCharacterId,
  characters,
  memories,
}: {
  activeCharacterId: string
  characters: CharacterCard[]
  memories: LongTermMemory[]
}) {
  const activeMemories = memories.filter((memory) => memory.status === 'active' || memory.status === 'candidate')
  const globalCount = activeMemories.filter((memory) => memory.scope.kind === 'global_user').length
  const roleScopedCount = activeMemories.filter(
    (memory) =>
      (memory.scope.kind === 'relationship' || memory.scope.kind === 'character_private') &&
      memory.scope.characterId === activeCharacterId,
  ).length
  const projectCount = activeMemories.filter((memory) => memory.scope.kind === 'project').length
  const worldCount = activeMemories.filter(
    (memory) => memory.scope.kind === 'world' || memory.scope.kind === 'world_branch',
  ).length
  const misplacedRelationships = activeMemories.filter(
    (memory) => memory.kind === 'relationship' && memory.scope.kind === 'global_user',
  )
  const currentCharacter = characters.find((character) => character.id === activeCharacterId)

  return (
    <section className="space-overview" aria-label="记忆空间总览">
      <div className="space-overview-head">
        <div>
          <strong>记忆空间</strong>
          <span>
            当前角色：{currentCharacter?.name ?? '未选择'}。关系和角色私有记忆只在对应角色聊天时被想起。
          </span>
        </div>
        <Database size={18} />
      </div>
      <div className="space-stats">
        <SpaceStat label="全局" value={globalCount} />
        <SpaceStat label="当前角色" value={roleScopedCount} />
        <SpaceStat label="项目" value={projectCount} />
        <SpaceStat label="世界" value={worldCount} />
      </div>
      {misplacedRelationships.length > 0 && (
        <div className="space-warning">
          有 {misplacedRelationships.length} 条关系记忆还在全局空间，建议移到具体角色，避免串戏。
        </div>
      )}
    </section>
  )
}
