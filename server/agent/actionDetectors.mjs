// 动作检测器：从用户消息中识别需要执行的应用内动作

import {
  ACTION_DISPLAY_NAMES,
  ACTION_GOVERNANCE_POLICIES,
  TOOL_DISPLAY_NAMES,
  TOOL_GOVERNANCE_POLICIES,
  CHARACTER_ALIASES,
  CP_ROOM_BY_MEMBERS,
} from './constants.mjs'
import {
  formatBeijingDateTime,
  formatBeijingDateOnly,
  getBeijingDateParts,
  createDateFromBeijingParts,
  normalizeToolText,
  truncateToolText,
  createAgentId,
  getToolRoleLabel,
  isMetaToolName,
  getAgentToolLabel,
  hasUrl,
} from './utils.mjs'
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
} from './toolDetectors.mjs'

export function detectCharacterProfileActions(text) {
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

export function detectReminderActions(text) {
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

export function detectTaskActions(text) {
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

export function shouldCreateTaskAction(text) {
  return /后台任务|任务队列|挂后台|挂着|慢慢查|慢慢搜|慢慢研究|慢慢整理|慢慢做|长期任务|待办|以后继续|下次继续|分成任务|分阶段|跑完告诉|查完整理|整理给我|有空.*整理|先记成任务|加到任务/.test(
    text,
  )
}

export function buildTaskActionTitle(text) {
  const cleaned = cleanTaskActionText(text)
  if (/搜索|搜|查|研究|资料|网页|联网|文档/.test(cleaned)) return `资料整理：${truncateToolText(cleaned, 28)}`
  if (/实现|开发|功能|接入|架构|队列|通知|账号|执行器|PWA|手机/.test(cleaned)) return `能力扩展：${truncateToolText(cleaned, 28)}`
  if (/继续|接着|直至|max|MAX|拉满|搞定/.test(cleaned)) return `持续推进：${truncateToolText(cleaned, 28)}`
  return truncateToolText(cleaned || '新的 Agent 任务', 34)
}

export function buildTaskActionDetail(text) {
  const cleaned = cleanTaskActionText(text)
  const detail = cleaned || text
  return truncateToolText(`用户希望 Agent 持续推进：${detail}`, 360)
}

export function buildTaskActionSteps(text) {
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

export function inferTaskPriority(text) {
  if (/急|重要|必须|尽快|拉满|max|MAX|直至|搞定|一次性/.test(text)) return 'high'
  if (/不急|有空|慢慢/.test(text)) return 'medium'
  return 'medium'
}

export function cleanTaskActionText(value) {
  return normalizeToolText(value)
    .replace(/^(姐姐|妹妹|帮我|可以|能不能|可不可以|麻烦|老规矩|继续|接着|嗯嗯|好哒|嘻嘻|qaq|QAQ|！|!|，|,|\s)+/g, '')
    .replace(/(可以吗|好不好|行不行|吧|啦|呀|哦|哈|嘻嘻|qaq|QAQ)$/g, '')
    .trim()
}

export function detectMemoryCandidateActions(text) {
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

export function shouldConfirmMemoryCandidate(text, body, kind) {
  if (kind === 'taboo' || kind === 'safety') return true
  const combined = `${text}\n${body}`
  return /真名|身份证|密码|token|密钥|api key|API key|隐私|私密|创伤|身体|性|自残|自杀|银行卡|住址|手机号|医疗|诊断|治疗/.test(combined)
}

export function detectMomentActions(text) {
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

export function detectRoomMessageActions(text) {
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

export function detectMentionedCharacterIds(text) {
  const ids = []
  for (const character of CHARACTER_ALIASES) {
    if (character.names.some((name) => text.includes(name))) {
      ids.push(character.id)
    }
  }
  return Array.from(new Set(ids))
}

export function extractMomentContent(text) {
  const match = text.match(/(?:发(?:一条|个)?(?:朋友圈|动态|说说)|朋友圈发|动态发|发到朋友圈)\s*(?:内容)?(?:是|为)?\s*[：:，,]?\s*([\s\S]+)/)
  const raw = match?.[1] || ''
  return cleanSocialActionText(raw)
}

export function extractRoomTopic(text) {
  const colonTopic = cleanSocialActionText(text.split(/[:：]/).slice(1).join('：'))
  if (colonTopic) return truncateToolText(colonTopic, 36)

  const match = text.match(/(?:聊聊|聊一下|说说|讨论|谈谈|围绕|关于)\s*([\s\S]+)/)
  const topic = cleanSocialActionText(match?.[1] || '')
  return truncateToolText(topic || '今天的小窝日常', 36)
}

export function cleanSocialActionText(value) {
  return normalizeToolText(value)
    .replace(/^(一下|一下子|内容|是|为|：|:|，|,|。|\s)+/, '')
    .replace(/(可以吗|好不好|行不行|吧|啦|呀|哦|哈|qaq|QAQ)$/g, '')
    .trim()
    .slice(0, 520)
}

export function findRoomByMembers(memberCharacterIds) {
  const memberSet = new Set(memberCharacterIds)
  return CP_ROOM_BY_MEMBERS.find((room) => room.members.every((memberId) => memberSet.has(memberId)))
}

export function getCharacterDisplayName(characterId) {
  const character = CHARACTER_ALIASES.find((item) => item.id === characterId)
  return character?.names[0] || '角色'
}

export function inferMomentMood(text, content) {
  if (/雨|哭|难过|怕|疼|累|困/.test(`${text}${content}`)) return '柔软时刻'
  if (/甜|喜欢|开心|好看|可爱|贴贴/.test(`${text}${content}`)) return '粉色心情'
  if (/设定|世界观|角色|CP|cp/.test(`${text}${content}`)) return '设定手账'
  return '小动态'
}

export function buildRoomLine(characterId, topic) {
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

export function parseReminderTime(text) {
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

export function getDefaultReminderHour(text) {
  if (/早上|明早/.test(text)) return 9
  if (/中午/.test(text)) return 12
  if (/下午/.test(text)) return 15
  if (/晚上|今晚|明晚/.test(text)) return 21
  return 9
}

export function extractReminderTitle(text) {
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

export function extractMemoryBody(text) {
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

export function inferActionMemoryKind(text) {
  if (/世界观|设定|角色|CP|剧情|大纲|人设|百合|帝国/.test(text)) return 'world'
  if (/喜欢|不喜欢|偏好|讨厌|想要|希望/.test(text)) return 'preference'
  if (/姐姐|妹妹|关系|称呼|陪伴/.test(text)) return 'relationship'
  return 'event'
}

export function buildMemoryActionTitle(body, kind) {
  const prefix = kind === 'world' ? '设定' : kind === 'preference' ? '偏好' : kind === 'relationship' ? '关系' : '记录'
  return `${prefix}：${truncateToolText(body.replace(/\s+/g, ' '), 22)}`
}

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

export function extractCharacterNameUpdate(text) {
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

export function extractCharacterAvatarUpdate(text) {
  const value = cleanActionValue(
    text.match(/(?:头像|头像字|头像标识)(?:改成|换成|设成|用)([^，。！？!?、\n]{1,8})/)?.[1],
  )

  if (!value) return ''
  if (/图片|照片|这张|那个|上传|文件/.test(value)) return ''
  return Array.from(value).slice(0, 2).join('')
}

export function cleanActionValue(value) {
  return String(value || '')
    .replace(/^(叫|为|成|：|:)/, '')
    .replace(/(吧|哦|啦|哈|呀|呢|可以吗|好不好)$/g, '')
    .trim()
    .slice(0, 18)
}

export function isQuestionLike(text) {
  if (/改成|换成|设成|以后叫你|之后叫你|名字改|昵称改|头像改|头像换/.test(text)) return false
  return /吗|能不能|可不可以|可以吗|？|\?/.test(text)
}

export function extractWeatherLocation(text) {
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

export function cleanLocation(value) {
  const cleaned = String(value || '')
    .replace(/姐姐|妹妹|帮我|麻烦|请|查查|看看|看下|问问|想知道|今天|明天|后天|现在|一下|会不会/g, '')
    .trim()
  if (cleaned.length < 2 || cleaned.length > 18) return ''
  if (/天气|下雨|下雪|气温|温度/.test(cleaned)) return ''
  return cleaned
}

export function extractWeatherDayOffset(text) {
  if (text.includes('后天')) return 2
  if (text.includes('明天')) return 1
  return 0
}

export function extractSearchQuery(text) {
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

export function parseDateMathRequest(text) {
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

export function getBeijingStartOfDay(date) {
  const parts = getBeijingDateParts(date)
  return createDateFromBeijingParts(parts.year, parts.month, parts.day, 0, 0)
}

export function addBeijingDateUnits(date, amount, unit) {
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

export function formatDayDistance(diffDays) {
  if (diffDays === 0) return '就是今天'
  if (diffDays > 0) return `还有 ${diffDays} 天`
  return `已经过去 ${Math.abs(diffDays)} 天`
}

export function buildSearchEngineQuery(query) {
  return normalizeToolText(query)
    .replace(/官方文档/g, 'official documentation')
    .replace(/官方教程/g, 'official guide')
    .replace(/官网/g, 'official site')
    .replace(/官方/g, 'official')
    .replace(/\s+/g, ' ')
    .trim()
}

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

export function isMemoryLikeContextBlock(block) {
  if (!block) return false
  if (Array.isArray(block.memoryIds) && block.memoryIds.length > 0) return true
  const category = String(block.category || '')
  if (['relationship', 'project', 'event', 'world', 'summary'].includes(category)) return true
  const title = `${block.title || ''} ${block.reason || ''}`
  return /记忆|长期|候选|世界树|最近摘要|设定|人设|偏好|关系/.test(title)
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

export function inferRiskGateRisks(text, agent) {
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

export function inferWorkflowRoute(text, agent) {
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

export function inferPersonaGuard(text, agent) {
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

export function buildRecoveryLineForTool(tool, status) {
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

export function inferHandoffNextStep(agent, text) {
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

export function buildAgentTaskQueue(text, agent, previousAgentRun) {
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

export function inferTaskQueueGoal(text, previousAgentRun) {
  const handoff = previousAgentRun?.agent?.tools?.find?.((tool) => tool.name === 'handoff_marker')
  if (/继续|接着|老规矩|照着|按这个/.test(text) && handoff?.summary) return handoff.summary
  if (/agent|Agent|能力|功能|max|MAX|拉满/.test(text)) return '把 Agent 能力推进到更完整的持续办事状态'
  if (/记忆/.test(text)) return '在当前记忆边界内稳定推进'
  return truncateToolText(text, 120) || '完成用户本轮请求'
}

export function dedupeQueueItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    if (seen.has(item.title)) return false
    seen.add(item.title)
    return true
  })
}

export function buildDeliverableContract(text, agent) {
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

export function buildResponseQualityChecks(text, agent) {
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
