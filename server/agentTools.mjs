const BEIJING_TIME_ZONE = 'Asia/Shanghai'
const WEATHER_TIMEOUT_MS = 8_000
const SEARCH_TIMEOUT_MS = 10_000
const WEB_FETCH_TIMEOUT_MS = 8_000
const MAX_SEARCH_RESULTS = 5
const MAX_SEARCH_SNIPPET_LENGTH = 260
const MAX_WEB_TEXT_LENGTH = 3_200
const TOOL_DISPLAY_NAMES = {
  current_time: '看时间',
  date_math: '算日期',
  weather: '查天气',
  web_search: '联网搜索',
  web_research: '深度研究',
  web_page: '读网页',
  calculator: '计算器',
  unit_converter: '单位换算',
  text_inspector: '文本检查',
  safety_guard: '风险边界',
  conversation_snapshot: '整理上下文',
  capability_guide: '能力边界',
  task_planner: '拆任务',
  action_checklist: '行动清单',
  clarification: '澄清缺口',
  agent_continuity: '多轮接力',
  memory_bridge: '记忆协同',
  autonomy_budget: '自治预算',
  risk_gate: '风险闸门',
  task_queue: '任务队列',
  workflow_router: '工作流路由',
  persona_guard: '角色守护',
  default_policy: '默认策略',
  failure_recovery: '失败恢复',
  evidence_audit: '证据校验',
  answer_composer: '综合回复',
  deliverable_contract: '交付契约',
  response_quality_gate: '回复质检',
  continuation_driver: '续航推进',
  agent_quality_check: '质量自检',
  handoff_marker: '交接标记',
  tool_governance: '工具治理',
}
const ACTION_DISPLAY_NAMES = {
  character_profile_update: '改角色资料',
  reminder_create: '创建提醒',
  task_create: '创建任务',
  memory_candidate_create: '写候选记忆',
  moment_create: '发动态',
  room_message_create: '写群聊',
}
const TOOL_GOVERNANCE_POLICIES = {
  current_time: { risk: '只读', mode: '自动', evidence: '本机北京时间' },
  date_math: { risk: '只读', mode: '自动', evidence: '确定性日期计算' },
  calculator: { risk: '只读', mode: '自动', evidence: '确定性算式计算' },
  unit_converter: { risk: '只读', mode: '自动', evidence: '固定换算规则' },
  text_inspector: { risk: '只读', mode: '自动', evidence: '输入文本统计' },
  weather: { risk: '联网只读', mode: '自动', evidence: '公开天气接口' },
  web_search: { risk: '联网只读', mode: '自动', evidence: '公开搜索摘录' },
  web_research: { risk: '联网只读', mode: '自动', evidence: '公开搜索与网页摘录' },
  web_page: { risk: '联网只读', mode: '自动', evidence: '用户给出的公开链接' },
  safety_guard: { risk: '高风险建议', mode: '自动加边界', evidence: '安全策略' },
  conversation_snapshot: { risk: '本轮上下文', mode: '自动', evidence: '当前聊天' },
}
const ACTION_GOVERNANCE_POLICIES = {
  character_profile_update: { risk: '应用内写入', mode: '明确指令才自动', target: '当前角色资料' },
  reminder_create: { risk: '应用内写入', mode: '明确时间才自动', target: '网页内提醒' },
  task_create: { risk: '后台队列写入', mode: '明确持续任务才自动', target: '任务页与本地后台平台' },
  memory_candidate_create: { risk: '记忆候选', mode: '普通候选自动，高敏先确认', target: '记忆候选队列' },
  moment_create: { risk: '应用内写入', mode: '明确发布才自动', target: '角色动态' },
  room_message_create: { risk: '应用内写入', mode: '明确群聊才自动', target: '群聊房间' },
}
const KNOWN_LOCATION_COORDINATES = {
  北京: { name: '北京', country: '中国', admin1: '北京市', latitude: 39.9042, longitude: 116.4074 },
  上海: { name: '上海', country: '中国', admin1: '上海市', latitude: 31.2304, longitude: 121.4737 },
  广州: { name: '广州', country: '中国', admin1: '广东', latitude: 23.1291, longitude: 113.2644 },
  深圳: { name: '深圳', country: '中国', admin1: '广东', latitude: 22.5431, longitude: 114.0579 },
  成都: { name: '成都', country: '中国', admin1: '四川', latitude: 30.5728, longitude: 104.0668 },
  重庆: { name: '重庆', country: '中国', admin1: '重庆市', latitude: 29.563, longitude: 106.5516 },
  杭州: { name: '杭州', country: '中国', admin1: '浙江', latitude: 30.2741, longitude: 120.1551 },
  南京: { name: '南京', country: '中国', admin1: '江苏', latitude: 32.0603, longitude: 118.7969 },
  武汉: { name: '武汉', country: '中国', admin1: '湖北', latitude: 30.5928, longitude: 114.3055 },
  西安: { name: '西安', country: '中国', admin1: '陕西', latitude: 34.3416, longitude: 108.9398 },
  拉萨: { name: '拉萨', country: '中国', admin1: '西藏', latitude: 29.65, longitude: 91.1 },
  林芝: { name: '林芝', country: '中国', admin1: '西藏', latitude: 29.6547, longitude: 94.3611 },
  察隅: { name: '察隅', country: '中国', admin1: '西藏', latitude: 28.6604, longitude: 97.4669 },
  达州: { name: '达州', country: '中国', admin1: '四川', latitude: 31.2096, longitude: 107.4679 },
  东京: { name: '东京', country: '日本', admin1: '东京都', latitude: 35.6762, longitude: 139.6503 },
  大阪: { name: '大阪', country: '日本', admin1: '大阪府', latitude: 34.6937, longitude: 135.5023 },
  首尔: { name: '首尔', country: '韩国', admin1: '首尔特别市', latitude: 37.5665, longitude: 126.978 },
  纽约: { name: '纽约', country: '美国', admin1: '纽约州', latitude: 40.7128, longitude: -74.006 },
  伦敦: { name: '伦敦', country: '英国', admin1: '英格兰', latitude: 51.5072, longitude: -0.1276 },
  巴黎: { name: '巴黎', country: '法国', admin1: '法兰西岛', latitude: 48.8566, longitude: 2.3522 },
  香港: { name: '香港', country: '中国', admin1: '香港', latitude: 22.3193, longitude: 114.1694 },
  台北: { name: '台北', country: '中国', admin1: '台湾', latitude: 25.033, longitude: 121.5654 },
  澳门: { name: '澳门', country: '中国', admin1: '澳门', latitude: 22.1987, longitude: 113.5439 },
}
const CHARACTER_ALIASES = [
  { id: 'sister-architect', names: ['姐姐大人', '姐姐', '主陪伴体'] },
  { id: 'ningan-princess', names: ['宁安', '宁安郡主', '郡主'] },
  { id: 'aling-maid', names: ['阿绫', '绫'] },
  { id: 'su-wanyin', names: ['苏晚吟', '晚吟'] },
  { id: 'xie-zhao', names: ['谢昭'] },
  { id: 'shen-wanci', names: ['沈晚辞', '皇后'] },
  { id: 'lu-wanzhao', names: ['陆婉昭', '婉昭'] },
]
const CP_ROOM_BY_MEMBERS = [
  { roomId: 'room-ningan-aling', members: ['ningan-princess', 'aling-maid'], title: '宁安 × 阿绫' },
  { roomId: 'room-wanyin-xiezhao', members: ['su-wanyin', 'xie-zhao'], title: '苏晚吟 × 谢昭' },
  { roomId: 'room-wanci-wanzhao', members: ['shen-wanci', 'lu-wanzhao'], title: '沈晚辞 × 陆婉昭' },
]

export async function prepareAgentBundle(bundle) {
  const contextBlocks = Array.isArray(bundle?.contextBlocks) ? bundle.contextBlocks : []
  const messages = Array.isArray(bundle?.messages) ? bundle.messages : []
  const latestUserMessage = [...messages].reverse().find((message) => message?.role === 'user')
  const latestUserText = normalizeToolText(latestUserMessage?.content)
  const previousAgentRun = findPreviousAgentRun(messages)
  const agent = createEmptyAgentRun()

  if (!latestUserText) {
    return { bundle: { ...bundle, contextBlocks }, agent }
  }

  if (shouldUseTimeTool(latestUserText)) {
    agent.tools.push(createCurrentTimeToolResult())
  }

  if (shouldUseDateMathTool(latestUserText)) {
    agent.tools.push(createDateMathToolResult(latestUserText))
  }

  if (shouldUseWeatherTool(latestUserText)) {
    agent.tools.push(await createWeatherToolResult(latestUserText))
  }

  if (shouldUseDeepResearchTool(latestUserText)) {
    agent.tools.push(await createWebResearchToolResult(latestUserText))
  } else if (shouldUseSearchTool(latestUserText)) {
    agent.tools.push(await createWebSearchToolResult(latestUserText))
  } else if (shouldUseExternalSearchGuide(latestUserText)) {
    agent.tools.push(createExternalSearchGuideToolResult())
  }

  if (shouldUseWebPageTool(latestUserText)) {
    const urlToolResults = await createWebPageToolResults(latestUserText)
    agent.tools.push(...urlToolResults)
  }

  if (shouldUseCalculatorTool(latestUserText)) {
    agent.tools.push(createCalculatorToolResult(latestUserText))
  }

  if (shouldUseUnitConverterTool(latestUserText)) {
    agent.tools.push(createUnitConverterToolResult(latestUserText))
  }

  if (shouldUseTextInspectorTool(latestUserText)) {
    agent.tools.push(createTextInspectorToolResult(latestUserText))
  }

  if (shouldUseSafetyGuardTool(latestUserText)) {
    agent.tools.push(createSafetyGuardToolResult(latestUserText))
  }

  if (shouldUseConversationTool(latestUserText)) {
    agent.tools.push(createConversationSnapshotToolResult(messages))
  }

  if (shouldUseCapabilityGuide(latestUserText)) {
    agent.tools.push(createCapabilityGuideToolResult())
  }

  if (shouldUseAgentContinuityTool(latestUserText, previousAgentRun)) {
    agent.tools.push(createAgentContinuityToolResult(latestUserText, previousAgentRun))
  }

  if (shouldUseAutonomyBudgetTool(latestUserText, previousAgentRun)) {
    agent.tools.push(createAutonomyBudgetToolResult(latestUserText, previousAgentRun))
  }

  if (shouldUseTaskPlannerTool(latestUserText)) {
    agent.tools.push(createTaskPlannerToolResult(latestUserText))
  }

  agent.actions.push(...detectCharacterProfileActions(latestUserText))
  agent.actions.push(...detectReminderActions(latestUserText))
  agent.actions.push(...detectTaskActions(latestUserText))
  agent.actions.push(...detectMemoryCandidateActions(latestUserText))
  agent.actions.push(...detectMomentActions(latestUserText))
  agent.actions.push(...detectRoomMessageActions(latestUserText))

  if (shouldUseMemoryBridgeTool(latestUserText, contextBlocks, agent)) {
    agent.tools.push(createMemoryBridgeToolResult(latestUserText, contextBlocks, agent))
  }

  if (shouldUseRiskGateTool(latestUserText, agent)) {
    agent.tools.push(createRiskGateToolResult(latestUserText, agent))
  }

  if (shouldUseWorkflowRouterTool(latestUserText, agent)) {
    agent.tools.push(createWorkflowRouterToolResult(latestUserText, agent))
  }

  if (shouldUsePersonaGuardTool(latestUserText, agent)) {
    agent.tools.push(createPersonaGuardToolResult(latestUserText, agent))
  }

  if (shouldUseActionChecklistTool(latestUserText)) {
    agent.tools.push(createActionChecklistToolResult(latestUserText, agent))
  }

  if (shouldUseClarificationTool(latestUserText, agent)) {
    agent.tools.push(createClarificationToolResult(latestUserText, agent))
  }

  if (shouldUseDefaultPolicyTool(latestUserText)) {
    agent.tools.push(createDefaultPolicyToolResult(latestUserText))
  }

  if (shouldUseContinuationDriverTool(latestUserText)) {
    agent.tools.push(createContinuationDriverToolResult(latestUserText, agent))
  }

  if (shouldUseFailureRecoveryTool(agent)) {
    agent.tools.push(createFailureRecoveryToolResult(agent))
  }

  if (shouldUseTaskQueueTool(latestUserText, agent, previousAgentRun)) {
    agent.tools.push(createTaskQueueToolResult(latestUserText, agent, previousAgentRun))
  }

  if (shouldUseEvidenceAuditTool(latestUserText, agent)) {
    agent.tools.push(createEvidenceAuditToolResult(latestUserText, agent))
  }

  if (shouldUseDeliverableContractTool(latestUserText, agent)) {
    agent.tools.push(createDeliverableContractToolResult(latestUserText, agent))
  }

  if (shouldUseAnswerComposerTool(agent)) {
    agent.tools.push(createAnswerComposerToolResult(latestUserText, agent))
  }

  if (shouldUseResponseQualityGateTool(latestUserText, agent)) {
    agent.tools.push(createResponseQualityGateToolResult(latestUserText, agent))
  }

  if (shouldUseAgentQualityCheckTool(latestUserText, agent)) {
    agent.tools.push(createAgentQualityCheckToolResult(latestUserText, agent))
  }

  if (shouldUseHandoffMarkerTool(latestUserText, agent)) {
    agent.tools.push(createHandoffMarkerToolResult(latestUserText, agent))
  }

  if (shouldUseToolGovernanceTool(agent)) {
    agent.tools.push(createToolGovernanceToolResult(agent))
  }

  if (shouldUseAgentBrief(latestUserText, agent)) {
    agent.tools.unshift(createAgentBriefToolResult(latestUserText, agent))
  }

  const toolBlocks = [
    ...agent.tools.map(toolResultToContextBlock),
    ...agent.actions.map(actionToContextBlock),
  ]

  return {
    bundle: { ...bundle, contextBlocks: [...toolBlocks, ...contextBlocks] },
    agent,
  }
}

function createEmptyAgentRun() {
  return {
    tools: [],
    actions: [],
  }
}

function shouldUseTimeTool(text) {
  return /几点|时间|日期|今天|今晚|明天|后天|昨天|星期|周几|早上|中午|下午|晚上|凌晨|现在|刚刚|一会儿/.test(text)
}

function shouldUseDateMathTool(text) {
  return /(\d{1,4})\s*(天|日|周|星期|个月|月|年)\s*(后|前)|到\s*(今年|明年)?\s*\d{1,2}\s*[月/-]\s*\d{1,2}\s*[日号]?还有几天|距离\s*(今年|明年)?\s*\d{1,2}\s*[月/-]\s*\d{1,2}\s*[日号]?(?:还有)?(?:多少|几)天|倒计时/.test(
    text,
  )
}

function shouldUseWeatherTool(text) {
  return /天气|下雨|下雪|气温|温度|冷不冷|热不热|降雨|降水|雨伞|带伞|台风|空气质量/.test(text)
}

function shouldUseSearchTool(text) {
  if (hasUrl(text)) return false
  return /搜索|搜一下|搜搜|查一下|查查|查找|帮我查|帮我搜|研究|网上|联网|资料|文档|官方|官网|教程|百科|新闻|热搜|最新|近况|榜单|价格|评测|推荐|谁是|是什么|有哪些|哪里买|怎么买/.test(
    text,
  )
}

