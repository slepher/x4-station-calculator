import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch, shallowRef } from 'vue'
import type {
  ProductionWorkbenchCapabilities,
  ProductionSessionState,
  ProductionContextState,
  ProductionStationState,
  AllocationVolumeGroup,
  AllocationCargoOnlyItem
} from '@/types/production-workbench-contract'
import { buildAllocationVolumeGroups, buildAllocationCargoOnlyItems } from './logic/buildAllocationVolumeGroups'
import type { SectorInternalData } from '@/types/x4'
import type { PlayerStationRecord, ArchiveStationData, BuildStorageEntry, PlayerStationEntry, WareAmount } from '@/types/saveArchive'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import { buildStationComponentGapFlows } from './logic/stationGapViewModel'
import { classifyAndEnrichFlows } from './logic/empireFlowFacade'
import { deriveProductionFlows } from './logic/calculateWareFlowDerived'
import type { SavedModule, StationSettings, StationPlan, StationType, BindingStationPlan, TradeStationBinding, X4Module } from '@/types/x4'

import i18n from '@/i18n'
import { useGameDataStore } from './useGameDataStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useSaveStore } from './useSaveStore'
import { useActiveViewStore } from './useActiveViewStore'
import { DEFAULT_STATION_SETTINGS, type StationComputeDeps } from './state/stationSettings'
import { StationDerivedMap, type StationDerivedStaticDeps } from './state/StationDerivedMap'
import { deepClone } from '@/utils/deepClone'
import {
  createEmpireSourceView,
  computeActiveTransitSectorId,
  toTransitTabId
} from './logic/empireSourceView'
import { createEmpireFlowFacade } from './logic/empireFlowFacade'
import {
  buildCanonicalPlanningStationState,
  buildDerivedActiveStationState,
  buildDerivedTransitState
} from './logic/productionStationShared'
import { toProductionStation } from './logic/liveStationResolver'
import { loadPlayerStationsFlatByArchiveId, createArchiveId } from '@/db/saveArchiveDB'
import { createProductionModuleActions } from './actions/productionModuleActions'
import { createProductionWareRuleActions } from './actions/productionWareRuleActions'
import { createProductionSettingActions, doesStationSettingsAffectFlowMap } from './actions/productionSettingActions'
import type { TerraformingData, TerraformingCluster } from './logic/terraformingTaskResolver'
import {
  buildCompletedProjectsFromExecutionLog,
  computeTerraformingRuntimeStats,
  type TerraformingExecutionEntry,
  getRuntimeTerraformingProjectIds,
} from './logic/terraformingRuntime'
import { maxSavedModules } from './logic/planningRecommendedModules'

function mergeSavedModules(modules: SavedModule[]): SavedModule[] {
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const module of modules) {
    if (!counts.has(module.id)) order.push(module.id)
    counts.set(module.id, (counts.get(module.id) || 0) + module.count)
  }
  return order
    .map((id) => ({ id, count: counts.get(id) || 0 }))
    .filter((module) => module.count > 0)
}

function hasPendingSavedModules(target: SavedModule[], built: SavedModule[]): boolean {
  const builtCounts = new Map(mergeSavedModules(built).map((module) => [module.id, module.count]))
  for (const module of mergeSavedModules(target)) {
    const builtCount = builtCounts.get(module.id) || 0
    if (module.count > builtCount) return true
  }
  return false
}

function getProducedWareIds(modules: SavedModule[], modulesMap: Record<string, X4Module>): string[] {
  const wareIds = new Set<string>()
  for (const module of modules) {
    if (module.count <= 0) continue
    const moduleInfo = modulesMap[module.id]
    if (!moduleInfo) continue
    for (const wareId of Object.keys(moduleInfo.outputs || {})) {
      wareIds.add(wareId)
    }
  }
  return [...wareIds]
}

function archiveCurrentTotalModulesFromArchive(archive: ArchiveStationData | null | undefined): SavedModule[] {
  if (!archive) return []
  return mergeSavedModules([
    ...(archive.modules || []),
    ...(archive.building?.modules || [])
  ])
}

