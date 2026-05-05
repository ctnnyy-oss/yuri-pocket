import { existsSync } from 'node:fs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { prepareAgentBundle } from './agentTools.mjs'
import {
  getCloudAuthFailure,
  getSecurityStartupHints,
  hasCloudSyncToken,
  isProductionRuntime,
  requireCloudAuth,
  shouldRequireModelAuth,
} from './auth.mjs'
import { callModelEmbeddings } from './embeddingProvider.mjs'
import {
  createCloudBackup,
  CloudRevisionConflictError,
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
} from './modelProvider.mjs'
import {
  deleteModelProfile,
  getModelSecretConfigurationIssue,
  hasApiKey,
  listModelProfiles,
  resolveRuntimeProfileForChat,
  resolveRuntimeProfileForModelCatalog,
  resolveRuntimeProfileForTest,
  upsertModelProfile,
} from './modelProfiles.mjs'
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
const appName = 'Yuri Nest'

app.use(cors({ origin: corsOrigin }))
app.use(express.json({ limit: process.env.YURI_NEST_JSON_LIMIT || '10mb' }))
getSecurityStartupHints().forEach((hint) => console.warn(`[${appName} 安全提示] ${hint}`))
const modelSecretIssue = getModelSecretConfigurationIssue()
if (modelSecretIssue) console.warn(`[${appName} 安全提示] ${modelSecretIssue}`)

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

  try {
    const snapshot = saveSnapshot(state, { baseRevision: request.body?.baseRevision })
    response.json({
      ok: true,
      updatedAt: snapshot.updatedAt,
      revision: snapshot.revision,
    })
  } catch (error) {
    if (error instanceof CloudRevisionConflictError) {
      response.status(409).json({
        error: error.message,
        currentRevision: error.currentRevision,
        updatedAt: error.updatedAt,
      })
      return
    }
    throw error
  }
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

app.post('/api/model/embeddings', requireCloudAuth, async (request, response) => {
  try {
    const runtimeProfile = resolveRuntimeProfileForModelCatalog(request.body ?? {})
    if (!runtimeProfile.apiKey) {
      response.status(400).json({ error: '生成 embedding 需要先填写或保存 API Key' })
      return
    }

    const startedAt = Date.now()
    const result = await callModelEmbeddings(request.body?.texts, runtimeProfile, {
      model: request.body?.model,
      dimensions: request.body?.dimensions,
    })
    response.json({
      ...result,
      latencyMs: Date.now() - startedAt,
    })
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : 'embedding 生成失败' })
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
  let runtimeProfile
  try {
    runtimeProfile = resolveRuntimeProfileForChat(settings)
  } catch (error) {
    response.status(formatModelConfigErrorStatus(error)).json({
      error: error instanceof Error ? error.message : '模型配置暂时不可用',
    })
    return
  }
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
  if (!configured) return isProductionRuntime() ? ['https://ctnnyy-oss.github.io'] : true
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  return origins.length > 1 ? origins : origins[0] || true
}

function formatModelConfigErrorStatus(error) {
  const message = error instanceof Error ? error.message : ''
  return /YURI_NEST_MODEL_SECRET|生产环境/.test(message) ? 503 : 400
}