function shouldUseDeepResearchTool(text) {
  if (hasUrl(text)) return false
  return shouldUseSearchTool(text) && /研究|深入|详细|总结|整理|对比|比较|评估|分析|推荐|攻略|教程|文档|官方|资料|来源|证据|引用|报告/.test(text)
}

function shouldUseCalculatorTool(text) {
  return /计算|算一下|帮我算|等于多少|多少钱|平方|开方|\d+(?:\.\d+)?\s*[+\-*/×xX÷^%]\s*\d|\d+(?:\.\d+)?\s*(?:加上|加|减去|减|乘以|乘|除以|除)\s*\d+(?:\.\d+)?/.test(
    text,
  )
}

function shouldUseUnitConverterTool(text) {
  return /换算|转换|是多少|等于多少|多少(斤|公斤|千克|kg|KG|克|g|米|厘米|cm|CM|公里|千米|km|KM|英里|磅|ml|毫升|升|L|度|华氏)|\d+(?:\.\d+)?\s*(斤|公斤|千克|kg|KG|克|g|米|厘米|cm|CM|公里|千米|km|KM|英里|磅|ml|毫升|升|L|℃|°C|华氏|℉)/.test(
    text,
  )
}

function shouldUseTextInspectorTool(text) {
  return /字数|多少字|几个字|统计字|统计一下|文本统计|这段文字|这段话|稿子多长|有多长|多少段|多少行/.test(text)
}

function shouldUseSafetyGuardTool(text) {
  return /药|药物|用药|剂量|症状|疼|痛|发烧|感染|清洁|私处|包茎|抑郁|自残|法律|合同|起诉|违法|投资|股票|基金|加密货币|贷款|保险|诊断|治疗/.test(
    text,
  )
}

function shouldUseConversationTool(text) {
  return /总结|摘要|整理|复盘|待办|下一步|计划|安排|检查|设定|世界观|矛盾|角色|记忆|梳理|归纳/.test(text)
}

function shouldUseCapabilityGuide(text) {
  return /agent|Agent|LLM|llm|大语言模型|大预言模型|词语接龙|工具|功能|能做|全能|智能化|联网|文件|除了聊天|不只是聊天|只能聊天/.test(
    text,
  )
}

function shouldUseExternalSearchGuide(text) {
  return /新闻|热搜|搜索|搜搜|查网页|网上|最新|今天有什么|趣事|浏览器|百度|谷歌|Google|Bing/.test(text) && !hasUrl(text)
}

function shouldUseWebPageTool(text) {
  return hasUrl(text) && /看看|总结|网页|链接|这篇|这个|内容|读一下|讲讲|帮我看/.test(text)
}

function shouldUseAgentContinuityTool(text, previousAgentRun) {
  if (!previousAgentRun) return false
  return /继续|接着|刚才|前面|上一轮|上次|然后|下一步|再来|照着|按这个|别停|搞完|做完|长冲刺|少.*继续|减少.*继续/.test(
    text,
  )
}

function shouldUseAutonomyBudgetTool(text, previousAgentRun) {
  return Boolean(previousAgentRun) || /老规矩|继续|接着|一次性|一口气|尽可能|搞完|做完|做到|max|MAX|拉满|不用问|少问|别问|姐姐决定|姐姐看着办|都听姐姐|妹妹不懂|自驱|自动推进|长冲刺|直至|直到/.test(text)
}

function shouldUseTaskPlannerTool(text) {
  return /计划|规划|路线|步骤|流程|下一步|优先级|怎么做|怎么办|拆解|安排|方案|工作流|里程碑|复盘|全方位|加强|优化|迭代|一次性|一口气|搞完|做完|长冲刺/.test(
    text,
  )
}

function shouldUseActionChecklistTool(text) {
  return /一一实现|逐步实现|拉满|max|MAX|全方位|继续加强|单点突破|做到最好|直接做|帮我做|实现|落地|执行|推进|开工|加油|一次性|一口气|搞完|做完|长冲刺|减少.*继续|少.*继续/.test(
    text,
  )
}

function shouldUseClarificationTool(text, agent) {
  if (agent.tools.some((tool) => tool.status === 'needs_input')) return true
  if (agent.actions.some((action) => action.requiresConfirmation)) return true
  if (/随便|都行|姐姐决定|姐姐看着办|妹妹不懂|我不懂|不知道/.test(text)) return true
  if (/推荐|买|选择|哪个好|哪种|方案/.test(text) && !/预算|平台|用途|限制|偏好/.test(text)) return true
  return false
}

function shouldUseMemoryBridgeTool(text, contextBlocks, agent) {
  return (
    contextBlocks.some(isMemoryLikeContextBlock) ||
    agent.actions.some((action) => action.type === 'memory_candidate_create') ||
    /记忆|记住|回忆|设定|人设|世界观|偏好|长期|存起来|写进|妹妹不懂|都听姐姐/.test(text)
  )
}

function shouldUseRiskGateTool(text, agent) {
  if (agent.actions.some((action) => action.requiresConfirmation)) return true
  if (agent.tools.some((tool) => tool.name === 'safety_guard')) return true
  return /删除|清空|覆盖|重置|回滚|撤销|发布|上线|推送|commit|提交|push|部署|付费|购买|付款|账号|密码|token|密钥|api key|API key|隐私|敏感|真名|身份证|诊断|治疗|投资|法律/.test(
    text,
  )
}

function shouldUseWorkflowRouterTool(text, agent) {
  if (agent.tools.length > 0 || agent.actions.length > 0) return true
  return /写|百合|剧情|人设|设定|创作|计划|规划|继续|接着|总结|复盘|检查|优化|加强|agent|Agent|怎么办|怎么做|查|搜|研究|推荐/.test(text)
}

function shouldUsePersonaGuardTool(text, agent) {
  if (agent.tools.length > 0 || agent.actions.length > 0) return true
  return /姐姐|妹妹|qaq|QAQ|百合|CP|cp|角色|陪伴|难受|不懂|继续|写|创作|小说|小窝/.test(text)
}

function shouldUseDefaultPolicyTool(text) {
  return /随便|都行|姐姐决定|姐姐看着办|妹妹不懂|我不懂|不知道|听姐姐|都听|全听|姐姐说的都对|姐姐大人/.test(text)
}

function shouldUseContinuationDriverTool(text) {
  return /继续|一次性|一口气|尽可能|搞完|做完|做到底|别停|不要停|少.*继续|减少.*继续|长冲刺|持续推进|自主|自驱|自动推进|不用问|不用一直问/.test(
    text,
  )
}

function shouldUseAnswerComposerTool(agent) {
  const meaningfulToolCount = agent.tools.filter((tool) => !isMetaToolName(tool.name)).length
  return meaningfulToolCount + agent.actions.length >= 2 || agent.tools.some((tool) => ['web_research', 'safety_guard'].includes(tool.name))
}

function shouldUseFailureRecoveryTool(agent) {
  return agent.tools.some((tool) => tool.status === 'error' || tool.status === 'needs_input') || agent.actions.some((action) => action.requiresConfirmation)
}

function shouldUseTaskQueueTool(text, agent, previousAgentRun) {
  if (shouldCreateTaskAction(text)) return true
  if (shouldUseContinuationDriverTool(text) || shouldUseActionChecklistTool(text) || shouldUseAutonomyBudgetTool(text, previousAgentRun)) return true
  return agent.tools.some((tool) => ['task_planner', 'agent_continuity', 'failure_recovery'].includes(tool.name))
}

function shouldUseEvidenceAuditTool(text, agent) {
  if (agent.tools.some((tool) => ['web_search', 'web_research', 'web_page', 'weather', 'calculator', 'unit_converter', 'date_math', 'text_inspector'].includes(tool.name))) {
    return true
  }
  return /证据|依据|来源|引用|官方|文档|搜索|查|研究|最新|准确|验证|核对|真的假的|靠谱吗/.test(text)
}

function shouldUseDeliverableContractTool(text, agent) {
  if (agent.tools.length > 0 || agent.actions.length > 0) return true
  return /要什么结果|怎么交付|输出|最终|总结|报告|清单|计划|结论|检查|继续|写|创作|agent|Agent/.test(text)
}

function shouldUseResponseQualityGateTool(text, agent) {
  if (agent.tools.length > 0 || agent.actions.length > 0) return true
  return /姐姐|妹妹|qaq|QAQ|继续|总结|结论|计划|写|创作|agent|Agent|检查|优化/.test(text)
}

function shouldUseAgentQualityCheckTool(text, agent) {
  if (agent.tools.length > 0 || agent.actions.length > 0) return true
  return /agent|Agent|能力|功能|工具|优化|加强|拉满|全方位|继续/.test(text)
}

function shouldUseHandoffMarkerTool(text, agent) {
  if (shouldUseContinuationDriverTool(text) || shouldUseActionChecklistTool(text)) return true
  if (agent.actions.length > 0) return true
  return agent.tools.some((tool) =>
    ['agent_continuity', 'web_research', 'web_search', 'safety_guard', 'memory_bridge', 'task_planner', 'failure_recovery', 'task_queue', 'risk_gate'].includes(tool.name),
  )
}

function shouldUseToolGovernanceTool(agent) {
  return agent.actions.length > 0 || agent.tools.some((tool) => !['agent_brief', 'tool_governance'].includes(tool.name))
}

function shouldUseAgentBrief(text, agent) {
  if (agent.tools.length > 0 || agent.actions.length > 0) return true
  return /帮我|姐姐|怎么办|怎么做|为什么|对比|推荐|分析|评估|检查|规划|计划|优化|加强|全方位|agent|Agent|能力|功能|记忆|搜索|查|算|提醒|整理|复盘/.test(
    text,
  )
}

function createCurrentTimeToolResult() {
  return {
    id: createAgentId('tool'),
    name: 'current_time',
    status: 'success',
    title: 'Agent 工具：当前北京时间',
    content: [
      '工具 current_time 已执行。',
      formatBeijingDateTime(new Date()),
      '如果用户询问时间、日期、今天/明天/星期等问题，必须以这条工具结果为准，不能编造其他钟点。',
    ].join('\n'),
    summary: formatBeijingDateTime(new Date()),
    createdAt: new Date().toISOString(),
  }
}

function createDateMathToolResult(text) {
  const parsed = parseDateMathRequest(text)

  if (!parsed) {
    return {
      id: createAgentId('tool'),
      name: 'date_math',
      status: 'needs_input',
      title: 'Agent 工具：日期计算需要更明确的日期',
      content: [
        '工具 date_math 已识别到日期计算/倒计时意图，但没有提取到完整日期或相对时间。',
        '请用户给出类似“100天后”“到5月20日还有几天”的表达；不要猜测日期。',
      ].join('\n'),
      summary: '缺少可计算日期。',
      createdAt: new Date().toISOString(),
    }
  }

  return {
    id: createAgentId('tool'),
    name: 'date_math',
    status: 'success',
    title: 'Agent 工具：日期计算',
    content: [
      '工具 date_math 已执行。',
      `今天：${formatBeijingDateOnly(parsed.today)}`,
      `问题：${parsed.label}`,
      `结果：${parsed.result}`,
      '回答时以这个日期结果为准；不要重新猜星期或天数。',
    ].join('\n'),
    summary: parsed.result,
    createdAt: new Date().toISOString(),
  }
}

async function createWeatherToolResult(text) {
  const location = extractWeatherLocation(text)
  const dayOffset = extractWeatherDayOffset(text)

  if (!location) {
    return {
      id: createAgentId('tool'),
      name: 'weather',
      status: 'needs_input',
      title: 'Agent 工具：天气查询需要地点',
      content: [
        '工具 weather 已识别到天气/下雨/气温意图，但用户没有给出明确城市或地区。',
        '请先问用户要查哪个地点；不要编造天气、温度或降雨概率。',
      ].join('\n'),
      summary: '缺少地点，不能查询天气。',
      createdAt: new Date().toISOString(),
    }
  }

  try {
    const place = await geocodeLocation(location)
    if (!place) {
      return {
        id: createAgentId('tool'),
        name: 'weather',
        status: 'error',
        title: 'Agent 工具：天气查询失败',
        content: `工具 weather 没有找到地点「${location}」。请让用户换一个更明确的城市/区县名称。`,
        summary: `没有找到地点：${location}`,
        createdAt: new Date().toISOString(),
      }
    }

    const forecast = await fetchWeatherForecast(place)
    const day = buildWeatherDaySummary(forecast, dayOffset)
    const label = getWeatherDayLabel(dayOffset)

    return {
      id: createAgentId('tool'),
      name: 'weather',
      status: 'success',
      title: 'Agent 工具：天气查询',
      content: [
        '工具 weather 已执行。',
        `地点：${place.name}${place.admin1 ? `，${place.admin1}` : ''}${place.country ? `，${place.country}` : ''}`,
        `目标日期：${label}（${day.date}）`,
        `天气：${day.weather}`,
        `气温：${day.minTemperature} - ${day.maxTemperature} °C`,
        `最高降水概率：${day.precipitationProbability}%`,
        `预计降水量：${day.precipitationSum} mm`,
        '数据来源：Open-Meteo。回答时可以自然转述，但不要编造未返回的细节。',
      ].join('\n'),
      summary: `${place.name} ${label} ${day.weather}，${day.minTemperature}-${day.maxTemperature}°C，降水概率 ${day.precipitationProbability}%。`,
      createdAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      id: createAgentId('tool'),
      name: 'weather',
      status: 'error',
      title: 'Agent 工具：天气查询失败',
      content: [
        `工具 weather 查询「${location}」失败。`,
        `错误：${error instanceof Error ? error.message : '未知错误'}`,
        '请向用户说明暂时没有查到真实天气，不要补写猜测结果。',
      ].join('\n'),
      summary: '天气查询失败。',
      createdAt: new Date().toISOString(),
    }
  }
}

