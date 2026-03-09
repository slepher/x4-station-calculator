import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  EmpirePlan,
  SectorPlan,
  SavedEmpiresState,
  StationPlan,
  StationType,
  V1StorageState,
  StationSettings,
  SavedModule,
  GroupedFlows,
  EmpireGroupedFlows,
  SupplyPlanningInput,
  SectorInternalData
} from '@/types/x4'
import { useGameDataStore } from './useGameDataStore'
import { analyzeEmpireWareFlow } from './logic/analyzeEmpireWareFlow'
import { migrateEmpireStateToCurrent } from './logic/stateMigrations'
import { stationStateMap, DEFAULT_STATION_SETTINGS, migrateStationSettings } from './state/StationStateMap'
import { CURRENT_EMPIRE_VERSION } from './logic/storageVersions'

const STORAGE_KEY = 'x4_empire_data'
const V1_STORAGE_KEY = 'x4_station_data'
const SESSION_ACTIVE_STATION_KEY = 'x4_active_station_id'

function createDefaultStation(name: string, type: StationType = 'industrial'): StationPlan {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    count: 1,
    modules: [],
    settings: { ...DEFAULT_STATION_SETTINGS },
    lastUpdated: Date.now(),
    lockedWares: [],
    warePriority: {}
  }
}

function createDefaultEmpire(name: string = ''): EmpirePlan {
  return {
    id: crypto.randomUUID(),
    name,
    sectors: [createDefaultSector(0)],
    stations: []
  }
}

function createDefaultSector(index: number): SectorPlan {
  return {
    id: crypto.randomUUID(),
    name: `Sector ${index + 1}`,
    order: index
  }
}

export type { SavedEmpiresState } from '@/types/x4'

function createEmptyEmpireGroupedFlows(): EmpireGroupedFlows {
  return {
    flows: [],
    empireGroups: {
      operations: [],
      supply: []
    }
  }
}

