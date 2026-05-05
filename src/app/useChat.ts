import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'
import type { AppState, CharacterCard, ConversationState } from '../domain/types'
import { requestAssistantReply } from '../services/chatApi'
import { getSavedCloudToken, isCloudSyncConfigured } from '../services/cloudSync'
import {
  getMemoryEmbeddingInput,
  upsertMemoryEmbeddingRecordsFromVectors,
} from '../services/memoryEmbeddingIndex'
import {
  attachAssistantToMemoryUsageLog,
  buildPromptBundle,
  createMemoryUsageLog,
  createMessage,
  getMemoryUsageLogLimit,
  integrateMemoryCandidate,
  isExplicitMemoryQuery,
  isMemoryBlockedByTombstones,
  maybeCaptureMemory,
  nowIso,
  touchRelevantMemories,
  updateConversationSummary,
  upsertConversation,
} from '../services/memoryEngine'
import { requestModelEmbeddings } from '../services/modelProfiles'
import { addMemoryEventToState, applyAgentActionsToState, enqueueAgentTaskActions } from './agentActions'

interface UseChatDeps {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
  setNotice: Dispatch<SetStateAction<string>>
  character: CharacterCard
  conversation: ConversationState
}

export function useChat({ state, setState, setNotice, character, conversation }: UseChatDeps) {
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)

  async function handleSend() {
    const content = draft.trim()
    if (!content || isSending) return

    const userMessage = createMessage('user', content)
    const nextConversation = updateConversationSummary({
      ...conversation,
      messages: [...conversation.messages, userMessage],
      updatedAt: nowIso(),
    })
    const recallMode = isExplicitMemoryQuery(content)
    const touchedMemories = touchRelevantMemories(state.memories, content, {
      characterId: character.id,
      conversationId: nextConversation.id,
      memoryEmbeddings: state.memoryEmbeddings,
      maxItems: recallMode ? 18 : 12,
      recallMode,
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
    const embeddingContext = await prepareExternalEmbeddingContext(nextState, content, recallMode)
    const stateForPrompt = embeddingContext.state
    const requestBundle = buildPromptBundle(stateForPrompt, {
      embeddingModel: embeddingContext.embeddingModel,
      embeddingQueryVector: embeddingContext.embeddingQueryVector,
    })
    const usageLog = createMemoryUsageLog({
      bundle: requestBundle,
      conversation: nextConversation,
      character,
      userMessage,
    })
    const nextStateWithUsage = {
      ...stateForPrompt,
      memoryUsageLogs: [usageLog, ...stateForPrompt.memoryUsageLogs].slice(0, getMemoryUsageLogLimit()),
    }

    setState(nextStateWithUsage)
    setDraft('')
    setIsSending(true)
    setNotice(keptMemory ? (keptMemory.status === 'candidate' ? '发现一条待确认记忆' : '已捕捉并归档一条记忆') : '消息已送达')

    try {
      const result = await requestAssistantReply(requestBundle, nextState.settings)
      const assistantMessage = {
        ...createMessage('assistant', result.reply),
        agent: result.agent,
      }
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
      void enqueueAgentTaskActions(result.agent?.actions)
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

  return {
    draft,
    setDraft,
    isSending,
    handleSend,
  }
}

async function prepareExternalEmbeddingContext(
  state: AppState,
  query: string,
  recallMode: boolean,
): Promise<{ state: AppState; embeddingModel?: string; embeddingQueryVector?: number[] }> {
  if (!recallMode || !isCloudSyncConfigured()) return { state }

  const memories = state.memories
    .filter((memory) => memory.status === 'active' && memory.mentionPolicy !== 'silent' && memory.sensitivity !== 'critical')
    .sort((a, b) => b.priority - a.priority || (b.memoryStrength ?? 0) - (a.memoryStrength ?? 0))
    .slice(0, 31)
  if (memories.length === 0) return { state }

  try {
    const result = await withTimeout(
      requestModelEmbeddings(getSavedCloudToken(), {
        profileId: state.settings.modelProfileId || 'server-env',
        texts: [...memories.map(getMemoryEmbeddingInput), query],
      }),
      3_500,
    )
    const queryVector = result.embeddings[memories.length]
    if (!queryVector?.length) return { state }

    const embeddingModel = `external:${result.model}`
    return {
      state: {
        ...state,
        memoryEmbeddings: upsertMemoryEmbeddingRecordsFromVectors(
          memories,
          state.memoryEmbeddings,
          embeddingModel,
          result.embeddings.slice(0, memories.length),
        ),
      },
      embeddingModel,
      embeddingQueryVector: queryVector,
    }
  } catch {
    return { state }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error('embedding timeout')), timeoutMs)
    }),
  ])
}
