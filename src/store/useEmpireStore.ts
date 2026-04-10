import { defineStore, storeToRefs } from 'pinia'
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
import type { BindingSectorGroup } from '@/types/x4'
import { useGameDataStore } from './useGameDataStore'
import { useEmpireDataStore } from './useEmpireDataStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useSaveStore } from './useSaveStore'
import { useActiveViewStore } from './useActiveViewStore'
import { analyzeEmpireWareFlow } from './logic/analyzeEmpireWareFlow'
import { solveMultiWareByLink, type SectorLinkInput, type SolveMultiWareByLinkOutput } from './logic/sectorLinkFlow'
import { buildTransitHubViewModel } from './logic/transitHubViewModel'
import { buildStationComponentGapFlows, type StationComponentGapFlows } from './logic/stationGapViewModel'
import { migrateEmpireStateToCurrent } from './logic/stateMigrations'
import { stationStateMap, DEFAULT_STATION_SETTINGS, migrateStationSettings } from './state/StationStateMap'
import { getLinkedSectorIdsFor, normalizeSectorLinkKey, normalizeSectorLinks, parseSectorLinkKey } from './logic/sectorLinks'
import {
  createBindingPlanStationId,
  deriveBindingStations,
  parseBindingStationId
} from './logic/productionSourceAdapter'

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

function buildBindingSectorLinks(groups: BindingSectorGroup[]): string[] {
  const validGroupIds = new Set(groups.map((group) => group.id))
  const links = new Set<string>()
  groups.forEach((group) => {
    ;(group.connectedGroupIds || []).forEach((targetId) => {
      if (!validGroupIds.has(targetId)) return
      const key = normalizeSectorLinkKey(group.id, targetId)
      if (key) links.add(key)
    })
  })
  return Array.from(links)
}

interface SectorLinkCalcEntry {
  sectorId: string
  sectorsInput: Array<{ sectorId: string; netByWare: Record<string, number> }>
  solverOutput: SolveMultiWareByLinkOutput
}

