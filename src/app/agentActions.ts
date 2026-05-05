import type {
  AgentAction,
  AgentMoment,
  AgentReminder,
  AgentRoom,
  AgentRoomMessage,
  AgentTask,
  AgentTaskStatus,
  AppState,
  CharacterCard,
  ChatMessage,
  ConversationState,
} from '../domain/types'
import {
  createManualMemory,
  createMemorySourceFromMessage,
  createMessage,
  getConversation,
  integrateMemoryCandidate,
  nowIso,
  upsertConversation,
} from '../services/memoryEngine'
import { appendMemoryEvent, createMemoryEvent, type CreateMemoryEventInput } from '../services/memoryEvents'
import { inferMemoryScope } from '../services/memoryInference'
import { enqueueAgentTaskAction } from '../services/platform'

export function addMemoryEventToState(state: AppState, input: CreateMemoryEventInput): AppState {
  return {
    ...state,
    memoryEvents: appendMemoryEvent(state.memoryEvents, createMemoryEvent(input)),
  }
}

export function applyAgentActionsToState(
  state: AppState,
  actions: AgentAction[] = [],
  context: {
    character: CharacterCard
    conversation: ConversationState
    userMessage: ChatMessage
  },
): { state: AppState; appliedLabels: string[] } {
  let nextState = state
  const appliedLabels: string[] = []

  for (const action of actions) {
    if (action.requiresConfirmation) continue

    if (action.type === 'character_profile_update') {
      const characterPatch = sanitizeCharacterPatch(action.payload.character)
      if (!characterPatch) continue

      nextState = {
        ...nextState,
        characters: nextState.characters.map((character) =>
          character.id === context.character.id ? { ...character, ...characterPatch } : character,
        ),
      }
      appliedLabels.push(action.detail || action.title)
      continue
    }

    if (action.type === 'reminder_create') {
      const reminder = createReminderFromAgentAction(action, context)
      if (!reminder) continue

      nextState = {
        ...nextState,
        agentReminders: [reminder, ...(nextState.agentReminders ?? [])].slice(0, 80),
      }
      appliedLabels.push(`提醒：${reminder.title}`)
      continue
    }

    if (action.type === 'task_create') {
      const task = createTaskFromAgentAction(action, context)
      if (!task) continue

      nextState = {
        ...nextState,
        agentTasks: [task, ...(nextState.agentTasks ?? [])].slice(0, 120),
      }
      appliedLabels.push(`任务：${task.title}`)
      continue
    }

    if (action.type === 'memory_candidate_create') {
      const memory = createMemoryFromAgentAction(action, context)
      if (!memory) continue

      nextState = addMemoryEventToState(
        {
          ...nextState,
          memories: integrateMemoryCandidate(nextState.memories, memory),
        },
        {
          type: 'captured',
          actor: 'assistant',
          title: memory.title,
          detail: 'Agent 根据妹妹的明确要求写入候选记忆，等待确认或修改。',
          memoryIds: [memory.id],
          characterId: context.character.id,
          conversationId: context.conversation.id,
        },
      )
      appliedLabels.push(`候选记忆：${memory.title}`)
      continue
    }

    if (action.type === 'moment_create') {
      const moment = createMomentFromAgentAction(action, nextState, context)
      if (!moment) continue

      nextState = {
        ...nextState,
        agentMoments: [moment, ...(nextState.agentMoments ?? [])].slice(0, 120),
      }
      appliedLabels.push(`动态：${moment.mood || '已发布'}`)
      continue
    }

    if (action.type === 'room_message_create') {
      const roomUpdate = createRoomUpdateFromAgentAction(action, nextState)
      if (!roomUpdate) continue

      const existingRoom = nextState.agentRooms.find((room) => room.id === roomUpdate.id)
      const nextRooms = existingRoom
        ? nextState.agentRooms.map((room) =>
            room.id === roomUpdate.id
              ? {
                  ...room,
                  title: roomUpdate.title || room.title,
                  description: roomUpdate.description || room.description,
                  memberCharacterIds: mergeUnique([...room.memberCharacterIds, ...roomUpdate.memberCharacterIds]),
                  messages: [...room.messages, ...roomUpdate.messages].slice(-240),
                  updatedAt: roomUpdate.updatedAt,
                }
              : room,
          )
        : [roomUpdate, ...nextState.agentRooms]

      nextState = {
        ...nextState,
        agentRooms: nextRooms,
      }
      appliedLabels.push(`群聊：${roomUpdate.title}`)
    }
  }

  return { state: nextState, appliedLabels }
}

