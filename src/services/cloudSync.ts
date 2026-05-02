import { storageConfig } from '../config/storage'
import type { AppState } from '../domain/types'

export interface CloudMetadata {
  hasState: boolean
  updatedAt: string | null
  revision: number
}

export interface CloudSnapshot extends CloudMetadata {
  state: AppState | null
}

export function isCloudSyncConfigured(): boolean {
  return Boolean(getApiBaseUrl())
}

export function getSavedCloudToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(storageConfig.cloudTokenStorageKey) ?? ''
}

export function saveCloudToken(token: string): void {
  if (typeof window === 'undefined') return
  const cleanedToken = token.trim()
  if (cleanedToken) {
    window.localStorage.setItem(storageConfig.cloudTokenStorageKey, cleanedToken)
  } else {
    window.localStorage.removeItem(storageConfig.cloudTokenStorageKey)
  }
}

export async function checkCloudHealth(token: string): Promise<CloudMetadata> {
  const response = await cloudFetch('/api/cloud/health', token)
  return response.json()
}

export async function pullCloudState(token: string): Promise<CloudSnapshot> {
  const response = await cloudFetch('/api/cloud/state', token)
  return response.json()
}

export async function pushCloudState(state: AppState, token: string): Promise<Pick<CloudSnapshot, 'updatedAt' | 'revision'>> {
  const response = await cloudFetch('/api/cloud/state', token, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state }),
  })
  return response.json()
}

async function cloudFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) throw new Error('云端后端还没有配置')
  if (!token.trim()) throw new Error('还没有填写云端口令')

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token.trim()}`,
    },
  })

  if (!response.ok) {
    const detail = await readCloudError(response)
    throw new Error(formatCloudError(response.status, detail))
  }

  return response
}

async function readCloudError(response: Response): Promise<string> {
  const detail = await response.text()
  if (!detail) return ''

  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string }
    return parsed.error || parsed.message || detail
  } catch {
    return detail
  }
}

function formatCloudError(status: number, detail: string): string {
  if (status === 401) return '云端口令不对，或者服务器口令已经更换'
  if (status === 503) return '云端同步还没有在服务器启用'
  if (status >= 500) return `云端服务暂时没接住：${detail || status}`
  return detail || `云端请求失败：${status}`
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  if (!configuredUrl) return ''
  return configuredUrl.replace(/\/+$/, '')
}
