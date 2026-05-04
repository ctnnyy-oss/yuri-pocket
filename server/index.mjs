import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { prepareAgentBundle } from './agentTools.mjs'
import {
  createCloudBackup,
  getCloudDatabase,
  isValidAppStateShape,
  listCloudBackups,
  readSnapshot,
  resolveBackupPath,
  saveSnapshot,
} from './cloudStore.mjs'
import {
  callModelChat,
  createModelTestBundle,
  createModelTestSettings,
  fetchProviderModels,
  getBaseUrl,
  getModel,
  stripTrailingSlash,
} from './modelProvider.mjs'
import {
  createPlatformTask,
  getPlatformStatus,
  initializePlatform,
  listPlatformConnectors,
  listPlatformExecutors,
  listPlatformNotifications,
  listPlatformTasks,
  markPlatformNotificationsSeen,
  startPlatformWorker,
  updatePlatformConnector,
  updatePlatformTask,
} from './platform.mjs'

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

app.post('/api/model/models', requireCloudAuth, async (request, response) => {
  try {
    const runtimeProfile = resolveRuntimeProfileForModelCatalog(request.body ?? {})
    if (!runtimeProfile.apiKey) {
      response.status(400).json({ error: '拉取模型列表需要先填写或保存 API Key' })
      return
    }

    response.json(await fetchProviderModels(runtimeProfile))
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : '模型列表拉取失败' })
  }
})

app.get('/api/platform/status', requireCloudAuth, (_request, response) => {
  response.json(getPlatformStatus())
})

app.get('/api/platform/tasks', requireCloudAuth, (request, response) => {
  response.json({
    ok: true,
    tasks: listPlatformTasks(request.query.limit),
  })
})

app.post('/api/platform/tasks', requireCloudAuth, (request, response) => {
  try {
    response.json({
      ok: true,
      task: createPlatformTask(request.body?.task ?? request.body ?? {}),
    })
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : '后台任务创建失败' })
  }
})

app.patch('/api/platform/tasks/:taskId', requireCloudAuth, (request, response) => {
  const task = updatePlatformTask(request.params.taskId, request.body ?? {})
  if (!task) {
    response.status(404).json({ error: '没有找到这个后台任务' })
    return
  }

  response.json({ ok: true, task })
})

app.get('/api/platform/notifications', requireCloudAuth, (request, response) => {
  response.json({
    ok: true,
    notifications: listPlatformNotifications(request.query.limit),
  })
})

app.patch('/api/platform/notifications', requireCloudAuth, (request, response) => {
  response.json({
    ok: true,
    notifications: markPlatformNotificationsSeen(request.body?.ids ?? []),
  })
})

app.get('/api/platform/connectors', requireCloudAuth, (_request, response) => {
  response.json({
    ok: true,
    connectors: listPlatformConnectors(),
  })
})

app.patch('/api/platform/connectors/:connectorId', requireCloudAuth, (request, response) => {
  const connector = updatePlatformConnector(request.params.connectorId, request.body ?? {})
  if (!connector) {
    response.status(404).json({ error: '没有找到这个连接器' })
    return
  }

  response.json({ ok: true, connector, connectors: listPlatformConnectors() })
})

app.get('/api/platform/executors', requireCloudAuth, (_request, response) => {
  response.json({
    ok: true,
    executors: listPlatformExecutors(),
  })
})

app.post('/api/chat', async (request, response) => {
  const { bundle, settings } = request.body ?? {}

  if (!bundle?.systemPrompt || !Array.isArray(bundle?.messages)) {
    response.status(400).json({ error: 'Invalid chat payload' })
    return
  }

  const authFailure = shouldRequireModelAuth() ? getCloudAuthFailure(request) : null
  if (authFailure) {
    response.status(authFailure.status).json({ error: '模型代理需要登录或云端口令授权。' })
    return
  }

  const agentRun = await prepareAgentBundle(bundle)
  const agentBundle = agentRun.bundle
  const runtimeProfile = resolveRuntimeProfileForChat(settings)
  if (!runtimeProfile?.apiKey) {
    response.json({
      provider: 'local-demo',
      reply: createDemoReply(agentBundle),
      agent: agentRun.agent,
    })
    return
  }

  try {
    const reply = await callModelChat(agentBundle, settings, runtimeProfile)
    response.json({ provider: runtimeProfile.name, model: runtimeProfile.model, reply, agent: agentRun.agent })
  } catch (error) {
    console.error(error)
    response.json({
      provider: 'agent-fallback',
      model: runtimeProfile.model,
      reply: createProviderFallbackReply(error, agentRun.agent),
      agent: agentRun.agent,
      warning: error instanceof Error ? error.message : 'Model request failed',
    })
  }
})

