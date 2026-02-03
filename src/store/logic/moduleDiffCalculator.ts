import type { SavedModule, X4Module, X4Ware } from '@/types/x4'
import { calculateWorkerSupplyNeeds } from './workerModuleCalculator'

// --- 核心通用选择器 ---

/**
 * 通用模块选择器
 * 逻辑: 来源池锁定(Pool Priority) -> 种族正交筛选(Race Filter) -> 权重排序(Sorter)
 */
function _selectBestModule(
  existingCandidates: X4Module[],
  databaseCandidates: X4Module[],
  targetRace: string,
  sortFn: (a: X4Module, b: X4Module) => number
): X4Module | undefined {
  
  // 1. 维度一：来源池选择 (Pool Selection)
  // 如果现有池里有东西，死锁在现有池；否则使用数据库池
  let activePool = existingCandidates;
  if (existingCandidates.length === 0) {
    if (databaseCandidates.length === 0) return undefined;
    activePool = databaseCandidates;
  }

  // 2. 维度二：种族偏好筛选 (Race Filter)
  let matches = activePool.filter(m => m.race === targetRace);
  
  // 兜底：如果种族匹配落空，回退到当前池子的所有候选者
  if (matches.length === 0) {
    matches = activePool;
  }

  // 3. 最终决断：权重排序 (Sorting)
  matches.sort(sortFn);

  // 取 Top 1
  return matches[0];
}

// --- 业务封装函数 ---

/**
 * 寻找最佳生产工厂
 * 排序权重: 单体产出量 (outputs[wareId])
 */
function _findBestProducer(
  wareId: string,
  race: string,
  existingModules: SavedModule[],
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>
): X4Module | undefined {
  const ware = wares[wareId];
  // 边界检查：矿物/气体跳过
  if (!ware || ware.transport === 'solid' || ware.transport === 'liquid') return undefined;

  // 准备筛选器 lambda
  const isValidProducer = (m: X4Module) => 
    m.outputs[wareId] && m.type === 'production' && m.method != "recycling";

  // 准备 Pool A: 现有模块 (使用 flatMap 清洗类型)
  const existingCandidates = existingModules.flatMap(item => {
    const m = modules[item.id];
    return (m && isValidProducer(m)) ? [m] : [];
  });

  // 准备 Pool B: 数据库模块
  const dbCandidates = Object.values(modules).filter(isValidProducer);

  // 定义排序: 按该物资的产出量降序
  const sortByOutput = (a: X4Module, b: X4Module) => 
    (b.outputs[wareId] || 0) - (a.outputs[wareId] || 0);

  return _selectBestModule(existingCandidates, dbCandidates, race, sortByOutput);
}

/**
 * 寻找最佳居住舱
 * 排序权重: 人口容量 (workforce.needed)
 */
function _findBestHabitat(
  race: string,
  existingModules: SavedModule[],
  modules: Record<string, X4Module>
): X4Module | undefined {
  
  // 准备筛选器 lambda
  const isHabitat = (m: X4Module) => m.type === 'habitation';

  // 准备 Pool A: 现有模块
  const existingCandidates = existingModules.flatMap(item => {
    const m = modules[item.id];
    return (m && isHabitat(m)) ? [m] : [];
  });

  // 准备 Pool B: 数据库模块
  const dbCandidates = Object.values(modules).filter(isHabitat);

  // 定义排序: 按人口容量降序 (使用 needed 字段)
  const sortByCapacity = (a: X4Module, b: X4Module) => 
    (b.workforce?.needed || 0) - (a.workforce?.needed || 0);

  return _selectBestModule(existingCandidates, dbCandidates, race, sortByCapacity);
}

/**
 * 获取产出效率 (仅工厂且有工人需求时享受加成)
 */
function _getProductionEfficiency(
  module: X4Module,
  enableWorkforce: boolean,
  raceBonus: number = 0.25
): number {
  if (enableWorkforce && module.workforce?.needed) {
    return 1 + raceBonus;
  }
  return 1.0;
}

// --- 主计算流程 ---

