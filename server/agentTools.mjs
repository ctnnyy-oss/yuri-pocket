const BEIJING_TIME_ZONE = 'Asia/Shanghai'
const WEATHER_TIMEOUT_MS = 8_000
const WEB_FETCH_TIMEOUT_MS = 8_000
const MAX_WEB_TEXT_LENGTH = 3_200
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
  const agent = createEmptyAgentRun()

  if (!latestUserText) {
    return { bundle: { ...bundle, contextBlocks }, agent }
  }

  if (shouldUseTimeTool(latestUserText)) {
    agent.tools.push(createCurrentTimeToolResult())
  }

  if (shouldUseWeatherTool(latestUserText)) {
    agent.tools.push(await createWeatherToolResult(latestUserText))
  }

  if (shouldUseWebPageTool(latestUserText)) {
    const urlToolResults = await createWebPageToolResults(latestUserText)
    agent.tools.push(...urlToolResults)
  }

  if (shouldUseConversationTool(latestUserText)) {
    agent.tools.push(createConversationSnapshotToolResult(messages))
  }

  if (shouldUseCapabilityGuide(latestUserText)) {
    agent.tools.push(createCapabilityGuideToolResult())
  }

  if (shouldUseExternalSearchGuide(latestUserText)) {
    agent.tools.push(createExternalSearchGuideToolResult())
  }

  agent.actions.push(...detectCharacterProfileActions(latestUserText))
  agent.actions.push(...detectReminderActions(latestUserText))
  agent.actions.push(...detectMemoryCandidateActions(latestUserText))
  agent.actions.push(...detectMomentActions(latestUserText))
  agent.actions.push(...detectRoomMessageActions(latestUserText))

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

function shouldUseWeatherTool(text) {
  return /天气|下雨|下雪|气温|温度|冷不冷|热不热|降雨|降水|雨伞|带伞|台风|空气质量/.test(text)
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

function createCapabilityGuideToolResult() {
  return {
    id: createAgentId('tool'),
    name: 'capability_guide',
    status: 'success',
    title: 'Agent 工具：能力边界',
    content: [
      '后台轻量 agent 能力已启用：current_time 可读取当前北京时间；weather 可查公开天气；web_page 可读取用户提供的公开链接；conversation_snapshot 可整理最近对话；character_profile 可在用户明确要求时更新当前角色名称/头像字；reminder 可创建网页内提醒；memory_writer 可把用户明确要求保存的内容写入候选记忆；moment_writer 可创建角色动态；group_chat 可把角色多人对话写入群聊房间。',
      '你可以主动把用户的模糊需求整理成计划、待办、检查清单或下一步行动。',
      '当前没有长期后台推送、系统级通知、任意网页搜索、设备操作权限。提醒只在网页状态里保存，网页打开时能在聊天里提醒；不能声称自己已经设了系统闹钟、控制了设备或读了用户未提供的网页。',
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
      '当前后端没有接入搜索引擎 API，不能编造实时新闻和搜索结果。',
      '如果用户提供具体公开 URL，可以用 web_page 读取链接摘录；如果没有 URL，请说明需要接入搜索工具或让用户提供来源。',
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

function detectMemoryCandidateActions(text) {
  if (!/记住|帮我记住|写进记忆|记进记忆|加入记忆|保存到记忆|存成回忆|写进设定|加入设定|这个设定/.test(text)) {
    return []
  }

  const body = extractMemoryBody(text)
  if (body.length < 6) return []

  const kind = inferActionMemoryKind(text)
  const title = buildMemoryActionTitle(body, kind)

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
      requiresConfirmation: false,
      sourceTool: 'memory_writer',
      createdAt: new Date().toISOString(),
    },
  ]
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
        '前端收到本次响应后会把它写成候选记忆，方便用户之后在记忆页确认或修改。',
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
