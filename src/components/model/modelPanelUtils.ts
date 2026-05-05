import type { ModelProfileInput, ModelProfileSummary, ModelProviderKind } from '../../domain/types'
import { modelProviderPresets, type ModelProviderPreset } from '../../services/modelProfiles'

export const serverEnvProfileId = 'server-env'

export const providerKindLabels: Record<ModelProviderKind, string> = {
  'openai-compatible': 'OpenAI 兼容',
  anthropic: 'Anthropic',
  'google-gemini': 'Gemini',
}

export function isServerEnvProfileId(profileId?: string): boolean {
  return profileId === serverEnvProfileId
}

export function createDraftFromPreset(preset: ModelProviderPreset): ModelProfileInput {
  return {
    name: undefined,
    kind: preset.kind,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: '',
    enabled: true,
    isDefault: true,
  }
}

export function findPresetForProfile(profile: ModelProfileSummary): ModelProviderPreset {
  return (
    modelProviderPresets.find(
      (preset) => preset.kind === profile.kind && stripTrailingSlash(preset.baseUrl) === stripTrailingSlash(profile.baseUrl),
    ) ??
    modelProviderPresets.find((preset) => preset.id === 'custom') ??
    modelProviderPresets[0]
  )
}

export function buildProfileName(profile: ModelProfileInput): string {
  if (profile.name?.trim()) return profile.name.trim()

  const host = getHostLabel(profile.baseUrl)
  if (host && profile.model) return `${host} / ${profile.model}`
  if (host) return `${host} / ${providerKindLabels[profile.kind]}`
  return profile.model || '我的模型配置'
}

function getHostLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^api\./, '').replace(/^www\./, '')
  } catch {
    return ''
  }
}

function stripTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '')
}
