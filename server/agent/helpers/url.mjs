// URL 安全检查、规范化和搜索引擎重定向解码

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
