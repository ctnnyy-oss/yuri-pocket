// 北京时间和 Agent 工具时间格式化

import { BEIJING_TIME_ZONE } from '../constants.mjs'

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
