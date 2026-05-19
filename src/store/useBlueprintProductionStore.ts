import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch, shallowRef } from 'vue'
import type {
  EmpirePlan,
  StationPlan,
  StationType,
  SavedModule,
  GroupedFlows,
  EmpireGroupedFlows,
  StationSettings,
  EntityLocation,
} from '@/types/x4'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import type {
  ProductionWorkbenchCapabilities,
  ProductionSessionState,
  ProductionContextState,
  ProductionStationState
} from '@/types/production-workbench-contract'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import { calculateNetProduction } from '@/store/logic/calculateBuildPlan'
import i18n from '@/i18n'
import { useGameDataStore } from './useGameDataStore'
import { useEmpireDataStore } from './useEmpireDataStore'
import { useActiveViewStore } from './useActiveViewStore'
import { migrateEmpireStateToCurrent } from './logic/stateMigrations'
import { DEFAULT_STATION_SETTINGS, type StationComputeDeps } from './state/stationSettings'
import { StationDerivedMap, type StationDerivedStaticDeps } from './state/StationDerivedMap'
import { deriveProductionFlows } from './logic/calculateWareFlowDerived'
import { deepClone } from '@/utils/deepClone'
import {
  createEmpireSourceView,
  computeActiveStation
} from './logic/empireSourceView'
import { buildDerivedActiveStationState } from './logic/productionStationShared'
import { classifyAndEnrichFlows } from './logic/empireFlowFacade'
import { createProductionModuleActions, type ProductionModuleStation } from './actions/productionModuleActions'
import { createProductionWareRuleActions } from './actions/productionWareRuleActions'
import { createProductionSettingActions, doesStationSettingsAffectFlowMap } from './actions/productionSettingActions'

function createDefaultEmpire(name: string = ''): EmpirePlan {
  return {
    id: crypto.randomUUID(),
    name,
    sectors: [],
    sectorLinks: [],
    stations: []
  }
}

