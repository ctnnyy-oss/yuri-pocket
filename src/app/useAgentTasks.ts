import type { Dispatch, SetStateAction } from 'react'
import type { AgentTaskStatus, AppState } from '../domain/types'
import { nowIso } from '../services/memoryEngine'
import { buildTaskStatusLog, transitionTaskSteps } from './agentActions'

interface UseAgentTasksDeps {
  setState: Dispatch<SetStateAction<AppState>>
  setNotice: Dispatch<SetStateAction<string>>
}

export function useAgentTasks({ setState, setNotice }: UseAgentTasksDeps) {
  function handleUpdateTaskStatus(taskId: string, status: AgentTaskStatus) {
    setState((currentState) => ({
      ...currentState,
      agentTasks: currentState.agentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              updatedAt: nowIso(),
              steps: transitionTaskSteps(task.steps, status),
              logs: [buildTaskStatusLog(status), ...task.logs].slice(0, 20),
            }
          : task,
      ),
    }))
  }

  function handleClearCompletedTasks() {
    setState((currentState) => ({
      ...currentState,
      agentTasks: currentState.agentTasks.filter((task) => task.status !== 'completed' && task.status !== 'failed'),
    }))
    setNotice('已清理完成任务')
  }

  return {
    handleUpdateTaskStatus,
    handleClearCompletedTasks,
  }
}
