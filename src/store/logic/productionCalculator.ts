import type { 
  SavedModule, 
  StationSettings, 
  X4Module, 
  X4Ware, 
  WareDetail, 
  ProductionLogItem 
} from '@/types/x4'

import consumptionRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumption.json'

// --- 类型定义 ---
export interface PlannedModuleDisplay extends SavedModule {
  nameId: string
  cost: number
  buildCost: Record<string, number>
}

export interface ConstructionBreakdown {
  moduleList: PlannedModuleDisplay[]
  totalCost: number
  totalMaterials: Record<string, number>
}

/**
 * 计算建筑成本明细
 */
export function calculateConstructionBreakdown(
  plannedModules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): ConstructionBreakdown {
  let totalCost = 0
  const totalMaterials: Record<string, number> = {}
  const moduleList: PlannedModuleDisplay[] = plannedModules
    .map(item => {
      const info = modulesMap[item.id]
      if (!info) return null
      let itemTotalCost = 0
      for (const [matId, amountPerModule] of Object.entries(info.buildCost)) {
        const totalAmount = (amountPerModule as number) * item.count
        itemTotalCost += totalAmount * (waresMap[matId]?.price || 0)
        totalMaterials[matId] = (totalMaterials[matId] || 0) + totalAmount
      }
      totalCost += itemTotalCost
      return { ...item, nameId: info.nameId || info.id, cost: itemTotalCost, buildCost: info.buildCost }
    })
    .filter((item): item is PlannedModuleDisplay => item !== null)
  return { moduleList, totalCost, totalMaterials }
}

/**
 * 动态价格计算逻辑
 */
export function getDynamicPrice(
  wareId: string, 
  isInput: boolean, 
  waresMap: Record<string, X4Ware>, 
  settings: StationSettings
) {
  const ware = waresMap[wareId];
  if (!ware) return 0;
  const multiplier = isInput ? settings.buyMultiplier : settings.sellMultiplier;
  
  if (multiplier <= 0.5) {
    const t = multiplier * 2;
    return ware.minPrice + (ware.price - ware.minPrice) * t;
  } else {
    const t = (multiplier - 0.5) * 2;
    return ware.price + (ware.maxPrice - ware.price) * t;
  }
}

/**
 * 核心利润与产出分析
 */
