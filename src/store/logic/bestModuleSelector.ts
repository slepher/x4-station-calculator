import type { SavedModule, X4Module, X4Ware } from '../../types/x4'
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

export function selectBestModuleWithReference(
  referenceCandidates: X4Module[],
  existingCandidates: X4Module[],
  databaseCandidates: X4Module[],
  targetRace: string,
  sortFn: (a: X4Module, b: X4Module) => number
): X4Module | undefined {
  const pools: X4Module[][] = [
    referenceCandidates,
    existingCandidates,
    databaseCandidates
  ]

  for (const pool of pools) {
    if (pool.length === 0) continue
    const sameRace = pool.filter((module) => module.race === targetRace)
    if (sameRace.length > 0) {
      sameRace.sort(sortFn)
      return sameRace[0]
    }
    pool.sort(sortFn)
    return pool[0]
  }

  return undefined
}

export function findBestModuleWithReferenceQuota(
  race: string,
  existingModules: SavedModule[],
  modules: Record<string, X4Module>,
  referenceModules: SavedModule[],
  remainingQuota: Record<string, number>,
  isValid: (module: X4Module) => boolean,
  sortFn: (a: X4Module, b: X4Module) => number,
  databaseCandidatesOverride?: X4Module[]
): { module: X4Module; exhaustedQuota: boolean } | undefined {
  const refCandidates = referenceModules.flatMap(item => {
    const module = modules[item.id]
    return (module && isValid(module)) ? [module] : []
  })

  const existingCandidates = existingModules.flatMap(item => {
    const module = modules[item.id]
    return (module && isValid(module)) ? [module] : []
  })

  const dbCandidates = databaseCandidatesOverride && databaseCandidatesOverride.length > 0
    ? databaseCandidatesOverride
    : Object.values(modules).filter(isValid)

  function pickFrom(pool: X4Module[], matchRace: boolean): X4Module | undefined {
    if (pool.length === 0) return undefined
    let matches = matchRace ? pool.filter(m => m.race === race) : pool
    if (matches.length === 0 && matchRace) matches = pool
    matches.sort(sortFn)
    return matches[0]
  }

  const p1Pool = refCandidates.filter(m => (remainingQuota[m.id] || 0) > 0 && m.race === race)
  if (p1Pool.length > 0) {
    p1Pool.sort(sortFn)
    return { module: p1Pool[0]!, exhaustedQuota: false }
  }

  const p2Pool = refCandidates.filter(m => (remainingQuota[m.id] || 0) > 0)
  if (p2Pool.length > 0) {
    p2Pool.sort(sortFn)
    return { module: p2Pool[0]!, exhaustedQuota: false }
  }

  const p3 = pickFrom(existingCandidates, true)
  if (p3) {
    return { module: p3, exhaustedQuota: true }
  }

  const p4 = pickFrom(existingCandidates, false)
  if (p4) {
    return { module: p4, exhaustedQuota: true }
  }

  const p5Pool = refCandidates.filter(m => m.race === race)
  if (p5Pool.length > 0) {
    p5Pool.sort(sortFn)
    return { module: p5Pool[0]!, exhaustedQuota: true }
  }

  if (refCandidates.length > 0) {
    refCandidates.sort(sortFn)
    return { module: refCandidates[0]!, exhaustedQuota: true }
  }

  const p7 = pickFrom(dbCandidates, true)
  if (p7) {
    return { module: p7, exhaustedQuota: true }
  }

  const p8 = pickFrom(dbCandidates, false)
  if (p8) {
    return { module: p8, exhaustedQuota: true }
  }

  return undefined
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
  const ware = wares[wareId]
  if (!ware || ware.transport === 'solid' || ware.transport === 'liquid') return undefined

  const isValidProducer = (m: X4Module) =>
    m.outputs[wareId] && (m.type === 'production') && (m.method != "recycling")

  const existingCandidates = existingModules.flatMap(item => {
    const m = modules[item.id]
    return (m && isValidProducer(m)) ? [m] : []
  })

  const dbCandidates = Object.values(modules).filter(isValidProducer)
  const sortByOutput = (a: X4Module, b: X4Module) =>
    (b.outputs[wareId] || 0) - (a.outputs[wareId] || 0)

  return selectBestModule(existingCandidates, dbCandidates, race, sortByOutput)
}

export function findStandardPowerPlant(
  race: string,
  existingModules: SavedModule[],
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>
): X4Module | undefined {
  return findBestProducer('energycells', race, existingModules, modules, wares)
}

/**
 * 寻找最佳居住舱
 * 排序权重: 人口容量 (workforce.needed)
 */
export function findBestHabitat(
  race: string,
  existingModules: SavedModule[],
  modules: Record<string, X4Module>,
  referenceModules: SavedModule[] = []
): X4Module | undefined {
  
  // 准备筛选器 lambda
  const isHabitat = (m: X4Module) => m.type === 'habitation';

  // 准备 Pool A: 现有模块
  const existingCandidates = existingModules.flatMap(item => {
    const m = modules[item.id];
    return (m && isHabitat(m)) ? [m] : [];
  });

  const referenceCandidates = referenceModules.flatMap(item => {
    const m = modules[item.id];
    return (m && isHabitat(m)) ? [m] : [];
  });

  // 准备 Pool B: 数据库模块
  const dbCandidates = Object.values(modules).filter(isHabitat);

  // 定义排序: 按人口容量降序 (使用 needed 字段)
  const sortByCapacity = (a: X4Module, b: X4Module) => 
    (b.workforce?.capacity || 0) - (a.workforce?.capacity || 0);

  return selectBestModuleWithReference(referenceCandidates, existingCandidates, dbCandidates, race, sortByCapacity);
}

/**
 * 获取产出效率 (仅工厂且有工人需求时享受加成)
 */
export function getProductionEfficiency(
  module: X4Module,
  enableWorkforce: boolean
): number {
  if (enableWorkforce && module.workforce?.needed) {
    return 1 + (module.workforce.maxBonus || 0);
  }
  return 1.0;
}