export function calculateModuleDiff(
  existingModules: SavedModule[],
  race: string,
  enableWorkforce: boolean,
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>
): SavedModule[] {

  // 1. 初始化计算画布
  // 将 SavedModule[] 转换为 Map 结构方便 O(1) 操作，并作为计算的基础状态
  const currentModules: Record<string, number> = {};
  existingModules.forEach(m => {
    currentModules[m.id] = (currentModules[m.id] || 0) + m.count;
  });
  
  // ==========================================
  // 步骤 1: 工业产业链硬补完
  // ==========================================
  let loopCount = 0;
  let hasDeficit = true;

  while (hasDeficit && loopCount < 50) {
    hasDeficit = false;
    loopCount++;
    
    const productionState: Record<string, number> = {};
    
    // 1.1 计算全网盈亏
    for (const [modId, count] of Object.entries(currentModules)) {
      const module = modules[modId];
      if (!module) continue;
      
      const eff = _getProductionEfficiency(module, enableWorkforce);
      
      // 产出 (乘效率)
      for (const [outWare, val] of Object.entries(module.outputs)) {
        productionState[outWare] = (productionState[outWare] || 0) + (count * val * eff);
      }
      // 消耗 (不乘效率)
      for (const [inWare, val] of Object.entries(module.inputs)) {
        productionState[inWare] = (productionState[inWare] || 0) - (count * val);
      }
    }
    
    // 1.2 填补缺口
    for (const [wareId, netAmount] of Object.entries(productionState)) {
      if (netAmount >= -0.001) continue;
      
      const deficit = Math.abs(netAmount);
      
      // 转换格式适配辅助函数
      const currentModulesAsSaved: SavedModule[] = Object.entries(currentModules).map(([id, count]) => ({ id, count }));
      
      const producer = _findBestProducer(
        wareId, 
        race, 
        currentModulesAsSaved, // 优先使用已添加的同类工厂
        modules, 
        wares
      );
      
      if (!producer) continue;
      
      const eff = _getProductionEfficiency(producer, enableWorkforce);
      const singleOutput = (producer.outputs[wareId] || 0) * eff;
      if (singleOutput <= 0) continue;
      
      const countNeeded = Math.ceil(deficit / singleOutput);
      
      // 更新列表
      currentModules[producer.id] = (currentModules[producer.id] || 0) + countNeeded;
      hasDeficit = true; // 触发下一轮
    }
  }

  // ==========================================
  // 步骤 2: 工人 & 居住舱补完
  // ==========================================
  
  if (enableWorkforce) {
    // 2.1 统计工业人口需求
    let industrialWorkers = 0;
    for (const [modId, count] of Object.entries(currentModules)) {
      const m = modules[modId];
      if (m?.workforce?.needed) {
        industrialWorkers += count * m.workforce.needed;
      }
    }
    
    if (industrialWorkers > 0) {
      // 2.2 计算食物/医疗工厂
      const foodModules = calculateWorkerSupplyNeeds(
        industrialWorkers,
        race,
        modules,
        wares
      );
      
      for (const [id, count] of Object.entries(foodModules)) {
        currentModules[id] = (currentModules[id] || 0) + count;
      }
      
      // 2.3 统计总人口
      let totalWorkers = 0;
      for (const [modId, count] of Object.entries(currentModules)) {
        const m = modules[modId];
        if (m?.workforce?.needed) {
          totalWorkers += count * m.workforce.needed;
        }
      }
      
      // 2.4 补完居住舱
      const currentModulesAsSaved: SavedModule[] = Object.entries(currentModules).map(([id, count]) => ({ id, count }));
      
      const habitat = _findBestHabitat(
        race, 
        currentModulesAsSaved, 
        modules
      );
      
      // 使用 needed 作为容量
      if (habitat && habitat.workforce?.needed && habitat.workforce.needed > 0) {
        const neededHabitats = Math.ceil(totalWorkers / habitat.workforce.needed);
        const currentCount = currentModules[habitat.id] || 0;
        if (neededHabitats > currentCount) {
          currentModules[habitat.id] = neededHabitats;
        }
      }
    }
  }

  // ==========================================
  // 步骤 3: 太阳能电站去冗余优化 (仅针对新增模块)
  // ==========================================
  
  // 1. 找出所有能量模块 ID
  const energyModuleIds = Object.keys(currentModules).filter(id => {
    const m = modules[id];
    return m?.outputs['energycells'] && (!m.inputs || Object.keys(m.inputs).length === 0);
  });

  // 2. 筛选出"确实增加了数量"的能量模块 (Target: Added Modules Only)
  //    这避免了算法去尝试优化那些我们没动过的现有太阳能板
  const addedEnergyIds = energyModuleIds.filter(id => {
    const existingCount = existingModules.find(m => m.id === id)?.count || 0;
    return currentModules[id] || 0 > existingCount;
  });

  // 3. 对这些新增的模块进行贪心优化
  for (const energyModId of addedEnergyIds) {
    const minCount = existingModules.find(m => m.id === energyModId)?.count || 0;
    
    while (true) {
      const currentCount = currentModules[energyModId] || 0;
      // 守卫：不能少于现有
      if (currentCount <= minCount || currentCount <= 0) break;
      
      const testCount = currentCount - 1;
      let p = 0;
      let c = 0;
      
      // 模拟计算全网电力
      for (const [modId, count] of Object.entries(currentModules)) {
        const m = modules[modId];
        if (!m) continue;
        
        // 针对正在测试的模块使用 testCount，其他保持原样
        const activeCount = (modId === energyModId) ? testCount : count;
        
        if (m.outputs['energycells']) {
          const eff = _getProductionEfficiency(m, enableWorkforce);
          p += activeCount * m.outputs['energycells'] * eff;
        }
        
        if (m.inputs['energycells']) {
          c += activeCount * m.inputs['energycells'];
        }
      }
      
      // 如果减去一个后，产出依然覆盖消耗，则确认减少
      if (p >= c) {
        currentModules[energyModId] = testCount;
      } else {
        break; // 电力不足，停止优化该模块
      }
    }
  }

  // ==========================================
  // 构造返回值: 仅返回增量 (Added Modules)
  // ==========================================
  
  const addedModules: SavedModule[] = [];
  for (const [id, count] of Object.entries(currentModules)) {
    const existingItem = existingModules.find(m => m.id === id);
    const existingCount = existingItem ? existingItem.count : 0;
    
    const diff = count - existingCount;
    if (diff > 0) {
      addedModules.push({ id, count: diff });
    }
  }

  return addedModules;
}