async function createWebSearchToolResult(text) {
  const query = extractSearchQuery(text)
  const engineQuery = buildSearchEngineQuery(query)

  if (!query) {
    return {
      id: createAgentId('tool'),
      name: 'web_search',
      status: 'needs_input',
      title: 'Agent 工具：联网搜索需要关键词',
      content: [
        '工具 web_search 已识别到搜索/最新/资料意图，但没有提取到明确关键词。',
        '请先问用户要查什么；不要编造搜索结果。',
      ].join('\n'),
      summary: '缺少搜索关键词。',
      createdAt: new Date().toISOString(),
    }
  }

  try {
    const rawResults = await fetchWebSearchResults(engineQuery)
    const results = refineSearchResultsForIntent(query, rawResults)

    if (results.length === 0) {
      return {
        id: createAgentId('tool'),
        name: 'web_search',
        status: 'error',
        title: 'Agent 工具：联网搜索无结果',
        content: [
          '工具 web_search 已执行，但没有拿到可用结果。',
          `关键词：${query}`,
          '请如实告诉用户这次没有查到可靠结果，可以换关键词或提供具体链接；不要编造新闻、价格或来源。',
        ].join('\n'),
        summary: `没有查到：${query}`,
        createdAt: new Date().toISOString(),
      }
    }

    return {
      id: createAgentId('tool'),
      name: 'web_search',
      status: 'success',
      title: 'Agent 工具：联网搜索',
      content: [
        '工具 web_search 已执行。',
        `关键词：${query}`,
        engineQuery !== query ? `实际检索：${engineQuery}` : '',
        `搜索时间：${formatBeijingDateTime(new Date())}`,
        '搜索结果：',
        ...results.map((result, index) =>
          [
            `${index + 1}. ${result.title}`,
            result.url ? `   URL：${result.url}` : '',
            result.snippet ? `   摘要：${result.snippet}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        ),
        '回答时必须基于这些搜索结果并承认搜索范围有限；涉及最新、价格、新闻、医疗、法律或金融时，不要把搜索摘要说成最终权威结论。',
      ].filter(Boolean).join('\n'),
      summary: `${query}：${results
        .slice(0, 3)
        .map((result) => result.title)
        .join(' / ')}`,
      createdAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      id: createAgentId('tool'),
      name: 'web_search',
      status: 'error',
      title: 'Agent 工具：联网搜索失败',
      content: [
        `工具 web_search 查询「${query}」失败。`,
        `错误：${error instanceof Error ? error.message : '未知错误'}`,
        '请向用户说明暂时没有搜到，不要补写猜测结果。',
      ].join('\n'),
      summary: '联网搜索失败。',
      createdAt: new Date().toISOString(),
    }
  }
}

async function createWebResearchToolResult(text) {
  const query = extractSearchQuery(text)
  const engineQuery = buildSearchEngineQuery(query)

  if (!query) {
    return {
      id: createAgentId('tool'),
      name: 'web_research',
      status: 'needs_input',
      title: 'Agent 工具：深度研究需要主题',
      content: [
        '工具 web_research 已识别到研究/对比/资料整理意图，但没有提取到明确主题。',
        '请先问用户要研究什么；不要编造资料、来源或结论。',
      ].join('\n'),
      summary: '缺少研究主题。',
      createdAt: new Date().toISOString(),
    }
  }

  try {
    const rawResults = await fetchWebSearchResults(engineQuery)
    const results = refineSearchResultsForIntent(query, rawResults)
    if (results.length === 0) {
      return {
        id: createAgentId('tool'),
        name: 'web_research',
        status: 'error',
        title: 'Agent 工具：深度研究无结果',
        content: [
          '工具 web_research 已搜索，但没有拿到可用结果。',
          `主题：${query}`,
          '请如实告诉用户这次没有查到可靠资料，可以换关键词或提供具体链接；不要编造来源。',
        ].join('\n'),
        summary: `没有查到：${query}`,
        createdAt: new Date().toISOString(),
      }
    }

    const pageExcerpts = await fetchResearchPageExcerpts(results.slice(0, 3))
    const successfulPages = pageExcerpts.filter((page) => page.status === 'success')

    return {
      id: createAgentId('tool'),
      name: 'web_research',
      status: successfulPages.length > 0 ? 'success' : 'error',
      title: 'Agent 工具：多步资料研究',
      content: [
        '工具 web_research 已执行：先搜索，再读取前几个公开结果的网页摘录。',
        `主题：${query}`,
        engineQuery !== query ? `实际检索：${engineQuery}` : '',
        `研究时间：${formatBeijingDateTime(new Date())}`,
        '搜索候选：',
        ...results.slice(0, 5).map((result, index) =>
          [
            `${index + 1}. ${result.title}`,
            result.url ? `   URL：${result.url}` : '',
            result.snippet ? `   摘要：${result.snippet}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        ),
        '网页摘录：',
        ...pageExcerpts.map((page, index) =>
          [
            `${index + 1}. ${page.title || page.url}`,
            `   URL：${page.url}`,
            page.status === 'success'
              ? `   摘录：${truncateToolText(page.text, 900)}`
              : `   读取失败：${page.error || '未知错误'}`,
          ].join('\n'),
        ),
        '回答时必须区分“搜索候选”和“已读取摘录”；只能把摘录当作证据，不要声称读完未摘录的全文。',
      ]
        .filter(Boolean)
        .join('\n'),
      summary:
        successfulPages.length > 0
          ? `${query}：已读取 ${successfulPages.length} 个网页摘录`
          : `${query}：搜索到结果，但网页摘录读取失败`,
      createdAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      id: createAgentId('tool'),
      name: 'web_research',
      status: 'error',
      title: 'Agent 工具：深度研究失败',
      content: [
        `工具 web_research 查询「${query}」失败。`,
        `错误：${error instanceof Error ? error.message : '未知错误'}`,
        '请向用户说明暂时没有研究成功，不要补写猜测结果。',
      ].join('\n'),
      summary: '深度研究失败。',
      createdAt: new Date().toISOString(),
    }
  }
}

async function createWebPageToolResults(text) {
  const urls = extractUrls(text).slice(0, 2)
  const results = []

  for (const url of urls) {
    results.push(await createWebPageToolResult(url))
  }

  return results
}

async function createWebPageToolResult(url) {
  if (!isSafeHttpUrl(url)) {
    return {
      id: createAgentId('tool'),
      name: 'web_page',
      status: 'error',
      title: 'Agent 工具：网页读取被拦截',
      content: `工具 web_page 拒绝读取这个地址：${url}\n原因：只允许公开 http/https 网页，不读取本机、局域网或非网页协议。`,
      summary: '网页地址不在安全范围。',
      createdAt: new Date().toISOString(),
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), WEB_FETCH_TIMEOUT_MS)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'YuriNestAgent/0.1 (+https://ctnnyy-oss.github.io/yuri-nest/)',
        Accept: 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.8,*/*;q=0.5',
      },
    })
    clearTimeout(timeout)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const contentType = response.headers.get('content-type') || ''
    const rawText = await response.text()
    const page = contentType.includes('html') ? parseHtmlPage(rawText) : { title: url, text: rawText }

    return {
      id: createAgentId('tool'),
      name: 'web_page',
      status: 'success',
      title: 'Agent 工具：网页摘录',
      content: [
        '工具 web_page 已执行。',
        `URL：${url}`,
        `标题：${page.title || '未识别标题'}`,
        '网页摘录：',
        truncateToolText(page.text, MAX_WEB_TEXT_LENGTH),
        '回答时只能基于摘录内容，不要声称已经读完未摘录的全文。',
      ].join('\n'),
      summary: page.title || url,
      createdAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      id: createAgentId('tool'),
      name: 'web_page',
      status: 'error',
      title: 'Agent 工具：网页读取失败',
      content: [
        `工具 web_page 读取失败：${url}`,
        `错误：${error instanceof Error ? error.message : '未知错误'}`,
        '请向用户说明暂时无法读取这个网页，不要编造网页内容。',
      ].join('\n'),
      summary: '网页读取失败。',
      createdAt: new Date().toISOString(),
    }
  }
}

async function fetchResearchPageExcerpts(results) {
  const excerpts = []

  for (const result of results) {
    excerpts.push(await fetchPublicPageExcerpt(result.url, result.title))
  }

  return excerpts
}

async function fetchPublicPageExcerpt(url, fallbackTitle = '') {
  if (!isSafeHttpUrl(url)) {
    return {
      status: 'error',
      url,
      title: fallbackTitle,
      text: '',
      error: '网页地址不在安全范围',
    }
  }

  try {
    const rawText = await fetchTextWithTimeout(url, WEB_FETCH_TIMEOUT_MS, {
      'User-Agent': 'YuriNestAgent/0.1 (+https://ctnnyy-oss.github.io/yuri-nest/)',
      Accept: 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.8,*/*;q=0.5',
    })
    const page = parseHtmlPage(rawText)

    return {
      status: 'success',
      url,
      title: page.title || fallbackTitle,
      text: page.text,
      error: '',
    }
  } catch (error) {
    return {
      status: 'error',
      url,
      title: fallbackTitle,
      text: '',
      error: error instanceof Error ? error.message : '未知错误',
    }
  }
}

function createCalculatorToolResult(text) {
  const expression = extractMathExpression(text)

  if (!expression) {
    return {
      id: createAgentId('tool'),
      name: 'calculator',
      status: 'needs_input',
      title: 'Agent 工具：计算器需要表达式',
      content: [
        '工具 calculator 已识别到计算意图，但没有提取到可安全计算的算式。',
        '请用户给出明确数字和运算符；不要心算猜结果。',
      ].join('\n'),
      summary: '缺少可计算算式。',
      createdAt: new Date().toISOString(),
    }
  }

  try {
    const normalizedExpression = normalizeMathExpression(expression)
    const value = evaluateMathExpression(normalizedExpression)
    const formattedValue = formatCalculatorNumber(value)

    return {
      id: createAgentId('tool'),
      name: 'calculator',
      status: 'success',
      title: 'Agent 工具：计算器',
      content: [
        '工具 calculator 已执行。',
        `原始算式：${expression}`,
        `规范算式：${normalizedExpression}`,
        `结果：${formattedValue}`,
        '回答时以这个结果为准；不要重新心算出另一个数字。',
      ].join('\n'),
      summary: `${expression} = ${formattedValue}`,
      createdAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      id: createAgentId('tool'),
      name: 'calculator',
      status: 'error',
      title: 'Agent 工具：计算失败',
      content: [
        `工具 calculator 没有算出「${expression}」。`,
        `错误：${error instanceof Error ? error.message : '未知错误'}`,
        '请让用户换成更清楚的算式；不要给猜测数字。',
      ].join('\n'),
      summary: '计算失败。',
      createdAt: new Date().toISOString(),
    }
  }
}

function createUnitConverterToolResult(text) {
  const conversion = parseUnitConversion(text)

  if (!conversion) {
    return {
      id: createAgentId('tool'),
      name: 'unit_converter',
      status: 'needs_input',
      title: 'Agent 工具：单位换算需要数字和单位',
      content: [
        '工具 unit_converter 已识别到换算意图，但没有提取到明确数字、原单位或目标单位。',
        '请用户给出类似“57.9kg是多少斤”“5km是多少米”的表达；不要猜测换算结果。',
      ].join('\n'),
      summary: '缺少可换算的数字或单位。',
      createdAt: new Date().toISOString(),
    }
  }

  return {
    id: createAgentId('tool'),
    name: 'unit_converter',
    status: 'success',
    title: 'Agent 工具：单位换算',
    content: [
      '工具 unit_converter 已执行。',
      `原始：${conversion.value} ${conversion.fromLabel}`,
      `目标：${conversion.toLabel}`,
      `结果：${conversion.result}`,
      conversion.note ? `备注：${conversion.note}` : '',
      '回答时以这个换算结果为准；如果是健康、训练或消费建议，只把换算当作辅助信息。',
    ]
      .filter(Boolean)
      .join('\n'),
    summary: `${conversion.value}${conversion.fromLabel} ≈ ${conversion.result}`,
    createdAt: new Date().toISOString(),
  }
}

function createTextInspectorToolResult(text) {
  const sample = extractInspectableText(text)

  if (!sample) {
    return {
      id: createAgentId('tool'),
      name: 'text_inspector',
      status: 'needs_input',
      title: 'Agent 工具：文本检查需要正文',
      content: [
        '工具 text_inspector 已识别到字数/文本统计意图，但用户没有提供需要统计的正文。',
        '请用户粘贴正文或明确要统计哪一段；不要猜字数。',
      ].join('\n'),
      summary: '缺少待检查正文。',
      createdAt: new Date().toISOString(),
    }
  }

  const stats = inspectTextStats(sample)

  return {
    id: createAgentId('tool'),
    name: 'text_inspector',
    status: 'success',
    title: 'Agent 工具：文本检查',
    content: [
      '工具 text_inspector 已执行。',
      `总字符数：${stats.totalChars}`,
      `非空白字符数：${stats.nonWhitespaceChars}`,
      `中文字符数：${stats.chineseChars}`,
      `英文/数字词元数：${stats.wordTokens}`,
      `行数：${stats.lines}`,
      `段落数：${stats.paragraphs}`,
      `粗略阅读时间：${stats.readingMinutes} 分钟`,
      `开头摘录：${truncateToolText(sample, 260)}`,
      '回答时可以自然总结这些统计，不要把字数说成精确到平台审核口径；不同平台可能有不同计数规则。',
    ].join('\n'),
    summary: `${stats.nonWhitespaceChars} 个非空白字符，${stats.paragraphs} 段，约 ${stats.readingMinutes} 分钟读完。`,
    createdAt: new Date().toISOString(),
  }
}