function createMomentFromAgentAction(
  action: AgentAction,
  state: AppState,
  context: { character: CharacterCard },
): AgentMoment | null {
  const input = action.payload.moment
  const content = sanitizeBlockText(input?.content, 520)
  if (!input || !content) return null

  return {
    id: `moment-${crypto.randomUUID()}`,
    authorCharacterId: getKnownCharacterId(input.authorCharacterId, state.characters) ?? context.character.id,
    content,
    mood: sanitizeShortText(input.mood, 42) || '小动态',
    createdAt: nowIso(),
    source: 'agent',
  }
}

function createRoomUpdateFromAgentAction(action: AgentAction, state: AppState): AgentRoom | null {
  const input = action.payload.room
  if (!input || !Array.isArray(input.messages)) return null

  const messages = input.messages
    .map((message): AgentRoomMessage | null => {
      const authorCharacterId = getKnownCharacterId(message.authorCharacterId, state.characters)
      const content = sanitizeBlockText(message.content, 420)
      if (!authorCharacterId || !content) return null

      return {
        id: `room-message-${crypto.randomUUID()}`,
        authorCharacterId,
        content,
        createdAt: nowIso(),
        source: 'agent',
      }
    })
    .filter((message): message is AgentRoomMessage => Boolean(message))

  if (messages.length === 0) return null

  const explicitMembers = Array.isArray(input.memberCharacterIds)
    ? input.memberCharacterIds
        .map((characterId) => getKnownCharacterId(characterId, state.characters))
        .filter((characterId): characterId is string => Boolean(characterId))
    : []
  const memberCharacterIds = mergeUnique([...explicitMembers, ...messages.map((message) => message.authorCharacterId)])
  const roomId =
    sanitizeShortText(input.roomId, 80) ||
    findExistingRoomIdByMembers(state.agentRooms, memberCharacterIds) ||
    `room-agent-${crypto.randomUUID()}`
  const existingRoom = state.agentRooms.find((room) => room.id === roomId)

  return {
    id: roomId,
    title: sanitizeShortText(input.title, 42) || existingRoom?.title || '临时群聊',
    description: existingRoom?.description || '角色之间的多人对话',
    memberCharacterIds,
    messages,
    updatedAt: nowIso(),
  }
}

function createReminderFromAgentAction(
  action: AgentAction,
  context: { character: CharacterCard; conversation: ConversationState },
): AgentReminder | null {
  const reminder = action.payload.reminder
  const remindAt = sanitizeIsoDate(reminder?.remindAt)
  const title = sanitizeShortText(reminder?.title, 48)

  if (!reminder || !remindAt || !title) return null

  return {
    id: `reminder-${crypto.randomUUID()}`,
    title,
    detail: sanitizeShortText(reminder.detail, 160),
    remindAt,
    createdAt: nowIso(),
    status: 'pending',
    characterId: context.character.id,
    conversationId: context.conversation.id,
  }
}

function createTaskFromAgentAction(
  action: AgentAction,
  context: { character: CharacterCard; conversation: ConversationState },
): AgentTask | null {
  const input = action.payload.task
  const title = sanitizeShortText(input?.title, 68)
  const detail = sanitizeBlockText(input?.detail, 420)
  if (!input || !title || !detail) return null

  const steps = Array.isArray(input.steps) ? input.steps : []
  const normalizedSteps = (steps.length > 0 ? steps : ['确认目标', '执行整理', '汇总交付'])
    .map((step): AgentTask['steps'][number] | null => {
      const stepTitle = sanitizeShortText(step, 64)
      if (!stepTitle) return null
      return {
        id: `task-step-${crypto.randomUUID()}`,
        title: stepTitle,
        status: 'queued',
      }
    })
    .filter((step): step is AgentTask['steps'][number] => Boolean(step))
    .slice(0, 6)

  return {
    id: `task-${crypto.randomUUID()}`,
    title,
    detail,
    status: 'queued',
    priority: normalizeTaskPriority(input.priority),
    source: 'agent',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    characterId: context.character.id,
    conversationId: context.conversation.id,
    handoff: sanitizeShortText(input.handoff, 120),
    steps: normalizedSteps,
    logs: ['Agent 已创建任务。'],
  }
}

function createMemoryFromAgentAction(
  action: AgentAction,
  context: { character: CharacterCard; conversation: ConversationState; userMessage: ChatMessage },
) {
  const input = action.payload.memory
  const body = sanitizeShortText(input?.body, 320)
  const title = sanitizeShortText(input?.title, 64)

  if (!input || !body || !title) return null
  const kind = input.kind ?? 'event'

  return createManualMemory({
    title,
    body,
    tags: [...(input.tags ?? []), context.character.name].slice(0, 8),
    priority: input.priority ?? 3,
    pinned: false,
    kind,
    layer: input.layer ?? 'episode',
    scope: inferMemoryScope(kind, context.conversation, context.character),
    confidence: 0.82,
    status: 'candidate',
    sources: [createMemorySourceFromMessage(context.userMessage, context.conversation, context.character)],
    reason: 'Agent 根据用户明确要求写入候选记忆',
  })
}

