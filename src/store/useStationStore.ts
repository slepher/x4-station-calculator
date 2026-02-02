import type { Ref } from 'vue'
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { mockStationData } from '@/mock/mock_data_v1'
import type {
  X4Module,
  X4Ware,
  SavedModule,
  StationSettings
} from '../types/x4'
import { useGameData, type LocalizedX4Module, type LocalizedX4ModuleGroup } from './logic/useGameData'
import { calculateWorkforceBreakdown, calculateActualWorkforce, calculateEfficiencySaturation } from './logic/workforceCalculator'
import { calculateProfitBreakdown, calculateNetProduction, calculateAutoFillSuggestions } from './logic/productionCalculator'
import { generateFilteredModulesGrouped } from './logic/searchModule'
import { 
  parseXmlBlueprint, 
  isXmlFormat, 
  parseGameComLink, 
  resolveModuleId 
} from './logic/blueprintParser'

// --- 类型定义 (Type Definitions) ---
export type { SavedModule } from '../types/x4'
export type { LocalizedX4ModuleGroup, LocalizedX4Module } from './logic/useGameData'

export interface StationLayout {
  id: string;
  name: string;
  modules: SavedModule[];
  settings: StationSettings;
  lastUpdated: number;
}

export interface SavedLayoutsState {
  version: number;
  activeId: string | null;
  list: StationLayout[];
}

export interface PlannedModuleDisplay extends SavedModule {
  nameId: string;    
  cost: number;      
  buildCost: Record<string, number>; 
}

export interface GroupedModuleItem extends LocalizedX4Module {
  displayLabel: string;
  moduleGroup?: LocalizedX4ModuleGroup;
}

export interface ModuleGroupResult {
  group: string;
  displayLabel: string;
  modules: GroupedModuleItem[];
}

export const useStationStore = defineStore('station', () => {
  // --- 数据管理层 ---
  const gameData = useGameData()

  // --- 状态 (State) ---
  const isReady = ref(false)
  const plannedModules = ref<SavedModule[]>([])
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
    buyMultiplier: 0.5,      
    sellMultiplier: 0.5,     
    minersEnabled: false,    
    internalSupply: false
  })

  // --- 基础数据映射 (Ref 类型，需要用 .value 访问) ---
  const waresMap: Ref<Record<string, X4Ware>> = gameData.waresMap
  const modulesMap: Ref<Record<string, X4Module>> = gameData.modulesMap
  const localizedModulesMap: Ref<Record<string, LocalizedX4Module>> = gameData.localizedModulesMap
  const localizedModuleGroupsMap: Ref<Record<string, LocalizedX4ModuleGroup>> = gameData.localizedModuleGroupsMap

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
      }
    }
    takeSnapshot()
  }

  function takeSnapshot() {
    lastSavedSnapshot.value = JSON.stringify({
      modules: plannedModules.value,
      settings: settings.value
    })
  }

  function loadDemoData() {
    loadData(mockStationData as unknown as SavedLayoutsState)
  }

  function saveCurrentLayout(name: string) {
    const layoutData: StationLayout = {
      id: savedLayouts.value.activeId || crypto.randomUUID(),
      name,
      modules: JSON.parse(JSON.stringify(plannedModules.value)),
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
    const current = JSON.stringify({
      modules: plannedModules.value,
      settings: settings.value
    })
    return current !== lastSavedSnapshot.value
  })

  function loadLayout(index: number) {
    const layout = savedLayouts.value.list[index]
    if (layout) {
      plannedModules.value = JSON.parse(JSON.stringify(layout.modules))
      settings.value = JSON.parse(JSON.stringify(layout.settings))
      savedLayouts.value.activeId = layout.id
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

  function clearAll() { 
    plannedModules.value = []
    savedLayouts.value.activeId = null
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
    let totalCost = 0
    const totalMaterials: Record<string, number> = {}
    const moduleList: PlannedModuleDisplay[] = plannedModules.value.map(item => {
      const info = modulesMap.value[item.id]
      if (!info) return null
      let itemTotalCost = 0
      for (const [matId, amountPerModule] of Object.entries(info.buildCost)) {
        const totalAmount = amountPerModule * item.count
        itemTotalCost += totalAmount * (waresMap.value[matId]?.price || 0)
        totalMaterials[matId] = (totalMaterials[matId] || 0) + totalAmount
      }
      totalCost += itemTotalCost
      return { ...item, nameId: info.nameId || info.id, cost: itemTotalCost, buildCost: info.buildCost }
    }).filter((item): item is PlannedModuleDisplay => item !== null)
    return { moduleList, totalCost, totalMaterials }
  })

  const workforceBreakdown = computed(() => 
    calculateWorkforceBreakdown(plannedModules.value, modulesMap.value, settings.value)
  )

  const actualWorkforce = computed(() => 
    calculateActualWorkforce(workforceBreakdown.value, settings.value)
  )

  const efficiencyMetrics = computed(() => ({
    saturation: calculateEfficiencySaturation(workforceBreakdown.value.needed.total, actualWorkforce.value)
  }))
  
  const profitBreakdown = computed(() => {
    return calculateProfitBreakdown(
      plannedModules.value,
      modulesMap.value,
      waresMap.value,
      settings.value,
      actualWorkforce.value,
      efficiencyMetrics.value.saturation
    )
  })
  
  const netProduction = computed(() => 
    calculateNetProduction(profitBreakdown.value.wareDetails)
  )

  function autoFillMissingLines() {
    const suggestions = calculateAutoFillSuggestions(
      netProduction.value,
      modulesMap.value,
      settings.value,
      efficiencyMetrics.value.saturation
    )
    suggestions.forEach(suggestion => {
      addModule(suggestion.moduleId, suggestion.count)
    })
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
    plannedModules, settings, searchQuery, filteredModulesGrouped,
    wares: waresMap, modules: localizedModulesMap, moduleGroups: localizedModuleGroupsMap,
    loadData, loadDemoData, savedLayouts, saveCurrentLayout, loadLayout, mergeLayout, deleteLayout,
    addModule, importPlan, updateModuleId, updateModuleCount, removeModule, removeModuleById, clearAll, getModuleInfo,
    constructionBreakdown, workforceBreakdown, profitBreakdown, autoFillMissingLines,
    actualWorkforce, currentEfficiency: computed(() => efficiencyMetrics.value.saturation), netProduction
  }
})