import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config({ path: '.env.local' })
dotenv.config()

const app = express()
const port = Number(process.env.YURI_NEST_API_PORT || 8787)
const corsOrigin = getCorsOrigin()
const snapshotId = 'default'
const appName = 'Yuri Nest'
const serverEnvProfileId = 'server-env'
const modelProviderKinds = new Set(['openai-compatible', 'anthropic', 'google-gemini'])

app.use(cors({ origin: corsOrigin }))
app.use(express.json({ limit: process.env.YURI_NEST_JSON_LIMIT || '10mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    provider: hasApiKey() ? 'openai-compatible' : 'local-demo',
    cloudSync: hasCloudSyncToken() ? 'configured' : 'not-configured',
    baseUrl: getBaseUrl(),
    model: getModel(),
  })
})

app.get('/api/cloud/health', requireCloudAuth, (_request, response) => {
  const snapshot = readSnapshot()
  response.json({
    ok: true,
    hasState: Boolean(snapshot),
    updatedAt: snapshot?.updatedAt ?? null,
    revision: snapshot?.revision ?? 0,
  })
})

app.get('/api/cloud/state', requireCloudAuth, (_request, response) => {
  const snapshot = readSnapshot()
  response.json({
    ok: true,
    state: snapshot ? JSON.parse(snapshot.payload) : null,
    updatedAt: snapshot?.updatedAt ?? null,
    revision: snapshot?.revision ?? 0,
  })
})

app.get('/api/cloud/backups', requireCloudAuth, (_request, response) => {
  response.json({
    ok: true,
    backups: listCloudBackups(),
  })
})

app.post('/api/cloud/backups', requireCloudAuth, (_request, response) => {
  const backup = createCloudBackup('manual')
  response.json({
    ok: true,
    backup,
    backups: listCloudBackups(),
  })
})

app.get('/api/cloud/backups/:fileName', requireCloudAuth, (request, response) => {
  const backupPath = resolveBackupPath(request.params.fileName)
  if (!backupPath || !existsSync(backupPath)) {
    response.status(404).json({ error: 'Backup not found' })
    return
  }

  response.download(backupPath)
})

app.put('/api/cloud/state', requireCloudAuth, (request, response) => {
  const state = request.body?.state
  if (!isValidAppStateShape(state)) {
    response.status(400).json({ error: `Invalid ${appName} state payload` })
    return
  }

  const snapshot = saveSnapshot(state)
  response.json({
    ok: true,
    updatedAt: snapshot.updatedAt,
    revision: snapshot.revision,
  })
})

app.get('/api/model/profiles', requireCloudAuth, (_request, response) => {
  response.json({
    ok: true,
    profiles: listModelProfiles(),
  })
})

app.post('/api/model/profiles', requireCloudAuth, (request, response) => {
  try {
    const profile = upsertModelProfile(request.body?.profile)
    response.json({
      ok: true,
      profile,
      profiles: listModelProfiles(),
    })
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : '模型配置保存失败' })
  }
})

app.delete('/api/model/profiles/:profileId', requireCloudAuth, (request, response) => {
  const deleted = deleteModelProfile(request.params.profileId)
  if (!deleted) {
    response.status(404).json({ error: '没有找到这个模型配置' })
    return
  }

  response.json({
    ok: true,
    profiles: listModelProfiles(),
  })
})

app.post('/api/model/test', requireCloudAuth, async (request, response) => {
  try {
    const runtimeProfile = resolveRuntimeProfileForTest(request.body ?? {})
    if (!runtimeProfile.apiKey) {
      response.status(400).json({ error: '这个模型配置还没有保存密钥' })
      return
    }

    const startedAt = Date.now()
    const reply = await callModelChat(createModelTestBundle(), createModelTestSettings(runtimeProfile), runtimeProfile)
    response.json({
      ok: true,
      provider: runtimeProfile.name,
      model: runtimeProfile.model,
      latencyMs: Date.now() - startedAt,
      preview: reply.slice(0, 160),
    })
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : '模型测试失败' })
  }
})

