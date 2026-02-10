import type { 
  SavedModule, 
  StationSettings, 
  X4Module, 
  X4Ware,
  WorkforceCensusItem
} from '../../types/x4'

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
 * 根据价格系数计算实际价格 (0-1)
 */
export function getPriceByMultiplier(ware: X4Ware, multiplier: number): number {
  if (multiplier <= 0.5) {
    const t = multiplier * 2;
    return ware.minPrice + (ware.price - ware.minPrice) * t;
  } else {
    const t = (multiplier - 0.5) * 2;
    return ware.price + (ware.maxPrice - ware.price) * t;
  }
}

/**
 * 动态价格计算逻辑 (基于 settings)
 */
export function getDynamicPrice(
  wareId: string, 
  isInput: boolean, 
  waresMap: Record<string, X4Ware>, 
  settings: StationSettings
): number {
  const ware = waresMap[wareId];
  if (!ware) return 0;
  const multiplier = isInput ? settings.buyMultiplier : settings.sellMultiplier;
  return getPriceByMultiplier(ware, multiplier);
}

/**
 * 独立导出的人口普查函数 (Shared Logic)
 * 职责：仅负责计算 "谁住在哪里"，不涉及物资计算
 */
// [新增] 独立导出的人口普查函数 (Shared Logic)
// 职责：仅负责计算 "谁住在哪里"，不涉及物资计算
export function calculateWorkforceCensus(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  availableWorkforce: number
): WorkforceCensusItem[] {
  const result: WorkforceCensusItem[] = [];
  let remainingWf = availableWorkforce;

  modules.forEach(item => {
    const info = modulesMap[item.id];
    // 检查是否为有效居住舱
    if (!info || !info.workforce || info.workforce.capacity <= 0 || remainingWf <= 0) return;

    const capacity = info.workforce.capacity * item.count;
    const residents = Math.min(remainingWf, capacity);
    const count = Math.ceil(residents / info.workforce.capacity);
    remainingWf -= residents;

    if (residents <= 0) return;

    result.push({
      moduleId: item.id,
      nameId: info.nameId || info.id,
      residents: residents,
      count: count,
      race: info.race || 'default'
    });
  });
  return result;
}