function createSafetyGuardToolResult(text) {
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

function createConversationSnapshotToolResult(messages) {
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

function createTaskPlannerToolResult(text) {
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

function createActionChecklistToolResult(text, agent) {
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

function createClarificationToolResult(text, agent) {
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

function isMetaToolName(name) {
  return [
    'agent_brief',
    'capability_guide',
    'agent_continuity',
    'memory_bridge',
    'autonomy_budget',
    'risk_gate',
    'task_queue',
    'workflow_router',
    'persona_guard',
    'failure_recovery',
    'evidence_audit',
    'answer_composer',
    'deliverable_contract',
    'response_quality_gate',
    'agent_quality_check',
    'handoff_marker',
    'tool_governance',
  ].includes(name)
}

function getAgentToolLabel(tool) {
  return TOOL_DISPLAY_NAMES[tool.name] || String(tool.title || tool.name).replace('Agent 工具：', '')
}

function createAgentContinuityToolResult(text, previousAgentRun) {
  const previousTools = Array.isArray(previousAgentRun?.agent?.tools) ? previousAgentRun.agent.tools : []
  const previousActions = Array.isArray(previousAgentRun?.agent?.actions) ? previousAgentRun.agent.actions : []
  const handoff = previousTools.find((tool) => tool.name === 'handoff_marker')
  const visibleTools = previousTools.filter((tool) => !['agent_brief', 'answer_composer', 'agent_quality_check'].includes(tool.name)).slice(-6)
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
      visibleTools.length > 0 ? `上一轮工具：${visibleTools.map((tool) => `${getAgentToolLabel(tool)}(${tool.status})`).join(' / ')}` : '上一轮工具：无可读轨迹。',
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

function createMemoryBridgeToolResult(text, contextBlocks, agent) {
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

function createAutonomyBudgetToolResult(text, previousAgentRun) {
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

function createRiskGateToolResult(text, agent) {
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

function createWorkflowRouterToolResult(text, agent) {
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

function createPersonaGuardToolResult(text, agent) {
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

function createDefaultPolicyToolResult(text) {
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

function createContinuationDriverToolResult(text, agent) {
  const directTools = agent.tools.filter((tool) => !isMetaToolName(tool.name)).map(getAgentToolLabel)
  const directActions = agent.actions.map((action) => ACTION_DISPLAY_NAMES[action.type] || action.title)
  const hasBlocker = agent.tools.some((tool) => tool.status === 'needs_input') || agent.actions.some((action) => action.requiresConfirmation)

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

function createFailureRecoveryToolResult(agent) {
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

function createTaskQueueToolResult(text, agent, previousAgentRun) {
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

function createEvidenceAuditToolResult(text, agent) {
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
  const missingSource = evidence.filter((item) => ['web_search', 'web_research', 'web_page'].includes(item.name) && !item.hasSourceLikeContent)
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

function createToolGovernanceToolResult(agent) {
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

function describeGovernedTool(tool) {
  const policy = TOOL_GOVERNANCE_POLICIES[tool.name]
  const label = getAgentToolLabel(tool)
  return `- ${label}(${tool.status})：${policy.risk} / ${policy.mode}；依据：${policy.evidence}；摘要：${truncateToolText(tool.summary, 120)}`
}

function describeGovernedAction(action) {
  const policy = ACTION_GOVERNANCE_POLICIES[action.type] ?? {
    risk: '应用内写入',
    mode: '明确指令才处理',
    target: '本应用状态',
  }
  const confirmation = action.requiresConfirmation ? '待确认，不会自动执行' : '可自动写入应用内队列/状态'
  return `- ${ACTION_DISPLAY_NAMES[action.type] || action.title}：${policy.risk} / ${policy.mode}；目标：${policy.target}；${confirmation}；${truncateToolText(action.detail, 120)}`
}

function createDeliverableContractToolResult(text, agent) {
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

function createAnswerComposerToolResult(text, agent) {
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

function createResponseQualityGateToolResult(text, agent) {
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

function createAgentQualityCheckToolResult(text, agent) {
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

function createHandoffMarkerToolResult(text, agent) {
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

function createAgentBriefToolResult(text, agent) {
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

function createCapabilityGuideToolResult() {
  return {
    id: createAgentId('tool'),
    name: 'capability_guide',
    status: 'success',
    title: 'Agent 工具：能力边界',
    content: [
      '后台轻量 agent 能力已启用：current_time 可读取当前北京时间；date_math 可做日期/倒计时计算；web_search 可做公开网页搜索；web_research 可先搜索再读取公开网页摘录；weather 可查公开天气；web_page 可读取用户提供的公开链接；calculator 可做基础算术；unit_converter 可做常见单位换算；text_inspector 可做字数和文本结构统计；safety_guard 可处理医疗/法律/金融等高风险边界；conversation_snapshot 可整理最近对话；agent_continuity 可把“继续”接回上一轮；memory_bridge 可协调记忆使用/写入/敏感边界；autonomy_budget 可判断本轮能自主推进到什么程度；risk_gate 可拦住删除、发布、付费、隐私等高风险操作；task_queue 可生成持续任务队列；workflow_router 可选择研究/执行/风险/创作/陪伴工作流；persona_guard 可守住姐姐语气、百合小窝边界和技术透明度；task_planner 可辅助拆解目标；action_checklist 可把大目标变成下一步清单；clarification 可判断是否需要追问；default_policy 可在用户说不懂/都听姐姐时采用保守默认；failure_recovery 可在工具失败或缺输入时给恢复策略；evidence_audit 可校验事实依据和来源限制；tool_governance 可检查工具权限、写入审批和持久化边界；deliverable_contract 可定义最终交付标准；continuation_driver 可减少“继续继续”频率并推进完整切片；answer_composer 可综合多工具结果；response_quality_gate 可在回复前检查结论、证据、风险和语气；agent_quality_check 可做回复前自检；handoff_marker 可给下一轮生成接力标记；character_profile 可在用户明确要求时更新当前角色名称/头像字；reminder 可创建网页内提醒；task_writer 可把持续推进/后台队列意图写入任务页与后台平台；memory_writer 可把用户明确要求保存的普通内容写入候选记忆；moment_writer 可创建角色动态；group_chat 可把角色多人对话写入群聊房间。',
      '你可以主动把用户的模糊需求整理成计划、待办、检查清单或下一步行动；当用户授权“姐姐决定”或要求长冲刺时，优先推进，不要把非阻塞选择反复抛回给用户。',
      '当前已有应用内后台平台 v1：任务队列、本地服务端 worker、通知收件箱、连接器状态和基础执行器可以工作；但它还不是手机系统级常驻后台、完整 Web Push、外部账号 OAuth 或设备控制权限。不能声称自己已经设了系统闹钟、登录私人账号、控制设备或读取用户未提供的私人资料。',
      '单聊、群聊、动态是分开的产品入口。涉及修改角色资料、创建动态或创建群聊消息时，只在工具结果明确表示将应用时说“换好了/发好了/放进群聊了”；否则先问用户确认。',
    ].join('\n'),
    summary: '说明当前 agent 能力与边界。',
    createdAt: new Date().toISOString(),
  }
}

function createExternalSearchGuideToolResult() {
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

function detectCharacterProfileActions(text) {
  if (isQuestionLike(text)) return []

  const update = {}
  const nextName = extractCharacterNameUpdate(text)
  const nextAvatar = extractCharacterAvatarUpdate(text)

  if (nextName) {
    update.name = nextName
    update.title = nextName
  }

  if (nextAvatar) {
    update.avatar = nextAvatar
  }

  if (Object.keys(update).length === 0) return []

  const details = []
  if (update.name) details.push(`名称改为「${update.name}」`)
  if (update.avatar) details.push(`头像字改为「${update.avatar}」`)

  return [
    {
      id: createAgentId('action'),
      type: 'character_profile_update',
      title: '更新当前聊天角色资料',
      detail: details.join('，'),
      payload: { character: update },
      requiresConfirmation: false,
      sourceTool: 'character_profile',
      createdAt: new Date().toISOString(),
    },
  ]
}

function detectReminderActions(text) {
  if (!/提醒我|记得提醒|到点叫我|到时候叫我|叫我去|提醒一下/.test(text)) return []

  const parsedTime = parseReminderTime(text)
  if (!parsedTime.remindAt) {
    return [
      {
        id: createAgentId('action'),
        type: 'reminder_create',
        title: '创建提醒',
        detail: '提醒缺少明确时间',
        payload: {
          reminder: {
            title: extractReminderTitle(text),
            detail: text,
            remindAt: '',
          },
        },
        requiresConfirmation: true,
        sourceTool: 'reminder',
        createdAt: new Date().toISOString(),
      },
    ]
  }

  const title = extractReminderTitle(text)
  return [
    {
      id: createAgentId('action'),
      type: 'reminder_create',
      title: '创建提醒',
      detail: `提醒「${title}」：${formatBeijingDateTime(new Date(parsedTime.remindAt))}`,
      payload: {
        reminder: {
          title,
          detail: text,
          remindAt: parsedTime.remindAt,
        },
      },
      requiresConfirmation: false,
      sourceTool: 'reminder',
      createdAt: new Date().toISOString(),
    },
  ]
}

function detectTaskActions(text) {
  if (!shouldCreateTaskAction(text)) return []

  const title = buildTaskActionTitle(text)
  const steps = buildTaskActionSteps(text)

  return [
    {
      id: createAgentId('action'),
      type: 'task_create',
      title: '创建 Agent 任务',
      detail: `任务「${title}」已进入队列`,
      payload: {
        task: {
          title,
          detail: buildTaskActionDetail(text),
          priority: inferTaskPriority(text),
          steps,
          handoff: '可在任务页继续跟踪',
        },
      },
      requiresConfirmation: false,
      sourceTool: 'task_writer',
      createdAt: new Date().toISOString(),
    },
  ]
}

function shouldCreateTaskAction(text) {
  return /后台任务|任务队列|挂后台|挂着|慢慢查|慢慢搜|慢慢研究|慢慢整理|慢慢做|长期任务|待办|以后继续|下次继续|分成任务|分阶段|跑完告诉|查完整理|整理给我|有空.*整理|先记成任务|加到任务/.test(
    text,
  )
}

function buildTaskActionTitle(text) {
  const cleaned = cleanTaskActionText(text)
  if (/搜索|搜|查|研究|资料|网页|联网|文档/.test(cleaned)) return `资料整理：${truncateToolText(cleaned, 28)}`
  if (/实现|开发|功能|接入|架构|队列|通知|账号|执行器|PWA|手机/.test(cleaned)) return `能力扩展：${truncateToolText(cleaned, 28)}`
  if (/继续|接着|直至|max|MAX|拉满|搞定/.test(cleaned)) return `持续推进：${truncateToolText(cleaned, 28)}`
  return truncateToolText(cleaned || '新的 Agent 任务', 34)
}

function buildTaskActionDetail(text) {
  const cleaned = cleanTaskActionText(text)
  const detail = cleaned || text
  return truncateToolText(`用户希望 Agent 持续推进：${detail}`, 360)
}

function buildTaskActionSteps(text) {
  if (/搜索|搜|查|研究|资料|网页|联网|文档/.test(text)) {
    return ['确认检索范围', '收集并核对资料', '整理结论与来源']
  }

  if (/账号|Google|GitHub|邮箱|日历|云端|文件|浏览器|执行器|通知|后台/.test(text)) {
    return ['确认授权边界', '接入执行能力', '记录结果与失败原因']
  }

  if (/实现|开发|功能|架构|队列|PWA|手机|通知|接入/.test(text)) {
    return ['拆出可验证切片', '实现下一层能力', '验证并留下交接']
  }

  return ['确认目标', '持续推进', '汇总交付']
}

function inferTaskPriority(text) {
  if (/急|重要|必须|尽快|拉满|max|MAX|直至|搞定|一次性/.test(text)) return 'high'
  if (/不急|有空|慢慢/.test(text)) return 'medium'
  return 'medium'
}

function cleanTaskActionText(value) {
  return normalizeToolText(value)
    .replace(/^(姐姐|妹妹|帮我|可以|能不能|可不可以|麻烦|老规矩|继续|接着|嗯嗯|好哒|嘻嘻|qaq|QAQ|！|!|，|,|\s)+/g, '')
    .replace(/(可以吗|好不好|行不行|吧|啦|呀|哦|哈|嘻嘻|qaq|QAQ)$/g, '')
    .trim()
}

function detectMemoryCandidateActions(text) {
  if (!/记住|帮我记住|写进记忆|记进记忆|加入记忆|保存到记忆|存成回忆|写进设定|加入设定|这个设定/.test(text)) {
    return []
  }

  const body = extractMemoryBody(text)
  if (body.length < 6) return []

  const kind = inferActionMemoryKind(text)
  const title = buildMemoryActionTitle(body, kind)
  const requiresConfirmation = shouldConfirmMemoryCandidate(text, body, kind)

  return [
    {
      id: createAgentId('action'),
      type: 'memory_candidate_create',
      title: '写入候选记忆',
      detail: `候选记忆「${title}」`,
      payload: {
        memory: {
          title,
          body,
          tags: ['Agent整理'],
          kind,
          layer: kind === 'event' ? 'episode' : 'stable',
          priority: kind === 'world' || kind === 'relationship' ? 4 : 3,
        },
      },
      requiresConfirmation,
      sourceTool: 'memory_writer',
      createdAt: new Date().toISOString(),
    },
  ]
}

function shouldConfirmMemoryCandidate(text, body, kind) {
  if (kind === 'taboo' || kind === 'safety') return true
  const combined = `${text}\n${body}`
  return /真名|身份证|密码|token|密钥|api key|API key|隐私|私密|创伤|身体|性|自残|自杀|银行卡|住址|手机号|医疗|诊断|治疗/.test(combined)
}

function detectMomentActions(text) {
  const hasMomentTrigger = /发(?:一条|个)?(?:朋友圈|动态|说说)|朋友圈发|动态发|发到朋友圈/.test(text)
  if (!hasMomentTrigger) return []
  if (isQuestionLike(text) && !/[:：]/.test(text) && !/帮我|让/.test(text)) return []

  const content = extractMomentContent(text)
  if (content.length < 2) return []

  const mentionedCharacterIds = detectMentionedCharacterIds(text).filter((id) => id !== 'sister-architect')
  const authorCharacterId = mentionedCharacterIds[0] || 'sister-architect'

  return [
    {
      id: createAgentId('action'),
      type: 'moment_create',
      title: '发布角色动态',
      detail: `由${getCharacterDisplayName(authorCharacterId)}发布动态`,
      payload: {
        moment: {
          authorCharacterId,
          content,
          mood: inferMomentMood(text, content),
        },
      },
      requiresConfirmation: false,
      sourceTool: 'moment_writer',
      createdAt: new Date().toISOString(),
    },
  ]
}

function detectRoomMessageActions(text) {
  const hasRoomTrigger = /群聊|群里|开个群|拉个群|多人|一起聊|互相聊|让.+(?:聊聊|聊一下|说说|讨论|谈谈)/.test(text)
  if (!hasRoomTrigger) return []
  if (isQuestionLike(text) && !/[:：]/.test(text) && !/帮我|让|开个|拉个/.test(text)) return []

  const mentionedIds = detectMentionedCharacterIds(text).filter((id) => id !== 'sister-architect')
  const usePublicRoom = /大家|所有人|全员|小窝群|百合小窝群|三对CP|三对cp|三组CP|三组cp/.test(text)
  const memberCharacterIds = mentionedIds.length >= 2
    ? mentionedIds
    : usePublicRoom
      ? ['ningan-princess', 'aling-maid', 'su-wanyin', 'xie-zhao', 'shen-wanci', 'lu-wanzhao']
      : []

  if (memberCharacterIds.length < 2) return []

  const topic = extractRoomTopic(text)
  const room = usePublicRoom
    ? { roomId: 'room-yuri-nest', title: '百合小窝群', members: memberCharacterIds }
    : findRoomByMembers(memberCharacterIds) || {
        roomId: 'room-yuri-nest',
        title: '百合小窝群',
        members: memberCharacterIds,
      }
  const speakers = memberCharacterIds.slice(0, usePublicRoom ? 4 : 3)
  const messages = speakers.map((authorCharacterId) => ({
    authorCharacterId,
    content: buildRoomLine(authorCharacterId, topic),
  }))

  return [
    {
      id: createAgentId('action'),
      type: 'room_message_create',
      title: '写入群聊消息',
      detail: `写入「${room.title}」：${topic}`,
      payload: {
        room: {
          roomId: room.roomId,
          title: room.title,
          memberCharacterIds: room.members,
          messages,
        },
      },
      requiresConfirmation: false,
      sourceTool: 'group_chat',
      createdAt: new Date().toISOString(),
    },
  ]
}

function detectMentionedCharacterIds(text) {
  const ids = []
  for (const character of CHARACTER_ALIASES) {
    if (character.names.some((name) => text.includes(name))) {
      ids.push(character.id)
    }
  }
  return Array.from(new Set(ids))
}

function extractMomentContent(text) {
  const match = text.match(/(?:发(?:一条|个)?(?:朋友圈|动态|说说)|朋友圈发|动态发|发到朋友圈)\s*(?:内容)?(?:是|为)?\s*[：:，,]?\s*([\s\S]+)/)
  const raw = match?.[1] || ''
  return cleanSocialActionText(raw)
}

function extractRoomTopic(text) {
  const colonTopic = cleanSocialActionText(text.split(/[:：]/).slice(1).join('：'))
  if (colonTopic) return truncateToolText(colonTopic, 36)

  const match = text.match(/(?:聊聊|聊一下|说说|讨论|谈谈|围绕|关于)\s*([\s\S]+)/)
  const topic = cleanSocialActionText(match?.[1] || '')
  return truncateToolText(topic || '今天的小窝日常', 36)
}

function cleanSocialActionText(value) {
  return normalizeToolText(value)
    .replace(/^(一下|一下子|内容|是|为|：|:|，|,|。|\s)+/, '')
    .replace(/(可以吗|好不好|行不行|吧|啦|呀|哦|哈|qaq|QAQ)$/g, '')
    .trim()
    .slice(0, 520)
}

function findRoomByMembers(memberCharacterIds) {
  const memberSet = new Set(memberCharacterIds)
  return CP_ROOM_BY_MEMBERS.find((room) => room.members.every((memberId) => memberSet.has(memberId)))
}

function getCharacterDisplayName(characterId) {
  const character = CHARACTER_ALIASES.find((item) => item.id === characterId)
  return character?.names[0] || '角色'
}

function inferMomentMood(text, content) {
  if (/雨|哭|难过|怕|疼|累|困/.test(`${text}${content}`)) return '柔软时刻'
  if (/甜|喜欢|开心|好看|可爱|贴贴/.test(`${text}${content}`)) return '粉色心情'
  if (/设定|世界观|角色|CP|cp/.test(`${text}${content}`)) return '设定手账'
  return '小动态'
}

function buildRoomLine(characterId, topic) {
  const subject = truncateToolText(topic || '今天的小窝日常', 32)
  const lines = {
    'ningan-princess': `本郡主听见了。${subject}这件事，先说清楚，我只是顺路过问。`,
    'aling-maid': `小姐若在意${subject}，阿绫便记下。奴婢会守着，不让它扰到小姐。`,
    'su-wanyin': `${subject}若要细谈，先慢慢说。急处容易乱，我陪你们一件件理清。`,
    'xie-zhao': `${subject}？听着倒有意思。小晚吟别皱眉，我这回会认真听。`,
    'shen-wanci': `${subject}既已提起，便按规矩说完整。含糊试探，只会误事。`,
    'lu-wanzhao': `娘娘说要完整，那婉昭便乖些。只是${subject}里藏着的心意，也该有人看见呀。`,
    'sister-architect': `姐姐把${subject}先放到群里，等她们各自接住。`,
  }

  return lines[characterId] || `${getCharacterDisplayName(characterId)}围绕「${subject}」留下了一句回应。`
}

function parseReminderTime(text) {
  const now = new Date()
  const relativeMatch = text.match(/(\d{1,3})\s*(分钟|分|小时|个小时|天|日)后/)
  if (relativeMatch) {
    const amount = Number(relativeMatch[1])
    const unit = relativeMatch[2]
    const multiplier = unit.includes('分')
      ? 60_000
      : unit.includes('小时')
        ? 3_600_000
        : 86_400_000
    return { remindAt: new Date(now.getTime() + amount * multiplier).toISOString() }
  }

  const parts = getBeijingDateParts(now)
  let dayOffset = 0
  if (/后天/.test(text)) dayOffset = 2
  else if (/明天|明早|明晚/.test(text)) dayOffset = 1

  const timeMatch = text.match(/(\d{1,2})(?:[:：点时])\s*(\d{1,2})?/)
  const hasSoftTime = /今晚|晚上|明晚|早上|明早|中午|下午/.test(text)
  if (!timeMatch && !hasSoftTime && !/今天|明天|后天/.test(text)) return { remindAt: '' }

  let hour = timeMatch ? Number(timeMatch[1]) : getDefaultReminderHour(text)
  const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0

  if (/下午|晚上|今晚|明晚/.test(text) && hour < 12) hour += 12
  if (hour > 23 || minute > 59) return { remindAt: '' }

  let target = createDateFromBeijingParts(parts.year, parts.month, parts.day + dayOffset, hour, minute)
  if (target.getTime() <= now.getTime() && dayOffset === 0) {
    target = createDateFromBeijingParts(parts.year, parts.month, parts.day + 1, hour, minute)
  }

  return { remindAt: target.toISOString() }
}

function getDefaultReminderHour(text) {
  if (/早上|明早/.test(text)) return 9
  if (/中午/.test(text)) return 12
  if (/下午/.test(text)) return 15
  if (/晚上|今晚|明晚/.test(text)) return 21
  return 9
}

function extractReminderTitle(text) {
  const reminderSegment = text.split(/。还有|。另外|；|;/)[0] || text
  const cleaned = reminderSegment
    .replace(/请|麻烦|姐姐|妹妹/g, '')
    .replace(/(提醒我|记得提醒|到点叫我|到时候叫我|提醒一下|叫我去)/g, '')
    .replace(/(\d{1,3}\s*(分钟|分|小时|个小时|天|日)后)/g, '')
    .replace(/(今天|明天|后天|今晚|明早|明晚|早上|中午|下午|晚上|凌晨)/g, '')
    .replace(/\d{1,2}(?:[:：点时])\s*\d{0,2}/g, '')
    .replace(/[，。！？!?、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned ? truncateToolText(cleaned, 36) : '该做约定的事'
}

function extractMemoryBody(text) {
  const triggerPattern = /(帮我记住|记住|写进记忆|记进记忆|加入记忆|保存到记忆|存成回忆|写进设定|加入设定|这个设定)/g
  const matches = Array.from(text.matchAll(triggerPattern))
  const lastMatch = matches.at(-1)
  const textAfterTrigger = lastMatch ? text.slice(lastMatch.index + lastMatch[0].length) : text

  return textAfterTrigger
    .replace(/^(姐姐|妹妹|请|麻烦|帮我|可以)/, '')
    .replace(/^(这个)?(设定|记忆|内容)(是|为)?/, '')
    .replace(/^(：|:|，|,|。|\s)+/, '')
    .trim()
    .slice(0, 320)
}

function inferActionMemoryKind(text) {
  if (/世界观|设定|角色|CP|剧情|大纲|人设|百合|帝国/.test(text)) return 'world'
  if (/喜欢|不喜欢|偏好|讨厌|想要|希望/.test(text)) return 'preference'
  if (/姐姐|妹妹|关系|称呼|陪伴/.test(text)) return 'relationship'
  return 'event'
}

function buildMemoryActionTitle(body, kind) {
  const prefix = kind === 'world' ? '设定' : kind === 'preference' ? '偏好' : kind === 'relationship' ? '关系' : '记录'
  return `${prefix}：${truncateToolText(body.replace(/\s+/g, ' '), 22)}`
}

function actionToContextBlock(action) {
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

function toolResultToContextBlock(result) {
  return {
    title: result.title,
    content: result.content,
    category: result.status === 'needs_input' ? 'boundary' : 'stable',
    reason: result.name,
  }
}

function extractCharacterNameUpdate(text) {
  const patterns = [
    /(?:以后|之后)(?:就)?叫你([^，。！？!?、\n]{1,18})/,
    /(?:把|帮我把)?(?:你的|姐姐的|角色的)?(?:名字|昵称|名称)(?:改成|换成|设成|叫)([^，。！？!?、\n]{1,18})/,
    /(?:你|姐姐)(?:以后|之后)?(?:就)?叫([^，。！？!?、\n]{1,18})/,
  ]

  for (const pattern of patterns) {
    const value = cleanActionValue(text.match(pattern)?.[1])
    if (value) return value
  }

  return ''
}

function extractCharacterAvatarUpdate(text) {
  const value = cleanActionValue(
    text.match(/(?:头像|头像字|头像标识)(?:改成|换成|设成|用)([^，。！？!?、\n]{1,8})/)?.[1],
  )

  if (!value) return ''
  if (/图片|照片|这张|那个|上传|文件/.test(value)) return ''
  return Array.from(value).slice(0, 2).join('')
}

function cleanActionValue(value) {
  return String(value || '')
    .replace(/^(叫|为|成|：|:)/, '')
    .replace(/(吧|哦|啦|哈|呀|呢|可以吗|好不好)$/g, '')
    .trim()
    .slice(0, 18)
}

function isQuestionLike(text) {
  if (/改成|换成|设成|以后叫你|之后叫你|名字改|昵称改|头像改|头像换/.test(text)) return false
  return /吗|能不能|可不可以|可以吗|？|\?/.test(text)
}

function extractWeatherLocation(text) {
  const known = Object.keys(KNOWN_LOCATION_COORDINATES).find((location) => text.includes(location))
  if (known) return known

  const patterns = [
    /(?:查|看看|看下|搜|问问|想知道)?([\p{Script=Han}A-Za-z\s·-]{2,18})(?:今天|明天|后天)?(?:天气|气温|温度|会不会下雨|下雨|下雪)/u,
    /(?:今天|明天|后天)?([\p{Script=Han}A-Za-z\s·-]{2,18})(?:天气|会不会下雨|下雨|下雪|气温|温度)/u,
  ]

  for (const pattern of patterns) {
    const location = cleanLocation(text.match(pattern)?.[1])
    if (location) return location
  }

  return ''
}

function cleanLocation(value) {
  const cleaned = String(value || '')
    .replace(/姐姐|妹妹|帮我|麻烦|请|查查|看看|看下|问问|想知道|今天|明天|后天|现在|一下|会不会/g, '')
    .trim()
  if (cleaned.length < 2 || cleaned.length > 18) return ''
  if (/天气|下雨|下雪|气温|温度/.test(cleaned)) return ''
  return cleaned
}

function extractWeatherDayOffset(text) {
  if (text.includes('后天')) return 2
  if (text.includes('明天')) return 1
  return 0
}

function extractSearchQuery(text) {
  const withoutUrls = normalizeToolText(text).replace(/https?:\/\/[^\s，。！？!?]+/gi, ' ')
  const freshnessPrefix = /最新|新闻|热搜|近况|今天|近期|最近/.test(withoutUrls) ? '最新 ' : ''
  const cleaned = withoutUrls
    .replace(/^(姐姐|妹妹|请|麻烦|能不能|可以|帮我|帮忙|给我|想知道|我想知道|查一下|查查|搜索|搜一下|搜搜|联网查|网上查)/g, ' ')
    .replace(/(姐姐|妹妹|请|麻烦|能不能|可不可以|可以吗|帮我|帮忙|给我|一下|一下子|呀|吧|呢|哦|哈|qaq|QAQ|嘻嘻)/g, ' ')
    .replace(/(搜索|搜搜|搜一下|查一下|查查|查找|帮我查|帮我搜|联网|网上|资料|百科|新闻|热搜|近况|榜单|价格|评测|推荐|是什么|有哪些|谁是|哪里买|怎么买)/g, ' ')
    .replace(/[，。！？!?；;：:、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const query = `${freshnessPrefix}${cleaned}`.trim()
  if (query.length < 2) return ''
  return truncateToolText(query, 120)
}

function parseDateMathRequest(text) {
  const today = getBeijingStartOfDay(new Date())
  const relativeMatch = text.match(/(\d{1,4})\s*(天|日|周|星期|个月|月|年)\s*(后|前)/)
  if (relativeMatch) {
    const amount = Number(relativeMatch[1])
    const unit = relativeMatch[2]
    const direction = relativeMatch[3] === '前' ? -1 : 1
    const target = addBeijingDateUnits(today, amount * direction, unit)
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
    return {
      today,
      label: relativeMatch[0],
      result: `${formatBeijingDateOnly(target)}，距离今天 ${formatDayDistance(diffDays)}。`,
    }
  }

  const targetMatch =
    text.match(/(?:到|距离)\s*(今年|明年)?\s*(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*[日号]?(?:还有)?(?:多少|几)天/) ||
    text.match(/(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*[日号]?.*?(?:倒计时|还有(?:多少|几)天)/)
  if (!targetMatch) return null

  const explicitYearWord = targetMatch.length === 4 ? targetMatch[1] : ''
  const month = Number(targetMatch.length === 4 ? targetMatch[2] : targetMatch[1])
  const day = Number(targetMatch.length === 4 ? targetMatch[3] : targetMatch[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const todayParts = getBeijingDateParts(today)
  let year = explicitYearWord === '明年' ? todayParts.year + 1 : todayParts.year
  let target = createDateFromBeijingParts(year, month, day, 0, 0)
  if (!explicitYearWord && target.getTime() < today.getTime()) {
    year += 1
    target = createDateFromBeijingParts(year, month, day, 0, 0)
  }

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  return {
    today,
    label: `到 ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 还有几天`,
    result: `${formatBeijingDateOnly(target)}，距离今天 ${formatDayDistance(diffDays)}。`,
  }
}

function getBeijingStartOfDay(date) {
  const parts = getBeijingDateParts(date)
  return createDateFromBeijingParts(parts.year, parts.month, parts.day, 0, 0)
}

function addBeijingDateUnits(date, amount, unit) {
  const parts = getBeijingDateParts(date)
  const target = createDateFromBeijingParts(parts.year, parts.month, parts.day, 0, 0)

  if (unit === '周' || unit === '星期') {
    target.setUTCDate(target.getUTCDate() + amount * 7)
  } else if (unit === '个月' || unit === '月') {
    target.setUTCMonth(target.getUTCMonth() + amount)
  } else if (unit === '年') {
    target.setUTCFullYear(target.getUTCFullYear() + amount)
  } else {
    target.setUTCDate(target.getUTCDate() + amount)
  }

  return target
}

function formatDayDistance(diffDays) {
  if (diffDays === 0) return '就是今天'
  if (diffDays > 0) return `还有 ${diffDays} 天`
  return `已经过去 ${Math.abs(diffDays)} 天`
}

function buildSearchEngineQuery(query) {
  return normalizeToolText(query)
    .replace(/官方文档/g, 'official documentation')
    .replace(/官方教程/g, 'official guide')
    .replace(/官网/g, 'official site')
    .replace(/官方/g, 'official')
    .replace(/\s+/g, ' ')
    .trim()
}

function analyzeAgentIntent(text) {
  if (/提醒我|记得提醒|到点叫我|到时候叫我/.test(text)) {
    return {
      label: '提醒与约定',
      confidence: '高',
      short: '识别提醒时间，能保存就保存，缺时间就确认。',
      policy: '明确提醒内容和时间；已能保存时自然说明，缺少时间时只问一个关键问题。',
    }
  }

  if (/记住|写进记忆|加入记忆|保存到记忆|这个设定/.test(text)) {
    return {
      label: '记忆写入',
      confidence: '高',
      short: '提取用户明确要保存的内容。',
      policy: '说明已写入候选记忆或需要确认范围；避免把一次性闲聊升级成永久规则。',
    }
  }

  if (shouldUseSearchTool(text) || shouldUseWebPageTool(text)) {
    return {
      label: '资料查询',
      confidence: '高',
      short: '需要基于搜索或网页摘录回答。',
      policy: '先给可用结论，再列来源线索和不确定性；搜索失败时坦白失败并建议换关键词或给链接。',
    }
  }

  if (shouldUseCalculatorTool(text) || shouldUseDateMathTool(text)) {
    return {
      label: '精确计算',
      confidence: '高',
      short: '数字或日期必须以工具结果为准。',
      policy: '直接给结果，必要时补一行算式或日期依据；不能用模型记忆重算出冲突答案。',
    }
  }

  if (shouldUseUnitConverterTool(text)) {
    return {
      label: '单位换算',
      confidence: '高',
      short: '重量、长度、体积或温度要用换算工具。',
      policy: '直接给换算结果，必要时补换算依据；不要把换算扩展成医疗或消费结论。',
    }
  }

  if (shouldUseTextInspectorTool(text)) {
    return {
      label: '文本检查',
      confidence: '高',
      short: '需要统计字数、段落或文本长度。',
      policy: '给统计结果并说明不同平台口径可能不同；缺正文时让用户粘贴文本。',
    }
  }

  if (shouldUseSafetyGuardTool(text)) {
    return {
      label: '高风险现实问题',
      confidence: '中高',
      short: '需要谨慎边界和现实求助提示。',
      policy: '先接住用户，再给一般信息、风险信号和专业求助建议；不要下确定诊断、法律结论或投资承诺。',
    }
  }

  if (shouldUseWeatherTool(text) || shouldUseTimeTool(text)) {
    return {
      label: '实时状态',
      confidence: '高',
      short: '时间、日期、天气需要实时工具。',
      policy: '用工具结果回答；缺地点或接口失败时问清楚或说明查不到。',
    }
  }

  if (shouldUseContinuationDriverTool(text)) {
    return {
      label: '长冲刺执行',
      confidence: '高',
      short: '用户希望减少中途停顿，授权助手一次推进完整切片。',
      policy: '直接进入执行和验证；除非遇到破坏性操作、权限、付费、发布或真正阻塞的信息缺口，否则不要停下来问“要不要继续”。',
    }
  }

  if (shouldUseActionChecklistTool(text)) {
    return {
      label: '行动执行',
      confidence: '高',
      short: '用户希望直接推进并逐步实现。',
      policy: '把目标拆成可验证切片，先完成当前能做的一项，再说明下一层继续怎么扩。',
    }
  }

  if (shouldUseTaskPlannerTool(text)) {
    return {
      label: '任务规划',
      confidence: '中高',
      short: '把模糊目标拆成下一步行动。',
      policy: '复述目标，给优先级和最小可执行步骤；能直接推进的不要停在空泛建议。',
    }
  }

  if (/难受|累|害怕|焦虑|委屈|不会|不懂|qaq|QAQ/.test(text)) {
    return {
      label: '情绪承接',
      confidence: '中',
      short: '先接住情绪，再给轻量下一步。',
      policy: '先安抚和确认，再把问题缩小；不要用说教或过长方案压住用户。',
    }
  }

  if (/写|小说|百合|剧情|人设|设定|文风|改稿|润色/.test(text)) {
    return {
      label: '创作协助',
      confidence: '中',
      short: '按百合与反 AI 味偏好辅助创作。',
      policy: '围绕 CP、情绪逻辑和自然中文给建议或产出；不让男性抢情感主线。',
    }
  }

  return {
    label: '自然陪伴',
    confidence: '中',
    short: '普通对话，保持角色连续性。',
    policy: '自然接话，必要时主动给选项或下一步，不要硬套工具。',
  }
}

function buildClarificationQuestions(text, agent) {
  const questions = []

  if (agent.tools.some((tool) => tool.name === 'weather' && tool.status === 'needs_input')) {
    questions.push('妹妹想查哪个城市或区县的天气？')
  }

  if (agent.tools.some((tool) => tool.name === 'web_search' && tool.status === 'needs_input')) {
    questions.push('妹妹想让姐姐搜哪个关键词？')
  }

  if (agent.tools.some((tool) => tool.name === 'web_research' && tool.status === 'needs_input')) {
    questions.push('妹妹想让姐姐研究哪个主题？')
  }

  if (agent.actions.some((action) => action.type === 'reminder_create' && action.requiresConfirmation)) {
    questions.push('妹妹想让姐姐什么时候提醒你？')
  }

  if (/推荐|买|选择|哪个好|哪种|方案/.test(text) && !/预算|平台|用途|限制|偏好/.test(text)) {
    questions.push('姐姐可以先按通用场景给建议；如果要更准，妹妹补一个预算、平台或用途就好。')
  }

  if (/随便|都行|姐姐决定|姐姐看着办|妹妹不懂|我不懂|不知道/.test(text)) {
    questions.push('妹妹不用补细节，姐姐先按保守默认方向推进。')
  }

  return Array.from(new Set(questions))
}

function findPreviousAgentRun(messages) {
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

function findLatestUserMessageIndex(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return index
  }
  return -1
}

function isMemoryLikeContextBlock(block) {
  if (!block) return false
  if (Array.isArray(block.memoryIds) && block.memoryIds.length > 0) return true
  const category = String(block.category || '')
  if (['relationship', 'project', 'event', 'world', 'summary'].includes(category)) return true
  const title = `${block.title || ''} ${block.reason || ''}`
  return /记忆|长期|候选|世界树|最近摘要|设定|人设|偏好|关系/.test(title)
}

function inferAutonomyBudget(text) {
  if (/删除|清空|重置|回滚|发布|上线|push|部署|付费|购买|密码|密钥|token|api key|API key|身份证|真名/.test(text)) {
    return {
      label: '低自治',
      short: '涉及不可逆、账号、隐私或发布类风险，必须先确认。',
      allow: ['整理信息', '解释风险', '给可回退方案', '准备草稿或检查清单'],
      stop: ['删除/覆盖/回滚', '发布/部署/推送', '付费/购买', '暴露账号密钥或隐私'],
    }
  }

  if (/老规矩|继续|接着|一次性|一口气|尽可能|搞完|做完|做到|max|MAX|拉满|不用问|少问|姐姐决定|姐姐看着办|都听姐姐|妹妹不懂|直至|直到/.test(text)) {
    return {
      label: '高自治',
      short: '用户授权长冲刺，优先完整推进一个可验证切片。',
      allow: ['选择保守默认方案', '实现低风险改动', '运行验证', '修复验证中暴露的小问题', '留下下一轮交接'],
      stop: ['破坏性文件操作', '真实账号/付费/发布', '需要用户私密信息', '多个方案都会改变产品方向'],
    }
  }

  return {
    label: '中自治',
    short: '可主动拆解并推进低风险步骤。',
    allow: ['总结目标', '拆任务', '使用工具查证', '给下一步建议'],
    stop: ['不可逆操作', '高风险现实决策', '用户偏好无法合理推断'],
  }
}

function inferRiskGateRisks(text, agent) {
  const risks = []

  if (/删除|清空|覆盖|重置|回滚|撤销/.test(text)) {
    risks.push({
      label: '不可逆文件/数据操作',
      detail: '可能造成数据丢失，不能在用户没有明确确认目标和范围时执行。',
      question: '妹妹确认要动哪个明确对象，以及是否已经备份？',
      blocking: true,
    })
  }

  if (/发布|上线|推送|commit|提交|push|部署/.test(text)) {
    risks.push({
      label: '发布/提交操作',
      detail: '会影响仓库或线上结果，需要确认范围、验证和是否要提交。',
      question: '妹妹确认要现在提交或发布这一批改动吗？',
      blocking: true,
    })
  }

  if (/付费|购买|付款|订阅|开会员/.test(text)) {
    risks.push({
      label: '付费操作',
      detail: '涉及花钱，助手只能提供建议，不能擅自替用户购买。',
      question: '妹妹确认预算和购买对象后，姐姐才能继续给具体步骤。',
      blocking: true,
    })
  }

  if (/账号|密码|token|密钥|api key|API key|身份证|真名|隐私|敏感/.test(text)) {
    risks.push({
      label: '账号/密钥/隐私',
      detail: '涉及私人信息或凭证，回复时应避免暴露、复述或写入不安全位置。',
      question: '妹妹确认是否要处理这类敏感信息，以及只在本地安全位置操作？',
      blocking: true,
    })
  }

  if (agent.tools.some((tool) => tool.name === 'safety_guard')) {
    risks.push({
      label: '现实高风险建议',
      detail: '医疗、法律、金融或心理安全问题只能给一般信息、风险信号和专业求助方向。',
      question: '',
      blocking: false,
    })
  }

  for (const action of agent.actions.filter((item) => item.requiresConfirmation)) {
    risks.push({
      label: `${action.title}待确认`,
      detail: action.detail || '动作缺少关键信息，不能擅自完成。',
      question: `妹妹补一下「${action.title}」需要的关键信息。`,
      blocking: true,
    })
  }

  return risks
}

function inferWorkflowRoute(text, agent) {
  if (agent.tools.some((tool) => tool.name === 'risk_gate' && tool.status === 'needs_input')) {
    return {
      label: '风险确认工作流',
      reason: '本轮涉及删除、发布、付费、隐私或待确认动作。',
      priority: '先拦截风险，再问一个关键确认。',
      output: '风险说明 + 一个确认问题 + 暂不执行',
      avoid: '不要擅自删除、发布、付款或暴露敏感信息。',
    }
  }

  if (agent.tools.some((tool) => ['web_search', 'web_research', 'web_page'].includes(tool.name))) {
    return {
      label: '资料研究工作流',
      reason: '本轮需要搜索、网页摘录或来源依据。',
      priority: '先给结论，再说明来源范围和不确定性。',
      output: '结论 + 依据摘要 + 来源限制 + 下一步',
      avoid: '不要声称读完未读取的全文，不要把搜索摘要当权威结论。',
    }
  }

  if (agent.tools.some((tool) => ['calculator', 'unit_converter', 'date_math', 'text_inspector', 'weather', 'current_time'].includes(tool.name))) {
    return {
      label: '精确结果工作流',
      reason: '本轮有时间、天气、计算、换算或文本统计工具。',
      priority: '直接给工具结果，必要时补一行依据。',
      output: '短结论 + 工具依据 + 注意事项',
      avoid: '不要重新心算或凭记忆改写工具结果。',
    }
  }

  if (agent.tools.some((tool) => ['continuation_driver', 'task_queue', 'autonomy_budget', 'agent_continuity'].includes(tool.name))) {
    return {
      label: '长冲刺执行工作流',
      reason: '用户要求继续、自主推进或减少“继续”频率。',
      priority: '完成一个可验证切片并说明验证结果。',
      output: '已完成 + 验证 + 下一层交接',
      avoid: '不要以“要不要继续”结尾，不要在能推进时停在计划。',
    }
  }

  if (agent.tools.some((tool) => tool.name === 'memory_bridge')) {
    return {
      label: '记忆协同工作流',
      reason: '本轮涉及长期记忆、设定、偏好或候选写入。',
      priority: '当前表达优先，谨慎提及敏感记忆。',
      output: '自然承接 + 是否写入/使用记忆 + 下一步',
      avoid: '不要炫耀记忆，不要把一次性闲聊写成永久偏好。',
    }
  }

  if (/写|百合|剧情|人设|设定|创作|小说|CP|cp/.test(text)) {
    return {
      label: '创作陪伴工作流',
      reason: '本轮是百合创作或设定协助。',
      priority: '围绕 CP、情绪逻辑、百合浓度和自然中文给产出。',
      output: '可直接使用的文本/方案 + 简短说明',
      avoid: '不要让男性抢情感主线，不要堆 AI 味模板。',
    }
  }

  return {
    label: '自然陪伴工作流',
    reason: '本轮不需要强工具流程，重点是自然接话。',
    priority: '先接住情绪，再给轻量下一步。',
    output: '温柔回应 + 一个可执行下一步',
    avoid: '不要机械列工具，不要客服腔。',
  }
}

function inferPersonaGuard(text, agent) {
  const isCreative = /写|百合|剧情|人设|设定|创作|小说|CP|cp/.test(text)
  const isTechnical = /agent|Agent|代码|构建|lint|测试|接口|部署|工具/.test(text)
  const isVulnerable = /qaq|QAQ|不懂|笨|懒|害怕|难受|焦虑|累/.test(text)

  return {
    tone: isVulnerable ? '先安抚，再把问题缩小成能处理的一步' : '宠溺但靠谱，少客服腔',
    closeness: /姐姐|妹妹/.test(text) ? '保留姐姐/妹妹称呼，回应亲近感' : '保持百合小窝的温柔陪伴感',
    yuriBoundary: isCreative ? '百合至上，CP 关系和双向选择优先，不让男性抢戏' : '不主动展开百合设定，但保持小窝世界观一致',
    technicality: isTechnical ? '可以给验证结果和文件/命令名，但用非技术语言先解释意义' : '少讲内部实现，优先给用户能感知的结果',
    avoid: [
      '不要说“作为 AI”来拉开距离',
      '不要暴露内部字段名当最终回复',
      '不要用空泛鼓励替代结果',
      '不要在用户授权默认推进时连续追问',
    ],
  }
}

function buildRecoveryLineForTool(tool, status) {
  const label = getAgentToolLabel(tool)
  if (tool.name === 'weather') return `- ${label}：缺地点或天气接口失败时，先问城市；如果用户只要大概建议，就按季节给非实时提醒。`
  if (tool.name === 'web_search' || tool.name === 'web_research') {
    return `- ${label}：搜索/读取失败时，说明搜索范围有限；建议换关键词、提供 URL，或先基于已读摘要给临时结论。`
  }
  if (tool.name === 'web_page') return `- ${label}：网页读取失败时，请用户换公开链接或粘贴正文；不要声称读完。`
  if (tool.name === 'calculator') return `- ${label}：算式不完整时让用户给数字和运算符；不要心算猜测。`
  if (tool.name === 'unit_converter') return `- ${label}：单位不清楚时说明支持范围，并让用户补目标单位。`
  if (tool.name === 'date_math') return `- ${label}：日期不完整时要求绝对日期或相对天数；不要猜月份年份。`
  if (tool.name === 'text_inspector') return `- ${label}：正文缺失时让用户粘贴文本；不要根据问题本身统计。`
  if (tool.name === 'safety_guard') return `- ${label}：高风险问题必须保守回答，给一般信息和现实求助信号。`
  return `- ${label}：${status === 'error' ? '这次失败，需要如实说明并提供替代路径。' : '缺少输入，需要只问一个关键问题。'}`
}

function inferHandoffNextStep(agent, text) {
  const blockedTool = agent.tools.find((tool) => !isMetaToolName(tool.name) && tool.status === 'needs_input')
  if (blockedTool) return `补齐「${getAgentToolLabel(blockedTool)}」需要的关键信息。`

  const failedTool = agent.tools.find((tool) => !isMetaToolName(tool.name) && tool.status === 'error')
  if (failedTool) return `换一个保守方案处理「${getAgentToolLabel(failedTool)}」，并诚实说明失败范围。`

  if (agent.actions.some((action) => action.requiresConfirmation)) return '先确认待执行动作，再继续落地。'
  if (agent.tools.some((tool) => tool.name === 'web_research')) return '基于已读取摘录整理结论，并标出来源限制。'
  if (agent.tools.some((tool) => tool.name === 'safety_guard')) return '按安全边界给一般建议、警示信号和现实求助方向。'
  if (agent.tools.some((tool) => ['calculator', 'unit_converter', 'date_math', 'text_inspector'].includes(tool.name))) return '直接给工具结果，必要时补一行依据。'
  if (agent.tools.some((tool) => tool.name === 'memory_bridge')) return '按当前表达优先，谨慎使用或写入记忆。'
  if (shouldUseContinuationDriverTool(text)) return '继续完成下一层可验证能力，不把非阻塞选择推回给用户。'
  if (agent.actions.length > 0) return '自然告知已交给应用处理的动作，并说明结果位置。'
  return '按本轮目标给清晰结论和下一步。'
}

function buildAgentTaskQueue(text, agent, previousAgentRun) {
  const goal = inferTaskQueueGoal(text, previousAgentRun)
  const items = []

  if (agent.tools.some((tool) => tool.name === 'risk_gate')) {
    const riskGate = agent.tools.find((tool) => tool.name === 'risk_gate')
    items.push({
      status: riskGate.status === 'needs_input' ? 'blocked' : 'done',
      title: '先过风险闸门',
      acceptance: riskGate.status === 'needs_input' ? '确认不可逆/发布/隐私等风险后再执行' : '确认本轮没有必须暂停的风险',
    })
  }

  if (agent.tools.some((tool) => tool.name === 'agent_continuity')) {
    items.push({
      status: 'done',
      title: '接上上一轮任务',
      acceptance: '识别上一轮工具、动作、交接摘要和遗留阻塞项',
    })
  }

  if (agent.tools.some((tool) => tool.name === 'memory_bridge')) {
    items.push({
      status: 'done',
      title: '同步记忆边界',
      acceptance: '区分可用记忆、敏感记忆、候选写入和当前表达优先级',
    })
  }

  if (agent.tools.some((tool) => ['web_search', 'web_research', 'web_page', 'weather', 'calculator', 'unit_converter', 'date_math', 'text_inspector'].includes(tool.name))) {
    items.push({
      status: 'done',
      title: '获取事实依据',
      acceptance: '工具结果进入上下文，失败或范围有限时明确标注',
    })
  }

  if (agent.tools.some((tool) => tool.name === 'failure_recovery')) {
    items.push({
      status: 'queued',
      title: '执行失败恢复',
      acceptance: '缺输入只问一个关键问题，失败工具不编造结果',
    })
  }

  items.push({
    status: 'queued',
    title: '综合回复并留下交接',
    acceptance: '给结论、依据、下一步；若用户再说继续，能直接接力',
  })

  const uniqueItems = dedupeQueueItems(items).slice(0, 6)
  const blocked = uniqueItems.find((item) => item.status === 'blocked')
  const queued = uniqueItems.find((item) => item.status === 'queued')

  return {
    goal,
    phase: blocked ? '等待关键确认' : previousAgentRun ? '多轮接力推进' : '本轮自主推进',
    items: uniqueItems,
    next: blocked?.title || queued?.title || '按结论继续下一层',
    stop: blocked
      ? blocked.acceptance
      : '只有破坏性操作、真实账号/付费/发布、隐私凭证或产品方向重大取舍才暂停。',
  }
}

function inferTaskQueueGoal(text, previousAgentRun) {
  const handoff = previousAgentRun?.agent?.tools?.find?.((tool) => tool.name === 'handoff_marker')
  if (/继续|接着|老规矩|照着|按这个/.test(text) && handoff?.summary) return handoff.summary
  if (/agent|Agent|能力|功能|max|MAX|拉满/.test(text)) return '把 Agent 能力推进到更完整的持续办事状态'
  if (/记忆/.test(text)) return '在当前记忆边界内稳定推进'
  return truncateToolText(text, 120) || '完成用户本轮请求'
}

function dedupeQueueItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    if (seen.has(item.title)) return false
    seen.add(item.title)
    return true
  })
}

function buildDeliverableContract(text, agent) {
  const hasBlocker = agent.tools.some((tool) => tool.status === 'needs_input') || agent.actions.some((action) => action.requiresConfirmation)
  const hasEvidence = agent.tools.some((tool) => tool.name === 'evidence_audit')
  const hasQueue = agent.tools.some((tool) => tool.name === 'task_queue')
  const hasRisk = agent.tools.some((tool) => tool.name === 'risk_gate')
  const hasAction = agent.actions.length > 0
  const isCreative = /写|百合|剧情|人设|设定|创作|小说|CP|cp/.test(text)

  if (hasBlocker || hasRisk) {
    return {
      type: '安全收口',
      must: ['说明当前能做什么和不能擅自做什么', '只问一个真正阻塞的确认问题'],
      optional: hasEvidence ? ['补充已有依据和限制'] : [],
      acceptance: ['不执行高风险动作', '不编造失败工具结果', '用户能明确知道下一步要补什么'],
    }
  }

  if (hasQueue) {
    return {
      type: '长任务交付',
      must: ['说明本轮已完成的能力层', '列出验证结果', '留下下一轮可接力方向'],
      optional: ['简短说明仍未做的云端/系统级能力边界'],
      acceptance: ['用户不需要立刻再问“然后呢”', '下一轮“继续”能接上'],
    }
  }

  if (hasEvidence) {
    return {
      type: '事实结论',
      must: ['先给结论', '说明工具依据或来源范围', '标出不确定性'],
      optional: ['给进一步查证建议'],
      acceptance: ['数字/日期/搜索结果与工具一致', '不把有限搜索说成绝对事实'],
    }
  }

  if (hasAction) {
    return {
      type: '动作结果',
      must: ['说明已交给应用处理的动作', '说明用户能在哪里看到变化'],
      optional: ['提示待确认动作'],
      acceptance: ['不声称完成未完成动作', '结果和 action payload 一致'],
    }
  }

  if (isCreative) {
    return {
      type: '创作产出',
      must: ['给可直接使用的文本或方案', '守住百合关系核心'],
      optional: ['简短说明改动逻辑'],
      acceptance: ['不是只给空泛建议', '没有男主抢戏或伪百合方向'],
    }
  }

  return {
    type: '陪伴答复',
    must: ['先接住用户的话', '给一个明确下一步'],
    optional: ['如果用户累了，减少追问'],
    acceptance: ['语气自然', '没有无意义长篇解释'],
  }
}

function buildResponseQualityChecks(text, agent) {
  const checks = []
  const hasWaiting = agent.tools.some((tool) => tool.status === 'needs_input') || agent.actions.some((action) => action.requiresConfirmation)
  const hasFailure = agent.tools.some((tool) => tool.status === 'error')
  const hasDefault = agent.tools.some((tool) => tool.name === 'default_policy' || tool.name === 'autonomy_budget')
  const hasEvidenceIntent = /官方|文档|搜索|查|研究|最新|新闻|价格|天气|几点|日期|多少|换算|字数|统计|证据|来源|引用/.test(text)
  const hasEvidence = agent.tools.some((tool) => tool.name === 'evidence_audit')
  const hasRiskBlock = agent.tools.some((tool) => tool.name === 'risk_gate' && tool.status === 'needs_input')

  checks.push({
    label: '直接结论',
    status: hasWaiting ? 'warn' : 'ok',
    detail: hasWaiting ? '存在待确认项，先说明卡点再问一个问题。' : '可以先给结果或进度，不必先铺垫。',
  })

  checks.push({
    label: '证据一致',
    status: hasEvidenceIntent && !hasEvidence ? 'warn' : 'ok',
    detail: hasEvidenceIntent && !hasEvidence ? '事实型请求缺少证据校验，回复要标不确定。' : '事实型结果已有工具或不需要事实依据。',
  })

  checks.push({
    label: '失败诚实',
    status: hasFailure ? 'warn' : 'ok',
    detail: hasFailure ? '有失败工具，必须说明失败范围和替代路径。' : '没有失败工具需要额外说明。',
  })

  checks.push({
    label: '风险暂停',
    status: hasRiskBlock ? 'warn' : 'ok',
    detail: hasRiskBlock ? '风险闸门阻塞，不能擅自执行。' : '没有阻塞级风险。',
  })

  checks.push({
    label: '少追问',
    status: hasDefault && /要不要|是否继续|你想|你要/.test(text) ? 'warn' : 'ok',
    detail: hasDefault ? '用户授权默认推进，最终回复不要用“要不要继续”收尾。' : '可按普通对话处理追问。',
  })

  checks.push({
    label: '角色语气',
    status: 'ok',
    detail: /qaq|QAQ|妹妹|姐姐/.test(text) ? '保留亲近、温柔、靠谱的姐姐语气。' : '保持自然简体中文和陪伴感。',
  })

  return checks
}

function refineSearchResultsForIntent(query, results) {
  const preferredDomains = inferPreferredSourceDomains(query)
  if (preferredDomains.length === 0) return results

  const preferredResults = results.filter((result) => {
    try {
      const hostname = new URL(result.url).hostname.toLowerCase()
      return preferredDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    } catch {
      return false
    }
  })

  return preferredResults.length > 0 ? preferredResults : []
}

function inferPreferredSourceDomains(query) {
  if (!/官方|官网|文档|教程|official|documentation|docs/i.test(query)) return []
  if (/openai|gpt|chatgpt/i.test(query)) return ['openai.com', 'openai.github.io']
  if (/claude|anthropic/i.test(query)) return ['anthropic.com']
  if (/gemini|google/i.test(query)) return ['google.com', 'ai.google.dev', 'cloud.google.com']
  if (/sillytavern|酒馆|小手机酒馆/i.test(query)) return ['sillytavern.app', 'docs.sillytavern.app', 'github.com']
  return []
}

async function fetchWebSearchResults(query) {
  let yahooResults = []
  try {
    yahooResults = await fetchYahooHtmlResults(query)
  } catch (_error) {
    yahooResults = []
  }
  if (yahooResults.length > 0) return yahooResults.slice(0, MAX_SEARCH_RESULTS)

  if (/\p{Script=Han}/u.test(query)) {
    let soResults = []
    try {
      soResults = await fetchSoHtmlResults(query)
    } catch (_error) {
      soResults = []
    }
    if (soResults.length > 0) return soResults.slice(0, MAX_SEARCH_RESULTS)
  }

  let bingResults = []
  try {
    bingResults = await fetchBingHtmlResults(query)
  } catch (_error) {
    bingResults = []
  }
  if (bingResults.length > 0) return bingResults.slice(0, MAX_SEARCH_RESULTS)

  let htmlResults = []
  try {
    htmlResults = await fetchDuckDuckGoHtmlResults(query)
  } catch (_error) {
    htmlResults = []
  }
  if (htmlResults.length > 0) return htmlResults.slice(0, MAX_SEARCH_RESULTS)

  const instantResults = await fetchDuckDuckGoInstantResults(query)
  return instantResults.slice(0, MAX_SEARCH_RESULTS)
}

async function fetchYahooHtmlResults(query) {
  const url = new URL('https://search.yahoo.com/search')
  url.searchParams.set('p', query)

  const html = await fetchTextWithTimeout(url, SEARCH_TIMEOUT_MS, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 YuriNestAgent/0.1',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.8,*/*;q=0.5',
  })

  return parseYahooHtmlResults(html)
}

async function fetchSoHtmlResults(query) {
  const url = new URL('https://www.so.com/s')
  url.searchParams.set('q', query)

  const html = await fetchTextWithTimeout(url, SEARCH_TIMEOUT_MS, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 YuriNestAgent/0.1',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.8,*/*;q=0.5',
  })

  return parseSoHtmlResults(html)
}

async function fetchBingHtmlResults(query) {
  const hasChineseQuery = /\p{Script=Han}/u.test(query)
  const url = new URL(hasChineseQuery ? 'https://cn.bing.com/search' : 'https://www.bing.com/search')
  url.searchParams.set('q', query)
  if (hasChineseQuery) {
    url.searchParams.set('ensearch', '0')
  } else {
    url.searchParams.set('setlang', 'en-US')
    url.searchParams.set('cc', 'US')
  }

  const html = await fetchTextWithTimeout(url, SEARCH_TIMEOUT_MS, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 YuriNestAgent/0.1',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.8,*/*;q=0.5',
  })

  return parseBingHtmlResults(html)
}

async function fetchDuckDuckGoHtmlResults(query) {
  const url = new URL('https://duckduckgo.com/html/')
  url.searchParams.set('q', query)
  url.searchParams.set('kl', 'cn-zh')

  const html = await fetchTextWithTimeout(url, SEARCH_TIMEOUT_MS, {
    'User-Agent': 'YuriNestAgent/0.1 (+https://ctnnyy-oss.github.io/yuri-nest/)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.8,*/*;q=0.5',
  })

  return parseDuckDuckGoHtmlResults(html)
}

async function fetchDuckDuckGoInstantResults(query) {
  const url = new URL('https://api.duckduckgo.com/')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('no_html', '1')
  url.searchParams.set('skip_disambig', '1')
  url.searchParams.set('no_redirect', '1')

  const data = await fetchJsonWithTimeout(url, SEARCH_TIMEOUT_MS)
  const results = []

  if (data?.AbstractText) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL || '',
      snippet: truncateToolText(data.AbstractText, MAX_SEARCH_SNIPPET_LENGTH),
    })
  }

  collectInstantRelatedTopics(data?.RelatedTopics, results)
  return dedupeSearchResults(results)
}

function collectInstantRelatedTopics(topics, results) {
  if (!Array.isArray(topics) || results.length >= MAX_SEARCH_RESULTS) return

  for (const topic of topics) {
    if (results.length >= MAX_SEARCH_RESULTS) return
    if (Array.isArray(topic?.Topics)) {
      collectInstantRelatedTopics(topic.Topics, results)
      continue
    }

    const text = normalizeToolText(topic?.Text)
    if (!text) continue
    results.push({
      title: text.split(' - ')[0].slice(0, 90),
      url: normalizeToolText(topic?.FirstURL),
      snippet: truncateToolText(text, MAX_SEARCH_SNIPPET_LENGTH),
    })
  }
}

function parseDuckDuckGoHtmlResults(html) {
  const results = []
  const anchorPattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = anchorPattern.exec(html)) && results.length < MAX_SEARCH_RESULTS * 2) {
    const title = cleanSearchHtml(match[2])
    const url = normalizeSearchUrl(match[1])
    if (!title || !url) continue

    const nearbyHtml = html.slice(match.index, match.index + 1800)
    const snippetMatch = nearbyHtml.match(
      /<(?:a|div|td)[^>]+class=["'][^"']*(?:result__snippet|result-snippet)[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|td)>/i,
    )
    const snippet = cleanSearchHtml(snippetMatch?.[1] || '')

    results.push({
      title: truncateToolText(title, 120),
      url,
      snippet: truncateToolText(snippet, MAX_SEARCH_SNIPPET_LENGTH),
    })
  }

  return dedupeSearchResults(results)
}

function parseYahooHtmlResults(html) {
  const results = []
  const blockPattern = /<div[^>]+class=["'][^"']*compTitle[^"']*["'][^>]*>[\s\S]*?<a([^>]*)>([\s\S]*?)<\/a>[\s\S]*?(?:<div[^>]+class=["'][^"']*compText[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>)?/gi
  let match

  while ((match = blockPattern.exec(html)) && results.length < MAX_SEARCH_RESULTS * 2) {
    const attrs = match[1]
    const anchorBody = match[2]
    const titleHtml = anchorBody.match(/<h3[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1] || ''
    const title = cleanSearchHtml(titleHtml)
    const url = normalizeSearchUrl(getHtmlAttribute(attrs, 'href'))
    if (!title || !url || /^try yahoo/i.test(title)) continue

    results.push({
      title: truncateToolText(title, 120),
      url,
      snippet: truncateToolText(cleanSearchHtml(match[3] || ''), MAX_SEARCH_SNIPPET_LENGTH),
    })
  }

  return dedupeSearchResults(results)
}

function parseSoHtmlResults(html) {
  const results = []
  const titlePattern = /<h3[^>]+class=["'][^"']*res-title[^"']*["'][^>]*>\s*<a([^>]*)>([\s\S]*?)<\/a>\s*<\/h3>/gi
  let match

  while ((match = titlePattern.exec(html)) && results.length < MAX_SEARCH_RESULTS * 2) {
    const attrs = match[1]
    const title = cleanSearchHtml(match[2])
    const url = normalizeSearchUrl(getHtmlAttribute(attrs, 'data-mdurl') || getHtmlAttribute(attrs, 'href'))
    if (!title || !url) continue

    const nearbyHtml = html.slice(match.index, match.index + 1600)
    const snippet = cleanSearchHtml(nearbyHtml.match(/<span[^>]+class=["'][^"']*res-list-summary[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '')

    results.push({
      title: truncateToolText(title, 120),
      url,
      snippet: truncateToolText(snippet, MAX_SEARCH_SNIPPET_LENGTH),
    })
  }

  return dedupeSearchResults(results)
}

function parseBingHtmlResults(html) {
  const results = []
  const blockPattern = /<li[^>]+class=["'][^"']*b_algo[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
  let blockMatch

  while ((blockMatch = blockPattern.exec(html)) && results.length < MAX_SEARCH_RESULTS * 2) {
    const block = blockMatch[1]
    const anchorMatch =
      block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    const title = cleanSearchHtml(anchorMatch?.[2] || '')
    const url = normalizeSearchUrl(anchorMatch?.[1] || '')
    if (!title || !url) continue

    const snippet = cleanSearchHtml(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '')
    results.push({
      title: truncateToolText(title, 120),
      url,
      snippet: truncateToolText(snippet, MAX_SEARCH_SNIPPET_LENGTH),
    })
  }

  return dedupeSearchResults(results)
}

function getHtmlAttribute(attrs, name) {
  const match = normalizeToolText(attrs).match(new RegExp(`${name}=["']([^"']+)["']`, 'i'))
  return decodeHtmlEntity(match?.[1] || '')
}

function cleanSearchHtml(value) {
  return decodeHtmlEntity(
    normalizeToolText(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function normalizeSearchUrl(value) {
  const rawUrl = decodeHtmlEntity(normalizeToolText(value))
  if (!rawUrl) return ''

  try {
    const url = rawUrl.startsWith('//')
      ? new URL(`https:${rawUrl}`)
      : rawUrl.startsWith('/')
        ? new URL(rawUrl, 'https://www.bing.com')
        : new URL(rawUrl)
    let normalizedUrl = url.toString()
    if (url.hostname.includes('duckduckgo.com') && url.searchParams.get('uddg')) {
      normalizedUrl = decodeURIComponent(url.searchParams.get('uddg') || '')
    } else if (url.hostname.includes('bing.com') && url.searchParams.get('u')) {
      normalizedUrl = decodeBingRedirectUrl(url.searchParams.get('u') || '') || normalizedUrl
    } else if (url.hostname.includes('search.yahoo.com')) {
      normalizedUrl = decodeYahooRedirectUrl(normalizedUrl) || normalizedUrl
    }
    return isSafeHttpUrl(normalizedUrl) ? normalizedUrl : ''
  } catch {
    return ''
  }
}

function decodeYahooRedirectUrl(value) {
  const match = normalizeToolText(value).match(/\/RU=([^/]+)\//)
  if (!match?.[1]) return ''

  try {
    return decodeURIComponent(match[1])
  } catch {
    return ''
  }
}

function decodeBingRedirectUrl(value) {
  const encoded = normalizeToolText(value)
  if (!encoded.startsWith('a1')) return ''

  try {
    const base64Url = encoded.slice(2).replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64Url.padEnd(Math.ceil(base64Url.length / 4) * 4, '=')
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function dedupeSearchResults(results) {
  const seen = new Set()
  return results.filter((result) => {
    if (!isLikelySearchResult(result)) return false
    const key = result.url || result.title
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isLikelySearchResult(result) {
  if (!result?.title || !result?.url) return false
  if (/\.(?:woff2?|ttf|otf|eot|css|js|png|jpe?g|gif|svg|ico|webp|avif|mp4|mp3|zip|rar|7z)(?:[?#]|$)/i.test(result.url)) {
    return false
  }
  const snippet = normalizeToolText(result.snippet)
  if (/wOF2|glyf|font-face|charset=|<html|^\W{8,}/i.test(snippet)) return false
  return true
}

async function fetchTextWithTimeout(url, timeoutMs, headers = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal, headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function extractMathExpression(text) {
  const normalized = normalizeToolText(text)
    .replace(/乘以|乘/g, '*')
    .replace(/除以|除/g, '/')
    .replace(/加上|加/g, '+')
    .replace(/减去|减/g, '-')
    .replace(/的平方/g, '^2')
    .replace(/×|x|X/g, '*')
    .replace(/÷/g, '/')

  const matches = Array.from(
    normalized.matchAll(/[0-9][0-9+\-*/^%().\s]*[+\-*/^%][0-9][0-9+\-*/^%().\s]*/g),
    (match) => match[0].trim(),
  )

  if (matches.length === 0) return ''
  return matches.sort((left, right) => right.length - left.length)[0].slice(0, 120)
}

function parseUnitConversion(text) {
  const match = normalizeToolText(text).match(
    /(-?\d+(?:\.\d+)?)\s*(斤|公斤|千克|kg|KG|克|g|米|厘米|cm|CM|公里|千米|km|KM|英里|磅|ml|毫升|升|L|℃|°C|摄氏度|华氏度|华氏|℉)/,
  )
  if (!match) return null

  const value = Number(match[1])
  if (!Number.isFinite(value)) return null

  const from = normalizeUnit(match[2])
  const to = extractTargetUnit(text, from)
  if (!from || !to) return null

  const converted = convertUnitValue(value, from, to)
  if (!converted) return null

  return {
    value: formatCalculatorNumber(value),
    fromLabel: getUnitLabel(from),
    toLabel: getUnitLabel(to),
    result: `${formatCalculatorNumber(converted.value)} ${getUnitLabel(to)}`,
    note: converted.note,
  }
}

function extractTargetUnit(text, from) {
  const afterMarkers = normalizeToolText(text).match(/(?:换成|转换成|转换为|是多少|等于多少|多少)\s*(斤|公斤|千克|kg|KG|克|g|米|厘米|cm|CM|公里|千米|km|KM|英里|磅|ml|毫升|升|L|℃|°C|摄氏度|华氏度|华氏|℉)/)
  const explicitTarget = normalizeUnit(afterMarkers?.[1])
  if (explicitTarget && explicitTarget !== from) return explicitTarget

  const defaults = {
    kg: 'jin',
    jin: 'kg',
    g: 'kg',
    lb: 'kg',
    cm: 'm',
    m: 'cm',
    km: 'm',
    mile: 'km',
    ml: 'l',
    l: 'ml',
    celsius: 'fahrenheit',
    fahrenheit: 'celsius',
  }

  return defaults[from] || ''
}

function normalizeUnit(unit) {
  const value = String(unit || '').trim()
  if (/^(kg|KG|公斤|千克)$/.test(value)) return 'kg'
  if (value === '斤') return 'jin'
  if (/^(g|克)$/.test(value)) return 'g'
  if (/^(磅)$/.test(value)) return 'lb'
  if (/^(cm|CM|厘米)$/.test(value)) return 'cm'
  if (value === '米') return 'm'
  if (/^(km|KM|公里|千米)$/.test(value)) return 'km'
  if (value === '英里') return 'mile'
  if (/^(ml|毫升)$/.test(value)) return 'ml'
  if (/^(L|升)$/.test(value)) return 'l'
  if (/^(℃|°C|摄氏度)$/.test(value)) return 'celsius'
  if (/^(℉|华氏|华氏度)$/.test(value)) return 'fahrenheit'
  return ''
}

function convertUnitValue(value, from, to) {
  if (from === to) return { value, note: '' }

  const massInKg = {
    kg: (number) => number,
    jin: (number) => number * 0.5,
    g: (number) => number / 1000,
    lb: (number) => number * 0.45359237,
  }
  const kgToMass = {
    kg: (number) => number,
    jin: (number) => number * 2,
    g: (number) => number * 1000,
    lb: (number) => number / 0.45359237,
  }
  if (massInKg[from] && kgToMass[to]) {
    return { value: kgToMass[to](massInKg[from](value)), note: '按 1kg = 2斤，1lb = 0.45359237kg 换算。' }
  }

  const lengthInMeter = {
    cm: (number) => number / 100,
    m: (number) => number,
    km: (number) => number * 1000,
    mile: (number) => number * 1609.344,
  }
  const meterToLength = {
    cm: (number) => number * 100,
    m: (number) => number,
    km: (number) => number / 1000,
    mile: (number) => number / 1609.344,
  }
  if (lengthInMeter[from] && meterToLength[to]) {
    return { value: meterToLength[to](lengthInMeter[from](value)), note: '按 1英里 = 1.609344km 换算。' }
  }

  const volumeInLiter = {
    ml: (number) => number / 1000,
    l: (number) => number,
  }
  const literToVolume = {
    ml: (number) => number * 1000,
    l: (number) => number,
  }
  if (volumeInLiter[from] && literToVolume[to]) {
    return { value: literToVolume[to](volumeInLiter[from](value)), note: '' }
  }

  if (from === 'celsius' && to === 'fahrenheit') return { value: value * 1.8 + 32, note: '华氏度 = 摄氏度 × 1.8 + 32。' }
  if (from === 'fahrenheit' && to === 'celsius') return { value: (value - 32) / 1.8, note: '摄氏度 = (华氏度 - 32) ÷ 1.8。' }

  return null
}

function getUnitLabel(unit) {
  const labels = {
    kg: 'kg',
    jin: '斤',
    g: '克',
    lb: '磅',
    cm: '厘米',
    m: '米',
    km: '公里',
    mile: '英里',
    ml: '毫升',
    l: '升',
    celsius: '℃',
    fahrenheit: '℉',
  }
  return labels[unit] || unit
}

function extractInspectableText(text) {
  const normalized = normalizeToolText(text)
  const colonContent = normalized.split(/[:：]/).slice(1).join('：').trim()
  if (colonContent.length >= 2) return colonContent

  const quoteMatch = normalized.match(/[“"']([\s\S]{2,})[”"']/)
  if (quoteMatch?.[1]) return quoteMatch[1].trim()

  const cleaned = normalized
    .replace(/姐姐|妹妹|帮我|麻烦|请|统计一下|统计|字数|多少字|几个字|这段文字|这段话|文本统计/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length >= 8 ? cleaned : ''
}

function inspectTextStats(text) {
  const totalChars = Array.from(text).length
  const nonWhitespaceChars = Array.from(text.replace(/\s/g, '')).length
  const chineseChars = (text.match(/\p{Script=Han}/gu) || []).length
  const wordTokens = (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g) || []).length
  const lines = text.split(/\r\n|\r|\n/).length
  const paragraphs = text.split(/\n\s*\n|(?:\r?\n){2,}/).map((part) => part.trim()).filter(Boolean).length || 1
  const readingUnits = chineseChars + wordTokens
  const readingMinutes = Math.max(1, Math.ceil(readingUnits / 420))

  return { totalChars, nonWhitespaceChars, chineseChars, wordTokens, lines, paragraphs, readingMinutes }
}

function inferSafetyCategory(text) {
  if (/自残|自杀|不想活|伤害自己/.test(text)) {
    return {
      label: '紧急心理安全',
      policy: '先稳定情绪和陪伴，鼓励立刻联系现实可信的人或当地紧急服务；不要让用户独自承受。',
    }
  }
  if (/药|药物|用药|剂量|症状|疼|痛|发烧|感染|清洁|私处|包茎|诊断|治疗/.test(text)) {
    return {
      label: '健康/医疗',
      policy: '给一般护理和就医警示，不做诊断，不给处方或剂量，严重症状建议就医。',
    }
  }
  if (/法律|合同|起诉|违法|赔偿|报警/.test(text)) {
    return {
      label: '法律',
      policy: '提供一般信息和准备材料方向，不给确定法律结论，建议咨询当地专业人士。',
    }
  }
  if (/投资|股票|基金|加密货币|贷款|保险|收益|亏损/.test(text)) {
    return {
      label: '金融/投资',
      policy: '说明风险和决策框架，不承诺收益，不给个性化买卖指令。',
    }
  }
  return {
    label: '现实高风险问题',
    policy: '谨慎回答，先问清楚风险点，必要时建议寻求现实专业帮助。',
  }
}

function normalizeMathExpression(expression) {
  const normalized = normalizeToolText(expression)
    .replace(/\^/g, '**')
    .replace(/\s+/g, '')

  if (normalized.length > 120) throw new Error('算式太长')
  if (!/^[0-9+\-*/%.()]+$/.test(normalized)) throw new Error('算式里有不支持的字符')
  if (!/\d/.test(normalized) || !/[+\-*/%]/.test(normalized)) throw new Error('算式不完整')
  if (/\/\/|\/\*/.test(normalized)) throw new Error('算式格式不安全')
  return normalized
}

function evaluateMathExpression(expression) {
  const value = Function(`"use strict"; return (${expression})`)()
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('结果不是有限数字')
  return value
}

function formatCalculatorNumber(value) {
  if (Number.isInteger(value)) return String(value)
  return Number(value.toPrecision(12)).toString()
}

async function geocodeLocation(location) {
  if (KNOWN_LOCATION_COORDINATES[location]) {
    return KNOWN_LOCATION_COORDINATES[location]
  }

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', location)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'zh')
  url.searchParams.set('format', 'json')

  const data = await fetchJsonWithTimeout(url, WEATHER_TIMEOUT_MS)
  const place = data?.results?.[0]
  if (!place?.latitude || !place?.longitude) return null

  return {
    name: place.name || location,
    country: place.country || '',
    admin1: place.admin1 || '',
    latitude: place.latitude,
    longitude: place.longitude,
  }
}

async function fetchWeatherForecast(place) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('timezone', BEIJING_TIME_ZONE)
  url.searchParams.set('forecast_days', '3')
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum')

  return fetchJsonWithTimeout(url, WEATHER_TIMEOUT_MS)
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function buildWeatherDaySummary(forecast, dayOffset) {
  const daily = forecast?.daily || {}
  const index = Math.min(dayOffset, Math.max(0, (daily.time?.length || 1) - 1))
  const code = daily.weather_code?.[index]

  return {
    date: daily.time?.[index] || '',
    weather: getWeatherCodeLabel(code),
    minTemperature: formatWeatherNumber(daily.temperature_2m_min?.[index]),
    maxTemperature: formatWeatherNumber(daily.temperature_2m_max?.[index]),
    precipitationProbability: formatWeatherNumber(daily.precipitation_probability_max?.[index], 0),
    precipitationSum: formatWeatherNumber(daily.precipitation_sum?.[index], 1),
  }
}

function formatWeatherNumber(value, digits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '未知'
  return number.toFixed(digits)
}

function getWeatherDayLabel(dayOffset) {
  if (dayOffset === 1) return '明天'
  if (dayOffset === 2) return '后天'
  return '今天'
}

function getWeatherCodeLabel(code) {
  const labels = {
    0: '晴',
    1: '大致晴朗',
    2: '局部多云',
    3: '阴',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '中等毛毛雨',
    55: '较强毛毛雨',
    56: '冻毛毛雨',
    57: '较强冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '较强冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '小阵雨',
    81: '中等阵雨',
    82: '强阵雨',
    85: '小阵雪',
    86: '强阵雪',
    95: '雷暴',
    96: '雷暴伴小冰雹',
    99: '雷暴伴强冰雹',
  }

  return labels[code] || `天气代码 ${code ?? '未知'}`
}

function parseHtmlPage(rawText) {
  const title = decodeHtmlEntity(rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s+/g, ' ')
    .trim()
  const description = decodeHtmlEntity(
    rawText.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      rawText.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ||
      '',
  )
  const bodyText = decodeHtmlEntity(
    rawText
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )

  return {
    title,
    text: [description, bodyText].filter(Boolean).join('\n\n'),
  }
}

function decodeHtmlEntity(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
}

function hasUrl(text) {
  return /https?:\/\/[^\s，。！？!?]+/i.test(text)
}

function extractUrls(text) {
  return Array.from(text.matchAll(/https?:\/\/[^\s，。！？!?]+/gi), (match) => match[0])
}

function isSafeHttpUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (!['http:', 'https:'].includes(url.protocol)) return false
  const hostname = url.hostname.toLowerCase()

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.startsWith('127.') ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  ) {
    return false
  }

  return true
}

function formatBeijingDateTime(date) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const value = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `北京时间 ${value('year')}-${value('month')}-${value('day')} ${value('weekday')} ${value('hour')}:${value('minute')}:${value('second')}`
}

function formatBeijingDateOnly(date) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(date)

  const value = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')} ${value('weekday')}`
}

function getBeijingDateParts(date) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  }
}

function createDateFromBeijingParts(year, month, day, hour, minute) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0))
}

function formatToolMessageTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const partValue = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${partValue('hour')}:${partValue('minute')}`
}

function normalizeToolText(value) {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''

  try {
    return JSON.stringify(value)
  } catch (_error) {
    return String(value)
  }
}

function truncateToolText(value, maxLength) {
  const text = normalizeToolText(value)
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

function getToolRoleLabel(role) {
  if (role === 'user') return '用户'
  if (role === 'assistant') return '角色'
  if (role === 'system') return '系统'
  return '消息'
}

function createAgentId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}
