# Empire Sector Flows Cache - Design

## 现状

```
StationDerivedMap:
  cacheMap: Map<stationId → StationDerivedCache>
    └── productionFlows: WareProductionFlow[]    ← station 级（单个站）

  updateAggregation():
    ├── empireFlowsCache: WareProductionFlow[]   ← 无人读取
    └── sectorFlowsCache: Map<sectorId, WareProductionFlow[]>  ← 无人读取

  getEmpireGroupedFlows(stations, waresMap, filterFn):
    └── analyzeEmpireWareFlow(...)  ← 重新遍历 snapshotMap + cacheMap

facade 层：
  ├── rawSectorGroupedFlowsMap: forEach sector → analyzeEmpireWareFlow (重新遍历)
  └── empireGroupedFlows (empire): call flowMap.getEmpireGroupedFlows (调 analyzeEmpireWareFlow)
```

**问题**：
1. `updateAggregation()` 产出的 `empireFlowsCache` / `sectorFlowsCache` 无人读取
2. facade 层重新调 `analyzeEmpireWareFlow` 做同样的聚合，重复遍历
3. `analyzeEmpireWareFlow` 内部重新遍历 station 列表、查 cacheMap，和 `updateAggregation()` 重复

## 设计

### 构造函数扩展

```typescript
export class StationDerivedMap {
  constructor(
    staticDeps: StationDerivedStaticDeps,
    options?: { hasSector?: boolean }
  )

  // hasSector = true 时
  //   staticDeps 额外需要: sectorLinks, solver
  //   updateAggregation() 额外构建 sectorFlowsCache + sectorExternalCache
}
```

`hasSector` 是区分能力而非区分 store 类型：
- `hasSector = false` → 只维护 `empireFlowsCache`（blueprint 侧）
- `hasSector = true`  → 维护全部缓存 + solver（live 侧）

### 目标缓存结构

```
hasSector = false（如 blueprint）:
  empireFlowsCache: WareProductionFlow[]              ← count 加权

hasSector = true（如 live）:
  empireFlowsCache: WareProductionFlow[]              ← count 加权（live 侧 count=1）
  sectorFlowsCache: Map<sectorId, WareProductionFlow[]>    ← local, count 加权
  sectorExternalCache: Map<sectorId, WareProductionFlow[]> ← solver 输出
```

### 各侧消费关系

```
Blueprint 侧:
  只读 empireFlowsCache → classifyAndEnrich → empireGroupedFlows

Live 侧:
  empireFlowsCache → classifyAndEnrich → empireGroupedFlows（帝国概览）
  sectorFlowsCache → classifyAndEnrich → rawSectorGroupedFlowsMap（本地贡献）
    └── sectorInternalDataMap 从此读（gap 分析，不看 external）
  sectorFlowsCache + sectorExternalCache → mergeFlows → getSectorFinalProductionFlows（含物流）
    └── TransitHubCenterDashboard 从此读
```

### `updateAggregation()` 内部逻辑

当前实现：
```typescript
this.snapshotMap.forEach((snapshot, stationId) => {
  const cache = this.cacheMap.get(stationId)
  if (!cache) return
  const filteredFlows = filterProductionFlowsByPriority(cache.productionFlows, cache.warePriorityLevels)
  allFilteredFlows.push(filteredFlows)
  // sector: merge into sectorMap
})
this.empireFlowsCache = mergeFlows(allFilteredFlows)
this.sectorFlowsCache = sectorMap
```

新实现（伪代码）：

```
updateAggregation():
  empireAgg = Map<wareId, WareProductionFlow>
  if hasSector:
    sectorAgg = Map<sectorId, Map<wareId, WareProductionFlow>>

  for each (snapshot, stationId) in snapshotMap:
    cache = cacheMap.get(stationId)
    if !cache: continue
    count = snapshot.count ?? 1
    filtered = filterProductionFlowsByPriority(cache.productionFlows, cache.warePriorityLevels)

    for each flow in filtered:
      multiplied = {
        ...flow,
        production: flow.production * count,
        consumption: flow.consumption * count,
        netRate: flow.netRate * count,
        contributions: flow.contributions.map(c => ({ ...c, amount: c.amount * count }))
      }

      mergeInto(empireAgg, multiplied)              // 始终构建

      if hasSector:                                // 有 sector 才构建
        sectorId = snapshot.sectorId ?? '__no_sector__'
        mergeInto(sectorAgg[sectorId], multiplied)

  this.empireFlowsCache = Array.from(empireAgg.values())

  if hasSector:
    // 构建 sector local 缓存
    this.sectorFlowsCache = Map.from(sectorAgg, ([k, v]) => [k, Array.from(v.values())])

    // 构建 sector external 缓存
    sectorsInput = buildSolverInput(this.sectorFlowsCache)  // 提取 container netByWare
    solverOutput = solveMultiWareByLink({ sectors: sectorsInput, links: staticDeps.sectorLinks })
    this.sectorExternalCache = buildExternalCache(solverOutput, staticDeps.waresMap)
```

