import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  EntityLocation,
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
  SectorInternalData,
  SupplyStorageFlow,
  TransitHubViewModel
} from '@/types/x4'
import { useGameDataStore } from './useGameDataStore'
import { analyzeEmpireWareFlow } from './logic/analyzeEmpireWareFlow'
import { solveMultiWareByLink, type SectorLinkInput, type SolveMultiWareByLinkOutput } from './logic/sectorLinkFlow'
import { buildTransitHubViewModel } from './logic/transitHubViewModel'
import { buildStationComponentGapFlows, type StationComponentGapFlows } from './logic/stationGapViewModel'
import { migrateEmpireStateToCurrent } from './logic/stateMigrations'
import { createSaveBindingActions } from './logic/saveBindingActions'
import { stationStateMap, DEFAULT_STATION_SETTINGS, migrateStationSettings } from './state/StationStateMap'
import { CURRENT_EMPIRE_VERSION } from './logic/storageVersions'
import { getLinkedSectorIdsFor, normalizeSectorLinkKey, normalizeSectorLinks, parseSectorLinkKey } from './logic/sectorLinks'

const V1_STORAGE_KEY = 'x4_station_data'
const SESSION_ACTIVE_STATION_KEY = 'x4_active_station_id'
const TRANSIT_TAB_PREFIX = 'transit:'

function toTransitTabId(sectorId: string) {
  return `${TRANSIT_TAB_PREFIX}${sectorId}`
}

function fromTransitTabId(tabId: string | null | undefined): string | null {
  if (!tabId || !tabId.startsWith(TRANSIT_TAB_PREFIX)) return null
  const sectorId = tabId.slice(TRANSIT_TAB_PREFIX.length)
  return sectorId || null
}

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
    warePriority: {},
    location: undefined
  }
}

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

function createEmptyEmpireGroupedFlows(): EmpireGroupedFlows {
  return {
    flows: [],
    empireGroups: {
      operations: [],
      supply: []
    }
  }
}

function createEmptySupplyStorageFlows(): SupplyStorageFlow[] {
  return []
}

interface SectorLinkCalcEntry {
  sectorId: string
  sectorsInput: Array<{ sectorId: string; netByWare: Record<string, number> }>
  solverOutput: SolveMultiWareByLinkOutput
}

