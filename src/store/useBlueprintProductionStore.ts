import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  EmpirePlan,
  StationPlan,
  StationType,
  SavedModule,
  GroupedFlows,
  StationSettings,
  X4Module
} from '@/types/x4'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import type { ProductionSessionContext } from '@/types/production-context'
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
    selectedArchive: ref(null)
  })

  const orderedStations = sourceView.orderedStationsBySector

  const activeStation = computed(() => computeActiveStation(
    productionSource.value,
    [],
    activeEmpire.value,
    activeStationId.value
  ))

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
      activeViewStore.switchToEmpire(empireId)
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
      activeViewStore.setProductionSource('empire')
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
    createEmpire()
    activeViewStore.setProductionSource('empire')
  }

  return {
    isReady,
    isDirty,
    isEmptyForSave,
    session,
    activeEmpire,
    activeStation,
    activeStationId,
    orderedStations,
    savedEmpires,
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