initializePlatform()
startPlatformWorker()

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
  if (!shouldRequireCloudAuth()) {
    next()
    return
  }

  const failure = getCloudAuthFailure(request)
  if (failure) {
    response.status(failure.status).json({ error: failure.message })
    return
  }

  next()
}

function shouldRequireCloudAuth() {
  return process.env.YURI_NEST_REQUIRE_CLOUD_AUTH === 'true'
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

function listModelProfiles() {
  return listStoredModelProfiles()
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

function normalizeModelProfileInput(input, options = {}) {
  if (!input || typeof input !== 'object') throw new Error('模型配置格式不对')

  const kind = String(input.kind || 'openai-compatible')
  if (!modelProviderKinds.has(kind)) throw new Error('暂不支持这个模型接口类型')

  const baseUrl = String(input.baseUrl || '').trim()
  const model = String(input.model || '').trim()
  const name = deriveModelProfileName({ name: input.name, kind, baseUrl, model })

  if (!baseUrl) throw new Error('模型配置需要 Base URL')
  if (options.requireModel !== false && !model) throw new Error('模型配置需要模型名')

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

function deriveModelProfileName(input) {
  const explicitName = String(input.name || '').trim()
  if (explicitName) return explicitName

  const host = getProfileHostLabel(input.baseUrl)
  const kindLabel = input.kind === 'anthropic' ? 'Anthropic' : input.kind === 'google-gemini' ? 'Gemini' : 'OpenAI 兼容'
  const model = String(input.model || '').trim()

  if (model && host) return `${host} / ${model}`
  if (host) return `${host} / ${kindLabel}`
  if (model) return model
  return '我的模型配置'
}

function getProfileHostLabel(baseUrl) {
  try {
    const hostname = new URL(stripTrailingSlash(baseUrl)).hostname
    return hostname.replace(/^api\./, '').replace(/^www\./, '')
  } catch {
    return ''
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
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
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

  if (selectedProfileId === serverEnvProfileId) {
    return resolveServerEnvProfile(settings)
  }

  const defaultStoredProfile = readDefaultStoredModelProfile()
  if (defaultStoredProfile) {
    return storedProfileToRuntime(defaultStoredProfile)
  }

  return null
}

function resolveServerEnvProfile(settings) {
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

function resolveRuntimeProfileForModelCatalog(input) {
  if (input.profile) {
    const normalized = normalizeModelProfileInput(input.profile, { requireModel: false })
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
  return process.env.YURI_NEST_REQUIRE_CHAT_AUTH === 'true'
}

function attachAgentToolResults(bundle) {
  const contextBlocks = Array.isArray(bundle.contextBlocks) ? bundle.contextBlocks : []
  const toolBlocks = buildAgentToolBlocks(bundle)

  if (toolBlocks.length === 0 && Array.isArray(bundle.contextBlocks)) return bundle
  return { ...bundle, contextBlocks: [...toolBlocks, ...contextBlocks] }
}

function buildAgentToolBlocks(bundle) {
  const messages = Array.isArray(bundle.messages) ? bundle.messages : []
  const latestUserMessage = [...messages].reverse().find((message) => message?.role === 'user')
  const latestUserText = normalizeToolText(latestUserMessage?.content)

  if (!latestUserText) return []

  const toolBlocks = []

  if (shouldUseTimeTool(latestUserText)) {
    toolBlocks.push(createCurrentTimeToolBlock())
  }

  if (shouldUseConversationTool(latestUserText)) {
    toolBlocks.push(createConversationSnapshotToolBlock(messages))
  }

  if (shouldUseCapabilityGuide(latestUserText)) {
    toolBlocks.push(createCapabilityGuideBlock())
  }

  return toolBlocks
}

function shouldUseTimeTool(text) {
  return /几点|时间|日期|今天|今晚|明天|昨天|星期|周几|早上|中午|下午|晚上|凌晨|现在|刚刚|一会儿/.test(text)
}

function shouldUseConversationTool(text) {
  return /总结|摘要|整理|复盘|待办|下一步|计划|安排|检查|设定|世界观|矛盾|角色|记忆|梳理|归纳/.test(text)
}

function shouldUseCapabilityGuide(text) {
  return /agent|Agent|LLM|llm|大预言模型|工具|功能|能做|全能|智能化|联网|文件|除了聊天|不只是聊天/.test(text)
}

function createCurrentTimeToolBlock() {
  return {
    title: 'Agent 工具：当前北京时间',
    content: [
      '工具 current_time 已执行。',
      formatBeijingDateTime(new Date()),
      '如果用户询问时间、日期、今天/明天/星期等问题，必须以这条工具结果为准，不能编造其他钟点。',
    ].join('\n'),
    category: 'stable',
    reason: 'current_time',
  }
}

function createConversationSnapshotToolBlock(messages) {
  const recentMessages = messages.slice(-8)
  const lines = recentMessages.map((message) => {
    const role = getToolRoleLabel(message?.role)
    const time = formatToolMessageTime(message?.createdAt)
    const content = truncateToolText(normalizeToolText(message?.content), 180)
    return `- ${role}${time ? ` ${time}` : ''}: ${content}`
  })

  return {
    title: 'Agent 工具：最近对话工作台',
    content: [
      '工具 conversation_snapshot 已执行。',
      `最近消息数：${recentMessages.length}`,
      '可用于总结、下一步建议、设定检查、待办梳理；回答时请保持角色语气，不要暴露内部工具过程。',
      '最近内容：',
      ...lines,
    ].join('\n'),
    category: 'summary',
    reason: 'conversation_snapshot',
  }
}

function createCapabilityGuideBlock() {
  return {
    title: 'Agent 工具：能力边界',
    content: [
      '后台轻量 agent 能力已启用：current_time 可读取当前北京时间，conversation_snapshot 可整理最近对话，context_check 可基于现有记忆和上下文做设定检查。',
      '你可以主动把用户的模糊需求整理成计划、待办、检查清单或下一步行动。',
      '当前没有外部浏览、文件系统、系统操作或长期自动任务工具时，不要声称自己已经联网、改文件、设提醒或替用户执行了外部动作；需要这些能力时，应温柔说明需要接入对应工具。',
    ].join('\n'),
    category: 'stable',
    reason: 'capability_guide',
  }
}

function formatBeijingDateTime(date) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const value = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `北京时间 ${value('year')}-${value('month')}-${value('day')} ${value('weekday')} ${value('hour')}:${value('minute')}:${value('second')}`
}

function formatToolMessageTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const partValue = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${partValue('hour')}:${partValue('minute')}`
}

function normalizeToolText(value) {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''

  try {
    return JSON.stringify(value)
  } catch (_error) {
    return String(value)
  }
}

function truncateToolText(value, maxLength) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

function getToolRoleLabel(role) {
  if (role === 'user') return '用户'
  if (role === 'assistant') return '角色'
  if (role === 'system') return '系统'
  return '消息'
}

const DEMO_META_AGENT_REASONS = new Set([
  'agent_brief',
  'capability_guide',
  'agent_continuity',
  'memory_bridge',
  'autonomy_budget',
  'risk_gate',
  'task_queue',
  'workflow_router',
  'persona_guard',
  'failure_recovery',
  'evidence_audit',
  'answer_composer',
  'deliverable_contract',
  'response_quality_gate',
  'agent_quality_check',
  'handoff_marker',
  'tool_governance',
])

function createDemoReply(bundle) {
  const lastUserMessage = [...bundle.messages].reverse().find((message) => message.role === 'user')
  const characterName = bundle.characterName || appName
  const agentBlocks = bundle.contextBlocks.filter((block) => block.title?.startsWith('Agent '))
  const visibleAgentBlocks = agentBlocks.filter((block) => !DEMO_META_AGENT_REASONS.has(block.reason))
  const memoryHint = bundle.contextBlocks
    .filter((block) => !block.title?.startsWith('Agent '))
    .map((block) => block.title)
    .slice(0, 2)
    .join(' / ')

  if (agentBlocks.length > 0) {
    return [
      `妹妹，${characterName}在。现在还只是本地演示回复，但本地工具已经先把能看的部分处理好了：`,
      ...(visibleAgentBlocks.length > 0 ? visibleAgentBlocks : agentBlocks)
        .slice(0, 4)
        .map((block) => `${cleanDemoAgentTitle(block.title)}：${extractDemoAgentLine(block.content)}`),
      '等模型页保存一组能用的模型后，姐姐会把这些结果自然揉进角色回复里，不会像报告一样硬邦邦地甩出来。',
    ].join('\n\n')
  }

  const userText = truncateToolText(lastUserMessage?.content ?? 'hello', 120)
  const memoryLine = memoryHint ? `这轮已经准备好的上下文：${memoryHint}。` : '这轮暂时没有额外命中长期记忆。'

  return [
    `妹妹，${characterName}在。刚才那句姐姐接到了：${userText}`,
    `${memoryLine}现在还没接上可用模型，所以这只是本地兜底回复；聊天、记忆和页面状态都没有丢。`,
    '去模型页保存一组 Base URL、API Key 和模型名后，姐姐就能按当前角色和记忆认真陪妹妹聊。',
  ].join('\n\n')
}

function cleanDemoAgentTitle(title) {
  return String(title || '').replace(/^Agent (工具|动作)：/, '')
}

function extractDemoAgentLine(content) {
  const lines = String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^工具 .*已执行。$/.test(line))
    .filter((line) => !/^回答时|^请|^前端收到|^当前|^你可以/.test(line))

  return lines[0]?.slice(0, 220) || '工具已运行，但没有返回可展示摘要。'
}

function createProviderFallbackReply(error, agent) {
  const actionCount = Array.isArray(agent?.actions) ? agent.actions.filter((action) => !action.requiresConfirmation).length : 0
  const tools = Array.isArray(agent?.tools) ? agent.tools : []
  const toolCount = tools.filter((tool) => !DEMO_META_AGENT_REASONS.has(tool.name)).length
  const reason = formatFallbackReason(error instanceof Error ? error.message : '模型供应商暂时没有接住请求')
  const usefulToolLines = buildProviderFallbackToolLines(tools)

  return [
    usefulToolLines.length > 0
      ? '妹妹，刚才不是姐姐不回你，是这组模型没有接住请求；本地 Agent 已经先把能办的部分做完了。'
      : '妹妹，刚才不是姐姐不回你，是这组模型没有接住请求；本地聊天、记忆和页面状态都没有丢。',
    ...usefulToolLines,
    actionCount > 0 ? `姐姐已经把 ${actionCount} 个可执行动作交给网页处理。` : '',
    usefulToolLines.length === 0 && toolCount > 0 ? `这轮后台工具已执行 ${toolCount} 项，等模型恢复后就能自然回答。` : '',
    `模型提示：${reason}`,
    '可以先去模型页换一组配置，或者补好余额/额度后再发一次。',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function formatFallbackReason(message) {
  const text = String(message || '').trim()
  if (/insufficient\s*balance|余额|额度|欠费|quota|credit/i.test(text)) {
    return '当前模型额度或余额不足。'
  }
  if (/invalid[_ -]?model|model.+not.+valid|model.+not.+found|不接受这个模型名/i.test(text)) {
    return '当前模型名不被供应商接受。'
  }
  if (/密钥|api key|apikey|unauthorized|forbidden|401|403/i.test(text)) {
    return '当前 API Key 没通过，可能是密钥、权限或平台配置不对。'
  }
  return text || '模型供应商暂时没有接住请求。'
}

function buildProviderFallbackToolLines(tools) {
  return tools
    .filter((tool) => tool?.name && !DEMO_META_AGENT_REASONS.has(tool.name))
    .slice(0, 4)
    .map((tool) => {
      const label = String(tool.title || tool.name).replace(/^Agent 工具：/, '')
      const summary = String(tool.summary || '').trim()
      if (!summary) return ''
      if (tool.status === 'success') return `${label}：${summary}`
      if (tool.status === 'needs_input') return `${label}：还缺关键信息，${summary}`
      return `${label}：这次没查成，${summary}`
    })
    .filter(Boolean)
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
