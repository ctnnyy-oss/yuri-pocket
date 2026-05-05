// 实时数据类工具：当前时间、日期计算、天气查询

import {
  createAgentId,
  formatBeijingDateTime,
  formatBeijingDateOnly,
  getWeatherDayLabel,
} from '../utils.mjs'
import { geocodeLocation, fetchWeatherForecast, buildWeatherDaySummary } from '../helpers/weather.mjs'
import {
  parseDateMathRequest,
  extractWeatherLocation,
  extractWeatherDayOffset,
} from '../actionDetectors.mjs'

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
