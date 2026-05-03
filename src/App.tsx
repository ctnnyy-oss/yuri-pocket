import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles/shell.css'
import './styles/sidebar.css'
import './styles/chat.css'
import './styles/memory.css'
import './styles/guardian.css'
import './styles/settings.css'
import './styles/modal.css'
import './styles/buttons.css'
import './styles/status.css'
import './styles/social.css'
import './styles/mobile.css'
import { CharacterRail, type AppView } from './components/CharacterRail'
import { ChatPhone } from './components/ChatPhone'
import { MobileNav } from './components/MobileNav'
import { MemoryPanel } from './components/MemoryPanel'
import { GroupChatPanel } from './components/social/GroupChatPanel'
import { MomentsPanel } from './components/social/MomentsPanel'
import { brand } from './config/brand'
import {
  createLocalBackup,
  deleteLocalBackup,
  listLocalBackups,
  loadAppState,
  loadLocalBackup,
  resetAppState,
  saveAppState,
} from './data/database'
import { migrateAppState } from './data/migrations'
import { createSeedState } from './data/seed'
import type {
  AccentTheme,
  AgentAction,
  AgentMoment,
  AgentReminder,
  AgentRoom,
  AgentRoomMessage,
  AppSettings,
  AppState,
  CharacterCard,
  ChatMessage,
  ConversationState,
  LocalBackupSummary,
  LongTermMemory,
  ModelProfileInput,
  ModelProfileSummary,
  WorldNode,
} from './domain/types'
import { requestAssistantReply } from './services/chatApi'
import {
  checkCloudHealth,
  createCloudBackup,
  type CloudBackupSummary,
  type CloudMetadata,
  downloadCloudBackup,
  getSavedCloudToken,
  isCloudSyncConfigured,
  listCloudBackups,
  pullCloudState,
  pushCloudState,
} from './services/cloudSync'
import {
  attachAssistantToMemoryUsageLog,
  buildPromptBundle,
  consolidateMemoryGarden,
  createManualMemory,
  createMemoryUsageLog,
  createMessage,
  createMemorySourceFromMessage,
  createMemoryTombstone,
  detectMemoryConflicts,
  getActiveCharacter,
  getConversation,
  integrateMemoryCandidate,
  isMemoryBlockedByTombstones,
  maybeCaptureMemory,
  nowIso,
  restoreMemoryRevision,
  touchRelevantMemories,
  updateConversationSummary,
  updateMemoryWithRevision,
  upsertConversation,
} from './services/memoryEngine'
import { appendMemoryEvent, createMemoryEvent, type CreateMemoryEventInput } from './services/memoryEvents'
import { applyMemoryFeedback, type MemoryFeedbackAction } from './services/memoryFeedback'
import {
  deleteModelProfile,
  listModelProfiles,
  saveModelProfile,
  testModelProfile,
} from './services/modelProfiles'
import { applyTrashRetention, normalizeTrashRetentionSettings } from './services/trashRetention'