export const useBlueprintProductionStore = defineStore('blueprintProduction', () => {
  const gameData = useGameDataStore()
  const empireDataStore = useEmpireDataStore()
  const activeViewStore = useActiveViewStore()
  const { savedEmpires } = storeToRefs(empireDataStore)

  const isReady = ref(false)
  const lastSavedSnapshot = ref<string>('')
  const buildPriceMultiplier = ref(0.5)
  const overviewBuyMultiplier = ref(0.5)
  const overviewSellMultiplier = ref(0.5)
  const planningDerivedMap = shallowRef<StationDerivedMap | null>(null)
  const refreshKey = ref(0)

  const empireModules = computed<SavedModule[]>(() => {
    if (!activeEmpire.value) return []
    const moduleMap = new Map<string, number>()
    for (const station of activeEmpire.value.stations) {
      for (const mod of station.modules || []) {
        moduleMap.set(mod.id, (moduleMap.get(mod.id) || 0) + (mod.count || 1))
      }
    }
    return Array.from(moduleMap.entries()).map(([id, count]) => ({ id, count }))
  })

  const empireCurrentNetProduction = computed<Record<string, number>>(() => {
    const deps = getComputeDeps()
    if (!deps) return {}
    return calculateNetProduction(
      empireModules.value,
      deps.modulesMap,
      false,
      100
    )
  })

  const activeEmpire = ref<EmpirePlan | null>(null)

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

  const activeStationId = computed({
    get: () => activeViewStore.activeEmpireStation,
    set: (id: string | null) => activeViewStore.activeEmpireStation = id
  })

  const productionSource = computed<'empire'>(() => 'empire')

  const sourceView = createEmpireSourceView({
    productionSource,
    activeEmpire,
    activeBinding: ref(null),
    playerStationRecords: ref([])
  })

  const orderedStations = sourceView.orderedStationsBySector

  const activeStation = computed(() => computeActiveStation(
    productionSource.value,
    [],
    activeEmpire.value,
    activeStationId.value
  ))

  const editableStationPlan = computed<StationPlan | null>(() => activeStation.value)

  function getStationById(stationId: string): StationPlan | null {
    return sourceView.getStationById(stationId)
  }

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

  function createPlanningDerivedMap(): StationDerivedMap | null {
    const deps = getDerivedStaticDeps()
    if (!deps) return null
    return new StationDerivedMap(deps, { refreshKey })
  }

  function ensurePlanningDerivedMap(): StationDerivedMap | null {
    if (planningDerivedMap.value) return planningDerivedMap.value
    const map = createPlanningDerivedMap()
    if (!map) return null
    planningDerivedMap.value = map
    return map
  }

  function resetPlanningDerivedMap(): StationDerivedMap | null {
    const map = createPlanningDerivedMap()
    planningDerivedMap.value = map
    return map
  }

  const plannedModules = computed<SavedModule[]>({
    get: () => editableStationPlan.value?.modules || [],
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.modules = deepClone(value)
      station.lastUpdated = Date.now()
      planningDerivedMap.value!.updateModules(station.id, station.modules)
    }
  })

  const lockedWares = computed<string[]>({
    get: () => editableStationPlan.value?.lockedWares || [],
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.lockedWares = deepClone(value)
      station.lastUpdated = Date.now()
      planningDerivedMap.value!.updateLockedWares(station.id, station.lockedWares)
    }
  })

  const warePriority = computed<Record<string, number>>({
    get: () => editableStationPlan.value?.warePriority || {},
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.warePriority = deepClone(value)
      station.lastUpdated = Date.now()
      planningDerivedMap.value!.updateWarePriority(station.id, station.warePriority)
    }
  })

  const settings = computed<StationSettings>({
    get: () => editableStationPlan.value?.settings || { ...DEFAULT_STATION_SETTINGS },
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      const previousSettings = { ...DEFAULT_STATION_SETTINGS, ...station.settings }
      station.settings = ({ ...DEFAULT_STATION_SETTINGS, ...value })
      station.lastUpdated = Date.now()
      const changedSettings = diffStationSettings(previousSettings, station.settings)
      if (doesStationSettingsAffectFlowMap(changedSettings)) {
        syncPlanStationSettingsFlow(station.id)
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
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        resolvedModules: []
      }
    }
    const cache = planningDerivedMap.value?.getCache(stationId) || null
    return buildDerivedActiveStationState({
      stationId,
      plannedModules: plannedModules.value,
      settings: settings.value,
      cache,
      deps: getComputeDeps()
    })
  })

  const tabSemanticsById = computed<Record<string, { tag?: string; factoryGroup?: string }>>(() => {
    const entries = orderedStations.value.map((station) => {
      const semantics = planningDerivedMap.value?.getCache(station.id)?.semantics
      return [
        station.id,
        {
          tag: semantics?.tag,
          factoryGroup: semantics?.factoryGroup
        }
      ] as const
    })
    return Object.fromEntries(entries)
  })

  const actualWorkforce = computed(() => activeStationState.value.actualWorkforce)
  const currentEfficiency = computed(() => activeStationState.value.currentEfficiency)
  const enforceDlcActivation = computed(() => gameData.enforceDlcActivation)

  function isModuleDlcActive(moduleId: string): boolean {
    return gameData.isDlcActive(gameData.modulesMap[moduleId]?.dlc_tag)
  }

  function isModuleCountEditable(moduleId: string): boolean {
    return !enforceDlcActivation.value || isModuleDlcActive(moduleId)
  }

  const moduleActions = createProductionModuleActions<ProductionModuleStation & StationPlan>({
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
    commitStationMutation: () => {},
    recomputeDerived: (station, _deps) => {
      syncPlanStationDerivedSnapshot(station.id)
    }
  })

  const wareRuleActions = createProductionWareRuleActions<StationPlan>({
    getActiveStation: () => editableStationPlan.value,
    getComputeDeps,
    getPlannedModules: () => plannedModules.value,
    getAutoIndustryModules: () => activeStationState.value.autoIndustryModules,
    getModulesMap: () => gameData.modulesMap,
    getWaresMap: () => gameData.waresMap,
    getLockedWares: () => lockedWares.value,
    getWarePriority: () => warePriority.value,
    cloneStringList: (values) => deepClone(values),
    clonePriorityMap: (values) => deepClone(values),
    now: () => Date.now(),
    commitStationMutation: () => {},
    recompute: (station, _deps) => {
      planningDerivedMap.value!.updateLockedWares(station.id, station.lockedWares || [])
      planningDerivedMap.value!.updateWarePriority(station.id, station.warePriority || {})
    }
  })

  watch(
    () => gameData.isReady,
    (newReady, oldReady) => {
      if (newReady && !oldReady && activeEmpire.value) {
        initializeAllStationDerived()
      }
    }
  )

  watch(
    () => gameData.enforceDlcActivation,
    () => {
      if (!activeEmpire.value) return
      activeEmpire.value.stations.forEach(station => {
        syncPlanStationDerivedSnapshot(station.id)
      })
    }
  )

  function syncPlanStationDerivedSnapshot(stationId: string) {
    const station = getStationById(stationId)
    if (!station) return
    ensurePlanningDerivedMap()!.upsertStation(stationId, {
      modulesMode: 'plan',
      sectorId: station.sectorId,
      modules: station.modules || [],
      settings: station.settings || {},
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {},
      count: station.count
    })
  }

  function syncPlanStationSettingsFlow(stationId: string) {
    const station = getStationById(stationId)
    if (!station) return
    const map = ensurePlanningDerivedMap()
    if (!map) return
    map.updateSettings(stationId, station.settings || {})
  }

  function getEmpireGroupedFlows(): EmpireGroupedFlows {
    if (!activeEmpire.value || !planningDerivedMap.value) {
      return { flows: [], empireGroups: { operations: [], supply: [] } }
    }
    const map = planningDerivedMap.value
    const rawFlows = map.getEmpireFlows()

    const filtered = rawFlows.filter(flow => {
      if (flow.netRate <= 0) return true
      return flow.contributions.some(c => {
        const cache = map.getCache(c.id)
        return (cache?.warePriorityLevels[flow.wareId] ?? 0) > 0
      })
    })

    const result = classifyAndEnrichFlows(filtered, gameData.waresMap)

    const stationNameMap = new Map(activeEmpire.value.stations.map(s => [s.id, s.name]))
    const sectorNameMap = new Map(Object.entries(gameData.maps.sectors).map(([id, s]) => [id, s.name]))

    for (const flow of result.flows) {
      flow.contributions = flow.contributions.map(c => {
        const dc = c as { name?: string; stationName?: string }
        if (dc.name || dc.stationName) return c
        if (c.class === 'station') {
          return { ...c, name: stationNameMap.get(c.id) || c.id }
        }
        if (c.class === 'sector') {
          return { ...c, name: sectorNameMap.get(c.id) || c.id }
        }
        return { ...c, name: c.id }
      })
    }

    return result
  }

  const empireDerivedProductionFlows = computed(() => {
    void refreshKey.value
    const raw = planningDerivedMap.value?.getEmpireFlows() || []
    if (raw.length === 0) return []
    const deps = getDerivedStaticDeps()
    if (!deps) return []
    const stationNameMap: Record<string, string> = {}
    activeEmpire.value?.stations.forEach(s => { stationNameMap[s.id] = s.name })
    const sectorNameMap: Record<string, string> = {}
    sourceView.sectors.value.forEach(s => { sectorNameMap[s.id] = s.name })
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

  function getSavedStationGroupedFlows(station: StationPlan): GroupedFlows {
    const deps = getDerivedStaticDeps()
    if (!deps) {
      return {
        flows: [],
        rateGroups: { positive: [], operations: [], supply: [], resources: [] },
        volumeGroups: { solid: [], liquid: [], container: [] }
      }
    }

    const tempMap = new StationDerivedMap(deps)
    tempMap.upsertStation(station.id, {
      modulesMode: 'plan',
      sectorId: station.sectorId,
      modules: station.modules || [],
      settings: station.settings || {},
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {},
      count: station.count
    })
    return tempMap.getGrouped(station.id)
  }

  function initializeAllStationDerived() {
    if (!activeEmpire.value) return
    const map = resetPlanningDerivedMap()
    if (!map) return
    activeEmpire.value.stations.forEach(station => {
      map.upsertStation(station.id, {
        modulesMode: 'plan',
        sectorId: station.sectorId,
        modules: station.modules || [],
        settings: station.settings || {},
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {},
        count: station.count
      })
    })
  }

  function clearStationCaches() {
    planningDerivedMap.value?.clear()
  }

  function getStationComponentGapFlows(_stationId: string | null): StationComponentGapFlows {
    return {
      operations: [],
      supply: []
    }
  }

  function createStation(name: string, type: StationType = 'industrial', selectAfterCreate: boolean = true) {
    const station = empireDataStore.createStationInEmpire(activeEmpire.value, name, type)
    if (!station) return null
    if (selectAfterCreate) {
      activeStationId.value = station.id
    }
    syncPlanStationDerivedSnapshot(station.id)
    return station
  }

  function deleteStation(stationId: string) {
    const deleted = empireDataStore.deleteStationFromEmpire(activeEmpire.value, stationId)
    if (deleted) {
      planningDerivedMap.value?.remove(stationId)
      if (activeStationId.value === stationId) {
        activeStationId.value = activeEmpire.value?.stations[0]?.id || null
      }
      refreshKey.value++
    }
  }

  function duplicateStation(stationId: string) {
    const newStation = empireDataStore.duplicateStationInEmpire(activeEmpire.value, stationId)
    if (!newStation) return null
    activeStationId.value = newStation.id
    syncPlanStationDerivedSnapshot(newStation.id)
    return newStation
  }

  function renameStation(stationId: string, newName: string) {
    return empireDataStore.renameStationInEmpire(activeEmpire.value, stationId, newName)
  }

  function selectStation(stationId: string | null) {
    activeStationId.value = stationId
  }

function updateStationModules(stationId: string, modules: SavedModule[]) {
    if (empireDataStore.updateStationModulesInEmpire(activeEmpire.value, stationId, modules)) {
      planningDerivedMap.value!.updateModules(stationId, modules)
    }
  }

  function findStationByName(name: string): { id: string; modules: SavedModule[] } | null {
    const station = activeEmpire.value?.stations?.find(s => s.name === name)
    if (!station) return null
    return { id: station.id, modules: station.modules || [] }
  }

  function updateStationType(stationId: string, type: StationType) {
    empireDataStore.updateStationTypeInEmpire(activeEmpire.value, stationId, type)
    syncPlanStationDerivedSnapshot(stationId)
  }

  function updateStationCount(stationId: string, count: number) {
    empireDataStore.updateStationCountInEmpire(activeEmpire.value, stationId, count)
    syncPlanStationDerivedSnapshot(stationId)
  }

  function updateStationMinerals(stationId: string, minerals: string[]) {
    empireDataStore.updateStationMineralsInEmpire(activeEmpire.value, stationId, minerals)
    syncPlanStationDerivedSnapshot(stationId)
  }

  function setStationLocation(stationId: string, location: EntityLocation | null): boolean {
    return empireDataStore.setStationLocationInEmpire(activeEmpire.value, stationId, location)
  }

  function applyImportedStationPayload(
    stationId: string,
    payload: { modules: SavedModule[]; lockedWares: string[]; warePriority: Record<string, number> }
  ): boolean {
    const station = getStationById(stationId)
    if (!station) return false
    station.modules = payload.modules.map(m => ({ ...m }))
    station.lockedWares = [...payload.lockedWares]
    station.warePriority = { ...payload.warePriority }
    station.lastUpdated = Date.now()
    syncPlanStationDerivedSnapshot(stationId)
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

  function loadData(data: any) {
    const migrated = migrateEmpireStateToCurrent(data, getModuleLookup())
    migrated.warnings.forEach((warning) => console.warn('[BlueprintProductionStore][Migration]', warning))

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
        empire.stations.forEach(station => {
          if (station.count === null || station.count === undefined) {
            station.count = 1
          }
          station.settings = ({ ...DEFAULT_STATION_SETTINGS, ...station.settings })
        })
        activeEmpire.value = JSON.parse(JSON.stringify(empire))

        const storedTabId = activeViewStore.activeEmpireStation
        const isValid = storedTabId && empire.stations.some((station) => station.id === storedTabId)
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

  function createEmpire(name: string = '', stationName?: string): EmpirePlan {
    const empire = createDefaultEmpire(name)
    activeEmpire.value = empire
    savedEmpires.value.activeId = null
    const defaultStationName = stationName ?? i18n.global.t('sector.new_station_name')
    const station = createStation(defaultStationName, 'industrial', true)
    if (station) {
      initializeAllStationDerived()
    }
    takeSnapshot()
    return empire
  }

  function loadEmpire(empireId: string) {
    const empire = savedEmpires.value.list.find(e => e.id === empireId)
    if (empire) {
      clearStationCaches()
      activeEmpire.value = JSON.parse(JSON.stringify(empire))
      savedEmpires.value.activeId = empireId

      const storedTabId = activeViewStore.activeEmpireStation
      const isValid = storedTabId && empire.stations.some(s => s.id === storedTabId)

      if (activeViewStore.activeView === 'blueprint-production') {
        activeViewStore.switchToEmpire(empireId)
      } else {
        activeViewStore.activeEmpireId = empireId
      }

      if (!storedTabId) {
        activeStationId.value = null
      } else if (isValid) {
        activeStationId.value = storedTabId
      } else if (empire.stations.length > 0) {
        activeStationId.value = empire.stations[0]?.id || null
      } else {
        activeStationId.value = null
      }
      initializeAllStationDerived()
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
    if (isEmptyForSave()) return false
    const current = serializeEmpireForDirtyCheck()
    return current !== lastSavedSnapshot.value
  })

  function isEmptyForSave() {
    if (!activeEmpire.value) return true
    const hasStations = (activeEmpire.value.stations || []).length > 0
    return !hasStations
  }

  async function initialize() {
    console.log('[BlueprintProductionStore] Initializing...')
    isReady.value = false

    try {
      await gameData.initialize()

      const stored = empireDataStore.loadFromStorage()
      if (stored && Array.isArray(stored.list)) {
        loadData(stored)
        saveToStorage()
        initializeAllStationDerived()

        fallbackToFirstEmpire()

        isReady.value = true
        console.log('[BlueprintProductionStore] Loaded saved empires')
        return
      }

      createEmpire()
      if (activeViewStore.activeView === 'blueprint-production') {
        activeViewStore.activeEmpireId = activeEmpire.value?.id || null
      }
      isReady.value = true
      console.log('[BlueprintProductionStore] Initialized with new empire')

    } catch (e) {
      console.error('[BlueprintProductionStore] Initialization failed:', e)
    }
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

    console.log('[BlueprintProductionStore] No empires found, creating new empire')
    const empire = createEmpire()
    if (activeViewStore.activeView === 'blueprint-production') {
      activeViewStore.activeEmpireId = empire.id
    }
  }

  const wareflowViewMode = ref<WareFlowViewMode>('quantity')
  const expandedSectorId = computed<string | null>(() => null)
  const titleValue = computed(() => activeEmpire.value?.name || '')
  const titlePlaceholder = computed(() => i18n.global.t('sector.new_sector_name'))

  const capabilities: ProductionWorkbenchCapabilities = {
    uniqueWorkbench: false,
    uniqueStation: false,
    hasSectors: false
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
    workbenchMode: activeStation.value ? 'station' : 'overview',
    entityType: activeStation.value ? 'station' : 'overview',
    mode: 'planning',
    visualMode: 'planning',
    activeStationId: activeStationId.value,
    activeTransitSectorId: null,
    activeBinding: activeEmpire.value?.id || null,
    canToggle: false,
    wareflowViewMode: wareflowViewMode.value
  }))

  const context = computed<ProductionContextState>(() => {
    const sectorId = activeStation.value?.sectorId
    const sectorData = sectorId ? gameData.maps.sectors[sectorId] : null
    const sectorResources = sectorId ? gameData.mapResources.sectors[sectorId]?.resources || [] : []
    return {
      stationCode: '',
      sectorId: sectorId || null,
      sectorName: sectorData?.name || '',
      sectorNameId: sectorData?.nameId,
      position: undefined,
      sectorResources: sectorResources.map((resource) => resource.ware),
      sectorSunlight: Math.round((sectorData?.area?.sunlight ?? 1) * 100),
      hasBinding: !!activeStation.value,
      hasArchive: false
    }
  })

  const stationState = computed<ProductionStationState | null>(() => {
    const station = activeStation.value
    if (!station) return null
    const state = activeStationState.value
    return {
      entityType: 'station',
      id: station.id,
      name: station.name,
      stationType: station.type || 'industrial',
      count: station.count ?? 1,
      minerals: station.minerals || [],
      plannedModules: state.plannedModules,
      resolvedModules: state.resolvedModules,
      modules: state.resolvedModules,
      buildingModules: [],
      buildingCargo: [],
      buildingReservation: [],
      autoIndustryModules: state.autoIndustryModules,
      autoHabitationModules: state.autoHabitationModules,
      autoInfrastructureModules: state.autoInfrastructureModules,
      productionFlows: state.productionFlows,
      derivedProductionFlows: deriveProductionFlows({
        productionFlows: state.productionFlows,
        modulesMap: gameData.modulesMap,
        waresMap: gameData.waresMap,
        settings: settings.value,
        warePriorityLevels: state.warePriorityLevels
      }),
      warePriorityLevels: state.warePriorityLevels,
      settings: {
        ...settings.value,
        enforceDlcActivation: enforceDlcActivation.value
      },
      enforceDlcActivation: enforceDlcActivation.value,
      empireGaps: empireGapsComputed.value,
      currentEfficiency: currentEfficiency.value,
      actualWorkforce: actualWorkforce.value,
      buildPriceMultiplier: buildPriceMultiplier.value
    }
  })

  const settingActions = createProductionSettingActions<StationPlan>({
    getActiveStation: () => editableStationPlan.value,
    getComputeDeps,
    mergeSettings: (base, patch) => ({ ...DEFAULT_STATION_SETTINGS, ...{ ...base, ...patch } }),
    now: () => Date.now(),
    commitStationMutation: () => {},
    shouldRecompute: (_station, patch) => doesStationSettingsAffectFlowMap(patch),
    recompute: (station, _deps) => {
      syncPlanStationSettingsFlow(station.id)
    }
  })

  function createStationFromUi(name?: string, type?: StationType) {
    const station = createStation(name || i18n.global.t('sector.new_station_name'), type || 'industrial')
    return station?.id || null
  }

  function duplicateStationFromUi(stationId: string) {
    const station = duplicateStation(stationId)
    return station?.id || null
  }

  function updateTitle(value: string) {
    updateEmpireName(value)
  }

  function updateStationNameFromActive(value: string) {
    if (editableStationPlan.value) renameStation(editableStationPlan.value.id, value)
  }

  function updateStationTypeFromActive(value: StationType) {
    if (editableStationPlan.value) updateStationType(editableStationPlan.value.id, value)
  }

  function updateStationCountFromActive(value: number) {
    if (editableStationPlan.value) updateStationCount(editableStationPlan.value.id, value)
  }

  function toggleMineralFromActive(mineral: string) {
    if (!editableStationPlan.value) return
    const current = editableStationPlan.value.minerals || []
    const newMinerals = current.includes(mineral)
      ? current.filter((m: string) => m !== mineral)
      : [...current, mineral]
    updateStationMinerals(editableStationPlan.value.id, newMinerals)
  }

  return {
    isReady,
    isDirty,
    isEmptyForSave,
    activeEmpire,
    activeStation,
    editableStationPlan,
    activeStationId,
    orderedStations,
    tabSemanticsById,
    expandedSectorId,
    titleValue,
    titlePlaceholder,
    savedEmpires,
    getEmpireGroupedFlows,
    getSavedStationGroupedFlows,
    initializeAllStationDerived,
    clearStationCaches,
    loadData,
    saveToStorage,
    saveEmpire,
    saveEmpireAs,
    requiresSaveAsOnSave,
    loadEmpire,
    deleteEmpire,
    createEmpire,
    createStation: createStationFromUi,
    deleteStation,
    duplicateStation: duplicateStationFromUi,
    renameStation,
    selectStation,
    selectTransitSector: (_sectorId: string | null) => {},
    setExpandedSector: (_sectorId: string | null) => {},
    getStationById,
    findStationByName,
    updateStationModules,
    updateStationType: updateStationTypeFromActive,
    updateStationCount: updateStationCountFromActive,
    updateStationMinerals,
    setStationLocation,
    applyImportedStationPayload,
    updateEmpireName,
    takeSnapshot,
    initialize,
    getStationComponentGapFlows,

    session,
    context,
    stationState,
    capabilities,
    settingActions,
    wareRuleActions,
    moduleActions,
    updateTitle,
    updateStationName: updateStationNameFromActive,
    updateWareflowViewMode: (value: WareFlowViewMode) => { wareflowViewMode.value = value },
    updateBuildPriceMultiplier: (value: number) => { buildPriceMultiplier.value = value },
    toggleMineral: toggleMineralFromActive,

    planningDerivedMap,
    empireDerivedProductionFlows,
    overviewBuyMultiplier,
    overviewSellMultiplier,
    empireModules,
    empireCurrentNetProduction,
  }
})
