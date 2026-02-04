import type { X4Module, X4Ware } from '@/types/x4'
import { findBestProducer } from './bestModuleSelector'
import consumptionRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumption.json'

// --- 私有辅助函数：递归计算单单位物资的工人成本 ---

/**
 * 内部辅助函数：递归计算生产 1 单位特定物资所需的累计工人数
 * @param wareId 当前物资ID
 * @param raceKey 目标种族
 * @param modulesMap 模块数据
 * @param waresMap 物资数据
 * @param useEfficiency 是否计算生产效率加成 (补给区有工人时为 true)
 * @param cache 记忆化缓存
 * @param visited 递归防环集合
 */
function _getRecursiveWorkforceCost(
  wareId: string,
  raceKey: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  useEfficiency: boolean,
  cache: Map<string, number>,
  visited: Set<string>
): number {
  if (cache.has(wareId)) return cache.get(wareId)!;

  // 1. 寻找最佳生产者
  const module = findBestProducer(wareId, raceKey, [], modulesMap, waresMap);
  
  // 如果找不到模块，或者检测到循环依赖，则视为无成本
  if (!module || visited.has(wareId)) return 0;

  visited.add(wareId);

  // 2. 确定产出效率
  // 如果补给区有工人(useEfficiency=true)，则产出按满加成计算，这会降低单位成本
  const eff = useEfficiency ? (1 + (module.workforce?.maxBonus || 0)) : 1.0;

  // 3. 计算单产量归一化数据
  const baseOutput = module.outputs[wareId] || 1;
  const outputAmount = baseOutput * eff;
  const myWorkforce = module.workforce?.needed || 0;
  
  // 当前层级的工本 (人/单位)
  let totalWorkforce = myWorkforce / outputAmount;

  // 4. 递归累加所有原料的成本
  for (const [inputId, inputAmount] of Object.entries(module.inputs)) {
    const inputCost = _getRecursiveWorkforceCost(inputId, raceKey, modulesMap, waresMap, useEfficiency, cache, visited);
    // 原料工本 * (生产1单位产品需要的原料数量)
    // 注意：inputAmount 是单次循环消耗，outputAmount 是单次循环产出(含效率)
    totalWorkforce += inputCost * (inputAmount / outputAmount);
  }

  visited.delete(wareId);
  cache.set(wareId, totalWorkforce);
  return totalWorkforce;
}

// --- 导出函数 1：计算自维持系数与乘数 ---

/**
 * 计算种族自维持系数 (R) 和 生产乘数 (M)
 * @param useEfficiency 是否启用效率计算
 */
export function calculateSustainMultiplier(
  raceKey: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  useEfficiency: boolean
): { R: number, M: number } {
  const cache = new Map<string, number>();
  const visited = new Set<string>();

  // 获取种族消耗数据
  const raceData = (consumptionRaw as any)[raceKey] || (consumptionRaw as any)['default'];
  const consumptionRates = raceData?.wares || raceData || {};
  
  let R = 0;

  // 遍历该种族工人每小时吃的所有东西
  for (const [wareId, amountPerSec] of Object.entries(consumptionRates)) {
    const hourlyAmount = (amountPerSec as number) * 3600;
    // 计算生产这些东西背后需要多少人 (传入 efficiency 开关)
    const cost = _getRecursiveWorkforceCost(wareId, raceKey, modulesMap, waresMap, useEfficiency, cache, visited);
    R += cost * hourlyAmount;
  }

  // 安全阀：防止 R >= 1 导致除零或负数
  const safeR = Math.min(R, 0.99); 
  
  return { 
    R: safeR, 
    M: 1 / (1 - safeR) 
  };
}

// --- 导出函数 2：计算具体工厂需求 ---

/**
 * 计算指定工人的补给产线需求
 * @param targetWorkerCount 目标工人数
 * @param raceKey 种族
 * @param modulesMap 模块表
 * @param waresMap 物资表
 * @param supplyWorkforceBonus 补给区是否启用工人 (关键参数)
 */
export function calculateWorkerSupplyNeeds(
  targetWorkerCount: number,
  raceKey: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  supplyWorkforceBonus: boolean
): Record<string, number> {
  
  // 1. 快速预估：计算乘数 M
  // 如果补给区没有工人 (supplyWorkforceBonus = false)，则不需要递归乘数 (M=1)
  let M = 1.0;
  if (supplyWorkforceBonus) {
    const result = calculateSustainMultiplier(raceKey, modulesMap, waresMap, true);
    M = result.M;
  }

  let currentTotalWorkers = Math.ceil(targetWorkerCount * M);
  let finalModules: Record<string, number> = {};
  
  // 2. 收敛循环
  for (let iter = 0; iter < 5; iter++) {
    const tempModules: Record<string, number> = {};
    const productionState: Record<string, number> = {};
    
    // A. 初始化需求
    const raceData = (consumptionRaw as any)[raceKey] || (consumptionRaw as any)['default'];
    const consumptionRates = raceData?.wares || raceData || {};
    
    for (const [ware, amount] of Object.entries(consumptionRates)) {
      productionState[ware] = (productionState[ware] || 0) - (currentTotalWorkers * (amount as number) * 3600);
    }

    // B. 产业链求解
    let hasDeficit = true;
    let loopGuard = 0;
    
    while (hasDeficit && loopGuard < 20) {
      hasDeficit = false;
      loopGuard++;
      
      for (const [wareId, amount] of Object.entries(productionState)) {
        if (amount >= -0.001) continue;
        
        const deficit = Math.abs(amount);
        
        // 严格按照 raceKey 寻找工厂 (各算各的)
        const module = findBestProducer(wareId, raceKey, [], modulesMap, waresMap);
        if (!module) continue;

        // 核心逻辑：计算单工厂产出 (考虑效率)
        const baseOutput = module.outputs[wareId] || 0;
        if (baseOutput <= 0) continue;

        // 如果启用工人，享受效率加成；否则只按基础产能计算
        const eff = supplyWorkforceBonus ? (1 + (module.workforce?.maxBonus || 0)) : 1.0;
        const singleOutput = baseOutput * eff;

        const count = Math.ceil(deficit / singleOutput);
        
        tempModules[module.id] = (tempModules[module.id] || 0) + count;
        
        // 更新产出
        productionState[wareId] = (productionState[wareId] || 0) + count * singleOutput;
        
        // 产生原料缺口
        for (const [inputId, inputVal] of Object.entries(module.inputs)) {
          productionState[inputId] = (productionState[inputId] || 0) - (count * inputVal);
        }
        
        hasDeficit = true;
      }
    }

    // 如果补给区不配工人，就不存在"新增设施带来额外工人需求"的问题
    // 直接一次循环即可结束 (iter 0 就会 break)
    if (!supplyWorkforceBonus) {
      finalModules = tempModules;
      break;
    }

    // C. 检查收敛 (仅当有工人时)
    let calculatedSupplyWorkers = 0;
    for (const [modId, count] of Object.entries(tempModules)) {
      const m = modulesMap[modId];
      if (m?.workforce?.needed) {
        calculatedSupplyWorkers += m.workforce.needed * count;
      }
    }
    
    const newTotalWorkers = targetWorkerCount + calculatedSupplyWorkers;

    if (newTotalWorkers === currentTotalWorkers) {
      finalModules = tempModules;
      break;
    }
    
    currentTotalWorkers = newTotalWorkers;
    finalModules = tempModules;
  }

  return finalModules;
}