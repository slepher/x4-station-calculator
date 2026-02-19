import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import { mockStationData } from '@/mock/mock_data_v1'
import type {
  X4Module,
  SavedModule,
  StationSettings,
  StationPlan,
  ModuleGroupResult,
} from '../types/x4'
import { useGameDataStore } from './useGameDataStore'
import { useLogicFlowStore } from './useLogicFlowStore'
import { useEmpireStore } from './useEmpireStore'
import { generateFilteredModulesGrouped } from './logic/searchModule'
import {
  parseXmlBlueprint,
  isXmlFormat,
  parseGameComLink,
  resolveModuleId
} from './logic/blueprintParser'
import { stationStateMap, migrateStationSettings, DEFAULT_STATION_SETTINGS } from './state/StationStateMap'

export type { SavedModule, StationPlan } from '../types/x4'

export interface SavedPlansState {
  version: number;
  activeId: string | null;
  list: StationPlan[];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export const useStationStore = defineStore('station', () => {
  const gameData = useGameDataStore()
  const logicFlow = useLogicFlowStore()
  const empireStore = useEmpireStore()
  logicFlow.init()

  const activeView = ref<'production' | 'flow'>((localStorage.getItem('x4_station_active_view') as any) || 'production')
  const isReady = computed(() => empireStore.isReady && gameData.isReady)
  const savedPlans = ref<SavedPlansState>({ version: 1, activeId: null, list: [] })
  const lastSavedSnapshot = ref<string>('')
  const buildPriceMultiplier = ref(0.5)
  const isHydratingState = ref(false)

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
    searchQuery
  } = storeToRefs(gameData)

  const { currentLocale } = storeToRefs(gameData)

  function getComputeDeps() {
    if (!gameData.isReady) return null
    if (!modulesMap.value || !waresMap.value || !medicalConsumptionMap.value) return null
    return {
      modulesMap: modulesMap.value,
      waresMap: waresMap.value,
      medicalConsumptionMap: medicalConsumptionMap.value,
      buildPriceMultiplier: buildPriceMultiplier.value
    }
  }

  function getActiveContext() {
    const station = empireStore.activeStation
    if (!station) {
      let state = stationStateMap.get('__local__')
      if (!state) {
        state = stationStateMap.ensure('__local__', {
          settings: { ...DEFAULT_STATION_SETTINGS }
        })
      }
      return { station: null as StationPlan | null, state }
    }

    let state = stationStateMap.get(station.id)
    if (!state) {
      station.settings = migrateStationSettings(station.settings)
      state = stationStateMap.fromPersisted(station.id, station)
      const deps = getComputeDeps()
      if (deps) stationStateMap.recompute(station.id, deps)
    }

    return { station: station as StationPlan | null, state }
  }

  function syncStateFromActiveStation() {
    const station = empireStore.activeStation
    if (!station) return

    isHydratingState.value = true
    station.settings = migrateStationSettings(station.settings)
    stationStateMap.fromPersisted(station.id, station)
    const deps = getComputeDeps()
    if (deps) stationStateMap.recompute(station.id, deps)
    isHydratingState.value = false
  }

  function syncActiveStationFromState(updateTimestamp: boolean) {
    const ctx = getActiveContext()
    if (!ctx) return
    if (!ctx.station) return
    const stationId = ctx.station.id
    const persisted = stationStateMap.toPersisted(stationId)
    if (!persisted) return

    ctx.station.modules = deepClone(persisted.modules)
    ctx.station.lockedWares = deepClone(persisted.lockedWares || [])
    ctx.station.warePriority = deepClone(persisted.warePriority || {})
    ctx.station.settings = migrateStationSettings(persisted.settings)
    if (updateTimestamp) {
      ctx.station.lastUpdated = Date.now()
    }
  }

  function recomputeActiveStation() {
    const ctx = getActiveContext()
    if (!ctx) return
    const deps = getComputeDeps()
    if (!deps) return
    stationStateMap.recompute(ctx.station?.id || '__local__', deps)
  }

  function takeSnapshot() {
    const ctx = getActiveContext()
    if (!ctx) {
      lastSavedSnapshot.value = JSON.stringify({ m: [], l: [], s: DEFAULT_STATION_SETTINGS })
      return
    }
    lastSavedSnapshot.value = JSON.stringify({
      m: ctx.state.plannedModules,
      l: ctx.state.lockedWares,
      s: ctx.state.settings
    })
  }

  const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
    return generateFilteredModulesGrouped(
      searchQuery.value,
      currentLocale.value,
      localizedModulesMap.value,
      localizedModuleGroupsMap.value
    )
  })

  watch(activeView, (val) => {
    localStorage.setItem('x4_station_active_view', val)
  })

  watch(savedPlans, (val) => {
    localStorage.setItem('x4_station_data', JSON.stringify(val))
  }, { deep: true })

  watch(
    () => ({
      stationId: empireStore.activeStation?.id,
      gameReady: gameData.isReady,
      buildPrice: buildPriceMultiplier.value
    }),
    () => {
      syncStateFromActiveStation()
      takeSnapshot()
    },
    { immediate: true }
  )

  watch(
    () => {
      const ctx = getActiveContext()
      if (!ctx) return null
      const stationId = ctx.station?.id || '__local__'
      return {
        id: stationId,
        modules: ctx.state.plannedModules,
        locked: ctx.state.lockedWares,
        priority: ctx.state.warePriority,
        settings: ctx.state.settings
      }
    },
    () => {
      if (isHydratingState.value) return
      recomputeActiveStation()
      syncActiveStationFromState(false)
    },
    { deep: true }
  )

  const plannedModules = computed<SavedModule[]>({
    get: () => getActiveContext()?.state.plannedModules || [],
    set: (value) => {
      const ctx = getActiveContext()
      if (!ctx) return
      stationStateMap.patch(ctx.station?.id || '__local__', { plannedModules: deepClone(value) })
      recomputeActiveStation()
      syncActiveStationFromState(false)
    }
  })

  const lockedWares = computed<string[]>({
    get: () => getActiveContext()?.state.lockedWares || [],
    set: (value) => {
      const ctx = getActiveContext()
      if (!ctx) return
      stationStateMap.patch(ctx.station?.id || '__local__', { lockedWares: deepClone(value) })
      recomputeActiveStation()
      syncActiveStationFromState(false)
    }
  })

  const warePriority = computed<Record<string, number>>({
    get: () => getActiveContext()?.state.warePriority || {},
    set: (value) => {
      const ctx = getActiveContext()
      if (!ctx) return
      stationStateMap.patch(ctx.station?.id || '__local__', { warePriority: deepClone(value) })
      recomputeActiveStation()
      syncActiveStationFromState(false)
    }
  })

  const settings = computed<StationSettings>({
    get: () => getActiveContext()?.state.settings || { ...DEFAULT_STATION_SETTINGS },
    set: (value) => {
      const ctx = getActiveContext()
      if (!ctx) return
      stationStateMap.patch(ctx.station?.id || '__local__', { settings: migrateStationSettings(value) })
      recomputeActiveStation()
      syncActiveStationFromState(false)
    }
  })

  const autoIndustryModules = computed(() => getActiveContext()?.state.autoIndustryModules || [])
  const autoSupplyModules = computed(() => getActiveContext()?.state.autoSupplyModules || [])
  const allIndustryModules = computed(() => getActiveContext()?.state.allIndustryModules || [])
  const allModules = computed(() => getActiveContext()?.state.allModules || [])
  const constructionBreakdown = computed(() => getActiveContext()?.state.constructionBreakdown || {
    moduleList: [],
    totalCost: 0,
    totalMaterials: {}
  })
  const workforceBreakdown = computed(() => getActiveContext()?.state.workforceBreakdown || {
    needed: { total: 0, details: [] },
    capacity: { total: 0, details: [] }
  })
  const profitBreakdown = computed(() => getActiveContext()?.state.profitBreakdown || {
    wareDetails: {},
    totalRevenue: 0,
    totalExpense: 0,
    profit: 0,
    production: { total: 0, items: {} },
    expenses: { total: 0, items: {} }
  })
  const actualWorkforce = computed(() => getActiveContext()?.state.actualWorkforce || 0)
  const currentEfficiency = computed(() => getActiveContext()?.state.currentEfficiency || 0)
  const netProduction = computed(() => getActiveContext()?.state.netProduction || {})
  const groupedFlows = computed(() => {
    const ctx = getActiveContext()
    if (!ctx) return stationStateMap.getGroupedFlows('__local__')
    return stationStateMap.getGroupedFlows(ctx.station?.id || '__local__')
  })
  const stationAnalysis = computed(() => getActiveContext()?.state.stationAnalysis || {
    totalCost: 0,
    totalVolume: 0,
    totalTime: 0,
    totalCapacity: 0,
    totalNeeded: 0,
    playerHQNeeded: 0,
    totalWorkerDiff: 0,
    summaryItems: [],
    moduleGroups: []
  })

  function applyPlan(plan: StationPlan) {
    const ctx = getActiveContext()
    if (!ctx) return
    const stationId = ctx.station?.id || '__local__'
    stationStateMap.patch(stationId, {
      plannedModules: deepClone(plan.modules),
      lockedWares: deepClone(plan.lockedWares || []),
      warePriority: deepClone(plan.warePriority || {}),
      settings: migrateStationSettings(plan.settings)
    })
    recomputeActiveStation()
    syncActiveStationFromState(false)
    savedPlans.value.activeId = plan.id
  }

  function loadData(source: SavedPlansState) {
    savedPlans.value = deepClone(source)
    if (savedPlans.value.activeId) {
      const target = savedPlans.value.list.find(l => l.id === savedPlans.value.activeId)
      if (target) applyPlan(target)
    }
    takeSnapshot()
  }

  function loadDemoData() {
    loadData(mockStationData as unknown as SavedPlansState)
  }

  function saveCurrentPlan(name?: string) {
    const ctx = getActiveContext()
    if (!ctx) return

    const stationId = ctx.station?.id || '__local__'
    const persisted = stationStateMap.toPersisted(stationId)
    if (!persisted) return

    const finalName = name || currentPlanName.value
    const planData: StationPlan = {
      id: savedPlans.value.activeId || crypto.randomUUID(),
      name: finalName,
      modules: deepClone(persisted.modules),
      lockedWares: deepClone(persisted.lockedWares || []),
      settings: deepClone(persisted.settings),
      warePriority: deepClone(persisted.warePriority || {}),
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
    takeSnapshot()
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
    const ctx = getActiveContext()
    if (!ctx) return
    const stationId = ctx.station?.id || '__local__'
    stationStateMap.mutate(stationId, (state) => {
      const existing = state.plannedModules.find(m => m.id === id && id !== '')
      if (existing) existing.count += count
      else state.plannedModules.push({ id, count })
    })
    recomputeActiveStation()
    syncActiveStationFromState(false)
  }

  function updateModuleId(index: number, newId: string) {
    if (!modulesMap.value[newId]) return
    const ctx = getActiveContext()
    if (!ctx) return
    const stationId = ctx.station?.id || '__local__'
    stationStateMap.mutate(stationId, (state) => {
      if (index >= 0 && index < state.plannedModules.length) {
        const plannedModule = state.plannedModules[index]
        if (plannedModule) plannedModule.id = newId
      }
    })
    recomputeActiveStation()
    syncActiveStationFromState(false)
  }

  function updateModuleCount(index: number, count: number) {
    const ctx = getActiveContext()
    if (!ctx) return
    const stationId = ctx.station?.id || '__local__'
    stationStateMap.mutate(stationId, (state) => {
      if (index >= 0 && index < state.plannedModules.length) {
        const module = state.plannedModules[index]
        if (module) module.count = count
      }
    })
    recomputeActiveStation()
    syncActiveStationFromState(false)
  }

  function removeModule(index: number) {
    const ctx = getActiveContext()
    if (!ctx) return
    const stationId = ctx.station?.id || '__local__'
    stationStateMap.mutate(stationId, (state) => {
      if (index >= 0 && index < state.plannedModules.length) {
        state.plannedModules.splice(index, 1)
      }
    })
    recomputeActiveStation()
    syncActiveStationFromState(false)
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
    const ctx = getActiveContext()
    if (!ctx) return
    const stationId = ctx.station?.id || '__local__'
    stationStateMap.patch(stationId, {
      plannedModules: [],
      lockedWares: [],
      warePriority: {}
    })
    recomputeActiveStation()
    syncActiveStationFromState(false)
    savedPlans.value.activeId = null
    currentPlanName.value = ''
  }

  function toggleWareLock(wareId: string) {
    const ware = waresMap.value[wareId]
    if (ware?.transport !== 'container') return

    const ctx = getActiveContext()
    if (!ctx) return

    const stationId = ctx.station?.id || '__local__'
    stationStateMap.mutate(stationId, (state) => {
      const idx = state.lockedWares.indexOf(wareId)
      if (idx > -1) state.lockedWares.splice(idx, 1)
      else state.lockedWares.push(wareId)
    })
    recomputeActiveStation()
    syncActiveStationFromState(false)
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

    if (isXmlFormat(raw)) {
      const counts = parseXmlBlueprint(raw)
      const totalFound = Object.values(counts).reduce((sum, count) => sum + count, 0)
      if (totalFound > 0) {
        clearAll()
        Object.entries(counts).forEach(([id, count]) => addModule(id, count))
        return
      }
    }

    const counts = parseGameComLink(raw)
    if (Object.keys(counts).length > 0) {
      clearAll()
      Object.entries(counts).forEach(([id, count]) => {
        const resolvedId = resolveModuleId(id, modulesMap.value)
        if (resolvedId) addModule(resolvedId, count)
      })
    }
  }

  function getModuleInfo(id: string): X4Module {
    return modulesMap.value[id] || {
      id, wareId: '', nameId: id, type: 'unknown', group: 'others', race: 'unknown', buildTime: 0,
      buildCost: {}, cycleTime: 0, outputs: {}, inputs: {},
      workforce: { capacity: 0, needed: 0, maxBonus: 0 }
    } as X4Module
  }

  function autoFillMissingLines() {
    console.log('autoFillMissingLines is now handled automatically via StationStateMap')
  }

  const initializeStore = async () => {
    console.log('[StationStore] Initializing...')
    try {
      await gameData.initialize()
      logicFlow.init()
      const storedView = localStorage.getItem('x4_station_active_view')
      if (storedView === 'production' || storedView === 'flow') {
        activeView.value = storedView as 'production' | 'flow'
      }
      syncStateFromActiveStation()
      takeSnapshot()
      console.log('[StationStore] Initialized. Ready:', isReady.value)
    } catch (e) {
      console.error('[Store] Initialization failed:', e)
    }
  }

  initializeStore()

  return {
    isReady, isDirty, activeView,
    plannedModules, autoIndustryModules, autoSupplyModules, allIndustryModules, allModules, settings, currentPlanName,
    wares: waresMap, modules: localizedModulesMap, moduleGroups: localizedModuleGroupsMap, medicalConsumption: medicalConsumptionMap,
    searchQuery, filteredModulesGrouped,
    loadData, loadDemoData, savedPlans, saveCurrentPlan, loadPlan, mergePlan, deletePlan,
    lockedWares, isWareLocked, isWareOperable, toggleWareLock,
    warePriority, isPlannedWare, isAutoWare, getResolvedLevel, toggleWarePriority,
    addModule, importPlan, updateModuleId, updateModuleCount, removeModule, removeModuleById, transferModuleFromAutoIndustry, clearAll, getModuleInfo,
    constructionBreakdown, workforceBreakdown, profitBreakdown, autoFillMissingLines,
    actualWorkforce, currentEfficiency, netProduction, groupedFlows,
    buildPriceMultiplier, stationAnalysis
  }
})
