import type { SavedModule, X4Module, X4Ware } from '@/types/x4'
/**
 * 通用模块选择器
 * 逻辑: 来源池锁定(Pool Priority) -> 种族正交筛选(Race Filter) -> 权重排序(Sorter)
 */
export function selectBestModule(
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
export function findBestProducer(
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
    m.outputs[wareId] && (m.type === 'production') && (m.method != "recycling");

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

  return selectBestModule(existingCandidates, dbCandidates, race, sortByOutput);
}

export function findStandardPowerPlant(
  race: string,
  existingModules: SavedModule[],
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>
): X4Module | undefined {
  return findBestProducer('energycells', race, existingModules, modules, wares);
}

/**
 * 寻找最佳居住舱
 * 排序权重: 人口容量 (workforce.needed)
 */
export function findBestHabitat(
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
    (b.workforce?.capacity || 0) - (a.workforce?.capacity || 0);

  return selectBestModule(existingCandidates, dbCandidates, race, sortByCapacity);
}

/**
 * 获取产出效率 (仅工厂且有工人需求时享受加成)
 */
export function getProductionEfficiency(
  module: X4Module,
  enableWorkforce: boolean,
  raceBonus: number = 0.25
): number {
  if (enableWorkforce && module.workforce?.needed) {
    return 1 + raceBonus;
  }
  return 1.0;
}