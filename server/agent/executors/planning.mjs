// 规划/接力类工具：任务拆解、行动清单、澄清、记忆桥、连续性、任务队列、交付契约

import { TOOL_DISPLAY_NAMES, ACTION_DISPLAY_NAMES } from '../constants.mjs'
import {
  createAgentId,
  truncateToolText,
  getAgentToolLabel,
} from '../utils.mjs'
import {
  analyzeAgentIntent,
  buildClarificationQuestions,
  buildAgentTaskQueue,
  buildDeliverableContract,
  isMemoryLikeContextBlock,
} from '../actionDetectors.mjs'

export function createTaskPlannerToolResult(text) {
  return {
    id: createAgentId('tool'),
    name: 'task_planner',
    status: 'success',
    title: 'Agent 工具：任务拆解',
    content: [
      '工具 task_planner 已识别到规划、拆解、优化或下一步意图。',
      `用户目标：${truncateToolText(text, 260)}`,
      '回答策略：先复述用户真正想达成的目标；再给 2-5 个高优先级步骤；明确哪些能现在做、哪些需要工具或用户确认；如果任务很大，优先给下一步最小可执行动作。',
      '保持角色语气，不要把内部链路、模型名或“我作为 AI”的说法摆到用户面前。',
    ].join('\n'),
    summary: '已进入任务拆解模式。',
    createdAt: new Date().toISOString(),
  }
}

export function createActionChecklistToolResult(text, agent) {
  const intent = analyzeAgentIntent(text)
  const activeTools = agent.tools
    .filter((tool) => tool.name !== 'agent_brief')
    .map((tool) => TOOL_DISPLAY_NAMES[tool.name] || tool.title.replace('Agent 工具：', ''))
  const activeActions = agent.actions.map((action) => ACTION_DISPLAY_NAMES[action.type] || action.title)

  return {
    id: createAgentId('tool'),
    name: 'action_checklist',
    status: 'success',
    title: 'Agent 工具：行动清单',
    content: [
      '工具 action_checklist 已把用户的大目标整理成可执行动作。',
      `目标判断：${intent.label}`,
      `用户原话：${truncateToolText(text, 260)}`,
      '建议执行顺序：',
      '1. 先处理本轮能直接完成的工具或动作，给用户一个明确结果。',
      '2. 如果信息不足，只问最关键的 1 个问题；如果用户说不懂/都听姐姐的，就按保守默认值推进。',
      '3. 对大任务先做最小可验证切片，再跑验证，再继续下一层。',
      '4. 回复里说明“已经做了什么、还差什么、下一步怎么走”，避免空泛鼓励。',
      activeTools.length > 0 ? `本轮工具：${activeTools.join(' / ')}` : '本轮工具：无。',
      activeActions.length > 0 ? `本轮动作：${activeActions.join(' / ')}` : '本轮动作：无。',
    ].join('\n'),
    summary: `${intent.label}：已生成下一步行动清单。`,
    createdAt: new Date().toISOString(),
  }
}

export function createClarificationToolResult(text, agent) {
  const questions = buildClarificationQuestions(text, agent)
  const blockingQuestions = questions.filter(
    (question) => !question.startsWith('妹妹不用') && !question.startsWith('姐姐可以先按'),
  )

  return {
    id: createAgentId('tool'),
    name: 'clarification',
    status: blockingQuestions.length > 0 ? 'needs_input' : 'success',
    title: 'Agent 工具：澄清缺口',
    content: [
      '工具 clarification 已检查本轮是否有关键缺口。',
      blockingQuestions.length > 0
        ? `建议只问最关键问题：${blockingQuestions[0]}`
        : '没有必须卡住的问题。用户已经表达“听姐姐的/不懂”时，优先采用保守默认值继续推进。',
      questions.length > 0 ? `补充判断：${questions.slice(0, 3).join(' / ')}` : '',
      '回答策略：不要连续追问；能默认就默认，默认后告诉用户姐姐先按这个方向做。',
    ]
      .filter(Boolean)
      .join('\n'),
    summary: blockingQuestions[0] || '无需追问，按保守默认值推进。',
    createdAt: new Date().toISOString(),
  }
}

