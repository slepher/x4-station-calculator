import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  TerraformingPlan,
  SavedTerraformingState,
  SavedModule,
  TerraformingExecutedSnapshot,
} from '@/types/x4'
import type { TerraformingData, TerraformingCluster } from './logic/terraformingTaskResolver'
import {
  buildArchiveRuntimeStats,
  buildCompletedProjectsFromExecutionLog,
  deductExecutionLogByArchiveDelta,
  getRuntimeTerraformingProjectIds,
  hasRollback,
  replayExecutionLog,
  subtractCountMaps,
  type DeductExecutionResult,
  type RebateKey,
  type TerraformingArchiveRuntimeBaseState,
  type TerraformingExecutedDelta,
  type TerraformingExecutionEntry,
} from './logic/terraformingRuntime'
import type { ArchiveStationData, SaveTerraformingCluster } from '@/types/saveArchive'
import { useGameDataStore } from './useGameDataStore'
import { useLiveProductionStore } from './useLiveProductionStore'
import { useSaveStore } from './useSaveStore'
import { CURRENT_TERRAFORMING_VERSION } from './logic/storageVersions'
import i18n from '@/i18n'

function stripMacroPrefix(macro: string): string {
  return macro.replace(/^macro\./, '')
}

function mapToRecord(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...map.entries()].filter(([, count]) => count > 0))
}

function recordToMap(record: Record<string, number> | undefined): Map<string, number> {
  return new Map(Object.entries(record ?? {}).filter(([, count]) => count > 0))
}

function rebateRuntimeKey(rb: { ware?: string; wareGroup?: string; amount: number }): RebateKey | null {
  if (rb.wareGroup) return { id: rb.wareGroup, type: 'wareGroup', value: rb.amount }
  if (rb.ware) return { id: rb.ware, type: 'ware', value: rb.amount }
  return null
}

function rebatesEqual(a: RebateKey[], b: RebateKey[]): boolean {
  if (a.length !== b.length) return false
  const normalize = (items: RebateKey[]) => [...items]
    .map(item => `${item.type}:${item.id}:${item.value}`)
    .sort()
  const na = normalize(a)
  const nb = normalize(b)
  return na.every((value, index) => value === nb[index])
}

function recordsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if ((a[key] ?? 0) !== (b[key] ?? 0)) return false
  }
  return true
}

