// 输出质量类工具：综合答复、回复质检、Agent 自检、交接、Brief

import { TOOL_DISPLAY_NAMES, ACTION_DISPLAY_NAMES } from '../constants.mjs'
import {
  createAgentId,
  truncateToolText,
  isMetaToolName,
  getAgentToolLabel,
} from '../utils.mjs'
import {
  shouldUseSearchTool,
  shouldUseDeepResearchTool,
  shouldUseWebPageTool,
  shouldUseCalculatorTool,
  shouldUseDateMathTool,
  shouldUseUnitConverterTool,
  shouldUseActionChecklistTool,
  shouldUseContinuationDriverTool,
  shouldUseAutonomyBudgetTool,
  shouldUseDefaultPolicyTool,
} from '../toolDetectors.mjs'
import {
  analyzeAgentIntent,
  buildResponseQualityChecks,
  inferHandoffNextStep,
} from '../actionDetectors.mjs'

export function createAnswerComposerToolResult(text, agent) {
  const nonMetaTools = agent.tools.filter((tool) => !isMetaToolName(tool.name))
  const successfulTools = nonMetaTools.filter((tool) => tool.status === 'success').map(getAgentToolLabel)
  const pendingTools = nonMetaTools.filter((tool) => tool.status === 'needs_input').map(getAgentToolLabel)
  const failedTools = nonMetaTools.filter((tool) => tool.status === 'error').map(getAgentToolLabel)
  const actionLabels = agent.actions.map((action) => ACTION_DISPLAY_NAMES[action.type] || action.title)

  return {
    id: createAgentId('tool'),
    name: 'answer_composer',
    status: 'success',
    title: 'Agent 工具：多工具综合回复',
    content: [
      '工具 answer_composer 已把本轮工具、动作和用户语气合成为回复策略。',
      `用户目标：${truncateToolText(text, 260)}`,
      successfulTools.length > 0 ? `可作为依据的结果：${successfulTools.join(' / ')}` : '可作为依据的结果：无。',
      pendingTools.length > 0 ? `必须先说明的缺口：${pendingTools.join(' / ')}` : '必须先说明的缺口：无。',
      failedTools.length > 0 ? `必须诚实说明的失败：${failedTools.join(' / ')}` : '必须诚实说明的失败：无。',
      actionLabels.length > 0 ? `已交给应用处理的动作：${actionLabels.join(' / ')}` : '已交给应用处理的动作：无。',
      '回复顺序：1. 先给妹妹直接结论；2. 再自然说明姐姐查了/算了/整理了什么；3. 有边界或失败就坦诚说；4. 给下一步，但不要把选择压力推回给妹妹。',
      '不要把 agent_brief、answer_composer、agent_quality_check 这些内部整理工具当成用户成果炫耀。',
    ].join('\n'),
    summary: `已综合 ${successfulTools.length} 个结果、${actionLabels.length} 个动作。`,
    createdAt: new Date().toISOString(),
  }
}

export function createResponseQualityGateToolResult(text, agent) {
  const checks = buildResponseQualityChecks(text, agent)
  const warnings = checks.filter((check) => check.status === 'warn')

  return {
    id: createAgentId('tool'),
    name: 'response_quality_gate',
    status: 'success',
    title: 'Agent 工具：回复质检',
    content: [
      '工具 response_quality_gate 已检查最终回复前的质量门槛。',
      '检查项：',
      ...checks.map((check) => `- [${check.status === 'ok' ? '通过' : '注意'}] ${check.label}：${check.detail}`),
      warnings.length > 0
        ? `最终回复修正重点：${warnings.map((check) => check.label).join(' / ')}`
        : '最终回复可以按当前策略输出。',
      '总原则：有结论、有依据、有边界、有下一步；不要空泛，不要装懂，不要把非阻塞问题丢回给用户。',
    ].join('\n'),
    summary: warnings.length > 0 ? `质检提示：${warnings[0].label}` : '质检通过：可输出收口回复。',
    createdAt: new Date().toISOString(),
  }
}

