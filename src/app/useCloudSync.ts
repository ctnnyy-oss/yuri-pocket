import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, LocalBackupSummary, ModelProfileInput, ModelProfileSummary } from '../domain/types'
import {
  checkCloudHealth,
  type CloudBackupSummary,
  type CloudMetadata,
  createCloudBackup,
  downloadCloudBackup,
  getSavedCloudToken,
  isCloudSyncConfigured,
  listCloudBackups,
  pullCloudState,
  pushCloudState,
  saveCloudToken,
} from '../services/cloudSync'
import { migrateAppState } from '../data/migrations'
import {
  deleteModelProfile,
  fetchModelCatalog,
  listModelProfiles,
  saveModelProfile,
  testModelProfile,
  type ModelCatalogResult,
} from '../services/modelProfiles'
import { applyTrashRetention, normalizeTrashRetentionSettings } from '../services/trashRetention'
import { addMemoryEventToState } from './agentActions'
import { formatCloudStatus, formatCloudTime } from './formatters'

type CloudBusyTask = 'checking' | 'pulling' | 'pushing' | 'backing-up'

interface UseCloudSyncDeps {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
  setNotice: Dispatch<SetStateAction<string>>
  characterId: string
  makeLocalBackup: (reason: string) => Promise<LocalBackupSummary>
}

function createAutoPushSignature(state: AppState): string {
  return JSON.stringify(state)
}

