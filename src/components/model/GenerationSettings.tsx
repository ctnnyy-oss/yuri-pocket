import { ServerCog } from 'lucide-react'
import type { AppSettings } from '../../domain/types'

interface GenerationSettingsProps {
  settings: AppSettings
  onUpdateSettings: (settings: AppSettings) => void
}

export function GenerationSettings({ settings, onUpdateSettings }: GenerationSettingsProps) {
  return (
    <>
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
    </>
  )
}
