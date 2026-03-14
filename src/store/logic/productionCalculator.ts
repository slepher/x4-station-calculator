import type {
  SavedModule,
  StationSettings,
  X4Module,
  X4Ware,
  WareDetail,
  ProductionLogItem,
  RaceMedicalConsumption
} from '@/types/x4'

import {
  getDynamicPrice,
  calculateWorkforceCensus
} from './calculatorUtils'

/**
 * 核心利润与产出分析
 */
export function calculateProfitBreakdown(
  plannedModules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  actualWorkforce: number,
  saturation: number,
  medicalConsumption: RaceMedicalConsumption
) {
  const wareDetails: Record<string, WareDetail> = {};
  
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
      if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] };
      const actualAmount = hourlyAmount * item.count;
      wareDetails[wareId].consumption += actualAmount;
      wareDetails[wareId].list.push({
        moduleId: item.id, nameId: info.nameId, count: item.count, amount: -actualAmount,
        bonusPercent: 0, type: 'consumption'
      });
    }
  });

  // [修改] 第二阶段：动态工人消耗 (使用 Shared Census Logic)
  const censusItems = calculateWorkforceCensus(plannedModules, modulesMap, actualWorkforce);

  censusItems.forEach(item => {
    // 查表计算消耗
    const raceKey = item.race in medicalConsumption ? item.race : 'default';
    const raceConsumption = medicalConsumption[raceKey] || {};
    const wares = raceConsumption.wares || raceConsumption;

    for (const [wareId, perPersonPerSecond] of Object.entries(wares)) {
      if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] };
      
      const hourlyAmount = item.residents * (perPersonPerSecond as number) * 3600;
      
      wareDetails[wareId].consumption += hourlyAmount;
      wareDetails[wareId].list.push({
        moduleId: item.moduleId,
        nameId: item.nameId,
        count: item.count,
        amount: -hourlyAmount,
        bonusPercent: 0,
        label: `Worker Consumption (${Math.round(item.residents)} ppl)`,
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