function sanitizeIsoDate(value: unknown): string {
  if (typeof value !== 'string') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function normalizeTaskPriority(value: unknown): AgentTask['priority'] {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return 'medium'
}

export function transitionTaskSteps(steps: AgentTask['steps'], status: AgentTaskStatus): AgentTask['steps'] {
  if (status === 'completed') {
    return steps.map((step) => ({ ...step, status: 'completed' }))
  }

  if (status === 'running') {
    let activated = false
    return steps.map((step) => {
      if (step.status === 'completed') return step
      if (!activated) {
        activated = true
        return { ...step, status: 'running' }
      }
      return { ...step, status: 'queued' }
    })
  }

  if (status === 'queued') {
    return steps.map((step) => (step.status === 'completed' ? step : { ...step, status: 'queued' }))
  }

  return steps.map((step) => (step.status === 'running' ? { ...step, status } : step))
}

export function buildTaskStatusLog(status: AgentTaskStatus): string {
  if (status === 'running') return '任务已开始。'
  if (status === 'completed') return '任务已完成。'
  if (status === 'failed') return '任务标记为失败。'
  if (status === 'blocked') return '任务标记为卡住。'
  return '任务已放回队列。'
}

export async function enqueueAgentTaskActions(actions: AgentAction[] = []) {
  const taskActions = actions.filter((action) => action.type === 'task_create')
  if (taskActions.length === 0) return

  await Promise.allSettled(taskActions.map((action) => enqueueAgentTaskAction(action)))
}

function sanitizeCharacterPatch(
  patch?: AgentAction['payload']['character'],
): Partial<AppState['characters'][number]> | null {
  if (!patch) return null

  const sanitized: Partial<AppState['characters'][number]> = {}
  const name = sanitizeShortText(patch.name, 18)
  const title = sanitizeShortText(patch.title, 18)
  const subtitle = sanitizeShortText(patch.subtitle, 28)
  const avatar = sanitizeShortText(patch.avatar, 2)

  if (name) sanitized.name = name
  if (title) sanitized.title = title
  if (subtitle) sanitized.subtitle = subtitle
  if (avatar) sanitized.avatar = avatar

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

function sanitizeShortText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return Array.from(value.replace(/[\r\n\t]/g, ' ').trim()).slice(0, maxLength).join('')
}

function sanitizeBlockText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return Array.from(value.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim()).slice(0, maxLength).join('')
}

function getKnownCharacterId(value: unknown, characters: CharacterCard[]): string | null {
  if (typeof value !== 'string') return null
  return characters.some((character) => character.id === value) ? value : null
}

function mergeUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function findExistingRoomIdByMembers(rooms: AgentRoom[], memberCharacterIds: string[]): string {
  if (memberCharacterIds.length === 0) return ''
  const memberSet = new Set(memberCharacterIds)
  const room = rooms.find((item) => memberCharacterIds.every((id) => item.memberCharacterIds.includes(id)))
  if (!room) return ''
  return room.memberCharacterIds.length === memberSet.size ? room.id : ''
}

export function deliverDueReminders(state: AppState, currentTime = Date.now()): { state: AppState; delivered: AgentReminder[] } {
  const reminders = state.agentReminders ?? []
  const dueReminders = reminders
    .filter((reminder) => reminder.status === 'pending')
    .filter((reminder) => new Date(reminder.remindAt).getTime() <= currentTime)
    .slice(0, 3)

  if (dueReminders.length === 0) return { state, delivered: [] }

  const deliveredIds = new Set(dueReminders.map((reminder) => reminder.id))
  const deliveredAt = nowIso()
  let nextState: AppState = {
    ...state,
    agentReminders: reminders.map((reminder) =>
      deliveredIds.has(reminder.id) ? { ...reminder, status: 'delivered', deliveredAt } : reminder,
    ),
  }

  for (const reminder of dueReminders) {
    const characterId = reminder.characterId || nextState.activeCharacterId
    const reminderConversation = getConversation(nextState, characterId)
    const reminderMessage = createMessage(
      'assistant',
      [`提醒妹妹：${reminder.title}`, reminder.detail ? `当时妹妹说：${reminder.detail}` : ''].filter(Boolean).join('\n\n'),
    )

    nextState = upsertConversation(nextState, {
      ...reminderConversation,
      messages: [...reminderConversation.messages, reminderMessage],
      updatedAt: nowIso(),
    })
  }

  return { state: nextState, delivered: dueReminders }
}
