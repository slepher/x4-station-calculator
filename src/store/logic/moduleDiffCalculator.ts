import type { 
  SavedModule, 
  X4Module, 
  X4Ware, 
  StationSettings, 
  RaceMedicalConsumption 
} from '../../types/x4'
import {findBestProducer, findBestHabitat, getProductionEfficiency} from './bestModuleSelector'
import { analyzeWareFlow } from './analyzeWareFlow'

// --- 辅助函数 ---

/**
 * 查找最佳仓储模块
 */
function findBestStorage(
  type: 'container' | 'solid' | 'liquid',
  race: string,
  modules: Record<string, X4Module>,
  existingModules: SavedModule[] = []
): X4Module | null {
  // 0. 优先匹配已存在的仓储模块
  const existingCandidates = existingModules
    .map(m => modules[m.id])
    .filter((m): m is X4Module => !!m && m.type === 'storage' && m.cargo?.type === type)
    .sort((a, b) => (b.cargo?.capacity || 0) - (a.cargo?.capacity || 0));

  if (existingCandidates.length > 0) {
    return existingCandidates[0]!;
  }

  // 1. 查找符合种族偏好的 L 级仓储
  let candidate = Object.values(modules).find(m => 
    m.type === 'storage' && 
    m.race === race && 
    m.cargo?.type === type && 
    m.cargo?.capacity > 500000 // 假设 L 级通常 > 500k，或者我们可以通过名称/ID判断
  );

  // 如果没有找到特定种族的，尝试查找通用的 L 级 (Argon 通常是默认选择)
  if (!candidate) {
    candidate = Object.values(modules).find(m => 
      m.type === 'storage' && 
      m.cargo?.type === type && 
      m.cargo?.capacity > 500000
    );
  }

  // 如果还是没有 (可能只有 S/M 级)，找最大的
  if (!candidate) {
    const allStorages = Object.values(modules).filter(m => 
      m.type === 'storage' && 
      m.cargo?.type === type
    );
    if (allStorages.length > 0) {
      candidate = allStorages.sort((a, b) => (b.cargo?.capacity || 0) - (a.cargo?.capacity || 0))[0];
    }
  }

  return candidate || null;
}

/**
 * 计算模块列表的净产出
 */
