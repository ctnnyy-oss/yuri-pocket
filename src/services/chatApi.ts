import type { AppSettings, PromptBundle } from '../domain/types'

export async function requestAssistantReply(bundle: PromptBundle, settings: AppSettings): Promise<string> {
  let response: Response

  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bundle, settings }),
    })
  } catch (error) {
    if (isStaticPreviewHost()) return createBrowserDemoReply(bundle)
    throw error
  }

  if (!response.ok) {
    if (response.status === 404 && isStaticPreviewHost()) return createBrowserDemoReply(bundle)
    const detail = await response.text()
    throw new Error(detail || '聊天请求失败')
  }

  const data = await response.json()
  return data.reply
}

function isStaticPreviewHost(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.endsWith('github.io')
}

function createBrowserDemoReply(bundle: PromptBundle): string {
  const lastUserMessage = [...bundle.messages].reverse().find((message) => message.role === 'user')
  const memoryHint = bundle.contextBlocks
    .map((block) => block.title)
    .slice(0, 3)
    .join(' / ')

  return [
    '这是 GitHub Pages 静态预览模式：页面、角色、记忆和三端适配都能体验，但不会连接妹妹本机的模型密钥。',
    lastUserMessage ? `妹妹刚才说：${lastUserMessage.content}` : '妹妹可以先随便发一句话试试界面。',
    memoryHint ? `本轮准备调用的记忆：${memoryHint}` : '这轮没有命中长期记忆。',
    '要真正调用 DeepSeek V4 Free，还是打开电脑本机的开发版，它会走本机中转，不会把密钥放到网页上。',
  ].join('\n\n')
}
