// Agent 工具的通用工具函数

import {
  BEIJING_TIME_ZONE,
  WEATHER_TIMEOUT_MS,
  KNOWN_LOCATION_COORDINATES,
  TOOL_DISPLAY_NAMES,
} from './constants.mjs'

// ============ 日期时间工具 ============

export function formatBeijingDateTime(date) {
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

export function formatBeijingDateOnly(date) {
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

export function getBeijingDateParts(date) {
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

export function createDateFromBeijingParts(year, month, day, hour, minute) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0))
}

export function formatToolMessageTime(value) {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return formatBeijingDateTime(date)
  } catch {
    return String(value)
  }
}

export function getWeatherDayLabel(dayOffset) {
  return ['今天', '明天', '后天'][dayOffset] || `${dayOffset} 天后`
}

export function isMetaToolName(name) {
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

export function getAgentToolLabel(tool) {
  return TOOL_DISPLAY_NAMES[tool.name] || String(tool.title || tool.name).replace('Agent 工具：', '')
}

// ============ URL 工具 ============

export function hasUrl(text) {
  return /https?:\/\/[^\s，。！？!?]+/i.test(text)
}

export function extractUrls(text) {
  return Array.from(text.matchAll(/https?:\/\/[^\s，。！？!?]+/gi), (match) => match[0])
}

export function isSafeHttpUrl(value) {
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

export function normalizeSearchUrl(value) {
  if (!value) return ''
  let url = String(value).trim()
  if (url.startsWith('//')) url = `https:${url}`
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const parsed = new URL(url)
    return parsed.href
  } catch {
    return ''
  }
}

export function decodeYahooRedirectUrl(value) {
  try {
    const url = new URL(value)
    if (url.hostname.includes('yahoo.com') && url.pathname.includes('/RU=')) {
      const match = url.pathname.match(/\/RU=([^/]+)/)
      if (match) return decodeURIComponent(match[1])
    }
  } catch {}
  return value
}

export function decodeBingRedirectUrl(value) {
  try {
    const url = new URL(value)
    if (url.hostname.includes('bing.com') && url.searchParams.has('u')) {
      const encoded = url.searchParams.get('u')
      if (encoded) {
        const decoded = Buffer.from(encoded.replace(/_/g, '/').replace(/-/g, '+'), 'base64').toString('utf-8')
        if (decoded.startsWith('http')) return decoded
      }
    }
  } catch {}
  return value
}

// ============ HTML 工具 ============

export function parseHtmlPage(rawText) {
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

export function decodeHtmlEntity(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
}

export function getHtmlAttribute(attrs, name) {
  return attrs.find((attr) => attr.name === name)?.value || ''
}

export function cleanSearchHtml(value) {
  return decodeHtmlEntity(String(value || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ============ 文本工具 ============

export function normalizeToolText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncateToolText(value, maxLength) {
  const text = String(value || '')
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

export function extractInspectableText(text) {
  const codeBlockMatch = text.match(/```[\s\S]*?```|`[^`]+`/)
  if (codeBlockMatch) {
    return codeBlockMatch[0].replace(/^```[\w]*\n?|```$|^`|`$/g, '')
  }
  const quoteMatch = text.match(/["「『《][\s\S]+?["」』》]/)
  if (quoteMatch) {
    return quoteMatch[0].slice(1, -1)
  }
  return text
}

export function inspectTextStats(text) {
  const lines = text.split('\n')
  const chars = text.length
  const charsNoSpace = text.replace(/\s/g, '').length
  const words = text.match(/[一-龥]+|[a-zA-Z]+/g)?.length || 0
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean).length

  return { lines: lines.length, chars, charsNoSpace, words, paragraphs }
}

// ============ 数学工具 ============

export function extractMathExpression(text) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*([+\-*/×xX÷^%])\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(加上|加|减去|减|乘以|乘|除以|除)\s*(\d+(?:\.\d+)?)/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const [, left, op, right] = match
      const opMap = {
        加上: '+',
        加: '+',
        减去: '-',
        减: '-',
        乘以: '*',
        乘: '*',
        除以: '/',
        除: '/',
        '×': '*',
        x: '*',
        X: '*',
        '÷': '/',
      }
      return `${left} ${opMap[op] || op} ${right}`
    }
  }

  return null
}

export function normalizeMathExpression(expression) {
  return expression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[xX]/g, '*')
    .replace(/\s+/g, '')
}

export function evaluateMathExpression(expression) {
  const normalized = normalizeMathExpression(expression)
  return Function(`'use strict'; return (${normalized})`)()
}

export function formatCalculatorNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

// ============ 单位换算工具 ============

export function parseUnitConversion(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(斤|公斤|千克|kg|KG|克|g|米|厘米|cm|CM|公里|千米|km|KM|英里|磅|ml|毫升|升|L|℃|°C|华氏|℉)/)
  if (!match) return null

  const [, value, unit] = match
  const from = normalizeUnit(unit)
  const to = extractTargetUnit(text, from)

  if (!from || !to) return null

  return { value: Number(value), from, to }
}

export function extractTargetUnit(text, from) {
  const unitPatterns = {
    weight: ['斤', '公斤', '千克', 'kg', 'KG', '克', 'g', '磅'],
    length: ['米', '厘米', 'cm', 'CM', '公里', '千米', 'km', 'KM', '英里'],
    volume: ['ml', '毫升', '升', 'L'],
    temperature: ['℃', '°C', '华氏', '℉'],
  }

  const fromCategory = Object.keys(unitPatterns).find((cat) => unitPatterns[cat].some((u) => normalizeUnit(u) === from))
  if (!fromCategory) return null

  for (const unit of unitPatterns[fromCategory]) {
    const normalized = normalizeUnit(unit)
    if (normalized !== from && text.includes(unit)) {
      return normalized
    }
  }

  return null
}

export function normalizeUnit(unit) {
  const map = {
    斤: 'jin',
    公斤: 'kg',
    千克: 'kg',
    kg: 'kg',
    KG: 'kg',
    克: 'g',
    g: 'g',
    磅: 'lb',
    米: 'm',
    厘米: 'cm',
    cm: 'cm',
    CM: 'cm',
    公里: 'km',
    千米: 'km',
    km: 'km',
    KM: 'km',
    英里: 'mi',
    ml: 'ml',
    毫升: 'ml',
    升: 'L',
    L: 'L',
    '℃': 'C',
    '°C': 'C',
    华氏: 'F',
    '℉': 'F',
  }
  return map[unit] || unit
}

export function convertUnitValue(value, from, to) {
  const conversions = {
    jin: { kg: 0.5, g: 500, lb: 1.10231 },
    kg: { jin: 2, g: 1000, lb: 2.20462 },
    g: { jin: 0.002, kg: 0.001, lb: 0.00220462 },
    lb: { jin: 0.907185, kg: 0.453592, g: 453.592 },
    m: { cm: 100, km: 0.001, mi: 0.000621371 },
    cm: { m: 0.01, km: 0.00001, mi: 0.00000621371 },
    km: { m: 1000, cm: 100000, mi: 0.621371 },
    mi: { m: 1609.34, cm: 160934, km: 1.60934 },
    ml: { L: 0.001 },
    L: { ml: 1000 },
    C: { F: (v) => v * 1.8 + 32 },
    F: { C: (v) => (v - 32) / 1.8 },
  }

  if (from === to) return value

  const conversion = conversions[from]?.[to]
  if (!conversion) return null

  return typeof conversion === 'function' ? conversion(value) : value * conversion
}

export function getUnitLabel(unit) {
  const labels = {
    jin: '斤',
    kg: '公斤',
    g: '克',
    lb: '磅',
    m: '米',
    cm: '厘米',
    km: '公里',
    mi: '英里',
    ml: '毫升',
    L: '升',
    C: '℃',
    F: '℉',
  }
  return labels[unit] || unit
}

// ============ 其他工具 ============

export function getToolRoleLabel(role) {
  return { user: '用户', assistant: '助手', system: '系统', tool: '工具' }[role] || role
}

export function createAgentId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function inferSafetyCategory(text) {
  if (/药|药物|用药|剂量|症状|疼|痛|发烧|感染|清洁|私处|包茎|抑郁|自残|诊断|治疗/.test(text)) {
    return 'medical'
  }
  if (/法律|合同|起诉|违法/.test(text)) {
    return 'legal'
  }
  if (/投资|股票|基金|加密货币|贷款|保险/.test(text)) {
    return 'financial'
  }
  return 'general'
}

export function formatWeatherNumber(value, digits = 1) {
  return value == null ? '未知' : Number(value).toFixed(digits)
}

export async function fetchTextWithTimeout(url, timeoutMs, headers = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal, headers })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

export async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

// ============ 搜索辅助 ============

export function dedupeSearchResults(results) {
  const seen = new Set()
  return results.filter((result) => {
    if (!isLikelySearchResult(result)) return false
    const key = result.url || result.title
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function isLikelySearchResult(result) {
  if (!result?.title || !result?.url) return false
  if (/\.(?:woff2?|ttf|otf|eot|css|js|png|jpe?g|gif|svg|ico|webp|avif|mp4|mp3|zip|rar|7z)(?:[?#]|$)/i.test(result.url)) {
    return false
  }
  const snippet = normalizeToolText(result.snippet)
  if (/wOF2|glyf|font-face|charset=|<html|^\W{8,}/i.test(snippet)) return false
  return true
}

// ============ 天气工具 ============

export async function geocodeLocation(location) {
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

export async function fetchWeatherForecast(place) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('timezone', BEIJING_TIME_ZONE)
  url.searchParams.set('forecast_days', '3')
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum')

  return fetchJsonWithTimeout(url, WEATHER_TIMEOUT_MS)
}

export function buildWeatherDaySummary(forecast, dayOffset) {
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

export function getWeatherCodeLabel(code) {
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
