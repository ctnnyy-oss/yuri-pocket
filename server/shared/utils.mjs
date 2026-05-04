export function clampNumber(value, min, max, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

export function quoteSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

export function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseJson(value, fallback) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function sanitizeShortText(value, maxLength) {
  return Array.from(String(value || '').replace(/[\r\n\t]/g, ' ').trim()).slice(0, maxLength).join('')
}

export function sanitizeBlockText(value, maxLength) {
  return Array.from(String(value || '').replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim()).slice(0, maxLength).join('')
}

export function formatLogTime(value) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