export function createAgentQualityCheckToolResult(text, agent) {
  const warnings = []
  const nonMetaTools = agent.tools.filter((tool) => !isMetaToolName(tool.name))
  const hasSearchIntent = shouldUseSearchTool(text) || shouldUseDeepResearchTool(text) || shouldUseWebPageTool(text)
  const hasSearchTool = nonMetaTools.some((tool) => ['web_search', 'web_research', 'web_page'].includes(tool.name))
  const hasCalculationIntent = shouldUseCalculatorTool(text) || shouldUseDateMathTool(text) || shouldUseUnitConverterTool(text)
  const hasCalculationTool = nonMetaTools.some((tool) => ['calculator', 'date_math', 'unit_converter'].includes(tool.name))
  const hasExecutionIntent = shouldUseActionChecklistTool(text) || shouldUseContinuationDriverTool(text)
  const hasExecutionGuide = nonMetaTools.some((tool) => ['task_planner', 'action_checklist', 'continuation_driver'].includes(tool.name))

  if (hasSearchIntent && !hasSearchTool) warnings.push('资料/最新类问题没有拿到搜索或网页摘录，不能编造来源。')
  if (hasCalculationIntent && !hasCalculationTool) warnings.push('精确数字问题没有拿到计算工具结果，不能心算硬答。')
  if (hasExecutionIntent && !hasExecutionGuide) warnings.push('执行型请求缺少拆解或续航策略，容易停在空话。')
  if (agent.tools.some((tool) => tool.status === 'needs_input') || agent.actions.some((action) => action.requiresConfirmation)) {
    warnings.push('存在待确认项，最终回复只问一个真正阻塞的问题。')
  }
  if (agent.tools.some((tool) => tool.status === 'error')) {
    warnings.push('存在失败工具，最终回复必须诚实说明失败范围。')
  }
  if (agent.tools.some((tool) => tool.name === 'risk_gate' && tool.status === 'needs_input')) {
    warnings.push('风险闸门要求暂停确认，不能擅自执行高风险操作。')
  }
  if (agent.tools.some((tool) => tool.name === 'evidence_audit' && tool.status === 'needs_input')) {
    warnings.push('证据校验存在未完成依据，最终回复要标注限制。')
  }
  if (shouldUseAutonomyBudgetTool(text, null) && !agent.tools.some((tool) => tool.name === 'autonomy_budget')) {
    warnings.push('用户表达了自治/长冲刺授权，但未生成自治预算。')
  }
  if (shouldUseDefaultPolicyTool(text) && !agent.tools.some((tool) => tool.name === 'default_policy')) {
    warnings.push('用户已授权默认推进，但默认策略没有落入上下文。')
  }

  return {
    id: createAgentId('tool'),
    name: 'agent_quality_check',
    status: 'success',
    title: 'Agent 工具：本轮质量自检',
    content: [
      '工具 agent_quality_check 已检查工具选择、边界、续航和回复策略。',
      warnings.length > 0 ? `注意事项：${warnings.join(' / ')}` : '自检结果：工具选择、边界提示和回复策略已对齐。',
      '最终回复要求：优先给确定结论；不确定就标出来；不要装作已经完成未完成的事；不要把用户已经授权默认推进的问题重新丢回给用户。',
    ].join('\n'),
    summary: warnings.length > 0 ? `自检完成：${warnings[0]}` : '自检通过：可按当前结果回复。',
    createdAt: new Date().toISOString(),
  }
}

export function createHandoffMarkerToolResult(text, agent) {
  const completed = agent.tools
    .filter((tool) => !isMetaToolName(tool.name) && tool.status === 'success')
    .map(getAgentToolLabel)
  const blocked = [
    ...agent.tools.filter((tool) => !isMetaToolName(tool.name) && tool.status === 'needs_input').map(getAgentToolLabel),
    ...agent.actions.filter((action) => action.requiresConfirmation).map((action) => action.title),
  ]
  const failed = agent.tools.filter((tool) => !isMetaToolName(tool.name) && tool.status === 'error').map(getAgentToolLabel)
  const nextStep = inferHandoffNextStep(agent, text)

  return {
    id: createAgentId('tool'),
    name: 'handoff_marker',
    status: 'success',
    title: 'Agent 工具：下轮交接标记',
    content: [
      '工具 handoff_marker 已生成给下一轮“继续”使用的交接摘要。',
      `本轮目标：${truncateToolText(text, 220)}`,
      completed.length > 0 ? `已完成：${completed.join(' / ')}` : '已完成：无直接工具结果。',
      blocked.length > 0 ? `阻塞项：${blocked.join(' / ')}` : '阻塞项：无。',
      failed.length > 0 ? `失败项：${failed.join(' / ')}` : '失败项：无。',
      `下轮接力：${nextStep}`,
      '下一轮如果用户说“继续/接着/姐姐看着办”，优先沿着这条接力推进，不要重问目标。',
    ].join('\n'),
    summary: blocked.length > 0 ? `下轮先处理阻塞项：${blocked[0]}` : `下轮接力：${nextStep}`,
    createdAt: new Date().toISOString(),
  }
}

export function createAgentBriefToolResult(text, agent) {
  const intent = analyzeAgentIntent(text)
  const toolNames = agent.tools.map((tool) => TOOL_DISPLAY_NAMES[tool.name] || tool.title.replace('Agent 工具：', ''))
  const actionNames = agent.actions.map((action) => ACTION_DISPLAY_NAMES[action.type] || action.title)
  const failedTools = agent.tools.filter((tool) => tool.status === 'error').map((tool) => tool.title.replace('Agent 工具：', ''))
  const waitingTools = [
    ...agent.tools.filter((tool) => tool.status === 'needs_input').map((tool) => tool.title.replace('Agent 工具：', '')),
    ...agent.actions.filter((action) => action.requiresConfirmation).map((action) => action.title),
  ]

  return {
    id: createAgentId('tool'),
    name: 'agent_brief',
    status: waitingTools.length > 0 ? 'needs_input' : failedTools.length > 0 ? 'error' : 'success',
    title: 'Agent 工具：本轮工作台',
    content: [
      'Agent 工作台已完成本轮意图判断。',
      `用户意图：${intent.label}`,
      `置信度：${intent.confidence}`,
      `回答策略：${intent.policy}`,
      toolNames.length > 0 ? `已选择工具：${toolNames.join(' / ')}` : '已选择工具：无，走自然对话。',
      actionNames.length > 0 ? `待执行动作：${actionNames.join(' / ')}` : '待执行动作：无。',
      failedTools.length > 0 ? `失败工具：${failedTools.join(' / ')}。必须如实说明，不要补编结果。` : '',
      waitingTools.length > 0 ? `需要补充或确认：${waitingTools.join(' / ')}。回答时先问清楚关键缺口。` : '',
      '最终回复必须像角色在帮用户办事：先接住语气，再给结论、依据、下一步；不要暴露内部字段名。',
    ]
      .filter(Boolean)
      .join('\n'),
    summary: `${intent.label}：${intent.short}`,
    createdAt: new Date().toISOString(),
  }
}