export const useEmpireStore = defineStore('empire', () => {
  const gameData = useGameDataStore()
  const empireDataStore = useEmpireDataStore()
  const saveBindingStore = useSaveBindingStore()
  const saveStore = useSaveStore()
  const activeViewStore = useActiveViewStore()
  const { savedEmpires } = storeToRefs(empireDataStore)

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
  const empireActiveStationId = computed({
    get: () => activeViewStore.activeStationId,
    set: (id: string | null) => activeViewStore.setActiveStationId(id)
  })

  const activeStationId = computed({
    get: () => productionSource.value === 'save-binding'
      ? saveBindingStore.activeStationId
      : empireActiveStationId.value,
    set: (id: string | null) => {
      if (productionSource.value === 'save-binding') {
        saveBindingStore.selectStation(id)
      } else {
        empireActiveStationId.value = id
      }
    }
  })

  const bindingActiveStationId = computed(() => saveBindingStore.activeStationId)

  const stationFlowCache = computed<Map<string, GroupedFlows>>(() => {
    const cache = new Map<string, GroupedFlows>()
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
      const archive = saveStore.selectedArchive
      const derived = deriveBindingStations(binding, archive)
      derived.forEach((item) => {
        cache.set(item.station.id, stationStateMap.getFilteredGroupedFlows(item.station.id))
      })
      return cache
    }
    if (!activeEmpire.value) return cache
    activeEmpire.value.stations.forEach(station => {
      cache.set(station.id, stationStateMap.getFilteredGroupedFlows(station.id))
    })
    return cache
  })

  const activeStation = computed(() => {
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
      const archive = saveStore.selectedArchive
      const derived = deriveBindingStations(binding, archive)
      return derived.find(item => item.station.id === bindingActiveStationId.value)?.station || null
    }
    if (!activeEmpire.value || !activeStationId.value) return null
    return activeEmpire.value.stations.find(s => s.id === activeStationId.value) || null
  })
  const activeTransitSectorId = computed(() => {
    const sectorId = fromTransitTabId(activeStationId.value)
    if (!sectorId) return null
    const exists = sectors.value.some((sector) => sector.id === sectorId)
    return exists ? sectorId : null
  })
  const sectors = computed<SectorPlan[]>(() => {
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
      if (!binding) return []
      return binding.groups.map((group, index) => ({
        id: group.id,
        name: group.name,
        order: index
      }))
    }
    if (!activeEmpire.value) return []
    const list = activeEmpire.value.sectors || []
    return [...list].sort((a, b) => a.order - b.order)
  })
  const sectorLinks = computed<string[]>(() => {
    if (productionSource.value === 'save-binding') {
      return buildBindingSectorLinks(saveBindingStore.activeBinding?.groups || [])
    }
    return activeEmpire.value?.sectorLinks || []
  })

  const orderedStationsBySector = computed<StationPlan[]>(() => {
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
      const archive = saveStore.selectedArchive
      const derived = deriveBindingStations(binding, archive)
      const sectorOrderMap = new Map<string, number>(sectors.value.map((sector, idx) => [sector.id, idx]))
      const withIndex = derived.map((item, index) => ({ station: item.station, index, groupId: item.groupId }))
      withIndex.sort((a, b) => {
        const aOrder = a.groupId ? (sectorOrderMap.get(a.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
        const bOrder = b.groupId ? (sectorOrderMap.get(b.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.index - b.index
      })
      return withIndex.map((item) => item.station)
    }
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

  const productionStations = computed<StationPlan[]>(() => orderedStationsBySector.value)
  const productionSectors = computed<SectorPlan[]>(() => sectors.value)
  const productionSectorLinks = computed<string[]>(() => sectorLinks.value)

  function getDerivedBindingStation(stationId: string): StationPlan | null {
    const binding = saveBindingStore.activeBinding
    if (!binding) return null
    const archive = saveStore.selectedArchive
    const derived = deriveBindingStations(binding, archive)
    return derived.find((item) => item.station.id === stationId)?.station || null
  }

  function updateBindingStationPlan(
    stationId: string,
    patch: Partial<Pick<StationPlan, 'name' | 'type' | 'modules' | 'settings' | 'sectorId'>>
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
        groupId: patch.sectorId
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
      settings: patch.settings ?? station?.settings ?? DEFAULT_STATION_SETTINGS
    })
    if (!plan) return false
    const nextId = createBindingPlanStationId(binding.gameGuid, plan.id)
    if (activeStationId.value === stationId) {
      activeStationId.value = nextId
    }
    return true
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
    if (!gameData.modulesMap) return map

    const stations = productionStations.value
    const sectorList = productionSectors.value

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
    if (!gameData.modulesMap) return result

    const links: SectorLinkInput[] = productionSectorLinks.value
      .map((key) => parseSectorLinkKey(key))
      .filter((item): item is { a: string; b: string } => !!item)
      .map((item) => ({
        linkId: `${item.a}|${item.b}`,
        a: item.a,
        b: item.b,
        distance: 1
      }))

    const rawNetByWareBySector = new Map<string, Record<string, number>>()
    productionSectors.value.forEach((sector) => {
      const localStations = productionStations.value.filter((station) => station.sectorId === sector.id)
      const rawGroupedFlows = analyzeEmpireWareFlow(localStations, (stationId) => stationStateMap.getGroupedFlows(stationId))
      const netByWare: Record<string, number> = {}
      rawGroupedFlows.flows
        .filter((flow) => flow.transportType === 'container')
        .forEach((flow) => {
          netByWare[flow.wareId] = Number(flow.netRate || 0)
        })
      rawNetByWareBySector.set(sector.id, netByWare)
    })

    const sectorsInput = productionSectors.value.map((sector) => ({
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

    productionSectors.value.forEach((viewSector) => {
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
        } else {
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
      
      sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
      
      activeStationId.value = null
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
      return {
        id: stationId,
        name: plan.name,
        type: plan.type,
        sectorId: plan.groupId || null,
        modules: plan.modules,
        settings: plan.settings,
        lastUpdated: 0,
        lockedWares: [],
        warePriority: {}
      }
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
        if (activeStationId.value) {
          sessionStorage.setItem(SESSION_ACTIVE_STATION_KEY, activeStationId.value)
        } else {
          sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
        }
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

  function createSector(name: string = ''): SectorPlan | null {
    return empireDataStore.createSectorInEmpire(activeEmpire.value, name)
  }

  function renameSector(sectorId: string, name: string) {
    return empireDataStore.renameSectorInEmpire(activeEmpire.value, sectorId, name)
  }

  function reorderSectors(orderedSectorIds: string[]) {
    empireDataStore.reorderSectorsInEmpire(activeEmpire.value, orderedSectorIds)
  }

  function moveStationToSector(stationId: string, sectorId: string | null) {
    if (productionSource.value === 'save-binding') {
      return updateBindingStationPlan(stationId, { sectorId })
    }
    return empireDataStore.moveStationToSectorInEmpire(activeEmpire.value, stationId, sectorId)
  }

  function setStationLocation(stationId: string, location: EntityLocation | null) {
    return empireDataStore.setStationLocationInEmpire(activeEmpire.value, stationId, location)
  }

  function clearStationLocation(stationId: string) {
    return setStationLocation(stationId, null)
  }

  function setSectorLocation(sectorId: string, location: EntityLocation | null) {
    return empireDataStore.setSectorLocationInEmpire(activeEmpire.value, sectorId, location)
  }

  function clearSectorLocation(sectorId: string) {
    return setSectorLocation(sectorId, null)
  }

  function setSectorStationOrder(sectorId: string | null, orderedStationIds: string[]) {
    return empireDataStore.setSectorStationOrderInEmpire(activeEmpire.value, sectorId, orderedStationIds)
  }

  function deleteSector(sectorId: string) {
    const deleted = empireDataStore.deleteSectorFromEmpire(activeEmpire.value, sectorId)
    if (!deleted) return false
    if (activeTransitSectorId.value === sectorId) {
      activeStationId.value = null
      sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
    }
    return true
  }

  function createSectorLink(sourceSectorId: string, targetSectorId: string) {
    return empireDataStore.createSectorLinkInEmpire(activeEmpire.value, sourceSectorId, targetSectorId)
  }

  function removeSectorLink(a: string, b: string) {
    return empireDataStore.removeSectorLinkInEmpire(activeEmpire.value, a, b)
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
    if (!stationId) {
      return { operations: [], supply: [] }
    }

    const station = productionStations.value.find((item) => item.id === stationId)
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
    if (productionSource.value === 'save-binding') {
      return updateBindingStationPlan(stationId, { name: newName })
    }
    return empireDataStore.renameStationInEmpire(activeEmpire.value, stationId, newName)
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
    const exists = sectors.value.some((sector) => sector.id === sectorId)
    if (!exists) return
    const transitTabId = toTransitTabId(sectorId)
    activeStationId.value = transitTabId
    sessionStorage.setItem(SESSION_ACTIVE_STATION_KEY, transitTabId)
  }

  function getTransitTabId(sectorId: string) {
    return toTransitTabId(sectorId)
  }

  function getStationById(stationId: string): StationPlan | null {
    if (productionSource.value === 'save-binding') {
      return getDerivedBindingStation(stationId)
    }
    if (activeEmpire.value) {
      const station = activeEmpire.value.stations.find(s => s.id === stationId)
      if (station) return station
    }
    return null
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

  function updateStationSector(stationId: string, sectorId: string | null) {
    if (productionSource.value === 'save-binding') {
      updateBindingStationPlan(stationId, { sectorId })
      return
    }
    empireDataStore.updateStationSectorInEmpire(activeEmpire.value, stationId, sectorId)
  }

  function updateEmpireName(name: string) {
    empireDataStore.renameEmpireDraft(activeEmpire.value, name)
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

  function openBindingForProduction(gameGuid: string) {
    const currentDraft = saveBindingStore.activeBinding
    if (currentDraft?.gameGuid === gameGuid && saveBindingStore.activeGameGuid === gameGuid) {
      return
    }
    saveBindingStore.createOrOpenBinding(gameGuid)
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
    productionSource,
    switchToBinding,
    confirmSwitchToBinding,
    switchToEmpire
  }
})
