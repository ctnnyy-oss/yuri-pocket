// 治理 / 风控类工具：自治预算、风险闸、流程路由、人格守护、默认策略、续航、失败恢复、证据校验、工具治理

import {
  TOOL_GOVERNANCE_POLICIES,
  ACTION_GOVERNANCE_POLICIES,
  ACTION_DISPLAY_NAMES,
} from '../constants.mjs'
import {
  createAgentId,
  truncateToolText,
  isMetaToolName,
  getAgentToolLabel,
} from '../utils.mjs'
import {
  inferAutonomyBudget,
  inferRiskGateRisks,
  inferWorkflowRoute,
  inferPersonaGuard,
  buildRecoveryLineForTool,
} from '../actionDetectors.mjs'

export function createAutonomyBudgetToolResult(text, previousAgentRun) {
  const budget = inferAutonomyBudget(text)
  const previousHandoff = previousAgentRun?.agent?.tools?.find?.((tool) => tool.name === 'handoff_marker')

  return {
    id: createAgentId('tool'),
    name: 'autonomy_budget',
    status: 'success',
    title: 'Agent 工具：自治预算',
    content: [
      '工具 autonomy_budget 已判断本轮可自主推进程度。',
      `用户原话：${truncateToolText(text, 260)}`,
      `自治级别：${budget.label}`,
      `可直接做：${budget.allow.join('；')}`,
      `必须暂停确认：${budget.stop.join('；')}`,
      previousHandoff ? `上一轮可接力目标：${previousHandoff.summary}` : '上一轮交接目标：无或不需要。',
      '回复策略：在自治预算内直接推进；遇到暂停条件只问一个关键问题，避免把普通取舍都丢给用户。',
    ].join('\n'),
    summary: `${budget.label}：${budget.short}`,
    createdAt: new Date().toISOString(),
  }
}

export function createRiskGateToolResult(text, agent) {
  const risks = inferRiskGateRisks(text, agent)
  const blockingRisks = risks.filter((risk) => risk.blocking)

  return {
    id: createAgentId('tool'),
    name: 'risk_gate',
    status: blockingRisks.length > 0 ? 'needs_input' : 'success',
    title: 'Agent 工具：风险闸门',
    content: [
      '工具 risk_gate 已检查本轮是否涉及不可逆、高风险或敏感操作。',
      risks.length > 0 ? '风险项：' : '风险项：无明显高风险操作。',
      ...risks.map((risk) => `- ${risk.label}：${risk.detail}`),
      blockingRisks.length > 0
        ? `必须先确认：${blockingRisks[0].question}`
        : '没有必须暂停的风险项；按普通保守默认继续。',
      '回复策略：高风险只给一般信息和安全边界；删除、发布、付费、账号密钥、隐私暴露等不可替用户擅自执行。',
    ].join('\n'),
    summary: blockingRisks.length > 0 ? `需确认：${blockingRisks[0].label}` : '风险检查通过，可继续推进。',
    createdAt: new Date().toISOString(),
  }
}

export function createWorkflowRouterToolResult(text, agent) {
  const route = inferWorkflowRoute(text, agent)

  return {
    id: createAgentId('tool'),
    name: 'workflow_router',
    status: 'success',
    title: 'Agent 工具：工作流路由',
    content: [
      '工具 workflow_router 已选择本轮回复工作流。',
      `工作流：${route.label}`,
      `为什么：${route.reason}`,
      `优先动作：${route.priority}`,
      `输出形状：${route.output}`,
      `避免：${route.avoid}`,
      '回复策略：按工作流组织最终回答，不要把所有工具结果机械堆给用户。',
    ].join('\n'),
    summary: `${route.label}：${route.output}`,
    createdAt: new Date().toISOString(),
  }
}

export function createPersonaGuardToolResult(text, agent) {
  const guard = inferPersonaGuard(text, agent)

  return {
    id: createAgentId('tool'),
    name: 'persona_guard',
    status: 'success',
    title: 'Agent 工具：角色与语气守护',
    content: [
      '工具 persona_guard 已生成本轮角色守护规则。',
      `语气：${guard.tone}`,
      `亲密度：${guard.closeness}`,
      `百合边界：${guard.yuriBoundary}`,
      `技术透明度：${guard.technicality}`,
      `禁止项：${guard.avoid.join('；')}`,
      '回复策略：自然像姐姐在帮妹妹做事；少说内部工具名，除非用户需要验证细节。',
    ].join('\n'),
    summary: `${guard.tone}；${guard.technicality}`,
    createdAt: new Date().toISOString(),
  }
}

