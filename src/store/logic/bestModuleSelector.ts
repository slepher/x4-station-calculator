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
  const result = findBestProducerWithRef(
    wareId, race, existingModules, modules, wares,
    [], {}
  )
  return result?.module
}

/**
 * P1-P8 优先级选择器（带参考模块和配额跟踪）
 *
 *   P1: race + ref, 配额内
 *   P2: ref (不限race), 配额内
 *   P3: race + existing
 *   P4: existing
 *   P5: race + ref, 无配额
 *   P6: ref (不限race), 无配额
 *   P7: race + db
 *   P8: db
 */
export function findBestProducerWithRef(
  wareId: string,
  race: string,
  existingModules: SavedModule[],
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>,
  referenceModules: SavedModule[],
  remainingQuota: Record<string, number>
): { module: X4Module; exhaustedQuota: boolean } | undefined {
  const ware = wares[wareId]
  if (!ware || ware.transport === 'solid' || ware.transport === 'liquid') return undefined

  const isValidProducer = (m: X4Module) =>
    m.outputs[wareId] && (m.type === 'production') && (m.method != "recycling")

  const sortByOutput = (a: X4Module, b: X4Module) =>
    (b.outputs[wareId] || 0) - (a.outputs[wareId] || 0)

  const refCandidates = referenceModules.flatMap(item => {
    const m = modules[item.id]
    return (m && isValidProducer(m)) ? [m] : []
  })

  const existingCandidates = existingModules.flatMap(item => {
    const m = modules[item.id]
    return (m && isValidProducer(m)) ? [m] : []
  })

  const dbCandidates = Object.values(modules).filter(isValidProducer)

  function pickFrom(pool: X4Module[], matchRace: boolean): X4Module | undefined {
    if (pool.length === 0) return undefined
    let matches = matchRace ? pool.filter(m => m.race === race) : pool
    if (matches.length === 0 && matchRace) matches = pool
    matches.sort(sortByOutput)
    return matches[0]
  }

  // P1: race + ref, 仅配额大于0的
  const p1Pool = refCandidates.filter(m => (remainingQuota[m.id] || 0) > 0 && m.race === race)
  if (p1Pool.length > 0) {
    p1Pool.sort(sortByOutput)
    console.log('[autoFill] P1 selected:', p1Pool[0]!.id, 'for ware:', wareId, 'race:', race)
    return { module: p1Pool[0]!, exhaustedQuota: false }
  }

  // P2: ref (不限race), 仅配额大于0的
  const p2Pool = refCandidates.filter(m => (remainingQuota[m.id] || 0) > 0)
  if (p2Pool.length > 0) {
    p2Pool.sort(sortByOutput)
    return { module: p2Pool[0]!, exhaustedQuota: false }
  }

  // P3: race + existing/planned
  const p3 = pickFrom(existingCandidates, true)
  if (p3) {
    console.log('[autoFill] P3 selected:', p3.id)
    return { module: p3, exhaustedQuota: true }
  }

  // P4: existing/planned
  const p4 = pickFrom(existingCandidates, false)
  if (p4) {
    console.log('[autoFill] P4 selected:', p4.id)
    return { module: p4, exhaustedQuota: true }
  }

  // P5: race + ref, 不考虑配额
  const p5Pool = refCandidates.filter(m => m.race === race)
  if (p5Pool.length > 0) {
    p5Pool.sort(sortByOutput)
    console.log('[autoFill] P5 selected:', p5Pool[0]!.id, 'available ref ids:', refCandidates.map(m => `${m.id}(${m.race})`))
    return { module: p5Pool[0]!, exhaustedQuota: true }
  }

  // P6: ref, 不考虑配额
  if (refCandidates.length > 0) {
    refCandidates.sort(sortByOutput)
    console.log('[autoFill] P6 selected:', refCandidates[0]!.id, 'available ref ids:', refCandidates.map(m => `${m.id}(${m.race})`))
    return { module: refCandidates[0]!, exhaustedQuota: true }
  }

  // P7: race + db
  const p7 = pickFrom(dbCandidates, true)
  if (p7) {
    console.log('[autoFill] P7 selected:', p7.id, 'race:', race)
    return { module: p7, exhaustedQuota: true }
  }

  // P8: db
  const p8 = pickFrom(dbCandidates, false)
  if (p8) {
    console.log('[autoFill] P8 selected:', p8.id)
    return { module: p8, exhaustedQuota: true }
  }

  console.log('[autoFill] NO PRODUCER found for ware:', wareId, 'refCandidates:', refCandidates.length, 'existingCandidates:', existingCandidates.length, 'dbCandidates:', dbCandidates.length)
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
  enableWorkforce: boolean
): number {
  if (enableWorkforce && module.workforce?.needed) {
    return 1 + (module.workforce.maxBonus || 0);
  }
  return 1.0;
}