// 每套主题完整覆盖整个 token 集 —— "换主题" 是真的把整个 UI 换色
const themeVariables: Record<Exclude<AccentTheme, 'custom'>, CSSProperties> = {
  /* 樱花粉 (默认) ─ 回到上一版更轻、更透的色系 */
  sakura: {
    '--pink-50': '#fff8fb',
    '--pink-100': '#ffeaf3',
    '--pink-150': '#ffe2ee',
    '--pink-200': '#ffd8e9',
    '--pink-300': '#ffc9df',
    '--pink-400': '#ffabcc',
    '--pink-500': '#ee92b9',
    '--pink-600': '#c97c9b',
    '--pink-700': '#9f5f7b',
    '--ink': '#4a3340',
    '--ink-secondary': '#68485a',
    '--muted': '#9b7888',
    '--muted-light': '#c9aebb',
    '--page-bg': '#fff8fb',
    '--canvas': '#fff8fb',
    '--panel': '#fffdfd',
    '--panel-soft': '#fffafd',
    '--rose': '#ffabcc',
    '--rose-strong': '#c97c9b',
    '--rose-deep': '#a96582',
    '--rose-soft': '#ffeaf3',
    '--rose-hover': '#ffc0db',
    '--rose-hot': '#ff8eb7',
    '--rose-ghost': 'rgba(255, 171, 204, 0.14)',
    '--rose-glow': 'rgba(228, 152, 188, 0.18)',
    '--line': 'rgba(228, 152, 188, 0.24)',
    '--line-soft': 'rgba(228, 152, 188, 0.14)',
    '--line-strong': 'rgba(255, 255, 255, 0.84)',
    '--hairline': 'rgba(74, 51, 64, 0.06)',
    '--soft-shadow': '0 24px 72px rgba(228, 152, 188, 0.12)',
    '--grad-pink': 'linear-gradient(135deg, #ffabcc 0%, #ff98c0 50%, #ee92b9 100%)',
    '--grad-bubble': 'linear-gradient(135deg, #ffb4d1 0%, #f39abd 100%)',
    '--grad-page':
      'radial-gradient(900px 700px at 8% 6%, rgba(255, 188, 214, 0.34), transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(226, 205, 255, 0.20), transparent 68%), radial-gradient(900px 700px at 50% 100%, rgba(255, 196, 222, 0.24), transparent 70%), #fff8fb',
  } as CSSProperties,

  /* 蜜桃奶 ─ 暖橙调 */
  peach: {
    '--pink-50': '#fff0e6',
    '--pink-100': '#ffe0cc',
    '--pink-150': '#ffcfb3',
    '--pink-200': '#ffbd99',
    '--pink-300': '#ffa87a',
    '--pink-400': '#ff9159',
    '--pink-500': '#ff7a38',
    '--pink-600': '#e96020',
    '--pink-700': '#c04810',
    '--ink': '#4a2f24',
    '--ink-secondary': '#6e493a',
    '--muted': '#a17a64',
    '--muted-light': '#c8a892',
    '--page-bg': '#fff0e6',
    '--canvas': '#fff5ed',
    '--panel': '#ffffff',
    '--panel-soft': '#fff8f3',
    '--rose': '#ffa87a',
    '--rose-strong': '#ff7a38',
    '--rose-deep': '#e96020',
    '--rose-soft': '#ffe0cc',
    '--rose-hover': '#ffbd99',
    '--rose-hot': '#ff7a38',
    '--rose-ghost': 'rgba(255, 145, 89, 0.16)',
    '--rose-glow': 'rgba(255, 145, 89, 0.32)',
    '--line': 'rgba(255, 168, 122, 0.32)',
    '--line-soft': 'rgba(255, 168, 122, 0.18)',
    '--line-strong': 'rgba(255, 145, 89, 0.45)',
    '--hairline': 'rgba(74, 47, 36, 0.06)',
    '--grad-pink': 'linear-gradient(135deg, #ffa87a 0%, #ff9159 50%, #ff7a38 100%)',
    '--grad-bubble': 'linear-gradient(135deg, #ff9d6b 0%, #ff8545 100%)',
    '--grad-page':
      'radial-gradient(900px 700px at 8% 6%, rgba(255, 168, 122, 0.55), transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(255, 210, 180, 0.35), transparent 68%), radial-gradient(900px 700px at 50% 100%, rgba(255, 190, 150, 0.45), transparent 70%), #fff0e6',
  } as CSSProperties,

  /* 奶油紫 ─ 淡雅梦幻 */
  lavender: {
    '--pink-50': '#f5ebff',
    '--pink-100': '#ead6ff',
    '--pink-150': '#ddc0ff',
    '--pink-200': '#cfa8ff',
    '--pink-300': '#bd8cff',
    '--pink-400': '#a66ef5',
    '--pink-500': '#8e52e0',
    '--pink-600': '#7338c8',
    '--pink-700': '#5a22a8',
    '--ink': '#2f2440',
    '--ink-secondary': '#4d3d63',
    '--muted': '#7e6a93',
    '--muted-light': '#aa97c0',
    '--page-bg': '#f5ebff',
    '--canvas': '#f9f0ff',
    '--panel': '#ffffff',
    '--panel-soft': '#fcf8ff',
    '--rose': '#bd8cff',
    '--rose-strong': '#8e52e0',
    '--rose-deep': '#7338c8',
    '--rose-soft': '#ead6ff',
    '--rose-hover': '#cfa8ff',
    '--rose-hot': '#8e52e0',
    '--rose-ghost': 'rgba(166, 110, 245, 0.18)',
    '--rose-glow': 'rgba(166, 110, 245, 0.34)',
    '--line': 'rgba(189, 140, 255, 0.32)',
    '--line-soft': 'rgba(189, 140, 255, 0.18)',
    '--line-strong': 'rgba(166, 110, 245, 0.45)',
    '--hairline': 'rgba(47, 36, 64, 0.06)',
    '--grad-pink': 'linear-gradient(135deg, #bd8cff 0%, #a66ef5 50%, #8e52e0 100%)',
    '--grad-bubble': 'linear-gradient(135deg, #b080ff 0%, #9560e8 100%)',
    '--grad-page':
      'radial-gradient(900px 700px at 8% 6%, rgba(189, 140, 255, 0.55), transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(255, 196, 222, 0.25), transparent 68%), radial-gradient(900px 700px at 50% 100%, rgba(207, 168, 255, 0.45), transparent 70%), #f5ebff',
  } as CSSProperties,

  /* 薄荷奶 ─ 清新治愈 */
  mint: {
    '--pink-50': '#e8f9f1',
    '--pink-100': '#d0f3e3',
    '--pink-150': '#b8edd5',
    '--pink-200': '#9ee6c5',
    '--pink-300': '#7fddb0',
    '--pink-400': '#5dd199',
    '--pink-500': '#3cc482',
    '--pink-600': '#28a86a',
    '--pink-700': '#1a8a52',
    '--ink': '#1f3a2c',
    '--ink-secondary': '#3a5747',
    '--muted': '#6a8276',
    '--muted-light': '#9bafa3',
    '--page-bg': '#e8f9f1',
    '--canvas': '#f0fcf6',
    '--panel': '#ffffff',
    '--panel-soft': '#f8fdfb',
    '--rose': '#7fddb0',
    '--rose-strong': '#3cc482',
    '--rose-deep': '#28a86a',
    '--rose-soft': '#d0f3e3',
    '--rose-hover': '#9ee6c5',
    '--rose-hot': '#3cc482',
    '--rose-ghost': 'rgba(93, 209, 153, 0.16)',
    '--rose-glow': 'rgba(93, 209, 153, 0.32)',
    '--line': 'rgba(127, 221, 176, 0.32)',
    '--line-soft': 'rgba(127, 221, 176, 0.18)',
    '--line-strong': 'rgba(93, 209, 153, 0.45)',
    '--hairline': 'rgba(31, 58, 44, 0.06)',
    '--grad-pink': 'linear-gradient(135deg, #7fddb0 0%, #5dd199 50%, #3cc482 100%)',
    '--grad-bubble': 'linear-gradient(135deg, #6fd5a5 0%, #48c78e 100%)',
    '--grad-page':
      'radial-gradient(900px 700px at 8% 6%, rgba(127, 221, 176, 0.50), transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(184, 237, 213, 0.40), transparent 68%), radial-gradient(900px 700px at 50% 100%, rgba(158, 230, 197, 0.48), transparent 70%), #e8f9f1',
  } as CSSProperties,

  /* 黑白简约 ─ 不喜欢粉色的妹妹也能用 */
  mono: {
    '--pink-50': '#f0f0f2',
    '--pink-100': '#e0e0e5',
    '--pink-150': '#d0d0d8',
    '--pink-200': '#bfbfc8',
    '--pink-300': '#a8a8b5',
    '--pink-400': '#8888a0',
    '--pink-500': '#68688a',
    '--pink-600': '#484870',
    '--pink-700': '#282850',
    '--ink': '#18181c',
    '--ink-secondary': '#3a3a42',
    '--muted': '#6e6e78',
    '--muted-light': '#a4a4ac',
    '--page-bg': '#ececf0',
    '--canvas': '#f5f5f8',
    '--panel': '#ffffff',
    '--panel-soft': '#fafafc',
    '--rose': '#a8a8b5',
    '--rose-strong': '#68688a',
    '--rose-deep': '#484870',
    '--rose-soft': '#e0e0e5',
    '--rose-hover': '#bfbfc8',
    '--rose-hot': '#68688a',
    '--rose-ghost': 'rgba(104, 104, 138, 0.10)',
    '--rose-glow': 'rgba(104, 104, 138, 0.18)',
    '--line': 'rgba(80, 80, 100, 0.18)',
    '--line-soft': 'rgba(80, 80, 100, 0.10)',
    '--line-strong': 'rgba(80, 80, 100, 0.28)',
    '--hairline': 'rgba(24, 24, 28, 0.06)',
    '--grad-pink': 'linear-gradient(135deg, #68688a 0%, #484870 100%)',
    '--grad-bubble': 'linear-gradient(135deg, #585880 0%, #383860 100%)',
    '--grad-page':
      'radial-gradient(900px 700px at 8% 6%, rgba(200, 200, 215, 0.60), transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(230, 230, 240, 0.65), transparent 68%), radial-gradient(900px 700px at 50% 100%, rgba(220, 220, 235, 0.60), transparent 70%), #ececf0',
  } as CSSProperties,

  /* 莓果 ─ 浓郁草莓奶昔 */
  berry: {
    '--pink-50': '#ffe0ed',
    '--pink-100': '#ffc0db',
    '--pink-150': '#ffa0c9',
    '--pink-200': '#ff7fb5',
    '--pink-300': '#ff5c9f',
    '--pink-400': '#f53888',
    '--pink-500': '#e21670',
    '--pink-600': '#bf0058',
    '--pink-700': '#8d0040',
    '--ink': '#3d1228',
    '--ink-secondary': '#5e2543',
    '--muted': '#9d5878',
    '--muted-light': '#c9889e',
    '--page-bg': '#ffe0ed',
    '--canvas': '#ffebf4',
    '--panel': '#ffffff',
    '--panel-soft': '#fff5fa',
    '--rose': '#ff5c9f',
    '--rose-strong': '#e21670',
    '--rose-deep': '#bf0058',
    '--rose-soft': '#ffc0db',
    '--rose-hover': '#ff7fb5',
    '--rose-hot': '#e21670',
    '--rose-ghost': 'rgba(245, 56, 136, 0.16)',
    '--rose-glow': 'rgba(245, 56, 136, 0.32)',
    '--line': 'rgba(255, 92, 159, 0.32)',
    '--line-soft': 'rgba(255, 92, 159, 0.18)',
    '--line-strong': 'rgba(245, 56, 136, 0.45)',
    '--hairline': 'rgba(61, 18, 40, 0.08)',
    '--grad-pink': 'linear-gradient(135deg, #ff5c9f 0%, #f53888 50%, #e21670 100%)',
    '--grad-bubble': 'linear-gradient(135deg, #f54890 0%, #d6247a 100%)',
    '--grad-page':
      'radial-gradient(900px 700px at 8% 6%, rgba(255, 127, 181, 0.60), transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(255, 192, 219, 0.40), transparent 68%), radial-gradient(900px 700px at 50% 100%, rgba(255, 160, 201, 0.55), transparent 70%), #ffe0ed',
  } as CSSProperties,

  /* 晴空蓝 ─ 中性清爽 */
  sky: {
    '--pink-50': '#e6f3ff',
    '--pink-100': '#cce6ff',
    '--pink-150': '#b3d9ff',
    '--pink-200': '#99ccff',
    '--pink-300': '#7ab8ff',
    '--pink-400': '#5ca3f5',
    '--pink-500': '#3d8de0',
    '--pink-600': '#2270c4',
    '--pink-700': '#0f559e',
    '--ink': '#1c2a40',
    '--ink-secondary': '#3a4a64',
    '--muted': '#6a7a92',
    '--muted-light': '#9badc4',
    '--page-bg': '#e6f3ff',
    '--canvas': '#f0f8ff',
    '--panel': '#ffffff',
    '--panel-soft': '#f8fcff',
    '--rose': '#7ab8ff',
    '--rose-strong': '#3d8de0',
    '--rose-deep': '#2270c4',
    '--rose-soft': '#cce6ff',
    '--rose-hover': '#99ccff',
    '--rose-hot': '#3d8de0',
    '--rose-ghost': 'rgba(92, 163, 245, 0.16)',
    '--rose-glow': 'rgba(92, 163, 245, 0.32)',
    '--line': 'rgba(122, 184, 255, 0.32)',
    '--line-soft': 'rgba(122, 184, 255, 0.18)',
    '--line-strong': 'rgba(92, 163, 245, 0.45)',
    '--hairline': 'rgba(28, 42, 64, 0.06)',
    '--grad-pink': 'linear-gradient(135deg, #7ab8ff 0%, #5ca3f5 50%, #3d8de0 100%)',
    '--grad-bubble': 'linear-gradient(135deg, #6aadff 0%, #4898e8 100%)',
    '--grad-page':
      'radial-gradient(900px 700px at 8% 6%, rgba(122, 184, 255, 0.50), transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(179, 217, 255, 0.40), transparent 68%), radial-gradient(900px 700px at 50% 100%, rgba(153, 204, 255, 0.48), transparent 70%), #e6f3ff',
  } as CSSProperties,

  /* 深夜紫 ─ 暗色模式 */
  midnight: {
    '--pink-50': '#2a1f38',
    '--pink-100': '#342848',
    '--pink-150': '#3e3158',
    '--pink-200': '#4a3d6a',
    '--pink-300': '#5f4d82',
    '--pink-400': '#7a62a0',
    '--pink-500': '#9678be',
    '--pink-600': '#b895dc',
    '--pink-700': '#d4b0f0',
    '--ink': '#f0e6f5',
    '--ink-secondary': '#c9b8d4',
    '--muted': '#9484a3',
    '--muted-light': '#6e607a',
    '--page-bg': '#1a1228',
    '--canvas': '#201830',
    '--panel': '#2a1f38',
    '--panel-soft': '#241c32',
    '--rose': '#b895dc',
    '--rose-strong': '#d4b0f0',
    '--rose-deep': '#e2c0ff',
    '--rose-soft': '#3e3158',
    '--rose-hover': '#4a3d6a',
    '--rose-hot': '#d4b0f0',
    '--rose-ghost': 'rgba(212, 176, 240, 0.14)',
    '--rose-glow': 'rgba(212, 176, 240, 0.28)',
    '--line': 'rgba(212, 176, 240, 0.20)',
    '--line-soft': 'rgba(212, 176, 240, 0.12)',
    '--line-strong': 'rgba(212, 176, 240, 0.35)',
    '--hairline': 'rgba(240, 230, 245, 0.08)',
    '--grad-pink': 'linear-gradient(135deg, #b895dc 0%, #9678be 50%, #7a62a0 100%)',
    '--grad-bubble': 'linear-gradient(135deg, #c8a0e8 0%, #9678be 100%)',
    '--grad-page':
      'radial-gradient(900px 700px at 8% 6%, rgba(122, 98, 160, 0.50), transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(95, 77, 130, 0.42), transparent 68%), radial-gradient(900px 700px at 50% 100%, rgba(150, 120, 190, 0.40), transparent 70%), #1a1228',
  } as CSSProperties,
}

