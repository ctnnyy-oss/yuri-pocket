import type { AppSettings, AssistantReplyResult, PromptBundle } from '../domain/types'
import { getSavedCloudToken } from './cloudSync'

export async function requestAssistantReply(bundle: PromptBundle, settings: AppSettings): Promise<AssistantReplyResult> {
  let response: Response
  const apiBaseUrl = getApiBaseUrl()

  try {
    response = await fetch(`${apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getChatAuthHeaders(),
      },
      body: JSON.stringify({ bundle, settings }),
    })
  } catch (error) {
    if (isStaticPreviewHost()) return { reply: createBrowserDemoReply(bundle) }
    throw error
  }

  if (!response.ok) {
    if (response.status === 404 && isStaticPreviewHost()) return { reply: createBrowserDemoReply(bundle) }
    const detail = await readChatError(response)
    throw new Error(formatChatError(response.status, detail))
  }

  const data = await response.json()
  return {
    reply: String(data.reply ?? ''),
    agent: data.agent,
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  if (!configuredUrl) return ''
  return stripTrailingSlash(configuredUrl)
}

function getChatAuthHeaders(): Record<string, string> {
  const token = getSavedCloudToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function readChatError(response: Response): Promise<string> {
  const detail = await response.text()
  if (!detail) return ''

  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string }
    return parsed.error || parsed.message || detail
  } catch {
    return detail
  }
}

function formatChatError(status: number, detail: string): string {
  if (status === 401) return detail || '模型代理拒绝访问。以后开启登录后，需要重新登录。'
  if (status === 404) return detail || '模型代理入口没有找到'
  if (status === 502) return detail || '模型供应商暂时没有接住请求'
  if (status >= 500) return detail || `模型代理服务异常：${status}`
  return detail || '聊天请求失败'
}

function isStaticPreviewHost(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.endsWith('github.io') && !getApiBaseUrl()
}

function createBrowserDemoReply(bundle: PromptBundle): string {
  const lastUserMessage = [...bundle.messages].reverse().find((message) => message.role === 'user')
  const memoryHint = bundle.contextBlocks
    .map((block) => block.title)
    .slice(0, 3)
    .join(' / ')

  return [
    '这是 GitHub Pages 静态预览模式：页面、角色、记忆和三端适配都能体验，但还没有连接云端模型后端。',
    lastUserMessage ? `妹妹刚才说：${lastUserMessage.content}` : '妹妹可以先随便发一句话试试界面。',
    memoryHint ? `本轮准备调用的记忆：${memoryHint}` : '这轮没有命中长期记忆。',
    '要让手机也真正调用模型，需要把云服务器配置成安全后端，再用 VITE_API_BASE_URL 指向它。',
  ].join('\n\n')
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
