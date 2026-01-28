import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { demoSaveData, type SavedModule } from '@/mock/mock_data'
import type { X4Module, X4Ware, WareAmountMap } from '../types/x4'

// 1. 静态导入游戏数据
import waresRaw from '@/assets/game_data/Timelines (7.10)/data/wares.json'
import ModulesRaw from '@/assets/game_data/Timelines (7.10)/data/modules.json'

export interface PlannedModuleDisplay extends SavedModule {
  nameId: string;    
  cost: number;      
  buildCost: WareAmountMap; 
}

export const useStationStore = defineStore('station', () => {
  
  const plannedModules = ref<SavedModule[]>([])

  const settings = ref({
    useHQ: false,           
    actualWorkforce: 0,      // 【新增】实际人口数值，作为产量计算的唯一标准
    workforcePercent: 100,  
    workforceAuto: true,    
    priceMultiplier: 0.5    // 0:min, 0.5:avg, 1:max
  })

  // ----------------------------------------------------------------
  // Computed Maps (保持不变)
  // ----------------------------------------------------------------

  const waresMap = computed(() => {
    const map: Record<string, X4Ware> = {}
    const raw = waresRaw as any[]
    raw.forEach(w => {
      map[w.id] = { ...w, price: w.price || 0, minPrice: w.minPrice || 0, maxPrice: w.maxPrice || 0 }
    })
    return map
  })

  const modulesMap = computed(() => {
    const map: Record<string, X4Module> = {}
    ModulesRaw.forEach(m => {
      map[m.id] = {
        ...m,
        buildCost: m.buildCost || {},
        outputs: m.outputs || {},
        inputs: m.inputs || {},
        cycleTime: m.cycleTime || 0,
        workforce: {
          capacity: m.workforce?.capacity || 0,
          needed: m.workforce?.needed || 0,
          maxBonus: m.workforce?.maxBonus || 0
        }
      } as X4Module
    })
    return map
  })

  // ----------------------------------------------------------------
  // Actions (保持不变)
  // ----------------------------------------------------------------

  function loadDemoData() {
    const validData = demoSaveData.filter(item => modulesMap.value[item.id])
    plannedModules.value = JSON.parse(JSON.stringify(validData))
  }

  function addModule(id: string, count = 1) {
    if (!modulesMap.value[id]) return
    const existing = plannedModules.value.find(m => m.id === id)
    if (existing) { existing.count += count } 
    else { plannedModules.value.push({ id, count }) }
  }

  function updateModuleCount(id: string, count: number) {
    const existing = plannedModules.value.find(m => m.id === id)
    if (existing) {
      if (count <= 0) { removeModuleById(id) } 
      else { existing.count = count }
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

  function clearAll() { plannedModules.value = [] }

  function getModuleInfo(id: string): X4Module {
    return modulesMap.value[id] || {
      id, wareId: '', nameId: id, type: 'unknown', race: 'unknown', buildTime: 0,
      buildCost: {}, cycleTime: 0, outputs: {}, inputs: {},
      workforce: { capacity: 0, needed: 0, maxBonus: 0 }
    } as X4Module
  }

  // ----------------------------------------------------------------
  // Getters
  // ----------------------------------------------------------------

  function getDynamicPrice(wareId: string) {
    const ware = waresMap.value[wareId]
    if (!ware) return 0
    if (settings.value.priceMultiplier <= 0.5) {
      const t = settings.value.priceMultiplier * 2
      return ware.minPrice + (ware.price - ware.minPrice) * t
    } else {
      const t = (settings.value.priceMultiplier - 0.5) * 2
      return ware.price + (ware.maxPrice - ware.price) * t
    }
  }

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

  const workforceBreakdown = computed(() => {
    let neededTotal = 0
    let capacityTotal = 0
    const neededList: any[] = []
    const capacityList: any[] = []

    if (settings.value.useHQ) {
      neededTotal += 200
      neededList.push({ id: 'player_hq', nameId: '{20102,2011}', count: 1, value: 200 })
    }

    plannedModules.value.forEach(item => {
      const info = modulesMap.value[item.id]
      if (!info) return
      if (info.workforce.needed > 0) {
        const val = info.workforce.needed * item.count
        neededTotal += val
        neededList.push({ id: item.id, nameId: info.nameId, count: item.count, value: val })
      }
      if (info.workforce.capacity > 0) {
        const val = info.workforce.capacity * item.count
        capacityTotal += val
        capacityList.push({ id: item.id, nameId: info.nameId, count: item.count, value: val })
      }
    })

    return {
      needed: { total: neededTotal, list: neededList },
      capacity: { total: capacityTotal, list: capacityList },
      diff: capacityTotal - neededTotal
    }
  })

  /**
   * 【核心改动】效率指标计算
   * 饱和度现在基于 settings.actualWorkforce 计算，范围为 0.0 到 1.0
   * 组件层负责确保 actualWorkforce 不超过 needed.total
   */
  const efficiencyMetrics = computed(() => {
    const wf = workforceBreakdown.value
    if (wf.needed.total === 0) return { saturation: 0 }
    
    const actual = settings.value.actualWorkforce || 0
    return {
      saturation: actual / wf.needed.total // 实际人口占需求人口的比例
    }
  })
  
  const profitBreakdown = computed(() => {
    const production: Record<string, number> = {}  
    const consumption: Record<string, number> = {} 
    
    // 核心：从效率指标中获取基于 actualWorkforce 的饱和度
    const { saturation } = efficiencyMetrics.value 

    let totalRevenue = 0
    let totalExpense = 0

    plannedModules.value.forEach(item => {
      const info = modulesMap.value[item.id]
      if (!info) return

      /**
       * 计算实际加成后的产量：
       * 实际效率 = 基础(1.0) + (当前饱和度 * 该模块最大加成率)
       */
      const moduleEff = 1.0 + (saturation * (info.workforce?.maxBonus || 0))

      // 产出部分：应用效率加成
      for (const [wareId, hourlyAmount] of Object.entries(info.outputs)) {
        const actualAmount = hourlyAmount * item.count * moduleEff // 增加产出逻辑
        const price = getDynamicPrice(wareId)
        production[wareId] = (production[wareId] || 0) + actualAmount
        totalRevenue += actualAmount * price
      }

      // 消耗部分：不受工人影响 (保持原样)
      for (const [wareId, hourlyAmount] of Object.entries(info.inputs)) {
        const actualAmount = hourlyAmount * item.count
        const price = getDynamicPrice(wareId)
        consumption[wareId] = (consumption[wareId] || 0) + actualAmount
        totalExpense += actualAmount * price
      }
    })

    return {
      production: { total: totalRevenue, items: production },
      expenses: { total: totalExpense, items: consumption },
      profit: totalRevenue - totalExpense
    }
  })
  
  const netProduction = computed(() => {
    const net: Record<string, number> = {}
    const { production, expenses } = profitBreakdown.value
    const allIds = new Set([...Object.keys(production.items), ...Object.keys(expenses.items)])
    allIds.forEach(id => {
      const diff = (production.items[id] || 0) - (expenses.items[id] || 0)
      if (Math.abs(diff) > 0.001) net[id] = diff
    })
    return net
  })

  return {
    plannedModules, settings,
    wares: waresMap, modules: modulesMap,
    loadDemoData, addModule, updateModuleCount, removeModule, removeModuleById, clearAll, getModuleInfo,
    constructionBreakdown, workforceBreakdown, profitBreakdown,
    currentEfficiency: computed(() => efficiencyMetrics.value.saturation),
    netProduction
  }
})