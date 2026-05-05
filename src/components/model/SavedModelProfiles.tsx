import { CheckCircle2, Trash2 } from 'lucide-react'
import type { ModelProfileSummary } from '../../domain/types'
import { isServerEnvProfileId, providerKindLabels } from './modelPanelUtils'

interface SavedModelProfilesProps {
  activeProfileId: string
  modelProfiles: ModelProfileSummary[]
  onDeleteModelProfile: (profileId: string) => Promise<void>
  onEditProfile: (profile: ModelProfileSummary) => void
  onTestProfile: (profile: ModelProfileSummary) => void
  onUseProfile: (profile: ModelProfileSummary) => void
}

export function SavedModelProfiles({
  activeProfileId,
  modelProfiles,
  onDeleteModelProfile,
  onEditProfile,
  onTestProfile,
  onUseProfile,
}: SavedModelProfilesProps) {
  return (
    <>
      <div className="settings-section-title">
        <CheckCircle2 size={18} />
        <span>已保存模型</span>
      </div>
      <div className="model-profile-list">
        {modelProfiles.length === 0 ? (
          <small className="model-empty-note">还没有保存模型。先选平台或自定义，填 URL 和 API Key，模型列表出来后保存。</small>
        ) : (
          modelProfiles.map((profile) => (
            <article className={`model-profile-item ${profile.id === activeProfileId ? 'active' : ''}`} key={profile.id}>
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
                <button onClick={() => onUseProfile(profile)} type="button">
                  使用
                </button>
                <button onClick={() => onEditProfile(profile)} type="button">
                  {isServerEnvProfileId(profile.id) ? '复制' : '编辑'}
                </button>
                <button disabled={!profile.hasApiKey} onClick={() => onTestProfile(profile)} type="button">
                  测试
                </button>
                {!isServerEnvProfileId(profile.id) && (
                  <button
                    className="danger-button"
                    onClick={() => {
                      if (window.confirm(`删除“${profile.model}”这组模型配置吗？保存的密钥也会一起删除。`)) {
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
    </>
  )
}
