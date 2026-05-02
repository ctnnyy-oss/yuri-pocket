import type { ModelProfileInput, ModelProfileSummary, ModelProviderKind } from '../domain/types'
import { getCloudApiBaseUrl } from './cloudSync'

export interface ModelProviderPreset {
  id: string
  label: string
  description: string
  kind: ModelProviderKind
  baseUrl: string
  model: string
}

export interface ModelProfileSaveResult {
  profile: ModelProfileSummary
  profiles: ModelProfileSummary[]
}

export interface ModelProfileTestResult {
  ok: boolean
  provider: string
  model: string
  latencyMs: number
  preview: string
}

export const modelProviderPresets: ModelProviderPreset[] = [
  {
    id: 'yop-free',
    label: 'YOP 中转 / DeepSeek Free',
    description: '妹妹当前默认路线，适合先保留免费模型。',
    kind: 'openai-compatible',
    baseUrl: 'https://api.yop.mom/v1',
    model: 'deepseek/deepseek-v4-pro-free',
  },
  {
    id: 'openai',
    label: 'OpenAI 官方',
    description: '官方 OpenAI API，使用 OpenAI-compatible 格式。',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.5',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek 官方',
    description: 'DeepSeek 官方接口，适合国内常用模型。',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter 中转',
    description: '一个密钥接多家模型，模型名按 OpenRouter 后台填写。',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-5.5',
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    description: '国内 OpenAI-compatible 中转，模型名按控制台复制。',
    kind: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
  },
  {
    id: 'dashscope',
    label: '阿里百炼 / DashScope',
    description: '百炼兼容模式，模型名如 qwen-plus。',
    kind: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    id: 'moonshot',
    label: '月之暗面 / Kimi',
    description: 'Kimi 官方 OpenAI-compatible 接口。',
    kind: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    id: 'zhipu',
    label: '智谱 AI',
    description: '智谱兼容接口，模型名按控制台复制。',
    kind: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  {
    id: 'anthropic',
    label: 'Anthropic 官方',
    description: 'Claude 官方 messages 接口，不走 OpenAI 格式。',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5',
  },
  {
    id: 'gemini',
    label: 'Google Gemini 官方',
    description: 'Gemini generateContent 接口，密钥走 query 参数。',
    kind: 'google-gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-pro',
  },
  {
    id: 'local-proxy',
    label: '本机代理',
    description: '适合酒馆、代理或本机转发器，手机端通常需要改成云端地址。',
    kind: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:18788/v1',
    model: 'deepseek/deepseek-v4-pro-free',
  },
  {
    id: 'custom',
    label: '自定义',
    description: '任何 OpenAI-compatible、Anthropic 或 Gemini 形态都可以手填。',
    kind: 'openai-compatible',
    baseUrl: '',
    model: '',
  },
]

export async function listModelProfiles(token: string): Promise<ModelProfileSummary[]> {
  const response = await modelFetch('/api/model/profiles', token)
  const payload = (await response.json()) as { profiles?: ModelProfileSummary[] }
  return payload.profiles ?? []
}

export async function saveModelProfile(token: string, profile: ModelProfileInput): Promise<ModelProfileSaveResult> {
  const response = await modelFetch('/api/model/profiles', token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profile }),
  })
  return response.json()
}

export async function deleteModelProfile(token: string, profileId: string): Promise<ModelProfileSummary[]> {
  const response = await modelFetch(`/api/model/profiles/${encodeURIComponent(profileId)}`, token, { method: 'DELETE' })
  const payload = (await response.json()) as { profiles?: ModelProfileSummary[] }
  return payload.profiles ?? []
}

export async function testModelProfile(
  token: string,
  input: { profileId?: string; profile?: ModelProfileInput },
): Promise<ModelProfileTestResult> {
  const response = await modelFetch('/api/model/test', token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  return response.json()
}

async function modelFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const apiBaseUrl = getCloudApiBaseUrl()
  if (!apiBaseUrl) throw new Error('云端后端还没有配置')
  if (!token.trim()) throw new Error('先连接云端口令，模型密钥才会安全保存在服务器')

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token.trim()}`,
    },
  })

  if (!response.ok) {
    const detail = await readModelError(response)
    throw new Error(formatModelError(response.status, detail))
  }

  return response
}

async function readModelError(response: Response): Promise<string> {
  const detail = await response.text()
  if (!detail) return ''

  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string }
    return parsed.error || parsed.message || detail
  } catch {
    return detail
  }
}

function formatModelError(status: number, detail: string): string {
  if (status === 401) return '云端口令不对，模型密钥保险箱拒绝访问'
  if (status === 404) return detail || '没有找到这个模型配置'
  if (status >= 500) return `模型服务暂时没接住：${detail || status}`
  return detail || `模型配置请求失败：${status}`
}
