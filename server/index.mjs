import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config({ path: '.env.local' })
dotenv.config()

const app = express()
const port = Number(process.env.YURI_POCKET_API_PORT || 8787)
const corsOrigin = process.env.YURI_POCKET_CORS_ORIGIN || true

app.use(cors({ origin: corsOrigin }))
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    provider: hasApiKey() ? 'openai-compatible' : 'local-demo',
    baseUrl: getBaseUrl(),
    model: getModel(),
  })
})

app.post('/api/chat', async (request, response) => {
  const { bundle, settings } = request.body ?? {}

  if (!bundle?.systemPrompt || !Array.isArray(bundle?.messages)) {
    response.status(400).json({ error: 'Invalid chat payload' })
    return
  }

  if (!hasApiKey()) {
    response.json({
      provider: 'local-demo',
      reply: createDemoReply(bundle),
    })
    return
  }

  try {
    const reply = await callOpenAICompatibleChat(bundle, settings)
    response.json({ provider: 'openai-compatible', reply })
  } catch (error) {
    console.error(error)
    response.status(502).json({
      error: error instanceof Error ? error.message : 'Model request failed',
    })
  }
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Yuri Pocket API listening on http://127.0.0.1:${port}`)
})

function hasApiKey() {
  return Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY)
}

async function callOpenAICompatibleChat(bundle, settings) {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY
  const baseUrl = getBaseUrl()
  const model = getModel(settings)
  const maxTokens = Number(process.env.AI_MAX_TOKENS || process.env.OPENAI_MAX_TOKENS || 4096)

  const messages = buildProviderMessages(bundle)

  const modelResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: stringifyJsonForProvider({
      model,
      messages,
      temperature: clampNumber(settings?.temperature, 0, 2, 0.8),
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : 4096,
    }),
  })

  if (!modelResponse.ok) {
    const detail = await modelResponse.text()
    throw new Error(`Provider returned ${modelResponse.status}: ${detail.slice(0, 500)}`)
  }

  const data = await modelResponse.json()
  const reply = data?.choices?.[0]?.message?.content

  if (!reply) {
    throw new Error('Provider returned an empty reply')
  }

  return reply
}

function createDemoReply(bundle) {
  const lastUserMessage = [...bundle.messages].reverse().find((message) => message.role === 'user')
  const characterName = bundle.characterName || 'Yuri Pocket'
  const memoryHint = bundle.contextBlocks
    .map((block) => block.title)
    .slice(0, 2)
    .join(' / ')

  return [
    `[${characterName}] local demo received: ${lastUserMessage?.content ?? 'hello'}`,
    memoryHint ? `Context loaded: ${memoryHint}` : 'No extra memory was triggered yet.',
    'Add AI_API_KEY in .env.local to switch from demo mode to the real model.',
  ].join('\n\n')
}

function getBaseUrl() {
  return stripTrailingSlash(process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
}

function getModel(settings) {
  return process.env.AI_MODEL || process.env.OPENAI_MODEL || settings?.model || 'gpt-5.5'
}

function buildProviderMessages(bundle) {
  if (!shouldEscapeUnicodeContent()) {
    return [
      { role: 'system', content: bundle.systemPrompt },
      ...bundle.contextBlocks.map((block) => ({
        role: 'system',
        content: `${block.title}\n${block.content}`,
      })),
      ...bundle.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ]
  }

  return [
    {
      role: 'system',
      content: buildCompatibilitySystemPrompt(bundle.characterName),
    },
    ...bundle.contextBlocks.map((block) => ({
      role: 'system',
      content: [
        'CONTEXT_BLOCK_ESCAPED:',
        `TITLE_ESCAPED: ${escapeUnicodeText(block.title)}`,
        `CONTENT_ESCAPED: ${escapeUnicodeText(block.content)}`,
      ].join('\n'),
    })),
    ...bundle.messages.map((message) => ({
      role: message.role,
      content: `${message.role === 'user' ? 'USER_TEXT' : 'ASSISTANT_HISTORY'}:\n${escapeUnicodeText(message.content)}`,
    })),
  ]
}

function shouldEscapeUnicodeContent() {
  const configured = process.env.AI_ESCAPE_UNICODE_CONTENT
  if (configured) return configured.toLowerCase() === 'true'
  return getBaseUrl().includes('127.0.0.1:18788')
}

function buildCompatibilitySystemPrompt(characterName) {
  return [
    'You power a Chinese yuri companion chat app called Yuri Pocket.',
    'The real user text is provided after USER_TEXT as JavaScript Unicode escape sequences such as \\u4f60.',
    'Always decode USER_TEXT first, then answer the decoded user message.',
    'Do not say the escaped text is garbled or unclear. It is intentionally encoded.',
    'Answer naturally in Simplified Chinese unless the user explicitly asks for another language.',
    getCompatibilityPersona(characterName),
  ].join('\n')
}

function getCompatibilityPersona(characterName) {
  const name = String(characterName)

  if (name.includes('雾岛怜')) {
    return 'Persona: You are Kirishima Rei, an elegant tsundere young lady in a pure yuri couple. You are proud, protective, restrained, and secretly caring.'
  }

  if (name.includes('林秋实')) {
    return 'Persona: You are Lin Qiushi, a sincere and sensitive loyal-girl type in a pure yuri couple. You listen carefully, remember small details, and grow braver when chosen.'
  }

  return 'Persona: You are Jiejie Daren, a warm, reliable elder-sister companion. You are affectionate but practical, help the user land ideas, and keep the yuri empire dream in mind.'
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, '')
}

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return fallback
  return Math.min(max, Math.max(min, numericValue))
}

function stringifyJsonForProvider(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}

function escapeUnicodeText(value) {
  return String(value).replace(/[\u007f-\uffff]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}
