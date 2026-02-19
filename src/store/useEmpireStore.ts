import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  EmpirePlan,
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
import { stationStateMap, DEFAULT_STATION_SETTINGS, migrateStationSettings } from './state/StationStateMap'

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

function createDefaultEmpire(name: string = 'New Empire'): EmpirePlan {
  return {
    id: crypto.randomUUID(),
    name,
    stations: []
  }
}

export interface SavedEmpiresState {
  version: number
  activeId: string | null
  activeStationId: string | null
  list: EmpirePlan[]
}

export const useEmpireStore = defineStore('empire', () => {
  const gameData = useGameDataStore()

  const isReady = ref(false)
  const lastSavedSnapshot = ref<string>('')

  const savedEmpires = ref<SavedEmpiresState>({ version: 2, activeId: null, activeStationId: null, list: [] })
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
          products: [],
          operations: [],
          supply: []
        }
      }
    }
    
    const grouped = analyzeEmpireWareFlow(
      activeEmpire.value.stations,
      (stationId) => stationStateMap.getFilteredGroupedFlows(stationId)
    )

    const wares = gameData.waresMap || {}
    const getWareName = (wareId: string) => wares[wareId]?.name || wareId
    const sortByTierThenName = (a: EmpireWareFlow, b: EmpireWareFlow) => {
      const tierDiff = (b.tier ?? 0) - (a.tier ?? 0)
      if (tierDiff !== 0) return tierDiff
      return getWareName(a.wareId).localeCompare(getWareName(b.wareId), 'en', { sensitivity: 'base' })
    }

    return {
      ...grouped,
      empireGroups: {
        products: [...grouped.empireGroups.products].sort(sortByTierThenName),
        operations: [...grouped.empireGroups.operations].sort(sortByTierThenName),
        supply: [...grouped.empireGroups.supply].sort(sortByTierThenName)
      }
    }
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

  function takeSnapshot() {
    lastSavedSnapshot.value = JSON.stringify({
      activeEmpire: activeEmpire.value ? JSON.parse(JSON.stringify(activeEmpire.value)) : null,
      activeStationId: activeStationId.value
    })
  }

  function loadData(data: SavedEmpiresState) {
    savedEmpires.value = data
    if (data.activeId) {
      const empire = data.list.find(e => e.id === data.activeId)
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
        } else if (data.activeStationId && empire.stations.find(s => s.id === data.activeStationId)) {
          activeStationId.value = data.activeStationId
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

  function createEmpire(name: string = 'New Empire'): EmpirePlan {
    const empire = createDefaultEmpire(name)
    activeEmpire.value = empire
    activeStationId.value = null
    if (!savedEmpires.value.list.find(e => e.id === empire.id)) {
      savedEmpires.value.list.push(JSON.parse(JSON.stringify(empire)))
    }
    savedEmpires.value.activeId = empire.id
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
    const current = JSON.stringify({
      activeEmpire: activeEmpire.value ? JSON.parse(JSON.stringify(activeEmpire.value)) : null,
      activeStationId: activeStationId.value
    })
    return current !== lastSavedSnapshot.value
  })

  function migrateFromV1(v1Data: V1StorageState): SavedEmpiresState {
    const list: EmpirePlan[] = v1Data.list.map(plan => ({
      id: crypto.randomUUID(),
      name: plan.name,
      stations: [{
        ...plan,
        type: 'industrial' as StationType
      }]
    }))
    
    return {
      version: 2,
      activeId: list[0]?.id || null,
      activeStationId: list[0]?.stations[0]?.id || null,
      list
    }
  }

  async function initialize() {
    console.log('[EmpireStore] Initializing...')
    isReady.value = false
    
    try {
      await gameData.initialize()
      
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const data = JSON.parse(stored) as SavedEmpiresState
          if ((data.version === 2 || data.version === 1) && data.list) {
            loadData(data)
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
            const data = migrateFromV1(v1Data)
            loadData(data)
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
    loadEmpire,
    deleteEmpire,
    createEmpire,
    createStation,
    deleteStation,
    duplicateStation,
    renameStation,
    selectStation,
    getStationById,
    updateStationSettings,
    updateStationModules,
    updateEmpireName,
    takeSnapshot,
    initialize
  }
})
