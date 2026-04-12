import { defineStore, storeToRefs } from 'pinia'
import { ref, computed } from 'vue'
import type {
  StationPlan,
  StationType,
  SavedModule,
  GroupedFlows,
  StationSettings,
  TransitHubViewModel,
  SupplyPlanningInput,
  SectorInternalData
} from '@/types/x4'
import type { ProductionSessionContext } from '@/types/production-context'
import type { SectorLinkCalcEntry } from './logic/empireFlowFacade'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import { useGameDataStore } from './useGameDataStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useSaveStore } from './useSaveStore'
import { useActiveViewStore } from './useActiveViewStore'
import { stationStateMap, DEFAULT_STATION_SETTINGS } from './state/StationStateMap'
import {
  buildStationComputeDeps,
  syncPersistedToStateMap,
  recomputeStation,
  getFilteredGroupedFlows,
  clearStationState
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
      buildPriceMultiplier: 0.5,
      enforceDlcActivation,
      isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(modulesMap[moduleId]?.dlc_tag)
    })
  }

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
    getTransitHubViewModel
  }
})