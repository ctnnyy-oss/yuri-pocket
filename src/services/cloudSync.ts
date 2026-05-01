import type { AppState } from '../domain/types'

const cloudTokenStorageKey = 'yuri-pocket-cloud-token'

export interface CloudSnapshot {
  state: AppState | null
  updatedAt: string | null
  revision: number
}

export function isCloudSyncConfigured(): boolean {
  return Boolean(getApiBaseUrl())
}

export function getSavedCloudToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(cloudTokenStorageKey) ?? ''
}

export function saveCloudToken(token: string): void {
  if (typeof window === 'undefined') return
  const cleanedToken = token.trim()
  if (cleanedToken) {
    window.localStorage.setItem(cloudTokenStorageKey, cleanedToken)
  } else {
    window.localStorage.removeItem(cloudTokenStorageKey)
  }
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
    const detail = await response.text()
    throw new Error(detail || `云端请求失败：${response.status}`)
  }

  return response
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  if (!configuredUrl) return ''
  return configuredUrl.replace(/\/+$/, '')
}