app.post('/api/chat', async (request, response) => {
  const { bundle, settings } = request.body ?? {}

  if (!bundle?.systemPrompt || !Array.isArray(bundle?.messages)) {
    response.status(400).json({ error: 'Invalid chat payload' })
    return
  }

  const authFailure = shouldRequireModelAuth() ? getCloudAuthFailure(request) : null
  if (authFailure) {
    response.status(authFailure.status).json({ error: '模型代理需要先连接云端口令，避免公开页面被别人消耗密钥。' })
    return
  }

  const runtimeProfile = resolveRuntimeProfileForChat(settings)
  if (!runtimeProfile?.apiKey) {
    response.json({
      provider: 'local-demo',
      reply: createDemoReply(bundle),
    })
    return
  }

  try {
    const reply = await callModelChat(bundle, settings, runtimeProfile)
    response.json({ provider: runtimeProfile.name, model: runtimeProfile.model, reply })
  } catch (error) {
    console.error(error)
    response.status(502).json({
      error: error instanceof Error ? error.message : 'Model request failed',
    })
  }
})

app.listen(port, '127.0.0.1', () => {
  console.log(`${appName} API listening on http://127.0.0.1:${port}`)
})

function hasApiKey() {
  return Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY)
}

function hasCloudSyncToken() {
  return Boolean(process.env.YURI_NEST_SYNC_TOKEN)
}

function requireCloudAuth(request, response, next) {
  const failure = getCloudAuthFailure(request)
  if (failure) {
    response.status(failure.status).json({ error: failure.message })
    return
  }

  next()
}

function getCloudAuthFailure(request) {
  const expectedToken = process.env.YURI_NEST_SYNC_TOKEN
  if (!expectedToken) {
    return { status: 503, message: 'Cloud sync is not configured on this server' }
  }

  if (!isSameToken(getProvidedCloudToken(request), expectedToken)) {
    return { status: 401, message: 'Cloud sync token is invalid' }
  }

  return null
}

function getProvidedCloudToken(request) {
  return request.get('x-yuri-nest-token') || request.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
}