export const useEmpireStore = defineStore('empire', () => {
  const gameData = useGameDataStore()

  const isReady = ref(false)
  const lastSavedSnapshot = ref<string>('')

  const savedEmpires = ref<SavedEmpiresState>({ version: CURRENT_EMPIRE_VERSION, activeId: null, activeStationId: null, list: [] })
  const version = computed(() => savedEmpires.value.version)
  const empires = computed(() => savedEmpires.value.list)
  const activeEmpireId = computed(() => savedEmpires.value.activeId)
  
  const activeEmpire = ref<EmpirePlan | null>(null)
  const activeStationId = ref<string | null>(null)
  
  const stationFlowCache = computed<Map<string, GroupedFlows>>(() => {
    const cache = new Map<string, GroupedFlows>()
    if (!activeEmpire.value) return cache
    activeEmpire.value.stations.forEach(station => {
      cache.set(station.id, stationStateMap.getFilteredGroupedFlows(station.id))
    })
    return cache
  })

  const activeStation = computed(() => {
    if (!activeEmpire.value || !activeStationId.value) return null
    return activeEmpire.value.stations.find(s => s.id === activeStationId.value) || null
  })
  const sectors = computed<SectorPlan[]>(() => {
    if (!activeEmpire.value) return []
    const list = activeEmpire.value.sectors || []
    return [...list].sort((a, b) => a.order - b.order)
  })

  const orderedStationsBySector = computed<StationPlan[]>(() => {
    if (!activeEmpire.value) return []
    const stations = activeEmpire.value.stations || []
    const sectorOrderMap = new Map<string, number>(sectors.value.map((sector, idx) => [sector.id, idx]))
    const withIndex = stations.map((station, index) => ({ station, index }))
    withIndex.sort((a, b) => {
      const aOrder = a.station.sectorId ? (sectorOrderMap.get(a.station.sectorId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
      const bOrder = b.station.sectorId ? (sectorOrderMap.get(b.station.sectorId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.index - b.index
    })
    return withIndex.map((item) => item.station)
  })

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

  const empireGroupedFlows = computed<EmpireGroupedFlows>(() => {
    if (!activeEmpire.value || !gameData.modulesMap) {
      return createEmptyEmpireGroupedFlows()
    }
    
    return analyzeEmpireWareFlow(
      activeEmpire.value.stations,
      (stationId) => stationStateMap.getFilteredGroupedFlows(stationId)
    )
  })

  const sectorInternalDataMap = computed<Map<string, SectorInternalData>>(() => {
    const map = new Map<string, SectorInternalData>()
    if (!activeEmpire.value || !gameData.modulesMap) return map

    const stations = activeEmpire.value.stations || []
    const sectorList = sectors.value

    sectorList.forEach((sector) => {
      const localStationIds = stations
        .filter((station) => station.sectorId === sector.id)
        .map((station) => station.id)

      const localStationSet = new Set(localStationIds)
      const localStations = stations.filter((station) => localStationSet.has(station.id))

      map.set(sector.id, {
        sectorId: sector.id,
        planning: {
          sectorId: sector.id,
          localStationIds
        },
        localGroupedFlows: analyzeEmpireWareFlow(localStations, (stationId) => stationStateMap.getFilteredGroupedFlows(stationId))
      })
    })

    return map
  })

  function getComputeDeps() {
    const { modulesMap, waresMap, medicalConsumptionMap } = gameData
    if (!gameData.isReady || !modulesMap || !waresMap || !medicalConsumptionMap) return null
    return { modulesMap, waresMap, medicalConsumptionMap }
  }

  function refreshStationFlowCache(stationId: string) {
    const station = getStationById(stationId)
    if (!station) return
    const deps = getComputeDeps()
    if (!deps) return
    station.settings = migrateStationSettings(station.settings)
    stationStateMap.fromPersisted(stationId, station)
    stationStateMap.recompute(stationId, deps)
  }

  function getStationFlowCache(stationId: string): GroupedFlows | null {
    const state = stationStateMap.get(stationId)
    if (!state) return null
    return stationStateMap.getFilteredGroupedFlows(stationId)
  }

  function initializeAllStationCaches() {
    if (!activeEmpire.value) return
    activeEmpire.value.stations.forEach(station => {
      refreshStationFlowCache(station.id)
    })
  }

  function clearStationCaches() {
    stationStateMap.list().forEach(state => {
      stationStateMap.remove(state.stationId)
    })
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
    if (migrated.state.activeId) {
      const empire = migrated.state.list.find(e => e.id === migrated.state.activeId)
      if (empire) {
        if (!Array.isArray(empire.sectors) || empire.sectors.length === 0) {
          empire.sectors = [createDefaultSector(0)]
        }
        empire.stations.forEach(station => {
          if (station.count === null || station.count === undefined) {
            station.count = 1
          }
          station.settings = migrateStationSettings(station.settings)
        })
        activeEmpire.value = JSON.parse(JSON.stringify(empire))
        
        const sessionTabId = sessionStorage.getItem(SESSION_ACTIVE_STATION_KEY)
        if (sessionTabId && empire.stations.find(s => s.id === sessionTabId)) {
          activeStationId.value = sessionTabId
        } else if (migrated.state.activeStationId === null) {
          // Persisted overview state should survive reload.
          activeStationId.value = null
        } else if (migrated.state.activeStationId && empire.stations.find(s => s.id === migrated.state.activeStationId)) {
          activeStationId.value = migrated.state.activeStationId
        } else {
          activeStationId.value = empire.stations[0]?.id || null
        }
      }
    }
    takeSnapshot()
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedEmpires.value))
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
    savedEmpires.value.activeStationId = activeStationId.value
    saveToStorage()
    takeSnapshot()
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
    return !savedEmpires.value.activeId
  }

  function createEmpire(name: string = ''): EmpirePlan {
    const empire = createDefaultEmpire(name)
    activeEmpire.value = empire
    activeStationId.value = null
    // New empire stays in-memory until user explicitly saves.
    // Avoid auto-persisting empty empires into saved list.
    savedEmpires.value.activeId = null
    savedEmpires.value.activeStationId = null
    takeSnapshot()
    return empire
  }

  function loadEmpire(empireId: string) {
    const empire = savedEmpires.value.list.find(e => e.id === empireId)
    if (empire) {
      clearStationCaches()
      activeEmpire.value = JSON.parse(JSON.stringify(empire))
      const active = activeEmpire.value
      if (active && (!Array.isArray(active.sectors) || active.sectors.length === 0)) {
        active.sectors = [createDefaultSector(0)]
      }
      savedEmpires.value.activeId = empireId
      
      sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
      
      if (savedEmpires.value.activeStationId === null) {
        activeStationId.value = null
      } else if (savedEmpires.value.activeStationId && empire.stations.find(s => s.id === savedEmpires.value.activeStationId)) {
        activeStationId.value = savedEmpires.value.activeStationId
      } else {
        activeStationId.value = empire.stations[0]?.id || null
      }
      initializeAllStationCaches()
      takeSnapshot()
    }
  }

  function deleteEmpire(empireId: string) {
    const idx = savedEmpires.value.list.findIndex(e => e.id === empireId)
    if (idx !== -1) {
      savedEmpires.value.list.splice(idx, 1)
      if (savedEmpires.value.activeId === empireId) {
        savedEmpires.value.activeId = savedEmpires.value.list[0]?.id || null
      }
      if (activeEmpire.value?.id === empireId) {
        if (savedEmpires.value.list.length > 0) {
          loadEmpire(savedEmpires.value.list[0]!.id)
        } else {
          createEmpire()
        }
      }
      saveToStorage()
    }
  }

  function createStation(name: string, type: StationType = 'industrial') {
    if (!activeEmpire.value) return null
    
    const station = createDefaultStation(name, type)
    station.sectorId = null
    activeEmpire.value.stations.push(station)
    activeStationId.value = station.id
    refreshStationFlowCache(station.id)
    return station
  }

  function deleteStation(stationId: string) {
    if (!activeEmpire.value) return
    
    const index = activeEmpire.value.stations.findIndex(s => s.id === stationId)
    if (index !== -1) {
      activeEmpire.value.stations.splice(index, 1)
      stationStateMap.remove(stationId)
      if (activeStationId.value === stationId) {
        activeStationId.value = activeEmpire.value.stations[0]?.id || null
        if (activeStationId.value) {
          sessionStorage.setItem(SESSION_ACTIVE_STATION_KEY, activeStationId.value)
        } else {
          sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
        }
      }
    }
  }

  function duplicateStation(stationId: string) {
    if (!activeEmpire.value) return null
    
    const sourceStation = activeEmpire.value.stations.find(s => s.id === stationId)
    if (!sourceStation) return null
    
    const newStation: StationPlan = {
      ...JSON.parse(JSON.stringify(sourceStation)),
      id: crypto.randomUUID(),
      name: `${sourceStation.name} (Copy)`,
      sectorId: sourceStation.sectorId || null,
      lastUpdated: Date.now()
    }
    
    activeEmpire.value.stations.push(newStation)
    activeStationId.value = newStation.id
    refreshStationFlowCache(newStation.id)
    return newStation
  }

  function reorderStations(reorderedStations: StationPlan[]) {
    if (!activeEmpire.value) return

    const currentStations = activeEmpire.value.stations
    if (reorderedStations.length !== currentStations.length) return

    const reorderedIdSet = new Set(reorderedStations.map(station => station.id))
    if (reorderedIdSet.size !== currentStations.length) return
    if (currentStations.some(station => !reorderedIdSet.has(station.id))) return

    activeEmpire.value.stations = [...reorderedStations]
  }

  function createSector(name: string = ''): SectorPlan | null {
    if (!activeEmpire.value) return null
    const nextOrder = (activeEmpire.value.sectors || []).length
    const sector: SectorPlan = {
      id: crypto.randomUUID(),
      name: name || `Sector ${nextOrder + 1}`,
      order: nextOrder
    }
    if (!activeEmpire.value.sectors) activeEmpire.value.sectors = []
    activeEmpire.value.sectors.push(sector)
    return sector
  }

  function renameSector(sectorId: string, name: string) {
    if (!activeEmpire.value) return false
    const sector = (activeEmpire.value.sectors || []).find((item) => item.id === sectorId)
    if (!sector) return false
    sector.name = name
    return true
  }

  function reorderSectors(orderedSectorIds: string[]) {
    if (!activeEmpire.value) return
    const current = activeEmpire.value.sectors || []
    if (orderedSectorIds.length !== current.length) return
    const set = new Set(orderedSectorIds)
    if (set.size !== current.length) return
    if (current.some((sector) => !set.has(sector.id))) return
    const sectorMap = new Map(current.map((sector) => [sector.id, sector]))
    activeEmpire.value.sectors = orderedSectorIds.map((id, index) => ({
      ...(sectorMap.get(id) as SectorPlan),
      order: index
    }))
  }

  function moveStationToSector(stationId: string, sectorId: string | null) {
    if (!activeEmpire.value) return false
    const station = activeEmpire.value.stations.find((item) => item.id === stationId)
    if (!station) return false
    if (sectorId) {
      const exists = (activeEmpire.value.sectors || []).some((sector) => sector.id === sectorId)
      if (!exists) return false
    }
    station.sectorId = sectorId
    return true
  }

  function setSectorStationOrder(sectorId: string | null, orderedStationIds: string[]) {
    if (!activeEmpire.value) return false
    const matchSector = (station: StationPlan) => (station.sectorId || null) === sectorId
    const bucket = activeEmpire.value.stations.filter(matchSector)
    if (bucket.length !== orderedStationIds.length) return false
    const idSet = new Set(orderedStationIds)
    if (idSet.size !== bucket.length) return false
    if (bucket.some((station) => !idSet.has(station.id))) return false

    const stationMap = new Map(bucket.map((station) => [station.id, station]))
    const orderedBucket = orderedStationIds.map((id) => stationMap.get(id)!).filter(Boolean)

    const nextStations: StationPlan[] = []
    let bucketIndex = 0
    for (const station of activeEmpire.value.stations) {
      if (matchSector(station)) {
        const next = orderedBucket[bucketIndex++]
        if (next) nextStations.push(next)
      } else {
        nextStations.push(station)
      }
    }
    activeEmpire.value.stations = nextStations
    return true
  }

  function deleteSector(sectorId: string) {
    if (!activeEmpire.value) return false
    const sectorList = activeEmpire.value.sectors || []
    const idx = sectorList.findIndex((item) => item.id === sectorId)
    if (idx === -1) return false
    sectorList.splice(idx, 1)
    sectorList.forEach((sector, order) => {
      sector.order = order
    })
    activeEmpire.value.stations.forEach((station) => {
      if (station.sectorId === sectorId) station.sectorId = null
    })
    return true
  }

  function getSupplyPlanningInput(sectorId: string): SupplyPlanningInput {
    const internal = sectorInternalDataMap.value.get(sectorId)
    if (internal) return internal.planning
    return {
      sectorId,
      localStationIds: []
    }
  }

  function getSectorInternalData(sectorId: string): SectorInternalData {
    const internal = sectorInternalDataMap.value.get(sectorId)
    if (internal) return internal
    return {
      sectorId,
      planning: getSupplyPlanningInput(sectorId),
      localGroupedFlows: createEmptyEmpireGroupedFlows()
    }
  }

  function renameStation(stationId: string, newName: string) {
    if (!activeEmpire.value) return false
    
    const station = activeEmpire.value.stations.find(s => s.id === stationId)
    if (station) {
      station.name = newName
      station.lastUpdated = Date.now()
      return true
    }
    return false
  }

  function selectStation(stationId: string | null) {
    activeStationId.value = stationId
    if (stationId) {
      sessionStorage.setItem(SESSION_ACTIVE_STATION_KEY, stationId)
    } else {
      sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
    }
  }

  function getStationById(stationId: string): StationPlan | null {
    if (activeEmpire.value) {
      const station = activeEmpire.value.stations.find(s => s.id === stationId)
      if (station) return station
    }
    return null
  }

  function updateStationSettings(stationId: string, settings: Partial<StationSettings>) {
    const station = getStationById(stationId)
    if (station) {
      station.settings = { ...station.settings, ...settings }
      station.lastUpdated = Date.now()
      refreshStationFlowCache(stationId)
    }
  }

  function updateStationModules(stationId: string, modules: SavedModule[]) {
    const station = getStationById(stationId)
    if (station) {
      station.modules = modules
      station.lastUpdated = Date.now()
      refreshStationFlowCache(stationId)
    }
  }

  function updateEmpireName(name: string) {
    if (activeEmpire.value) {
      activeEmpire.value.name = name
    }
  }

  const isDirty = computed(() => {
    const current = serializeEmpireForDirtyCheck()
    return current !== lastSavedSnapshot.value
  })

  function isEmptyForSave() {
    return !activeEmpire.value || activeEmpire.value.stations.length === 0
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
      
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const data = JSON.parse(stored) as SavedEmpiresState | V1StorageState
          if (data && Array.isArray((data as SavedEmpiresState).list)) {
            loadData(data)
            saveToStorage()
            initializeAllStationCaches()
            isReady.value = true
            console.log('[EmpireStore] Loaded saved empires')
            return
          }
        } catch (e) {
          console.error('[EmpireStore] Failed to parse data:', e)
        }
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
            console.log('[EmpireStore] Migration complete')
            isReady.value = true
            return
          }
        } catch (e) {
          console.error('[EmpireStore] Failed to migrate V1 data:', e)
        }
      }
      
      createEmpire()
      isReady.value = true
      console.log('[EmpireStore] Initialized with new empire')
      
    } catch (e) {
      console.error('[EmpireStore] Initialization failed:', e)
    }
  }

  initialize()

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
    sectors,
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
    loadData,
    saveToStorage,
    saveEmpire,
    saveEmpireAs,
    requiresSaveAsOnSave,
    loadEmpire,
    deleteEmpire,
    createEmpire,
    createStation,
    deleteStation,
    duplicateStation,
    reorderStations,
    createSector,
    renameSector,
    reorderSectors,
    deleteSector,
    moveStationToSector,
    setSectorStationOrder,
    getSupplyPlanningInput,
    getSectorInternalData,
    renameStation,
    selectStation,
    getStationById,
    updateStationSettings,
    updateStationModules,
    updateEmpireName,
    shouldConfirmBeforeEmpireReset,
    resetEmpireWithDefaultName,
    takeSnapshot,
    initialize
  }
})
