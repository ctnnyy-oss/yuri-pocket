// Open-Meteo 天气查询：地理编码、预报拉取、单日摘要

import { BEIJING_TIME_ZONE, KNOWN_LOCATION_COORDINATES, WEATHER_TIMEOUT_MS } from '../constants.mjs'
import { fetchJsonWithTimeout } from './http.mjs'

export function formatWeatherNumber(value, digits = 1) {
  return value == null ? '未知' : Number(value).toFixed(digits)
}

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

const WEATHER_CODE_LABELS = {
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

export function getWeatherCodeLabel(code) {
  return WEATHER_CODE_LABELS[code] || `天气代码 ${code ?? '未知'}`
}
