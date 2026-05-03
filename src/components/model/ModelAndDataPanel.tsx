import {
  CheckCircle2,
  KeyRound,
  Link2,
  PlugZap,
  Save,
  ServerCog,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, ModelProfileInput, ModelProfileSummary, ModelProviderKind } from '../../domain/types'
import { modelProviderPresets, type ModelCatalogItem, type ModelCatalogResult } from '../../services/modelProfiles'
import { WorkspaceTitle } from '../memory/atoms'

interface ModelAndDataPanelProps {
  settings: AppSettings
  onUpdateSettings: (settings: AppSettings) => void
  modelProfiles: ModelProfileSummary[]
  modelProfileStatus: string
  modelProfileBusy: boolean
  cloudSyncConfigured: boolean
  onConnectCloud: () => void
  onSaveModelProfile: (profile: ModelProfileInput) => Promise<void>
  onDeleteModelProfile: (profileId: string) => Promise<void>
  onFetchModelCatalog: (input: { profileId?: string; profile?: ModelProfileInput }) => Promise<ModelCatalogResult>
  onTestModelProfile: (input: { profileId?: string; profile?: ModelProfileInput }) => Promise<void>
}

const providerKindLabels: Record<ModelProviderKind, string> = {
  'openai-compatible': 'OpenAI 兼容',
  anthropic: 'Anthropic',
  'google-gemini': 'Gemini',
}

const presetGroupLabels = {
  official: '官方接口',
  custom: '中转站/自定义',
} as const

