import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  StationPlan,
  StationType,
  SavedModule,
  GroupedFlows,
  StationSettings,
  TransitHubViewModel,
  SupplyPlanningInput,
  SectorInternalData,
  X4Module
} from '@/types/x4'
import type { ProductionSessionContext } from '@/types/production-context'
import type { SectorLinkCalcEntry } from './logic/empireFlowFacade'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import { useGameDataStore } from './useGameDataStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useSaveStore } from './useSaveStore'
import { useActiveViewStore } from './useActiveViewStore'
import { stationStateMap, DEFAULT_STATION_SETTINGS, migrateStationSettings } from './state/StationStateMap'
import {
  buildStationComputeDeps,
  syncPersistedToStateMap,
  recomputeStation,
  getFilteredGroupedFlows,
  clearStationState,
  getStationState,
  ensureStationState,
  patchStationState,
  getSettings,
  getPlannedModules,
  getLockedWares,
  getWarePriority,
  getAutoIndustryModules,
  getActualWorkforce,
  getCurrentEfficiency,
  deepClone
} from './logic/stationComputeService'
import {
  createEmpireSourceView,
  computeActiveStation,
  computeActiveTransitSectorId,
  toTransitTabId
} from './logic/empireSourceView'
import { createEmpireFlowFacade } from './logic/empireFlowFacade'
import {
  createBindingPlanStationId,
  parseBindingStationId,
  toProductionStation
} from './logic/productionSourceAdapter'

