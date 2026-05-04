// 工具执行器：生成各个 Agent 工具的执行结果

import {
  TOOL_DISPLAY_NAMES,
  ACTION_DISPLAY_NAMES,
  TOOL_GOVERNANCE_POLICIES,
  ACTION_GOVERNANCE_POLICIES,
  KNOWN_LOCATION_COORDINATES,
  WEATHER_TIMEOUT_MS,
  SEARCH_TIMEOUT_MS,
  WEB_FETCH_TIMEOUT_MS,
  MAX_SEARCH_RESULTS,
  MAX_SEARCH_SNIPPET_LENGTH,
  MAX_WEB_TEXT_LENGTH,
} from './constants.mjs'
import {
  formatBeijingDateTime,
  formatBeijingDateOnly,
  formatToolMessageTime,
  getBeijingDateParts,
  createDateFromBeijingParts,
  getWeatherDayLabel,
  hasUrl,
  extractUrls,
  isSafeHttpUrl,
  normalizeSearchUrl,
  decodeYahooRedirectUrl,
  decodeBingRedirectUrl,
  parseHtmlPage,
  cleanSearchHtml,
  normalizeToolText,
  truncateToolText,
  extractInspectableText,
  inspectTextStats,
  extractMathExpression,
  normalizeMathExpression,
  evaluateMathExpression,
  formatCalculatorNumber,
  parseUnitConversion,
  getUnitLabel,
  inferSafetyCategory,
  fetchTextWithTimeout,
  fetchJsonWithTimeout,
  formatWeatherNumber,
  createAgentId,
  getToolRoleLabel,
  getHtmlAttribute,
  isMetaToolName,
  getAgentToolLabel,
} from './utils.mjs'
import {
  shouldUseTimeTool,
  shouldUseDateMathTool,
  shouldUseWeatherTool,
  shouldUseSearchTool,
  shouldUseDeepResearchTool,
  shouldUseWebPageTool,
  shouldUseCalculatorTool,
  shouldUseUnitConverterTool,
  shouldUseAutonomyBudgetTool,
  shouldUseContinuationDriverTool,
  shouldUseActionChecklistTool,
  shouldUseTaskPlannerTool,
  shouldUseDefaultPolicyTool,
} from './toolDetectors.mjs'
import {
  fetchWebSearchResults,
  refineSearchResultsForIntent,
} from './searchEngines.mjs'
import {
  analyzeAgentIntent,
  buildAgentTaskQueue,
  buildClarificationQuestions,
  buildDeliverableContract,
  buildRecoveryLineForTool,
  buildResponseQualityChecks,
  buildSearchEngineQuery,
  extractSearchQuery,
  extractWeatherDayOffset,
  extractWeatherLocation,
  inferAutonomyBudget,
  inferHandoffNextStep,
  isMemoryLikeContextBlock,
  inferPersonaGuard,
  inferRiskGateRisks,
  inferWorkflowRoute,
  parseDateMathRequest,
} from './actionDetectors.mjs'

export function createCurrentTimeToolResult() {
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

export function createDateMathToolResult(text) {
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

export async function createWeatherToolResult(text) {
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

export async function createWebSearchToolResult(text) {
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

export async function createWebResearchToolResult(text) {
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

export async function createWebPageToolResults(text) {
  const urls = extractUrls(text).slice(0, 2)
  const results = []

  for (const url of urls) {
    results.push(await createWebPageToolResult(url))
  }

  return results
}

export async function createWebPageToolResult(url) {
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

export async function fetchResearchPageExcerpts(results) {
  const excerpts = []

  for (const result of results) {
    excerpts.push(await fetchPublicPageExcerpt(result.url, result.title))
  }

  return excerpts
}

export async function fetchPublicPageExcerpt(url, fallbackTitle = '') {
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

export function createCalculatorToolResult(text) {
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

export function createUnitConverterToolResult(text) {
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

export function createTextInspectorToolResult(text) {
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

export function createMemoryBridgeToolResult(text, contextBlocks, agent) {
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

export function createCapabilityGuideToolResult() {
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