export function createAgentContinuityToolResult(text, previousAgentRun) {
  const previousTools = Array.isArray(previousAgentRun?.agent?.tools) ? previousAgentRun.agent.tools : []
  const previousActions = Array.isArray(previousAgentRun?.agent?.actions) ? previousAgentRun.agent.actions : []
  const handoff = previousTools.find((tool) => tool.name === 'handoff_marker')
  const visibleTools = previousTools
    .filter((tool) => !['agent_brief', 'answer_composer', 'agent_quality_check'].includes(tool.name))
    .slice(-6)
  const pending = [
    ...previousTools.filter((tool) => tool.status === 'needs_input').map(getAgentToolLabel),
    ...previousActions.filter((action) => action.requiresConfirmation).map((action) => action.title),
  ]
  const failed = previousTools.filter((tool) => tool.status === 'error').map(getAgentToolLabel)

  return {
    id: createAgentId('tool'),
    name: 'agent_continuity',
    status: 'success',
    title: 'Agent 工具：多轮任务接力',
    content: [
      '工具 agent_continuity 已接上上一轮 Agent 轨迹。',
      `本轮用户原话：${truncateToolText(text, 260)}`,
      handoff ? `上一轮交接：${handoff.summary}` : '上一轮没有专门交接标记，改用工具轨迹接力。',
      visibleTools.length > 0
        ? `上一轮工具：${visibleTools.map((tool) => `${getAgentToolLabel(tool)}(${tool.status})`).join(' / ')}`
        : '上一轮工具：无可读轨迹。',
      previousActions.length > 0
        ? `上一轮动作：${previousActions.map((action) => `${ACTION_DISPLAY_NAMES[action.type] || action.title}${action.requiresConfirmation ? '(待确认)' : ''}`).join(' / ')}`
        : '上一轮动作：无。',
      pending.length > 0 ? `仍需确认：${pending.join(' / ')}。继续前只问真正阻塞的一项。` : '没有遗留的必须确认项，可以直接延续上一轮方向。',
      failed.length > 0 ? `上一轮失败：${failed.join(' / ')}。继续时优先换保守方案，不要假装已完成。` : '',
      '回复策略：把“继续”理解为接着上一轮推进，不要重新向用户索要已经给过的目标。',
    ]
      .filter(Boolean)
      .join('\n'),
    summary: pending.length > 0 ? `已接上上一轮，还有 ${pending.length} 个待确认项。` : '已接上上一轮，可直接继续推进。',
    createdAt: new Date().toISOString(),
  }
}

export function createMemoryBridgeToolResult(_text, contextBlocks, agent) {
  const memoryBlocks = contextBlocks.filter(isMemoryLikeContextBlock)
  const memoryAction = agent.actions.find((action) => action.type === 'memory_candidate_create')
  const blockLines = memoryBlocks.slice(0, 6).map((block) => {
    const label = block.category || 'context'
    const reason = block.reason ? `；原因：${truncateToolText(String(block.reason), 80)}` : ''
    return `- ${block.title}（${label}${reason}）`
  })

  return {
    id: createAgentId('tool'),
    name: 'memory_bridge',
    status: 'success',
    title: 'Agent 工具：记忆协同',
    content: [
      '工具 memory_bridge 已检查本轮记忆和 Agent 动作的衔接。',
      memoryBlocks.length > 0 ? `本轮命中 ${memoryBlocks.length} 条记忆/设定/摘要上下文：` : '本轮没有命中可直接引用的长期记忆。',
      ...blockLines,
      memoryAction ? `本轮将写入候选记忆：${memoryAction.detail}` : '本轮没有明确的记忆写入动作。',
      '使用规则：当前用户表达优先于旧记忆；敏感记忆只在用户主动相关时谨慎使用；一次性闲聊不要升级成永久偏好。',
      '写入规则：只有用户明确要求记住、保存、写进记忆或设定时才创建候选记忆；模糊情绪先陪伴，不自动长期化。',
      '回复策略：如果用到了记忆，只自然承接，不要炫耀“我记得很多”；如果写入了候选记忆，简短告知等待确认。',
    ].join('\n'),
    summary: memoryBlocks.length > 0 ? `已协同 ${memoryBlocks.length} 条记忆/设定上下文。` : '已应用记忆写入与提及边界。',
    createdAt: new Date().toISOString(),
  }
}

export function createTaskQueueToolResult(text, agent, previousAgentRun) {
  const queue = buildAgentTaskQueue(text, agent, previousAgentRun)

  return {
    id: createAgentId('tool'),
    name: 'task_queue',
    status: 'success',
    title: 'Agent 工具：任务队列',
    content: [
      '工具 task_queue 已把本轮目标拆成可持续推进的队列。',
      `总目标：${queue.goal}`,
      `当前阶段：${queue.phase}`,
      '队列：',
      ...queue.items.map((item, index) => `${index + 1}. [${item.status}] ${item.title}；验收：${item.acceptance}`),
      `下一步优先：${queue.next}`,
      `停止条件：${queue.stop}`,
      '回复策略：先汇报已完成和正在做的最小切片；下一步给明确方向，不用让用户反复说“继续”。',
    ].join('\n'),
    summary: `${queue.phase}：下一步 ${queue.next}`,
    createdAt: new Date().toISOString(),
  }
}

export function createDeliverableContractToolResult(text, agent) {
  const contract = buildDeliverableContract(text, agent)

  return {
    id: createAgentId('tool'),
    name: 'deliverable_contract',
    status: 'success',
    title: 'Agent 工具：交付契约',
    content: [
      '工具 deliverable_contract 已定义本轮最终交付标准。',
      `交付类型：${contract.type}`,
      '必须包含：',
      ...contract.must.map((item) => `- ${item}`),
      contract.optional.length > 0 ? '可选补充：' : '',
      ...contract.optional.map((item) => `- ${item}`),
      '验收标准：',
      ...contract.acceptance.map((item) => `- ${item}`),
      '回复策略：按契约收口，避免只有过程没有结果。',
    ]
      .filter(Boolean)
      .join('\n'),
    summary: `${contract.type}：${contract.must[0]}`,
    createdAt: new Date().toISOString(),
  }
}
