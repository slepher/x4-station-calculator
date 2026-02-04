import type { SavedModule, X4Module, X4Ware } from '@/types/x4'
import {findBestProducer, findBestHabitat, getProductionEfficiency} from './bestModuleSelector'
import { calculateWorkerSupplyNeeds } from './workerModuleCalculator'

// --- 辅助函数 ---

/**
 * 计算模块列表的净产出
 */
export function calculateNetProduction(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  bonus: boolean
): Record<string, number> {
  const productionState: Record<string, number> = {};
  
  for (const moduleItem of modules) {
    const module = modulesMap[moduleItem.id];
    if (!module) continue;
    
    const eff = getProductionEfficiency(module, bonus);
    
    // 产出 (乘效率)
    for (const [outWare, val] of Object.entries(module.outputs)) {
      productionState[outWare] = (productionState[outWare] || 0) + (moduleItem.count * val * eff);
    }
    // 消耗 (不乘效率)
    for (const [inWare, val] of Object.entries(module.inputs)) {
      productionState[inWare] = (productionState[inWare] || 0) - (moduleItem.count * val);
    }
  }
  
  return productionState;
}

/**
 * 计算模块列表的总工人需求
 */
export function calculateTotalWorkforce(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>
): number {
  let totalWorkers = 0;
  
  for (const moduleItem of modules) {
    const module = modulesMap[moduleItem.id];
    if (module?.workforce?.needed) {
      totalWorkers += moduleItem.count * module.workforce.needed;
    }
  }
  
  return totalWorkers;
}

// --- 主计算流程 ---

export function calculateAutoFill(
  plannedModules: SavedModule[],
  race: string,
  globalWorkforceBonus: boolean,
  supplyWorkforceBonus: boolean,
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>,
  lockedWares: string[] = []
): { autoIndustry: SavedModule[]; autoSupply: SavedModule[] } {

  // ==========================================
  // Phase 1: 工业硬补完 (Tier 2 Calculation)
  // ==========================================
  
  // 初始化工业区状态
  const industryModules: Record<string, number> = {};
  plannedModules.forEach(m => {
    industryModules[m.id] = (industryModules[m.id] || 0) + m.count;
  });
  
  let loopCount = 0;
  let hasDeficit = true;

  while (hasDeficit && loopCount < 50) {
    hasDeficit = false;
    loopCount++;
    
    // 使用新的辅助函数计算净产出
    const currentModulesAsSaved: SavedModule[] = Object.entries(industryModules).map(([id, count]) => ({ id, count }));
    const productionState = calculateNetProduction(currentModulesAsSaved, modules, globalWorkforceBonus);
    
    // 填补缺口
    for (const [wareId, netAmount] of Object.entries(productionState)) {
      if (netAmount >= -0.001) continue;
      
      const deficit = Math.abs(netAmount);
      
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
      
      const eff = getProductionEfficiency(producer, globalWorkforceBonus);
      const singleOutput = (producer.outputs[wareId] || 0) * eff;
      if (singleOutput <= 0) continue;
      
      const countNeeded = Math.ceil(deficit / singleOutput);
      
      // 更新列表
      industryModules[producer.id] = (industryModules[producer.id] || 0) + countNeeded;
      hasDeficit = true; // 触发下一轮
    }
  }
  
  // 转换为 SavedModule[] 格式 (仅保留系统自动增量部分)
  const autoIndustry: SavedModule[] = Object.entries(industryModules)
    .map(([id, count]) => {
      const existingCount = plannedModules.find(m => m.id === id)?.count || 0;
      return { id, count: count - existingCount };
    })
    .filter(m => m.count > 0);

  // ==========================================
  // Phase 2: 客户人口普查 (Client Census)
  // ==========================================
  
  // 合并所有生产者
  const allProducers: SavedModule[] = [...plannedModules, ...autoIndustry];
  
  // 统计总工人数
  const clientPopulation = calculateTotalWorkforce(allProducers, modules);
  
  // 工业区居住舱补全逻辑
  if (globalWorkforceBonus && clientPopulation > 0) {
    // 统计工业区工人需求（排除补给区模块）
    const industrialWorkers = calculateTotalWorkforce(allProducers, modules);
    
    if (industrialWorkers > 0) {
      // 选择最佳居住舱
      const habitat = findBestHabitat(race, allProducers, modules);
      
      if (habitat) {
        const habitatCount = Math.ceil(industrialWorkers / habitat.workforce.capacity);
        
        // 检查是否已经存在足够的居住舱
        const existingHabitatCount = allProducers
          .filter(m => modules[m.id]?.type === 'habitation')
          .reduce((sum, m) => sum + m.count, 0);
        
        const neededHabitats = Math.max(0, habitatCount - existingHabitatCount);
        
        if (neededHabitats > 0) {
          // 将工业区居住舱添加到autoIndustry中
          const existingIndustryHabitat = autoIndustry.find(m => m.id === habitat.id);
          if (existingIndustryHabitat) {
            existingIndustryHabitat.count += neededHabitats;
          } else {
            autoIndustry.push({ id: habitat.id, count: neededHabitats });
          }
        }
      }
    }
  }
  
  // ==========================================
  // Phase 3: 补给区独立构建 (Tier 3 Calculation)
  // ==========================================
  
  const autoSupply: SavedModule[] = [];
  
  if (clientPopulation > 0) {
    // 步骤 A: 物资生产 (Production)
    const supplyModules = calculateWorkerSupplyNeeds(
      clientPopulation,
      race,
      modules,
      wares
    );
    
    // 转换为 SavedModule[] 格式
    for (const [id, count] of Object.entries(supplyModules)) {
      autoSupply.push({ id, count });
    }
    
    // 步骤 B: 居住舱补全 (Habitation) - 逻辑分支
    if (supplyWorkforceBonus) {
      // 统计补给区工人需求
      const supplyWorkers = calculateTotalWorkforce(autoSupply, modules);
      
      if (supplyWorkers > 0) {
        // 选择最佳居住舱 (不参考 plannedModules 中的居住舱类型)
        const habitat = findBestHabitat(race, [], modules);
        
        if (habitat) {
          const habitatCount = Math.ceil(supplyWorkers / habitat.workforce.capacity);
          autoSupply.push({ id: habitat.id, count: habitatCount });
        }
      }
    }
  }

  // ==========================================
  // 返回结果
  // ==========================================
  
  return {
    autoIndustry,
    autoSupply
  };
}