export function createDefaultPolicyToolResult(text) {
  const defaults = [
    '用户已经表达“不懂/都听姐姐/姐姐决定”一类授权时，不要把任务退回给用户做选择。',
    '采用保守默认：先做低风险、可验证、可回退的一层；涉及隐私、付费、删除、发布、不可逆操作时再停下确认。',
    '如果存在多个方案，先选最贴合当前项目目标的方案执行；回复里短短说明“姐姐先按这个方向做”。',
    '减少连续追问：同一轮最多问一个真正阻塞的问题；不是阻塞项就放进下一步建议。',
  ]

  return {
    id: createAgentId('tool'),
    name: 'default_policy',
    status: 'success',
    title: 'Agent 工具：默认推进策略',
    content: [
      '工具 default_policy 已识别到用户把决策权交给助手。',
      `用户原话：${truncateToolText(text, 260)}`,
      '默认策略：',
      ...defaults.map((item, index) => `${index + 1}. ${item}`),
      '最终回复要让用户感觉“姐姐已经替我想过并推进了”，不要只给空泛选项。',
    ].join('\n'),
    summary: '用户授权按保守默认值推进，减少追问。',
    createdAt: new Date().toISOString(),
  }
}

export function createContinuationDriverToolResult(text, agent) {
  const directTools = agent.tools.filter((tool) => !isMetaToolName(tool.name)).map(getAgentToolLabel)
  const directActions = agent.actions.map((action) => ACTION_DISPLAY_NAMES[action.type] || action.title)
  const hasBlocker = agent.tools.some((tool) => tool.status === 'needs_input') ||
    agent.actions.some((action) => action.requiresConfirmation)

  return {
    id: createAgentId('tool'),
    name: 'continuation_driver',
    status: 'success',
    title: 'Agent 工具：长冲刺续航',
    content: [
      '工具 continuation_driver 已识别到用户希望减少“继续继续”的频率。',
      `用户原话：${truncateToolText(text, 260)}`,
      '续航策略：本轮尽量完成一个完整能力层，包括实现、验证、收口；不要在还能推进时只回复“可以继续”。',
      '暂停条件：只有破坏性操作、真实账号/付费/发布、缺少不可推断信息、或验证失败需要用户取舍时才停下。',
      directTools.length > 0 ? `本轮可接力的工具：${directTools.join(' / ')}` : '本轮没有外部工具接力，按自然对话和计划推进。',
      directActions.length > 0 ? `本轮可执行动作：${directActions.join(' / ')}` : '本轮没有需要网页状态变更的动作。',
      hasBlocker
        ? '最终回复先说明当前卡点，并只问一个会真正阻塞继续执行的问题。'
        : '最终回复不要以“要不要继续”收尾；如果仍有下一层，直接给出下一轮可自动推进的方向。',
    ].join('\n'),
    summary: hasBlocker ? '已进入长冲刺模式，但有一个关键点需要确认。' : '已进入长冲刺模式，优先一轮完成完整切片。',
    createdAt: new Date().toISOString(),
  }
}

export function createFailureRecoveryToolResult(agent) {
  const pendingTools = agent.tools.filter((tool) => tool.status === 'needs_input')
  const failedTools = agent.tools.filter((tool) => tool.status === 'error')
  const pendingActions = agent.actions.filter((action) => action.requiresConfirmation)
  const recoveryLines = [
    ...pendingTools.map((tool) => buildRecoveryLineForTool(tool, 'needs_input')),
    ...failedTools.map((tool) => buildRecoveryLineForTool(tool, 'error')),
    ...pendingActions.map((action) => `- ${action.title}：缺少确认，最终回复只问一个真正阻塞的时间、对象或权限。`),
  ]

  return {
    id: createAgentId('tool'),
    name: 'failure_recovery',
    status: 'success',
    title: 'Agent 工具：失败恢复策略',
    content: [
      '工具 failure_recovery 已检查失败、缺口和待确认动作。',
      recoveryLines.length > 0 ? '恢复建议：' : '没有需要恢复的失败或缺口。',
      ...recoveryLines,
      '总原则：能换保守方案就换方案，不能换时只问一个关键问题；绝不把失败工具的结果编造成事实。',
    ].join('\n'),
    summary:
      recoveryLines.length > 0
        ? `已生成 ${recoveryLines.length} 条恢复建议。`
        : '没有失败或待确认项。',
    createdAt: new Date().toISOString(),
  }
}

