import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { AppSettings, ModelProfileInput, ModelProfileSummary } from '../../domain/types'
import type { ModelCatalogResult } from '../../services/modelProfiles'
import { WorkspaceTitle } from '../memory/atoms'
import { GenerationSettings } from './GenerationSettings'
import { ModelCurrentStrip } from './ModelCurrentStrip'
import { ModelProfileEditor } from './ModelProfileEditor'
import { SavedModelProfiles } from './SavedModelProfiles'
import { useModelProfileDraft } from './useModelProfileDraft'

interface ModelAndDataPanelProps {
  settings: AppSettings
  onUpdateSettings: (settings: AppSettings) => void
  modelProfiles: ModelProfileSummary[]
  modelProfileStatus: string
  modelProfileBusy: boolean
  cloudSyncConfigured: boolean
  cloudToken: string
  cloudStatus?: string
  onSaveCloudToken: (token: string) => void
  onSaveModelProfile: (profile: ModelProfileInput) => Promise<void>
  onDeleteModelProfile: (profileId: string) => Promise<void>
  onFetchModelCatalog: (input: { profileId?: string; profile?: ModelProfileInput }) => Promise<ModelCatalogResult>
  onTestModelProfile: (input: { profileId?: string; profile?: ModelProfileInput }) => Promise<void>
}

export function ModelAndDataPanel({
  settings,
  onUpdateSettings,
  modelProfiles,
  modelProfileStatus,
  modelProfileBusy,
  cloudSyncConfigured,
  cloudToken,
  cloudStatus,
  onSaveCloudToken,
  onSaveModelProfile,
  onDeleteModelProfile,
  onFetchModelCatalog,
  onTestModelProfile,
}: ModelAndDataPanelProps) {
  const activeProfile =
    modelProfiles.find((profile) => profile.id === settings.modelProfileId) ??
    modelProfiles.find((profile) => profile.isDefault) ??
    modelProfiles[0]
  const draftController = useModelProfileDraft({
    modelProfileBusy,
    onFetchModelCatalog,
    onSaveModelProfile,
    onTestModelProfile,
  })
  const modelBackendHint = cloudSyncConfigured ? '云端模型后端' : '本机 /api 模型后端'
  const [cloudTokenDraft, setCloudTokenDraft] = useState(cloudToken)

  function handleUseProfile(profile: ModelProfileSummary) {
    onUpdateSettings({
      ...settings,
      modelProfileId: profile.id,
      model: profile.model,
    })
  }

  function handleFetchActiveCatalog() {
    if (!activeProfile) return
    void draftController.handleFetchProfileCatalog(activeProfile)
  }

  function handleTestActiveProfile() {
    if (!activeProfile) return
    void onTestModelProfile({ profileId: activeProfile.id })
  }

  function handleStoreCloudToken(token: string) {
    setCloudTokenDraft(token)
    onSaveCloudToken(token)
  }

  return (
    <>
      <WorkspaceTitle
        description="选择平台或自定义，填 Base URL 和 API Key 后自动拉取模型列表。"
        icon={<SlidersHorizontal size={20} />}
        title="模型接入"
      />

      <section className="settings-stack model-settings-stack model-connect-stack">
        {cloudSyncConfigured && (
          <section className="settings-section model-auth-section">
            <div className="settings-section-title">
              <span>云端口令</span>
            </div>
            <label>
              <span>后端授权</span>
              <input
                autoComplete="off"
                onChange={(event) => setCloudTokenDraft(event.target.value)}
                placeholder={cloudToken ? '已保存到当前浏览器，留空可清除' : '填入云端同步口令'}
                type="password"
                value={cloudTokenDraft}
              />
              <small>
                公开后端开启授权时，先保存一次口令；口令只存在当前浏览器，不会写进仓库或导出文件。
                {cloudStatus ? ` 当前状态：${cloudStatus}` : ''}
              </small>
            </label>
            <div className="settings-actions">
              <button onClick={() => handleStoreCloudToken(cloudTokenDraft)} type="button">
                保存口令
              </button>
              <button className="quiet-action" onClick={() => handleStoreCloudToken('')} type="button">
                清空口令
              </button>
            </div>
          </section>
        )}

        <ModelCurrentStrip
          activeProfile={activeProfile}
          modelBackendHint={modelBackendHint}
          modelProfileBusy={modelProfileBusy}
          onFetchCatalog={handleFetchActiveCatalog}
          onTestProfile={handleTestActiveProfile}
        />

        <div className="model-layout">
          <ModelProfileEditor
            canFetchCatalog={draftController.canFetchCatalog}
            canUseDraft={draftController.canUseDraft}
            catalogStatus={draftController.catalogStatus}
            draft={draftController.draft}
            modelOptions={draftController.modelOptions}
            modelStatusText={modelProfileStatus}
            onDraftChange={draftController.setDraft}
            onFetchDraftCatalog={draftController.handleFetchDraftCatalog}
            onPresetChange={draftController.handlePresetChange}
            onResetCatalog={draftController.resetCatalog}
            onSaveProfile={draftController.handleSaveProfile}
            onTestDraft={draftController.handleTestDraft}
            selectedPresetId={draftController.selectedPresetId}
          />

          <section className="settings-section model-column">
            <SavedModelProfiles
              activeProfileId={settings.modelProfileId}
              modelProfiles={modelProfiles}
              onDeleteModelProfile={onDeleteModelProfile}
              onEditProfile={draftController.loadProfileIntoDraft}
              onTestProfile={(profile) => void onTestModelProfile({ profileId: profile.id })}
              onUseProfile={handleUseProfile}
            />
            <GenerationSettings onUpdateSettings={onUpdateSettings} settings={settings} />
          </section>
        </div>
      </section>
    </>
  )
}
