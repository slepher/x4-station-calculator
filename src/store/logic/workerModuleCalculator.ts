import type { X4Module, X4Ware } from '@/types/x4'
import consumptionRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumption.json'

// --- 私有辅助函数：递归计算单单位物资的工人成本 ---

/**
 * 内部辅助函数：递归计算生产 1 单位特定物资所需的累计工人数
 * @param wareId 当前物资ID
 * @param modulesMap 模块数据
 * @param waresMap 物资数据
 * @param cache 记忆化缓存
 * @param visited 递归防环集合
 */
function _getRecursiveWorkforceCost(
  wareId: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  cache: Map<string, number>,
  visited: Set<string>
): number {
  if (cache.has(wareId)) return cache.get(wareId)!;

  // 1. 基础情况：矿物 (Solid/Liquid) 或无工厂产品视为无制造人工成本
  const isMined = waresMap[wareId]?.transport === 'solid' || waresMap[wareId]?.transport === 'liquid';
  if (isMined) return 0;

  // 2. 寻找生产者：取第一个能产出该物资的非居住模块
  const module = Object.values(modulesMap).find(m => m.outputs[wareId] && m.type !== 'habitat');
  
  // 如果找不到模块，或者检测到循环依赖，则视为无成本
  if (!module || visited.has(wareId)) return 0;

  visited.add(wareId);

  // 3. 计算单产量归一化数据
  const outputAmount = module.outputs[wareId] || 1;
  const myWorkforce = module.workforce?.needed || 0;
  
  // 当前层级的工本 (人/单位)
  let totalWorkforce = myWorkforce / outputAmount;

  // 4. 递归累加所有原料的成本
  for (const [inputId, inputAmount] of Object.entries(module.inputs)) {
    const inputCost = _getRecursiveWorkforceCost(inputId, modulesMap, waresMap, cache, visited);
    // 原料工本 * (生产1单位产品需要的原料数量)
    totalWorkforce += inputCost * (inputAmount / outputAmount);
  }

  visited.delete(wareId);
  cache.set(wareId, totalWorkforce);
  return totalWorkforce;
}

// --- 导出函数 1：计算自维持系数与乘数 ---

/**
 * 计算种族自维持系数 (R) 和 生产乘数 (M)
 * R: 维持1个工人所需的所有上游潜在工人数 (0 < R < 1)
 * M: 最终人口乘数 (M = 1 / (1 - R))，用于快速预估总人口
 */
export function calculateSustainMultiplier(
  raceKey: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
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
    // 计算生产这些东西背后需要多少人
    const cost = _getRecursiveWorkforceCost(wareId, modulesMap, waresMap, cache, visited);
    R += cost * hourlyAmount;
  }

  // 安全阀：防止 R >= 1 导致除零或负数 (意味着体系无法自维持)
  // X4 正常数值通常在 0.1 ~ 0.3 之间
  const safeR = Math.min(R, 0.99); 
  
  return { 
    R: safeR, 
    M: 1 / (1 - safeR) 
  };
}

// --- 导出函数 2：计算具体工厂需求 ---

/**
 * 计算指定工人的生活物资及对应产业链需求
 * 逻辑：使用乘数法进行初值预估 -> 整数化模拟 -> 循环修正误差
 * @param targetWorkerCount 目标工人数 (例如：你的工业区需要 1000 人)
 * @param raceKey 种族 (argon, teladi 等)
 * @param modulesMap 模块表
 * @param waresMap 物资表
 */
export function calculateWorkerSupplyNeeds(
  targetWorkerCount: number,
  raceKey: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): Record<string, number> {
  
  // 1. 快速预估：使用乘数 M 计算理论上的总工人数 (包含后勤人员)
  // 这极大地减少了后续循环的迭代次数
  const { M } = calculateSustainMultiplier(raceKey, modulesMap, waresMap);
  let currentTotalWorkers = Math.ceil(targetWorkerCount * M);
  
  let finalModules: Record<string, number> = {};
  
  // 2. 收敛循环：解决 "工厂必须造整数个" 带来的阶梯效应
  // 由于起点 currentTotalWorkers 已经非常精准，通常只需要 1-2 次循环
  for (let iter = 0; iter < 5; iter++) {
    const tempModules: Record<string, number> = {};
    const productionState: Record<string, number> = {}; // 记录资源盈亏 (负数为缺口)
    
    // A. 初始化需求：基于当前的预计总工人数，计算生活物资消耗
    const raceData = (consumptionRaw as any)[raceKey] || (consumptionRaw as any)['default'];
    const consumptionRates = raceData?.wares || raceData || {};
    
    for (const [ware, amount] of Object.entries(consumptionRates)) {
      // 需求 = 总人数 * 单人消耗 * 3600秒
      productionState[ware] = (productionState[ware] || 0) - (currentTotalWorkers * (amount as number) * 3600);
    }

    // B. 产业链求解 (整数化)
    // 这是一个微型的 while 循环，用于填平所有因生活物资产生的工业缺口
    let hasDeficit = true;
    let loopGuard = 0;
    
    while (hasDeficit && loopGuard < 20) {
      hasDeficit = false;
      loopGuard++;
      
      // 扫描当前所有缺口
      for (const [wareId, amount] of Object.entries(productionState)) {
        if (amount >= -0.001) continue; // 无缺口
        
        const deficit = Math.abs(amount);
        
        // 寻找工厂 (排除居住舱)
        const module = Object.values(modulesMap).find(m => m.outputs[wareId] && m.type !== 'habitat');
        const isMined = waresMap[wareId]?.transport === 'solid' || waresMap[wareId]?.transport === 'liquid';
        
        // 如果无法制造或是矿物，则跳过
        if (!module || isMined) continue;

        // 核心逻辑：向上取整计算工厂数
        const singleOutput = module.outputs[wareId] || 0;
        if (singleOutput <= 0) continue;

        const count = Math.ceil(deficit / singleOutput);
        
        // 记录建议添加的模块
        tempModules[module.id] = (tempModules[module.id] || 0) + count;
        
        // 更新产出 (消除当前缺口)
        productionState[wareId] = (productionState[wareId] || 0) + count * singleOutput;
        
        // 产生新的原料缺口 (递归产生需求)
        for (const [inputId, inputVal] of Object.entries(module.inputs)) {
          productionState[inputId] = (productionState[inputId] || 0) - (count * inputVal);
        }
        
        hasDeficit = true; // 状态发生改变，需再次扫描以解决新产生的原料缺口
      }
    }

    // C. 检查收敛：计算这套设施实际支撑的工人数
    // 实际总工人数 = 目标工人 + 新增设施带来的额外工人需求
    let calculatedSupplyWorkers = 0;
    for (const [modId, count] of Object.entries(tempModules)) {
      const m = modulesMap[modId];
      if (m?.workforce?.needed) {
        calculatedSupplyWorkers += m.workforce.needed * count;
      }
    }
    
    const newTotalWorkers = targetWorkerCount + calculatedSupplyWorkers;

    // 如果新计算出的总人数与本轮预设的人数一致，说明已完美收敛
    if (newTotalWorkers === currentTotalWorkers) {
      finalModules = tempModules;
      break;
    }
    
    // 未收敛，更新总人数进行下一轮
    // 下一轮会基于这个更大的人数，算出更多的食物需求，进而可能多造一个工厂
    currentTotalWorkers = newTotalWorkers;
    finalModules = tempModules; // 保存当前结果作为备选
  }

  return finalModules;
}