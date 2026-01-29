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
    manualWorkforce: 0,      
    workforcePercent: 100,  
    workforceAuto: true,    
    buyMultiplier: 0.5,      // 对应 Resources Price
    sellMultiplier: 0.5,     // 对应 Products Price
    minersEnabled: false,    // 对应 Miners provide basic resources
    internalSupply: false    // 对应 Resources are provided by other stations
  })

  // ----------------------------------------------------------------
  // Computed Maps
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
  // Actions
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

  function updateModuleCount(index: number, count: number) {
      if (index >= 0 && index < plannedModules.value.length) {
        const module = plannedModules.value[index];
        if(module) module.count = count;
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

  function getDynamicPrice(wareId: string, isInput = false) {
    const ware = waresMap.value[wareId]
    if (!ware) return 0
    
    const multiplier = isInput ? settings.value.buyMultiplier : settings.value.sellMultiplier
    
    if (multiplier <= 0.5) {
      const t = multiplier * 2
      return ware.minPrice + (ware.price - ware.minPrice) * t
    } else {
      const t = (multiplier - 0.5) * 2
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

  const actualWorkforce = computed(() => {
     const wf = workforceBreakdown.value
     const maxCapacity = wf.capacity.total
     if (settings.value.workforceAuto) {
       return Math.min(wf.needed.total, maxCapacity)
     }
     return Math.max(0, Math.min(settings.value.manualWorkforce, maxCapacity))
   })
 
   const efficiencyMetrics = computed(() => {
     const wf = workforceBreakdown.value
     if (wf.needed.total === 0) return { saturation: 0 }
     return { saturation: Math.min(1.0, actualWorkforce.value / wf.needed.total) }
   })
  
  const profitBreakdown = computed(() => {
    const wareDetails: Record<string, { production: number, consumption: number, list: any[] }> = {}
    const { saturation } = efficiencyMetrics.value

    plannedModules.value.forEach(item => {
      const info = modulesMap.value[item.id]
      if (!info) return

      const currentBonusRatio = saturation * (info.workforce?.maxBonus || 0)
      const moduleEff = 1.0 + currentBonusRatio

      for (const [wareId, hourlyAmount] of Object.entries(info.outputs)) {
        if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] }
        const actualAmount = hourlyAmount * item.count * moduleEff
        wareDetails[wareId].production += actualAmount
        wareDetails[wareId].list.push({
          moduleId: item.id, nameId: info.nameId, count: item.count, amount: actualAmount,
          bonusPercent: Math.round(currentBonusRatio * 100), type: 'production'
        })
      }

      for (const [wareId, hourlyAmount] of Object.entries(info.inputs)) {
        if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] }
        const actualAmount = hourlyAmount * item.count
        wareDetails[wareId].consumption += actualAmount
        wareDetails[wareId].list.push({
          moduleId: item.id, nameId: info.nameId, count: item.count, amount: -actualAmount,
          bonusPercent: 0, type: 'consumption'
        })
      }
    })

    const productionItems: Record<string, { amount: number, value: number }> = {}
    const expenseItems: Record<string, { amount: number, value: number }> = {}
    let totalRevenue = 0, totalExpense = 0

    // 第二阶段：轧差法核心逻辑
    for (const [wareId, data] of Object.entries(wareDetails)) {
      const net = data.production - data.consumption
      if (Math.abs(net) < 0.001) continue

      if (net > 0) {
        // 净产出 > 0: 计入收入
        const price = getDynamicPrice(wareId, false)
        const val = net * price
        productionItems[wareId] = { amount: net, value: val }
        totalRevenue += val
      } else {
        // 净产出 < 0: 计入支出
        const absAmount = Math.abs(net)
        const ware = waresMap.value[wareId]
        const isMined = ware?.transport === 'solid' || ware?.transport === 'liquid'
        
        let price = getDynamicPrice(wareId, true)
        if (settings.value.internalSupply) price = 0
        else if (settings.value.minersEnabled && isMined) price = 0
        
        const val = absAmount * price
        expenseItems[wareId] = { amount: absAmount, value: val }
        totalExpense += val
      }
    }

    return { 
      wareDetails, totalRevenue, totalExpense, profit: totalRevenue - totalExpense,
      production: { total: totalRevenue, items: productionItems },
      expenses: { total: totalExpense, items: expenseItems }
    }
  })
  
  const netProduction = computed(() => {
    const net: Record<string, { total: number, details: any[] }> = {}
    const { wareDetails } = profitBreakdown.value
    
    for (const [wareId, data] of Object.entries(wareDetails)) {
      const diff = data.production - data.consumption
      if (Math.abs(diff) > 0.001) {
        net[wareId] = { total: diff, details: data.list }
      }
    }
    return net
  })

  return {
    plannedModules, settings,
    wares: waresMap, modules: modulesMap,
    loadDemoData, addModule, updateModuleCount, removeModule, removeModuleById, clearAll, getModuleInfo,
    constructionBreakdown, workforceBreakdown, profitBreakdown,
    actualWorkforce, 
    currentEfficiency: computed(() => efficiencyMetrics.value.saturation),
    netProduction
  }
})