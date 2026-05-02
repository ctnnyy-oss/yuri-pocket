import { AlertTriangle, ClipboardList } from 'lucide-react'
import type { LongTermMemory, MemoryConflict, MemoryUsageLog } from '../../../domain/types'
import { formatShortTime } from '../memoryPanelUtils'

export function MemoryDiagnostics({
  activeCharacterId,
  conflicts,
  memories,
  onUpdateMemory,
  usageLogs,
}: {
  activeCharacterId: string
  conflicts: MemoryConflict[]
  memories: LongTermMemory[]
  onUpdateMemory: (memory: LongTermMemory) => void
  usageLogs: MemoryUsageLog[]
}) {
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]))
  const memoryTitleById = new Map(memories.map((memory) => [memory.id, memory.title]))
  const recentLogs = usageLogs.slice(0, 4)

  function fixScopeConflict(conflict: MemoryConflict) {
    const memory = memoryById.get(conflict.memoryIds[0])
    if (!memory || memory.kind !== 'relationship') return
    onUpdateMemory({
      ...memory,
      scope: { kind: 'relationship', characterId: activeCharacterId },
      userEdited: true,
    })
  }

  function archiveDuplicate(conflict: MemoryConflict) {
    const memory = memoryById.get(conflict.memoryIds[1])
    if (!memory) return
    onUpdateMemory({
      ...memory,
      status: 'archived',
      userEdited: true,
    })
  }

  return (
    <section className="memory-diagnostics" aria-label="记忆透明日志">
      <div className="diagnostic-column">
        <h3>
          <AlertTriangle size={15} />
          冲突提醒
        </h3>
        {conflicts.length === 0 ? (
          <p>没有发现明显冲突。后面记忆变多时，姐姐会继续盯着。</p>
        ) : (
          conflicts.slice(0, 4).map((conflict) => (
            <article className="diagnostic-item warning" key={conflict.id}>
              <strong>{conflict.title}</strong>
              <span>{conflict.description}</span>
              <small>{conflict.suggestedResolution}</small>
              <footer>
                {conflict.memoryIds.map((id) => memoryTitleById.get(id) ?? '已删除记忆').join(' / ')}
              </footer>
              <div className="conflict-actions">
                {conflict.conflictType === 'scope' && (
                  <button onClick={() => fixScopeConflict(conflict)} type="button">
                    移到当前角色关系
                  </button>
                )}
                {conflict.conflictType === 'duplicate' && conflict.memoryIds.length > 1 && (
                  <button onClick={() => archiveDuplicate(conflict)} type="button">
                    归档后一条
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      <div className="diagnostic-column">
        <h3>
          <ClipboardList size={15} />
          最近调用
        </h3>
        {recentLogs.length === 0 ? (
          <p>还没有聊天调用日志。发送一条消息后，这里会显示本次用了哪些记忆。</p>
        ) : (
          recentLogs.map((log) => (
            <article className="diagnostic-item" key={log.id}>
              <strong>{formatShortTime(log.createdAt)}</strong>
              <span>
                {log.memoryIds.length > 0
                  ? `使用 ${log.memoryIds.length} 条记忆：${log.memoryIds
                      .slice(0, 4)
                      .map((id) => memoryTitleById.get(id) ?? '已删除记忆')
                      .join(' / ')}`
                  : '这次没有注入长期记忆，只用了最近对话。'}
              </span>
              {log.contextBlockTitles.length > 0 && <small>{log.contextBlockTitles.join(' / ')}</small>}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
