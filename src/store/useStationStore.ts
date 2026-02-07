import type { Ref } from 'vue'
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { mockStationData } from '@/mock/mock_data_v1'
import type {
  X4Module,
  X4Ware,
  SavedModule,
  StationSettings,
  StationLayout,
  RaceMedicalConsumption
} from '../types/x4'
import { useGameData, type LocalizedX4Module, type LocalizedX4ModuleGroup } from './logic/useGameData'
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

import { calculateConstructionBreakdown } from './logic/productionCalculator'
import { analyzeWareFlow } from './logic/analyzeWareFlow'

// --- 类型定义 (Type Definitions) ---
export type { SavedModule, StationLayout } from '../types/x4'
export type { LocalizedX4ModuleGroup, LocalizedX4Module } from './logic/useGameData'

export interface SavedLayoutsState {
  version: number;
  activeId: string | null;
  list: StationLayout[];
}

export interface GroupedModuleItem extends LocalizedX4Module {
  displayLabel: string
  moduleGroup?: LocalizedX4ModuleGroup
}

export interface ModuleGroupResult {
  group: string
  displayLabel: string
  modules: GroupedModuleItem[]
}

export const useStationStore = defineStore('station', () => {
  // --- 数据管理层 ---
  const gameData = useGameData()

  // --- 状态 (State) ---
  const isReady = ref(false)
  const plannedModules = ref<SavedModule[]>([]) // Tier 1: 用户规划的核心模块
  const lockedWares = ref<string[]>([]) // 提升至外层，与 plannedModules 并列
  const savedLayouts = ref<SavedLayoutsState>({ version: 1, activeId: null, list: [] })
  const searchQuery = ref('')
  const lastSavedSnapshot = ref<string>('')

  const settings = ref<StationSettings>({
    sunlight: 100,
    useHQ: false,           
    manualWorkforce: 0,      
    workforcePercent: 100,  
    workforceAuto: true,    
    considerWorkforceForAutoFill: false,
    supplyWorkforceBonus: false,
    buyMultiplier: 0.5,      
    sellMultiplier: 0.5,     
    minersEnabled: false,    
    internalSupply: false,
    racePreference: 'argon',  // 默认种族偏好
    resourceBufferHours: 1.0, // 默认资源缓冲时间
    productBufferHours: 1.0   // 默认产品缓冲时间
  })

  // --- 基础数据映射 (Ref 类型，需要用 .value 访问) ---
  const waresMap: Ref<Record<string, X4Ware>> = gameData.waresMap
  const modulesMap: Ref<Record<string, X4Module>> = gameData.modulesMap
  const localizedModulesMap: Ref<Record<string, LocalizedX4Module>> = gameData.localizedModulesMap
  const localizedModuleGroupsMap: Ref<Record<string, LocalizedX4ModuleGroup>> = gameData.localizedModuleGroupsMap
  const medicalConsumptionMap: Ref<RaceMedicalConsumption> = gameData.medicalConsumptionMap

  // --- 搜索增强 ---
  const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
    return generateFilteredModulesGrouped(
      searchQuery.value,
      gameData.currentLocale.value,
      localizedModulesMap.value,
      localizedModuleGroupsMap.value
    )
  })

  // --- 操作方法 (Actions) ---
  function loadData(source: SavedLayoutsState) {
    savedLayouts.value = JSON.parse(JSON.stringify(source))
    if (savedLayouts.value.activeId) {
      const target = savedLayouts.value.list.find(l => l.id === savedLayouts.value.activeId)
      if (target) {
        plannedModules.value = JSON.parse(JSON.stringify(target.modules))
        settings.value = JSON.parse(JSON.stringify(target.settings))
        settings.value.racePreference = settings.value.racePreference || 'argon' // 兼容旧数据
        lockedWares.value = target.lockedWares ? JSON.parse(JSON.stringify(target.lockedWares)) : []
      }
    }
    takeSnapshot()
  }

  function takeSnapshot() {
    lastSavedSnapshot.value = JSON.stringify({ m: plannedModules.value, l: lockedWares.value, s: settings.value })
  }

  function loadDemoData() {
    loadData(mockStationData as unknown as SavedLayoutsState)
  }

  function saveCurrentLayout(name: string) {
    const layoutData: StationLayout = {
      id: savedLayouts.value.activeId || crypto.randomUUID(),
      name,
      modules: JSON.parse(JSON.stringify(plannedModules.value)),
      lockedWares: JSON.parse(JSON.stringify(lockedWares.value)),
      settings: JSON.parse(JSON.stringify(settings.value)),
      lastUpdated: Date.now()
    }

    const stored = localStorage.getItem('x4_station_data')
    if (stored) {
      try {
        const remote = JSON.parse(stored)
        savedLayouts.value.list = remote.list || []
      } catch (e) { /* ignore parse error */ }
    }

    const idx = savedLayouts.value.list.findIndex(l => l.id === layoutData.id)
    if (idx !== -1) savedLayouts.value.list[idx] = layoutData
    else savedLayouts.value.list.push(layoutData)
    savedLayouts.value.activeId = layoutData.id
    takeSnapshot()
  }

  const isDirty = computed(() => {
    const current = JSON.stringify({ m: plannedModules.value, l: lockedWares.value, s: settings.value })
    return current !== lastSavedSnapshot.value
  })

  function loadLayout(index: number) {
    const layout = savedLayouts.value.list[index]
    if (layout) {
      plannedModules.value = JSON.parse(JSON.stringify(layout.modules))
      settings.value = JSON.parse(JSON.stringify(layout.settings))
      savedLayouts.value.activeId = layout.id
      lockedWares.value = layout.lockedWares ? JSON.parse(JSON.stringify(layout.lockedWares)) : []
    }
  }

  function mergeLayout(index: number) {
    const layout = savedLayouts.value.list[index]
    if (layout) layout.modules.forEach(m => addModule(m.id, m.count))
  }

  function deleteLayout(index: number) {
    if (savedLayouts.value.list[index]?.id === savedLayouts.value.activeId) {
      savedLayouts.value.activeId = null
    }
    savedLayouts.value.list.splice(index, 1)
  }

  watch(savedLayouts, (val) => {
    localStorage.setItem('x4_station_data', JSON.stringify(val))
  }, { deep: true })

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
    const autoModuleIndex = autoIndustryModules.value.findIndex(m => m.id === module.id)
    if (autoModuleIndex === -1) return
    
    // 添加到用户规划区
    addModule(module.id, module.count)
    
    // 注意：由于autoIndustryModules是计算属性，不能直接修改
    // 转移操作会触发重新计算，自动工业区会相应减少
  }

  function clearAll() { 
    plannedModules.value = []
    lockedWares.value = []
    savedLayouts.value.activeId = null
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
      allIndustryModules.value,
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
  const wareFlowList = computed(() => {
    return analyzeWareFlow(
      allIndustryModules.value,
      modulesMap.value,
      waresMap.value,
      medicalConsumptionMap.value,
      settings.value,
      actualWorkforce.value,
      efficiencyMetrics.value.saturation,
      settings.value.resourceBufferHours,
      settings.value.productBufferHours
    )
  })

  // 2. The Engine (核心计算引擎)
  // 这是一个 Computed，它监听 manualModules 变化，
  // 并在内部一次性完成所有依赖计算，输出最终的两个自动列表。
  const calculationResult = computed(() => {
    
    /// 调用刚才重构完成的函数 calculateAutoFill
    const result = calculateAutoFill(
      plannedModules.value,
      settings.value.racePreference, // 使用store中的种族偏好设置
      settings.value.considerWorkforceForAutoFill,
      settings.value.supplyWorkforceBonus,
      modulesMap.value,
      waresMap.value,
      lockedWares.value
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

  // 工业区模块：planned + industry（用于资源产出计算）
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
    isReady.value = false
    try {
      // 1. 初始化游戏数据层
      await gameData.initialize()
      
      // 2. 从 localStorage 恢复或加载 Demo
      const stored = localStorage.getItem('x4_station_data')
      if (stored) {
        try {
          loadData(JSON.parse(stored))
        } catch (e) {
          console.error('[Store] Failed to parse localStorage data, falling back to demo', e)
          loadDemoData()
        }
      } else {
        loadDemoData()
      }
      
      takeSnapshot()
      isReady.value = true
    } catch (e) {
      console.error('[Store] Initialization failed:', e)
    }
  }

  initializeStore()

  return {
    isReady, isDirty,
    plannedModules, autoIndustryModules, autoSupplyModules, allModules, settings, searchQuery, filteredModulesGrouped,
    wares: waresMap, modules: localizedModulesMap, moduleGroups: localizedModuleGroupsMap, medicalConsumption: medicalConsumptionMap,
    loadData, loadDemoData, savedLayouts, saveCurrentLayout, loadLayout, mergeLayout, deleteLayout,
    lockedWares, isWareLocked, isWareOperable, toggleWareLock,
    addModule, importPlan, updateModuleId, updateModuleCount, removeModule, removeModuleById, transferModuleFromAutoIndustry, clearAll, getModuleInfo,
    constructionBreakdown, workforceBreakdown, profitBreakdown, autoFillMissingLines,
    actualWorkforce, currentEfficiency: computed(() => efficiencyMetrics.value.saturation), netProduction, wareFlowList
  }
})