export function createEvidenceAuditToolResult(text, agent) {
  const evidenceTools = agent.tools.filter((tool) =>
    ['web_search', 'web_research', 'web_page', 'weather', 'calculator', 'unit_converter', 'date_math', 'text_inspector'].includes(tool.name),
  )
  const evidence = evidenceTools.map((tool) => ({
    label: getAgentToolLabel(tool),
    name: tool.name,
    status: tool.status,
    summary: tool.summary,
    hasSourceLikeContent: /URL：|https?:\/\//.test(String(tool.content || '')),
  }))
  const missingSource = evidence.filter(
    (item) => ['web_search', 'web_research', 'web_page'].includes(item.name) && !item.hasSourceLikeContent,
  )
  const factualIntent = /官方|文档|搜索|查|研究|最新|新闻|价格|天气|几点|日期|多少|换算|字数|统计|证据|来源|引用/.test(text)
  const failedEvidence = evidence.filter((item) => item.status !== 'success')

  return {
    id: createAgentId('tool'),
    name: 'evidence_audit',
    status: failedEvidence.length > 0 ? 'needs_input' : 'success',
    title: 'Agent 工具：证据校验',
    content: [
      '工具 evidence_audit 已检查本轮事实依据。',
      evidence.length > 0 ? '依据清单：' : '依据清单：本轮没有事实型工具结果。',
      ...evidence.map((item) => `- ${item.label}(${item.status})：${item.summary}`),
      factualIntent && evidence.length === 0 ? '注意：用户可能需要事实依据，但本轮没有命中事实型工具；不要编造。' : '',
      failedEvidence.length > 0 ? `未完成依据：${failedEvidence.map((item) => item.label).join(' / ')}。最终回复必须说明限制。` : '',
      missingSource.length > 0 ? '注意：网页类结果缺少可见 URL，不能当成可引用来源。' : '',
      '回复策略：工具成功的数字/日期/摘录优先；搜索只代表有限结果；网页摘录不等于读完整站；没有证据就标注不确定。',
    ]
      .filter(Boolean)
      .join('\n'),
    summary:
      evidence.length > 0
        ? `已校验 ${evidence.length} 个事实依据。`
        : '本轮没有可校验事实依据，需避免编造。',
    createdAt: new Date().toISOString(),
  }
}

export function createToolGovernanceToolResult(agent) {
  const governedTools = agent.tools.filter((tool) => !['agent_brief', 'tool_governance'].includes(tool.name))
  const toolLines = governedTools
    .filter((tool) => TOOL_GOVERNANCE_POLICIES[tool.name])
    .map((tool) => describeGovernedTool(tool))
  const metaToolCount = governedTools.length - toolLines.length
  const actionLines = agent.actions.map((action) => describeGovernedAction(action))
  const pendingApprovals = agent.actions.filter((action) => action.requiresConfirmation)
  const pendingTools = governedTools.filter((tool) => tool.status === 'needs_input')
  const failedTools = governedTools.filter((tool) => tool.status === 'error')

  return {
    id: createAgentId('tool'),
    name: 'tool_governance',
    status: pendingApprovals.length > 0 || pendingTools.length > 0 ? 'needs_input' : 'success',
    title: 'Agent 工具：工具治理与权限',
    content: [
      '工具 tool_governance 已按“读操作尽量自动、写操作必须有明确意图、高敏操作先确认”的策略检查本轮工具链。',
      toolLines.length > 0 ? '只读/事实工具：' : '只读/事实工具：本轮没有调用外部事实工具。',
      ...toolLines,
      metaToolCount > 0 ? `编排工具：${metaToolCount} 个，用来规划、质检、接力或收口，不直接证明外部事实。` : '',
      actionLines.length > 0 ? '写入动作：' : '写入动作：无。',
      ...actionLines,
      pendingApprovals.length > 0 ? `必须先确认：${pendingApprovals.map((action) => action.title).join(' / ')}。` : '',
      pendingTools.length > 0 ? `缺少输入：${pendingTools.map(getAgentToolLabel).join(' / ')}。` : '',
      failedTools.length > 0 ? `失败工具：${failedTools.map(getAgentToolLabel).join(' / ')}。最终回复必须说明限制，不能补编结果。` : '',
      '事实边界：时间、计算、天气、搜索、网页摘录只能引用成功工具结果；没有工具依据时要标注不确定。',
      '持久化边界：提醒、任务、记忆、动态、群聊只写入本应用；后台平台可以处理应用内任务队列，但不能假装已经完成系统外通知、外部账号 OAuth 或设备级执行。',
    ]
      .filter(Boolean)
      .join('\n'),
    summary:
      pendingApprovals.length > 0
        ? `有 ${pendingApprovals.length} 个写入动作需要确认。`
        : actionLines.length > 0
          ? `已检查 ${actionLines.length} 个应用内写入动作。`
          : `已检查 ${toolLines.length} 个事实/只读工具。`,
    createdAt: new Date().toISOString(),
  }
}

export function describeGovernedTool(tool) {
  const policy = TOOL_GOVERNANCE_POLICIES[tool.name]
  const label = getAgentToolLabel(tool)
  return `- ${label}(${tool.status})：${policy.risk} / ${policy.mode}；依据：${policy.evidence}；摘要：${truncateToolText(tool.summary, 120)}`
}

export function describeGovernedAction(action) {
  const policy = ACTION_GOVERNANCE_POLICIES[action.type] ?? {
    risk: '应用内写入',
    mode: '明确指令才处理',
    target: '本应用状态',
  }
  const confirmation = action.requiresConfirmation ? '待确认，不会自动执行' : '可自动写入应用内队列/状态'
  return `- ${ACTION_DISPLAY_NAMES[action.type] || action.title}：${policy.risk} / ${policy.mode}；目标：${policy.target}；${confirmation}；${truncateToolText(action.detail, 120)}`
}
