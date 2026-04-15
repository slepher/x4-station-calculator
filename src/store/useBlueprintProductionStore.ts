import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  EmpirePlan,
  StationPlan,
  StationType,
  SavedModule,
  GroupedFlows,
  StationSettings,
  X4Module,
  EntityLocation
} from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import type { ProductionSessionContext } from '@/types/production-context'
import { stationProductionFlowMap } from './state/StationProductionFlowMap'
import type {
  ProductionWorkbenchStoreContract,
  ProductionWorkbenchCapabilities,
  ProductionAddModuleOptions,
  ProductionRemoveModuleTarget,
  ImportPayload
} from '@/types/production-workbench-contract'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import i18n from '@/i18n'
import { useGameDataStore } from './useGameDataStore'
import { useEmpireDataStore } from './useEmpireDataStore'
import { useActiveViewStore } from './useActiveViewStore'
import { migrateEmpireStateToCurrent } from './logic/stateMigrations'
import { stationStateMap, migrateStationSettings, DEFAULT_STATION_SETTINGS } from './state/StationStateMap'
import {
  buildStationComputeDeps,
  syncPersistedToStateMap,
  recomputeStation,
  getGroupedFlows,
  getFilteredGroupedFlows,
  clearStationState,
  getStationState,
  ensureStationState,
  patchStationState,
  getSettings,
  getPlannedModules,
  getLockedWares,
  getWarePriority,
  getActualWorkforce,
  getCurrentEfficiency,
  deepClone,
  getProductionFlows,
  getAutoInfrastructureModules,
  getWarePriorityLevels,
  getDerivedStationData,
  updateProductionFlowAggregationAfterRecompute,
  getActiveStationState,
  type ActiveStationState
} from './logic/stationComputeService'
import { analyzeStation } from './logic/analyzeStation'
import {
  createEmpireSourceView,
  computeActiveStation
} from './logic/empireSourceView'

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

  const activeEmpire = ref<EmpirePlan | null>(null)

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

  const activeStationState = computed<ActiveStationState>(() => 
    getActiveStationState(activeStationId.value)
  )

  function getStationById(stationId: string): StationPlan | null {
    return sourceView.getStationById(stationId)
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
    console.log('[BlueprintStore] writeAndRecomputeActive', { stationId, hasStation: !!station, stationName: station?.name })
    if (!station) {
      ensureActiveStationState()
    } else {
      syncPersistedActiveStationToStateMap()
    }
    writer(stationId)
    recomputeActiveStation()
    syncStateMapBackToPersistedActiveStation(false)
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

  const autoInfrastructureModules = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    const deps = getComputeDeps()
    if (!deps) return []
    return getAutoInfrastructureModules(stationId, deps.modulesMap)
  })

  const autoIndustryModules = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    const resolved = stationProductionFlowMap.getResolvedModules(stationId)
    const plannedIds = plannedModules.value.map(m => m.id)
    return resolved.filter(m => !plannedIds.includes(m.id))
  })

  const actualWorkforce = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    return getActualWorkforce(stationId)
  })

  const currentEfficiency = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    return getCurrentEfficiency(stationId)
  })

  const productionFlows = computed<WareProductionFlow[]>(() => {
    const stationId = activeStation.value?.id || '__local__'
    return getProductionFlows(stationId)
  })

  const warePriorityLevels = computed<Record<string, number>>(() => {
    const stationId = activeStation.value?.id || '__local__'
    return getWarePriorityLevels(stationId)
  })

  const groupedFlows = computed(() => {
    const stationId = activeStation.value?.id || '__local__'
    const deps = getComputeDeps()
    if (!deps) return getGroupedFlows(stationId)
    return getDerivedStationData(stationId, deps.waresMap, {
      racePreference: settings.value.racePreference,
      resourceBufferHours: settings.value.resourceBufferHours,
      primaryProductBufferHours: settings.value.primaryProductBufferHours,
      secondaryProductBufferHours: settings.value.secondaryProductBufferHours,
      buyMultiplier: settings.value.buyMultiplier,
      sellMultiplier: settings.value.sellMultiplier,
      transportMinutes: settings.value.transportMinutes,
      transportShipCapacity: settings.value.transportShipCapacity,
      sunlight: settings.value.sunlight
    }).groupedFlows
  })

  const stationAnalysis = computed(() => {
    const planned = plannedModules.value
    const auto = autoIndustryModules.value
    const allModules = [...planned, ...auto]
    if (allModules.length === 0) {
      return {
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
    }
    return analyzeStation(
      allModules,
      gameData.modulesMap,
      gameData.waresMap,
      buildPriceMultiplier.value,
      settings.value.useHQ
    )
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
    console.log('[BlueprintStore] toggleWareLock called', { wareId, operable: isWareOperable(wareId) })
    if (!isWareOperable(wareId)) {
      console.log('[BlueprintStore] toggleWareLock skipped - not operable')
      return
    }
    writeAndRecomputeActive((stationId) => {
      const current = getLockedWares(stationId)
      console.log('[BlueprintStore] toggleWareLock writing', { stationId, wareId, current, willLock: !current.includes(wareId) })
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
    console.log('[BlueprintStore] toggleWarePriority called', { wareId, currentLevel, planned, auto })

    writeAndRecomputeActive((stationId) => {
      const nextPriority = deepClone(getWarePriority(stationId))
      console.log('[BlueprintStore] toggleWarePriority writing', { stationId, wareId, currentPriority: nextPriority[wareId] })

      if (planned) {
        if (currentLevel === 2) nextPriority[wareId] = 1
        else delete nextPriority[wareId]
      } else if (auto) {
        if (currentLevel === 0) nextPriority[wareId] = 1
        else delete nextPriority[wareId]
      }

      console.log('[BlueprintStore] toggleWarePriority result', { nextPriority })
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
    const state = stationStateMap.get(stationId)
    if (!state) return null
    return getFilteredGroupedFlows(stationId)
  }

  function initializeAllStationCaches() {
    if (!activeEmpire.value) return
    activeEmpire.value.stations.forEach(station => {
      refreshStationFlowCache(station.id)
    })
    updateProductionFlowAggregationAfterRecompute(activeEmpire.value)
  }

  function clearStationCaches() {
    stationStateMap.list().forEach(state => {
      clearStationState(state.stationId)
    })
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
    refreshStationFlowCache(station.id)
    return station
  }

  function deleteStation(stationId: string) {
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

  function renameStation(stationId: string, newName: string) {
    return empireDataStore.renameStationInEmpire(activeEmpire.value, stationId, newName)
  }

  function selectStation(stationId: string | null) {
    activeStationId.value = stationId
  }

  function updateStationSettings(stationId: string, settings: Partial<StationSettings>) {
    if (empireDataStore.updateStationSettingsInEmpire(activeEmpire.value, stationId, settings)) {
      refreshStationFlowCache(stationId)
    }
  }

  function updateStationModules(stationId: string, modules: SavedModule[]) {
    if (empireDataStore.updateStationModulesInEmpire(activeEmpire.value, stationId, modules)) {
      refreshStationFlowCache(stationId)
    }
  }

  function updateStationType(stationId: string, type: StationType) {
    empireDataStore.updateStationTypeInEmpire(activeEmpire.value, stationId, type)
    refreshStationFlowCache(stationId)
  }

  function updateStationCount(stationId: string, count: number) {
    empireDataStore.updateStationCountInEmpire(activeEmpire.value, stationId, count)
    refreshStationFlowCache(stationId)
  }

  function updateStationMinerals(stationId: string, minerals: string[]) {
    empireDataStore.updateStationMineralsInEmpire(activeEmpire.value, stationId, minerals)
    refreshStationFlowCache(stationId)
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
          station.settings = migrateStationSettings(station.settings)
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
      initializeAllStationCaches()
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
      
      if (isValid) {
        activeStationId.value = storedTabId
      } else if (empire.stations.length > 0) {
        activeStationId.value = empire.stations[0]?.id || null
      } else {
        activeStationId.value = null
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
    if (isEmptyForSave()) return false
    const current = serializeEmpireForDirtyCheck()
    return current !== lastSavedSnapshot.value
  })

  function isEmptyForSave() {
    if (!activeEmpire.value) return true
    const hasStations = (activeEmpire.value.stations || []).length > 0
    return !hasStations
  }

  const session: ProductionSessionContext = {
    isDirty: computed(() => isDirty.value).value,
    save: saveEmpire,
    discard: () => {
      const empireId = savedEmpires.value.activeId
      if (empireId) {
        loadEmpire(empireId)
      } else {
        createEmpire()
      }
    },
    canSave: computed(() => !isEmptyForSave()).value,
    canDiscard: computed(() => isDirty.value).value
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
        initializeAllStationCaches()

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

  const importModalOpen = ref(false)
  const wareflowViewMode = ref<WareFlowViewMode>('quantity')

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
        .filter((flow: any) => flow.netRate < 0 || getResolvedLevel(flow.wareId) > 0)
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

  const workbench: ProductionWorkbenchStoreContract = {
    mode: 'blueprint',
    capabilities,

    getTabs: () => orderedStations.value.map(s => ({
      id: s.id,
      type: 'station' as const,
      name: s.name,
      sectorId: s.sectorId ?? undefined,
      stationType: s.type
    })),
    getActiveTabId: () => activeStationId.value,
    getExpandedSectorId: () => null,
    getWorkbenchMode: () => activeStation.value ? 'station' : 'overview',
    getActiveStationId: () => activeStationId.value,
    getActiveTransitSectorId: () => null,

    getTitleModel: () => ({
      value: activeEmpire.value?.name || '',
      placeholder: i18n.global.t('sector.new_sector_name')
    }),
    getToolbarStation: () => activeStation.value ? {
      id: activeStation.value.id,
      name: activeStation.value.name,
      type: activeStation.value.type || 'industrial',
      count: activeStation.value.count ?? 1,
      minerals: activeStation.value.minerals || []
    } : null,
    getToolbarSettings: () => activeStation.value ? settings.value : null,
    getToolbarRaces: () => [
      { value: 'argon', label: i18n.global.t('toolbar.races.argon') },
      { value: 'terran', label: i18n.global.t('toolbar.races.terran') },
      { value: 'teladi', label: i18n.global.t('toolbar.races.teladi') },
      { value: 'paranid', label: i18n.global.t('toolbar.races.paranid') },
      { value: 'split', label: i18n.global.t('toolbar.races.split') }
    ],
    getToolbarStationTypes: () => [
      { value: 'industrial' as StationType, label: i18n.global.t('toolbar.station_types.industrial') },
      { value: 'supply' as StationType, label: i18n.global.t('toolbar.station_types.supply') },
      { value: 'transit' as StationType, label: i18n.global.t('toolbar.station_types.transit') },
      { value: 'shipyard' as StationType, label: i18n.global.t('toolbar.station_types.shipyard') }
    ],
    getAvailableMinerals: () => ['Ore', 'Silicon', 'Ice', 'Hydrogen', 'Helium', 'Methane'],
    getSingleBerthThroughput: () => Math.max(1, settings.value.transportShipCapacity || 1) * 15,

    getPlannedModules: () => plannedModules.value,
    getAutoModules: () => autoIndustryModules.value,
    getEnforceDlcActivation: () => enforceDlcActivation.value,

    getWareflowViewMode: () => wareflowViewMode.value,
    getProductionFlows: () => productionFlows.value,
    getWarePriorityLevels: () => warePriorityLevels.value,
    getWareflowSettings: () => ({
      resourceBufferHours: settings.value.resourceBufferHours,
      primaryProductBufferHours: settings.value.primaryProductBufferHours,
      secondaryProductBufferHours: settings.value.secondaryProductBufferHours,
      buyMultiplier: settings.value.buyMultiplier,
      sellMultiplier: settings.value.sellMultiplier,
      racePreference: settings.value.racePreference,
      showEmpireGaps: settings.value.showEmpireGaps ?? false,
      transportMinutes: settings.value.transportMinutes
    }),
    getEmpireGaps: () => empireGapsComputed.value,

    getStationAnalysis: () => stationAnalysis.value,
    getDashboardSettings: () => ({
      transportShipCapacity: settings.value.transportShipCapacity,
      workforceAuto: settings.value.workforceAuto,
      manualWorkforce: settings.value.manualWorkforce,
      useHQ: settings.value.useHQ
    }),
    getCurrentEfficiency: () => currentEfficiency.value,
    getActualWorkforce: () => actualWorkforce.value,
    getBuildPriceMultiplier: () => buildPriceMultiplier.value,

    isOverview: () => !activeStation.value,
    getProductionSource: () => 'empire',
    getImportActiveStationId: () => activeStationId.value,
    getImportActiveStation: () => activeStation.value ? { id: activeStation.value.id, modules: activeStation.value.modules } : null,

    selectOverview: () => selectStation(null),
    selectTransit: () => {},
    selectStation: (stationId: string) => selectStation(stationId),
    expandSector: () => {},

    createStation: (name?: string, type?: StationType) => {
      const station = createStation(name || i18n.global.t('sector.new_station_name'), type || 'industrial')
      return station?.id || null
    },
    renameStation: (stationId: string, name: string) => renameStation(stationId, name),
    duplicateStation: (stationId: string) => {
      const station = duplicateStation(stationId)
      return station?.id || null
    },
    deleteStation: (stationId: string) => deleteStation(stationId),

    updateTitle: (value: string) => updateEmpireName(value),
    updateStationName: (value: string) => {
      if (activeStation.value) renameStation(activeStation.value.id, value)
    },
    updateStationType: (value: StationType) => {
      if (activeStation.value) updateStationType(activeStation.value.id, value)
    },
    updateStationCount: (value: number) => {
      if (activeStation.value) updateStationCount(activeStation.value.id, value)
    },
    toggleMineral: (mineral: string) => {
      if (!activeStation.value) return
      const current = activeStation.value.minerals || []
      const newMinerals = current.includes(mineral)
        ? current.filter((m: string) => m !== mineral)
        : [...current, mineral]
      updateStationMinerals(activeStation.value.id, newMinerals)
    },
    updateSunlight: (value: number) => updateStationSettingsDirect('sunlight', value),
    updateTransportMinutes: (value: number) => updateStationSettingsDirect('transportMinutes', value),
    updateRacePreference: (value: string) => updateStationSettingsDirect('racePreference', value),
    updateWorkforce: (value: boolean) => updateStationSettingsDirect('considerWorkforceForAutoFill', value),
    updateShowEmpireGaps: (value: boolean) => updateStationSettingsDirect('showEmpireGaps', value),

    updatePlannedModules: (modules: SavedModule[]) => updatePlannedModules(modules),
    addModule: (moduleId: string, options?: ProductionAddModuleOptions) => {
      if (options?.source === 'gap' && options.wareId) {
        const module = gameData.findModuleForWare(options.wareId, settings.value.racePreference)
        if (module) addModule(module.id, 1)
      } else {
        addModule(moduleId, 1)
      }
    },
    removeModule: (target: ProductionRemoveModuleTarget) => {
      if ('moduleId' in target && target.source === 'gap') {
        const module = gameData.findModuleForWare(target.wareId || '', settings.value.racePreference)
        if (!module) return
        const plannedIndex = plannedModules.value.findIndex(m => m.id === module.id)
        if (plannedIndex === -1) return
        const current = plannedModules.value[plannedIndex]?.count ?? 0
        if (current <= 1) removeModule(plannedIndex)
        else updateModuleCount(plannedIndex, current - 1)
      } else {
        removeModule(target.index)
      }
    },
    updateModuleCount: (index: number, count: number) => updateModuleCount(index, count),

    updateWareflowViewMode: (value: WareFlowViewMode) => { wareflowViewMode.value = value },
    updateResourceBufferHours: (value: number) => updateStationSettingsDirect('resourceBufferHours', value),
    updatePrimaryProductBufferHours: (value: number) => updateStationSettingsDirect('primaryProductBufferHours', value),
    updateSecondaryProductBufferHours: (value: number) => updateStationSettingsDirect('secondaryProductBufferHours', value),
    updateBuyMultiplier: (value: number) => updateStationSettingsDirect('buyMultiplier', value),
    updateSellMultiplier: (value: number) => updateStationSettingsDirect('sellMultiplier', value),
    toggleWareLock: (wareId: string) => toggleWareLock(wareId),
    toggleWarePriority: (wareId: string) => toggleWarePriority(wareId),

    updateTransportShipCapacity: (value: number) => updateStationSettingsDirect('transportShipCapacity', value),
    updateBuildPriceMultiplier: (value: number) => { buildPriceMultiplier.value = value },
    updateManualWorkforce: (value: number) => updateStationSettingsDirect('manualWorkforce', value),
    updateWorkforceAuto: (value: boolean) => updateStationSettingsDirect('workforceAuto', value),
    updateUseHQ: (value: boolean) => updateStationSettingsDirect('useHQ', value),

    openImport: () => { importModalOpen.value = true },
    applyImportedStationPayload: (stationId: string, payload: ImportPayload) => {
      applyImportedStationPayload(stationId, payload)
    },
    updateStationModules: (stationId: string, modules: SavedModule[]) => updateStationModules(stationId, modules),
    getStationById: (stationId: string) => {
      const station = getStationById(stationId)
      return station ? { id: station.id, modules: station.modules } : null
    },

    isWareLocked: (wareId: string) => isWareLocked(wareId),
    getResolvedLevel: (wareId: string) => getResolvedLevel(wareId),
    isWareOperable: (wareId: string) => isWareOperable(wareId),
    isPlannedWare: (wareId: string) => isPlannedWare(wareId)
  }

  return {
    isReady,
    isDirty,
    isEmptyForSave,
    session,
    activeEmpire,
    activeStation,
    activeStationState,
    activeStationId,
    orderedStations,
    savedEmpires,
    workbench,
    importModalOpen,
    getStationFlowCache,
    refreshStationFlowCache,
    initializeAllStationCaches,
    clearStationCaches,
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
    renameStation,
    selectStation,
    getStationById,
    updateStationSettings,
    updateStationModules,
    updateStationType,
    updateStationCount,
    updateStationMinerals,
    setStationLocation,
    applyImportedStationPayload,
    updateEmpireName,
    takeSnapshot,
    initialize,
    getStationComponentGapFlows,
    buildPriceMultiplier,
    plannedModules,
    settings,
    lockedWares,
    warePriority,
    autoIndustryModules,
    autoInfrastructureModules,
    actualWorkforce,
    currentEfficiency,
    productionFlows,
    warePriorityLevels,
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
