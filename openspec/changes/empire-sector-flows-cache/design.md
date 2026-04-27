# Empire Sector Flows Cache - Design

## 现状

当前 `StationDerivedMap` 的缓存结构：

```
updateAggregation()
  ├── empireFlowsCache: WareProductionFlow[]   ← 无外部读取
  ├── sectorFlowsCache: Map<string, WareProductionFlow[]>  ← 无外部读取

facade 层：
  ├── rawSectorGroupedFlowsMap: forEach sector → analyzeEmpireWareFlow (重新遍历 getCache)
  ├── empireGroupedFlows (empire): call analyzeEmpireWareFlow (重新遍历 getCache)
```

**问题**：`updateAggregation` 产出的缓存无人使用，facade 层每次重新调 `analyzeEmpireWareFlow` 做同样的聚合。

## 目标结构

```
updateAggregation()
  ├── empireGroupedFlowsCache: EmpireGroupedFlows
  └── sectorGroupedFlowsCache: Map<string, EmpireGroupedFlows>

StationDerivedMap 读取：
  ├── getEmpireGroupedFlows() → empireGroupedFlowsCache
  └── getSectorGroupedFlows(sectorId) → sectorGroupedFlowsCache.get(sectorId)

facade 层：
  ├── rawSectorGroupedFlowsMap: flowMap.getSectorGroupedFlows(sectorId)  (读取缓存)
  └── empireGroupedFlows (empire): flowMap.getEmpireGroupedFlows()  (读取缓存)
```

## 算法变更

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
```

新实现（伪代码）：
```typescript
const empireByWare = new Map<string, ...>()  // wareId → aggregate
const sectorMap = new Map<string, Map<string, ...>>()  // sectorId → wareId → aggregate

this.snapshotMap.forEach((snapshot, stationId) => {
  const cache = this.cacheMap.get(stationId)
  if (!cache) return
  const count = snapshot.count ?? 1
  const filteredFlows = filterProductionFlowsByPriority(cache.productionFlows, cache.warePriorityLevels)

  // Per ware: count-multiplied contribution for empire level
  filteredFlows.forEach(flow => {
    const contribution = {
      id: stationId,
      class: 'station',
      count,
      amount: 0,
      bonusPercent: 0,
      production: flow.production * count,
      consumption: flow.consumption * count,
      workforceConsumption: flow.workforceConsumption * count,
      netRate: flow.netRate * count
    }
    // Accumulate in empireByWare
    // Classify: supply (if class='workforce' exists) vs operations vs positive
    // ... same classification as analyzeEmpireWareFlow
  })
})
// Build EmpireGroupedFlows from empireByWare
// Build sectorGroupedFlowsCache from sectorMap
```

## `count` 字段传递

```
upsertStation(stationId, seed) {
  // seed 增加 count?: number
  snapshot.count = seed.count ?? 1
}
```

调用侧修改：

| 调用位置 | 传参 |
|---|---|
| `useBlueprintProductionStore.syncPlanStationDerivedSnapshot` | `station.count` |
| `useBlueprintProductionStore.initializeAllStationDerived` | `station.count` |
| `useBlueprintProductionStore.getSavedStationGroupedFlows` | `station.count ?? 1` |
| `useLiveProductionStore` 中所有 `upsertStation` 调用 | `station.count`（或 archive 记录的 count） |
| `productionStationShared.computeStationFlow` | `station.count ?? 1` |

## Facade 层简化

### `empireGroupedFlows`（empire 分支）

从：
```typescript
return analyzeEmpireWareFlow(activeEmpire.value.stations, ..., waresMap.value || {})
```

变为：
```typescript
if (!activeEmpire.value) return createEmptyEmpireGroupedFlows()
return flowMap.getEmpireGroupedFlows()
```

`modulesMap` 不再需要作为 guard（缓存计算在 StationDerivedMap 内部完成）。

### `rawSectorGroupedFlowsMap`

从遍历 `productionStations` + 调 `analyzeEmpireWareFlow` 变为遍历 `productionSectors` + 调 `flowMap.getSectorGroupedFlows(sectorId)`。
