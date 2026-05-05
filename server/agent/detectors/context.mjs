// 上下文转换：动作 / 工具结果转 contextBlock，记忆型 block 识别，历史 Agent 轮次查找

export function actionToContextBlock(action) {
  if (action.type === 'reminder_create') {
    return {
      title: 'Agent 动作：创建提醒',
      content: [
        '工具 reminder 已识别到用户的明确提醒指令。',
        `动作：${action.detail}`,
        action.requiresConfirmation
          ? '这个提醒缺少明确时间，需要先向用户确认。'
          : '前端收到本次响应后会保存这个提醒；网页打开时到点会在聊天里提醒用户。',
      ].join('\n'),
      category: action.requiresConfirmation ? 'boundary' : 'stable',
      reason: action.sourceTool,
    }
  }

  if (action.type === 'memory_candidate_create') {
    return {
      title: 'Agent 动作：写入候选记忆',
      content: [
        '工具 memory_writer 已识别到用户要求保存设定/记忆。',
        `动作：${action.detail}`,
        action.requiresConfirmation
          ? '这条记忆可能涉及高敏内容，不会自动写入；回答时先让用户确认是否要保存，以及保存到哪个范围。'
          : '前端收到本次响应后会把它写成候选记忆，方便用户之后在记忆页确认或修改。',
      ].join('\n'),
      category: action.requiresConfirmation ? 'boundary' : 'stable',
      reason: action.sourceTool,
    }
  }

  if (action.type === 'task_create') {
    return {
      title: 'Agent 动作：创建任务',
      content: [
        '工具 task_writer 已识别到用户的持续推进/后台队列意图。',
        `动作：${action.detail}`,
        '前端收到本次响应后会把它写入任务页；回答时可以自然说明任务已进入队列。',
      ].join('\n'),
      category: 'stable',
      reason: action.sourceTool,
    }
  }

  if (action.type === 'moment_create') {
    return {
      title: 'Agent 动作：发布动态',
      content: [
        '工具 moment_writer 已识别到用户的明确动态发布指令。',
        `动作：${action.detail}`,
        '前端收到本次响应后会把它写入动态页；回答时可以自然说明动态已发布。',
      ].join('\n'),
      category: 'stable',
      reason: action.sourceTool,
    }
  }

  if (action.type === 'room_message_create') {
    return {
      title: 'Agent 动作：写入群聊',
      content: [
        '工具 group_chat 已识别到用户的明确群聊/多人互动指令。',
        `动作：${action.detail}`,
        '前端收到本次响应后会把角色消息写入群聊页；回答时可以自然说明已经放进对应群聊。',
      ].join('\n'),
      category: 'stable',
      reason: action.sourceTool,
    }
  }

  return {
    title: 'Agent 动作：角色资料更新',
    content: [
      '工具 character_profile 已识别到用户的明确状态变更指令。',
      `动作：${action.detail}`,
      action.requiresConfirmation
        ? '这个动作需要用户确认，回答时请先确认，不要说已经完成。'
        : '前端收到本次响应后会自动应用这个动作；回答时可以自然说明已经帮用户改好。',
    ].join('\n'),
    category: 'stable',
    reason: action.sourceTool,
  }
}

export function toolResultToContextBlock(result) {
  return {
    title: result.title,
    content: result.content,
    category: result.status === 'needs_input' ? 'boundary' : 'stable',
    reason: result.name,
  }
}

export function isMemoryLikeContextBlock(block) {
  if (!block) return false
  if (Array.isArray(block.memoryIds) && block.memoryIds.length > 0) return true
  const category = String(block.category || '')
  if (['relationship', 'project', 'event', 'world', 'summary'].includes(category)) return true
  const title = `${block.title || ''} ${block.reason || ''}`
  return /记忆|长期|候选|世界树|最近摘要|设定|人设|偏好|关系/.test(title)
}

export function findPreviousAgentRun(messages) {
  const latestUserIndex = findLatestUserMessageIndex(messages)
  const history = latestUserIndex >= 0 ? messages.slice(0, latestUserIndex) : messages

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    const agent = message?.agent
    if (agent && (Array.isArray(agent.tools) || Array.isArray(agent.actions))) {
      return { message, agent }
    }
  }

  return null
}

export function findLatestUserMessageIndex(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return index
  }
  return -1
}