export function calculateProfitBreakdown(
  plannedModules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  actualWorkforce: number,
  saturation: number
) {
  const wareDetails: Record<string, WareDetail> = {};
  
  // 预处理所有生活物资 ID 集合
  const lifeWareIds = new Set<string>();
  Object.values(consumptionRaw).forEach((raceData: any) => {
    Object.keys(raceData.wares || raceData).forEach(id => lifeWareIds.add(id));
  });

  // 第一阶段：模块产出与工业消耗
  plannedModules.forEach(item => {
    const info = modulesMap[item.id];
    if (!info) return;

    const currentBonusRatio = saturation * (info.workforce?.maxBonus || 0);
    const moduleEff = 1.0 + currentBonusRatio;

    // Outputs
    for (const [wareId, hourlyAmount] of Object.entries(info.outputs)) {
      if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] };
      
      let sunlightFactor = 1.0;
      if (wareId === 'energycells') {
        sunlightFactor = settings.sunlight / 100.0;
      }
      const actualAmount = hourlyAmount * item.count * moduleEff * sunlightFactor;
      wareDetails[wareId].production += actualAmount;
      wareDetails[wareId].list.push({
        moduleId: item.id, nameId: info.nameId, count: item.count, amount: actualAmount,
        bonusPercent: Math.round(currentBonusRatio * 100), type: 'production'
      });
    }

    // Inputs
    for (const [wareId, hourlyAmount] of Object.entries(info.inputs)) {
      if (lifeWareIds.has(wareId)) continue; // 跳过由工人驱动的物资
      if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] };
      const actualAmount = hourlyAmount * item.count;
      wareDetails[wareId].consumption += actualAmount;
      wareDetails[wareId].list.push({
        moduleId: item.id, nameId: info.nameId, count: item.count, amount: -actualAmount,
        bonusPercent: 0, type: 'consumption'
      });
    }
  });

  // 第二阶段：动态工人消耗
  let remainingWf = actualWorkforce;
  plannedModules.forEach(item => {
    const info = modulesMap[item.id];
    if (!info || !info.workforce || info.workforce.capacity <= 0 || remainingWf <= 0) return;

    const capacity = info.workforce.capacity * item.count;
    const residents = Math.min(remainingWf, capacity);
    remainingWf -= residents;

    const raceKey = info.race in consumptionRaw ? info.race : 'default';
    const raceConsumption = (consumptionRaw as any)[raceKey];
    const wares = raceConsumption.wares || raceConsumption;

    for (const [wareId, perPersonPerSecond] of Object.entries(wares)) {
      if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] };
      
      const hourlyAmount = residents * (perPersonPerSecond as number) * 3600;
      
      wareDetails[wareId].consumption += hourlyAmount;
      wareDetails[wareId].list.push({
        moduleId: item.id,
        nameId: info.nameId,
        count: item.count,
        amount: -hourlyAmount,
        bonusPercent: 0,
        label: `Worker Consumption (${Math.round(residents)} ppl)`,
        type: 'consumption'
      });
    }
  });

  // 第三阶段：轧差与财务计算
  const productionItems: Record<string, { amount: number, value: number }> = {};
  const expenseItems: Record<string, { amount: number, value: number }> = {};
  let totalRevenue = 0;
  let totalExpense = 0;

  for (const [wareId, data] of Object.entries(wareDetails)) {
    const net = data.production - data.consumption;
    if (Math.abs(net) < 0.001) continue;
    
    if (net > 0) {
      const price = getDynamicPrice(wareId, false, waresMap, settings);
      const val = net * price;
      productionItems[wareId] = { amount: net, value: val };
      totalRevenue += val;
    } else {
      const absAmount = Math.abs(net);
      const ware = waresMap[wareId];
      const isMined = ware?.transport === 'solid' || ware?.transport === 'liquid';
      
      let price = getDynamicPrice(wareId, true, waresMap, settings);
      if (settings.internalSupply) price = 0;
      else if (settings.minersEnabled && isMined) price = 0;
      
      const val = absAmount * price;
      expenseItems[wareId] = { amount: absAmount, value: val };
      totalExpense += val;
    }
  }

  return { 
    wareDetails, totalRevenue, totalExpense, profit: totalRevenue - totalExpense,
    production: { total: totalRevenue, items: productionItems },
    expenses: { total: totalExpense, items: expenseItems }
  };
}

/**
 * 净产量计算
 */
export function calculateNetProduction(wareDetails: Record<string, WareDetail>) {
  const net: Record<string, { total: number, details: ProductionLogItem[] }> = {};
  for (const [wareId, data] of Object.entries(wareDetails)) {
    const diff = data.production - data.consumption;
    if (Math.abs(diff) > 0.001) {
      net[wareId] = { total: diff, details: data.list };
    }
  }
  return net;
}

/**
 * 生成自动补货建议列表
 */
export function calculateAutoFillSuggestions(
  netProduction: Record<string, { total: number }>,
  modulesMap: Record<string, X4Module>,
  settings: StationSettings,
  saturation: number
): Array<{ moduleId: string, count: number }> {
  const suggestions: Array<{ moduleId: string, count: number }> = [];

  Object.entries(netProduction).forEach(([wareId, data]) => {
    if (data.total < -0.001) {
      const deficit = Math.abs(data.total);
      // 寻找产出该资源的第一个模块（排除居住模块）
      const targetModule = Object.values(modulesMap).find(m => m.outputs[wareId] && m.type !== 'habitat');
      
      if (targetModule) {
        let eff = 1.0;
        if (settings.considerWorkforceForAutoFill) {
          eff = 1.0 + (saturation * (targetModule.workforce?.maxBonus || 0));
        }
        
        const singleModuleOutput = (targetModule.outputs[wareId] || 0) * eff;
        if (singleModuleOutput > 0) {
          const count = Math.ceil(deficit / singleModuleOutput);
          suggestions.push({ moduleId: targetModule.id, count });
        }
      }
    }
  });

  return suggestions;
}