export const useTerraformingStore = defineStore('terraforming', () => {
  const gameData = useGameDataStore()
  const liveStore = useLiveProductionStore()
  const saveStore = useSaveStore()

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
      syncedExecutedBaselineByCluster: {},
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

  function replaceExecutionLogAndSyncBaseline(entries: TerraformingExecutionEntry[]): void {
    syncExecutedBaselineForSelectedCluster()
    replaceExecutionLog(entries)
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

  const projectMap = computed(() => {
    return new Map((terraformingData.value?.projects ?? []).map(project => [project.id, project]))
  })

  const selectedArchiveTerraformingCluster = computed<SaveTerraformingCluster | null>(() => {
    if (!isLiveMode.value) return null
    const cluster = selectedCluster.value
    const archive = saveStore.selectedArchive
    if (!cluster || !archive?.terraforming_clusters) return null
    const clusterId = stripMacroPrefix(cluster.macro)
    return archive.terraforming_clusters[clusterId] ?? null
  })

  const archiveRuntimeBaseState = computed<TerraformingArchiveRuntimeBaseState | null>(() => {
    const runtime = selectedArchiveTerraformingCluster.value
    if (!runtime) return null
    const completedProjects = new Map<string, number>()
    for (const item of runtime.completedProjects) {
      if (item.completedCount > 0) completedProjects.set(item.projectId, item.completedCount)
    }
    const completedEvents = new Map<string, number>()
    for (const item of runtime.events) {
      const project = projectMap.value.get(item.eventId)
      if (project?.group === 'events' && project.repeatCooldown === null && item.completedCount > 0) {
        completedEvents.set(item.eventId, item.completedCount)
      }
    }
    const rebates = runtime.rebates
      .map(rebateRuntimeKey)
      .filter((item): item is RebateKey => item !== null)
    return {
      clusterId: runtime.clusterId,
      stats: buildArchiveRuntimeStats(selectedCluster.value, runtime.stats),
      completedProjects,
      completedEvents,
      rebates,
      activeProject: runtime.activeProject,
      retainedProjects: [...runtime.retainedProjects],
      missionComplete: runtime.missionComplete,
    }
  })

  function createExecutedSnapshot(base: TerraformingArchiveRuntimeBaseState | null): TerraformingExecutedSnapshot | null {
    const archive = saveStore.selectedArchive
    if (!archive || !base) return null

    const logInstanceOrder = executionLog.value.map(entry => entry.projectId)

    const usedCount = new Map<string, number>()
    const executedProjectOrder: string[] = []

    for (const pid of logInstanceOrder) {
      const archiveCount = base.completedProjects.get(pid) ?? 0
      const alreadyUsed = usedCount.get(pid) ?? 0
      if (alreadyUsed < archiveCount) {
        executedProjectOrder.push(pid)
        usedCount.set(pid, alreadyUsed + 1)
      }
    }

    for (const [pid, count] of base.completedProjects) {
      const alreadyUsed = usedCount.get(pid) ?? 0
      for (let i = alreadyUsed; i < count; i++) {
        executedProjectOrder.push(pid)
      }
    }

    return {
      archiveGuid: archive.meta.guid,
      archiveTime: archive.meta.time,
      completedProjects: mapToRecord(base.completedProjects),
      completedOneTimeEvents: mapToRecord(base.completedEvents),
      stats: { ...base.stats },
      rebates: base.rebates.map(rb => ({ ...rb })),
      activeProjectId: base.activeProject?.projectId,
      executedProjectOrder,
    }
  }

  const syncedExecutedBaseline = computed<TerraformingExecutedSnapshot | null>(() => {
    const plan = activePlan.value
    const clusterId = selectedCluster.value?.id
    if (!plan || !clusterId) return null
    return plan.syncedExecutedBaselineByCluster?.[clusterId] ?? null
  })

  const archiveExecutedDelta = computed<TerraformingExecutedDelta>(() => {
    const base = archiveRuntimeBaseState.value
    const baseline = syncedExecutedBaseline.value
    if (!base) {
      return {
        completedProjects: new Map(),
        completedOneTimeEvents: new Map(),
        hasArchiveAdvance: false,
        hasArchiveRollbackRisk: false,
        hasRuntimeStateChange: false,
      }
    }

    const baselineProjects = recordToMap(baseline?.completedProjects)
    const baselineEvents = recordToMap(baseline?.completedOneTimeEvents)
    const completedProjects = subtractCountMaps(base.completedProjects, baselineProjects)
    const completedOneTimeEvents = subtractCountMaps(base.completedEvents, baselineEvents)
    const hasArchiveRollbackRisk = hasRollback(base.completedProjects, baselineProjects)
      || hasRollback(base.completedEvents, baselineEvents)
    const hasArchiveAdvance = completedProjects.size > 0 || completedOneTimeEvents.size > 0
    const hasRuntimeStateChange = baseline === null
      || !recordsEqual(base.stats, baseline.stats)
      || !rebatesEqual(base.rebates, baseline.rebates)
      || (base.activeProject?.projectId ?? '') !== (baseline.activeProjectId ?? '')

    return {
      completedProjects,
      completedOneTimeEvents,
      hasArchiveAdvance,
      hasArchiveRollbackRisk,
      hasRuntimeStateChange,
    }
  })

  const deductedExecution = computed<DeductExecutionResult>(() => {
    const emptyDelta = { completedProjects: new Map<string, number>(), completedOneTimeEvents: new Map<string, number>() }
    const delta = archiveExecutedDelta.value
    return deductExecutionLogByArchiveDelta(
      executionLog.value,
      {
        completedProjects: delta.completedProjects ?? emptyDelta.completedProjects,
        completedOneTimeEvents: delta.completedOneTimeEvents ?? emptyDelta.completedOneTimeEvents,
      },
      projectMap.value,
    )
  })

  function syncExecutedBaselineForSelectedCluster(): void {
    const plan = activePlan.value
    const clusterId = selectedCluster.value?.id
    if (!plan || !clusterId) return
    const snapshot = createExecutedSnapshot(archiveRuntimeBaseState.value)
    if (!snapshot) return
    plan.syncedExecutedBaselineByCluster = {
      ...(plan.syncedExecutedBaselineByCluster ?? {}),
      [clusterId]: snapshot,
    }
    saveToStorage()
  }

  function clearExecutedBaselineForSelectedCluster(): void {
    const plan = activePlan.value
    const clusterId = selectedCluster.value?.id
    if (!plan || !clusterId) return
    if (!plan.syncedExecutedBaselineByCluster?.[clusterId]) return
    const next = { ...plan.syncedExecutedBaselineByCluster }
    delete next[clusterId]
    plan.syncedExecutedBaselineByCluster = next
    saveToStorage()
  }

  function importBlueprintSettingsToActivePlan(): void {
    const plan = activePlan.value
    if (!plan || plan.mode !== 'live') return
    const clusterId = plan.selectedClusterId
    if (!clusterId) return
    const blueprintPlan = savedPlans.value.list.find(item => item.mode === 'blueprint' && item.planId === '__default__')
    if (!blueprintPlan) return
    const blueprintLog = blueprintPlan.executionLogByCluster?.[clusterId] ?? []
    plan.executionLogByCluster = {
      ...plan.executionLogByCluster,
      [clusterId]: blueprintLog,
    }
    const nextBaselines = { ...(plan.syncedExecutedBaselineByCluster ?? {}) }
    delete nextBaselines[clusterId]
    plan.syncedExecutedBaselineByCluster = nextBaselines
    hydrateExecutionLogs()
    saveToStorage()
  }

  const completedProjects = computed<Map<string, number>>(() => {
    const cluster = selectedCluster.value
    const data = terraformingData.value
    if (!cluster || !data) return buildCompletedProjectsFromExecutionLog(deductedExecution.value.remainingLog)
    return replayExecutionLog(deductedExecution.value.remainingLog, cluster, data, {
      baseState: archiveRuntimeBaseState.value ?? undefined,
    }).finalCompleted
  })

  const currentStats = computed<Record<string, number>>(() => {
    const cluster = selectedCluster.value
    if (!cluster) return {}
    const data = terraformingData.value
    if (!data) return {}
    return replayExecutionLog(deductedExecution.value.remainingLog, cluster, data, {
      baseState: archiveRuntimeBaseState.value ?? undefined,
    }).finalStats
  })

  const currentCumulativeRebates = computed<RebateKey[]>(() => {
    const cluster = selectedCluster.value
    if (!cluster) return []
    const data = terraformingData.value
    if (!data) return []
    return replayExecutionLog(deductedExecution.value.remainingLog, cluster, data, {
      baseState: archiveRuntimeBaseState.value ?? undefined,
    }).finalRebates
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

  const sidebarClusters = computed(() => {
    const clusters = terraformingData.value?.clusters ?? []
    const stats = terraformingData.value?.stats ?? []
    const mapsData = gameData.maps
    const t = i18n.global.t.bind(i18n.global)
    return clusters.map(c => {
      const macro = c.macro?.replace('macro.', '')
      let nameId = ''
      if (mapsData && macro) {
        const clusterInfo = mapsData.clusters[macro]
        if (clusterInfo) {
          const sectorList = clusterInfo.sectors ?? []
          if (sectorList.length === 1 && sectorList[0]) {
            nameId = mapsData.sectors[sectorList[0]]?.nameId ?? ''
          } else {
            nameId = clusterInfo.nameId ?? ''
          }
        }
      }
      const resolvedName = nameId ? t(nameId) : c.id
      const temperatureStat = stats.find(s => s.id === 'temperature')
      let temperatureState = 2
      if (temperatureStat && c.initialStats?.temperature != null) {
        const tempValue = c.initialStats.temperature
        const range = temperatureStat.ranges.find(r => {
          const start = r.start ?? 0
          return tempValue >= start && tempValue <= r.end
        })
        if (range) temperatureState = range.state
      }
      return { id: c.id, name: resolvedName, nameId, temperatureState }
    })
  })

  function init(): void {
    const stored = loadFromStorage()
    if (stored) {
      savedPlans.value = stored
    }
    hydrateExecutionLogs()
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
    archiveRuntimeBaseState,
    archiveExecutedDelta,
    deductedExecution,
    syncedExecutedBaseline,
    completedProjects,
    currentStats,
    currentCumulativeRebates,
    runtimeProjectIds,
    hqStationName,
    hqArchiveStation,
    hqEffectiveModules,
    hqClusterId,
    sidebarClusters,
    ensurePlanForContext,
    createPlan,
    deletePlan,
    setActivePlan,
    selectCluster,
    appendExecution,
    removeExecution,
    setProjectCount,
    replaceExecutionLog,
    replaceExecutionLogAndSyncBaseline,
    syncExecutedBaselineForSelectedCluster,
    clearExecutedBaselineForSelectedCluster,
    importBlueprintSettingsToActivePlan,
    clearExecutionQueue,
    loadFromStorage,
    saveToStorage,
    hydrateExecutionLogs,
    init,
  }
})
