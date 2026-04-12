import { defineStore, storeToRefs } from 'pinia'
import { ref, computed } from 'vue'
import type {
  EntityLocation,
  EmpirePlan,
  SavedEmpiresState,
  StationPlan,
  StationType,
  V1StorageState,
  StationSettings,
  SavedModule,
  GroupedFlows,
  SupplyPlanningInput,
  SectorInternalData,
  TransitHubViewModel
} from '@/types/x4'
import { useGameDataStore } from './useGameDataStore'
import { useEmpireDataStore } from './useEmpireDataStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useSaveStore } from './useSaveStore'
import { useActiveViewStore } from './useActiveViewStore'
import { migrateEmpireStateToCurrent } from './logic/stateMigrations'
import { stationStateMap, DEFAULT_STATION_SETTINGS, migrateStationSettings } from './state/StationStateMap'
import {
  buildStationComputeDeps,
  syncPersistedToStateMap,
  recomputeStation,
  getFilteredGroupedFlows,
  clearStationState
} from './logic/stationComputeService'
import { getLinkedSectorIdsFor, normalizeSectorLinks } from './logic/sectorLinks'
import {
  createBindingPlanStationId,
  parseBindingStationId,
  toProductionStation
} from './logic/productionSourceAdapter'
import {
  createEmpireSourceView,
  computeActiveStation,
  computeActiveTransitSectorId,
  toTransitTabId,
  fromTransitTabId
} from './logic/empireSourceView'
import {
  createEmpireFlowFacade,
  type SectorLinkCalcEntry
} from './logic/empireFlowFacade'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'

const V1_STORAGE_KEY = 'x4_station_data'

function createDefaultEmpire(name: string = ''): EmpirePlan {
  return {
    id: crypto.randomUUID(),
    name,
    sectors: [],
    sectorLinks: [],
    stations: []
  }
}

export type { SavedEmpiresState } from '@/types/x4'

