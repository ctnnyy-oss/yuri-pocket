import {
  CheckCircle2,
  KeyRound,
  Link2,
  PlugZap,
  RefreshCw,
  Save,
  ServerCog,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppSettings, ModelProfileInput, ModelProfileSummary, ModelProviderKind } from '../../domain/types'
import { modelProviderPresets } from '../../services/modelProfiles'
import { WorkspaceTitle } from '../memory/atoms'

interface ModelAndDataPanelProps {
  settings: AppSettings
  onUpdateSettings: (settings: AppSettings) => void
  modelProfiles: ModelProfileSummary[]
  modelProfileStatus: string
  modelProfileBusy: boolean
  cloudSyncConfigured: boolean
  onConnectCloud: () => void
  onRefreshModelProfiles: () => void
  onSaveModelProfile: (profile: ModelProfileInput) => Promise<void>
  onDeleteModelProfile: (profileId: string) => Promise<void>
  onTestModelProfile: (input: { profileId?: string; profile?: ModelProfileInput }) => Promise<void>
}

const providerKindLabels: Record<ModelProviderKind, string> = {
  'openai-compatible': 'OpenAI 兼容',
  anthropic: 'Anthropic',
  'google-gemini': 'Gemini',
}

export function ModelAndDataPanel({
  settings,
  onUpdateSettings,
  modelProfiles,
  modelProfileStatus,
  modelProfileBusy,
  cloudSyncConfigured,
  onConnectCloud,
  onRefreshModelProfiles,
  onSaveModelProfile,
  onDeleteModelProfile,
  onTestModelProfile,
}: ModelAndDataPanelProps) {
  const activeProfile =
    modelProfiles.find((profile) => profile.id === settings.modelProfileId) ??
    modelProfiles.find((profile) => profile.isDefault) ??
    modelProfiles[0]
  const [selectedPresetId, setSelectedPresetId] = useState(modelProviderPresets[0].id)
  const [draft, setDraft] = useState<ModelProfileInput>(() => createDraftFromPreset(modelProviderPresets[0]))
  const savedEditableProfiles = useMemo(
    () => modelProfiles.filter((profile) => profile.id !== 'server-env'),
    [modelProfiles],
  )
  const modelCloudEnabled = settings.dataStorageMode === 'cloud' && cloudSyncConfigured
  const modelCloudStatus =
    settings.dataStorageMode === 'local'
      ? '当前是仅本地模式，不会提交 API Key 到云端。需要密钥保险箱时，先到设置里切回云端同步。'
      : modelProfileStatus

  function loadProfileIntoDraft(profile: ModelProfileSummary) {
    setDraft({
      id: profile.id === 'server-env' ? undefined : profile.id,
      name: profile.id === 'server-env' ? '我的模型配置' : profile.name,
      kind: profile.kind,
      baseUrl: profile.baseUrl,
      model: profile.model === '由页面模型栏决定' ? settings.model : profile.model,
      apiKey: '',
      enabled: profile.enabled,
      isDefault: profile.isDefault,
    })
  }

  function handlePresetChange(presetId: string) {
    setSelectedPresetId(presetId)
    const preset = modelProviderPresets.find((item) => item.id === presetId) ?? modelProviderPresets[0]
    setDraft(createDraftFromPreset(preset))
  }

  async function handleSaveProfile() {
    await onSaveModelProfile({ ...draft, isDefault: true, enabled: true })
  }

  async function handleTestDraft() {
    await onTestModelProfile({ profile: draft })
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
        description="只管理模型接入、密钥保险箱和生成参数；备份、导入导出这些数据工具不再挤在这里。"
        icon={<SlidersHorizontal size={20} />}
        title="模型接入"
      />

      <section className="settings-stack model-settings-stack model-connect-stack">
        <section className="settings-section model-hero-section">
          <div className="settings-section-title">
            <ServerCog size={18} />
            <span>当前连接</span>
          </div>
          <p className="section-note">
            {activeProfile ? `正在使用：${activeProfile.name} / ${activeProfile.model}` : '还没有选择模型配置。'}
          </p>
          <div className="model-status-grid">
            <span>
              <strong>密钥保险箱</strong>
              {savedEditableProfiles.length > 0 ? `${savedEditableProfiles.length} 组配置` : '等待添加'}
            </span>
            <span>
              <strong>接口类型</strong>
              {activeProfile ? providerKindLabels[activeProfile.kind] : '未选择'}
            </span>
            <span>
              <strong>默认模型</strong>
              {settings.model || '未设置'}
            </span>
          </div>
          <small className="cloud-status-line">{modelCloudStatus}</small>
          <small className="model-warning">
            API Key 只用于提交到云端保险箱，前端不会把已保存的密钥原文展示回来。后续服务器侧加固可以单独做。
          </small>
          <div className="settings-actions">
            <button disabled={!modelCloudEnabled || modelProfileBusy} onClick={onConnectCloud} type="button">
              <Link2 size={15} />
              检查连接
            </button>
            <button disabled={!modelCloudEnabled || modelProfileBusy} onClick={onRefreshModelProfiles} type="button">
              <RefreshCw size={15} />
              刷新模型
            </button>
            <button
              disabled={!modelCloudEnabled || !activeProfile || !activeProfile.hasApiKey || modelProfileBusy}
              onClick={() => activeProfile && onTestModelProfile({ profileId: activeProfile.id })}
              type="button"
            >
              <PlugZap size={15} />
              测试当前
            </button>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-title">
            <KeyRound size={18} />
            <span>新增或编辑模型</span>
          </div>
          <label>
            <span>供应商模板</span>
            <select value={selectedPresetId} onChange={(event) => handlePresetChange(event.target.value)}>
              {modelProviderPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <small>{modelProviderPresets.find((preset) => preset.id === selectedPresetId)?.description}</small>
          </label>
          <div className="model-form-grid">
            <label>
              <span>显示名称</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label>
              <span>接口类型</span>
              <select
                value={draft.kind}
                onChange={(event) => setDraft({ ...draft, kind: event.target.value as ModelProviderKind })}
              >
                <option value="openai-compatible">OpenAI 兼容</option>
                <option value="anthropic">Anthropic 官方</option>
                <option value="google-gemini">Gemini 官方</option>
              </select>
            </label>
          </div>
          <label>
            <span>Base URL</span>
            <input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
          </label>
          <label>
            <span>模型 ID</span>
            <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
          </label>
          <label>
            <span>API Key</span>
            <input
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
              placeholder={draft.id ? '留空则继续使用云端原密钥' : '只会发送到云端保险箱'}
              type="password"
              value={draft.apiKey ?? ''}
            />
          </label>
          <div className="settings-actions">
            <button disabled={!modelCloudEnabled || modelProfileBusy} onClick={handleSaveProfile} type="button">
              <Save size={15} />
              保存并启用
            </button>
            <button disabled={!modelCloudEnabled || modelProfileBusy} onClick={handleTestDraft} type="button">
              <PlugZap size={15} />
              测试草稿
            </button>
          </div>
          {!modelCloudEnabled && (
            <small className="model-empty-note">
              {settings.dataStorageMode === 'local'
                ? '仅本地模式会保留当前生成参数，但不会上传或测试 API Key。'
                : '云端后端配置完成后，保存和测试按钮会自动启用。'}
            </small>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section-title">
            <CheckCircle2 size={18} />
            <span>已保存模型</span>
          </div>
          <div className="model-profile-list">
            {modelProfiles.length === 0 ? (
              <small className="model-empty-note">还没有保存模型。先填上方表单，再点保存并启用。</small>
            ) : (
              modelProfiles.map((profile) => (
                <article
                  className={`model-profile-item ${profile.id === settings.modelProfileId ? 'active' : ''}`}
                  key={profile.id}
                >
                  <div>
                    <strong>{profile.name}</strong>
                    <span>
                      {providerKindLabels[profile.kind]} / {profile.model}
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
                          if (window.confirm(`删除“${profile.name}”这组模型配置吗？云端保存的密钥也会一起删除。`)) {
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
        </section>

        <section className="settings-section">
          <div className="settings-section-title">
            <SlidersHorizontal size={18} />
            <span>生成参数</span>
          </div>
          <div className="model-form-grid">
            <label>
              <span>温柔度</span>
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
          </div>
        </section>
      </section>
    </>
  )
}

function createDraftFromPreset(preset: (typeof modelProviderPresets)[number]): ModelProfileInput {
  return {
    name: preset.label,
    kind: preset.kind,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: '',
    enabled: true,
    isDefault: true,
  }
}
