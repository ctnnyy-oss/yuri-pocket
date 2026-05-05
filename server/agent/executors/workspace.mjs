// 工作台 / 边界类工具：安全边界、对话快照、能力指南、外部搜索边界

import {
  createAgentId,
  formatToolMessageTime,
  getToolRoleLabel,
  inferSafetyCategory,
  normalizeToolText,
  truncateToolText,
} from '../utils.mjs'

export function createSafetyGuardToolResult(text) {
  const category = inferSafetyCategory(text)

  return {
    id: createAgentId('tool'),
    name: 'safety_guard',
    status: 'success',
    title: 'Agent 工具：高风险回答边界',
    content: [
      '工具 safety_guard 已识别到可能需要谨慎处理的高风险或敏感现实问题。',
      `类别：${category.label}`,
      `回答边界：${category.policy}`,
      '可以给一般性信息、低风险自查点、何时求助专业人士、需要补充的信息；不要给确定诊断、处方剂量、法律结论、投资承诺或保证收益。',
      '语气要先接住用户，不要吓唬；但出现急症、自伤、严重感染、违法风险或大额财务风险时，要明确建议寻求现实专业帮助。',
    ].join('\n'),
    summary: `${category.label}：需要谨慎回答，不能装专家下结论。`,
    createdAt: new Date().toISOString(),
  }
}

export function createConversationSnapshotToolResult(messages) {
  const recentMessages = messages.slice(-8)
  const lines = recentMessages.map((message) => {
    const role = getToolRoleLabel(message?.role)
    const time = formatToolMessageTime(message?.createdAt)
    const content = truncateToolText(normalizeToolText(message?.content), 180)
    return `- ${role}${time ? ` ${time}` : ''}: ${content}`
  })

  return {
    id: createAgentId('tool'),
    name: 'conversation_snapshot',
    status: 'success',
    title: 'Agent 工具：最近对话工作台',
    content: [
      '工具 conversation_snapshot 已执行。',
      `最近消息数：${recentMessages.length}`,
      '可用于总结、下一步建议、设定检查、待办梳理；回答时请保持角色语气，不要暴露内部工具过程。',
      '最近内容：',
      ...lines,
    ].join('\n'),
    summary: `整理最近 ${recentMessages.length} 条消息。`,
    createdAt: new Date().toISOString(),
  }
}

export function createCapabilityGuideToolResult() {
  return {
    id: createAgentId('tool'),
    name: 'capability_guide',
    status: 'success',
    title: 'Agent 工具：能力边界',
    content: [
      '后台轻量 agent 能力已启用：current_time 可读取当前北京时间；date_math 可做日期/倒计时计算；web_search 可做公开网页搜索；web_research 可先搜索再读取公开网页摘录；weather 可查公开天气；web_page 可读取用户提供的公开链接；calculator 可做基础算术；unit_converter 可做常见单位换算；text_inspector 可做字数和文本结构统计；safety_guard 可处理医疗/法律/金融等高风险边界；conversation_snapshot 可整理最近对话；capability_guide 可说明能力边界；attachment_guide 可说明文档/图片/附件处理边界；agent_continuity 可把“继续”接回上一轮；memory_bridge 可协调记忆使用/写入/敏感边界；autonomy_budget 可判断本轮能自主推进到什么程度；risk_gate 可拦住删除、发布、付费、隐私等高风险操作；task_queue 可生成持续任务队列；workflow_router 可选择研究/执行/风险/创作/陪伴工作流；persona_guard 可守住姐姐语气、百合小窝边界和技术透明度；task_planner 可辅助拆解目标；action_checklist 可把大目标变成下一步清单；clarification 可判断是否需要追问；default_policy 可在用户说不懂/都听姐姐时采用保守默认；failure_recovery 可在工具失败或缺输入时给恢复策略；evidence_audit 可校验事实依据和来源限制；tool_governance 可检查工具权限、写入审批和持久化边界；deliverable_contract 可定义最终交付标准；continuation_driver 可减少“继续继续”频率并推进完整切片；answer_composer 可综合多工具结果；response_quality_gate 可在回复前检查结论、证据、风险和语气；agent_quality_check 可做回复前自检；handoff_marker 可给下一轮生成接力标记；character_profile 可在用户明确要求时更新当前角色名称/头像字；reminder 可创建网页内提醒；task_writer 可把持续推进/后台队列意图写入任务页与后台平台；memory_writer 可把用户明确要求保存的普通内容写入候选记忆；moment_writer 可创建角色动态；group_chat 可把角色多人对话写入群聊房间。',
      '你可以主动把用户的模糊需求整理成计划、待办、检查清单或下一步行动；当用户授权“姐姐决定”或要求长冲刺时，优先推进，不要把非阻塞选择反复抛回给用户。',
      '当前已有应用内后台平台 v1：任务队列、本地服务端 worker、通知收件箱、连接器状态和基础执行器可以工作；但它还不是手机系统级常驻后台、完整 Web Push、外部账号 OAuth 或设备控制权限。不能声称自己已经设了系统闹钟、登录私人账号、控制设备或读取用户未提供的私人资料。',
      '单聊、群聊、动态是分开的产品入口。涉及修改角色资料、创建动态或创建群聊消息时，只在工具结果明确表示将应用时说“换好了/发好了/放进群聊了”；否则先问用户确认。',
    ].join('\n'),
    summary: '说明当前 agent 能力与边界。',
    createdAt: new Date().toISOString(),
  }
}

export function createAttachmentGuideToolResult() {
  return {
    id: createAgentId('tool'),
    name: 'attachment_guide',
    status: 'success',
    title: 'Agent 工具：文档与图片边界',
    content: [
      '工具 attachment_guide 已检查文档、图片、截图和文件类能力边界。',
      '当前可用：用户粘贴正文时可直接检查；用户给公开网页 URL 时可用 web_page 摘录；后台平台可做工作区文件扫描任务。',
      '当前不可假装：聊天框里的图片/拍摄/文件按钮还没有真正接入上传、OCR、PDF/DOCX 解析、图片理解或多模态模型输入。',
      '正确回答方式：如果用户问“能不能看文档/图片”，必须说清当前版本只能处理粘贴文本、公开链接和工作区扫描；真正的图片/文档理解需要下一步做上传入口、解析管线、来源记录和记忆候选审核。',
    ].join('\n'),
    summary: '已标出文档/图片能力边界：当前还不能直接解析上传附件。',
    createdAt: new Date().toISOString(),
  }
}

export function createExternalSearchGuideToolResult() {
  return {
    id: createAgentId('tool'),
    name: 'external_search_boundary',
    status: 'needs_input',
    title: 'Agent 工具：外部搜索边界',
    content: [
      '用户可能在询问新闻、热搜、网上最新内容或泛网页搜索。',
      '当前没有提取到足够明确的搜索关键词，不能编造实时新闻和搜索结果。',
      '如果用户提供具体公开 URL，可以用 web_page 读取链接摘录；如果没有 URL，请先问清楚关键词或来源。',
    ].join('\n'),
    summary: '搜索/新闻工具尚未接入。',
    createdAt: new Date().toISOString(),
  }
}