export const useLiveProductionStore = defineStore('liveProduction', () => {
  type DirtyBindingState = 'all' | Set<string> | null

  const gameData = useGameDataStore()
  const saveBindingStore = useSaveBindingStore()
  const saveStore = useSaveStore()
  const activeViewStore = useActiveViewStore()
  const { activeBinding } = storeToRefs(saveBindingStore)
  const { selectedArchive } = storeToRefs(saveStore)

  const isReady = ref(false)
  const isTerraformingMode = computed({
    get: () => activeViewStore.activeBindingWorkbench === 'terraforming',
    set: (val: boolean) => {
      if (val) {
        activeViewStore.activeBindingWorkbench = 'terraforming'
      } else {
        if (activeViewStore.activeBindingWorkbench === 'terraforming') {
          activeViewStore.activeBindingWorkbench = 'overview'
        }
      }
    }
  })
  const terraformingSelectedClusterId = ref<string | null>(null)
  const terraformingCompletedProjectsByCluster = ref<Record<string, Map<string, number>>>({})
  const terraformingExecutionLogByCluster = ref<Record<string, TerraformingExecutionEntry[]>>({})
  const terraformingExecutionSeqByCluster = ref<Record<string, number>>({})
  const terraformingHousingBuiltByCluster = ref<Record<string, number>>({})
  const buildPriceMultiplier = ref(0.5)
  const overviewBuyMultiplier = ref(0.5)
  const overviewSellMultiplier = ref(0.5)
  const playerStationRecords = ref<PlayerStationRecord[]>([])

  const productionSource = computed<'save-binding'>(() => 'save-binding')

  const planningDerivedMap = shallowRef<StationDerivedMap | null>(null)
  const liveFlowMap = shallowRef<StationDerivedMap | null>(null)
  const dirtyBindingStationIds = ref<DirtyBindingState>(null)

  function markAllDirty() {
    dirtyBindingStationIds.value = 'all'
  }

  function markStationDirty(stationId: string) {
    const dirty = dirtyBindingStationIds.value
    if (dirty === 'all') return
    if (dirty === null) {
      dirtyBindingStationIds.value = new Set([stationId])
    } else {
      dirty.add(stationId)
    }
  }

  function diffStationSettings(
    previous: StationSettings,
    next: StationSettings
  ): Partial<StationSettings> {
    const patch: Partial<StationSettings> = {}
    const keys = new Set<keyof StationSettings>([
      ...Object.keys(previous) as Array<keyof StationSettings>,
      ...Object.keys(next) as Array<keyof StationSettings>
    ])

    keys.forEach((key) => {
      if (previous[key] !== next[key]) {
        Object.assign(patch, { [key]: next[key] })
      }
    })

    return patch
  }

  function createDerivedMap(): StationDerivedMap | null {
    const deps = getDerivedStaticDeps()
    if (!deps) return null
    const sourceView = planningSourceView
    const sectorLinks = sourceView?.productionSectorLinks?.value ?? []
    return new StationDerivedMap(deps, {
      hasSector: true,
      sectorLinks,
      refreshKey
    })
  }

  function ensurePlanningDerivedMap(): StationDerivedMap | null {
    if (planningDerivedMap.value) return planningDerivedMap.value
    const map = createDerivedMap()
    if (!map) return null
    planningDerivedMap.value = map
    return map
  }

  function ensureLiveDerivedMap(): StationDerivedMap | null {
    if (liveFlowMap.value) return liveFlowMap.value
    const map = createDerivedMap()
    if (!map) return null
    liveFlowMap.value = map
    return map
  }

  function resetPlanningDerivedMap(): StationDerivedMap | null {
    const map = createDerivedMap()
    planningDerivedMap.value = map
    return map
  }

  function resetLiveDerivedMap(): StationDerivedMap | null {
    const map = createDerivedMap()
    liveFlowMap.value = map
    return map
  }

  function syncLiveFlowMap() {
    const deps = getComputeDeps()
    const map = resetLiveDerivedMap()
    if (!deps || !map) return

    derivedBindingStations.value.forEach((item) => {
      const station = item.station
      syncLiveFlowMapForStation(station.id, deps)
    })
  }

  function syncLiveFlowMapForStation(stationId: string, deps?: StationComputeDeps): void {
    const computeDeps = deps || getComputeDeps()
    if (!computeDeps) return

    const archiveStationRecord = playerStationRecords.value.find(
      (r) => r.code === stationId && r.type === 'station'
    )
    if (!archiveStationRecord) return

    const stationEntry = archiveStationRecord.data as PlayerStationEntry
    if (!stationEntry.modules) return

    const modules: SavedModule[] = []
    for (const mod of Object.values(stationEntry.modules)) {
      const matchedModule = mod.module_id
      if (matchedModule) {
        const existing = modules.find((m) => m.id === matchedModule)
        if (existing) {
          existing.count += mod.amount
        } else {
          modules.push({ id: matchedModule, count: mod.amount })
        }
      }
    }

    const station = derivedBindingStations.value.find(item => item.station.id === stationId)?.station
    const liveSettings: StationSettings = station?.settings || DEFAULT_STATION_SETTINGS

    const workforces = stationEntry.workforces
    const hasWorkforce = workforces && workforces.length > 0

    const map = ensureLiveDerivedMap()
    if (!map) return
    const liveLockedWares = station?.lockedWares || []
    const liveWarePriority = buildLiveModeWarePriority(stationId)

    map.upsertStation(stationId, {
      modulesMode: 'full',
      sectorId: station?.sectorId,
      modules,
      settings: liveSettings,
      lockedWares: liveLockedWares,
      warePriority: liveWarePriority,
      workforces: hasWorkforce ? workforces : undefined,
      archiveSemanticsSource: {
        tag: stationEntry.tag,
        factoryGroup: stationEntry.factoryGroup,
        productionProfile: stationEntry.productionProfile,
        profileName: stationEntry.profileName
      }
    })
  }

  function buildLiveModeWarePriority(stationId: string): Record<string, number> {
    return planningDerivedMap.value?.getCache(stationId)?.warePriorityLevels || {}
  }

  function syncAfterStationFlowChange(stationId: string, _deps: StationComputeDeps): void {
    markStationDirty(stationId)
  }

  async function loadPlayerStationRecords() {
    const archive = selectedArchive.value
    const binding = activeBinding.value
    if (!archive || !archive.isValid || !binding || archive.meta.guid !== binding.gameGuid) {
      playerStationRecords.value = []
      return
    }
    const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)
    try {
      const records = await loadPlayerStationsFlatByArchiveId(gameData, archiveId)
      playerStationRecords.value = records
    } catch (e) {
      console.error('[LiveProductionStore] Failed to load player stations:', e)
      playerStationRecords.value = []
    }
  }

  watch(selectedArchive, async () => {
    const archive = selectedArchive.value
    const binding = activeBinding.value
    if (!archive || !binding || archive.meta.guid !== binding.gameGuid) return
    if (binding.selectedArchiveTime) return
    await loadPlayerStationRecords()
    syncLiveFlowMap()
  })

  watch(
    () => saveStore.savedArchivesState.list.length,
    async (newLen, oldLen) => {
      if (newLen >= oldLen) return
      const binding = activeBinding.value
      if (!binding) return

      const archiveGroup = saveStore.archives.get(binding.gameGuid)
      const hasValidArchive = archiveGroup?.saves.some(s => s.isValid) ?? false

      if (!hasValidArchive) {
        activeViewStore.activeBinding = null
        activeViewStore.activeBindingStation = null
        saveBindingStore.clearDraft()
        playerStationRecords.value = []
        planningDerivedMap.value?.clear()
        liveFlowMap.value?.clear()
        dirtyBindingStationIds.value = null
      } else {
        const bindingRecord = saveBindingStore.getBindingByGameGuid(binding.gameGuid)
        if (bindingRecord) {
          const currentTime = bindingRecord.selectedArchiveTime
          const archiveStillValid = currentTime !== null
            ? archiveGroup!.saves.some(s => s.meta.time === currentTime && s.isValid)
            : false
          if (!archiveStillValid && currentTime !== null) {
            const latest = [...archiveGroup!.saves].sort((a, b) => b.meta.time - a.meta.time).find(s => s.isValid)
            if (latest) {
              saveBindingStore.setSelectedArchiveTime(binding.gameGuid, latest.meta.time)
            }
          }
        }
        await activateBinding(binding.gameGuid)
      }
    }
  )

  const activeStationId = computed({
    get: () => activeViewStore.activeBindingStation,
    set: (id: string | null) => activeViewStore.activeBindingStation = id
  })

  const activeBindingName = computed({
    get: () => saveBindingStore.activeBindingName,
    set: (name: string) => { saveBindingStore.activeBindingName = name }
  })

  const archiveCoveredStationIds = computed<Set<string>>(() => {
    const coveredIds = new Set<string>()
    const stationCodes = new Set(
      playerStationRecords.value
        .filter((record) => record.type === 'station')
        .map((record) => record.code)
    )

    const binding = activeBinding.value
    if (!binding) {
      stationCodes.forEach((code) => coveredIds.add(code))
      return coveredIds
    }

    const matchedCodes = new Set<string>()

    binding.stationPlans.forEach((plan) => {
      const archiveCode = plan.saveStationCode || plan.id
      if (stationCodes.has(archiveCode)) {
        coveredIds.add(plan.id)
        matchedCodes.add(archiveCode)
      }
    })

    stationCodes.forEach((code) => {
      if (!matchedCodes.has(code)) {
        coveredIds.add(code)
      }
    })

    return coveredIds
  })

  const planningSourceView = createEmpireSourceView({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    playerStationRecords,
    sectorsMap: computed(() => gameData.maps.sectors),
    visibleStationIds: ref(null)
  })

  const liveSourceView = createEmpireSourceView({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    playerStationRecords,
    sectorsMap: computed(() => gameData.maps.sectors),
    visibleStationIds: archiveCoveredStationIds
  })

  const sectors = planningSourceView.sectors
  const sectorLinks = planningSourceView.sectorLinks
  const productionStations = planningSourceView.productionStations
  const orderedStationsBySector = planningSourceView.orderedStationsBySector
  const derivedBindingStations = planningSourceView.derivedBindingStations

  const planningFlowFacade = createEmpireFlowFacade({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    sourceView: planningSourceView,
    modulesMap: computed(() => gameData.modulesMap),
    waresMap: computed(() => gameData.waresMap),
    flowMap: computed(() => planningDerivedMap.value)
  })

  const liveFlowFacade = createEmpireFlowFacade({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    sourceView: liveSourceView,
    modulesMap: computed(() => gameData.modulesMap),
    waresMap: computed(() => gameData.waresMap),
    flowMap: computed(() => liveFlowMap.value)
  })

  const refreshKey = ref(0)

  const empireProductionFlows = computed(() => {
    void refreshKey.value
    return planningDerivedMap.value?.getEmpireFlows() || []
  })
  const empireDerivedProductionFlows = computed(() => {
    const raw = empireProductionFlows.value
    if (raw.length === 0) return []
    const deps = getDerivedStaticDeps()
    if (!deps) return []
    const stationNameMap: Record<string, string> = {}
    planningSourceView.productionStations.value.forEach(s => { stationNameMap[s.id] = s.name })
    const sectorNameMap: Record<string, string> = {}
    planningSourceView.sectors.value.forEach(s => { sectorNameMap[s.id] = s.name })
    return deriveProductionFlows({
      productionFlows: raw,
      autoIndustryModules: [],
      plannedModules: [],
      modulesMap: deps.modulesMap,
      waresMap: deps.waresMap,
      stationNameMap,
      sectorNameMap,
      settings: {
        racePreference: 'argon',
        resourceBufferHours: 2,
        primaryProductBufferHours: 2,
        secondaryProductBufferHours: 2,
        buyMultiplier: overviewBuyMultiplier.value,
        sellMultiplier: overviewSellMultiplier.value,
        transportMinutes: 30,
        transportShipCapacity: 0,
        sunlight: 100
      },
      warePriorityLevels: {}
    })
  })
  const activeTransitSectorId = computed(() => computeActiveTransitSectorId(
    activeStationId.value,
    sectors.value
  ))

  function getDerivedBindingStation(stationId: string): StationPlan | null {
    return planningSourceView.getDerivedBindingStation(stationId)
  }

  function getStationById(stationId: string): StationPlan | null {
    return planningSourceView.getStationById(stationId)
  }

  const workbenchMode = computed<'station' | 'transit' | 'overview' | 'terraforming'>(() => {
    if (isTerraformingMode.value) return 'terraforming'
    return activeTransitSectorId.value ? 'transit' : (activeStationId.value ? 'station' : 'overview')
  })

  const terraformingData = computed<TerraformingData | null>(() => {
    return gameData.terraformingData
  })

  const terraformingSelectedCluster = computed<TerraformingCluster | null>(() => {
    if (!terraformingData.value) return null
    const id = terraformingSelectedClusterId.value
    if (!id) return null
    return terraformingData.value.clusters.find(c => c.id === id) || null
  })

  function getTerraformingExecutionLogForCluster(clusterId: string): TerraformingExecutionEntry[] {
    const existing = terraformingExecutionLogByCluster.value[clusterId]
    if (existing) return existing

    const counts = terraformingCompletedProjectsByCluster.value[clusterId]
    if (!counts) return []

    const log: TerraformingExecutionEntry[] = []
    let seq = 0
    for (const [projectId, count] of counts) {
      for (let i = 0; i < count; i += 1) {
        seq += 1
        log.push({ id: `${clusterId}-legacy-${seq}`, projectId })
      }
    }
    return log
  }

  function setTerraformingExecutionLogForCluster(clusterId: string, log: TerraformingExecutionEntry[]) {
    terraformingExecutionLogByCluster.value = {
      ...terraformingExecutionLogByCluster.value,
      [clusterId]: log,
    }
    terraformingCompletedProjectsByCluster.value = {
      ...terraformingCompletedProjectsByCluster.value,
      [clusterId]: buildCompletedProjectsFromExecutionLog(log),
    }
    persistTerraformingLogs(clusterId, log)
  }

  function nextTerraformingExecutionId(clusterId: string): string {
    const nextSeq = (terraformingExecutionSeqByCluster.value[clusterId] ?? 0) + 1
    terraformingExecutionSeqByCluster.value = {
      ...terraformingExecutionSeqByCluster.value,
      [clusterId]: nextSeq,
    }
    return `${clusterId}-exec-${nextSeq}`
  }

  function appendTerraformingExecutionEntries(clusterId: string, projectId: string, count: number) {
    if (count <= 0) return
    const log = [...getTerraformingExecutionLogForCluster(clusterId)]
    for (let i = 0; i < count; i += 1) {
      log.push({
        id: nextTerraformingExecutionId(clusterId),
        projectId,
      })
    }
    setTerraformingExecutionLogForCluster(clusterId, log)
  }

  function removeTailTerraformingExecutionEntries(clusterId: string, projectId: string, count: number) {
    if (count <= 0) return
    const log = [...getTerraformingExecutionLogForCluster(clusterId)]
    let remaining = count
    for (let i = log.length - 1; i >= 0 && remaining > 0; i -= 1) {
      if (log[i]?.projectId !== projectId) continue
      log.splice(i, 1)
      remaining -= 1
    }
    setTerraformingExecutionLogForCluster(clusterId, log)
  }

  function persistTerraformingLogs(clusterId: string, log: TerraformingExecutionEntry[]) {
    const binding = activeBinding.value
    if (!binding) return
    const logs = { ...binding.terraformingLogs }
    logs[clusterId] = log.map(e => e.projectId)
    binding.terraformingLogs = logs
  }

  function hydrateTerraformingLogs() {
    const binding = activeBinding.value
    if (!binding) return
    const entries = Object.entries(binding.terraformingLogs ?? {})

    const logs: Record<string, TerraformingExecutionEntry[]> = {}
    const seqs: Record<string, number> = {}
    for (const [clusterId, projectIds] of entries) {
      const parsed = projectIds.map((pid, i) => ({ id: `${clusterId}-exec-${i + 1}`, projectId: pid }))
      seqs[clusterId] = parsed.length
      logs[clusterId] = parsed
    }
    terraformingExecutionLogByCluster.value = logs
    terraformingExecutionSeqByCluster.value = seqs
    terraformingCompletedProjectsByCluster.value = Object.fromEntries(
      Object.entries(logs).map(([cid, log]) => [cid, buildCompletedProjectsFromExecutionLog(log)])
    )
    terraformingHousingBuiltByCluster.value = {}

    const savedClusterId = activeViewStore.activeTerraformingClusterId
    if (savedClusterId && logs[savedClusterId] !== undefined) {
      terraformingSelectedClusterId.value = savedClusterId
    } else {
      const hqCluster = findHqTerraformingCluster()
      terraformingSelectedClusterId.value = hqCluster
    }
  }

  function findHqTerraformingCluster(): string | null {
    const sectorClusterId = terraformingHqClusterId.value
    const clusters = terraformingData.value?.clusters
    if (!sectorClusterId || !clusters) return null
    for (const c of clusters) {
      if (c.macro === `macro.${sectorClusterId}` || c.macro === sectorClusterId) return c.id
    }
    return null
  }

  const terraformingExecutionLog = computed<TerraformingExecutionEntry[]>(() => {
    const clusterId = terraformingSelectedClusterId.value
    if (!clusterId) return []
    return getTerraformingExecutionLogForCluster(clusterId)
  })

  const terraformingCompletedProjects = computed<Map<string, number>>(() => {
    const clusterId = terraformingSelectedClusterId.value
    if (!clusterId) return new Map()
    return buildCompletedProjectsFromExecutionLog(terraformingExecutionLog.value)
  })

  const terraformingHousingBuilt = computed<number>(() => {
    const clusterId = terraformingSelectedClusterId.value
    if (!clusterId) return 0
    return terraformingHousingBuiltByCluster.value[clusterId] || 0
  })

  const terraformingCurrentStats = computed<Record<string, number>>(() => {
    const cluster = terraformingSelectedCluster.value
    if (!cluster) return {}
    return computeTerraformingRuntimeStats(cluster, terraformingCompletedProjects.value, terraformingData.value)
  })

  const terraformingRuntimeProjectIds = computed<string[]>(() => {
    const cluster = terraformingSelectedCluster.value
    if (!cluster) return []
    return getRuntimeTerraformingProjectIds(cluster, terraformingCurrentStats.value, terraformingCompletedProjects.value, terraformingData.value)
  })

  const terraformingHqStationCode = computed<string | null>(() => {
    const semantics = tabSemanticsById.value
    const stations = orderedStationsBySector.value
    for (const station of stations) {
      if (semantics[station.id]?.tag === 'playerhq') {
        return station.id
      }
    }
    return null
  })

  const terraformingHqStationName = computed<string>(() => {
    const code = terraformingHqStationCode.value
    if (!code) return ''
    const station = orderedStationsBySector.value.find(s => s.id === code)
    if (station?.name) return station.name
    return code
  })

  const terraformingHqArchiveStation = computed<ArchiveStationData | null>(() => {
    return getArchiveStationDataByCode(terraformingHqStationCode.value)
  })

  const terraformingHqEffectiveModules = computed<SavedModule[]>(() => {
    const archiveModules = archiveCurrentTotalModulesFromArchive(terraformingHqArchiveStation.value)
    const hqStationCode = terraformingHqStationCode.value
    if (!hqStationCode) return archiveModules
    const bindingPlan = activeBinding.value?.stationPlans.find(
      plan => plan.saveStationCode === hqStationCode
    )
    if (!bindingPlan?.modules?.length) return archiveModules
    return maxSavedModules(bindingPlan.modules, archiveModules)
  })

  const terraformingHqClusterId = computed<string | null>(() => {
    const archive = terraformingHqArchiveStation.value
    if (!archive?.sectorMacro) return null
    const sectorId = archive.sectorMacro
    const sector = gameData.maps?.sectors?.[sectorId]
    return sector?.cluster_id || null
  })

  const activeBindingStationId = computed(() => activeTransitSectorId.value ? null : activeStationId.value)

  const bindingStationPlan = computed<BindingStationPlan | null>(() => {
    const stationId = activeBindingStationId.value
    if (!stationId) return null
    const binding = activeBinding.value
    if (!binding) return null
    return binding.stationPlans.find(plan => plan.id === stationId) || null
  })

  const bindingTransitGroup = computed(() => {
    const sectorId = activeTransitSectorId.value
    if (!sectorId) return null
    const binding = activeBinding.value
    if (!binding) return null
    return binding.groups.find(g => g.id === sectorId) || null
  })

  const bindingStation = computed<BindingStationPlan | TradeStationBinding | null>(() => {
    return bindingStationPlan.value || bindingTransitGroup.value?.tradeStation || null
  })

  const planningStationDraft = computed<StationPlan | null>(() => {
    const stationId = activeBindingStationId.value
    if (!stationId) return null
    const plan = bindingStationPlan.value
    if (plan) {
      return toProductionStation(plan, gameData.maps.sectors)
    }
    const derived = planningSourceView.getDerivedBindingStation(stationId)
    const archive = archiveStation.value
    if (!derived && !archive) return null
    return {
      id: stationId,
      name: derived?.name || archive?.name || stationId,
      sectorId: derived?.sectorId,
      type: derived?.type || 'industrial',
      count: derived?.count,
      location: derived?.location,
      modules: [],
      settings: {
        ...DEFAULT_STATION_SETTINGS,
        ...derived?.settings
      },
      lastUpdated: derived?.lastUpdated || 0,
      lockedWares: [],
      warePriority: {},
      minerals: derived?.minerals || []
    }
  })

  const editableStationPlan = computed<StationPlan | null>(() => {
    if (workbenchMode.value !== 'station') return null
    return planningStationDraft.value
  })

  const archiveStationCode = computed<string | null>(() => {
    const binding = bindingStation.value
    if (binding?.saveStationCode) return binding.saveStationCode
    const stationId = activeBindingStationId.value
    return stationId || null
  })

  function getArchiveStationDataByCode(code: string | null): ArchiveStationData | null {
    if (!code || !activeBinding.value) return null

    const archive = selectedArchive.value
    if (!archive || archive.meta.guid !== activeBinding.value.gameGuid) return null

    const record = playerStationRecords.value.find(r => r.code === code && r.type === 'station')
    if (!record) return null
    
    const stationEntry = record.data as PlayerStationEntry
    const sectorMacro = record.sectorMacro
    
    const sector = gameData.maps?.sectors?.[sectorMacro]
    const sectorResources = gameData.mapResources.sectors[sectorMacro]?.resources || []
    const sectorData = {
      name: sector?.name || sectorMacro,
      nameId: sector?.nameId,
      resources: sectorResources.map((resource) => resource.ware),
      sunlight: Math.round((sector?.area?.sunlight ?? 1) * 100)
    }
    
    const position = stationEntry.relative_position ? {
      x: stationEntry.relative_position.x,
      y: stationEntry.relative_position.y,
      z: stationEntry.relative_position.z
    } : undefined
    
    const modules: SavedModule[] = []
    if (stationEntry.modules) {
      for (const mod of Object.values(stationEntry.modules)) {
        const matchedModule = mod.module_id
        if (matchedModule) {
          const existing = modules.find(m => m.id === matchedModule)
          if (existing) {
            existing.count += mod.amount
          } else {
            modules.push({ id: matchedModule, count: mod.amount })
          }
        }
      }
    }
    
    const buildingModules: SavedModule[] = []
    if (stationEntry.buildstorage_code) {
      const buildstorageRecord = playerStationRecords.value.find(
        r => r.code === stationEntry.buildstorage_code && r.type === 'buildstorage'
      )
      if (buildstorageRecord) {
        const buildstorageEntry = buildstorageRecord.data as BuildStorageEntry
        if (buildstorageEntry.modules) {
          for (const mod of Object.values(buildstorageEntry.modules)) {
            const matchedModule = mod.module_id
            if (matchedModule) {
              const existing = buildingModules.find(m => m.id === matchedModule)
              if (existing) {
                existing.count += mod.amount
              } else {
                buildingModules.push({ id: matchedModule, count: mod.amount })
              }
            }
          }
        }
        
        let inProgressModule: SavedModule | undefined
        if (buildstorageEntry.progress?.end !== undefined
          && buildstorageEntry.progress?.sequenceindex !== undefined
          && buildstorageEntry.constructions) {
          const seqIndex = buildstorageEntry.progress.sequenceindex
          const inProgressConst = buildstorageEntry.constructions[seqIndex]
          if (inProgressConst) {
            const matchedMod = (buildstorageEntry.modules || []).find(m => m.ref === inProgressConst.ref)
            if (matchedMod?.module_id) {
              inProgressModule = { id: matchedMod.module_id, count: 1 }
            }
          }
        }
        
        return {
          code: record.code,
          name: stationEntry.macro,
          sectorMacro,
          sector: sectorData,
          position,
          modules,
          workforces: stationEntry.workforces,
          tag: stationEntry.tag,
          factoryGroup: stationEntry.factoryGroup,
          productionProfile: stationEntry.productionProfile,
          profileName: stationEntry.profileName,
          building: {
            modules: buildingModules,
            cargo: buildstorageEntry.cargo || [],
            reservation: buildstorageEntry.reservation || [],
            inProgressModule
          },
          cargo: stationEntry.cargo,
          reservation: stationEntry.reservation,
          overrides: stationEntry.overrides,
          targetCounts: stationEntry.overrides?.max
        }
      }
    }
    
    return {
      code: record.code,
      name: stationEntry.macro,
      sectorMacro,
      sector: sectorData,
      position,
      modules,
      workforces: stationEntry.workforces,
      tag: stationEntry.tag,
      factoryGroup: stationEntry.factoryGroup,
      productionProfile: stationEntry.productionProfile,
      profileName: stationEntry.profileName,
      building: {
        modules: buildingModules,
        cargo: [],
        reservation: [],
        inProgressModule: undefined
      },
      cargo: stationEntry.cargo,
      reservation: stationEntry.reservation,
      overrides: stationEntry.overrides,
      targetCounts: stationEntry.overrides?.max
    }
  }

  function getArchiveStationDataByPlanId(planId: string): ArchiveStationData | null {
    const bindingPlan = activeBinding.value?.stationPlans.find((plan) => plan.id === planId) || null
    const archiveCode = bindingPlan?.saveStationCode || planId
    return getArchiveStationDataByCode(archiveCode)
  }

  const archiveStation = computed<ArchiveStationData | null>(() => {
    return getArchiveStationDataByCode(archiveStationCode.value)
  })

  const context = computed<ProductionContextState>(() => {
    const binding = bindingStation.value
    const archive = archiveStation.value
    
    const hasBinding = binding !== null
    const hasArchive = archive !== null
    const stationCode = archive?.code || ''
    
    let sectorName = ''
    let sectorNameId: string | undefined
    let sectorResources: string[] = []
    let sectorSunlight = 100
    let position: { x: number; y: number; z: number } | undefined
    
    if (archive) {
      sectorName = archive.sector?.name || ''
      sectorNameId = archive.sector?.nameId
      sectorResources = archive.sector?.resources || []
      sectorSunlight = archive.sector?.sunlight ?? 100
      position = archive.position
    } else if (binding) {
      const sectorMacro = binding.sectorMacro
      if (sectorMacro) {
        const sectorData = gameData.maps.sectors[sectorMacro]
        const mapSectorResources = gameData.mapResources.sectors[sectorMacro]?.resources || []
        if (sectorData) {
          sectorName = sectorData.name || ''
          sectorNameId = sectorData.nameId
          sectorResources = mapSectorResources.map((resource) => resource.ware)
          sectorSunlight = Math.round((sectorData.area?.sunlight ?? 1) * 100)
        }
      }
      position = binding.position
    }
    
    return {
      stationCode,
      sectorId: activeTransitSectorId.value || activeStation.value?.sectorId || null,
      sectorName,
      sectorNameId,
      position,
      sectorResources,
      sectorSunlight,
      hasBinding,
      hasArchive
    }
  })

  const mode = ref<'live' | 'planning'>('planning')

  const initialMode = computed<'live' | 'planning'>(() => {
    const hasBinding = bindingStation.value !== null
    const hasSave = archiveStation.value !== null
    if (hasBinding && hasSave) return 'planning'
    if (hasBinding && !hasSave) return 'planning'
    if (!hasBinding && hasSave) return 'live'
    return 'planning'
  })

  const canToggle = computed(() => {
    const hasBinding = bindingStation.value !== null
    const hasSave = archiveStation.value !== null
    return (hasBinding && hasSave) || (!hasBinding && hasSave)
  })

  const visualMode = computed<'planning' | 'live'>(() => {
    if (mode.value === 'planning') return 'planning'
    return archiveStation.value !== null ? 'live' : 'planning'
  })

  function toggleMode() {
    mode.value = mode.value === 'live' ? 'planning' : 'live'
  }

  const activeStation = computed<StationPlan | null>(() => {
    if (workbenchMode.value === 'station' && planningStationDraft.value) {
      return planningStationDraft.value
    }

    const binding = bindingStation.value
    if (binding) {
      if ('modules' in binding) {
        return toProductionStation(binding, gameData.maps.sectors)
      }
      return {
        id: binding.id,
        name: binding.name || binding.saveStationCode || 'Transit Hub',
        type: 'transit',
        modules: [],
        settings: { ...DEFAULT_STATION_SETTINGS, ...binding.settings || {} },
        lastUpdated: 0,
        lockedWares: [],
        warePriority: {}
      }
    }

    const archive = archiveStation.value
    if (!archive) return null

    return {
      id: archive.code,
      name: archive.name || archive.code,
      type: workbenchMode.value === 'transit' ? 'transit' : 'industrial',
      modules: [],
      settings: { ...DEFAULT_STATION_SETTINGS, sunlight: archive.sector?.sunlight ?? 100 },
      lastUpdated: 0,
      lockedWares: [],
      warePriority: {}
    }
  })

  function getComputeDeps(): StationComputeDeps | null {
    const { modulesMap, waresMap, workforceConsumptionMap, enforceDlcActivation } = gameData
    if (!gameData.isReady || !modulesMap || !waresMap || !workforceConsumptionMap) return null
    return {
      modulesMap,
      waresMap,
      workforceConsumptionMap,
      enforceDlcActivation,
      isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(modulesMap[moduleId]?.dlc_tag)
    }
  }

  function getDerivedStaticDeps(): StationDerivedStaticDeps | null {
    const deps = getComputeDeps()
    if (!deps) return null
    return {
      modulesMap: deps.modulesMap,
      waresMap: deps.waresMap,
      workforceConsumptionMap: deps.workforceConsumptionMap
    }
  }

  function hasBindingPlan(stationId: string): boolean {
    const binding = activeBinding.value
    if (!binding) return false
    return binding.stationPlans.some((plan) => plan.id === stationId)
  }

  function getArchiveSectorSunlight(stationId: string): number | null {
    const record = playerStationRecords.value.find((item) => item.code === stationId && item.type === 'station')
    if (!record) return null
    const sector = gameData.maps?.sectors?.[record.sectorMacro]
    if (!sector?.area?.sunlight && sector?.area?.sunlight !== 0) return null
    return Math.round(sector.area.sunlight * 100)
  }

  function buildPlanningSeed(station: StationPlan) {
    const usesBindingPlan = hasBindingPlan(station.id)
    const archiveSunlight = usesBindingPlan ? null : getArchiveSectorSunlight(station.id)
    const settings = {
      ...DEFAULT_STATION_SETTINGS,
      ...station.settings,
      sunlight: archiveSunlight ?? station.settings?.sunlight ?? DEFAULT_STATION_SETTINGS.sunlight
    }

    const archive = getArchiveStationDataByPlanId(station.id)
    const referenceModules: SavedModule[] = []
    if (archive) {
      referenceModules.push(...(archive.modules || []))
      referenceModules.push(...(archive.building?.modules || []))
    }

    return {
      modulesMode: 'plan' as const,
      sectorId: station.sectorId,
      modules: usesBindingPlan ? (station.modules || []) : [],
      settings,
      lockedWares: usesBindingPlan ? (station.lockedWares || []) : [],
      warePriority: usesBindingPlan ? (station.warePriority || {}) : {},
      referenceModules
    }
  }

  function syncAllBindingStationsToStateMap(): void {
    const stations = derivedBindingStations.value
    const map = resetPlanningDerivedMap()
    if (!map) return
    stations.forEach((item) => {
      const station = item.station
      map.upsertStation(station.id, buildPlanningSeed(station))
    })
  }

  const plannedModules = computed<SavedModule[]>({
    get: () => editableStationPlan.value?.modules || [],
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.modules = deepClone(value)
      station.lastUpdated = Date.now()
      const map = ensurePlanningDerivedMap()
      const deps = getDerivedStaticDeps()
      if (deps && map) {
        map.updateModules(station.id, station.modules)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
        syncAfterStationFlowChange(station.id, deps)
      }
    }
  })

  const lockedWares = computed<string[]>({
    get: () => editableStationPlan.value?.lockedWares || [],
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.lockedWares = deepClone(value)
      station.lastUpdated = Date.now()
      const map = ensurePlanningDerivedMap()
      const deps = getDerivedStaticDeps()
      if (deps && map) {
        map.updateLockedWares(station.id, station.lockedWares)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
        syncAfterStationFlowChange(station.id, deps)
      }
}
  })

  const warePriority = computed<Record<string, number>>({
    get: () => {
      const stationId = editableStationPlan.value?.id
      return stationId ? buildLiveModeWarePriority(stationId) : {}
    },
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.warePriority = deepClone(value)
      station.lastUpdated = Date.now()
      const map = ensurePlanningDerivedMap()
      const deps = getDerivedStaticDeps()
      if (deps && map) {
        map.updateWarePriority(station.id, station.warePriority)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
      }
    }
  })

  const settings = computed<StationSettings>({
    get: () => editableStationPlan.value?.settings || activeStation.value?.settings || { ...DEFAULT_STATION_SETTINGS },
    set: (value) => {
      if (workbenchMode.value === 'transit') {
        const sectorId = activeTransitSectorId.value
        if (!sectorId) return
        const group = activeBinding.value?.groups.find(g => g.id === sectorId)
        if (!group?.tradeStation) return
        group.tradeStation.settings = { ...DEFAULT_STATION_SETTINGS, ...value }
        saveBindingStore.updateGroup(activeBinding.value?.gameGuid || '', sectorId, { tradeStation: group.tradeStation })
        return
      }
      const station = editableStationPlan.value
      if (!station) return
      const previousSettings = { ...DEFAULT_STATION_SETTINGS, ...station.settings }
      station.settings = ({ ...DEFAULT_STATION_SETTINGS, ...value })
      station.lastUpdated = Date.now()
      const deps = getComputeDeps()
      const map = ensurePlanningDerivedMap()
      if (deps && map) {
        const changedSettings = diffStationSettings(previousSettings, station.settings)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
        if (doesStationSettingsAffectFlowMap(changedSettings)) {
          map.updateSettings(station.id, station.settings)
          syncAfterStationFlowChange(station.id, deps)
        }
      }
    }
  })

  const activeStationState = computed(() => {
    const stationId = activeStation.value?.id
    if (!stationId) {
      return {
        actualWorkforce: 0,
        currentEfficiency: 0,
        warePriorityLevels: {},
        productionFlows: [],
        plannedModules: [],
        effectivePlannedModules: [],
        recommendedModules: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        resolvedModules: [],
        modules: [],
        buildingModules: [],
        archiveBuiltModules: [],
        archiveCurrentTotalModules: [],
        archiveProducedWareIds: [],
        finalPlannedModules: [],
        effectiveTargetModules: []
      }
    }

    const currentMode = mode.value
    const flowMapToUse = currentMode === 'live' ? liveFlowMap.value : planningDerivedMap.value
    const cache = flowMapToUse?.getCache(stationId) || null

    if (currentMode === 'live') {
      const archiveModules: SavedModule[] = archiveStation.value?.modules || []
      const archiveCurrentTotalModules = mergeSavedModules([
        ...archiveModules,
        ...(archiveStation.value?.building?.modules || [])
      ])
      return {
        actualWorkforce: cache?.actualWorkforce || 0,
        currentEfficiency: cache?.currentEfficiency || 0,
        warePriorityLevels: buildLiveModeWarePriority(stationId),
        productionFlows: flowMapToUse?.getProductionFlows(stationId) || [],
        plannedModules: archiveModules,
        effectivePlannedModules: archiveCurrentTotalModules,
        recommendedModules: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        resolvedModules: archiveModules,
        modules: archiveModules,
        buildingModules: archiveStation.value?.building?.modules || [],
        buildingCargo: archiveStation.value?.building?.cargo || [],
        buildingReservation: archiveStation.value?.building?.reservation || [],
        buildingInProgress: archiveStation.value?.building?.inProgressModule || undefined,
        archiveBuiltModules: archiveModules,
        archiveCurrentTotalModules,
        archiveProducedWareIds: getProducedWareIds(archiveCurrentTotalModules, gameData.modulesMap),
        finalPlannedModules: archiveModules,
        effectiveTargetModules: archiveCurrentTotalModules
      }
    }

    const planned = plannedModules.value
    const hasArchive = archiveStation.value != null
    const planState = buildDerivedActiveStationState({
      stationId,
      plannedModules: planned,
      referenceModules: archiveCurrentTotalModulesFromArchive(archiveStation.value),
      deferSupportModules: hasArchive,
      settings: settings.value,
      cache,
      deps: getComputeDeps()
    })
    const archiveBuiltModules = archiveStation.value?.modules || []
    const archiveCurrentTotalModules = mergeSavedModules([
      ...archiveBuiltModules,
      ...(archiveStation.value?.building?.modules || [])
    ])
    const archiveProducedWareIds = getProducedWareIds(archiveCurrentTotalModules, gameData.modulesMap)
    const canonicalPlanState = !hasArchive
      ? null
      : buildCanonicalPlanningStationState({
          planState,
          archiveBuiltModules,
          archiveBuildingModules: archiveStation.value?.building?.modules || [],
          referenceModules: archiveCurrentTotalModules,
          settings: settings.value,
          deps: getComputeDeps()
        })
    return {
      ...(canonicalPlanState ?? planState),
      modules: (canonicalPlanState ?? planState).resolvedModules,
      buildingModules: [],
      buildingCargo: archiveStation.value?.building?.cargo || [],
      buildingReservation: archiveStation.value?.building?.reservation || [],
      buildingInProgress: archiveStation.value?.building?.inProgressModule || undefined,
      archiveBuiltModules,
      archiveCurrentTotalModules,
      archiveProducedWareIds,
      finalPlannedModules: canonicalPlanState?.finalPlannedModules || [],
      effectiveTargetModules: canonicalPlanState?.effectiveTargetModules || []
    }
  })

  const activeTransitState = computed(() => {
    const sectorId = activeTransitSectorId.value
    if (!sectorId) {
      return {
        plannedModules: [] as SavedModule[],
        resolvedModules: [] as SavedModule[],
        modules: [] as SavedModule[],
        buildingModules: [] as SavedModule[],
        buildingCargo: [] as WareAmount[],
        buildingReservation: [] as WareAmount[],
        autoIndustryModules: [] as SavedModule[],
        autoHabitationModules: [] as SavedModule[],
        autoInfrastructureModules: [] as SavedModule[],
        productionFlows: [] as any[],
        warePriorityLevels: {} as Record<string, number>,
        actualWorkforce: 0,
        currentEfficiency: 0,
        archiveBuiltModules: [] as SavedModule[],
        archiveCurrentTotalModules: [] as SavedModule[],
        archiveProducedWareIds: [] as string[],
        finalPlannedModules: [] as SavedModule[],
        effectiveTargetModules: [] as SavedModule[]
      }
    }
    const planningFlows = planningFlowFacade.getSectorFinalProductionFlows(sectorId)
    const flows = mode.value === 'live'
      ? liveFlowFacade.getSectorFinalProductionFlows(sectorId)
      : planningFlows
    const derived = buildDerivedTransitState({
      productionFlows: planningFlows,
      settings: settings.value,
      deps: getComputeDeps()
    })
    const archiveOverride = mode.value === 'live' && archiveStation.value
    return {
      plannedModules: [] as SavedModule[],
      effectivePlannedModules: [] as SavedModule[],
      recommendedModules: [] as SavedModule[],
      resolvedModules: archiveOverride ? archiveStation.value!.modules : derived.resolvedModules,
      modules: archiveOverride ? archiveStation.value!.modules : derived.resolvedModules,
      buildingModules: archiveOverride ? (archiveStation.value!.building?.modules || []) : [],
      buildingCargo: archiveOverride ? (archiveStation.value!.building?.cargo || []) : [],
      buildingReservation: archiveOverride ? (archiveStation.value!.building?.reservation || []) : [],
      buildingInProgress: archiveOverride ? (archiveStation.value!.building?.inProgressModule || undefined) : undefined,
      autoIndustryModules: [] as SavedModule[],
      autoHabitationModules: [] as SavedModule[],
      autoInfrastructureModules: derived.autoInfrastructureModules,
      productionFlows: flows,
      warePriorityLevels: {} as Record<string, number>,
      actualWorkforce: 0,
      currentEfficiency: 0,
      archiveBuiltModules: [] as SavedModule[],
      archiveCurrentTotalModules: [] as SavedModule[],
      archiveProducedWareIds: [] as string[],
      finalPlannedModules: [] as SavedModule[],
      effectiveTargetModules: [] as SavedModule[]
    }
  })

  const moduleScopeRef = ref<'built' | 'building' | 'all'>('built')

  const hasBuildingModules = computed(() => {
    if (mode.value === 'planning') {
      return hasPendingSavedModules(
        activeStationState.value.effectiveTargetModules || [],
        activeStationState.value.archiveBuiltModules || []
      )
    }
    return (archiveStation.value?.building?.modules?.length ?? 0) > 0
  })

  const canUseModuleScope = computed(() => hasBuildingModules.value)

  const moduleScope = computed<'built' | 'building' | 'all'>(() => {
    if (!canUseModuleScope.value) return 'built'
    return moduleScopeRef.value
  })

  const defaultModuleScope = computed<'built' | 'building'>(() => {
    return hasBuildingModules.value ? 'building' : 'built'
  })

  function cycleModuleScope() {
    const order: Array<'built' | 'building' | 'all'> = ['built', 'building', 'all']
    const idx = order.indexOf(moduleScopeRef.value)
    const nextIdx = (idx + 1) % order.length
    moduleScopeRef.value = order[nextIdx]!
  }

  watch(activeStationId, () => {
    if (activeStationId.value) {
      mode.value = initialMode.value
      moduleScopeRef.value = defaultModuleScope.value
    }
  })

  watch([canUseModuleScope, defaultModuleScope], ([enabled, nextDefault]) => {
    if (!enabled && moduleScopeRef.value !== 'built') {
      moduleScopeRef.value = 'built'
      return
    }
    if (enabled && moduleScopeRef.value === 'built' && nextDefault === 'building') {
      moduleScopeRef.value = 'building'
    }
  })

  const enforceDlcActivation = computed(() => gameData.enforceDlcActivation)

  function isModuleDlcActive(moduleId: string): boolean {
    return gameData.isDlcActive(gameData.modulesMap[moduleId]?.dlc_tag)
  }

  function isModuleCountEditable(moduleId: string): boolean {
    return !enforceDlcActivation.value || isModuleDlcActive(moduleId)
  }

  const effectivePriorityPlannedModules = computed(() =>
    activeStationState.value.effectivePlannedModules || plannedModules.value
  )

  const moduleActions = createProductionModuleActions<StationPlan>({
    getActiveStation: () => editableStationPlan.value,
    getComputeDeps,
    findModuleForWare: (wareId, racePreference) => gameData.findModuleForWare(wareId, racePreference),
    getRacePreference: () => settings.value.racePreference,
    getModulesMap: () => gameData.modulesMap,
    isModuleCountEditable,
    getPlannedModules: () => plannedModules.value,
    getAutoIndustryModules: () => activeStationState.value.autoIndustryModules,
    cloneModules: (modules) => deepClone(modules),
    now: () => Date.now(),
    commitStationMutation: (station) => {
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    },
    recomputeDerived: (station, _deps) => {
      const map = ensurePlanningDerivedMap()
      if (!map) return
      map.updateModules(station.id, station.modules || [])
    },
    afterCommit: (station, deps) => {
      syncAfterStationFlowChange(station.id, deps)
    }
  })

  const wareRuleActions = createProductionWareRuleActions<StationPlan>({
    getActiveStation: () => editableStationPlan.value,
    getComputeDeps,
    getPlannedModules: () => effectivePriorityPlannedModules.value,
    getAutoIndustryModules: () => activeStationState.value.autoIndustryModules,
    getModulesMap: () => gameData.modulesMap,
    getWaresMap: () => gameData.waresMap,
    isLockForbidden: (wareId) => {
      if (archiveStation.value === null) return false
      const archiveProducedWareIds: string[] = activeStationState.value.archiveProducedWareIds || []
      return archiveProducedWareIds.includes(wareId)
    },
    getLockedWares: () => lockedWares.value,
    getWarePriority: () => warePriority.value,
    cloneStringList: (values) => deepClone(values),
    clonePriorityMap: (values) => deepClone(values),
    now: () => Date.now(),
    commitStationMutation: (station) => {
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    },
    recompute: (station, _deps) => {
      const map = ensurePlanningDerivedMap()
      if (!map) return
      map.updateLockedWares(station.id, station.lockedWares || [])
      map.updateWarePriority(station.id, station.warePriority || {})
    },
    afterCommit: (station, deps) => {
      syncAfterStationFlowChange(station.id, deps)
    }
  })

  watch(
    () => gameData.isReady,
    (newReady, oldReady) => {
      if (newReady && !oldReady && activeBinding.value) {
        syncAllBindingStationsToStateMap()
      }
    }
  )

  watch(
    () => gameData.enforceDlcActivation,
    () => {
      if (!activeBinding.value) return
      const map = resetPlanningDerivedMap()
      if (!map) return
      derivedBindingStations.value.forEach(item => {
        const station = item.station
        map.upsertStation(station.id, buildPlanningSeed(station))
      })
    }
  )

  function syncBindingStationDerivedSnapshot(stationId: string) {
    markStationDirty(stationId)
  }

  function getStationComponentGapFlows(stationId: string | null): StationComponentGapFlows {
    const map = planningDerivedMap.value
    if (!map || !stationId) return { operations: [], supply: [] }
    const station = productionStations.value.find(s => s.id === stationId)
    if (!station) return { operations: [], supply: [] }
    const wm = gameData.waresMap || {}
    const sectorInternalData = new Map<string, SectorInternalData>()
    for (const sector of sectors.value) {
      const rawFlows = map.getSectorFlows(sector.id)
      const localGroupedFlows = classifyAndEnrichFlows(rawFlows, wm)
      sectorInternalData.set(sector.id, {
        sectorId: sector.id,
        planning: { sectorId: sector.id, localStationIds: [] },
        localGroupedFlows,
        storageModulePlans: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: []
      })
    }
    return buildStationComponentGapFlows({
      currentSectorId: station.sectorId || '',
      sectors: sectors.value,
      sectorLinks: sectorLinks.value,
      orderedStations: orderedStationsBySector.value,
      sectorInternalDataMap: sectorInternalData
    })
  }

  function updateBindingStationPlan(
    stationId: string,
    patch: Partial<Pick<StationPlan, 'name' | 'type' | 'modules' | 'settings' | 'sectorId' | 'lockedWares' | 'warePriority'>>
  ): boolean {
    const binding = activeBinding.value
    if (!binding) return false

    const existingPlan = binding.stationPlans.find(plan => plan.id === stationId)
    
    if (existingPlan) {
      return saveBindingStore.updateStationPlan(binding.gameGuid, stationId, {
        name: patch.name,
        type: patch.type,
        modules: patch.modules,
        settings: patch.settings,
        groupId: patch.sectorId,
        lockedWares: patch.lockedWares,
        warePriority: patch.warePriority
      })
    }

    const station = getDerivedBindingStation(stationId)
    const plan = saveBindingStore.upsertStationPlan({
      gameGuid: binding.gameGuid,
      saveStationCode: stationId,
      groupId: patch.sectorId ?? station?.sectorId ?? null,
      name: patch.name ?? station?.name ?? stationId,
      type: patch.type ?? station?.type ?? 'industrial',
      modules: patch.modules ?? station?.modules ?? [],
      settings: patch.settings ?? station?.settings ?? DEFAULT_STATION_SETTINGS,
      lockedWares: patch.lockedWares ?? [],
      warePriority: patch.warePriority ?? {}
    })
    if (!plan) return false
    const nextId = plan.id
    if (activeStationId.value === stationId) {
      activeStationId.value = nextId
    }
    return true
  }

  function createStation(name: string, type: StationType = 'industrial', selectAfterCreate: boolean = true) {
    const binding = activeBinding.value
    if (!binding) return null
    const groupId = activeStation.value?.sectorId || sectors.value[0]?.id || null
    const plan = saveBindingStore.createStationPlanInGroup(binding.gameGuid, groupId, name, type)
    if (!plan) return null
    const stationId = plan.id
    if (plan && selectAfterCreate) {
      activeStationId.value = stationId
    }
    const station = toProductionStation(plan)
    syncBindingStationDerivedSnapshot(stationId)
    return station
  }

  function deleteStation(stationId: string) {
    const binding = activeBinding.value
    if (!binding) return
    const existingPlan = binding.stationPlans.find(plan => plan.id === stationId)
    const stationSectorId = existingPlan?.groupId ?? orderedStationsBySector.value.find(s => s.id === stationId)?.sectorId ?? null
    if (existingPlan) {
      saveBindingStore.deleteStationPlan(binding.gameGuid, stationId)
      planningDerivedMap.value?.remove(stationId)
    }
    if (activeStationId.value === stationId) {
      if (stationSectorId) {
        activeStationId.value = `transit:${stationSectorId}`
      } else {
        activeStationId.value = null
      }
    }
  }

  function renameStation(stationId: string, newName: string) {
    return updateBindingStationPlan(stationId, { name: newName })
  }

  function selectStation(stationId: string | null) {
    isTerraformingMode.value = false
    activeStationId.value = stationId
  }

  function selectTransitSector(sectorId: string | null) {
    isTerraformingMode.value = false
    if (!sectorId) {
      activeStationId.value = null
      return
    }
    const exists = sectors.value.some((sector) => sector.id === sectorId)
    if (!exists) return
    const transitTabId = toTransitTabId(sectorId)
    activeStationId.value = transitTabId
  }

  function selectTerraforming() {
    isTerraformingMode.value = true
    activeStationId.value = null
  }

  function selectTerraformingCluster(clusterId: string) {
    terraformingSelectedClusterId.value = clusterId
    activeViewStore.activeTerraformingClusterId = clusterId
  }

  function setTerraformingCompletedProjects(projects: Map<string, number>) {
    const clusterId = terraformingSelectedClusterId.value
    if (!clusterId) return
    const currentCounts = buildCompletedProjectsFromExecutionLog(getTerraformingExecutionLogForCluster(clusterId))
    const touchedProjectIds = new Set<string>([
      ...currentCounts.keys(),
      ...projects.keys(),
    ])

    for (const projectId of touchedProjectIds) {
      const currentCount = currentCounts.get(projectId) ?? 0
      const targetCount = projects.get(projectId) ?? 0
      if (targetCount > currentCount) {
        appendTerraformingExecutionEntries(clusterId, projectId, targetCount - currentCount)
      } else if (targetCount < currentCount) {
        removeTailTerraformingExecutionEntries(clusterId, projectId, currentCount - targetCount)
      }
    }
  }

  function appendTerraformingProjectExecution(projectId: string, count = 1) {
    const clusterId = terraformingSelectedClusterId.value
    if (!clusterId) return
    appendTerraformingExecutionEntries(clusterId, projectId, count)
  }

  function setTerraformingProjectCount(projectId: string, count: number) {
    const clusterId = terraformingSelectedClusterId.value
    if (!clusterId) return
    const currentCount = terraformingCompletedProjects.value.get(projectId) ?? 0
    if (count > currentCount) {
      appendTerraformingExecutionEntries(clusterId, projectId, count - currentCount)
      return
    }
    if (count < currentCount) {
      removeTailTerraformingExecutionEntries(clusterId, projectId, currentCount - count)
    }
  }

  function removeTerraformingExecutionEntry(entryId: string) {
    const clusterId = terraformingSelectedClusterId.value
    if (!clusterId) return
    const currentLog = getTerraformingExecutionLogForCluster(clusterId)
    const nextLog = currentLog.filter(entry => entry.id !== entryId)
    if (nextLog.length === currentLog.length) return
    setTerraformingExecutionLogForCluster(clusterId, nextLog)
  }

  function setTerraformingHousingBuilt(count: number) {
    const clusterId = terraformingSelectedClusterId.value
    if (!clusterId) return
    terraformingHousingBuiltByCluster.value = {
      ...terraformingHousingBuiltByCluster.value,
      [clusterId]: count,
    }
  }

  function updateStationModules(stationId: string, modules: SavedModule[]) {
    updateBindingStationPlan(stationId, { modules })
    syncBindingStationDerivedSnapshot(stationId)
  }

  function updateStationType(stationId: string, type: StationType) {
    updateBindingStationPlan(stationId, { type })
    syncBindingStationDerivedSnapshot(stationId)
  }

  function applyImportedStationPayload(
    stationId: string,
    payload: { modules: SavedModule[]; lockedWares: string[]; warePriority: Record<string, number> }
  ): boolean {
    const binding = activeBinding.value
    if (!binding) return false

    const existingPlan = binding.stationPlans.find(plan => plan.id === stationId)

    if (existingPlan) {
      saveBindingStore.updateStationPlan(binding.gameGuid, stationId, {
        modules: payload.modules,
        lockedWares: payload.lockedWares,
        warePriority: payload.warePriority
      })
    } else {
      const station = getDerivedBindingStation(stationId)
      saveBindingStore.upsertStationPlan({
        gameGuid: binding.gameGuid,
        saveStationCode: stationId,
        groupId: station?.sectorId || null,
        name: station?.name || stationId,
        type: station?.type || 'industrial',
        modules: payload.modules,
        settings: station?.settings || DEFAULT_STATION_SETTINGS,
        lockedWares: payload.lockedWares,
        warePriority: payload.warePriority
      })
    }
    syncBindingStationDerivedSnapshot(stationId)
    return true
  }

  const isDirty = computed(() => saveBindingStore.isDirty)

  function saveBinding() {
    const binding = activeBinding.value
    if (!binding) {
      saveBindingStore.saveBinding()
      return
    }
    const beforePlans = binding.stationPlans
    const beforeById = new Map(beforePlans.map(p => [p.id, p]))
    saveBindingStore.saveBinding()
    const afterIds = new Set(binding.stationPlans.map(p => p.id))
    for (const [id, plan] of beforeById) {
      if (!afterIds.has(id)) {
        planningDerivedMap.value?.remove(id)
        if (activeStationId.value === id && plan.saveStationCode) {
          activeStationId.value = plan.saveStationCode
        }
      }
    }
  }

  function isEmptyForSave() {
    return !activeBinding.value
  }

  function validateActiveStationId() {
    const currentStationId = activeViewStore.activeBindingStation
    if (!currentStationId) {
      activeStationId.value = null
      expandedSectorId.value = null
      return
    }

    const transitMatch = currentStationId.match(/^transit:(.+)$/)
    if (transitMatch) {
      const sectorId = transitMatch[1]!
      const validSectorIds = new Set(sectors.value.map(s => s.id))
      if (validSectorIds.has(sectorId)) {
        activeStationId.value = currentStationId
        expandedSectorId.value = sectorId
      } else {
        activeStationId.value = null
        expandedSectorId.value = null
      }
      return
    }

    const validIds = new Set(derivedBindingStations.value.map(item => item.station.id))
    if (validIds.has(currentStationId)) {
      activeStationId.value = currentStationId
      const station = orderedStationsBySector.value.find(s => s.id === currentStationId)
      if (station?.sectorId) {
        expandedSectorId.value = station.sectorId
      }
    } else {
      activeStationId.value = null
      expandedSectorId.value = null
    }
  }

  let _activating = false
  async function activateBinding(gameGuid: string): Promise<boolean> {
    if (_activating) return false
    _activating = true
    try {
      const binding = saveBindingStore.getBindingByGameGuid(gameGuid)
      if (!binding) return false

      const archiveGroup = saveStore.archives.get(gameGuid)
      const hasValidArchive = archiveGroup?.saves.some(s => s.isValid) ?? false
      if (!hasValidArchive) return false

      activeViewStore.activeBinding = gameGuid
      saveBindingStore.syncFromActiveView()

    const draft = activeBinding.value
    if (draft?.selectedArchiveTime) {
      await saveStore.selectArchive(gameGuid, draft.selectedArchiveTime)
    } else {
      await saveStore.selectArchiveGroup(gameGuid)
    }

    await loadPlayerStationRecords()
    syncAllBindingStationsToStateMap()
    hydrateTerraformingLogs()
    markAllDirty()
    validateActiveStationId()
    if (activeStationId.value) {
      mode.value = initialMode.value
    }

    return true
    } finally {
      _activating = false
    }
  }

  async function initialize() {
    console.log('[LiveProductionStore] Initializing...')
    isReady.value = false

    try {
      await gameData.initialize()
      await saveStore.initialize()
      await loadPlayerStationRecords()

      saveBindingStore.initialize()

      const storedGuid = activeViewStore.activeBinding
      if (storedGuid) {
        const activated = await activateBinding(storedGuid)
        if (activated) {
          isReady.value = true
          console.log('[LiveProductionStore] Loaded saved binding')
          return
        }
        console.log('[LiveProductionStore] Saved binding invalid, trying fallback')
      }

      const validBinding = saveBindingStore.savedBindings.list.find((b) => {
        const archiveGroup = saveStore.archives.get(b.gameGuid)
        return archiveGroup?.saves.some(s => s.isValid) ?? false
      })

      if (validBinding) {
        await activateBinding(validBinding.gameGuid)
        isReady.value = true
        console.log('[LiveProductionStore] Fallback to first valid binding:', validBinding.gameGuid)
        return
      }

      activeViewStore.activeBinding = null
      activeViewStore.activeBindingStation = null
      console.log('[LiveProductionStore] No valid bindings found, cleared')
      isReady.value = true

    } catch (e) {
      console.error('[LiveProductionStore] Initialization failed:', e)
    }
  }

  async function openBinding(gameGuid: string) {
    const currentDraft = activeBinding.value
    if (currentDraft?.gameGuid === gameGuid && saveBindingStore.activeGameGuid === gameGuid) {
      return
    }
    await activateBinding(gameGuid)
  }

  const wareflowViewMode = ref<WareFlowViewMode>('quantity')
  const expandedSectorId = ref<string | null>(null)
  const titleValue = computed(() => activeBinding.value?.bindingName || activeBindingName.value || '')
  const titlePlaceholder = computed(() => i18n.global.t('binding.new_binding_name'))

  const capabilities: ProductionWorkbenchCapabilities = {
    uniqueWorkbench: true,
    uniqueStation: true,
    hasSectors: true
  }

  const empireGapsComputed = computed<{ operations: EmpireGapItem[]; supply: EmpireGapItem[] }>(() => {
    const flows = getStationComponentGapFlows(activeStation.value?.id || null)
    const { waresMap } = gameData
    const racePref = settings.value.racePreference

    interface ItemWithName {
      id: string
      name: string
      wareId: string
      netRate: number
      netValue: number
      tier: number
      contributions?: any[]
      disableAdd: boolean
      disableRemove: boolean
    }

    const byTierThenName = (a: ItemWithName, b: ItemWithName) => {
      const tierA = Number(a.tier ?? 0)
      const tierB = Number(b.tier ?? 0)
      if (tierA !== tierB) return tierB - tierA
      const nameA = String(a.name || '')
      const nameB = String(b.name || '')
      return nameA.localeCompare(nameB, 'en')
    }

    const toItem = (flow: any): ItemWithName => {
      const module = gameData.findModuleForWare(flow.wareId, racePref)
      const plannedIndex = module ? plannedModules.value.findIndex(m => m.id === module.id) : -1
      const wareInfo = waresMap[flow.wareId]
      return {
        id: flow.wareId,
        name: wareInfo?.name || flow.wareId,
        wareId: flow.wareId,
        netRate: flow.netRate,
        netValue: flow.netValue || 0,
        tier: flow.tier ?? 0,
        contributions: flow.contributions,
        disableAdd: !module || flow.netRate > 0,
        disableRemove: !module || plannedIndex === -1
      }
    }

    const stripName = (item: ItemWithName): EmpireGapItem => ({
      id: item.id,
      wareId: item.wareId,
      netRate: item.netRate,
      netValue: item.netValue,
      tier: item.tier,
      contributions: item.contributions,
      disableAdd: item.disableAdd,
      disableRemove: item.disableRemove
    })

    return {
      operations: flows.operations
        .filter((flow: any) => flow.netRate < 0 || wareRuleActions.getResolvedLevel(flow.wareId) > 0)
        .map(toItem)
        .sort(byTierThenName)
        .map(stripName),
      supply: flows.supply
        .map(toItem)
        .filter((item: ItemWithName) => item.netRate <= 0 || !item.disableRemove)
        .sort(byTierThenName)
        .map(stripName)
    }
  })

  const session = computed<ProductionSessionState>(() => ({
    workbenchMode: workbenchMode.value,
    entityType: workbenchMode.value,
    mode: mode.value,
    visualMode: visualMode.value,
    activeStationId: activeStationId.value,
    activeTransitSectorId: activeTransitSectorId.value,
    activeBinding: activeBinding.value?.gameGuid || null,
    canToggle: workbenchMode.value === 'transit' ? true : canToggle.value,
    wareflowViewMode: wareflowViewMode.value
  }))

  const stationState = computed<ProductionStationState | null>(() => {
    const wm = workbenchMode.value
    if (wm === 'overview') return null

    const isTransit = wm === 'transit'
    const state = isTransit ? activeTransitState.value : activeStationState.value

    if (isTransit && !activeTransitSectorId.value) return null
    if (!isTransit && !activeStation.value) return null

    const entityType = isTransit ? 'transit' as const : 'station' as const
    const entityId = isTransit ? activeTransitSectorId.value! : activeStation.value!.id
    const entityName = isTransit
      ? (sectors.value.find(s => s.id === activeTransitSectorId.value)?.name || activeTransitSectorId.value!)
      : activeStation.value!.name
    const stationType = 'industrial' as const
    const stationCount = 1
    const stationMinerals: string[] = []

    return {
      entityType,
      id: entityId,
      name: entityName,
      stationType,
      count: stationCount,
      minerals: stationMinerals,
      plannedModules: state.plannedModules,
      effectivePlannedModules: state.effectivePlannedModules || state.plannedModules,
      recommendedModules: state.recommendedModules || [],
      resolvedModules: state.resolvedModules,
      modules: state.modules,
      buildingModules: state.buildingModules,
      autoIndustryModules: state.autoIndustryModules,
      autoHabitationModules: state.autoHabitationModules,
      autoInfrastructureModules: state.autoInfrastructureModules,
      productionFlows: state.productionFlows,
      derivedProductionFlows: planningFlowFacade.deriveFlows(state.productionFlows, isTransit ? { ...settings.value, resourceBufferHours: settings.value.primaryProductBufferHours } : settings.value, state.warePriorityLevels),
      warePriorityLevels: state.warePriorityLevels,
      settings: {
        ...settings.value,
        enforceDlcActivation: enforceDlcActivation.value
      },
      enforceDlcActivation: enforceDlcActivation.value,
      empireGaps: empireGapsComputed.value,
      currentEfficiency: state.currentEfficiency,
      actualWorkforce: state.actualWorkforce,
      buildPriceMultiplier: buildPriceMultiplier.value,
      buildingCargo: state.buildingCargo || [],
      buildingReservation: state.buildingReservation || [],
      buildingInProgress: state.buildingInProgress || undefined,
      archiveBuiltModules: state.archiveBuiltModules || [],
      archiveCurrentTotalModules: state.archiveCurrentTotalModules || [],
      archiveProducedWareIds: state.archiveProducedWareIds || [],
      finalPlannedModules: state.finalPlannedModules || [],
      effectiveTargetModules: state.effectiveTargetModules || []
    }
  })

  const useAllocationVolumeView = computed(() => {
    return workbenchMode.value === 'station' || workbenchMode.value === 'transit'
  })

  const allocationVolumeGroups = computed<AllocationVolumeGroup[]>(() => {
    if (!useAllocationVolumeView.value) return []
    if (session.value.wareflowViewMode !== 'volume') return []

    const state = stationState.value
    if (!state) return []

    const archive = archiveStation.value
    const hasArchive = archive !== null

    const cargoMap = new Map<string, number>()
    if (hasArchive) {
      for (const item of archive!.cargo || []) {
        cargoMap.set(item.ware, item.amount)
      }
    }

    const targetMap = new Map<string, number>()
    if (hasArchive) {
      for (const item of archive!.targetCounts || []) {
        targetMap.set(item.ware, item.amount)
      }
    }

    return buildAllocationVolumeGroups({
      derivedProductionFlows: state.derivedProductionFlows,
      cargoMap,
      targetMap,
      hasArchiveStation: hasArchive,
      gameData
    })
  })

  const allocationCargoOnlyItems = computed<AllocationCargoOnlyItem[]>(() => {
    if (!useAllocationVolumeView.value) return []
    if (session.value.wareflowViewMode !== 'volume') return []

    const archive = archiveStation.value
    const state = stationState.value
    if (!archive || !state) return []

    return buildAllocationCargoOnlyItems({
      cargo: archive.cargo || [],
      targetCounts: archive.targetCounts || [],
      derivedProductionFlows: state.derivedProductionFlows,
      gameData
    })
  })

  const tabSemanticsById = computed<Record<string, { tag?: string; factoryGroup?: string }>>(() => {
    const stationPlansByCode = new Map<string, BindingStationPlan>()
    const stationPlansById = new Map<string, BindingStationPlan>()
    activeBinding.value?.stationPlans.forEach((plan) => {
      if (plan.saveStationCode) {
        stationPlansByCode.set(plan.saveStationCode, plan)
      }
      stationPlansById.set(plan.id, plan)
    })

     const entries = orderedStationsBySector.value.map((station) => {
      const matchingPlan = stationPlansByCode.get(station.id) || stationPlansById.get(station.id)
      const liveSemantics = liveFlowMap.value?.getCache(station.id)?.semantics
      const semantics = matchingPlan
        ? planningDerivedMap.value?.getCache(station.id)?.semantics
        : liveSemantics
      return [
        station.id,
        {
          tag: liveSemantics?.tag ?? (matchingPlan ? undefined : 'constructionsite'),
          factoryGroup: semantics?.factoryGroup
        }
      ] as const
    })

    return Object.fromEntries(entries)
  })
  const updateTitle = (value: string) => { activeBindingName.value = value }
  const updateBindingGroupName = (groupId: string, name: string) => {
    const group = activeBinding.value?.groups.find(g => g.id === groupId)
    if (group && activeBinding.value) {
      saveBindingStore.updateGroup(activeBinding.value.gameGuid, group.id, { name })
    }
  }
  const updateStationNameFromActive = (value: string) => {
    if (editableStationPlan.value) renameStation(editableStationPlan.value.id, value)
  }
  const updateStationTypeFromActive = (value: StationType) => {
    if (editableStationPlan.value) updateStationType(editableStationPlan.value.id, value)
  }
  const settingActions = createProductionSettingActions<StationPlan>({
    getActiveStation: () => editableStationPlan.value || activeStation.value,
    getComputeDeps,
    mergeSettings: (base, patch) => ({ ...DEFAULT_STATION_SETTINGS, ...{ ...base, ...patch } }),
    now: () => Date.now(),
    commitStationMutation: (station) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      
      if (station.id === tradeStationId) {
        const sectorId = activeTransitSectorId.value
        if (!sectorId) return
        const group = activeBinding.value?.groups.find(g => g.id === sectorId)
        if (!group?.tradeStation) return
        group.tradeStation.settings = { ...DEFAULT_STATION_SETTINGS, ...station.settings }
        saveBindingStore.updateGroup(activeBinding.value?.gameGuid || '', sectorId, { tradeStation: group.tradeStation })
        return
      }
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    },
    recompute: (station, _deps) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      
      if (station.id === tradeStationId) {
        return
      }
      const map = ensurePlanningDerivedMap()
      if (!map) return
      const archive = getArchiveStationDataByPlanId(station.id)
      const refModules: SavedModule[] = []
      if (archive) {
        refModules.push(...(archive.modules || []))
        refModules.push(...(archive.building?.modules || []))
      }
      map.upsertStation(station.id, {
        modulesMode: 'plan',
        sectorId: station.sectorId,
        modules: station.modules || [],
        settings: station.settings || {},
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {},
        referenceModules: refModules
      })
    },
    shouldRecompute: (station, patch) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      if (station.id === tradeStationId) return true
      return doesStationSettingsAffectFlowMap(patch)
    },
    afterRecompute: (station, deps) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      
      if (station.id === tradeStationId) return
      syncAfterStationFlowChange(station.id, deps)
    },
    afterCommit: (station, _deps, patch) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id

      if (station.id === tradeStationId) return
      if (!doesStationSettingsAffectFlowMap(patch)) {
        return
      }
    }
  })

  return {
    isReady,
    isDirty,
    isEmptyForSave,
    activeBinding,
    activeBindingName,
    activeStation,
    editableStationPlan,
    activeStationId,
    activeTransitSectorId,
    sectors,
    orderedStationsBySector,
    tabSemanticsById,
    expandedSectorId,
    titleValue,
    titlePlaceholder,
    derivedBindingStations,
    syncAllBindingStationsToStateMap,
    empireDerivedProductionFlows,
    overviewBuyMultiplier,
    overviewSellMultiplier,
    saveBinding,
    createStation,
    deleteStation,
    renameStation,
    selectTransitSector,
    setExpandedSector: (sectorId: string | null) => { expandedSectorId.value = sectorId },
    getStationById,
    mode,
    canToggle,
    toggleMode,
    moduleScope,
    hasBuildingModules,
    cycleModuleScope,
    updateStationModules,
    applyImportedStationPayload,
    initialize,
    activateBinding,
    openBinding,
    archiveStation,
    bindingStation,
    playerStationRecords,
    planningDerivedMap,
    liveFlowMap,

    session,
    context,
    stationState,
    useAllocationVolumeView,
    allocationVolumeGroups,
    allocationCargoOnlyItems,
    capabilities,
    settingActions,
    wareRuleActions,
    moduleActions,
    updateTitle,
    updateBindingGroupName,
    updateStationName: updateStationNameFromActive,
    updateStationType: updateStationTypeFromActive,
    updateWareflowViewMode: (value: WareFlowViewMode) => { wareflowViewMode.value = value },
    updateBuildPriceMultiplier: (value: number) => { buildPriceMultiplier.value = value },
    duplicateStation: () => null,
    selectStation,
    selectTerraforming,
    selectTerraformingCluster,
    terraformingSelectedClusterId,
    terraformingSelectedCluster,
    terraformingData,
    terraformingCurrentStats,
    terraformingRuntimeProjectIds,
    terraformingExecutionLog,
    terraformingCompletedProjects,
    terraformingHousingBuilt,
    terraformingHqStationCode,
    terraformingHqStationName,
    terraformingHqArchiveStation,
    terraformingHqEffectiveModules,
    terraformingHqClusterId,
    setTerraformingCompletedProjects,
    appendTerraformingProjectExecution,
    setTerraformingProjectCount,
    removeTerraformingExecutionEntry,
    setTerraformingHousingBuilt,
    gameDataMaps: computed(() => gameData.maps)
  }
})
