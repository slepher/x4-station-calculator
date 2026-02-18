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
import { calculateWorkforceBreakdown, calculateActualWorkforce, calculateEfficiencySaturation } from './logic/workforceCalculator'
import { calculateProfitBreakdown, calculateNetProduction } from './logic/productionCalculator'
import { generateFilteredModulesGrouped } from './logic/searchModule'
import { 
  parseXmlBlueprint, 
  isXmlFormat, 
  parseGameComLink, 
  resolveModuleId 
} from './logic/blueprintParser'
import { calculateAutoFill } from './logic/moduleDiffCalculator'

import { 
  calculateConstructionBreakdown
} from './logic/calculatorUtils'
import { analyzeWareFlow } from './logic/analyzeWareFlow'
import { analyzeStation } from './logic/analyzeStation'

// --- 类型定义 (Type Definitions) ---
export type { SavedModule, StationPlan } from '../types/x4'

export interface SavedPlansState {
  version: number;
  activeId: string | null;
  list: StationPlan[];
}

export const useStationStore = defineStore('station', () => {
  // --- 数据管理层 ---
    const gameData = useGameDataStore()
    const logicFlow = useLogicFlowStore()
    const empireStore = useEmpireStore()
    logicFlow.init() // 抑制未使用警告并确保初始化

  // --- 状态 (State) ---
  const activeView = ref<'production' | 'flow'>((localStorage.getItem('x4_station_active_view') as any) || 'production')
  const isReady = computed(() => empireStore.isReady && gameData.isReady)
  const plannedModules = ref<SavedModule[]>([]) // Tier 1: 用户规划的核心模块
  const lockedWares = ref<string[]>([]) // 提升至外层，与 plannedModules 并列
  const savedPlans = ref<SavedPlansState>({ version: 1, activeId: null, list: [] })
  const currentPlanName = computed({
    get: () => empireStore.activeStation?.name || '',
    set: (name: string) => {
      if (empireStore.activeStation) {
        empireStore.activeStation.name = name
      }
    }
  })
  const lastSavedSnapshot = ref<string>('')

  const settings = ref<StationSettings>({
    sunlight: 100,
    useHQ: false,           
    manualWorkforce: 0,      
    workforcePercent: 100,  
    workforceAuto: true,    
    considerWorkforceForAutoFill: false,
    buyMultiplier: 0.5,      
    sellMultiplier: 0.5,     
    minersEnabled: false,    
    internalSupply: false,
    racePreference: 'argon',  // 默认种族偏好
    resourceBufferHours: 1.0, // 默认资源缓冲时间
    primaryProductBufferHours: 12.0,   // 默认主产物缓冲时间（小时）
    secondaryProductBufferHours: 2.0,   // 默认副产物缓冲时间（小时）
    transportShipCapacity: 62000 // 默认运输船运量
  })

  const buildPriceMultiplier = ref(0.5)

  // 监听视图切换并持久化
  watch(activeView, (newView) => {
    localStorage.setItem('x4_station_active_view', newView)
  })

  // 产物优先级覆盖状态：wareId -> priorityLevel (0, 1, 2)
  const warePriority = ref<Record<string, number>>({})

  // --- 基础数据映射 (Ref 类型，需要用 .value 访问) ---
  const { 
    waresMap, 
    modulesMap, 
    localizedModulesMap, 
    localizedModuleGroupsMap, 
    medicalConsumptionMap,
    searchQuery
  } = storeToRefs(gameData)

  // --- 搜索增强 ---
  const { currentLocale } = storeToRefs(gameData)

  const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
    return generateFilteredModulesGrouped(
      searchQuery.value,
      currentLocale.value,
      localizedModulesMap.value,
      localizedModuleGroupsMap.value
    )
  })

  // --- 分析计算 ---
  const stationAnalysis = computed(() => {
    return analyzeStation(
      allIndustryModules.value,
      modulesMap.value,
      waresMap.value,
      buildPriceMultiplier.value,
      settings.value.useHQ
    )
  })

  // --- 辅助方法 (Helpers) ---
  function migrateSettings(s: any): StationSettings {
    s.racePreference = s.racePreference || 'argon' 
    // 兼容旧数据：将 productBufferHours 迁移到 primaryProductBufferHours
    if ('productBufferHours' in s) {
      const oldValue = s.productBufferHours
      s.primaryProductBufferHours = oldValue
      delete s.productBufferHours
    }
    s.primaryProductBufferHours = s.primaryProductBufferHours ?? 12.0
    s.secondaryProductBufferHours = s.secondaryProductBufferHours ?? 2.0
    s.resourceBufferHours = s.resourceBufferHours || 2 // 兼容旧数据
    s.transportShipCapacity = s.transportShipCapacity ?? 62000 // 兼容旧数据，默认 62000
    return s as StationSettings
  }

  function applyPlan(plan: StationPlan) {
    plannedModules.value = JSON.parse(JSON.stringify(plan.modules))
    currentPlanName.value = plan.name
    
    // 处理设置及兼容性
    const rawSettings = JSON.parse(JSON.stringify(plan.settings))
    settings.value = migrateSettings(rawSettings)
    
    savedPlans.value.activeId = plan.id
    lockedWares.value = plan.lockedWares ? JSON.parse(JSON.stringify(plan.lockedWares)) : []
    warePriority.value = plan.warePriority ? JSON.parse(JSON.stringify(plan.warePriority)) : {}
  }

  // --- 操作方法 (Actions) ---
  function loadData(source: SavedPlansState) {
    savedPlans.value = JSON.parse(JSON.stringify(source))
    if (savedPlans.value.activeId) {
      const target = savedPlans.value.list.find(l => l.id === savedPlans.value.activeId)
      if (target) {
        applyPlan(target)
      }
    }
    takeSnapshot()
  }

  function takeSnapshot() {
    lastSavedSnapshot.value = JSON.stringify({ m: plannedModules.value, l: lockedWares.value, s: settings.value })
  }

  function loadDemoData() {
    loadData(mockStationData as unknown as SavedPlansState)
  }

  function saveCurrentPlan(name?: string) {
    const finalName = name || currentPlanName.value
    // 注意：Store 层不做最终空检查，由 UI 层保证 finalName 有效或逻辑正确
    
    const planData: StationPlan = {
      id: savedPlans.value.activeId || crypto.randomUUID(),
      name: finalName,
      modules: JSON.parse(JSON.stringify(plannedModules.value)),
      lockedWares: JSON.parse(JSON.stringify(lockedWares.value)),
      settings: JSON.parse(JSON.stringify(settings.value)),
      warePriority: JSON.parse(JSON.stringify(warePriority.value)),
      lastUpdated: Date.now()
    }

    const stored = localStorage.getItem('x4_station_data')
    if (stored) {
      try {
        const remote = JSON.parse(stored)
        savedPlans.value.list = remote.list || []
      } catch (e) { /* ignore parse error */ }
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
    if (plan) {
      applyPlan(plan)
    }
  }

  function mergePlan(index: number) {
    const plan = savedPlans.value.list[index]
    if (plan) plan.modules.forEach(m => addModule(m.id, m.count))
  }

  function deletePlan(index: number) {
    if (savedPlans.value.list[index]?.id === savedPlans.value.activeId) {
      savedPlans.value.activeId = null
    }
    savedPlans.value.list.splice(index, 1)
  }

  watch(activeView, (val) => {
    localStorage.setItem('x4_station_active_view', val)
  })

  watch(savedPlans, (val) => {
    localStorage.setItem('x4_station_data', JSON.stringify(val))
  }, { deep: true })

  // 同步当前分站数据到 EmpireStore
  watch([plannedModules, lockedWares, warePriority, settings], () => {
    const station = empireStore.activeStation
    if (station) {
      station.modules = JSON.parse(JSON.stringify(plannedModules.value))
      station.lockedWares = JSON.parse(JSON.stringify(lockedWares.value))
      station.warePriority = JSON.parse(JSON.stringify(warePriority.value))
      station.settings = JSON.parse(JSON.stringify(settings.value))
      station.lastUpdated = Date.now()
    }
  }, { deep: true })

  // 从 EmpireStore 同步到本地状态（当切换分站时）
  watch(() => empireStore.activeStation, (station) => {
    if (station) {
      plannedModules.value = JSON.parse(JSON.stringify(station.modules))
      lockedWares.value = station.lockedWares ? JSON.parse(JSON.stringify(station.lockedWares)) : []
      warePriority.value = station.warePriority ? JSON.parse(JSON.stringify(station.warePriority)) : {}
      const rawSettings = JSON.parse(JSON.stringify(station.settings))
      settings.value = migrateSettings(rawSettings)
    }
  })

  function addModule(id: string = '', count = 1) {
    if (id !== '' && !modulesMap.value[id]) return
    const existing = plannedModules.value.find(m => m.id === id && id !== '')
    if (existing) { existing.count += count } 
    else { plannedModules.value.push({ id, count }) }
  }

  function updateModuleId(index: number, newId: string) {
    if (index >= 0 && index < plannedModules.value.length) { 
      const plannedModule = plannedModules.value[index]
      if(plannedModule && modulesMap.value[newId]) plannedModule.id = newId
    }
  }

  function updateModuleCount(index: number, count: number) {
    if (index >= 0 && index < plannedModules.value.length) {
      const module = plannedModules.value[index]
      if(module) module.count = count
    }
  }

  function removeModule(index: number) {
    if (index >= 0 && index < plannedModules.value.length) {
      plannedModules.value.splice(index, 1)
    }
  }

  function removeModuleById(id: string) {
    const index = plannedModules.value.findIndex(m => m.id === id)
    if (index !== -1) removeModule(index)
  }

  // 从自动工业区转移模块到用户规划区
  function transferModuleFromAutoIndustry(module: SavedModule) {
    // 检查是否在自动工业区中
    const inIndustry = autoIndustryModules.value.some(m => m.id === module.id)
    
    if (!inIndustry) return
    
    // 添加到用户规划区
    addModule(module.id, module.count)
    
    // 注意：由于autoIndustryModules是计算属性，不能直接修改
    // 转移操作会触发重新计算，自动工业区会相应减少
  }

  function clearAll() { 
    plannedModules.value = []
    lockedWares.value = []
    savedPlans.value.activeId = null
    currentPlanName.value = ''
  }

  // 切换资源锁定状态
  function toggleWareLock(wareId: string) {
    const ware = waresMap.value[wareId];
    if(ware?.transport !== 'container') return;;
    const idx = lockedWares.value.indexOf(wareId)
    if (idx > -1) {
      lockedWares.value.splice(idx, 1)
    } else {
      lockedWares.value.push(wareId)
    }
  }

  function isWareOperable(wareId: string) {
    const ware = waresMap.value[wareId];
    return ware?.transport === 'container';
  }

  function isWareLocked(wareId: string) {
    // 不可操作的资源项始终显示为锁定状态
    if (!isWareOperable(wareId)) return true;
    return lockedWares.value.includes(wareId)
  }

  // ========== 产物优先级管理 ==========

  /**
   * 检查产物是否为计划产物（存在于 plannedModules 的输出中）
   */
  function isPlannedWare(wareId: string): boolean {
    return plannedModules.value.some(module => {
      const moduleInfo = modulesMap.value[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  /**
   * 检查产物是否为自动产物（仅存在于 autoIndustryModules 的输出中）
   */
  function isAutoWare(wareId: string): boolean {
    // 如果是计划产物，则不是自动产物
    if (isPlannedWare(wareId)) return false
    // 检查是否在自动工业区的输出中
    return autoIndustryModules.value.some(module => {
      const moduleInfo = modulesMap.value[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  /**
   * 获取产物的最终优先级级别
   * 判定顺序：1. 自动纠错 2. 手动覆盖 3. 默认身份
   */
  function getResolvedLevel(wareId: string): number {
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)
    const override = warePriority.value[wareId]

    // 1. 自动纠错
    if (planned && override === 0) return 1 // 计划产物不能设为0，自动纠正为1
    if (auto && override === 2) return 1    // 自动产物不能设为2，自动纠正为1

    // 2. 手动覆盖
    if (override !== undefined) return override

    // 3. 默认身份
    if (planned) return 2  // 计划产物默认为主产物
    if (auto) return 0     // 自动产物默认为无需求
    return 0               // 其他情况默认为无需求
  }

  /**
   * 切换产物优先级
   * 计划产物：2 ↔ 1
   * 自动产物：0 ↔ 1
   */
  function toggleWarePriority(wareId: string) {
    const currentLevel = getResolvedLevel(wareId)
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)

    if (planned) {
      // 计划产物：2 ↔ 1
      if (currentLevel === 2) {
        warePriority.value[wareId] = 1
      } else {
        // 切回默认，删除覆盖
        delete warePriority.value[wareId]
      }
    } else if (auto) {
      // 自动产物：0 ↔ 1
      if (currentLevel === 0) {
        warePriority.value[wareId] = 1
      } else {
        // 切回默认，删除覆盖
        delete warePriority.value[wareId]
      }
    }
    // 非计划非自动产物不处理
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
        if (resolvedId) {
          addModule(resolvedId, count)
        }
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

  // --- 业务计算逻辑 ---
  const constructionBreakdown = computed(() => {
    return calculateConstructionBreakdown(
      allModules.value,
      modulesMap.value,
      waresMap.value
    )
  })

  const workforceBreakdown = computed(() => 
    calculateWorkforceBreakdown(allIndustryModules.value, modulesMap.value, settings.value) // 使用完整的工业区模块计算劳动力需求
  )

  const actualWorkforce = computed(() => 
    calculateActualWorkforce(workforceBreakdown.value, settings.value)
  )

  const efficiencyMetrics = computed(() => ({
    saturation: calculateEfficiencySaturation(workforceBreakdown.value.needed.total, actualWorkforce.value)
  }))
  
  const profitBreakdown = computed(() => {
    return calculateProfitBreakdown(
      allIndustryModules.value, // 只计算工业区模块（planned + industry）的资源产出
      modulesMap.value,
      waresMap.value,
      settings.value,
      actualWorkforce.value, // 工业产出不计算工人消耗
      efficiencyMetrics.value.saturation
    )
  })
  
  const netProduction = computed(() => 
    calculateNetProduction(profitBreakdown.value.wareDetails)
  )

  // 资源流向分析 (Ware Flow Analysis)
  const groupedFlows = computed(() => {
    let plannedWareIds : string[] = [];

    plannedModules.value.forEach(item => {
      const info :X4Module | undefined = modulesMap.value[item.id];
      if (!info) return;
      Object.keys(info.outputs || {}).forEach((wareId) => {
        if(plannedWareIds.includes(wareId)) return;
        plannedWareIds.push(wareId);
      })
    })

    // 构建产物优先级映射：wareId -> resolvedLevel
    const warePriorityLevels: Record<string, number> = {}
    Object.keys(waresMap.value).forEach(wareId => {
      warePriorityLevels[wareId] = getResolvedLevel(wareId)
    })

    return analyzeWareFlow(
      allIndustryModules.value,
      modulesMap.value,
      waresMap.value,
      medicalConsumptionMap.value,
      settings.value,
      actualWorkforce.value,
      efficiencyMetrics.value.saturation,
      settings.value.resourceBufferHours,
      settings.value.primaryProductBufferHours,
      settings.value.secondaryProductBufferHours,
      warePriorityLevels
    )
  })

  // 2. The Engine (核心计算引擎)
  // 这是一个 Computed，它监听 manualModules 变化，
  // 并在内部一次性完成所有依赖计算，输出最终的两个自动列表。
  const calculationResult = computed(() => {
    
    /// 调用刚才重构完成的函数 calculateAutoFill
    const result = calculateAutoFill(
      plannedModules.value,
      settings.value,
      modulesMap.value,
      waresMap.value,
      lockedWares.value,
      medicalConsumptionMap.value,
      warePriority.value // Pass raw user overrides, resolve internally
    );

    return {
      industry: result.autoIndustry,
      supply: result.autoSupply
    };
  });

  // 3. 暴露给 UI 的接口
  // UI 只需要读这两个属性，它们会自动同步
  const autoIndustryModules = computed(() => calculationResult.value.industry);
  const autoSupplyModules = computed(() => calculationResult.value.supply);

  // 工业区模块：planned + industry（用于资源产出计算和概览）
  const allIndustryModules = computed(() => [
    ...plannedModules.value,
    ...autoIndustryModules.value
  ])

  // 合并所有模块用于计算
  const allModules = computed(() => [
    ...plannedModules.value,
    ...autoIndustryModules.value,
    ...autoSupplyModules.value
  ])

  function autoFillMissingLines() {
    // 此函数现在已过时，因为计算是自动的
    // 保留函数签名以保持兼容性
    console.log('autoFillMissingLines is now handled automatically via computed properties');
  }

  // --- 初始化 ---
  const initializeStore = async () => {
    console.log('[StationStore] Initializing...')
    try {
      // 1. 初始化游戏数据层
      await gameData.initialize()
      
      // 2. 初始化逻辑组网层
      logicFlow.init()

      // 3. 恢复视图状态
      const storedView = localStorage.getItem('x4_station_active_view')
      if (storedView === 'production' || storedView === 'flow') {
        activeView.value = storedView as 'production' | 'flow'
      }

      // 4. 从 localStorage 恢复或加载 Demo (由 EmpireStore 处理)
      // EmpireStore 负责数据持久化，这里仅同步当前分站数据
      const activeStation = empireStore.activeStation
      if (activeStation) {
        plannedModules.value = JSON.parse(JSON.stringify(activeStation.modules))
        lockedWares.value = activeStation.lockedWares ? JSON.parse(JSON.stringify(activeStation.lockedWares)) : []
        warePriority.value = activeStation.warePriority ? JSON.parse(JSON.stringify(activeStation.warePriority)) : {}
        const rawSettings = JSON.parse(JSON.stringify(activeStation.settings))
        settings.value = migrateSettings(rawSettings)
      }
      
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
    actualWorkforce, currentEfficiency: computed(() => efficiencyMetrics.value.saturation), netProduction, groupedFlows,
    buildPriceMultiplier, stationAnalysis
  }
})