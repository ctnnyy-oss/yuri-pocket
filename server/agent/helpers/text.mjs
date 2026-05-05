// Agent 通用文本工具：规范化、截断、可检查文本提取和统计

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
  const total = text.length
  const nonWhitespace = text.replace(/\s/g, '').length
  const chinese = (text.match(/[一-龥]/g) || []).length
  const wordTokens = (text.match(/[a-zA-Z0-9_]+/g) || []).length
  const lines = text.split(/\r?\n/).length
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean).length
  const readingMinutes = Math.max(1, Math.round((chinese * 1 + wordTokens * 1.2) / 280))

  return {
    totalChars: total,
    nonWhitespaceChars: nonWhitespace,
    chineseChars: chinese,
    wordTokens,
    lines,
    paragraphs,
    readingMinutes,
  }
}
