import { stripTrailingSlash } from './modelProvider.mjs'

export async function callModelEmbeddings(texts, profile, options = {}) {
  if (profile.kind !== 'openai-compatible') {
    throw new Error('当前 embedding 只支持 OpenAI-compatible 接口。Anthropic / Gemini 需要单独适配，不能混用聊天接口。')
  }

  const input = normalizeEmbeddingInput(texts)
  const model = getEmbeddingModel(profile, options)
  const body = {
    model,
    input,
  }
  const dimensions = normalizeDimensions(options.dimensions)
  if (dimensions) body.dimensions = dimensions

  const response = await fetchWithTimeout(`${stripTrailingSlash(profile.baseUrl)}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${profile.apiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })

  const payload = await readEmbeddingResponse(response, profile, model)
  const embeddings = normalizeEmbeddingVectors(payload?.data)
  if (embeddings.length !== input.length) {
    throw new Error(`${profile.name} 返回的 embedding 数量不匹配。`)
  }

  return {
    ok: true,
    provider: profile.name,
    model,
    dimensions: embeddings[0]?.length ?? 0,
    embeddings,
  }
}

function normalizeEmbeddingInput(texts) {
  const input = Array.isArray(texts) ? texts : []
  const cleaned = input
    .map((text) => String(text ?? '').trim().slice(0, 2_000))
    .filter(Boolean)
    .slice(0, 32)

  if (cleaned.length === 0) throw new Error('embedding 请求需要至少一段文本。')
  return cleaned
}

function getEmbeddingModel(profile, options) {
  const configured = String(options.model || process.env.AI_EMBEDDING_MODEL || '').trim()
  if (configured) return configured
  if (String(profile.model || '').trim()) return profile.model
  throw new Error('embedding 请求需要 embedding 模型名。')
}

function normalizeDimensions(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  const rounded = Math.round(numberValue)
  return rounded >= 16 && rounded <= 4096 ? rounded : null
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 45_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('embedding 供应商响应超时，请稍后重试。')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function readEmbeddingResponse(response, profile, model) {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(formatEmbeddingError(response.status, text, profile, model))
  }

  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`${profile.name} / ${model} 返回的 embedding 结果不是 JSON。`)
  }
}

function normalizeEmbeddingVectors(data) {
  if (!Array.isArray(data)) return []
  return data
    .map((item) => (Array.isArray(item?.embedding) ? item.embedding : null))
    .filter(Boolean)
    .map((vector) => vector.map((value) => Number(value)).filter((value) => Number.isFinite(value)))
    .filter((vector) => vector.length > 0)
}

function formatEmbeddingError(status, detail, profile, model) {
  const providerMessage = extractProviderMessage(detail)
  const providerPrefix = `${profile.name} / ${model}`

  if (status === 401 || status === 403) return `${providerPrefix} 密钥没有通过，embedding 请求被拒绝。`
  if (status === 404) return `${providerPrefix} 没有可用的 /embeddings 接口，或模型名不支持 embedding。`
  if (status === 429 || /quota|credit|balance|额度|余额|欠费/i.test(providerMessage)) {
    return `${providerPrefix} embedding 额度或余额不足。原始提示：${providerMessage}`
  }
  if (status >= 500) return `${providerPrefix} embedding 上游暂时没接住。原始提示：${providerMessage || status}`
  return `${providerPrefix} embedding 请求失败：${providerMessage || status}`
}

function extractProviderMessage(detail) {
  if (!detail) return ''
  try {
    const parsed = JSON.parse(detail)
    return (
      parsed?.error?.message ||
      parsed?.error ||
      parsed?.message ||
      parsed?.detail ||
      detail
    ).toString().slice(0, 500)
  } catch {
    return detail.slice(0, 500)
  }
}