function isSameToken(providedToken, expectedToken) {
  const provided = Buffer.from(String(providedToken))
  const expected = Buffer.from(String(expectedToken))
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

let cloudDatabase

function getCloudDatabase() {
  if (cloudDatabase) return cloudDatabase

  const databasePath = getCloudDatabasePath()
  mkdirSync(dirname(databasePath), { recursive: true })
  cloudDatabase = new DatabaseSync(databasePath)
  cloudDatabase.exec(`
    CREATE TABLE IF NOT EXISTS app_snapshots (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revision INTEGER NOT NULL
    )
  `)
  cloudDatabase.exec(`
    CREATE TABLE IF NOT EXISTS model_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_kind TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      encrypted_api_key TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  return cloudDatabase
}

function getCloudDatabasePath() {
  return resolve(process.env.YURI_NEST_DB_PATH || './data/yuri-nest.sqlite')
}

function getCloudBackupDir() {
  return resolve(process.env.YURI_NEST_BACKUP_DIR || './data/backups')
}

function readSnapshot() {
  const row = getCloudDatabase()
    .prepare('SELECT payload, updated_at AS updatedAt, revision FROM app_snapshots WHERE id = ?')
    .get(snapshotId)

  return row ?? null
}

function saveSnapshot(state) {
  const existing = readSnapshot()
  if (existing) {
    createCloudBackup(`auto-before-save-rev${existing.revision}`)
  }
  const nextRevision = Number(existing?.revision ?? 0) + 1
  const updatedAt = new Date().toISOString()
  const payload = JSON.stringify(state)

  getCloudDatabase()
    .prepare(
      `INSERT INTO app_snapshots (id, payload, updated_at, revision)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at,
         revision = excluded.revision`,
    )
    .run(snapshotId, payload, updatedAt, nextRevision)

  return { payload, updatedAt, revision: nextRevision }
}

function createCloudBackup(reason = 'manual') {
  const database = getCloudDatabase()
  const backupDir = getCloudBackupDir()
  mkdirSync(backupDir, { recursive: true })

  const safeReason = String(reason).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').slice(0, 48) || 'backup'
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `yuri-nest-${safeReason}-${stamp}.sqlite`
  const backupPath = join(backupDir, fileName)

  database.exec(`VACUUM INTO ${quoteSqlString(backupPath)}`)
  pruneCloudBackups()
  return toCloudBackupSummary(backupPath)
}

function listCloudBackups() {
  const backupDir = getCloudBackupDir()
  if (!existsSync(backupDir)) return []

  return readdirSync(backupDir)
    .filter((fileName) => fileName.startsWith('yuri-nest-') && fileName.endsWith('.sqlite'))
    .map((fileName) => toCloudBackupSummary(join(backupDir, fileName)))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function pruneCloudBackups() {
  const maxBackups = clampNumber(process.env.YURI_NEST_MAX_BACKUPS, 3, 120, 24)
  const backups = listCloudBackups()
  backups.slice(maxBackups).forEach((backup) => {
    const backupPath = resolveBackupPath(backup.fileName)
    if (backupPath) rmSync(backupPath, { force: true })
  })
}

function resolveBackupPath(fileName) {
  const cleanName = basename(String(fileName))
  if (!cleanName.startsWith('yuri-nest-') || !cleanName.endsWith('.sqlite')) return null
  const backupDir = getCloudBackupDir()
  const backupPath = resolve(backupDir, cleanName)
  return backupPath.startsWith(`${backupDir}${sep}`) ? backupPath : null
}

function toCloudBackupSummary(backupPath) {
  const stats = statSync(backupPath)
  const fileName = basename(backupPath)
  return {
    fileName,
    label: fileName.replace(/^yuri-nest-/, '').replace(/\.sqlite$/, ''),
    createdAt: stats.mtime.toISOString(),
    sizeBytes: stats.size,
  }
}

function quoteSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function isValidAppStateShape(state) {
  return (
    state &&
    typeof state === 'object' &&
    Array.isArray(state.characters) &&
    Array.isArray(state.conversations) &&
    Array.isArray(state.memories) &&
    Array.isArray(state.worldNodes) &&
    state.settings &&
    typeof state.settings === 'object'
  )
}

function listModelProfiles() {
  return [getServerEnvProfileSummary(), ...listStoredModelProfiles()]
}

function listStoredModelProfiles() {
  return getCloudDatabase()
    .prepare(
      `SELECT id, name, provider_kind AS kind, base_url AS baseUrl, model, encrypted_api_key AS encryptedApiKey,
              enabled, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt
       FROM model_profiles
       ORDER BY is_default DESC, updated_at DESC`,
    )
    .all()
    .map((row) => toModelProfileSummary(row))
}

function readStoredModelProfile(profileId) {
  if (!profileId || profileId === serverEnvProfileId) return null
  const row = getCloudDatabase()
    .prepare(
      `SELECT id, name, provider_kind AS kind, base_url AS baseUrl, model, encrypted_api_key AS encryptedApiKey,
              enabled, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt
       FROM model_profiles
       WHERE id = ?`,
    )
    .get(String(profileId))

  return row ? toModelProfileRecord(row) : null
}

function readDefaultStoredModelProfile() {
  const row = getCloudDatabase()
    .prepare(
      `SELECT id, name, provider_kind AS kind, base_url AS baseUrl, model, encrypted_api_key AS encryptedApiKey,
              enabled, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt
       FROM model_profiles
       WHERE enabled = 1 AND is_default = 1
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get()

  return row ? toModelProfileRecord(row) : null
}

function upsertModelProfile(input) {
  const profile = normalizeModelProfileInput(input)
  const now = new Date().toISOString()
  const existing = profile.id ? readStoredModelProfile(profile.id) : null
  const id = existing?.id ?? profile.id ?? randomUUID()
  const encryptedApiKey =
    profile.apiKey && profile.apiKey.trim() ? encryptSecret(profile.apiKey.trim()) : existing?.encryptedApiKey ?? null

  if (profile.isDefault) clearDefaultModelProfiles()

  getCloudDatabase()
    .prepare(
      `INSERT INTO model_profiles
        (id, name, provider_kind, base_url, model, encrypted_api_key, enabled, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         provider_kind = excluded.provider_kind,
         base_url = excluded.base_url,
         model = excluded.model,
         encrypted_api_key = excluded.encrypted_api_key,
         enabled = excluded.enabled,
         is_default = excluded.is_default,
         updated_at = excluded.updated_at`,
    )
    .run(
      id,
      profile.name,
      profile.kind,
      stripTrailingSlash(profile.baseUrl),
      profile.model,
      encryptedApiKey,
      profile.enabled ? 1 : 0,
      profile.isDefault ? 1 : 0,
      existing?.createdAt ?? now,
      now,
    )

  return toModelProfileSummary(readStoredModelProfile(id))
}

function deleteModelProfile(profileId) {
  if (!profileId || profileId === serverEnvProfileId) return false
  const result = getCloudDatabase().prepare('DELETE FROM model_profiles WHERE id = ?').run(String(profileId))
  return result.changes > 0
}

function clearDefaultModelProfiles() {
  getCloudDatabase().prepare('UPDATE model_profiles SET is_default = 0').run()
}

function normalizeModelProfileInput(input) {
  if (!input || typeof input !== 'object') throw new Error('模型配置格式不对')

  const kind = String(input.kind || 'openai-compatible')
  if (!modelProviderKinds.has(kind)) throw new Error('暂不支持这个模型接口类型')

  const name = String(input.name || '').trim()
  const baseUrl = String(input.baseUrl || '').trim()
  const model = String(input.model || '').trim()

  if (!name) throw new Error('模型配置需要一个名称')
  if (!baseUrl) throw new Error('模型配置需要 Base URL')
  if (!model) throw new Error('模型配置需要模型名')

  return {
    id: input.id ? String(input.id) : undefined,
    name: name.slice(0, 80),
    kind,
    baseUrl: stripTrailingSlash(baseUrl),
    model: model.slice(0, 160),
    apiKey: typeof input.apiKey === 'string' ? input.apiKey : '',
    enabled: input.enabled !== false,
    isDefault: Boolean(input.isDefault),
  }
}

function toModelProfileRecord(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    baseUrl: row.baseUrl,
    model: row.model,
    encryptedApiKey: row.encryptedApiKey,
    hasApiKey: Boolean(row.encryptedApiKey),
    enabled: Boolean(row.enabled),
    isDefault: Boolean(row.isDefault),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toModelProfileSummary(row) {
  const record = row.encryptedApiKey === undefined ? row : toModelProfileRecord(row)
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    baseUrl: record.baseUrl,
    model: record.model,
    hasApiKey: record.hasApiKey,
    enabled: record.enabled,
    isDefault: record.isDefault,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function getServerEnvProfileSummary() {
  const now = new Date(0).toISOString()
  return {
    id: serverEnvProfileId,
    name: '服务器默认配置',
    kind: 'openai-compatible',
    baseUrl: getBaseUrl(),
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || '由页面模型栏决定',
    hasApiKey: hasApiKey(),
    enabled: true,
    isDefault: !readDefaultStoredModelProfile(),
    createdAt: now,
    updatedAt: now,
  }
}

function resolveRuntimeProfileForChat(settings) {
  const selectedProfileId = settings?.modelProfileId
  if (selectedProfileId && selectedProfileId !== serverEnvProfileId) {
    return storedProfileToRuntime(readStoredModelProfile(selectedProfileId))
  }

  const defaultStoredProfile = readDefaultStoredModelProfile()
  if (defaultStoredProfile && selectedProfileId !== serverEnvProfileId) {
    return storedProfileToRuntime(defaultStoredProfile)
  }

  if (!hasApiKey()) return null

  return {
    id: serverEnvProfileId,
    name: '服务器默认配置',
    kind: 'openai-compatible',
    baseUrl: getBaseUrl(),
    model: getModel(settings),
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
  }
}

function resolveRuntimeProfileForTest(input) {
  if (input.profile) {
    const normalized = normalizeModelProfileInput(input.profile)
    return {
      id: normalized.id ?? 'draft',
      name: normalized.name,
      kind: normalized.kind,
      baseUrl: normalized.baseUrl,
      model: normalized.model,
      apiKey: normalized.apiKey?.trim() || '',
    }
  }

  if (input.profileId === serverEnvProfileId) {
    return resolveRuntimeProfileForChat({ modelProfileId: serverEnvProfileId, model: process.env.AI_MODEL })
  }

  return storedProfileToRuntime(readStoredModelProfile(input.profileId))
}

function storedProfileToRuntime(profile) {
  if (!profile) throw new Error('没有找到这个模型配置')
  if (!profile.enabled) throw new Error('这个模型配置已经停用')

  return {
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKey: profile.encryptedApiKey ? decryptSecret(profile.encryptedApiKey) : '',
  }
}

function shouldRequireModelAuth() {
  return hasCloudSyncToken() && (hasApiKey() || listStoredModelProfiles().some((profile) => profile.hasApiKey))
}

async function callModelChat(bundle, settings, profile) {
  if (profile.kind === 'anthropic') return callAnthropicChat(bundle, settings, profile)
  if (profile.kind === 'google-gemini') return callGeminiChat(bundle, settings, profile)
  return callOpenAICompatibleChat(bundle, settings, profile)
}

async function callOpenAICompatibleChat(bundle, settings, profile) {
  const messages = buildProviderMessages(bundle, profile.baseUrl)
  const maxTokens = getMaxOutputTokens(settings)

  const modelResponse = await fetch(`${profile.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${profile.apiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: stringifyJsonForProvider({
      model: profile.model,
      messages,
      temperature: clampNumber(settings?.temperature, 0, 2, 0.8),
      max_tokens: maxTokens,
    }),
  })

  if (!modelResponse.ok) {
    const detail = await modelResponse.text()
    throw new Error(formatProviderError(modelResponse.status, detail, profile))
  }

  const data = await modelResponse.json()
  const reply = data?.choices?.[0]?.message?.content

  if (!reply) {
    throw new Error('Provider returned an empty reply')
  }

  return reply
}

async function callAnthropicChat(bundle, settings, profile) {
  const modelResponse = await fetch(`${profile.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': profile.apiKey,
      'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: profile.model,
      system: buildAnthropicSystem(bundle),
      messages: bundle.messages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })),
      temperature: clampNumber(settings?.temperature, 0, 1, 0.8),
      max_tokens: getMaxOutputTokens(settings),
    }),
  })

  if (!modelResponse.ok) {
    const detail = await modelResponse.text()
    throw new Error(formatProviderError(modelResponse.status, detail, profile))
  }

  const data = await modelResponse.json()
  const reply = data?.content
    ?.map((part) => (part?.type === 'text' ? part.text : ''))
    .join('')
    .trim()

  if (!reply) throw new Error('模型返回了空回复')
  return reply
}

