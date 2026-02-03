import type { SavedModule, X4Module, X4Ware } from '@/types/x4'
import {findBestProducer, findStandardPowerPlant, findBestHabitat, getProductionEfficiency} from './bestModuleSelector'
import { calculateWorkerSupplyNeeds } from './workerModuleCalculator'

// --- 主计算流程 ---

export function calculateModuleDiff(
  existingModules: SavedModule[],
  race: string,
  enableWorkforce: boolean,
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>,
  lockedWares: string[] = [] // 新增参数：接收锁定列表
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
      
      const eff = getProductionEfficiency(module, enableWorkforce);
      
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
        
        // 如果该资源已被锁定，则跳过补齐生产模块的逻辑
        if (lockedWares.includes(wareId)) {
          continue;
        }
        
        const producer = findBestProducer(
          wareId, 
          race, 
          currentModulesAsSaved, // 优先使用已添加的同类工厂
          modules, 
          wares
        );
      
      if (!producer) continue;
      
      const eff = getProductionEfficiency(producer, enableWorkforce);
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
    const supplyWares = new Set([
      // 1. 水 (Water) - 关键修正！排除农业用水导致的死循环
      'water',
      // 2. 食品 (Food) - 最终消耗品
      'food',
      // 3. 药品 (Medicine)
      'pharmaceutical',
      // 4. 农业商品 (Agricultural) - 中间原料
      'agricultural'
    ]);

    // 2.1 统计工业人口需求
    let industrialWorkers = 0;
    let supplyChainEnergyNeeded = 0;
    for (const [modId, count] of Object.entries(currentModules)) {
      const m = modules[modId];
      if(!m) continue;
      if(!m.workforce?.needed) continue;
      const isSupplyModule = supplyWares.has(m.group);
      if(isSupplyModule) {
        supplyChainEnergyNeeded += count * (m.inputs?.['energycells'] || 0);
      } else {
        industrialWorkers += count * m.workforce.needed;
      }
    }

    const currentModulesAsSaved1: SavedModule[] = Object.entries(currentModules).map(([id, count]) => ({ id, count }));


    const standardPowerPlant = findStandardPowerPlant(  
      race,
      currentModulesAsSaved1,
      modules,
      wares
    );

    // 2. [关键算法] 向上取整标准工时剥离法
    let deductedWorkers = 0;
    if (standardPowerPlant && supplyChainEnergyNeeded > 0) {
      // 标准电厂单体产能 (计算基础效率，不含加成，以保证"多扣"的安全性)
      const unitOutput = standardPowerPlant.outputs['energycells'] || 3000; 
      // 标准电厂单体工人
      const unitWorkforce = standardPowerPlant.workforce?.needed || 0;
      
      // 理论需要的电厂数量 (向上取整)
      const theoreticalPlants = Math.ceil(supplyChainEnergyNeeded / unitOutput);
      
      // 需要扣除的工人数量
      deductedWorkers = theoreticalPlants * unitWorkforce;
    }

    industrialWorkers = Math.max(0, industrialWorkers - deductedWorkers);

    if (industrialWorkers > 0) {

      const bestHatabitat = findBestHabitat(
        race ,
        currentModulesAsSaved1, 
        modules
      );
      const bestHabitatRace = bestHatabitat?.race || race;

      let habitatWorkerMap: Record<string, number> = {};
      let bestHabitatWorkers = 0;
      let nonBestHabitatWorkers = 0;

      Object.entries(currentModules).forEach(([id, count]) => {
        const module = modules[id];
        if(!module) return;
        if(module.type === 'habitation') {
          if(module.race !== bestHabitatRace) {
            const workers = habitatWorkerMap[module.race] || 0;
            const moduleWorkers = (module.workforce?.capacity || 0) * count;
            habitatWorkerMap[module.race] = workers + moduleWorkers;
            nonBestHabitatWorkers += moduleWorkers;
          } else {
            bestHabitatWorkers += (module.workforce?.capacity || 0) * count;
          }
        }
      });
      //TODO: 分配工人到最佳居住舱, 这个算法还是有问题, 和下一个功能一起修了, 现在看起来差不多就行了
      industrialWorkers = Math.max(industrialWorkers - nonBestHabitatWorkers, Math.min(industrialWorkers, bestHabitatWorkers));
      habitatWorkerMap[bestHabitatRace] = industrialWorkers;
      const supplyModules: Record<string, number> = {};
      Object.entries(habitatWorkerMap).forEach(([race, raceWorkers]) => {
        // 2.2 计算食物/医疗工厂
        const foodModules = calculateWorkerSupplyNeeds(
          raceWorkers,
          race,
          modules,
          wares
        );
        
        for (const [id, count] of Object.entries(foodModules)) {      
          supplyModules[id] = (supplyModules[id] || 0) + count;
        }
      });

      for (const [id, count] of Object.entries(supplyModules)) {
        currentModules[id] = Math.max(currentModules[id] || 0, count);
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
      
      const habitat = findBestHabitat(
        race, 
        currentModulesAsSaved, 
        modules
      );
      
      // 使用 needed 作为容量
      if (habitat) {
        const neededHabitats = Math.ceil(totalWorkers / habitat.workforce.capacity);
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
          const eff = getProductionEfficiency(m, enableWorkforce);
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