export function ModelAndDataPanel({
  settings,
  onUpdateSettings,
  modelProfiles,
  modelProfileStatus,
  modelProfileBusy,
  cloudSyncConfigured,
  onConnectCloud,
  onSaveModelProfile,
  onDeleteModelProfile,
  onFetchModelCatalog,
  onTestModelProfile,
}: ModelAndDataPanelProps) {
  const activeProfile =
    modelProfiles.find((profile) => profile.id === settings.modelProfileId) ??
    modelProfiles.find((profile) => profile.isDefault) ??
    modelProfiles[0]
  const firstOfficialPreset = modelProviderPresets.find((preset) => preset.group === 'official') ?? modelProviderPresets[0]
  const [presetGroup, setPresetGroup] = useState<'official' | 'custom'>('official')
  const [selectedPresetId, setSelectedPresetId] = useState(firstOfficialPreset.id)
  const [draft, setDraft] = useState<ModelProfileInput>(() => createDraftFromPreset(firstOfficialPreset))
  const [catalogModels, setCatalogModels] = useState<ModelCatalogItem[]>([])
  const [catalogStatus, setCatalogStatus] = useState('')
  const autoFetchKeyRef = useRef('')

  const visiblePresets = useMemo(
    () => modelProviderPresets.filter((preset) => preset.group === presetGroup),
    [presetGroup],
  )
  const modelBackendEnabled = settings.dataStorageMode === 'cloud'
  const modelBackendHint = cloudSyncConfigured ? '远端模型后端' : '本机 /api 模型后端'
  const modelStatusText =
    settings.dataStorageMode === 'local'
      ? '当前是仅本地数据模式，不会把 API Key 发给模型后端。'
      : modelProfileStatus
  const modelOptions = useMemo(() => {
    const options = catalogModels.filter((model) => model.id.trim())
    if (draft.model && !options.some((model) => model.id === draft.model)) {
      return [{ id: draft.model, label: draft.model }, ...options]
    }
    return options
  }, [catalogModels, draft.model])

  useEffect(() => {
    const baseUrl = draft.baseUrl.trim()
    const apiKey = (draft.apiKey ?? '').trim()
    if (!modelBackendEnabled || modelProfileBusy || !baseUrl || (!apiKey && !draft.id)) return

    const fetchKey = `${draft.kind}|${baseUrl}|${apiKey ? apiKey.slice(0, 12) : `saved:${draft.id}`}`
    if (autoFetchKeyRef.current === fetchKey) return

    const timer = window.setTimeout(async () => {
      autoFetchKeyRef.current = fetchKey
      setCatalogStatus('正在自动拉取模型...')

      try {
        const result = await onFetchModelCatalog({ profile: { ...draft, baseUrl, name: buildProfileName(draft) } })
        setCatalogModels(result.models)
        setCatalogStatus(`已自动拉取 ${result.models.length} 个模型`)

        if (result.models[0]?.id) {
          setDraft((currentDraft) => {
            const currentStillExists = result.models.some((model) => model.id === currentDraft.model)
            return currentDraft.model && currentStillExists ? currentDraft : { ...currentDraft, model: result.models[0].id }
          })
        }
      } catch (error) {
        setCatalogStatus(error instanceof Error ? error.message : '自动拉取模型失败，修改 URL 或 API Key 后会重试。')
      }
    }, 900)

    return () => window.clearTimeout(timer)
  }, [draft, modelBackendEnabled, modelProfileBusy, onFetchModelCatalog])

  function resetCatalog() {
    setCatalogModels([])
    setCatalogStatus('')
  }

  function loadProfileIntoDraft(profile: ModelProfileSummary) {
    setDraft({
      id: profile.id === 'server-env' ? undefined : profile.id,
      name: profile.id === 'server-env' ? undefined : profile.name,
      kind: profile.kind,
      baseUrl: profile.baseUrl,
      model: profile.model === '由页面模型栏决定' ? settings.model : profile.model,
      apiKey: '',
      enabled: profile.enabled,
      isDefault: profile.isDefault,
    })
    resetCatalog()
  }

  function handlePresetGroupChange(nextGroup: 'official' | 'custom') {
    setPresetGroup(nextGroup)
    const preset = modelProviderPresets.find((item) => item.group === nextGroup) ?? modelProviderPresets[0]
    setSelectedPresetId(preset.id)
    setDraft(createDraftFromPreset(preset))
    resetCatalog()
  }

  function handlePresetChange(presetId: string) {
    setSelectedPresetId(presetId)
    const preset = modelProviderPresets.find((item) => item.id === presetId) ?? modelProviderPresets[0]
    setDraft(createDraftFromPreset(preset))
    resetCatalog()
  }

  async function handleSaveProfile() {
    await onSaveModelProfile({ ...draft, name: buildProfileName(draft), isDefault: true, enabled: true })
  }

  async function handleTestDraft() {
    await onTestModelProfile({ profile: { ...draft, name: buildProfileName(draft) } })
  }

  function handleUseProfile(profile: ModelProfileSummary) {
    onUpdateSettings({
      ...settings,
      modelProfileId: profile.id,
      model: profile.model === '由页面模型栏决定' ? settings.model : profile.model,
    })
  }

  return (
    <>
      <WorkspaceTitle
        description="选择官方接口或中转站，填 Base URL 和 API Key 后会自动拉取模型列表。"
        icon={<SlidersHorizontal size={20} />}
        title="模型接入"
      />

      <section className="settings-stack model-settings-stack model-connect-stack">
        <section className="model-current-strip" aria-label="当前模型状态">
          <div>
            <small>当前模型</small>
            <strong>{activeProfile ? activeProfile.model : settings.model || '未设置'}</strong>
            <span>{activeProfile ? `${providerKindLabels[activeProfile.kind]} / ${activeProfile.baseUrl}` : modelBackendHint}</span>
          </div>
          <div className="model-current-actions">
            <button disabled={!modelBackendEnabled || modelProfileBusy} onClick={onConnectCloud} type="button">
              <Link2 size={15} />
              检查
            </button>
            <button
              disabled={!modelBackendEnabled || !activeProfile || !activeProfile.hasApiKey || modelProfileBusy}
              onClick={() => activeProfile && onTestModelProfile({ profileId: activeProfile.id })}
              type="button"
            >
              <PlugZap size={15} />
              测试
            </button>
          </div>
        </section>

        <div className="model-layout">
          <section className="settings-section model-column">
            <div className="settings-section-title">
              <KeyRound size={18} />
              <span>新增或编辑模型</span>
            </div>

            <div className="model-segmented" role="tablist" aria-label="模型来源">
              {Object.entries(presetGroupLabels).map(([group, label]) => (
                <button
                  className={presetGroup === group ? 'active' : ''}
                  key={group}
                  onClick={() => handlePresetGroupChange(group as 'official' | 'custom')}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            <label>
              <span>{presetGroup === 'official' ? '官方供应商' : '中转站模板'}</span>
              <select value={selectedPresetId} onChange={(event) => handlePresetChange(event.target.value)}>
                {visiblePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <small>{modelProviderPresets.find((preset) => preset.id === selectedPresetId)?.description}</small>
            </label>

            <div className="model-form-grid">
              <label>
                <span>接口类型</span>
                <select
                  value={draft.kind}
                  onChange={(event) => {
                    setDraft({ ...draft, kind: event.target.value as ModelProviderKind })
                    resetCatalog()
                  }}
                >
                  <option value="openai-compatible">OpenAI 兼容</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google-gemini">Gemini</option>
                </select>
              </label>
              <label>
                <span>Base URL</span>
                <input
                  autoComplete="off"
                  placeholder="https://example.com/v1"
                  value={draft.baseUrl}
                  onChange={(event) => {
                    setDraft({ ...draft, baseUrl: event.target.value })
                    resetCatalog()
                  }}
                />
              </label>
            </div>

            <label>
              <span>API Key</span>
              <input
                autoComplete="off"
                onChange={(event) => {
                  setDraft({ ...draft, apiKey: event.target.value })
                  resetCatalog()
                }}
                placeholder={draft.id ? '留空则继续使用已保存密钥' : '填入供应商或中转站密钥'}
                type="password"
                value={draft.apiKey ?? ''}
              />
            </label>

            <div className="model-picker-row">
              <label>
                <span>模型</span>
                {modelOptions.length > 0 ? (
                  <select value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })}>
                    {modelOptions.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label && model.label !== model.id ? `${model.label} / ${model.id}` : model.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input autoComplete="off" placeholder="填好 URL 和 API Key 后自动加载" readOnly value={draft.model || ''} />
                )}
              </label>
            </div>

            <small className="cloud-status-line">{catalogStatus || modelStatusText}</small>
            <small className="model-warning">
              模型会在 URL 和 API Key 可用后自动拉取；页面不会要求填写“显示名称”，也不会回显已保存密钥原文。
            </small>

            <div className="settings-actions">
              <button disabled={!modelBackendEnabled || modelProfileBusy || !draft.baseUrl || !draft.model} onClick={handleSaveProfile} type="button">
                <Save size={15} />
                保存并启用
              </button>
              <button disabled={!modelBackendEnabled || modelProfileBusy || !draft.baseUrl || !draft.model} onClick={handleTestDraft} type="button">
                <PlugZap size={15} />
                测试草稿
              </button>
            </div>
          </section>

          <section className="settings-section model-column">
            <div className="settings-section-title">
              <CheckCircle2 size={18} />
              <span>已保存模型</span>
            </div>
            <div className="model-profile-list">
              {modelProfiles.length === 0 ? (
                <small className="model-empty-note">还没有保存模型。填好 URL 和 API Key 后会自动加载模型。</small>
              ) : (
                modelProfiles.map((profile) => (
                  <article
                    className={`model-profile-item ${profile.id === settings.modelProfileId ? 'active' : ''}`}
                    key={profile.id}
                  >
                    <div>
                      <strong>{profile.model}</strong>
                      <span>
                        {providerKindLabels[profile.kind]} / {profile.name}
                      </span>
                      <small>
                        {profile.baseUrl} / {profile.hasApiKey ? '已保存密钥' : '没有密钥'}
                      </small>
                    </div>
                    <div className="backup-actions">
                      <button onClick={() => handleUseProfile(profile)} type="button">
                        使用
                      </button>
                      <button onClick={() => loadProfileIntoDraft(profile)} type="button">
                        编辑
                      </button>
                      <button
                        disabled={!profile.hasApiKey}
                        onClick={() => onTestModelProfile({ profileId: profile.id })}
                        type="button"
                      >
                        测试
                      </button>
                      {profile.id !== 'server-env' && (
                        <button
                          className="danger-button"
                          onClick={() => {
                            if (window.confirm(`删除“${profile.model}”这组模型配置吗？云端保存的密钥也会一起删除。`)) {
                              void onDeleteModelProfile(profile.id)
                            }
                          }}
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="settings-section-title">
              <ServerCog size={18} />
              <span>生成参数</span>
            </div>
            <div className="model-form-grid">
              <label>
                <span>温度</span>
                <input
                  max="2"
                  min="0"
                  onChange={(event) => onUpdateSettings({ ...settings, temperature: Number(event.target.value) })}
                  step="0.1"
                  type="number"
                  value={settings.temperature}
                />
              </label>
              <label>
                <span>回复上限</span>
                <input
                  max="65536"
                  min="256"
                  onChange={(event) => onUpdateSettings({ ...settings, maxOutputTokens: Number(event.target.value) })}
                  step="256"
                  type="number"
                  value={settings.maxOutputTokens}
                />
              </label>
              <label>
                <span>短期记忆</span>
                <input
                  max="60"
                  min="4"
                  onChange={(event) => onUpdateSettings({ ...settings, maxContextMessages: Number(event.target.value) })}
                  step="1"
                  type="number"
                  value={settings.maxContextMessages}
                />
              </label>
            </div>
          </section>
        </div>
      </section>
    </>
  )
}

function createDraftFromPreset(preset: (typeof modelProviderPresets)[number]): ModelProfileInput {
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

function buildProfileName(profile: ModelProfileInput): string {
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