function buildCustomThemeVariables(color: string): CSSProperties {
  const accent = normalizeHexColor(color) ?? '#ffabcc'
  const rgb = hexToRgb(accent) ?? { r: 255, g: 171, b: 204 }
  const accentAlpha = (alpha: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`

  return {
    '--pink-50': `color-mix(in srgb, ${accent} 9%, #fff)`,
    '--pink-100': `color-mix(in srgb, ${accent} 16%, #fff)`,
    '--pink-150': `color-mix(in srgb, ${accent} 22%, #fff)`,
    '--pink-200': `color-mix(in srgb, ${accent} 30%, #fff)`,
    '--pink-300': `color-mix(in srgb, ${accent} 44%, #fff)`,
    '--pink-400': `color-mix(in srgb, ${accent} 68%, #fff)`,
    '--pink-500': accent,
    '--pink-600': `color-mix(in srgb, ${accent} 78%, #70394f)`,
    '--pink-700': `color-mix(in srgb, ${accent} 58%, #3d2230)`,
    '--ink': `color-mix(in srgb, ${accent} 18%, #2f2730)`,
    '--ink-secondary': `color-mix(in srgb, ${accent} 28%, #4f3c48)`,
    '--muted': `color-mix(in srgb, ${accent} 38%, #7a6971)`,
    '--muted-light': `color-mix(in srgb, ${accent} 28%, #bbaab2)`,
    '--page-bg': `color-mix(in srgb, ${accent} 7%, #fff)`,
    '--canvas': `color-mix(in srgb, ${accent} 5%, #fff)`,
    '--panel': '#fffdfd',
    '--panel-soft': `color-mix(in srgb, ${accent} 4%, #fff)`,
    '--rose': accent,
    '--rose-strong': `color-mix(in srgb, ${accent} 78%, #70394f)`,
    '--rose-deep': `color-mix(in srgb, ${accent} 62%, #4c2638)`,
    '--rose-soft': `color-mix(in srgb, ${accent} 16%, #fff)`,
    '--rose-hover': `color-mix(in srgb, ${accent} 28%, #fff)`,
    '--rose-hot': `color-mix(in srgb, ${accent} 90%, #fff)`,
    '--rose-ghost': accentAlpha(0.13),
    '--rose-glow': accentAlpha(0.22),
    '--line': accentAlpha(0.26),
    '--line-soft': accentAlpha(0.14),
    '--line-strong': accentAlpha(0.42),
    '--hairline': 'rgba(74, 51, 64, 0.06)',
    '--soft-shadow': `0 24px 72px ${accentAlpha(0.12)}`,
    '--grad-pink': `linear-gradient(135deg, color-mix(in srgb, ${accent} 62%, #fff) 0%, ${accent} 52%, color-mix(in srgb, ${accent} 78%, #6e3d52) 100%)`,
    '--grad-bubble': `linear-gradient(135deg, color-mix(in srgb, ${accent} 70%, #fff) 0%, ${accent} 100%)`,
    '--grad-page': `radial-gradient(900px 700px at 8% 6%, ${accentAlpha(0.28)}, transparent 65%), radial-gradient(800px 650px at 96% 12%, rgba(226, 205, 255, 0.18), transparent 68%), radial-gradient(900px 700px at 50% 100%, ${accentAlpha(0.18)}, transparent 70%), color-mix(in srgb, ${accent} 7%, #fff)`,
  } as CSSProperties
}

function normalizeHexColor(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

const appViews: AppView[] = ['chat', 'group', 'moments', 'memory', 'world', 'model', 'settings', 'trash']
type CloudBusyTask = 'checking' | 'pulling' | 'pushing' | 'backing-up'

function addMemoryEventToState(state: AppState, input: CreateMemoryEventInput): AppState {
  return {
    ...state,
    memoryEvents: appendMemoryEvent(state.memoryEvents, createMemoryEvent(input)),
  }
}

function applyAgentActionsToState(
  state: AppState,
  actions: AgentAction[] = [],
  context: {
    character: CharacterCard
    conversation: ConversationState
    userMessage: ChatMessage
  },
): { state: AppState; appliedLabels: string[] } {
  let nextState = state
  const appliedLabels: string[] = []

  for (const action of actions) {
    if (action.requiresConfirmation) continue

    if (action.type === 'character_profile_update') {
      const characterPatch = sanitizeCharacterPatch(action.payload.character)
      if (!characterPatch) continue

      nextState = {
        ...nextState,
        characters: nextState.characters.map((character) =>
          character.id === context.character.id ? { ...character, ...characterPatch } : character,
        ),
      }
      appliedLabels.push(action.detail || action.title)
      continue
    }

    if (action.type === 'reminder_create') {
      const reminder = createReminderFromAgentAction(action, context)
      if (!reminder) continue

      nextState = {
        ...nextState,
        agentReminders: [reminder, ...(nextState.agentReminders ?? [])].slice(0, 80),
      }
      appliedLabels.push(`提醒：${reminder.title}`)
      continue
    }

    if (action.type === 'memory_candidate_create') {
      const memory = createMemoryFromAgentAction(action, context)
      if (!memory) continue

      nextState = addMemoryEventToState(
        {
          ...nextState,
          memories: integrateMemoryCandidate(nextState.memories, memory),
        },
        {
          type: 'captured',
          actor: 'assistant',
          title: memory.title,
          detail: 'Agent 根据妹妹的明确要求写入候选记忆，等待确认或修改。',
          memoryIds: [memory.id],
          characterId: context.character.id,
          conversationId: context.conversation.id,
        },
      )
      appliedLabels.push(`候选记忆：${memory.title}`)
      continue
    }

    if (action.type === 'moment_create') {
      const moment = createMomentFromAgentAction(action, nextState, context)
      if (!moment) continue

      nextState = {
        ...nextState,
        agentMoments: [moment, ...(nextState.agentMoments ?? [])].slice(0, 120),
      }
      appliedLabels.push(`动态：${moment.mood || '已发布'}`)
      continue
    }

    if (action.type === 'room_message_create') {
      const roomUpdate = createRoomUpdateFromAgentAction(action, nextState)
      if (!roomUpdate) continue

      const existingRoom = nextState.agentRooms.find((room) => room.id === roomUpdate.id)
      const nextRooms = existingRoom
        ? nextState.agentRooms.map((room) =>
            room.id === roomUpdate.id
              ? {
                  ...room,
                  title: roomUpdate.title || room.title,
                  description: roomUpdate.description || room.description,
                  memberCharacterIds: mergeUnique([...room.memberCharacterIds, ...roomUpdate.memberCharacterIds]),
                  messages: [...room.messages, ...roomUpdate.messages].slice(-240),
                  updatedAt: roomUpdate.updatedAt,
                }
              : room,
          )
        : [roomUpdate, ...nextState.agentRooms]

      nextState = {
        ...nextState,
        agentRooms: nextRooms,
      }
      appliedLabels.push(`群聊：${roomUpdate.title}`)
    }
  }

  return { state: nextState, appliedLabels }
}

function createMomentFromAgentAction(
  action: AgentAction,
  state: AppState,
  context: { character: CharacterCard },
): AgentMoment | null {
  const input = action.payload.moment
  const content = sanitizeBlockText(input?.content, 520)
  if (!input || !content) return null

  return {
    id: `moment-${crypto.randomUUID()}`,
    authorCharacterId: getKnownCharacterId(input.authorCharacterId, state.characters) ?? context.character.id,
    content,
    mood: sanitizeShortText(input.mood, 42) || '小动态',
    createdAt: nowIso(),
    source: 'agent',
  }
}

function createRoomUpdateFromAgentAction(action: AgentAction, state: AppState): AgentRoom | null {
  const input = action.payload.room
  if (!input || !Array.isArray(input.messages)) return null

  const messages = input.messages
    .map((message): AgentRoomMessage | null => {
      const authorCharacterId = getKnownCharacterId(message.authorCharacterId, state.characters)
      const content = sanitizeBlockText(message.content, 420)
      if (!authorCharacterId || !content) return null

      return {
        id: `room-message-${crypto.randomUUID()}`,
        authorCharacterId,
        content,
        createdAt: nowIso(),
        source: 'agent',
      }
    })
    .filter((message): message is AgentRoomMessage => Boolean(message))

  if (messages.length === 0) return null

  const explicitMembers = Array.isArray(input.memberCharacterIds)
    ? input.memberCharacterIds
        .map((characterId) => getKnownCharacterId(characterId, state.characters))
        .filter((characterId): characterId is string => Boolean(characterId))
    : []
  const memberCharacterIds = mergeUnique([...explicitMembers, ...messages.map((message) => message.authorCharacterId)])
  const roomId =
    sanitizeShortText(input.roomId, 80) ||
    findExistingRoomIdByMembers(state.agentRooms, memberCharacterIds) ||
    `room-agent-${crypto.randomUUID()}`
  const existingRoom = state.agentRooms.find((room) => room.id === roomId)

  return {
    id: roomId,
    title: sanitizeShortText(input.title, 42) || existingRoom?.title || '临时群聊',
    description: existingRoom?.description || '角色之间的多人对话',
    memberCharacterIds,
    messages,
    updatedAt: nowIso(),
  }
}

function createReminderFromAgentAction(
  action: AgentAction,
  context: { character: CharacterCard; conversation: ConversationState },
): AgentReminder | null {
  const reminder = action.payload.reminder
  const remindAt = sanitizeIsoDate(reminder?.remindAt)
  const title = sanitizeShortText(reminder?.title, 48)

  if (!reminder || !remindAt || !title) return null

  return {
    id: `reminder-${crypto.randomUUID()}`,
    title,
    detail: sanitizeShortText(reminder.detail, 160),
    remindAt,
    createdAt: nowIso(),
    status: 'pending',
    characterId: context.character.id,
    conversationId: context.conversation.id,
  }
}

function createMemoryFromAgentAction(
  action: AgentAction,
  context: { character: CharacterCard; conversation: ConversationState; userMessage: ChatMessage },
) {
  const input = action.payload.memory
  const body = sanitizeShortText(input?.body, 320)
  const title = sanitizeShortText(input?.title, 64)

  if (!input || !body || !title) return null

  return createManualMemory({
    title,
    body,
    tags: [...(input.tags ?? []), context.character.name].slice(0, 8),
    priority: input.priority ?? 3,
    pinned: false,
    kind: input.kind ?? 'event',
    layer: input.layer ?? 'episode',
    confidence: 0.82,
    status: 'candidate',
    sources: [createMemorySourceFromMessage(context.userMessage, context.conversation, context.character)],
    reason: 'Agent 根据用户明确要求写入候选记忆',
  })
}

function sanitizeIsoDate(value: unknown): string {
  if (typeof value !== 'string') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function sanitizeCharacterPatch(
  patch?: AgentAction['payload']['character'],
): Partial<AppState['characters'][number]> | null {
  if (!patch) return null

  const sanitized: Partial<AppState['characters'][number]> = {}
  const name = sanitizeShortText(patch.name, 18)
  const title = sanitizeShortText(patch.title, 18)
  const subtitle = sanitizeShortText(patch.subtitle, 28)
  const avatar = sanitizeShortText(patch.avatar, 2)

  if (name) sanitized.name = name
  if (title) sanitized.title = title
  if (subtitle) sanitized.subtitle = subtitle
  if (avatar) sanitized.avatar = avatar

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

function sanitizeShortText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return Array.from(value.replace(/[\r\n\t]/g, ' ').trim()).slice(0, maxLength).join('')
}

function sanitizeBlockText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return Array.from(value.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim()).slice(0, maxLength).join('')
}

function getKnownCharacterId(value: unknown, characters: CharacterCard[]): string | null {
  if (typeof value !== 'string') return null
  return characters.some((character) => character.id === value) ? value : null
}

function mergeUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function findExistingRoomIdByMembers(rooms: AgentRoom[], memberCharacterIds: string[]): string {
  if (memberCharacterIds.length === 0) return ''
  const memberSet = new Set(memberCharacterIds)
  const room = rooms.find((item) => memberCharacterIds.every((id) => item.memberCharacterIds.includes(id)))
  if (!room) return ''
  return room.memberCharacterIds.length === memberSet.size ? room.id : ''
}

function deliverDueReminders(state: AppState, currentTime = Date.now()): { state: AppState; delivered: AgentReminder[] } {
  const reminders = state.agentReminders ?? []
  const dueReminders = reminders
    .filter((reminder) => reminder.status === 'pending')
    .filter((reminder) => new Date(reminder.remindAt).getTime() <= currentTime)
    .slice(0, 3)

  if (dueReminders.length === 0) return { state, delivered: [] }

  const deliveredIds = new Set(dueReminders.map((reminder) => reminder.id))
  const deliveredAt = nowIso()
  let nextState: AppState = {
    ...state,
    agentReminders: reminders.map((reminder) =>
      deliveredIds.has(reminder.id) ? { ...reminder, status: 'delivered', deliveredAt } : reminder,
    ),
  }

  for (const reminder of dueReminders) {
    const characterId = reminder.characterId || nextState.activeCharacterId
    const reminderConversation = getConversation(nextState, characterId)
    const reminderMessage = createMessage(
      'assistant',
      [`提醒妹妹：${reminder.title}`, reminder.detail ? `当时妹妹说：${reminder.detail}` : ''].filter(Boolean).join('\n\n'),
    )

    nextState = upsertConversation(nextState, {
      ...reminderConversation,
      messages: [...reminderConversation.messages, reminderMessage],
      updatedAt: nowIso(),
    })
  }

  return { state: nextState, delivered: dueReminders }
}

function readViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'chat'

  const hashView = window.location.hash.replace(/^#\/?/, '')
  if (appViews.includes(hashView as AppView)) return hashView as AppView

  const queryView = new URLSearchParams(window.location.search).get('view')
  if (queryView && appViews.includes(queryView as AppView)) return queryView as AppView

  return 'chat'
}

function buildViewUrl(view: AppView): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('view')
  url.hash = view === 'chat' ? '' : view
  return `${url.pathname}${url.search}${url.hash}`
}

function App() {
  const [state, setState] = useState<AppState>(() => createSeedState())
  const [draft, setDraft] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [activeView, setActiveView] = useState<AppView>(() => readViewFromLocation())
  const [cloudToken] = useState(() => getSavedCloudToken())
  const [cloudStatus, setCloudStatus] = useState(() => {
    if (!isCloudSyncConfigured()) return '云端后端未配置'
    return '云端直连已启用'
  })
  const [cloudMeta, setCloudMeta] = useState<CloudMetadata | null>(null)
  const [cloudBusy, setCloudBusy] = useState<CloudBusyTask | null>(null)
  const [localBackups, setLocalBackups] = useState<LocalBackupSummary[]>([])
  const [cloudBackups, setCloudBackups] = useState<CloudBackupSummary[]>([])
  const [modelProfiles, setModelProfiles] = useState<ModelProfileSummary[]>([])
  const [modelProfileStatus, setModelProfileStatus] = useState(() => {
    if (!isCloudSyncConfigured()) return '模型密钥保险箱需要云端后端'
    return '模型密钥会直接保存到服务器保险箱'
  })
  const [modelProfileBusy, setModelProfileBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const autoCloudReadyRef = useRef(false)
  const skipNextAutoPushRef = useRef(false)

  const refreshLocalBackups = useCallback(async () => {
    const backups = await listLocalBackups()
    setLocalBackups(backups)
  }, [])

  const refreshCloudBackups = useCallback(async (token: string) => {
    if (!isCloudSyncConfigured()) {
      setCloudBackups([])
      return []
    }

    const backups = await listCloudBackups(token)
    setCloudBackups(backups)
    return backups
  }, [])

  const refreshModelProfileList = useCallback(async (tokenOverride?: string) => {
    const token = (tokenOverride ?? cloudToken).trim()
    if (!isCloudSyncConfigured()) {
      setModelProfiles([])
      setModelProfileStatus('模型密钥保险箱需要云端后端')
      return []
    }

    setModelProfileBusy(true)
    setModelProfileStatus('正在读取模型密钥保险箱...')
    try {
      const profiles = await listModelProfiles(token)
      setModelProfiles(profiles)
      setModelProfileStatus(`已读取 ${profiles.length} 组模型配置`)
      return profiles
    } catch (error) {
      setModelProfiles([])
      setModelProfileStatus(error instanceof Error ? error.message : '读取模型配置失败')
      return []
    } finally {
      setModelProfileBusy(false)
    }
  }, [cloudToken])

  const refreshCloudMetadata = useCallback(async (token: string) => {
    if (!isCloudSyncConfigured()) {
      setCloudMeta(null)
      setCloudStatus('云端后端还没有配置')
      return null
    }

    const cleanedToken = token.trim()

    setCloudBusy('checking')
    setCloudStatus('正在检查云端状态...')
    try {
      const metadata = await checkCloudHealth(cleanedToken)
      setCloudMeta(metadata)
      setCloudStatus(formatCloudStatus(metadata))
      void refreshCloudBackups(cleanedToken)
      void refreshModelProfileList(cleanedToken)
      return metadata
    } catch (error) {
      setCloudMeta(null)
      setCloudStatus(error instanceof Error ? error.message : '检查云端失败')
      return null
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'checking' ? null : currentTask))
    }
  }, [refreshCloudBackups, refreshModelProfileList])

  const bootstrapCloudState = useCallback(async (localState: AppState) => {
    if (!isCloudSyncConfigured() || autoCloudReadyRef.current) return
    if (localState.settings.dataStorageMode === 'local') {
      setCloudMeta(null)
      setCloudStatus('当前为仅本地模式，不会自动上传云端')
      setModelProfileStatus('仅本地模式下不会自动读取云端配置')
      return
    }

    setCloudStatus('正在自动连接云端...')
    setModelProfileStatus('正在读取模型密钥保险箱...')
    try {
      const snapshot = await pullCloudState(cloudToken)
      if (snapshot.state) {
        const pulledState = migrateAppState(snapshot.state)
        skipNextAutoPushRef.current = true
        setState(pulledState)
        setCloudMeta({
          hasState: true,
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
        })
        setCloudStatus(`已自动读取云端 v${snapshot.revision}`)
        setNotice('云端数据已自动同步')
      } else {
        const result = await pushCloudState(applyTrashRetention(localState), cloudToken)
        setCloudMeta({ hasState: true, revision: result.revision, updatedAt: result.updatedAt })
        setCloudStatus(`已创建云端同步 v${result.revision}`)
      }

      autoCloudReadyRef.current = true
      void refreshCloudBackups(cloudToken)
      void refreshModelProfileList(cloudToken)
    } catch (error) {
      autoCloudReadyRef.current = false
      setCloudStatus(error instanceof Error ? error.message : '自动连接云端失败')
      setModelProfileStatus('模型保险箱暂时没连上')
    }
  }, [cloudToken, refreshCloudBackups, refreshModelProfileList])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const initialView = readViewFromLocation()
    window.history.replaceState({ ...(window.history.state ?? {}), yuriPocketView: initialView }, '', buildViewUrl(initialView))

    function handlePopState() {
      setActiveView(readViewFromLocation())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!isReady) return

    function checkReminders() {
      let deliveredCount = 0
      setState((currentState) => {
        const result = deliverDueReminders(currentState)
        deliveredCount = result.delivered.length
        return result.state
      })

      if (deliveredCount > 0) {
        setNotice(deliveredCount === 1 ? '有一条提醒到时间了' : `有 ${deliveredCount} 条提醒到时间了`)
      }
    }

    checkReminders()
    const timer = window.setInterval(checkReminders, 30_000)
    return () => window.clearInterval(timer)
  }, [isReady])

  useEffect(() => {
    loadAppState().then((savedState) => {
      setState(savedState)
      setIsReady(true)
      void refreshLocalBackups()
    })
  }, [refreshLocalBackups])

  useEffect(() => {
    if (!isReady) return
    if (state.settings.dataStorageMode === 'local') {
      autoCloudReadyRef.current = false
      skipNextAutoPushRef.current = false
      return
    }
    if (!autoCloudReadyRef.current) void bootstrapCloudState(state)
  }, [bootstrapCloudState, isReady, state])

  useEffect(() => {
    if (
      !isReady ||
      state.settings.dataStorageMode === 'local' ||
      !isCloudSyncConfigured() ||
      !autoCloudReadyRef.current
    ) {
      return
    }
    if (skipNextAutoPushRef.current) {
      skipNextAutoPushRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      void pushCloudState(applyTrashRetention(state), cloudToken)
        .then((result) => {
          setCloudMeta({ hasState: true, revision: result.revision, updatedAt: result.updatedAt })
          setCloudStatus(`已自动同步到云端 v${result.revision}`)
        })
        .catch((error) => {
          setCloudStatus(error instanceof Error ? error.message : '自动同步云端失败')
        })
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [cloudToken, isReady, state])

  useEffect(() => {
    if (isReady) {
      saveAppState(state)
    }
  }, [isReady, state])

  const character = useMemo(() => getActiveCharacter(state), [state])
  const conversation = useMemo(() => getConversation(state, character.id), [character.id, state])
  const promptBundle = useMemo(() => buildPromptBundle(state), [state])
  const memoryConflicts = useMemo(() => detectMemoryConflicts(state.memories), [state.memories])
  const appStyle = {
    '--app-font-size': `${state.settings.fontSize}px`,
  } as CSSProperties

  useEffect(() => {
    const themeTokens =
      state.settings.accentTheme === 'custom'
        ? buildCustomThemeVariables(state.settings.customAccentColor)
        : themeVariables[state.settings.accentTheme] ?? themeVariables.sakura
    if (typeof document === 'undefined' || !themeTokens) return
    const root = document.documentElement
    const previous: Record<string, string> = {}
    for (const [key, value] of Object.entries(themeTokens)) {
      if (typeof value === 'string') {
        previous[key] = root.style.getPropertyValue(key)
        root.style.setProperty(key, value)
      }
    }
    root.dataset.theme = state.settings.accentTheme
    return () => {
      for (const [key, value] of Object.entries(previous)) {
        if (value) {
          root.style.setProperty(key, value)
        } else {
          root.style.removeProperty(key)
        }
      }
    }
  }, [state.settings.accentTheme, state.settings.customAccentColor])

  function navigateView(view: AppView, mode: 'push' | 'replace' = 'push') {
    setActiveView(view)
    if (typeof window === 'undefined') return
    if (readViewFromLocation() === view) return

    const url = buildViewUrl(view)
    const statePayload = { ...(window.history.state ?? {}), yuriPocketView: view }
    if (mode === 'replace') {
      window.history.replaceState(statePayload, '', url)
      return
    }
    window.history.pushState(statePayload, '', url)
  }

  async function handleSend() {
    const content = draft.trim()
    if (!content || isSending) return

    const userMessage = createMessage('user', content)
    const nextConversation = updateConversationSummary({
      ...conversation,
      messages: [...conversation.messages, userMessage],
      updatedAt: nowIso(),
    })
    const touchedMemories = touchRelevantMemories(state.memories, content, {
      characterId: character.id,
      conversationId: nextConversation.id,
      maxItems: 12,
    })
    const capturedMemory = state.settings.autoMemoryEnabled
      ? maybeCaptureMemory(userMessage, nextConversation, character)
      : null
    const keptMemory =
      capturedMemory &&
      capturedMemory.confidence >= state.settings.memoryConfidenceFloor &&
      !isMemoryBlockedByTombstones(capturedMemory, state.memoryTombstones)
        ? capturedMemory
        : null

    let nextState = {
      ...upsertConversation(state, nextConversation),
      memories: keptMemory ? integrateMemoryCandidate(touchedMemories, keptMemory) : touchedMemories,
    }
    if (keptMemory) {
      nextState = addMemoryEventToState(nextState, {
        type: 'captured',
        actor: 'assistant',
        title: keptMemory.title,
        detail: keptMemory.status === 'candidate' ? '自动捕捉为候选记忆，等待妹妹确认。' : '自动捕捉并写入长期记忆。',
        memoryIds: [keptMemory.id],
        characterId: character.id,
        conversationId: nextConversation.id,
      })
    }
    const requestBundle = buildPromptBundle(nextState)
    const usageLog = createMemoryUsageLog({
      bundle: requestBundle,
      conversation: nextConversation,
      character,
      userMessage,
    })
    const nextStateWithUsage = {
      ...nextState,
      memoryUsageLogs: [usageLog, ...nextState.memoryUsageLogs].slice(0, 50),
    }

    setState(nextStateWithUsage)
    setDraft('')
    setIsSending(true)
    setNotice(keptMemory ? (keptMemory.status === 'candidate' ? '发现一条待确认记忆' : '已捕捉并归档一条记忆') : '消息已送达')

    try {
      const result = await requestAssistantReply(requestBundle, nextState.settings)
      const assistantMessage = createMessage('assistant', result.reply)
      const repliedConversation = {
        ...nextConversation,
        messages: [...nextConversation.messages, assistantMessage],
        updatedAt: nowIso(),
      }
      const repliedState = upsertConversation(
        {
          ...nextStateWithUsage,
          memoryUsageLogs: attachAssistantToMemoryUsageLog(
            nextStateWithUsage.memoryUsageLogs,
            usageLog.id,
            assistantMessage.id,
          ),
        },
        repliedConversation,
      )
      const { state: stateWithAgentActions, appliedLabels } = applyAgentActionsToState(
        repliedState,
        result.agent?.actions,
        { character, conversation: nextConversation, userMessage },
      )
      setState(stateWithAgentActions)
      setNotice(appliedLabels.length > 0 ? `已执行：${appliedLabels.slice(0, 2).join(' / ')}` : '回复完成')
    } catch (error) {
      const fallbackMessage = createMessage(
        'assistant',
        `模型代理刚才没接通，但本地聊天和记忆没有丢。\n\n${
          error instanceof Error ? error.message : '未知错误'
        }`,
      )
      setState(
        upsertConversation(
          {
            ...nextStateWithUsage,
            memoryUsageLogs: attachAssistantToMemoryUsageLog(
              nextStateWithUsage.memoryUsageLogs,
              usageLog.id,
              fallbackMessage.id,
            ),
          },
          {
            ...nextConversation,
            messages: [...nextConversation.messages, fallbackMessage],
            updatedAt: nowIso(),
          },
        ),
      )
      setNotice('模型代理未接通')
    } finally {
      setIsSending(false)
    }
  }

  function handleSelectCharacter(characterId: string) {
    setState((currentState) => {
      const conversationForCharacter = getConversation(currentState, characterId)
      return {
        ...upsertConversation(currentState, conversationForCharacter),
        activeCharacterId: characterId,
      }
    })
  }

  function handleAddMemory() {
    const recentUserMessages = conversation.messages.filter((message) => message.role === 'user').slice(-4)
    const recentText = recentUserMessages.map((message) => message.content).join(' / ')

    const body = recentText || '妹妹暂时还没有新的聊天内容，先保留一条空记忆位。'
    const memory = createManualMemory({
      title: '手动整理的记忆',
      body: body.slice(0, 260),
      tags: ['手动整理', character.name],
      priority: 4,
      pinned: false,
      kind: 'event',
      confidence: recentUserMessages.length > 0 ? 0.9 : 0.55,
      sources: recentUserMessages.map((message) => createMemorySourceFromMessage(message, conversation, character)),
      reason: '手动整理最近聊天',
    })

    setState((currentState) =>
      addMemoryEventToState(
        {
          ...currentState,
          memories: [memory, ...currentState.memories],
        },
        {
          type: 'created',
          actor: 'user',
          title: memory.title,
          detail: '妹妹手动从最近聊天整理出一条记忆。',
          memoryIds: [memory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      ),
    )
    setNotice('最近聊天已整理')
  }

  function handleUpdateMemory(updatedMemory: LongTermMemory) {
    setState((currentState) => {
      const previousMemory = currentState.memories.find((memory) => memory.id === updatedMemory.id)
      const nextMemories = currentState.memories.map((memory) =>
        memory.id === updatedMemory.id ? updateMemoryWithRevision(memory, updatedMemory, '妹妹手动编辑') : memory,
      )
      const eventType = previousMemory?.status === 'candidate' && updatedMemory.status === 'active' ? 'confirmed' : 'edited'
      const detail = eventType === 'confirmed' ? '候选记忆被确认生效。' : '妹妹手动修改了记忆档案。'

      return addMemoryEventToState(
        {
          ...currentState,
          memories: nextMemories,
        },
        {
          type: eventType,
          actor: 'user',
          title: updatedMemory.title,
          detail,
          memoryIds: [updatedMemory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已修改')
  }

  function handleMemoryFeedbackFromChat(memoryId: string, action: MemoryFeedbackAction) {
    const currentMemory = state.memories.find((item) => item.id === memoryId)
    if (!currentMemory) {
      setNotice('这条记忆暂时没有找到')
      return
    }

    const noticeText = applyMemoryFeedback(currentMemory, action).notice

    setState((currentState) => {
      const memory = currentState.memories.find((item) => item.id === memoryId)
      if (!memory) return currentState

      const feedback = applyMemoryFeedback(memory, action)
      const updatedMemory = updateMemoryWithRevision(
        memory,
        feedback.memory,
        feedback.revisionReason,
      )

      return addMemoryEventToState(
        {
          ...currentState,
          memories: currentState.memories.map((item) => (item.id === memoryId ? updatedMemory : item)),
        },
        {
          type: 'usage_feedback',
          actor: 'user',
          title: memory.title,
          detail: feedback.detail,
          memoryIds: [memory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice(noticeText)
  }

  function handleOrganizeMemories() {
    const report = consolidateMemoryGarden(state.memories)
    setState((currentState) =>
      addMemoryEventToState(
        {
          ...currentState,
          memories: report.memories,
        },
        {
          type: 'organized',
          actor: 'system',
          title: '后台整理',
          detail:
            report.mergedCount > 0
              ? `检查 ${report.reviewedCount} 条记忆，合并 ${report.mergedCount} 条重复内容。`
              : `检查 ${report.reviewedCount} 条记忆，暂时不需要合并。`,
          memoryIds: report.memories.slice(0, 8).map((memory) => memory.id),
          characterId: character.id,
        },
      ),
    )
    setNotice(
      report.mergedCount > 0 ? `已整理 ${report.reviewedCount} 条，合并 ${report.mergedCount} 条` : '记忆系统已检查',
    )
  }

  function handleRestoreMemoryRevision(memoryId: string, revisionId: string) {
    setState((currentState) => {
      const currentMemory = currentState.memories.find((memory) => memory.id === memoryId)
      const restoredMemory = currentMemory ? restoreMemoryRevision(currentMemory, revisionId) : null

      return addMemoryEventToState(
        {
          ...currentState,
          memories: currentState.memories.map((memory) => (memory.id === memoryId ? restoredMemory ?? memory : memory)),
        },
        {
          type: 'revision_restored',
          actor: 'user',
          title: restoredMemory?.title ?? currentMemory?.title ?? '记忆回滚',
          detail: '从版本线恢复了一版记忆内容。',
          memoryIds: [memoryId],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已回滚')
  }

  function handleTrashMemory(memoryId: string) {
    setState((currentState) => {
      const memory = currentState.memories.find((item) => item.id === memoryId)
      if (!memory) return currentState

      return addMemoryEventToState(
        {
          ...currentState,
          memories: currentState.memories.filter((item) => item.id !== memoryId),
          trash: {
            ...currentState.trash,
            memories: [{ ...memory, status: 'trashed' as const, deletedAt: nowIso() }, ...currentState.trash.memories],
          },
        },
        {
          type: 'trashed',
          actor: 'user',
          title: memory.title,
          detail: '记忆移入回收花园，仍然可以恢复。',
          memoryIds: [memory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已放入回收花园')
  }

  function handleUpdateWorldNode(updatedNode: WorldNode) {
    setState((currentState) => ({
      ...currentState,
      worldNodes: currentState.worldNodes.map((node) => (node.id === updatedNode.id ? updatedNode : node)),
    }))
    setNotice('世界树已修改')
  }

  function handleTrashWorldNode(nodeId: string) {
    setState((currentState) => {
      const node = currentState.worldNodes.find((item) => item.id === nodeId)
      if (!node) return currentState

      return {
        ...currentState,
        worldNodes: currentState.worldNodes.filter((item) => item.id !== nodeId),
        trash: {
          ...currentState.trash,
          worldNodes: [{ ...node, deletedAt: nowIso() }, ...currentState.trash.worldNodes],
        },
      }
    })
    setNotice('世界树节点已放入回收花园')
  }

  function handleRestoreMemory(memoryId: string) {
    setState((currentState) => {
      const memory = currentState.trash.memories.find((item) => item.id === memoryId)
      if (!memory) return currentState

      return addMemoryEventToState(
        {
          ...currentState,
          memories: [{ ...memory, status: 'active' as const, updatedAt: nowIso() }, ...currentState.memories],
          trash: {
            ...currentState.trash,
            memories: currentState.trash.memories.filter((item) => item.id !== memoryId),
          },
        },
        {
          type: 'restored',
          actor: 'user',
          title: memory.title,
          detail: '记忆从回收花园恢复为可用状态。',
          memoryIds: [memory.id],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已恢复')
  }

  function handleRestoreWorldNode(nodeId: string) {
    setState((currentState) => {
      const node = currentState.trash.worldNodes.find((item) => item.id === nodeId)
      if (!node) return currentState

      const restoredNode: WorldNode = {
        id: node.id,
        title: node.title,
        keywords: node.keywords,
        content: node.content,
        priority: node.priority,
        enabled: node.enabled,
      }
      return {
        ...currentState,
        worldNodes: [restoredNode, ...currentState.worldNodes],
        trash: {
          ...currentState.trash,
          worldNodes: currentState.trash.worldNodes.filter((item) => item.id !== nodeId),
        },
      }
    })
    setNotice('世界树节点已恢复')
  }

  function handleDeleteTrashedMemory(memoryId: string) {
    setState((currentState) => {
      const deletedMemory = currentState.trash.memories.find((item) => item.id === memoryId)

      return addMemoryEventToState(
        {
          ...currentState,
          memoryTombstones: [
            ...currentState.trash.memories
              .filter((item) => item.id === memoryId)
              .map((memory) => createMemoryTombstone(memory, 'user_permanent_delete')),
            ...currentState.memoryTombstones,
          ],
          trash: {
            ...currentState.trash,
            memories: currentState.trash.memories.filter((item) => item.id !== memoryId),
          },
        },
        {
          type: 'permanently_deleted',
          actor: 'user',
          title: deletedMemory?.title ?? '彻底删除记忆',
          detail: '记忆被永久删除，并留下防复活指纹。',
          memoryIds: [memoryId],
          characterId: character.id,
          conversationId: conversation.id,
        },
      )
    })
    setNotice('记忆已彻底删除')
  }

  function handleDeleteTrashedWorldNode(nodeId: string) {
    setState((currentState) => ({
      ...currentState,
      trash: {
        ...currentState.trash,
        worldNodes: currentState.trash.worldNodes.filter((item) => item.id !== nodeId),
      },
    }))
    setNotice('世界树节点已彻底删除')
  }

  function handleEmptyTrash() {
    setState((currentState) =>
      addMemoryEventToState(
        {
          ...currentState,
          memoryTombstones: [
            ...currentState.trash.memories.map((memory) => createMemoryTombstone(memory, 'empty_trash')),
            ...currentState.memoryTombstones,
          ],
          trash: {
            memories: [],
            worldNodes: [],
          },
        },
        {
          type: 'trash_emptied',
          actor: 'user',
          title: '清空回收花园',
          detail: `永久删除 ${currentState.trash.memories.length} 条回收记忆。`,
          memoryIds: currentState.trash.memories.map((memory) => memory.id),
          characterId: character.id,
        },
      ),
    )
    setNotice('回收花园已清空')
  }

  function handleUpdateSettings(settings: AppSettings) {
    if (settings.dataStorageMode === 'local' && state.settings.dataStorageMode !== 'local') {
      autoCloudReadyRef.current = false
      skipNextAutoPushRef.current = false
      setCloudMeta(null)
      setCloudStatus('当前为仅本地模式，不会自动上传云端')
      setModelProfileStatus('仅本地模式下不会上传或测试 API Key')
    }

    if (settings.dataStorageMode === 'cloud' && state.settings.dataStorageMode === 'local') {
      setCloudStatus('已切回云端同步，正在等待连接')
      setModelProfileStatus('云端同步开启后会读取模型密钥保险箱')
    }

    setState((currentState) =>
      applyTrashRetention({
        ...currentState,
        settings: normalizeTrashRetentionSettings(settings),
      }),
    )
  }

  async function makeLocalBackup(reason: string) {
    const backup = await createLocalBackup(applyTrashRetention(state), reason)
    await refreshLocalBackups()
    return backup
  }

  async function handleCreateLocalBackup() {
    try {
      const stateWithEvent = addMemoryEventToState(applyTrashRetention(state), {
        type: 'local_backup_created',
        actor: 'user',
        title: '创建本机备份',
        detail: '妹妹手动创建了一份本机保险箱备份。',
        memoryIds: [],
        characterId: character.id,
      })
      const backup = await createLocalBackup(stateWithEvent, '妹妹手动创建')
      setState(stateWithEvent)
      await refreshLocalBackups()
      setNotice(`已创建本机备份：${formatShortDateTime(backup.createdAt)}`)
    } catch {
      setNotice('本机备份创建失败')
    }
  }

  async function handleRestoreLocalBackup(backupId: string) {
    const backup = localBackups.find((item) => item.id === backupId)
    const label = backup ? `${backup.label} / ${formatShortDateTime(backup.createdAt)}` : '这份备份'
    if (!window.confirm(`恢复 ${label} 会覆盖当前本机数据。姐姐会先给当前状态再留一份备份，确定恢复吗？`)) {
      setNotice('已取消恢复备份')
      return
    }

    try {
      await makeLocalBackup('恢复本机备份前自动备份')
      const restoredState = await loadLocalBackup(backupId)
      if (!restoredState) {
        setNotice('这份本机备份没有找到')
        await refreshLocalBackups()
        return
      }

      setState(
        addMemoryEventToState(restoredState, {
          type: 'local_backup_restored',
          actor: 'user',
          title: '恢复本机备份',
          detail: `恢复 ${label}，恢复前已自动备份当前状态。`,
          memoryIds: [],
          characterId: character.id,
        }),
      )
      setNotice('已恢复本机备份')
    } catch {
      setNotice('恢复本机备份失败')
    }
  }

  async function handleDeleteLocalBackup(backupId: string) {
    if (!window.confirm('这只会删除这份本机备份，不影响当前数据。确定删除吗？')) return

    await deleteLocalBackup(backupId)
    await refreshLocalBackups()
    setNotice('本机备份已删除')
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${brand.exportPrefix}-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('数据已导出')
  }

  async function handleImport(file: File) {
    try {
      const importedState = JSON.parse(await file.text()) as AppState
      if (!Array.isArray(importedState.characters) || !Array.isArray(importedState.conversations)) {
        throw new Error('Invalid state file')
      }
      await makeLocalBackup('导入文件前自动备份')
      const migratedState = migrateAppState(importedState)
      setState(
        addMemoryEventToState(migratedState, {
          type: 'imported',
          actor: 'user',
          title: '导入数据',
          detail: '从 JSON 文件导入应用数据，导入前已自动备份当前状态。',
          memoryIds: migratedState.memories.slice(0, 8).map((memory) => memory.id),
          characterId: character.id,
        }),
      )
      setNotice('数据已导入')
    } catch {
      setNotice('导入失败，文件格式或本机备份没有通过')
    }
  }

  async function handleReset() {
    if (!window.confirm('重置会回到初始状态。姐姐会先创建本机备份，确定继续吗？')) {
      setNotice('已取消重置')
      return
    }

    try {
      await makeLocalBackup('重置前自动备份')
      const nextState = await resetAppState()
      setState(
        addMemoryEventToState(nextState, {
          type: 'reset',
          actor: 'user',
          title: '重置应用',
          detail: '回到初始状态，重置前已自动备份当前状态。',
          memoryIds: nextState.memories.map((memory) => memory.id),
          characterId: character.id,
        }),
      )
      setNotice('已回到初始状态，本机旧数据已备份')
    } catch {
      setNotice('重置失败，本机备份没有通过')
    }
  }

  async function handleConnectCloud() {
    if (state.settings.dataStorageMode === 'local') {
      setCloudStatus('当前为仅本地模式，不会连接云端')
      return
    }

    if (!isCloudSyncConfigured()) {
      setCloudStatus('云端后端还没有配置')
      return
    }

    void refreshCloudMetadata(cloudToken)
    void refreshModelProfileList(cloudToken)
    setNotice('云端连接已检查')
  }

  async function handleSaveModelProfile(profile: ModelProfileInput) {
    if (state.settings.dataStorageMode === 'local') {
      setModelProfileStatus('仅本地模式下不会上传 API Key')
      setNotice('仅本地模式不会上传模型密钥')
      return
    }

    try {
      const token = cloudToken.trim()
      setModelProfileBusy(true)
      setModelProfileStatus('正在保存模型配置...')
      const result = await saveModelProfile(token, profile)
      setModelProfiles(result.profiles)
      setState((currentState) => ({
        ...currentState,
        settings: normalizeTrashRetentionSettings({
          ...currentState.settings,
          modelProfileId: result.profile.id,
          model: result.profile.model,
        }),
      }))
      setModelProfileStatus(`已保存并启用：${result.profile.name}`)
      setNotice('模型配置已保存')
    } catch (error) {
      setModelProfileStatus(error instanceof Error ? error.message : '保存模型配置失败')
    } finally {
      setModelProfileBusy(false)
    }
  }

  async function handleDeleteModelProfile(profileId: string) {
    if (state.settings.dataStorageMode === 'local') {
      setModelProfileStatus('仅本地模式下不会改动云端模型配置')
      return
    }

    try {
      const token = cloudToken.trim()
      setModelProfileBusy(true)
      const profiles = await deleteModelProfile(token, profileId)
      setModelProfiles(profiles)
      setState((currentState) => ({
        ...currentState,
        settings:
          currentState.settings.modelProfileId === profileId
            ? normalizeTrashRetentionSettings({
                ...currentState.settings,
                modelProfileId: 'server-env',
              })
            : currentState.settings,
      }))
      setModelProfileStatus('模型配置已删除')
      setNotice('模型配置已删除')
    } catch (error) {
      setModelProfileStatus(error instanceof Error ? error.message : '删除模型配置失败')
    } finally {
      setModelProfileBusy(false)
    }
  }

  async function handleTestModelProfile(input: { profileId?: string; profile?: ModelProfileInput }) {
    if (state.settings.dataStorageMode === 'local') {
      setModelProfileStatus('仅本地模式下不会把 API Key 发到云端测试')
      setNotice('仅本地模式不会测试云端模型')
      return
    }

    try {
      const token = cloudToken.trim()
      setModelProfileBusy(true)
      setModelProfileStatus('正在测试模型连通性...')
      const result = await testModelProfile(token, input)
      setModelProfileStatus(`测试成功：${result.provider} / ${result.model}，${result.latencyMs}ms，${result.preview}`)
      setNotice('模型测试成功')
    } catch (error) {
      setModelProfileStatus(error instanceof Error ? error.message : '模型测试失败')
      setNotice('模型测试失败')
    } finally {
      setModelProfileBusy(false)
    }
  }

  async function handlePullCloud() {
    if (cloudBusy) return
    if (state.settings.dataStorageMode === 'local') {
      setCloudStatus('当前为仅本地模式，不会从云端读取')
      return
    }

    try {
      const metadata = cloudMeta ?? (await refreshCloudMetadata(cloudToken))
      if (!metadata?.hasState) {
        setCloudStatus('云端还没有数据，可以先保存一次')
        return
      }

      const confirmed = window.confirm(
        [
          '从云端读取会覆盖这台设备当前数据。',
          `云端版本：v${metadata.revision}`,
          `最后保存：${formatCloudTime(metadata.updatedAt)}`,
          '姐姐会先给当前本机状态创建一份备份，再读取云端。确定继续吗？',
        ].join('\n'),
      )
      if (!confirmed) {
        setCloudStatus('已取消云端读取')
        return
      }

      setCloudBusy('pulling')
      setCloudStatus('正在从云端读取...')
      const snapshot = await pullCloudState(cloudToken)
      if (!snapshot.state) {
        setCloudMeta({
          hasState: false,
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
        })
        setCloudStatus('云端还没有数据，可以先保存一次')
        return
      }

      await makeLocalBackup('从云端读取前自动备份')
      const pulledState = migrateAppState(snapshot.state)
      setState(
        addMemoryEventToState(pulledState, {
          type: 'cloud_pulled',
          actor: 'user',
          title: '读取云端数据',
          detail: `从云端读取 v${snapshot.revision}，读取前已自动备份本机状态。`,
          memoryIds: pulledState.memories.slice(0, 8).map((memory) => memory.id),
          characterId: character.id,
        }),
      )
      setCloudMeta({
        hasState: true,
        revision: snapshot.revision,
        updatedAt: snapshot.updatedAt,
      })
      setCloudStatus(`已读取云端数据 v${snapshot.revision}，本机旧数据已备份`)
      setNotice('云端数据已读取')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '读取云端失败')
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'pulling' ? null : currentTask))
    }
  }

  async function handlePushCloud() {
    if (cloudBusy) return
    if (state.settings.dataStorageMode === 'local') {
      setCloudStatus('当前为仅本地模式，不会保存到云端')
      return
    }

    try {
      setCloudBusy('pushing')
      setCloudStatus('正在保存到云端...')
      const stateToPush = addMemoryEventToState(applyTrashRetention(state), {
        type: 'cloud_pushed',
        actor: 'user',
        title: '保存到云端',
        detail: '把当前本机状态保存到云端快照。',
        memoryIds: state.memories.slice(0, 8).map((memory) => memory.id),
        characterId: character.id,
      })
      const result = await pushCloudState(stateToPush, cloudToken)
      setState(stateToPush)
      setCloudMeta({
        hasState: true,
        revision: result.revision,
        updatedAt: result.updatedAt,
      })
      void refreshCloudBackups(cloudToken)
      setCloudStatus(`已保存到云端 v${result.revision}，时间 ${formatCloudTime(result.updatedAt)}`)
      setNotice('云端数据已保存')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '保存云端失败')
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'pushing' ? null : currentTask))
    }
  }

  async function handleCreateCloudBackup() {
    if (cloudBusy) return
    if (state.settings.dataStorageMode === 'local') {
      setCloudStatus('当前为仅本地模式，不会创建云端备份')
      return
    }

    try {
      setCloudBusy('backing-up')
      setCloudStatus('正在创建云端备份...')
      const backups = await createCloudBackup(cloudToken)
      setCloudBackups(backups)
      setState((currentState) =>
        addMemoryEventToState(currentState, {
          type: 'cloud_backup_created',
          actor: 'user',
          title: '创建云端备份',
          detail: `云端保险箱现有 ${backups.length} 份备份。`,
          memoryIds: [],
          characterId: character.id,
        }),
      )
      setCloudStatus('云端备份已创建')
      setNotice('云端备份已创建')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '创建云端备份失败')
    } finally {
      setCloudBusy((currentTask) => (currentTask === 'backing-up' ? null : currentTask))
    }
  }

  async function handleRefreshCloudBackups() {
    try {
      await refreshCloudBackups(cloudToken)
      setCloudStatus('云端备份列表已刷新')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '刷新云端备份失败')
    }
  }

  async function handleDownloadCloudBackup(fileName: string) {
    try {
      const blob = await downloadCloudBackup(cloudToken, fileName)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice('云端备份已下载')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '下载云端备份失败')
    }
  }

  return (
    <div className="app-shell" style={appStyle}>
      <CharacterRail
        activeCharacterId={state.activeCharacterId}
        activeView={activeView}
        characters={state.characters}
        onSelect={handleSelectCharacter}
        onViewChange={navigateView}
      />

      {activeView === 'chat' ? (
        <ChatPhone
          character={character}
          contextBlocks={promptBundle.contextBlocks}
          draft={draft}
          isSending={isSending}
          memories={state.memories}
          memoryUsageLogs={state.memoryUsageLogs}
          messages={conversation.messages}
          onDraftChange={setDraft}
          onMemoryFeedback={handleMemoryFeedbackFromChat}
          onSend={handleSend}
          settings={state.settings}
        />
      ) : activeView === 'group' ? (
        <GroupChatPanel characters={state.characters} rooms={state.agentRooms} />
      ) : activeView === 'moments' ? (
        <MomentsPanel characters={state.characters} moments={state.agentMoments} />
      ) : (
        <MemoryPanel
          activeView={activeView}
          activeCharacterId={state.activeCharacterId}
          activeConversationId={conversation.id}
          characters={state.characters}
          memoryConflicts={memoryConflicts}
          memoryEvents={state.memoryEvents}
          memoryUsageLogs={state.memoryUsageLogs}
          memories={state.memories}
          onAddMemory={handleAddMemory}
          onDeleteTrashedMemory={handleDeleteTrashedMemory}
          onDeleteTrashedWorldNode={handleDeleteTrashedWorldNode}
          onEmptyTrash={handleEmptyTrash}
          onExport={handleExport}
          onImport={handleImport}
          onOrganizeMemories={handleOrganizeMemories}
          onReset={handleReset}
          onRestoreMemoryRevision={handleRestoreMemoryRevision}
          onRestoreMemory={handleRestoreMemory}
          onRestoreWorldNode={handleRestoreWorldNode}
          onTrashMemory={handleTrashMemory}
          onTrashWorldNode={handleTrashWorldNode}
          onUpdateMemory={handleUpdateMemory}
          onUpdateSettings={handleUpdateSettings}
          onUpdateWorldNode={handleUpdateWorldNode}
          modelProfiles={modelProfiles}
          modelProfileStatus={modelProfileStatus}
          modelProfileBusy={modelProfileBusy}
          onRefreshModelProfiles={() => void refreshModelProfileList()}
          onSaveModelProfile={handleSaveModelProfile}
          onDeleteModelProfile={handleDeleteModelProfile}
          onTestModelProfile={handleTestModelProfile}
          cloudStatus={cloudStatus}
          cloudMeta={cloudMeta}
          cloudBusy={cloudBusy}
          cloudBackups={cloudBackups}
          cloudSyncConfigured={isCloudSyncConfigured()}
          onConnectCloud={handleConnectCloud}
          onPullCloud={handlePullCloud}
          onPushCloud={handlePushCloud}
          onRefreshCloud={() => void refreshCloudMetadata(cloudToken)}
          onCreateCloudBackup={handleCreateCloudBackup}
          onDownloadCloudBackup={handleDownloadCloudBackup}
          onRefreshCloudBackups={() => void handleRefreshCloudBackups()}
          localBackups={localBackups}
          onCreateLocalBackup={handleCreateLocalBackup}
          onDeleteLocalBackup={handleDeleteLocalBackup}
          onRestoreLocalBackup={handleRestoreLocalBackup}
          settings={state.settings}
          trash={state.trash}
          worldNodes={state.worldNodes}
        />
      )}

      <MobileNav activeView={activeView} onViewChange={navigateView} />
      {notice && <div className="status-pill">{notice}</div>}
    </div>
  )
}

function formatCloudStatus(metadata: CloudMetadata): string {
  if (!metadata.hasState) return '云端已连接，暂时还没有保存过数据'
  return `云端有数据 v${metadata.revision}，最后保存 ${formatCloudTime(metadata.updatedAt)}`
}

function formatCloudTime(value: string | null): string {
  if (!value) return '暂无记录'
  return formatShortDateTime(value)
}

function formatShortDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default App
