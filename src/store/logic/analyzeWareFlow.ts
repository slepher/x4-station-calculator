import type {
  SavedModule,
  StationSettings,
  X4Module,
  X4Ware,
  WareFlow, // <--- 确保导入了正确的类型名
  RaceMedicalConsumption
} from '@/types/x4'

import {
  getDynamicPrice,
  calculateWorkforceCensus
} from './calculatorUtils'

// 扩展 X4Ware 类型以兼容 volume 字段 (假设数据源包含此字段，若无则默认为0)
type X4WareWithVolume = X4Ware & { volume?: number };

/**
 * 资源流向与仓储分析函数
 * 根据用户指定的 WareFlow 接口生成
 */
export function analyzeWareFlow(
  plannedModules: SavedModule[],
  plannedWareIds: string[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4WareWithVolume>,
  medicalConsumptionMap: RaceMedicalConsumption,
  settings: StationSettings,
  actualWorkforce: number,
  saturation: number,
  resourceBufferHours: number = 1.0, // 对应 consumptionBufferTime
  productBufferHours: number = 1.0   // 对应 transportBufferTime
): WareFlow[] {
  
  const flowMap: Record<string, WareFlow> = {};

  // 辅助：初始化 WareFlow 对象
  const getOrInitFlow = (wareId: string): WareFlow => {
    if (!flowMap[wareId]) {
      const ware = waresMap[wareId];
      flowMap[wareId] = {
        wareId: wareId,
        transportType: ware?.transport || 'container',
        unitVolume: ware?.volume || 0,
        
        // 数量流
        production: 0,
        consumption: 0,
        netRate: 0,

        // 体积流
        productionVolume: 0,
        consumptionVolume: 0,
        netVolume: 0,
        
        // 仓储规划
        totalOccupiedCount: 0,
        totalOccupiedConsumptionCount: 0,
        totalOccupiedVolume: 0,
        
        // 经济
        unitPrice: 0,
        netValue: 0,
        
        // 明细
        contributions: []
      };
    }
    return flowMap[wareId];
  };

  // ---------------------------------------------------------
  // 1. 遍历模块计算产出与消耗
  // ---------------------------------------------------------
  plannedModules.forEach(item => {
    const info = modulesMap[item.id];
    if (!info) return;

    // 计算当前模块效率
    const currentBonusRatio = saturation * (info.workforce?.maxBonus || 0);
    const moduleEff = 1.0 + currentBonusRatio;

    // --- A. 产出 (Outputs) ---
    for (const [wareId, hourlyAmount] of Object.entries(info.outputs)) {
      const entry = getOrInitFlow(wareId);
      
      // 光照影响 (仅能量电池)
      let sunlightFactor = 1.0;
      if (wareId === 'energycells') sunlightFactor = settings.sunlight / 100.0;
      
      const actualAmount = hourlyAmount * item.count * moduleEff * sunlightFactor;
      const volumeFlow = actualAmount * entry.unitVolume;
      const price = getDynamicPrice(wareId, false, waresMap, settings);
      const valueFlow = actualAmount * price;

      entry.production += actualAmount;
      entry.productionVolume += volumeFlow;

      entry.contributions.push({
        moduleId: item.id,
        count: item.count,
        type: 'production',
        amount: actualAmount,
        bonusPercent: Math.round(currentBonusRatio * 100),
        volumeFlow: volumeFlow,
        valueFlow: valueFlow
      });
    }

    // --- B. 消耗 (Inputs) ---
    for (const [wareId, hourlyAmount] of Object.entries(info.inputs)) {
      const entry = getOrInitFlow(wareId);

      const actualAmount = hourlyAmount * item.count; 
      const volumeFlow = actualAmount * entry.unitVolume;
      const price = getDynamicPrice(wareId, true, waresMap, settings);
      const valueFlow = actualAmount * price;

      entry.consumption += actualAmount;
      entry.consumptionVolume += volumeFlow;

      entry.contributions.push({
        moduleId: item.id,
        count: item.count,
        type: 'consumption',
        amount: -actualAmount, // 负数
        bonusPercent: 0,
        volumeFlow: -volumeFlow,
        valueFlow: -valueFlow
      });
    }
  });

  // ---------------------------------------------------------
  // 2. 计算劳动力消耗 (Workforce Consumption)
  // ---------------------------------------------------------
  const censusItems = calculateWorkforceCensus(plannedModules, modulesMap, actualWorkforce);
  
  censusItems.forEach(item => {
    const raceKey = item.race in medicalConsumptionMap ? item.race : 'default';
    const wares = medicalConsumptionMap[raceKey];

    if(!wares) return;

    for (const [wareId, perPersonPerSecond] of Object.entries(wares)) {
      const entry = getOrInitFlow(wareId);
      
      const hourlyAmount = item.residents * (perPersonPerSecond as number) * 3600;
      const volumeFlow = hourlyAmount * entry.unitVolume;
      const price = getDynamicPrice(wareId, true, waresMap, settings);
      const valueFlow = hourlyAmount * price;

      entry.consumption += hourlyAmount;
      entry.consumptionVolume += volumeFlow;

      entry.contributions.push({
        moduleId: item.moduleId,
        count: item.count,
        type: 'consumption',
        amount: -hourlyAmount,
        bonusPercent: 0,
        volumeFlow: -volumeFlow,
        valueFlow: -valueFlow
      });
    }
  });

  // ---------------------------------------------------------
  // 3. 汇总计算 (Net, Storage, Economy)
  // ---------------------------------------------------------
  return Object.values(flowMap).map(entry => {
    // A. 流量净值
    entry.netRate = entry.production - entry.consumption;
    entry.netVolume = entry.productionVolume - entry.consumptionVolume;

    // B. 经济计算
    const isSurplus = entry.netRate >= 0;
    const wareId = entry.wareId;
    entry.unitPrice = getDynamicPrice(wareId, !isSurplus, waresMap, settings);
    entry.netValue = entry.netRate * entry.unitPrice;

    // C. 仓储规划核心逻辑
    // 逻辑实现依据您的接口注释：
    // 1. 消耗缓冲 (Input Buffer) = consumption * consumptionBufferTime
    const consumptionBufferCount = entry.consumption * resourceBufferHours;
    
    // 2. 产出缓冲 (Output/Transport Buffer)
    // 通常仅当需要产品产物的时候
    const productionBufferCount = plannedWareIds.includes(wareId) && (entry.netRate > 0) ? entry.netRate * productBufferHours : 0;


    // 3. 填充结果
    entry.totalOccupiedConsumptionCount = consumptionBufferCount;
    
    // 总占用数量 = 消耗缓冲 + 产出缓冲
    entry.totalOccupiedCount = consumptionBufferCount + productionBufferCount;
    
    // 总占用体积 = 总占用数量 * 单体体积
    // 这等同于：(consumptionVolume * resourceBuffer) + (netVolume * productBuffer [if net>0])
    entry.totalOccupiedVolume = entry.totalOccupiedCount * entry.unitVolume;

    return entry;
  });
}