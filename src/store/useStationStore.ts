import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  X4Module,
  SavedModule,
  StationSettings,
  StationPlan,
  ModuleGroupResult,
} from '../types/x4'
import { useGameDataStore } from './useGameDataStore'
import { useEmpireStore } from './useEmpireStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useShipBuildStore, type StationActiveView } from './useShipBuildStore'
import {
  createBindingPlanStationId,
  parseBindingStationId
} from './logic/productionSourceAdapter'
import { generateFilteredModulesGrouped } from './logic/searchModule'
import { migrateStationSettings, DEFAULT_STATION_SETTINGS } from './state/StationStateMap'
import { createStationCommands, type StationCommandContext } from './logic/stationCommands'
import {
  buildStationComputeDeps,
  syncPersistedToStateMap,
  recomputeStation,
  getStationState,
  ensureStationState,
  patchStationState,
  getGroupedFlows,
  getSettings,
  deepClone
} from './logic/stationComputeService'
import { parseImportInput, type ImportDeps } from './logic/stationImporter'

export type { SavedModule, StationPlan } from '../types/x4'

export interface SavedPlansState {
  version: number;
  activeId: string | null;
  list: StationPlan[];
}

export const useStationStore = defineStore('station', () => {
  const gameData = useGameDataStore()
  const empireStore = useEmpireStore()
  const saveBindingStore = useSaveBindingStore()
  const shipBuildStore = useShipBuildStore()

  const activeView = computed<StationActiveView>({
    get: () => shipBuildStore.activeView,
    set: (value) => {
      shipBuildStore.activeView = value
    }
  })
  const isReady = computed(() => empireStore.isReady && gameData.isReady)
  const savedPlans = ref<SavedPlansState>({ version: 1, activeId: null, list: [] })
  const buildPriceMultiplier = ref(0.5)

  const currentPlanName = computed({
    get: () => empireStore.activeStation?.name || '',
    set: (name: string) => {
      if (empireStore.activeStation) {
        empireStore.activeStation.name = name
      }
    }
  })

  const {
    waresMap,
    modulesMap,
    localizedModulesMap,
    localizedModuleGroupsMap,
    medicalConsumptionMap,
    searchQuery,
    activeDlcs,
    enforceDlcActivation
  } = storeToRefs(gameData)

  const { currentLocale } = storeToRefs(gameData)

  function getComputeDeps() {
    if (!gameData.isReady) return null
    if (!modulesMap.value || !waresMap.value || !medicalConsumptionMap.value) return null
    return buildStationComputeDeps({
      modulesMap: modulesMap.value,
      waresMap: waresMap.value,
      medicalConsumptionMap: medicalConsumptionMap.value,
      buildPriceMultiplier: buildPriceMultiplier.value,
      enforceDlcActivation: enforceDlcActivation.value,
      isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(modulesMap.value[moduleId]?.dlc_tag)
    })
  }

  function getActiveContext() {
    const station = empireStore.activeStation
    if (!station) {
      let state = getStationState('__local__')
      if (!state) {
        state = ensureStationState('__local__', {
          settings: { ...DEFAULT_STATION_SETTINGS }
        })
      }
      return { station: null as StationPlan | null, state }
    }

    let state = getStationState(station.id)
    if (!state) {
      station.settings = migrateStationSettings(station.settings)
      syncPersistedToStateMap(station.id, station)
      const deps = getComputeDeps()
      if (deps) recomputeStation(station.id, deps)
    }

    return { station: station as StationPlan | null, state }
  }

  function syncStateFromActiveStation() {
    const station = empireStore.activeStation
    if (!station) return

    station.settings = migrateStationSettings(station.settings)
    syncPersistedToStateMap(station.id, station)
    const deps = getComputeDeps()
    if (deps) recomputeStation(station.id, deps)
  }

  function syncActiveStationFromState(updateTimestamp: boolean) {
    const ctx = getActiveContext()
    if (!ctx) return
    if (!ctx.station) return
    const stationId = ctx.station.id
    const state = getStationState(stationId)
    if (!state) return

    const { plannedModules, lockedWares, warePriority, settings } = state
    ctx.station.modules = deepClone(plannedModules)
    ctx.station.lockedWares = deepClone(lockedWares || [])
    ctx.station.warePriority = deepClone(warePriority || {})
    ctx.station.settings = migrateStationSettings(settings)
    if (updateTimestamp) {
      ctx.station.lastUpdated = Date.now()
    }
  }

  function syncBindingStationPlanFromState(stationId: string) {
    if (empireStore.productionSource !== 'save-binding') return
    const binding = saveBindingStore.activeBinding
    const parsed = parseBindingStationId(stationId)
    if (!binding || !parsed || parsed.gameGuid !== binding.gameGuid) return

    const state = getStationState(stationId)
    const station = empireStore.activeStation
    if (!state || !station) return

    const { plannedModules, settings } = state
    const patch = {
      modules: deepClone(plannedModules),
      settings: migrateStationSettings(settings)
    }

    if (parsed.kind === 'plan') {
      saveBindingStore.updateStationPlan(binding.gameGuid, parsed.planId, patch)
      return
    }

    const plan = saveBindingStore.upsertStationPlan({
      gameGuid: binding.gameGuid,
      saveStationCode: parsed.saveStationCode,
      groupId: station.sectorId || null,
      name: station.name || parsed.saveStationCode,
      type: station.type || 'industrial',
      modules: patch.modules,
      settings: patch.settings
    })
    if (plan) {
      empireStore.selectStation(createBindingPlanStationId(binding.gameGuid, plan.id))
    }
  }

  const commandContext: StationCommandContext = {
    productionSource: empireStore.productionSource,
    getStationById: (stationId: string) => empireStore.getStationById(stationId),
    updateEmpireStationModules: (stationId: string, modules: SavedModule[]) => {
      empireStore.updateStationModules(stationId, modules)
      return true
    },
    updateEmpireStationSettings: (stationId: string, settings: Partial<StationSettings>) => {
      empireStore.updateStationSettings(stationId, settings)
      return true
    },
    updateBindingStationPlan: (stationId: string, patch: Partial<Pick<StationPlan, 'modules' | 'settings' | 'lockedWares' | 'warePriority'>>) => {
      const binding = saveBindingStore.activeBinding
      const parsed = parseBindingStationId(stationId)
      if (!binding || !parsed || parsed.gameGuid !== binding.gameGuid) return false
      
      if (parsed.kind === 'plan') {
        return saveBindingStore.updateStationPlan(binding.gameGuid, parsed.planId, {
          modules: patch.modules,
          settings: patch.settings,
          lockedWares: patch.lockedWares,
          warePriority: patch.warePriority
        })
      }
      return false
    },
    getComputeDeps: () => getComputeDeps(),
    getWaresMap: () => waresMap.value
  }

  const commands = createStationCommands(commandContext)

  function getActiveStationId(): string {
    const ctx = getActiveContext()
    return ctx?.station?.id || '__local__'
  }

  function applyAndRecompute(writer: (stationId: string) => void) {
    const ctx = getActiveContext()
    if (!ctx) return
    const stationId = ctx.station?.id || '__local__'
    writer(stationId)
    const deps = getComputeDeps()
    if (deps) recomputeStation(stationId, deps)
    syncActiveStationFromState(false)
    syncBindingStationPlanFromState(stationId)
  }

  function updateSetting<K extends keyof StationSettings>(key: K, value: StationSettings[K]) {
    applyAndRecompute((stationId) => {
      const current = getSettings(stationId)
      patchStationState(stationId, {
        settings: {
          ...current,
          [key]: value
        }
      })
    })
  }

  const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
    return generateFilteredModulesGrouped(
      searchQuery.value,
      currentLocale.value,
      localizedModulesMap.value,
      localizedModuleGroupsMap.value,
      (module) => !enforceDlcActivation.value || gameData.isDlcActive(module.dlc_tag)
    )
  })

  function isModuleDlcActive(moduleId: string): boolean {
    return gameData.isDlcActive(modulesMap.value[moduleId]?.dlc_tag)
  }

  function isModuleCountEditable(moduleId: string): boolean {
    return !enforceDlcActivation.value || isModuleDlcActive(moduleId)
  }

  watch(savedPlans, (val) => {
    localStorage.setItem('x4_station_data', JSON.stringify(val))
  }, { deep: true })

  watch(
    () => ({
      stationId: empireStore.activeStation?.id,
      gameReady: gameData.isReady,
      buildPrice: buildPriceMultiplier.value,
      enforceDlcActivation: enforceDlcActivation.value,
      activeDlcsKey: activeDlcs.value.join('|')
    }),
    () => {
      syncStateFromActiveStation()
    },
    { immediate: true }
  )

  const plannedModules = computed<SavedModule[]>({
    get: () => {
      const ctx = getActiveContext()
      return ctx?.state?.plannedModules || []
    },
    set: (value) => {
      applyAndRecompute((stationId) => {
        patchStationState(stationId, { plannedModules: deepClone(value) })
      })
    }
  })

  const lockedWares = computed<string[]>({
    get: () => {
      const ctx = getActiveContext()
      return ctx?.state?.lockedWares || []
    },
    set: (value) => {
      applyAndRecompute((stationId) => {
        patchStationState(stationId, { lockedWares: deepClone(value) })
      })
    }
  })

  const warePriority = computed<Record<string, number>>({
    get: () => {
      const ctx = getActiveContext()
      return ctx?.state?.warePriority || {}
    },
    set: (value) => {
      applyAndRecompute((stationId) => {
        patchStationState(stationId, { warePriority: deepClone(value) })
      })
    }
  })

  const settings = computed<StationSettings>({
    get: () => {
      const ctx = getActiveContext()
      return ctx?.state?.settings || { ...DEFAULT_STATION_SETTINGS }
    },
    set: (value) => {
      applyAndRecompute((stationId) => {
        patchStationState(stationId, { settings: migrateStationSettings(value) })
      })
    }
  })

  const autoIndustryModules = computed(() => {
    const ctx = getActiveContext()
    return ctx?.state?.autoIndustryModules || []
  })
  const actualWorkforce = computed(() => {
    const ctx = getActiveContext()
    return ctx?.state?.actualWorkforce || 0
  })
  const currentEfficiency = computed(() => {
    const ctx = getActiveContext()
    return ctx?.state?.currentEfficiency || 0
  })
  const groupedFlows = computed(() => {
    const ctx = getActiveContext()
    if (!ctx) return getGroupedFlows('__local__')
    return getGroupedFlows(ctx.station?.id || '__local__')
  })
  const stationAnalysis = computed(() => {
    const ctx = getActiveContext()
    return ctx?.state?.stationAnalysis || {
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

  function applyPlan(plan: StationPlan) {
    applyAndRecompute((stationId) => {
      patchStationState(stationId, {
        plannedModules: deepClone(plan.modules),
        lockedWares: deepClone(plan.lockedWares || []),
        warePriority: deepClone(plan.warePriority || {}),
        settings: migrateStationSettings(plan.settings)
      })
    })
    savedPlans.value.activeId = plan.id
  }

  function loadData(source: SavedPlansState) {
    savedPlans.value = deepClone(source)
    if (savedPlans.value.activeId) {
      const target = savedPlans.value.list.find(l => l.id === savedPlans.value.activeId)
      if (target) applyPlan(target)
    }
  }

  function saveCurrentPlan(name?: string) {
    const ctx = getActiveContext()
    if (!ctx) return

    const stationId = ctx.station?.id || '__local__'
    const state = getStationState(stationId)
    if (!state) return

    const { plannedModules, lockedWares, settings, warePriority } = state
    const finalName = name || currentPlanName.value
    const planData: StationPlan = {
      id: savedPlans.value.activeId || crypto.randomUUID(),
      name: finalName,
      modules: deepClone(plannedModules),
      lockedWares: deepClone(lockedWares || []),
      settings: deepClone(settings),
      warePriority: deepClone(warePriority || {}),
      lastUpdated: Date.now()
    }

    const stored = localStorage.getItem('x4_station_data')
    if (stored) {
      try {
        const remote = JSON.parse(stored)
        savedPlans.value.list = remote.list || []
      } catch (e) {}
    }

    const idx = savedPlans.value.list.findIndex(l => l.id === planData.id)
    if (idx !== -1) savedPlans.value.list[idx] = planData
    else savedPlans.value.list.push(planData)

    savedPlans.value.activeId = planData.id
  }

  const isDirty = computed(() => empireStore.isDirty)

  function loadPlan(index: number) {
    const plan = savedPlans.value.list[index]
    if (plan) applyPlan(plan)
  }

  function mergePlan(index: number) {
    const plan = savedPlans.value.list[index]
    if (!plan) return
    plan.modules.forEach(m => addModule(m.id, m.count))
  }

  function deletePlan(index: number) {
    if (savedPlans.value.list[index]?.id === savedPlans.value.activeId) {
      savedPlans.value.activeId = null
    }
    savedPlans.value.list.splice(index, 1)
  }

  function addModule(id: string = '', count = 1) {
    if (id !== '' && !modulesMap.value[id]) return
    const stationId = getActiveStationId()
    commands.addModule(stationId, id, count)
    syncActiveStationFromState(false)
    syncBindingStationPlanFromState(stationId)
  }

  function updateModuleId(index: number, newId: string) {
    if (!modulesMap.value[newId]) return
    const stationId = getActiveStationId()
    commands.updateModuleId(stationId, index, newId)
    syncActiveStationFromState(false)
    syncBindingStationPlanFromState(stationId)
  }

  function updateModuleCount(index: number, count: number) {
    const stationId = getActiveStationId()
    const module = plannedModules.value[index]
    if (!module || !isModuleCountEditable(module.id)) return
    commands.updateModuleCount(stationId, index, count)
    syncActiveStationFromState(false)
    syncBindingStationPlanFromState(stationId)
  }

  function removeModule(index: number) {
    const stationId = getActiveStationId()
    commands.removeModule(stationId, index)
    syncActiveStationFromState(false)
    syncBindingStationPlanFromState(stationId)
  }

  function removeModuleById(id: string) {
    const index = plannedModules.value.findIndex(m => m.id === id)
    if (index !== -1) removeModule(index)
  }

  function transferModuleFromAutoIndustry(module: SavedModule) {
    const inIndustry = autoIndustryModules.value.some(m => m.id === module.id)
    if (!inIndustry) return
    addModule(module.id, module.count)
  }

  function clearAll() {
    const stationId = getActiveStationId()
    commands.clearAll(stationId)
    syncActiveStationFromState(false)
    syncBindingStationPlanFromState(stationId)
    savedPlans.value.activeId = null
    currentPlanName.value = ''
  }

  function toggleWareLock(wareId: string) {
    const stationId = getActiveStationId()
    commands.toggleWareLock(stationId, wareId)
    syncActiveStationFromState(false)
    syncBindingStationPlanFromState(stationId)
  }

  function isWareOperable(wareId: string) {
    const ware = waresMap.value[wareId]
    return ware?.transport === 'container'
  }

  function isWareLocked(wareId: string) {
    if (!isWareOperable(wareId)) return true
    return lockedWares.value.includes(wareId)
  }

  function isPlannedWare(wareId: string): boolean {
    return plannedModules.value.some(module => {
      if (!isModuleCountEditable(module.id)) return false
      const moduleInfo = modulesMap.value[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  function isAutoWare(wareId: string): boolean {
    if (isPlannedWare(wareId)) return false
    return autoIndustryModules.value.some(module => {
      const moduleInfo = modulesMap.value[module.id]
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

  function toggleWarePriority(wareId: string) {
    const currentLevel = getResolvedLevel(wareId)
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)

    const nextPriority = deepClone(warePriority.value)

    if (planned) {
      if (currentLevel === 2) nextPriority[wareId] = 1
      else delete nextPriority[wareId]
    } else if (auto) {
      if (currentLevel === 0) nextPriority[wareId] = 1
      else delete nextPriority[wareId]
    }

    warePriority.value = nextPriority
  }

  function importPlan(input: string) {
    const raw = input.trim()
    if (!raw) return

    const deps: ImportDeps = {
      modulesMap: modulesMap.value,
      modulesByMacroId: gameData.modulesByMacroId
    }

    const result = parseImportInput(raw, deps)
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => console.warn(`[StationStore][Import] ${w}`))
    }

    if (result.modules.length > 0) {
      clearAll()
      result.modules.forEach(m => addModule(m.id, m.count))
    }
  }

  function getModuleInfo(id: string): X4Module {
    return modulesMap.value[id] || {
      id, macroId: '', wareId: '', nameId: id, type: 'unknown', group: 'others', race: 'unknown', buildTime: 0,
      buildCost: {}, cycleTime: 0, outputs: {}, inputs: {},
      dockingCount: 0,
      workforce: { capacity: 0, needed: 0, maxBonus: 0 }
    } as X4Module
  }

  return {
    isReady, isDirty, activeView,
    plannedModules, autoIndustryModules, settings, currentPlanName,
    wares: waresMap, modules: localizedModulesMap, moduleGroups: localizedModuleGroupsMap, medicalConsumption: medicalConsumptionMap,
    searchQuery, filteredModulesGrouped,
    enforceDlcActivation,
    loadData, savedPlans, saveCurrentPlan, loadPlan, mergePlan, deletePlan,
    lockedWares, isWareLocked, isWareOperable, toggleWareLock,
    warePriority, isPlannedWare, isAutoWare, getResolvedLevel, toggleWarePriority,
    updateSetting,
    addModule, importPlan, updateModuleId, updateModuleCount, removeModule, removeModuleById, transferModuleFromAutoIndustry, clearAll, getModuleInfo,
    isModuleDlcActive, isModuleCountEditable,
    actualWorkforce, currentEfficiency, groupedFlows,
    buildPriceMultiplier, stationAnalysis
  }
})