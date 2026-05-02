import {
  ArchiveRestore,
  CheckCircle2,
  Database,
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
import type { AppSettings, LocalBackupSummary, ModelProfileInput, ModelProfileSummary, ModelProviderKind } from '../../domain/types'
import type { CloudBackupSummary, CloudMetadata } from '../../services/cloudSync'
import { modelProviderPresets } from '../../services/modelProfiles'
import { WorkspaceTitle } from '../memory/atoms'
import {
  formatBackupCounts,
  formatBytes,
  formatCloudTime,
  formatShortTime,
  getCloudBusyLabel,
} from '../memory/memoryPanelUtils'

interface ModelAndDataPanelProps {
  settings: AppSettings
  onUpdateSettings: (settings: AppSettings) => void
  modelProfiles: ModelProfileSummary[]
  modelProfileStatus: string
  modelProfileBusy: boolean
  onRefreshModelProfiles: () => void
  onSaveModelProfile: (profile: ModelProfileInput) => Promise<void>
  onDeleteModelProfile: (profileId: string) => Promise<void>
  onTestModelProfile: (input: { profileId?: string; profile?: ModelProfileInput }) => Promise<void>
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
  cloudStatus: string
  cloudMeta: CloudMetadata | null
  cloudBusy: 'checking' | 'pulling' | 'pushing' | 'backing-up' | null
  cloudBackups: CloudBackupSummary[]
  cloudSyncConfigured: boolean
  onConnectCloud: () => void
  onPullCloud: () => void
  onPushCloud: () => void
  onRefreshCloud: () => void
  onCreateCloudBackup: () => void
  onDownloadCloudBackup: (fileName: string) => void
  onRefreshCloudBackups: () => void
  localBackups: LocalBackupSummary[]
  onCreateLocalBackup: () => void
  onRestoreLocalBackup: (backupId: string) => void
  onDeleteLocalBackup: (backupId: string) => void
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
  onRefreshModelProfiles,
  onSaveModelProfile,
  onDeleteModelProfile,
  onTestModelProfile,
  onExport,
  onImport,
  onReset,
  cloudStatus,
  cloudMeta,
  cloudBusy,
  cloudBackups,
  cloudSyncConfigured,
  onConnectCloud,
  onPullCloud,
  onPushCloud,
  onRefreshCloud,
  onCreateCloudBackup,
  onDownloadCloudBackup,
  onRefreshCloudBackups,
  localBackups,
  onCreateLocalBackup,
  onRestoreLocalBackup,
  onDeleteLocalBackup,
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
        description="妹妹单人使用阶段默认直连服务器，聊天、记忆、设置和模型配置都会自动同步到云端。"
        icon={<SlidersHorizontal size={20} />}
        title="模型与数据"
      />

      <section className="settings-stack model-settings-stack">
        <div className="model-layout">
          <div className="model-column">
            <section className="settings-section model-hero-section">
              <div className="settings-section-title">
                <ServerCog size={18} />
                <span>模型连接</span>
              </div>
              <p className="section-note">
                当前使用：{activeProfile ? `${activeProfile.name} / ${activeProfile.model}` : '还没有选择模型配置'}
              </p>
              <div className="model-status-grid">
                <span>
                  <strong>云端同步</strong>
                  自动直连
                </span>
                <span>
                  <strong>密钥保险箱</strong>
                  {savedEditableProfiles.length > 0 ? `${savedEditableProfiles.length} 组配置` : '等待添加'}
                </span>
                <span>
                  <strong>接口类型</strong>
                  {activeProfile ? providerKindLabels[activeProfile.kind] : '未选择'}
                </span>
              </div>
              <small className="cloud-status-line">{modelProfileStatus}</small>
              <small className="model-warning">当前按妹妹单人使用处理：聊天、记忆、设置和模型配置都会直接走服务器。公开多人版再加登录注册。</small>
              <div className="settings-actions">
                <button disabled={!cloudSyncConfigured || modelProfileBusy} onClick={onConnectCloud} type="button">
                  <Link2 size={15} />
                  检查连接
                </button>
                <button
                  disabled={!cloudSyncConfigured || modelProfileBusy}
                  onClick={onRefreshModelProfiles}
                  type="button"
                >
                  <RefreshCw size={15} />
                  刷新模型
                </button>
                <button
                  disabled={!activeProfile || !activeProfile.hasApiKey || modelProfileBusy}
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
                  placeholder={draft.id ? '留空则继续使用服务器里原来的密钥' : '只会发送到云端保险箱'}
                  type="password"
                  value={draft.apiKey ?? ''}
                  onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                />
              </label>
              <div className="settings-actions">
                <button disabled={modelProfileBusy} onClick={handleSaveProfile} type="button">
                  <Save size={15} />
                  保存并启用
                </button>
                <button disabled={modelProfileBusy} onClick={handleTestDraft} type="button">
                  <PlugZap size={15} />
                  测试草稿
                </button>
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section-title">
                <CheckCircle2 size={18} />
                <span>已保存模型</span>
              </div>
              <div className="model-profile-list">
                {modelProfiles.map((profile) => (
                  <article className={`model-profile-item ${profile.id === settings.modelProfileId ? 'active' : ''}`} key={profile.id}>
                    <div>
                      <strong>{profile.name}</strong>
                      <span>
                        {providerKindLabels[profile.kind]} / {profile.model}
                      </span>
                      <small>
                        {profile.baseUrl} · {profile.hasApiKey ? '已保存密钥' : '没有密钥'}
                      </small>
                    </div>
                    <div className="backup-actions">
                      <button onClick={() => handleUseProfile(profile)} type="button">
                        使用
                      </button>
                      <button onClick={() => loadProfileIntoDraft(profile)} type="button">
                        编辑
                      </button>
                      <button disabled={!profile.hasApiKey} onClick={() => onTestModelProfile({ profileId: profile.id })} type="button">
                        测试
                      </button>
                      {profile.id !== 'server-env' && (
                        <button
                          className="danger-button"
                          onClick={() => {
                            if (window.confirm(`删除“${profile.name}”这组模型配置吗？服务器里保存的密钥也会一起删除。`)) {
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
                ))}
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
                    step="0.1"
                    type="number"
                    value={settings.temperature}
                    onChange={(event) => onUpdateSettings({ ...settings, temperature: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>短期记忆</span>
                  <input
                    max="60"
                    min="4"
                    step="1"
                    type="number"
                    value={settings.maxContextMessages}
                    onChange={(event) => onUpdateSettings({ ...settings, maxContextMessages: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>回复上限</span>
                  <input
                    max="65536"
                    min="256"
                    step="256"
                    type="number"
                    value={settings.maxOutputTokens}
                    onChange={(event) => onUpdateSettings({ ...settings, maxOutputTokens: Number(event.target.value) })}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="model-column">
            <section className="settings-section">
              <div className="settings-section-title">
                <Database size={18} />
                <span>云端同步</span>
              </div>
              <p className="section-note">
                {cloudSyncConfigured
                  ? '云端后端已配置，会自动保存和读取。'
                  : '当前构建还没有配置云端后端地址。'}
              </p>
              <div className="cloud-meta-strip" aria-label="云端同步状态">
                <span>
                  <strong>版本</strong>
                  {cloudMeta ? `v${cloudMeta.revision}` : '未检查'}
                </span>
                <span>
                  <strong>最后保存</strong>
                  {cloudMeta ? formatCloudTime(cloudMeta.updatedAt) : '未检查'}
                </span>
                <span>
                  <strong>云端数据</strong>
                  {cloudMeta ? (cloudMeta.hasState ? '已有快照' : '空') : '未检查'}
                </span>
              </div>
              <small className="cloud-status-line">{cloudBusy ? getCloudBusyLabel(cloudBusy) : cloudStatus}</small>
              <div className="settings-actions">
                <button disabled={!cloudSyncConfigured || Boolean(cloudBusy)} onClick={onConnectCloud} type="button">
                  <Link2 size={15} />
                  检查连接
                </button>
                <button
                  disabled={!cloudSyncConfigured || Boolean(cloudBusy)}
                  onClick={onRefreshCloud}
                  type="button"
                >
                  <RefreshCw size={15} />
                  检查云端
                </button>
                <button
                  disabled={!cloudSyncConfigured || Boolean(cloudBusy)}
                  onClick={onPushCloud}
                  type="button"
                >
                  <Save size={15} />
                  {cloudBusy === 'pushing' ? '保存中' : '保存到云端'}
                </button>
                <button
                  disabled={!cloudSyncConfigured || Boolean(cloudBusy)}
                  onClick={onPullCloud}
                  type="button"
                >
                  <RefreshCw size={15} />
                  {cloudBusy === 'pulling' ? '读取中' : '从云端读取'}
                </button>
              </div>
              <div className="cloud-backup-panel">
                <div className="cloud-backup-head">
                  <div>
                    <strong>云端保险箱</strong>
                    <span>服务器会在每次覆盖云端快照前自动留一份 SQLite 备份，也可以手动创建。</span>
                  </div>
                  <div className="settings-actions compact-actions">
                    <button
                      disabled={!cloudSyncConfigured || Boolean(cloudBusy)}
                      onClick={onCreateCloudBackup}
                      type="button"
                    >
                      <Save size={15} />
                      {cloudBusy === 'backing-up' ? '备份中' : '创建备份'}
                    </button>
                    <button
                      disabled={!cloudSyncConfigured || Boolean(cloudBusy)}
                      onClick={onRefreshCloudBackups}
                      type="button"
                    >
                      <RefreshCw size={15} />
                      刷新备份
                    </button>
                  </div>
                </div>
                <div className="backup-list">
                  {cloudBackups.length === 0 ? (
                    <small>还没有读取到云端备份。保存云端或手动创建后，这里会出现下载入口。</small>
                  ) : (
                    cloudBackups.slice(0, 5).map((backup) => (
                      <article className="backup-item" key={backup.fileName}>
                        <div>
                          <strong>{backup.label}</strong>
                          <span>
                            {formatShortTime(backup.createdAt)} / {formatBytes(backup.sizeBytes)}
                          </span>
                          <small>{backup.fileName}</small>
                        </div>
                        <div className="backup-actions">
                          <button onClick={() => onDownloadCloudBackup(backup.fileName)} type="button">
                            下载
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section-title">
                <ArchiveRestore size={18} />
                <span>本机保险箱</span>
              </div>
              <p className="section-note">
                从云端读取、导入文件、重置之前会自动留一份本机备份；妹妹也可以手动创建。
              </p>
              <div className="settings-actions">
                <button onClick={onCreateLocalBackup} type="button">
                  <Save size={15} />
                  创建本机备份
                </button>
              </div>
              <div className="backup-list">
                {localBackups.length === 0 ? (
                  <small>还没有本机备份。做一次读取、导入或重置前，姐姐会自动留底。</small>
                ) : (
                  localBackups.slice(0, 6).map((backup) => (
                    <article className="backup-item" key={backup.id}>
                      <div>
                        <strong>{backup.label}</strong>
                        <span>
                          {formatShortTime(backup.createdAt)} / {backup.reason}
                        </span>
                        <small>{formatBackupCounts(backup)}</small>
                      </div>
                      <div className="backup-actions">
                        <button onClick={() => onRestoreLocalBackup(backup.id)} type="button">
                          恢复
                        </button>
                        <button className="danger-button" onClick={() => onDeleteLocalBackup(backup.id)} type="button">
                          删除
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section-title">
                <Save size={18} />
                <span>文件进出</span>
              </div>
              <div className="settings-actions">
                <button onClick={onExport} type="button">
                  导出
                </button>
                <label className="file-button">
                  导入
                  <input
                    accept="application/json"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) onImport(file)
                      event.currentTarget.value = ''
                    }}
                    type="file"
                  />
                </label>
                <button className="danger-button" onClick={onReset} type="button">
                  重置
                </button>
              </div>
            </section>
          </div>
        </div>
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