export const useEmpireStore = defineStore('empire', () => {
const gameData = useGameDataStore()
  const empireDataStore = useEmpireDataStore()
  const saveBindingStore = useSaveBindingStore()
  const saveStore = useSaveStore()
  const activeViewStore = useActiveViewStore()
  const { savedEmpires } = storeToRefs(empireDataStore)
  const { activeBinding } = storeToRefs(saveBindingStore)
  const { selectedArchive } = storeToRefs(saveStore)

  const isReady = ref(false)
  const lastSavedSnapshot = ref<string>('')

  const productionSource = computed({
    get: () => activeViewStore.productionSource,
    set: (val) => activeViewStore.setProductionSource(val)
  })

  const version = computed(() => savedEmpires.value.version)
  const empires = computed(() => savedEmpires.value.list)
  const activeEmpireId = computed(() => savedEmpires.value.activeId)
  
  const activeEmpire = ref<EmpirePlan | null>(null)
  
  const activeStationId = computed({
    get: () => activeViewStore.activeStationId,
    set: (id: string | null) => activeViewStore.setActiveStationId(id)
  })

  const sourceView = createEmpireSourceView({
    productionSource,
    activeEmpire,
    activeBinding,
    selectedArchive
  })

  const sectors = sourceView.sectors
  const sectorLinks = sourceView.sectorLinks
  const orderedStationsBySector = sourceView.orderedStationsBySector
  const derivedBindingStations = sourceView.derivedBindingStations

  const flowFacade = createEmpireFlowFacade({
    productionSource,
    activeEmpire,
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
    activeEmpire.value,
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

  const allStations = computed(() => {
    const stations: { station: StationPlan; empireId: string }[] = []
    if (activeEmpire.value) {
      activeEmpire.value.stations.forEach(station => {
        stations.push({ station, empireId: activeEmpire.value!.id })
      })
    }
    savedEmpires.value.list.forEach(empire => {
      empire.stations.forEach(station => {
        stations.push({ station, empireId: empire.id })
      })
    })
    return stations
  })

  const industrialStations = computed(() => 
    allStations.value.filter(item => item.station.type === 'industrial')
  )

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
    const state = stationStateMap.get(stationId)
    if (!state) return null
    return getFilteredGroupedFlows(stationId)
  }

  function initializeAllStationCaches() {
    if (!activeEmpire.value) return
    activeEmpire.value.stations.forEach(station => {
      refreshStationFlowCache(station.id)
    })
  }

  function clearStationCaches() {
    stationStateMap.list().forEach(state => {
      clearStationState(state.stationId)
    })
  }

  function updateBindingStationPlan(
    stationId: string,
    patch: Partial<Pick<StationPlan, 'name' | 'type' | 'modules' | 'settings' | 'sectorId' | 'lockedWares' | 'warePriority' | 'count' | 'minerals'>>
  ): boolean {
    const binding = saveBindingStore.activeBinding
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
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
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
      return station
    }

    const station = empireDataStore.createStationInEmpire(activeEmpire.value, name, type)
    if (!station) return null
    if (selectAfterCreate) {
      activeStationId.value = station.id
    }
    refreshStationFlowCache(station.id)
    return station
  }

  function deleteStation(stationId: string) {
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
      if (!binding) return
      const parsed = parseBindingStationId(stationId)
      if (parsed?.kind === 'plan' && parsed.gameGuid === binding.gameGuid) {
        saveBindingStore.deleteStationPlan(binding.gameGuid, parsed.planId)
        stationStateMap.remove(stationId)
      }
      if (activeStationId.value === stationId) {
        activeStationId.value = null
      }
      return
    }

    const deleted = empireDataStore.deleteStationFromEmpire(activeEmpire.value, stationId)
    if (deleted) {
      stationStateMap.remove(stationId)
      if (activeStationId.value === stationId) {
        activeStationId.value = activeEmpire.value?.stations[0]?.id || null
      }
    }
  }

  function duplicateStation(stationId: string) {
    const newStation = empireDataStore.duplicateStationInEmpire(activeEmpire.value, stationId)
    if (!newStation) return null
    activeStationId.value = newStation.id
    refreshStationFlowCache(newStation.id)
    return newStation
  }

  function reorderStations(reorderedStations: StationPlan[]) {
    empireDataStore.reorderStationsInEmpire(activeEmpire.value, reorderedStations)
  }

  function setStationLocation(stationId: string, location: EntityLocation | null) {
    return empireDataStore.setStationLocationInEmpire(activeEmpire.value, stationId, location)
  }

  function clearStationLocation(stationId: string) {
    return setStationLocation(stationId, null)
  }

  function getLinkedSectors(sectorId: string): string[] {
    return getLinkedSectorIdsFor(sectorId, sectorLinks.value)
  }

  function renameBindingSector(sectorId: string, name: string): boolean {
    if (productionSource.value !== 'save-binding') return false
    const binding = saveBindingStore.activeBinding
    if (!binding) return false
    return saveBindingStore.updateGroup(binding.gameGuid, sectorId, { name })
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

  function getStationComponentGapFlows(stationId: string | null = activeStation.value?.id || null): StationComponentGapFlows {
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

  function renameStation(stationId: string, newName: string) {
    if (productionSource.value === 'save-binding') {
      return updateBindingStationPlan(stationId, { name: newName })
    }
    return empireDataStore.renameStationInEmpire(activeEmpire.value, stationId, newName)
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

  function getTransitTabId(sectorId: string) {
    return toTransitTabId(sectorId)
  }

  function updateStationSettings(stationId: string, settings: Partial<StationSettings>) {
    if (productionSource.value === 'save-binding') {
      const station = getDerivedBindingStation(stationId)
      const current = migrateStationSettings(station?.settings || DEFAULT_STATION_SETTINGS)
      updateBindingStationPlan(stationId, { settings: { ...current, ...settings } })
      refreshStationFlowCache(stationId)
      return
    }
    if (empireDataStore.updateStationSettingsInEmpire(activeEmpire.value, stationId, settings)) {
      refreshStationFlowCache(stationId)
    }
  }

  function updateStationModules(stationId: string, modules: SavedModule[]) {
    if (productionSource.value === 'save-binding') {
      updateBindingStationPlan(stationId, { modules })
      refreshStationFlowCache(stationId)
      return
    }
    if (empireDataStore.updateStationModulesInEmpire(activeEmpire.value, stationId, modules)) {
      refreshStationFlowCache(stationId)
    }
  }

  function updateStationType(stationId: string, type: StationType) {
    if (productionSource.value === 'save-binding') {
      updateBindingStationPlan(stationId, { type })
      refreshStationFlowCache(stationId)
      return
    }
    empireDataStore.updateStationTypeInEmpire(activeEmpire.value, stationId, type)
    refreshStationFlowCache(stationId)
  }

  function updateStationCount(stationId: string, count: number) {
    if (productionSource.value === 'save-binding') {
      updateBindingStationPlan(stationId, { count })
      refreshStationFlowCache(stationId)
      return
    }
    empireDataStore.updateStationCountInEmpire(activeEmpire.value, stationId, count)
    refreshStationFlowCache(stationId)
  }

  function updateStationMinerals(stationId: string, minerals: string[]) {
    if (productionSource.value === 'save-binding') {
      updateBindingStationPlan(stationId, { minerals })
      refreshStationFlowCache(stationId)
      return
    }
    empireDataStore.updateStationMineralsInEmpire(activeEmpire.value, stationId, minerals)
    refreshStationFlowCache(stationId)
  }

  function applyImportedStationPayload(
    stationId: string,
    payload: { modules: SavedModule[]; lockedWares: string[]; warePriority: Record<string, number> }
  ): boolean {
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
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
    const station = getStationById(stationId)
    if (!station) return false
    station.modules = payload.modules.map(m => ({ ...m }))
    station.lockedWares = [...payload.lockedWares]
    station.warePriority = { ...payload.warePriority }
    station.lastUpdated = Date.now()
    refreshStationFlowCache(stationId)
    return true
  }

  function updateEmpireName(name: string) {
    empireDataStore.renameEmpireDraft(activeEmpire.value, name)
  }

  function serializeEmpireForDirtyCheck() {
    return JSON.stringify({
      activeEmpire: activeEmpire.value ? JSON.parse(JSON.stringify(activeEmpire.value)) : null
    })
  }

  function takeSnapshot() {
    lastSavedSnapshot.value = serializeEmpireForDirtyCheck()
  }

  function getModuleLookup() {
    return {
      modulesMap: gameData.modulesMap,
      modulesByMacroId: gameData.modulesByMacroId
    }
  }

  function loadData(data: SavedEmpiresState | V1StorageState) {
    const migrated = migrateEmpireStateToCurrent(data, getModuleLookup())
    migrated.warnings.forEach((warning) => console.warn('[EmpireStore][Migration]', warning))

    savedEmpires.value = migrated.state
    
    if (migrated.state.list.length === 0) {
      const defaultEmpire = createDefaultEmpire('')
      savedEmpires.value.list.push(defaultEmpire)
      savedEmpires.value.activeId = defaultEmpire.id
      activeEmpire.value = JSON.parse(JSON.stringify(defaultEmpire))
      activeStationId.value = null
      takeSnapshot()
      return
    }
    
    if (migrated.state.activeId && activeViewStore.productionSource === 'empire') {
      const empire = migrated.state.list.find(e => e.id === migrated.state.activeId)
      if (empire) {
        if (!Array.isArray(empire.sectorLinks)) {
          empire.sectorLinks = []
        }
        const validSectorIds = new Set((empire.sectors || []).map((sector) => sector.id))
        empire.sectorLinks = normalizeSectorLinks(empire.sectorLinks, validSectorIds)
        empire.stations.forEach(station => {
          if (station.count === null || station.count === undefined) {
            station.count = 1
          }
          station.settings = migrateStationSettings(station.settings)
        })
        activeEmpire.value = JSON.parse(JSON.stringify(empire))
        
        const storedTabId = activeViewStore.activeStationId
        const isValidTabId = (tabId: string | null) => {
          if (!tabId) return false
          const transitSectorId = fromTransitTabId(tabId)
          if (transitSectorId) {
            return (empire.sectors || []).some((sector) => sector.id === transitSectorId)
          }
          return empire.stations.some((station) => station.id === tabId)
        }

        const isValid = isValidTabId(storedTabId)
        if (!isValid) {
          activeStationId.value = null
        }
      }
    }
    takeSnapshot()
  }

  function saveToStorage() {
    empireDataStore.saveToStorage()
  }

  function saveEmpire() {
    if (!activeEmpire.value) return
    
    const empireData = JSON.parse(JSON.stringify(activeEmpire.value))
    const idx = savedEmpires.value.list.findIndex(e => e.id === empireData.id)
    
    if (idx !== -1) {
      savedEmpires.value.list[idx] = empireData
    } else {
      savedEmpires.value.list.push(empireData)
    }
    
    savedEmpires.value.activeId = empireData.id
    saveToStorage()
    takeSnapshot()
  }

  function saveCurrentSource() {
    if (productionSource.value === 'save-binding') {
      saveBindingStore.saveBinding()
      return true
    }
    saveEmpire()
    return true
  }

  function saveEmpireAs(name: string) {
    if (!activeEmpire.value) return false
    const newEmpire = JSON.parse(JSON.stringify(activeEmpire.value))
    newEmpire.id = crypto.randomUUID()
    newEmpire.name = name
    newEmpire.stations.forEach((s: { id: string }) => { s.id = crypto.randomUUID() })
    activeEmpire.value = newEmpire
    saveEmpire()
    return true
  }

  function requiresSaveAsOnSave() {
    if (productionSource.value === 'save-binding') return false
    return !savedEmpires.value.activeId
  }

  function createEmpire(name: string = ''): EmpirePlan {
    const empire = createDefaultEmpire(name)
    activeEmpire.value = empire
    activeStationId.value = null
    // New empire stays in-memory until user explicitly saves.
    // Avoid auto-persisting empty empires into saved list.
    savedEmpires.value.activeId = null
    takeSnapshot()
    return empire
  }

  function loadEmpire(empireId: string) {
    const empire = savedEmpires.value.list.find(e => e.id === empireId)
    if (empire) {
      clearStationCaches()
      activeEmpire.value = JSON.parse(JSON.stringify(empire))
      const active = activeEmpire.value
      if (active && !Array.isArray(active.sectorLinks)) {
        active.sectorLinks = []
      }
      if (active) {
        const validSectorIds = new Set((active.sectors || []).map((sector) => sector.id))
        active.sectorLinks = normalizeSectorLinks(active.sectorLinks, validSectorIds)
      }
      savedEmpires.value.activeId = empireId
      
      const storedTabId = activeViewStore.activeStationId
      const isValid = storedTabId && empire.stations.some(s => s.id === storedTabId)
      activeViewStore.switchToEmpire(empireId)
      if (isValid) {
        activeStationId.value = storedTabId
      }
      initializeAllStationCaches()
      takeSnapshot()
    }
  }

  function deleteEmpire(empireId: string) {
    const deletingActiveEmpire = activeEmpire.value?.id === empireId
    const deleted = empireDataStore.deleteEmpire(empireId)
    if (!deleted) return
    if (deletingActiveEmpire) {
      if (savedEmpires.value.list.length > 0) {
        loadEmpire(savedEmpires.value.list[0]!.id)
      } else {
        createEmpire()
      }
    }
    saveToStorage()
  }

  const isDirty = computed(() => {
    if (productionSource.value === 'save-binding') {
      return saveBindingStore.isDirty
    }
    if (isEmptyForSave()) return false
    const current = serializeEmpireForDirtyCheck()
    return current !== lastSavedSnapshot.value
  })

  function isEmptyForSave() {
    if (productionSource.value === 'save-binding') {
      return !saveBindingStore.activeBinding
    }
    if (!activeEmpire.value) return true
    const hasStations = (activeEmpire.value.stations || []).length > 0
    const hasSectors = (activeEmpire.value.sectors || []).length > 0
    return !hasStations && !hasSectors
  }

  function isEditable() {
    return false
  }

  function shouldConfirmBeforeEmpireReset() {
    return isDirty.value
  }

  function resetEmpireWithDefaultName(defaultName: string = '') {
    return createEmpire(defaultName)
  }

  async function initialize() {
    console.log('[EmpireStore] Initializing...')
    isReady.value = false
    
    try {
      await gameData.initialize()
      
      const stored = empireDataStore.loadFromStorage()
      if (stored && Array.isArray(stored.list)) {
        loadData(stored)
        saveToStorage()
        initializeAllStationCaches()
        
        applyActiveViewFallback()
        
        isReady.value = true
        console.log('[EmpireStore] Loaded saved empires')
        return
      }
      
      const v1Stored = localStorage.getItem(V1_STORAGE_KEY)
      if (v1Stored) {
        try {
          const v1Data = JSON.parse(v1Stored) as V1StorageState
          if (v1Data.version === 1) {
            console.log('[EmpireStore] Migrating V1 data...')
            loadData(v1Data)
            saveToStorage()
            localStorage.removeItem(V1_STORAGE_KEY)
            initializeAllStationCaches()
            
            applyActiveViewFallback()
            
            console.log('[EmpireStore] Migration complete')
            isReady.value = true
            return
          }
        } catch (e) {
          console.error('[EmpireStore] Failed to migrate V1 data:', e)
        }
      }
      
      createEmpire()
      activeViewStore.setProductionSource('empire')
      isReady.value = true
      console.log('[EmpireStore] Initialized with new empire')
      
    } catch (e) {
      console.error('[EmpireStore] Initialization failed:', e)
    }
  }

  function applyActiveViewFallback() {
    const source = activeViewStore.productionSource
    const storedBindingGuid = activeViewStore.activeBinding
    
    if (source === 'save-binding') {
      if (storedBindingGuid && saveBindingStore.savedBindings.list.some((b) => b.gameGuid === storedBindingGuid)) {
        openBindingForProduction(storedBindingGuid)
        validateActiveStationId()
        return
      }
      
      const firstBinding = saveBindingStore.savedBindings.list[0]
      if (firstBinding) {
        activeViewStore.activeBinding = firstBinding.gameGuid
        openBindingForProduction(firstBinding.gameGuid)
        validateActiveStationId()
        return
      }
      
      console.log('[EmpireStore] No bindings found, falling back to empire')
      activeViewStore.setProductionSource('empire')
      fallbackToFirstEmpire()
      return
    }
    
    fallbackToFirstEmpire()
  }

  function fallbackToFirstEmpire() {
    const storedId = activeViewStore.activeEmpireId
    
    if (storedId && savedEmpires.value.list.some((e) => e.id === storedId)) {
      loadEmpire(storedId)
      return
    }
    
    const firstEmpire = savedEmpires.value.list[0]
    if (firstEmpire) {
      activeViewStore.activeEmpireId = firstEmpire.id
      loadEmpire(firstEmpire.id)
      return
    }
    
    console.log('[EmpireStore] No empires found, creating new empire')
    createEmpire()
    activeViewStore.setProductionSource('empire')
  }

  function openBindingForProduction(gameGuid: string) {
    const currentDraft = saveBindingStore.activeBinding
    if (currentDraft?.gameGuid === gameGuid && saveBindingStore.activeGameGuid === gameGuid) {
      return
    }
    saveBindingStore.createOrOpenBinding(gameGuid)
  }

  function validateActiveStationId() {
    const currentStationId = activeViewStore.activeStationId
    if (!currentStationId) return
    if (productionSource.value !== 'save-binding') return
    
    const validIds = new Set(derivedBindingStations.value.map(item => item.station.id))
    if (validIds.has(currentStationId)) {
      activeStationId.value = currentStationId
    } else {
      activeStationId.value = null
    }
  }

  function switchToBinding(gameGuid: string): { needsConfirm: boolean } {
    if (productionSource.value === 'empire' && isDirty.value) {
      return { needsConfirm: true }
    }
    productionSource.value = 'save-binding'
    openBindingForProduction(gameGuid)
    return { needsConfirm: false }
  }

  function confirmSwitchToBinding(gameGuid: string) {
    productionSource.value = 'save-binding'
    openBindingForProduction(gameGuid)
  }

  function switchToEmpire() {
    productionSource.value = 'empire'
    activeStationId.value = null
  }

  return {
    isReady,
    isDirty,
    isEditable,
    isEmptyForSave,
    version,
    empires,
    activeEmpireId,
    activeEmpire,
    activeStation,
    activeStationId,
    activeTransitSectorId,
    sectors,
    sectorLinks,
    orderedStationsBySector,
    savedEmpires,
    allStations,
    industrialStations,
    stationFlowCache,
    getStationFlowCache,
    refreshStationFlowCache,
    initializeAllStationCaches,
    clearStationCaches,
    empireGroupedFlows,
    sectorInternalDataMap,
    sectorLinkCalcMap,
    loadData,
    saveToStorage,
    saveEmpire,
    saveCurrentSource,
    saveEmpireAs,
    requiresSaveAsOnSave,
    loadEmpire,
    deleteEmpire,
    createEmpire,
    createStation,
    deleteStation,
    duplicateStation,
    reorderStations,
    setStationLocation,
    clearStationLocation,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorLinkCalc,
    getStationComponentGapFlows,
    getTransitHubViewModel,
    renameStation,
    renameBindingSector,
    getLinkedSectors,
    selectStation,
    selectTransitSector,
    getTransitTabId,
    getStationById,
    updateStationSettings,
    updateStationModules,
    updateStationType,
    updateStationCount,
    updateStationMinerals,
    applyImportedStationPayload,
    updateEmpireName,
    shouldConfirmBeforeEmpireReset,
    resetEmpireWithDefaultName,
    takeSnapshot,
    initialize,
    productionSource,
    switchToBinding,
    confirmSwitchToBinding,
    switchToEmpire
  }
})
