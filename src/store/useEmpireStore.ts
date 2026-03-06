import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  EmpirePlan,
  SavedEmpiresState,
  StationPlan,
  StationType,
  V1StorageState,
  StationSettings,
  SavedModule,
  GroupedFlows,
  EmpireGroupedFlows,
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
    stations: []
  }
}

export type { SavedEmpiresState } from '@/types/x4'

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
      return {
        flows: [],
        empireGroups: {
          operations: [],
          supply: []
        }
      }
    }
    
    return analyzeEmpireWareFlow(
      activeEmpire.value.stations,
      (stationId) => stationStateMap.getFilteredGroupedFlows(stationId)
    )
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
      savedEmpires.value.activeId = empireId
      
      sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
      
      if (savedEmpires.value.activeStationId && empire.stations.find(s => s.id === savedEmpires.value.activeStationId)) {
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
    savedEmpires,
    allStations,
    industrialStations,
    stationFlowCache,
    getStationFlowCache,
    refreshStationFlowCache,
    initializeAllStationCaches,
    clearStationCaches,
    empireGroupedFlows,
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
