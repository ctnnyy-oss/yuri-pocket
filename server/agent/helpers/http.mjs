// Agent 工具的 HTTP 拉取助手 + 搜索结果去重

import { normalizeToolText } from './text.mjs'

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

export function isLikelySearchResult(result) {
  if (!result?.title || !result?.url) return false
  if (/\.(?:woff2?|ttf|otf|eot|css|js|png|jpe?g|gif|svg|ico|webp|avif|mp4|mp3|zip|rar|7z)(?:[?#]|$)/i.test(result.url)) {
    return false
  }
  const snippet = normalizeToolText(result.snippet)
  if (/wOF2|glyf|font-face|charset=|<html|^\W{8,}/i.test(snippet)) return false
  return true
}

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
