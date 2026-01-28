import type { RawModuleData, X4Module, WareAmountMap } from '../types/x4';

/**
 * 将数值标准化为每小时 (3600秒)
 */
const toHourly = (amount: number, cycleTime: number): number => {
  return cycleTime > 0 ? (amount / cycleTime) * 3600 : 0;
};

const transformMapToHourly = (map: WareAmountMap, cycleTime: number): WareAmountMap => {
  const hourlyMap: WareAmountMap = {};
  for (const [wareId, amount] of Object.entries(map)) {
    hourlyMap[wareId] = Number(toHourly(amount, cycleTime).toFixed(2));
  }
  return hourlyMap;
};

/**
 * 核心转换器：注入默认值和计算字段
 */
export function transformModule(raw: RawModuleData): X4Module {
  const cycleTime = raw.production?.time || 1; // 防止除以0

  return {
    id: raw.id,
    // 契约：缺失类型默认为 other
    type: (raw.type as any) || 'other',
    // 契约：严禁 null/undefined，必须返回空对象
    buildCost: raw.buildCost || {},
    production: {
      wares: raw.production?.wares || {},
      resources: raw.production?.resources || {},
      time: cycleTime,
      hourlyWares: transformMapToHourly(raw.production?.wares || {}, cycleTime),
      hourlyResources: transformMapToHourly(raw.production?.resources || {}, cycleTime),
    },
    workforce: {
      capacity: raw.workforce?.capacity || 0,
      consumption: raw.workforce?.consumption || {},
    }
  };
}