export function calculateNetProduction(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  bonus: boolean,
  sunlight: number = 100
): Record<string, number> {
  const productionState: Record<string, number> = {};
  
  for (const moduleItem of modules) {
    const module = modulesMap[moduleItem.id];
    if (!module) continue;
    
    const eff = getProductionEfficiency(module, bonus);
    
    // 产出 (乘效率)
    for (const [outWare, val] of Object.entries(module.outputs)) {
      let sunlightFactor = 1.0;
      if (outWare === 'energycells') {
        sunlightFactor = sunlight / 100.0;
      }
      productionState[outWare] = (productionState[outWare] || 0) + (moduleItem.count * val * eff * sunlightFactor);
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
  settings: StationSettings,
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>,
  lockedWares: string[] = [],
  medicalConsumption: RaceMedicalConsumption,
  userPriority: Record<string, number>
): { autoIndustry: SavedModule[] } {

  const race = settings.racePreference;
  const globalWorkforceBonus = settings.considerWorkforceForAutoFill;

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
    const productionState = calculateNetProduction(currentModulesAsSaved, modules, globalWorkforceBonus, settings.sunlight);
    
    // [修改] 按 Tier 降序处理缺口，确保高 Tier 模块优先触发下游需求，建立正确的发现顺序 
    const sortedWares = Object.entries(productionState) 
      .sort(([idA], [idB]) => (wares[idB]?.tier || 0) - (wares[idA]?.tier || 0)); 

    for (const [wareId, netAmount] of sortedWares) {
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
      
      // 光照影响 (仅能量电池)
      let sunlightFactor = 1.0;
      if (wareId === 'energycells') {
        sunlightFactor = settings.sunlight / 100.0;
      }
      
      const singleOutput = (producer.outputs[wareId] || 0) * eff * sunlightFactor;
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
    .filter(m => m.count > 0) 
    // [修改] 最终按 Tier 降序排序，由于 Array.sort 是稳定的，同 Tier 内将保持其被"发现"的先后顺序 
    .sort((a, b) => (modules[b.id]?.tier || 0) - (modules[a.id]?.tier || 0));

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
  // Phase 3: 仓储自动填充 (Auto Storage)
  // ==========================================

  // 4.0 构建优先级映射 (Breaking the cycle)
  const autoWaresSet = new Set<string>();
  autoIndustry.forEach(m => {
    const info = modules[m.id];
    if (info && info.outputs) {
      Object.keys(info.outputs).forEach(w => autoWaresSet.add(w));
    }
  });

  const isPlannedWare = (wareId: string) => {
    return plannedModules.some(m => {
      const info = modules[m.id];
      return info && info.outputs && Object.keys(info.outputs).includes(wareId);
    });
  };

  const getLocalResolvedLevel = (wareId: string): number => {
    const planned = isPlannedWare(wareId);
    const auto = autoWaresSet.has(wareId);
    const override = userPriority[wareId];

    // 1. 自动纠错
    if (planned && override === 0) return 1;
    if (auto && override === 2) return 1;

    // 2. 手动覆盖
    if (override !== undefined) return override;

    // 3. 默认身份
    if (planned) return 2;
    if (auto) return 0;
    return 0;
  };

  const resolvedPriority: Record<string, number> = {};
  Object.keys(wares).forEach(id => {
    resolvedPriority[id] = getLocalResolvedLevel(id);
  });

  // Helper: 计算指定模块列表的仓储需求并返回增量模块
  const calculateStorageDelta = (
    targetModules: SavedModule[],
    targetWorkforce: number
  ): SavedModule[] => {
    // 假设满员满效率计算最大流量
    const saturation = 1.0; 
    
    const analysis = analyzeWareFlow(
      targetModules,
      modules,
      wares,
      medicalConsumption,
      settings,
      targetWorkforce,
      saturation,
      settings.resourceBufferHours,
      settings.primaryProductBufferHours,
      settings.secondaryProductBufferHours,
      resolvedPriority
    );

    const needs = { container: 0, solid: 0, liquid: 0 };
    
    analysis.flows.forEach(flow => {
      if (flow.totalOccupiedVolume > 0) {
        if (flow.transportType === 'solid') needs.solid += flow.totalOccupiedVolume;
        else if (flow.transportType === 'liquid') needs.liquid += flow.totalOccupiedVolume;
        else needs.container += flow.totalOccupiedVolume;
      }
    });

    const result: SavedModule[] = [];
    (['container', 'solid', 'liquid'] as const).forEach(type => {
      const needed = needs[type];
      
      // 计算现有容量
      let existingCapacity = 0;
      targetModules.forEach(m => {
        const info = modules[m.id];
        if (info?.cargo?.type === type) {
          existingCapacity += info.cargo.capacity * m.count;
        }
      });

      const deficit = needed - existingCapacity;
      
      if (deficit > 0) {
        const storageModule = findBestStorage(type, race, modules, targetModules);
        if (storageModule && storageModule.cargo) {
          const count = Math.ceil(deficit / storageModule.cargo.capacity);
          result.push({ id: storageModule.id, count });
        }
      }
    });
    
    return result;
  };

  // 4a. Main Storage Calculation
  // 包含: Planned + AutoIndustry
  const mainModules = [...plannedModules, ...autoIndustry];
  const mainWorkforce = calculateTotalWorkforce(mainModules, modules);
  const mainStorage = calculateStorageDelta(mainModules, mainWorkforce);

  // 将生成的仓储模块追加到 autoIndustry
  mainStorage.forEach(s => {
    const existing = autoIndustry.find(m => m.id === s.id);
    if (existing) {
      existing.count += s.count;
    } else {
      autoIndustry.push(s);
    }
  });

  // ==========================================
  // 返回结果
  // ==========================================
  
  return {
    autoIndustry
  };
}