export const useLiveProductionStore = defineStore('liveProduction', () => {
  const gameData = useGameDataStore()
  const saveBindingStore = useSaveBindingStore()
  const saveStore = useSaveStore()
  const activeViewStore = useActiveViewStore()
  const { activeBinding } = storeToRefs(saveBindingStore)
  const { selectedArchive } = storeToRefs(saveStore)

  const isReady = ref(false)
  const buildPriceMultiplier = ref(0.5)

  const productionSource = computed<'save-binding'>(() => 'save-binding')

  const activeStationId = computed({
    get: () => activeViewStore.activeBindingStation,
    set: (id: string | null) => activeViewStore.activeBindingStation = id
  })

  const activeBindingName = computed({
    get: () => saveBindingStore.activeBindingName,
    set: (name: string) => { saveBindingStore.activeBindingName = name }
  })

  const sourceView = createEmpireSourceView({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    selectedArchive
  })

  const sectors = sourceView.sectors
  const orderedStationsBySector = sourceView.orderedStationsBySector
  const derivedBindingStations = sourceView.derivedBindingStations

  const flowFacade = createEmpireFlowFacade({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    selectedArchive,
    sourceView,
    modulesMap: computed(() => gameData.modulesMap),
    waresMap: computed(() => gameData.waresMap),
    medicalConsumptionMap: computed(() => gameData.medicalConsumptionMap),
    enforceDlcActivation: computed(() => gameData.enforceDlcActivation),
    isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(gameData.modulesMap[moduleId]?.dlc_tag)
  })

  const stationFlowCache = flowFacade.stationFlowCache
  const empireGroupedFlows = flowFacade.empireGroupedFlows
  const sectorInternalDataMap = flowFacade.sectorInternalDataMap
  const sectorLinkCalcMap = flowFacade.sectorLinkCalcMap

  const activeStation = computed(() => computeActiveStation(
    productionSource.value,
    derivedBindingStations.value,
    null,
    activeStationId.value
  ))

  const activeTransitSectorId = computed(() => computeActiveTransitSectorId(
    activeStationId.value,
    sectors.value
  ))

  function getDerivedBindingStation(stationId: string): StationPlan | null {
    return sourceView.getDerivedBindingStation(stationId)
  }

  function getStationById(stationId: string): StationPlan | null {
    return sourceView.getStationById(stationId)
  }

  function getLinkedSectors(sectorId: string): string[] {
    const group = activeBinding.value?.groups.find(g => g.id === sectorId)
    if (!group) return []
    return group.connectedGroupIds || []
  }

  function getComputeDeps() {
    const { modulesMap, waresMap, medicalConsumptionMap, enforceDlcActivation } = gameData
    if (!gameData.isReady || !modulesMap || !waresMap || !medicalConsumptionMap) return null
    return buildStationComputeDeps({
      modulesMap,
      waresMap,
      medicalConsumptionMap,
      buildPriceMultiplier: buildPriceMultiplier.value,
      enforceDlcActivation,
      isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(modulesMap[moduleId]?.dlc_tag)
    })
  }

  function ensureActiveStationState(): ReturnType<typeof stationStateMap.get> {
    const station = activeStation.value
    if (!station) {
      return ensureStationState('__local__', {
        settings: { ...DEFAULT_STATION_SETTINGS }
      })
    }
    return ensureStationState(station.id)
  }

  function syncPersistedActiveStationToStateMap(): void {
    const station = activeStation.value
    if (!station) return
    station.settings = migrateStationSettings(station.settings)
    syncPersistedToStateMap(station.id, station)
  }

  function syncStateMapBackToPersistedActiveStation(updateTimestamp: boolean = false): void {
    const station = activeStation.value
    if (!station) return
    const state = getStationState(station.id)
    if (!state) return
    station.modules = deepClone(state.plannedModules)
    station.lockedWares = deepClone(state.lockedWares || [])
    station.warePriority = deepClone(state.warePriority || {})
    station.settings = migrateStationSettings(state.settings)
    if (updateTimestamp) {
      station.lastUpdated = Date.now()
    }
  }

  function recomputeActiveStation(): void {
    const station = activeStation.value
    const stationId = station?.id || '__local__'
    const deps = getComputeDeps()
    if (!deps) return
    recomputeStation(stationId, deps)
  }

  function writeAndRecomputeActive(writer: (stationId: string) => void): void {
    const station = activeStation.value
    const stationId = station?.id || '__local__'
    if (!station) {
      ensureActiveStationState()
    } else {
      syncPersistedActiveStationToStateMap()
    }
    writer(stationId)
    recomputeActiveStation()
    syncStateMapBackToPersistedActiveStation(false)
    if (station) {
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    }
  }

  const plannedModules = computed<SavedModule[]>({
    get: () => {
      const stationId = activeStation.value?.id || '__local__'
      return getPlannedModules(stationId)
    },
    set: (value) => {
      writeAndRecomputeActive((stationId) => {
        patchStationState(stationId, { plannedModules: deepClone(value) })
      })
    }
  })

  const lockedWares = computed<string[]>({
    get: () => {
      const stationId = activeStation.value?.id || '__local__'
      return getLockedWares(stationId)
    },
    set: (value) => {
      writeAndRecomputeActive((stationId) => {
        patchStationState(stationId, { lockedWares: deepClone(value) })
      })
    }
  })

  const warePriority = computed<Record<string, number>>({
    get: () => {
      const stationId = activeStation.value?.id || '__local__'
      return getWarePriority(stationId)
    },
    set: (value) => {
      writeAndRecomputeActive((stationId) => {
        patchStationState(stationId, { warePriority: deepClone(value) })
      })
    }
  })

  const settings = computed<StationSettings>({
    get: () => {
      const stationId = activeStation.value?.id || '__local__'
      return getSettings(stationId)
    },
    set: (value) => {
      writeAndRecomputeActive((stationId) => {
        patchStationState(stationId, { settings: migrateStationSettings(value) })
      })
    }
  })

  const autoIndustryModules = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    return getAutoIndustryModules(stationId)
  })

  const actualWorkforce = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    return getActualWorkforce(stationId)
  })

  const currentEfficiency = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    return getCurrentEfficiency(stationId)
  })

  const groupedFlows = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    return getFilteredGroupedFlows(stationId)
  })

  const stationAnalysis = computed(() => {
    const state = getStationState(activeStation.value?.id || '__local__')
    return state?.stationAnalysis || {
      totalCost: 0,
      totalVolume: 0,
      totalTime: 0,
      totalCapacity: 0,
      totalNeeded: 0,
      playerHQNeeded: 0,
      totalWorkerDiff: 0,
      summaryItems: [],
      moduleGroups: []
    }
  })

  const wares = computed(() => gameData.waresMap)

  const enforceDlcActivation = computed(() => gameData.enforceDlcActivation)

  function updatePlannedModules(modules: SavedModule[]): void {
    if (activeStation.value) {
      updateStationModules(activeStation.value.id, modules)
    }
  }

  function updateStationSettingsDirect(key: keyof StationSettings, value: StationSettings[keyof StationSettings]): void {
    writeAndRecomputeActive((stationId) => {
      const current = getSettings(stationId)
      patchStationState(stationId, {
        settings: { ...current, [key]: value }
      })
    })
  }

  function isWareOperable(wareId: string): boolean {
    const ware = gameData.waresMap[wareId]
    return ware?.transport === 'container'
  }

  function isWareLocked(wareId: string): boolean {
    if (!isWareOperable(wareId)) return true
    return lockedWares.value.includes(wareId)
  }

  function toggleWareLock(wareId: string): void {
    if (!isWareOperable(wareId)) return
    writeAndRecomputeActive((stationId) => {
      const current = getLockedWares(stationId)
      const next = current.includes(wareId)
        ? current.filter(id => id !== wareId)
        : [...current, wareId]
      patchStationState(stationId, { lockedWares: next })
    })
  }

  function isPlannedWare(wareId: string): boolean {
    return plannedModules.value.some(module => {
      const moduleInfo = gameData.modulesMap[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  function isAutoWare(wareId: string): boolean {
    if (isPlannedWare(wareId)) return false
    return autoIndustryModules.value.some(module => {
      const moduleInfo = gameData.modulesMap[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  function getResolvedLevel(wareId: string): number {
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)
    const override = warePriority.value[wareId]

    if (planned && override === 0) return 1
    if (auto && override === 2) return 1
    if (override !== undefined) return override
    if (planned) return 2
    if (auto) return 0
    return 0
  }

  function toggleWarePriority(wareId: string): void {
    const currentLevel = getResolvedLevel(wareId)
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)

    writeAndRecomputeActive((stationId) => {
      const nextPriority = deepClone(getWarePriority(stationId))

      if (planned) {
        if (currentLevel === 2) nextPriority[wareId] = 1
        else delete nextPriority[wareId]
      } else if (auto) {
        if (currentLevel === 0) nextPriority[wareId] = 1
        else delete nextPriority[wareId]
      }

      patchStationState(stationId, { warePriority: nextPriority })
    })
  }

  function isModuleDlcActive(moduleId: string): boolean {
    return gameData.isDlcActive(gameData.modulesMap[moduleId]?.dlc_tag)
  }

  function isModuleCountEditable(moduleId: string): boolean {
    return !enforceDlcActivation.value || isModuleDlcActive(moduleId)
  }

  function getModuleInfo(id: string): X4Module {
    return gameData.modulesMap[id] || {
      id, macroId: '', wareId: '', nameId: id, type: 'unknown', group: 'others', race: 'unknown', buildTime: 0,
      buildCost: {}, cycleTime: 0, outputs: {}, inputs: {},
      dockingCount: 0,
      workforce: { capacity: 0, needed: 0, maxBonus: 0 }
    } as X4Module
  }

  function addModule(id: string = '', count = 1): void {
    if (id !== '' && !gameData.modulesMap[id]) return
    writeAndRecomputeActive((stationId) => {
      const current = getPlannedModules(stationId)
      const existingIndex = current.findIndex(m => m.id === id)
      if (existingIndex !== -1) {
        const next = deepClone(current)
        const existing = next[existingIndex]
        if (existing) existing.count += count
        patchStationState(stationId, { plannedModules: next })
      } else {
        patchStationState(stationId, { plannedModules: [...current, { id, count }] })
      }
    })
  }

  function removeModule(index: number): void {
    writeAndRecomputeActive((stationId) => {
      const current = getPlannedModules(stationId)
      const next = current.filter((_, i) => i !== index)
      patchStationState(stationId, { plannedModules: next })
    })
  }

  function updateModuleCount(index: number, count: number): void {
    const module = plannedModules.value[index]
    if (!module || !isModuleCountEditable(module.id)) return
    writeAndRecomputeActive((stationId) => {
      const current = getPlannedModules(stationId)
      const next = deepClone(current)
      const target = next[index]
      if (target) target.count = count
      patchStationState(stationId, { plannedModules: next })
    })
  }

  function removeModuleById(id: string): void {
    const index = plannedModules.value.findIndex(m => m.id === id)
    if (index !== -1) removeModule(index)
  }

  function transferModuleFromAutoIndustry(module: SavedModule): void {
    const inIndustry = autoIndustryModules.value.some(m => m.id === module.id)
    if (!inIndustry) return
    addModule(module.id, module.count)
  }

  function clearAllModules(): void {
    writeAndRecomputeActive((stationId) => {
      patchStationState(stationId, { plannedModules: [] })
    })
  }

  watch(
    () => ({
      stationId: activeStation.value?.id,
      gameReady: gameData.isReady,
      buildPrice: buildPriceMultiplier.value,
      enforceDlcActivation: gameData.enforceDlcActivation
    }),
    () => {
      syncPersistedActiveStationToStateMap()
      recomputeActiveStation()
    },
    { immediate: true }
  )

  function refreshStationFlowCache(stationId: string) {
    const station = getStationById(stationId)
    if (!station) return
    const deps = getComputeDeps()
    if (!deps) return
    syncPersistedToStateMap(stationId, station)
    recomputeStation(stationId, deps)
  }

  function getStationFlowCache(stationId: string): GroupedFlows | null {
    const state = stationStateMap
    if (!state.get(stationId)) return null
    return getFilteredGroupedFlows(stationId)
  }

  function clearStationCaches() {
    stationStateMap.list().forEach(state => {
      clearStationState(state.stationId)
    })
  }

  function getSupplyPlanningInput(sectorId: string): SupplyPlanningInput {
    return flowFacade.getSupplyPlanningInput(sectorId)
  }

  function getSectorInternalData(sectorId: string): SectorInternalData {
    return flowFacade.getSectorInternalData(sectorId)
  }

  function getSectorLinkCalc(sectorId: string): SectorLinkCalcEntry | null {
    return flowFacade.getSectorLinkCalc(sectorId)
  }

  function getStationComponentGapFlows(stationId: string | null): StationComponentGapFlows {
    return flowFacade.getStationComponentGapFlows(stationId, activeStationId.value)
  }

  function getTransitHubViewModel(input: {
    sectorId: string | null
    racePreference: string
    transportShipCapacity: number
    storageBufferHours?: number
  }): TransitHubViewModel {
    return flowFacade.getTransitHubViewModel(input)
  }

  function updateBindingStationPlan(
    stationId: string,
    patch: Partial<Pick<StationPlan, 'name' | 'type' | 'modules' | 'settings' | 'sectorId' | 'lockedWares' | 'warePriority' | 'count' | 'minerals'>>
  ): boolean {
    const binding = activeBinding.value
    const parsed = parseBindingStationId(stationId)
    if (!binding || !parsed || parsed.gameGuid !== binding.gameGuid) return false

    if (parsed.kind === 'plan') {
      return saveBindingStore.updateStationPlan(binding.gameGuid, parsed.planId, {
        name: patch.name,
        type: patch.type,
        modules: patch.modules,
        settings: patch.settings,
        groupId: patch.sectorId,
        count: patch.count,
        minerals: patch.minerals
      })
    }

    const station = getDerivedBindingStation(stationId)
    const plan = saveBindingStore.upsertStationPlan({
      gameGuid: binding.gameGuid,
      saveStationCode: parsed.saveStationCode,
      groupId: patch.sectorId ?? station?.sectorId ?? null,
      name: patch.name ?? station?.name ?? parsed.saveStationCode,
      type: patch.type ?? station?.type ?? 'industrial',
      modules: patch.modules ?? station?.modules ?? [],
      settings: patch.settings ?? station?.settings ?? DEFAULT_STATION_SETTINGS,
      count: patch.count ?? station?.count ?? 1,
      minerals: patch.minerals ?? station?.minerals ?? []
    })
    if (!plan) return false
    const nextId = createBindingPlanStationId(binding.gameGuid, plan.id)
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
    const stationId = createBindingPlanStationId(binding.gameGuid, plan.id)
    if (plan && selectAfterCreate) {
      activeStationId.value = stationId
    }
    const station = toProductionStation(binding.gameGuid, plan)
    station.sectorId = plan.groupId || null
    refreshStationFlowCache(stationId)
    return station
  }

  function deleteStation(stationId: string) {
    const binding = activeBinding.value
    if (!binding) return
    const parsed = parseBindingStationId(stationId)
    if (parsed?.kind === 'plan' && parsed.gameGuid === binding.gameGuid) {
      saveBindingStore.deleteStationPlan(binding.gameGuid, parsed.planId)
      stationStateMap.remove(stationId)
    }
    if (activeStationId.value === stationId) {
      activeStationId.value = null
    }
  }

  function renameStation(stationId: string, newName: string) {
    return updateBindingStationPlan(stationId, { name: newName })
  }

  function selectStation(stationId: string | null) {
    activeStationId.value = stationId
  }

  function selectTransitSector(sectorId: string | null) {
    if (!sectorId) {
      activeStationId.value = null
      return
    }
    const exists = sectors.value.some((sector) => sector.id === sectorId)
    if (!exists) return
    const transitTabId = toTransitTabId(sectorId)
    activeStationId.value = transitTabId
  }

  function selectOverview() {
    activeStationId.value = null
  }

  function updateStationSettings(stationId: string, settings: Partial<StationSettings>) {
    const station = getDerivedBindingStation(stationId)
    const current = station?.settings || DEFAULT_STATION_SETTINGS
    updateBindingStationPlan(stationId, { settings: { ...current, ...settings } })
    refreshStationFlowCache(stationId)
  }

  function updateStationModules(stationId: string, modules: SavedModule[]) {
    updateBindingStationPlan(stationId, { modules })
    refreshStationFlowCache(stationId)
  }

  function updateStationType(stationId: string, type: StationType) {
    updateBindingStationPlan(stationId, { type })
    refreshStationFlowCache(stationId)
  }

  function updateStationCount(stationId: string, count: number) {
    updateBindingStationPlan(stationId, { count })
    refreshStationFlowCache(stationId)
  }

  function updateStationMinerals(stationId: string, minerals: string[]) {
    updateBindingStationPlan(stationId, { minerals })
    refreshStationFlowCache(stationId)
  }

  function applyImportedStationPayload(
    stationId: string,
    payload: { modules: SavedModule[]; lockedWares: string[]; warePriority: Record<string, number> }
  ): boolean {
    const binding = activeBinding.value
    const parsed = parseBindingStationId(stationId)
    if (!binding || !parsed || parsed.gameGuid !== binding.gameGuid) return false

    if (parsed.kind === 'plan') {
      saveBindingStore.updateStationPlan(binding.gameGuid, parsed.planId, {
        modules: payload.modules,
        lockedWares: payload.lockedWares,
        warePriority: payload.warePriority
      })
    } else {
      const station = getDerivedBindingStation(stationId)
      saveBindingStore.upsertStationPlan({
        gameGuid: binding.gameGuid,
        saveStationCode: parsed.saveStationCode,
        groupId: station?.sectorId || null,
        name: station?.name || parsed.saveStationCode,
        type: station?.type || 'industrial',
        modules: payload.modules,
        settings: station?.settings || DEFAULT_STATION_SETTINGS,
        lockedWares: payload.lockedWares,
        warePriority: payload.warePriority
      })
    }
    refreshStationFlowCache(stationId)
    return true
  }

  function renameBindingSector(sectorId: string, name: string): boolean {
    const binding = activeBinding.value
    if (!binding) return false
    return saveBindingStore.updateGroup(binding.gameGuid, sectorId, { name })
  }

  const isDirty = computed(() => saveBindingStore.isDirty)

  function saveBinding() {
    saveBindingStore.saveBinding()
  }

  function discardChanges() {
    saveBindingStore.discardChanges()
    const guid = activeBinding.value?.gameGuid || activeViewStore.activeBinding
    if (guid) {
      validateActiveStationId()
    }
  }

  function isEmptyForSave() {
    return !activeBinding.value
  }

  const session: ProductionSessionContext = {
    isDirty: computed(() => isDirty.value).value,
    save: saveBinding,
    discard: discardChanges,
    canSave: computed(() => !isEmptyForSave()).value,
    canDiscard: computed(() => isDirty.value).value
  }

  function validateActiveStationId() {
    const currentStationId = activeViewStore.activeBindingStation
    if (!currentStationId) return

    const validIds = new Set(derivedBindingStations.value.map(item => item.station.id))
    if (validIds.has(currentStationId)) {
      activeStationId.value = currentStationId
    } else {
      activeStationId.value = null
    }
  }

  async function initialize() {
    console.log('[LiveProductionStore] Initializing...')
    isReady.value = false

    try {
      await gameData.initialize()

      saveBindingStore.initialize()

      const storedGuid = activeViewStore.activeBinding
      if (storedGuid && saveBindingStore.savedBindings.list.some((b) => b.gameGuid === storedGuid)) {
        openBinding(storedGuid)
        validateActiveStationId()
        isReady.value = true
        console.log('[LiveProductionStore] Loaded saved binding')
        return
      }

      const firstBinding = saveBindingStore.savedBindings.list[0]
      if (firstBinding) {
        activeViewStore.activeBinding = firstBinding.gameGuid
        openBinding(firstBinding.gameGuid)
        validateActiveStationId()
        isReady.value = true
        console.log('[LiveProductionStore] Loaded first binding')
        return
      }

      console.log('[LiveProductionStore] No bindings found')
      isReady.value = true

    } catch (e) {
      console.error('[LiveProductionStore] Initialization failed:', e)
    }
  }

  function openBinding(gameGuid: string) {
    const currentDraft = activeBinding.value
    if (currentDraft?.gameGuid === gameGuid && saveBindingStore.activeGameGuid === gameGuid) {
      return
    }
    saveBindingStore.createOrOpenBinding(gameGuid)
    activeViewStore.activeBinding = gameGuid
  }

  return {
    isReady,
    isDirty,
    isEmptyForSave,
    session,
    activeBinding,
    activeBindingName,
    activeStation,
    activeStationId,
    activeTransitSectorId,
    sectors,
    orderedStationsBySector,
    derivedBindingStations,
    stationFlowCache,
    getStationFlowCache,
    refreshStationFlowCache,
    clearStationCaches,
    empireGroupedFlows,
    sectorInternalDataMap,
    sectorLinkCalcMap,
    saveBinding,
    discardChanges,
    createStation,
    deleteStation,
    renameStation,
    getLinkedSectors,
    selectStation,
    selectTransitSector,
    selectOverview,
    getStationById,
    getDerivedBindingStation,
    updateStationSettings,
    updateStationModules,
    updateStationType,
    updateStationCount,
    updateStationMinerals,
    applyImportedStationPayload,
    renameBindingSector,
    initialize,
    openBinding,
    validateActiveStationId,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorLinkCalc,
    getStationComponentGapFlows,
    getTransitHubViewModel,
    buildPriceMultiplier,
    plannedModules,
    settings,
    lockedWares,
    warePriority,
    autoIndustryModules,
    actualWorkforce,
    currentEfficiency,
    groupedFlows,
    stationAnalysis,
    wares,
    enforceDlcActivation,
    updatePlannedModules,
    updateSetting: updateStationSettingsDirect,
    toggleWareLock,
    toggleWarePriority,
    getResolvedLevel,
    isWareLocked,
    isWareOperable,
    isPlannedWare,
    isAutoWare,
    isModuleDlcActive,
    isModuleCountEditable,
    getModuleInfo,
    addModule,
    removeModule,
    updateModuleCount,
    removeModuleById,
    transferModuleFromAutoIndustry,
    clearAll: clearAllModules
  }
})