async function callGeminiChat(bundle, settings, profile) {
  const endpoint = `${profile.baseUrl}/models/${encodeURIComponent(profile.model)}:generateContent?key=${encodeURIComponent(
    profile.apiKey,
  )}`
  const modelResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildAnthropicSystem(bundle) }],
      },
      contents: bundle.messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: clampNumber(settings?.temperature, 0, 2, 0.8),
        maxOutputTokens: getMaxOutputTokens(settings),
      },
    }),
  })

  if (!modelResponse.ok) {
    const detail = await modelResponse.text()
    throw new Error(formatProviderError(modelResponse.status, detail, profile))
  }

  const data = await modelResponse.json()
  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? '')
    .join('')
    .trim()

  if (!reply) throw new Error('模型返回了空回复')
  return reply
}

function createDemoReply(bundle) {
  const lastUserMessage = [...bundle.messages].reverse().find((message) => message.role === 'user')
  const characterName = bundle.characterName || appName
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

function createModelTestBundle() {
  return {
    characterName: '姐姐大人',
    systemPrompt: '你是百合小窝的模型连通性测试助手。请用一句简体中文回复，说明模型已经接通。',
    contextBlocks: [],
    messages: [{ id: 'model-test', role: 'user', content: '请回复：模型已接通。', createdAt: new Date().toISOString() }],
  }
}

function createModelTestSettings(profile) {
  return {
    model: profile.model,
    modelProfileId: profile.id,
    temperature: 0.2,
    maxOutputTokens: 256,
  }
}

function getBaseUrl() {
  return stripTrailingSlash(process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
}

function getModel(settings) {
  return settings?.model || process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.5'
}

function getMaxOutputTokens(settings) {
  const configured = process.env.AI_MAX_TOKENS || process.env.OPENAI_MAX_TOKENS
  return clampNumber(settings?.maxOutputTokens ?? configured, 256, 65536, 4096)
}

function buildProviderMessages(bundle, baseUrl) {
  if (!shouldEscapeUnicodeContent(baseUrl)) {
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

function buildAnthropicSystem(bundle) {
  const contextBlocks = bundle.contextBlocks.map((block) => `${block.title}\n${block.content}`).join('\n\n')
  return [bundle.systemPrompt, contextBlocks].filter(Boolean).join('\n\n')
}

function shouldEscapeUnicodeContent(baseUrl) {
  const configured = process.env.AI_ESCAPE_UNICODE_CONTENT
  if (configured) return configured.toLowerCase() === 'true'
  return String(baseUrl).includes('127.0.0.1:18788')
}

function buildCompatibilitySystemPrompt(characterName) {
  return [
    `You power a Chinese yuri companion chat app called ${appName}.`,
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

function formatProviderError(status, detail, profile) {
  const providerMessage = extractProviderMessage(detail)
  const providerPrefix = `${profile.name} / ${profile.model}`

  if (status === 401 || status === 403) {
    return `${providerPrefix} 密钥没有通过，请检查 API Key 或供应商权限。`
  }

  if (status === 404 || /invalid[_ -]?model|model.+not.+valid|model.+not.+found/i.test(providerMessage)) {
    return `${providerPrefix} 不接受这个模型名。请在模型页把模型名换成供应商控制台里的准确 ID。原始提示：${providerMessage}`
  }

  if (status === 429) {
    return `${providerPrefix} 额度或频率受限了。原始提示：${providerMessage}`
  }

  if (status >= 500) {
    return `${providerPrefix} 上游暂时没接住。原始提示：${providerMessage || status}`
  }

  return `${providerPrefix} 请求失败：${providerMessage || status}`
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

function getCorsOrigin() {
  const configured = process.env.YURI_NEST_CORS_ORIGIN
  if (!configured) return true
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  return origins.length > 1 ? origins : origins[0] || true
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

function encryptSecret(value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getModelSecretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

function decryptSecret(value) {
  if (!value) return ''
  const [version, iv, tag, encrypted] = String(value).split(':')
  if (version !== 'v1' || !iv || !tag || !encrypted) return ''

  const decipher = createDecipheriv('aes-256-gcm', getModelSecretKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8')
}

function getModelSecretKey() {
  const material =
    process.env.YURI_NEST_MODEL_SECRET ||
    process.env.YURI_NEST_SYNC_TOKEN ||
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    'local-yuri-nest-development-secret'
  return createHash('sha256').update(material).digest()
}
