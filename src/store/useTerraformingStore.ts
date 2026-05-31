import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  TerraformingPlan,
  SavedTerraformingState,
  SavedModule,
} from '@/types/x4'
import type { TerraformingData, TerraformingCluster } from './logic/terraformingTaskResolver'
import {
  buildCompletedProjectsFromExecutionLog,
  getRuntimeTerraformingProjectIds,
  replayExecutionLog,
  type TerraformingExecutionEntry,
} from './logic/terraformingRuntime'
import type { ArchiveStationData } from '@/types/saveArchive'
import { useGameDataStore } from './useGameDataStore'
import { useLiveProductionStore } from './useLiveProductionStore'
import { useActiveViewStore } from './useActiveViewStore'
import { CURRENT_TERRAFORMING_VERSION } from './logic/storageVersions'

export const useTerraformingStore = defineStore('terraforming', () => {
  const gameData = useGameDataStore()
  const liveStore = useLiveProductionStore()
  const activeViewStore = useActiveViewStore()

  function getStorageKey(): string {
    return gameData.getStorageKey('terraforming')
  }

  const savedPlans = ref<SavedTerraformingState>({
    version: CURRENT_TERRAFORMING_VERSION,
    activeId: null,
    list: [],
  })

  const expandedExecutionLogByCluster = ref<Record<string, TerraformingExecutionEntry[]>>({})
  const executionSeqByCluster = ref<Record<string, number>>({})

  function saveToStorage(): void {
    localStorage.setItem(getStorageKey(), JSON.stringify(savedPlans.value))
  }

  function loadFromStorage(): SavedTerraformingState | null {
    const raw = localStorage.getItem(getStorageKey())
    if (!raw) return null
    try {
      const data = JSON.parse(raw) as SavedTerraformingState
      if (data && Array.isArray(data.list) && typeof data.version === 'number') {
        return data
      }
      return null
    } catch {
      return null
    }
  }

  function hydrateExecutionLogs(): void {
    const plan = activePlan.value
    if (!plan) {
      expandedExecutionLogByCluster.value = {}
      executionSeqByCluster.value = {}
      return
    }

    const expanded: Record<string, TerraformingExecutionEntry[]> = {}
    const seqs: Record<string, number> = {}
    for (const [clusterId, projectIds] of Object.entries(plan.executionLogByCluster)) {
      expanded[clusterId] = projectIds.map((pid, i) => ({ id: `${clusterId}-exec-${i + 1}`, projectId: pid }))
      seqs[clusterId] = projectIds.length
    }
    expandedExecutionLogByCluster.value = expanded
    executionSeqByCluster.value = seqs
  }

  function syncExecutionLogToPlan(): void {
    if (!activePlan.value) return
    const compressed: Record<string, string[]> = {}
    for (const [clusterId, entries] of Object.entries(expandedExecutionLogByCluster.value)) {
      compressed[clusterId] = entries.map(e => e.projectId)
    }
    activePlan.value.executionLogByCluster = compressed
  }

  function ensurePlanForContext(mode: 'live' | 'blueprint', planId: string): string {
    const existing = savedPlans.value.list.find(p => p.mode === mode && p.planId === planId)
    if (existing) {
      if (savedPlans.value.activeId !== existing.id) {
        savedPlans.value.activeId = existing.id
        hydrateExecutionLogs()
        saveToStorage()
      }
      return existing.id
    }
    return createPlan(mode, planId)
  }

  function createPlan(mode: 'live' | 'blueprint', planId: string): string {
    const id = `tp-${Date.now()}`
    const plan: TerraformingPlan = {
      id,
      mode,
      planId,
      selectedClusterId: null,
      executionLogByCluster: {},
    }
    savedPlans.value.list.push(plan)
    savedPlans.value.activeId = id
    saveToStorage()
    hydrateExecutionLogs()
    return id
  }

  function deletePlan(id: string): void {
    const idx = savedPlans.value.list.findIndex(p => p.id === id)
    if (idx === -1) return
    savedPlans.value.list.splice(idx, 1)
    if (savedPlans.value.activeId === id) {
      savedPlans.value.activeId = savedPlans.value.list[0]?.id || null
      hydrateExecutionLogs()
    }
    saveToStorage()
  }

  function setActivePlan(id: string | null): void {
    savedPlans.value.activeId = id
    hydrateExecutionLogs()
    saveToStorage()
  }

  function getExecutionLogForCluster(clusterId: string): TerraformingExecutionEntry[] {
    return expandedExecutionLogByCluster.value[clusterId] || []
  }

  function setExecutionLogForCluster(clusterId: string, log: TerraformingExecutionEntry[]): void {
    expandedExecutionLogByCluster.value = {
      ...expandedExecutionLogByCluster.value,
      [clusterId]: log,
    }
    syncExecutionLogToPlan()
    saveToStorage()
  }

  function selectCluster(clusterId: string): void {
    if (!activePlan.value) return
    activePlan.value.selectedClusterId = clusterId
    activeViewStore.activeTerraformingClusterId = clusterId
    saveToStorage()
  }

  function appendExecution(projectId: string, count: number): void {
    const clusterId = activePlan.value?.selectedClusterId
    if (!clusterId) return
    const currentLog = getExecutionLogForCluster(clusterId)
    const seq = (executionSeqByCluster.value[clusterId] ?? currentLog.length) + 1
    const newEntries: TerraformingExecutionEntry[] = []
    for (let i = 0; i < count; i++) {
      newEntries.push({ id: `${clusterId}-exec-${seq + i}`, projectId })
    }
    executionSeqByCluster.value = {
      ...executionSeqByCluster.value,
      [clusterId]: seq + count - 1,
    }
    setExecutionLogForCluster(clusterId, [...currentLog, ...newEntries])
  }

  function removeExecution(entryId: string): void {
    const clusterId = activePlan.value?.selectedClusterId
    if (!clusterId) return
    const currentLog = getExecutionLogForCluster(clusterId)
    const nextLog = currentLog.filter(entry => entry.id !== entryId)
    if (nextLog.length === currentLog.length) return
    setExecutionLogForCluster(clusterId, nextLog)
  }

  function setProjectCount(projectId: string, count: number): void {
    const clusterId = activePlan.value?.selectedClusterId
    if (!clusterId) return
    const currentCount = completedProjects.value.get(projectId) ?? 0
    if (count > currentCount) {
      appendExecution(projectId, count - currentCount)
      return
    }
    if (count < currentCount) {
      const log = getExecutionLogForCluster(clusterId)
      let removed = 0
      const nextEntries: TerraformingExecutionEntry[] = []
      for (let i = log.length - 1; i >= 0; i--) {
        const entry = log[i]!
        if (entry.projectId === projectId && removed < currentCount - count) {
          removed++
        } else {
          nextEntries.unshift(entry)
        }
      }
      setExecutionLogForCluster(clusterId, nextEntries)
    }
  }

  function replaceExecutionLog(entries: TerraformingExecutionEntry[]): void {
    const clusterId = activePlan.value?.selectedClusterId
    if (!clusterId) return
    const normalized = entries.map((e, i) => ({
      id: e.id || `${clusterId}-exec-${i + 1}`,
      projectId: e.projectId,
    }))
    setExecutionLogForCluster(clusterId, normalized)
  }

  function clearExecutionQueue(): void {
    const clusterId = activePlan.value?.selectedClusterId
    if (!clusterId) return
    setExecutionLogForCluster(clusterId, [])
  }

  const isLiveMode = computed(() => activePlan.value?.mode === 'live')
  const isBlueprintMode = computed(() => activePlan.value?.mode === 'blueprint')

  const activePlan = computed(() =>
    savedPlans.value.list.find(p => p.id === savedPlans.value.activeId) ?? null
  )

  const terraformingData = computed<TerraformingData | null>(() => {
    return gameData.terraformingData
  })

  const selectedCluster = computed<TerraformingCluster | null>(() => {
    if (!terraformingData.value) return null
    const id = activePlan.value?.selectedClusterId ?? null
    if (!id) return null
    return terraformingData.value.clusters.find(c => c.id === id) || null
  })

  const executionLog = computed<TerraformingExecutionEntry[]>(() => {
    const clusterId = activePlan.value?.selectedClusterId
    if (!clusterId) return []
    return getExecutionLogForCluster(clusterId)
  })

  const completedProjects = computed<Map<string, number>>(() => {
    return buildCompletedProjectsFromExecutionLog(executionLog.value)
  })

  const currentStats = computed<Record<string, number>>(() => {
    const cluster = selectedCluster.value
    if (!cluster) return {}
    const data = terraformingData.value
    if (!data) return {}
    return replayExecutionLog(executionLog.value, cluster, data).finalStats
  })

  const runtimeProjectIds = computed<string[]>(() => {
    const cluster = selectedCluster.value
    if (!cluster) return []
    return getRuntimeTerraformingProjectIds(cluster)
  })

  const hqStationName = computed<string>(() => {
    if (!isLiveMode.value) return ''
    return liveStore.terraformingHqStationName ?? ''
  })

  const hqArchiveStation = computed<ArchiveStationData | null>(() => {
    if (!isLiveMode.value) return null
    return liveStore.terraformingHqArchiveStation ?? null
  })

  const hqEffectiveModules = computed<SavedModule[]>(() => {
    if (!isLiveMode.value) return []
    return liveStore.terraformingHqEffectiveModules ?? []
  })

  const hqClusterId = computed<string | null>(() => {
    if (!isLiveMode.value) return null
    return liveStore.terraformingHqClusterId ?? null
  })

  function init(): void {
    const stored = loadFromStorage()
    if (stored) {
      savedPlans.value = stored
    }
    hydrateExecutionLogs()

    const savedClusterId = activeViewStore.activeTerraformingClusterId
    const clusterIds = terraformingData.value?.clusters.map(c => c.id) ?? []
    if (savedClusterId && clusterIds.includes(savedClusterId)) {
      if (activePlan.value) {
        activePlan.value.selectedClusterId = savedClusterId
      }
    }
    saveToStorage()
  }

  return {
    savedPlans,
    activePlan,
    isLiveMode,
    isBlueprintMode,
    terraformingData,
    selectedCluster,
    executionLog,
    completedProjects,
    currentStats,
    runtimeProjectIds,
    hqStationName,
    hqArchiveStation,
    hqEffectiveModules,
    hqClusterId,
    ensurePlanForContext,
    createPlan,
    deletePlan,
    setActivePlan,
    selectCluster,
    appendExecution,
    removeExecution,
    setProjectCount,
    replaceExecutionLog,
    clearExecutionQueue,
    loadFromStorage,
    saveToStorage,
    hydrateExecutionLogs,
    init,
  }
})
