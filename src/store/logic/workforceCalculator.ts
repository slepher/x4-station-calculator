import type { SavedModule, StationSettings, WorkforceItem, X4Module } from '@/types/x4';

/**
 * 计算空间站的人口细分数据
 */
export function calculateWorkforceBreakdown(
  plannedModules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  settings: StationSettings
) {
  let neededTotal = 0;
  let capacityTotal = 0;
  const neededList: WorkforceItem[] = [];
  const capacityList: WorkforceItem[] = [];

  // 处理玩家总部特权
  if (settings.useHQ) {
    neededTotal += 200;
    neededList.push({ id: 'player_hq', nameId: '{20102,2011}', count: 1, value: 200 });
  }

  // 遍历规划模块
  plannedModules.forEach(item => {
    const info = modulesMap[item.id];
    if (!info) return;

    if (info.workforce.needed > 0) {
      const val = info.workforce.needed * item.count;
      neededTotal += val;
      neededList.push({ id: item.id, nameId: info.nameId, count: item.count, value: val });
    }
    if (info.workforce.capacity > 0) {
      const val = info.workforce.capacity * item.count;
      capacityTotal += val;
      capacityList.push({ id: item.id, nameId: info.nameId, count: item.count, value: val });
    }
  });

  return {
    needed: { total: neededTotal, list: neededList },
    capacity: { total: capacityTotal, list: capacityList },
    diff: capacityTotal - neededTotal
  };
}

/**
 * 计算当前实际人口数量
 */
export function calculateActualWorkforce(
  breakdown: { needed: { total: number }; capacity: { total: number } },
  settings: StationSettings
) {
  const maxCapacity = breakdown.capacity.total;
  if (settings.workforceAuto) {
    return Math.min(breakdown.needed.total, maxCapacity);
  }
  return Math.max(0, Math.min(settings.manualWorkforce, maxCapacity));
}

/**
 * 计算生产效率饱和度 (0.0 - 1.0)
 */
export function calculateEfficiencySaturation(
  neededTotal: number,
  actualWorkforce: number
) {
  if (neededTotal === 0) return 1.0;
  return Math.min(1.0, actualWorkforce / neededTotal);
}