export const useEmpireStore = defineStore('empire', () => {
  const gameData = useGameDataStore()

  function getStorageKey(): string {
    return gameData.getStorageKey('empire')
  }

  const isReady = ref(false)
  const lastSavedSnapshot = ref<string>('')
  const bindingDirtyMarker = ref(0)

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
  const activeTransitSectorId = computed(() => {
    if (!activeEmpire.value) return null
    const sectorId = fromTransitTabId(activeStationId.value)
    if (!sectorId) return null
    const exists = (activeEmpire.value.sectors || []).some((sector) => sector.id === sectorId)
    return exists ? sectorId : null
  })
  const sectors = computed<SectorPlan[]>(() => {
    if (!activeEmpire.value) return []
    const list = activeEmpire.value.sectors || []
    return [...list].sort((a, b) => a.order - b.order)
  })
  const sectorLinks = computed<string[]>(() => activeEmpire.value?.sectorLinks || [])

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

    const buildSupplyStorageFlows = (groupedFlows: EmpireGroupedFlows): SupplyStorageFlow[] => {
      const stationMap = new Map(stations.map((station) => [station.id, station]))
      const byWareId = new Map<string, SupplyStorageFlow>()

      groupedFlows.flows.forEach((flow) => {
        const details: SupplyStorageFlow['details'] = []
        let totalProductionStorageVolume = 0
        let totalConsumptionStorageVolume = 0

        flow.contributions.forEach((contribution) => {
          const station = stationMap.get(contribution.stationId)
          if (!station) return

          const staticProduction = Math.max(contribution.netRate, 0)
          const staticConsumption = Math.max(-contribution.netRate, 0)
          const productionStorageVolume = staticProduction * flow.unitVolume * station.settings.primaryProductBufferHours
          const consumptionStorageVolume = staticConsumption * flow.unitVolume * station.settings.resourceBufferHours

          if (productionStorageVolume > 0) {
            details.push({
              stationId: contribution.stationId,
              stationName: contribution.stationName,
              stationCount: contribution.stationCount,
              kind: 'production',
              staticRate: staticProduction,
              storageVolume: productionStorageVolume
            })
            totalProductionStorageVolume += productionStorageVolume
          }

          if (consumptionStorageVolume > 0) {
            details.push({
              stationId: contribution.stationId,
              stationName: contribution.stationName,
              stationCount: contribution.stationCount,
              kind: 'consumption',
              staticRate: staticConsumption,
              storageVolume: consumptionStorageVolume
            })
            totalConsumptionStorageVolume += consumptionStorageVolume
          }
        })

        byWareId.set(flow.wareId, {
          wareId: flow.wareId,
          orderIndex: flow.orderIndex,
          tier: flow.tier,
          transportType: flow.transportType,
          unitVolume: flow.unitVolume,
          totalProductionStorageVolume,
          totalConsumptionStorageVolume,
          totalRequiredStorageVolume: Math.max(totalProductionStorageVolume, totalConsumptionStorageVolume),
          details
        })
      })

      const products = groupedFlows.empireGroups.operations
        .filter((flow) => flow.netRate > 0)
        .map((flow) => flow.wareId)
      const operations = groupedFlows.empireGroups.operations
        .filter((flow) => flow.netRate <= 0)
        .map((flow) => flow.wareId)
      const supply = groupedFlows.empireGroups.supply.map((flow) => flow.wareId)
      const orderedWareIds = [...products, ...operations, ...supply]

      return orderedWareIds
        .map((wareId) => byWareId.get(wareId))
        .filter((item): item is SupplyStorageFlow => !!item && item.transportType === 'container')
    }

    sectorList.forEach((sector) => {
      const localStationIds = stations
        .filter((station) => station.sectorId === sector.id)
        .map((station) => station.id)

      const localStationSet = new Set(localStationIds)
      const localStations = stations.filter((station) => localStationSet.has(station.id))
      const localGroupedFlows = analyzeEmpireWareFlow(localStations, (stationId) => stationStateMap.getFilteredGroupedFlows(stationId))

      map.set(sector.id, {
        sectorId: sector.id,
        planning: {
          sectorId: sector.id,
          localStationIds
        },
        localGroupedFlows,
        supplyStorageFlows: buildSupplyStorageFlows(localGroupedFlows)
      })
    })

    return map
  })

  const sectorLinkCalcMap = computed<Map<string, SectorLinkCalcEntry>>(() => {
    const result = new Map<string, SectorLinkCalcEntry>()
    if (!activeEmpire.value || !gameData.modulesMap) return result

    const links: SectorLinkInput[] = (activeEmpire.value.sectorLinks || [])
      .map((key) => parseSectorLinkKey(key))
      .filter((item): item is { a: string; b: string } => !!item)
      .map((item) => ({
        linkId: `${item.a}|${item.b}`,
        a: item.a,
        b: item.b,
        distance: 1
      }))

    const rawNetByWareBySector = new Map<string, Record<string, number>>()
    sectors.value.forEach((sector) => {
      const localStations = orderedStationsBySector.value.filter((station) => station.sectorId === sector.id)
      const rawGroupedFlows = analyzeEmpireWareFlow(localStations, (stationId) => stationStateMap.getGroupedFlows(stationId))
      const netByWare: Record<string, number> = {}
      rawGroupedFlows.flows
        .filter((flow) => flow.transportType === 'container')
        .forEach((flow) => {
          netByWare[flow.wareId] = Number(flow.netRate || 0)
        })
      rawNetByWareBySector.set(sector.id, netByWare)
    })

    const sectorsInput = sectors.value.map((sector) => ({
      sectorId: sector.id,
      netByWare: rawNetByWareBySector.get(sector.id) || {}
    }))

    const solverOutput = solveMultiWareByLink({
      sectors: sectorsInput,
      links,
      epsilon: 1e-9
    })

    if (import.meta.env.DEV) {
      const wareIds = Array.from(new Set(
        sectorsInput.flatMap((sectorInput) => Object.keys(sectorInput.netByWare || {}))
      )).sort()
      console.groupCollapsed(`[SectorLinkCalc][TransitHub] mode=global-all-container wares=${wareIds.join(',')}`)
      console.log('[SectorLinkCalc][TransitHub] links', links)
      sectorsInput.forEach((sectorInput) => {
        const relatedFlows = solverOutput.linkWareFlows.filter(
          (flow) => flow.from === sectorInput.sectorId || flow.to === sectorInput.sectorId
        )
        const allocated = solverOutput.allocatedDemandBySector.find((item) => item.sectorId === sectorInput.sectorId)
        const deficit = solverOutput.deficitSummary.deficitByNode.find((item) => item.sectorId === sectorInput.sectorId)
        const producers = solverOutput.deficitSummary.producerNodes.find((item) => item.sectorId === sectorInput.sectorId)
        console.groupCollapsed(`[SectorLinkCalc][TransitHub][Sector] ${sectorInput.sectorId}`)
        console.log('input.netByWare', sectorInput.netByWare)
        console.log('output.linkWareFlows', relatedFlows)
        console.log('output.allocatedDemand', allocated || null)
        console.log('output.deficit', deficit || null)
        console.log('output.producers', producers || null)
        console.groupEnd()
      })
      console.log('[SectorLinkCalc][TransitHub] totalDeficit', solverOutput.deficitSummary.totalDeficit)
      console.groupEnd()
    }

    sectors.value.forEach((viewSector) => {
      result.set(viewSector.id, {
        sectorId: viewSector.id,
        sectorsInput,
        solverOutput
      })
    })

    return result
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
    
    if (migrated.state.list.length === 0) {
      const defaultEmpire = createDefaultEmpire('')
      savedEmpires.value.list.push(defaultEmpire)
      savedEmpires.value.activeId = defaultEmpire.id
      activeEmpire.value = JSON.parse(JSON.stringify(defaultEmpire))
      activeStationId.value = null
      takeSnapshot()
      return
    }
    
    if (migrated.state.activeId) {
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
        
        const isValidTabId = (tabId: string | null) => {
          if (!tabId) return false
          const transitSectorId = fromTransitTabId(tabId)
          if (transitSectorId) {
            return (empire.sectors || []).some((sector) => sector.id === transitSectorId)
          }
          return empire.stations.some((station) => station.id === tabId)
        }

        const sessionTabId = sessionStorage.getItem(SESSION_ACTIVE_STATION_KEY)
        if (isValidTabId(sessionTabId)) {
          activeStationId.value = sessionTabId
        } else if (migrated.state.activeStationId === null) {
          activeStationId.value = null
        } else if (isValidTabId(migrated.state.activeStationId)) {
          activeStationId.value = migrated.state.activeStationId
        } else {
          activeStationId.value = empire.stations[0]?.id || null
        }
      }
    }
    takeSnapshot()
  }

  function saveToStorage() {
    const data = JSON.stringify(savedEmpires.value)
    localStorage.setItem(getStorageKey(), data)
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
      if (active && !Array.isArray(active.sectorLinks)) {
        active.sectorLinks = []
      }
      if (active) {
        const validSectorIds = new Set((active.sectors || []).map((sector) => sector.id))
        active.sectorLinks = normalizeSectorLinks(active.sectorLinks, validSectorIds)
      }
      savedEmpires.value.activeId = empireId
      
      sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
      
      const isValidTabId = (tabId: string | null) => {
        if (!tabId) return false
        const transitSectorId = fromTransitTabId(tabId)
        if (transitSectorId) {
          return (activeEmpire.value?.sectors || []).some((sector) => sector.id === transitSectorId)
        }
        return empire.stations.some((station) => station.id === tabId)
      }

      if (savedEmpires.value.activeStationId === null) {
        activeStationId.value = null
      } else if (isValidTabId(savedEmpires.value.activeStationId)) {
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

  function createStation(name: string, type: StationType = 'industrial', selectAfterCreate: boolean = true) {
    if (!activeEmpire.value) return null
    
    const station = createDefaultStation(name, type)
    station.sectorId = null
    activeEmpire.value.stations.push(station)
    if (selectAfterCreate) {
      activeStationId.value = station.id
    }
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
    if (!Array.isArray(activeEmpire.value.sectorLinks)) activeEmpire.value.sectorLinks = []
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

  function setStationLocation(stationId: string, location: EntityLocation | null) {
    if (!activeEmpire.value) return false
    const station = activeEmpire.value.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.location = location ? JSON.parse(JSON.stringify(location)) : undefined
    station.lastUpdated = Date.now()
    return true
  }

  function clearStationLocation(stationId: string) {
    return setStationLocation(stationId, null)
  }

  function setSectorLocation(sectorId: string, location: EntityLocation | null) {
    if (!activeEmpire.value) return false
    const sector = (activeEmpire.value.sectors || []).find((item) => item.id === sectorId)
    if (!sector) return false
    sector.location = location ? JSON.parse(JSON.stringify(location)) : undefined
    return true
  }

  function clearSectorLocation(sectorId: string) {
    return setSectorLocation(sectorId, null)
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
    activeEmpire.value.sectorLinks = (activeEmpire.value.sectorLinks || []).filter((key) => {
      const linkedIds = getLinkedSectorIdsFor(sectorId, [key])
      return linkedIds.length === 0
    })
    if (activeTransitSectorId.value === sectorId) {
      activeStationId.value = null
      sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
    }
    return true
  }

  function createSectorLink(sourceSectorId: string, targetSectorId: string) {
    if (!activeEmpire.value) return { ok: false as const, reason: 'no-active-empire' as const }
    const sourceExists = (activeEmpire.value.sectors || []).some((sector) => sector.id === sourceSectorId)
    const targetExists = (activeEmpire.value.sectors || []).some((sector) => sector.id === targetSectorId)
    if (!sourceExists || !targetExists) return { ok: false as const, reason: 'invalid-target' as const }

    const key = normalizeSectorLinkKey(sourceSectorId, targetSectorId)
    if (!key) return { ok: false as const, reason: 'self-link' as const }

    if (!Array.isArray(activeEmpire.value.sectorLinks)) activeEmpire.value.sectorLinks = []
    if (activeEmpire.value.sectorLinks.includes(key)) {
      return { ok: false as const, reason: 'duplicate-link' as const }
    }

    activeEmpire.value.sectorLinks.push(key)
    return { ok: true as const }
  }

  function removeSectorLink(a: string, b: string) {
    if (!activeEmpire.value || !Array.isArray(activeEmpire.value.sectorLinks)) return false
    const key = normalizeSectorLinkKey(a, b)
    if (!key) return false
    const prev = activeEmpire.value.sectorLinks.length
    activeEmpire.value.sectorLinks = activeEmpire.value.sectorLinks.filter((item) => item !== key)
    return activeEmpire.value.sectorLinks.length !== prev
  }

  function getLinkedSectors(sectorId: string): string[] {
    return getLinkedSectorIdsFor(sectorId, sectorLinks.value)
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
      localGroupedFlows: createEmptyEmpireGroupedFlows(),
      supplyStorageFlows: createEmptySupplyStorageFlows()
    }
  }

  function getSectorLinkCalc(sectorId: string): SectorLinkCalcEntry | null {
    return sectorLinkCalcMap.value.get(sectorId) || null
  }

  function getStationComponentGapFlows(stationId: string | null = activeStation.value?.id || null): StationComponentGapFlows {
    if (!activeEmpire.value || !stationId) {
      return { operations: [], supply: [] }
    }

    const station = activeEmpire.value.stations.find((item) => item.id === stationId)
    const currentSectorId = station?.sectorId || ''
    if (!currentSectorId) {
      return { operations: [], supply: [] }
    }

    return buildStationComponentGapFlows({
      currentSectorId,
      sectors: sectors.value,
      sectorLinks: sectorLinks.value,
      orderedStations: orderedStationsBySector.value,
      sectorInternalDataMap: sectorInternalDataMap.value
    })
  }

  function getTransitHubViewModel(input: {
    sectorId: string | null
    racePreference: string
    transportShipCapacity: number
    storageBufferHours?: number
  }): TransitHubViewModel {
    if (!input.sectorId) {
      return buildTransitHubViewModel({
        sectorId: null,
        sectors: sectors.value,
        stations: orderedStationsBySector.value,
        localGroupedFlows: createEmptyEmpireGroupedFlows(),
        solverOutput: null,
        waresMap: gameData.waresMap || undefined,
        modulesMap: gameData.modulesMap || undefined,
        racePreference: input.racePreference,
        transportShipCapacity: input.transportShipCapacity,
        storageBufferHours: input.storageBufferHours
      })
    }

    const sectorData = getSectorInternalData(input.sectorId)
    const sectorLinkCalc = getSectorLinkCalc(input.sectorId)

    return buildTransitHubViewModel({
      sectorId: input.sectorId,
      sectors: sectors.value,
      stations: orderedStationsBySector.value,
      localGroupedFlows: sectorData.localGroupedFlows,
      solverOutput: sectorLinkCalc?.solverOutput || null,
      waresMap: gameData.waresMap || undefined,
      modulesMap: gameData.modulesMap || undefined,
      racePreference: input.racePreference,
      transportShipCapacity: input.transportShipCapacity,
      storageBufferHours: input.storageBufferHours
    })
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

  function selectTransitSector(sectorId: string | null) {
    if (!sectorId) {
      activeStationId.value = null
      sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
      return
    }
    if (!activeEmpire.value) return
    const exists = (activeEmpire.value.sectors || []).some((sector) => sector.id === sectorId)
    if (!exists) return
    const transitTabId = toTransitTabId(sectorId)
    activeStationId.value = transitTabId
    sessionStorage.setItem(SESSION_ACTIVE_STATION_KEY, transitTabId)
  }

  function getTransitTabId(sectorId: string) {
    return toTransitTabId(sectorId)
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

  function updateStationSector(stationId: string, sectorId: string | null) {
    const station = getStationById(stationId)
    if (station) {
      station.sectorId = sectorId || undefined
      station.lastUpdated = Date.now()
    }
  }

  function updateEmpireName(name: string) {
    if (activeEmpire.value) {
      activeEmpire.value.name = name
    }
  }

  const isDirty = computed(() => {
    void bindingDirtyMarker.value
    if (isEmptyForSave()) return false
    const current = serializeEmpireForDirtyCheck()
    return current !== lastSavedSnapshot.value
  })

  function isEmptyForSave() {
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

  // ========== SavePlans Binding Actions ==========
  function onBindingDirty() {
    bindingDirtyMarker.value++
  }

  const bindingActions = createSaveBindingActions(activeEmpire, onBindingDirty, updateStationSector)

  // ========== End SavePlans Binding Actions ==========

  async function initialize() {
    console.log('[EmpireStore] Initializing...')
    isReady.value = false
    
    try {
      await gameData.initialize()
      
      const stored = localStorage.getItem(getStorageKey())
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
    createSectorLink,
    removeSectorLink,
    getLinkedSectors,
    moveStationToSector,
    setStationLocation,
    clearStationLocation,
    setSectorLocation,
    clearSectorLocation,
    setSectorStationOrder,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorLinkCalc,
    getStationComponentGapFlows,
    getTransitHubViewModel,
    renameStation,
    selectStation,
    selectTransitSector,
    getTransitTabId,
    getStationById,
    updateStationSettings,
    updateStationModules,
    updateStationSector,
    updateEmpireName,
    shouldConfirmBeforeEmpireReset,
    resetEmpireWithDefaultName,
    takeSnapshot,
    initialize,
    // SaveBindings
    getActiveBinding: bindingActions.getActiveBinding,
    getBindingByGameGuid: bindingActions.getBindingByGameGuid,
    createBinding: bindingActions.createBinding,
    setActiveBinding: bindingActions.setActiveBinding,
    setSelectedArchiveTime: bindingActions.setSelectedArchiveTime,
    bindSectorGroup: bindingActions.bindSectorGroup,
    updateSectorGroupJumpRange: bindingActions.updateSectorGroupJumpRange,
    clearSectorGroupBinding: bindingActions.clearSectorGroupBinding,
    getGroupBinding: bindingActions.getGroupBinding,
    setTradestationBinding: bindingActions.setTradestationBinding,
    clearTradestationBinding: bindingActions.clearTradestationBinding,
    bindTradestationToSaveStation: bindingActions.bindTradestationToSaveStation,
    clearTradestationCode: bindingActions.clearTradestationCode,
    bindStationToSaveStation: bindingActions.bindStationToSaveStation,
    clearStationBinding: bindingActions.clearStationBinding,
    setStationBindingPosition: bindingActions.setStationBindingPosition,
    isSaveStationAlreadyBound: bindingActions.isSaveStationAlreadyBound,
    importSaveStationAsBinding: bindingActions.importSaveStationAsBinding,
    deleteBinding: bindingActions.deleteBinding,
    setFreeSectorBinding: bindingActions.setFreeSectorBinding,
    setFreeStationBinding: bindingActions.setFreeStationBinding
  }
})
