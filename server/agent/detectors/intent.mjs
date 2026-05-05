// Agent 用户意图判断：意图分类、追问策略、自治预算、人格守护

import {
  shouldUseTimeTool,
  shouldUseDateMathTool,
  shouldUseWeatherTool,
  shouldUseSearchTool,
  shouldUseWebPageTool,
  shouldUseCalculatorTool,
  shouldUseUnitConverterTool,
  shouldUseTextInspectorTool,
  shouldUseSafetyGuardTool,
  shouldUseContinuationDriverTool,
  shouldUseActionChecklistTool,
  shouldUseTaskPlannerTool,
} from '../toolDetectors.mjs'

export function analyzeAgentIntent(text) {
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

export function buildClarificationQuestions(text, agent) {
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

export function inferAutonomyBudget(text) {
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

export function inferPersonaGuard(text, _agent) {
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