注意：merge 规则与当前 `mergeFlows()` 一致——相同 `wareId` 的 `production/consumption/netRate` 相加，`contributions` 合并。

### Facade 层：读缓存 + 分类 + 价格补全

```typescript
function classifyAndEnrichFlows(
  flows: WareProductionFlow[],
  waresMap: Record<string, X4Ware>
): EmpireGroupedFlows {
  const supply: EmpireWareFlow[] = []
  const operations: EmpireWareFlow[] = []

  for (const flow of flows) {
    const isWorkforce = flow.contributions.some(c => c.class === 'workforce')
    const isNonContainer = flow.transportType !== 'container'
    const category = (isWorkforce || isNonContainer) ? 'supply' : 'operations'

    const ware = waresMap[flow.wareId]
    const empireFlow: EmpireWareFlow = {
      wareId: flow.wareId,
      orderIndex: flow.orderIndex,
      tier: flow.tier,
      transportType: flow.transportType,
      unitVolume: flow.unitVolume,
      production: flow.production,
      consumption: flow.consumption,
      netRate: flow.netRate,
      minPrice: ware?.minPrice || 0,
      avgPrice: ware?.price || 0,
      maxPrice: ware?.maxPrice || 0,
      contributions: flow.contributions
    }

    if (category === 'supply') supply.push(empireFlow)
    else operations.push(empireFlow)
  }

  const allFlows = [...operations, ...supply].sort(sortByOrderTierNetRate)
  return { flows: allFlows, empireGroups: { operations, supply } }
}
```

`empireGroupedFlows` computed（共用）：
```typescript
if (!activeEmpire.value || !waresMap.value) return empty
return classifyAndEnrichFlows(flowMap.getEmpireFlows(), waresMap.value)
```

`rawSectorGroupedFlowsMap` computed（live 侧）：
```typescript
if (!waresMap.value) return empty
for each sector in productionSectors:
  rawFlows = flowMap.getSectorFlows(sector.id)
  map.set(sector.id, classifyAndEnrichFlows(rawFlows, waresMap.value))
```

`getSectorFinalProductionFlows`（live 侧）：
```typescript
// facade
function getSectorFinalProductionFlows(sectorId: string): WareProductionFlow[] {
  return flowMap.getSectorCombinedFlows(sectorId)
}
```

**guard 变化**：`modulesMap` guard 移除，`waresMap` guard 保留（价格补全需要）。
**不再需要 facade 层的** `sectorLinkCalcMap` computed 和 `mergeSectorLinkIntoEmpireGroupedFlows`（已内置到 StationDerivedMap）。

## `count` 字段传递

### seed → snapshot 机制

```typescript
StationDerivedSeed {
  ...existing,
  count?: number    // 新增，可选
}

upsertStation(stationId, seed) {
  snapshot.count = seed.count ?? 1
}
```

### 调用侧修改清单

| 调用点 | 行号 | 修改 |
|---|---|---|
| `useBlueprintProductionStore.syncPlanStationDerivedSnapshot` | 307 | seed 追加 `count: station.count` |
| `useBlueprintProductionStore.getSavedStationGroupedFlows` | 344 | seed 追加 `count: station.count` |
| `useBlueprintProductionStore.initializeAllStationDerived` | 360 | seed 追加 `count: station.count` |
| `productionStationShared.computeStationFlow` | 184 | seed 追加 `count: station.count ?? 1` |
| `useLiveProductionStore` 中 4 处 | 196/754/1040/1579 | 不修改（默认 1） |

## 生命周期适配

### `clear()`

```typescript
clear(): void {
  this.cacheMap.clear()
  this.snapshotMap.clear()
  this.empireFlowsCache = []
  if (this.hasSector) {
    this.sectorFlowsCache.clear()
    this.sectorExternalCache.clear()
  }
}
```

### `removeStation()`

```typescript
removeStation(stationId: string): void {
  this.cacheMap.delete(stationId)
  this.snapshotMap.delete(stationId)
  // 不更新 3 份缓存，下次 computeInternal 时重建
}
```
（当前行为一致）

## 删除的 API

| 方法 | 原因 |
|---|---|
| `getEmpireGroupedFlows(stations, waresMap, filterFn)` | 转移到 facade 层读缓存，不再属于 StationDerivedMap |
| `analyzeEmpireWareFlow` 的 import | 不再需要 |

## 保留/新增的 API

| 方法 | 用途 |
|---|---|
| `getEmpireFlows(): WareProductionFlow[]` | facade 读取 empire 级聚合 |
| `getSectorFlows(sectorId): WareProductionFlow[]` | facade 读取 sector local 聚合 |
| `getSectorExternalFlows(sectorId): WareProductionFlow[]` | facade 读取 sector external 聚合 |
| `getSectorCombinedFlows(sectorId): WareProductionFlow[]` | facade 读取 sector local + external 合并结果 |
