// HTML 解析、实体解码和搜索片段清理

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

export function getHtmlAttribute(attrs, name) {
  return attrs.find((attr) => attr.name === name)?.value || ''
}

export function cleanSearchHtml(value) {
  return decodeHtmlEntity(String(value || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