export function useCloudSync({ state, setState, setNotice, characterId, makeLocalBackup }: UseCloudSyncDeps) {
  const [cloudToken, setCloudToken] = useState(() => getSavedCloudToken())
  const [cloudStatus, setCloudStatus] = useState(() => {
    if (!isCloudSyncConfigured()) return '云端后端未配置'
    return '云端直连已启用'
  })
  const [cloudMeta, setCloudMeta] = useState<CloudMetadata | null>(null)
  const [cloudBusy, setCloudBusy] = useState<CloudBusyTask | null>(null)
  const [cloudBackups, setCloudBackups] = useState<CloudBackupSummary[]>([])
  const [modelProfiles, setModelProfiles] = useState<ModelProfileSummary[]>([])
  const [modelProfileStatus, setModelProfileStatus] = useState(() => {
    if (!isCloudSyncConfigured()) return '模型配置会保存到本机 /api 保险箱'
    return '模型配置会保存到云端保险箱'
  })
  const [modelProfileBusy, setModelProfileBusy] = useState(false)
  const autoCloudReadyRef = useRef(false)
  const skipNextAutoPushRef = useRef(false)
  const cloudBusyRef = useRef<CloudBusyTask | null>(cloudBusy)
  const cloudMetaRef = useRef<CloudMetadata | null>(cloudMeta)
  const cloudTokenRef = useRef(cloudToken)
  const autoPushInFlightRef = useRef(false)
  const lastAutoPushSignatureRef = useRef('')

  useEffect(() => {
    cloudBusyRef.current = cloudBusy
    cloudMetaRef.current = cloudMeta
    cloudTokenRef.current = cloudToken
  }, [cloudBusy, cloudMeta, cloudToken])

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
    setModelProfileBusy(true)
    setModelProfileStatus('正在读取模型配置...')
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
      setModelProfileStatus('本地数据模式下，模型配置仍可保存到当前模型后端')
      return
    }

    setCloudStatus('正在自动连接云端...')
    setModelProfileStatus('正在读取模型配置...')
    try {
      const snapshot = await pullCloudState(cloudToken)
      if (snapshot.state) {
        const pulledState = migrateAppState(snapshot.state)
        skipNextAutoPushRef.current = true
        lastAutoPushSignatureRef.current = createAutoPushSignature(applyTrashRetention(pulledState))
        setState(pulledState)
        setCloudMeta({
          hasState: true,
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
        })
        setCloudStatus(`已自动读取云端 v${snapshot.revision}`)
        setNotice('云端数据已自动同步')
      } else {
        const stateToPush = applyTrashRetention(localState)
        const result = await pushCloudState(stateToPush, cloudToken, {
          baseRevision: snapshot.revision,
        })
        lastAutoPushSignatureRef.current = createAutoPushSignature(stateToPush)
        setCloudMeta({ hasState: true, revision: result.revision, updatedAt: result.updatedAt })
        setCloudStatus(`已创建云端同步 v${result.revision}`)
      }

      autoCloudReadyRef.current = true
      void refreshCloudBackups(cloudToken)
      void refreshModelProfileList(cloudToken)
    } catch (error) {
      autoCloudReadyRef.current = false
      setCloudStatus(error instanceof Error ? error.message : '自动连接云端失败')
      setModelProfileStatus('模型配置暂时没连上')
    }
  }, [cloudToken, refreshCloudBackups, refreshModelProfileList, setState, setNotice])

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

  function handleSaveCloudToken(token: string) {
    const cleanedToken = token.trim()
    saveCloudToken(cleanedToken)
    setCloudToken(cleanedToken)

    if (!cleanedToken) {
      setCloudMeta(null)
      setCloudStatus('云端口令已清空')
      setModelProfileStatus('模型保险箱需要云端口令后再读取')
      setNotice('云端口令已清空')
      return
    }

    setCloudStatus('云端口令已保存，正在检查连接...')
    setModelProfileStatus('云端口令已保存，正在读取模型配置...')
    setNotice('云端口令已保存')
    void refreshCloudMetadata(cleanedToken)
    void refreshModelProfileList(cleanedToken)
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
          characterId,
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
        characterId,
      })
      const result = await pushCloudState(stateToPush, cloudToken, {
        baseRevision: cloudMeta?.revision ?? 0,
      })
      setState(stateToPush)
      lastAutoPushSignatureRef.current = createAutoPushSignature(stateToPush)
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
      if (error instanceof Error && /版本|409|覆盖/.test(error.message)) {
        setNotice('云端版本已变化，请先读取云端或创建备份')
      }
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
          characterId,
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

  function handleRefreshCloud() {
    void refreshCloudMetadata(cloudToken)
  }

  async function handleSaveModelProfile(profile: ModelProfileInput) {
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

  async function handleFetchModelCatalog(input: { profileId?: string; profile?: ModelProfileInput }): Promise<ModelCatalogResult> {
    try {
      const token = cloudToken.trim()
      setModelProfileBusy(true)
      setModelProfileStatus('正在拉取模型列表...')
      const result = await fetchModelCatalog(token, input)
      setModelProfileStatus(`已拉取 ${result.models.length} 个模型`)
      setNotice('模型列表已更新')
      return result
    } catch (error) {
      setModelProfileStatus(error instanceof Error ? error.message : '模型列表拉取失败')
      setNotice('模型列表拉取失败')
      throw error
    } finally {
      setModelProfileBusy(false)
    }
  }

  const initModelProfiles = useCallback(async () => {
    await refreshModelProfileList()
  }, [refreshModelProfileList])

  const autoPush = useCallback((currentState: AppState) => {
    if (!autoCloudReadyRef.current || cloudBusyRef.current || autoPushInFlightRef.current) return
    if (skipNextAutoPushRef.current) {
      skipNextAutoPushRef.current = false
      return
    }

    const stateToPush = applyTrashRetention(currentState)
    const signature = createAutoPushSignature(stateToPush)
    if (signature === lastAutoPushSignatureRef.current) return

    autoPushInFlightRef.current = true
    void (async () => {
      try {
        const result = await pushCloudState(stateToPush, cloudTokenRef.current, {
          baseRevision: cloudMetaRef.current?.revision ?? 0,
        })
        const nextMeta = {
          hasState: true,
          revision: result.revision,
          updatedAt: result.updatedAt,
        }
        cloudMetaRef.current = nextMeta
        lastAutoPushSignatureRef.current = signature
        setCloudMeta(nextMeta)
        setCloudStatus(`自动保存 v${result.revision}`)
      } catch (error) {
        setCloudStatus(error instanceof Error ? error.message : '自动保存失败，请稍后手动检查云端状态')
      } finally {
        autoPushInFlightRef.current = false
      }
    })()
  }, [])

  const onSwitchToLocal = useCallback(() => {
    autoCloudReadyRef.current = false
    setCloudStatus('已切换为仅本地模式')
  }, [])

  const onSwitchToCloud = useCallback(() => {
    setCloudStatus('已切换为云端模式，正在连接...')
    void bootstrapCloudState(state)
  }, [bootstrapCloudState, state])

  return {
    cloudToken,
    cloudStatus,
    setCloudStatus,
    cloudMeta,
    setCloudMeta,
    cloudBusy,
    cloudBackups,
    modelProfiles,
    modelProfileStatus,
    setModelProfileStatus,
    modelProfileBusy,
    autoCloudReadyRef,
    skipNextAutoPushRef,
    refreshCloudBackups,
    refreshModelProfileList,
    refreshCloudMetadata,
    bootstrapCloudState,
    handleConnectCloud,
    handleSaveCloudToken,
    handlePullCloud,
    handlePushCloud,
    handleCreateCloudBackup,
    handleRefreshCloudBackups,
    handleDownloadCloudBackup,
    handleRefreshCloud,
    handleSaveModelProfile,
    handleDeleteModelProfile,
    handleTestModelProfile,
    handleFetchModelCatalog,
    initModelProfiles,
    autoPush,
    onSwitchToLocal,
    onSwitchToCloud,
  }
}
