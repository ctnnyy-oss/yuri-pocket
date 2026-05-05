// 数学表达式提取/计算 + 单位换算

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
  if (!/^[\d+\-*/().%^\s]+$/.test(normalized)) {
    throw new Error('表达式包含不允许的字符。')
  }
  return Function(`'use strict'; return (${normalized})`)()
}

export function formatCalculatorNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

const UNIT_MAP = {
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

const UNIT_LABELS = {
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

const UNIT_GROUPS = {
  weight: ['斤', '公斤', '千克', 'kg', 'KG', '克', 'g', '磅'],
  length: ['米', '厘米', 'cm', 'CM', '公里', '千米', 'km', 'KM', '英里'],
  volume: ['ml', '毫升', '升', 'L'],
  temperature: ['℃', '°C', '华氏', '℉'],
}

const UNIT_CONVERSIONS = {
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

export function normalizeUnit(unit) {
  return UNIT_MAP[unit] || unit
}

export function getUnitLabel(unit) {
  return UNIT_LABELS[unit] || unit
}

export function extractTargetUnit(text, from) {
  const fromCategory = Object.keys(UNIT_GROUPS).find((cat) => UNIT_GROUPS[cat].some((u) => normalizeUnit(u) === from))
  if (!fromCategory) return null

  for (const unit of UNIT_GROUPS[fromCategory]) {
    const normalized = normalizeUnit(unit)
    if (normalized !== from && text.includes(unit)) {
      return normalized
    }
  }

  return null
}

export function convertUnitValue(value, from, to) {
  if (from === to) return value
  const conversion = UNIT_CONVERSIONS[from]?.[to]
  if (conversion == null) return null
  return typeof conversion === 'function' ? conversion(value) : value * conversion
}

export function parseUnitConversion(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(斤|公斤|千克|kg|KG|克|g|米|厘米|cm|CM|公里|千米|km|KM|英里|磅|ml|毫升|升|L|℃|°C|华氏|℉)/)
  if (!match) return null

  const [, rawValue, unit] = match
  const from = normalizeUnit(unit)
  const to = extractTargetUnit(text, from)
  if (!from || !to) return null

  const numericValue = Number(rawValue)
  const converted = convertUnitValue(numericValue, from, to)
  if (converted == null) return null

  return {
    value: numericValue,
    from,
    to,
    fromLabel: getUnitLabel(from),
    toLabel: getUnitLabel(to),
    result: `${formatCalculatorNumber(converted)} ${getUnitLabel(to)}`,
    note: from === 'C' || from === 'F' ? '温度换算只适用于一般气温场景。' : '',
  }
}
