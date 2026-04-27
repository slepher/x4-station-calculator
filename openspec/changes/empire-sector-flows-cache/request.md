# Empire Sector Flows Cache

## 目标

将 `StationDerivedMap.updateAggregation()` 从构建 flat `WareProductionFlow[]` 改为直接构建 `EmpireGroupedFlows` 级别的缓存，使 facade 层的 empire 和 sector 聚合直接读缓存，消除 `analyzeEmpireWareFlow` 的重复计算。

## 已确认方案（审核重点）

### 1. `StationDerivedSeed` / `Snapshot` 增加 `count`

- `StationDerivedSeed` 新增可选 `count?: number`，默认 1。
- `StationDerivedSnapshot` 新增 `count: number`。
- `upsertStation()` 从 seed 读取 `count` 并存入 snapshot。
- `count` 影响 empire/sector 级 flow 的乘法计算（`flow * count`）。
- `name` 不需要存入 seed/snapshot，显示时从 empire store 获取。

### 2. `updateAggregation()` 产出 `EmpireGroupedFlows`

当前 `updateAggregation()` 产出：
- `empireFlowsCache: WareProductionFlow[]`（无人读取的 flat 缓存）
- `sectorFlowsCache: Map<string, WareProductionFlow[]>`（无人读取的 sector flat 缓存）

改为产出：
- `empireGroupedFlowsCache: EmpireGroupedFlows`（帝国级聚合，含 `class='station'` 的贡献）
- `sectorGroupedFlowsCache: Map<string, EmpireGroupedFlows>`（逐星区聚合）
- 删除 `empireFlowsCache` 和 `sectorFlowsCache`
- 删除对应的 getter 方法 `getEmpireFlows()` 和 `getSectorFlows()`

构建方式：在 `updateAggregation()` 中按 `analyzeEmpireWareFlow` 的算法逻辑，基于 `snapshotMap` 的 `count` + `cacheMap` 的 `productionFlows` 直接聚合。

### 3. `getEmpireGroupedFlows()` 改为无参

- `StationDerivedMap.getEmpireGroupedFlows()` 不再接受参数，改为从 `empireGroupedFlowsCache` 读取。
- 原有带参方法逻辑（调 `analyzeEmpireWareFlow`）由本 change 的缓存替代。
- 新增 `getSectorGroupedFlows(sectorId: string): EmpireGroupedFlows` 从 sector 缓存读取。

### 4. Facade 层读取缓存

- `empireFlowFacade.empireGroupedFlows`（empire 分支）：改为调 `flowMap.getEmpireGroupedFlows()` 无参。
- `empireFlowFacade.rawSectorGroupedFlowsMap`：改为调 `flowMap.getSectorGroupedFlows(sectorId)` 逐 sector 读取。
- 两个 computed 不再需要 `modulesMap` 保护（缓存计算在 StationDerivedMap 内部完成）。
- 两个 computed 不再调用 `analyzeEmpireWareFlow`。

### 5. `useBlueprintProductionStore.getEmpireGroupedFlows()` 改为无参

- 改为调 `planningDerivedMap.getEmpireGroupedFlows()` 无参。
- 不再传入 `stations`、`waresMap` 和 `filterFn`。

### 6. `filterFn` 的去向

当前 facade 和 blueprint store 传入的 `filterFn` 与 `filterProductionFlowsByPriority` 逻辑完全一致。该过滤已在 `updateAggregation()` 中通过 `filterProductionFlowsByPriority` 处理，因此调用侧不再需要传入。

### 7. 缓存失效与刷新

- `updateAggregation()` 在每次 `computeInternal` 后调用（`skipAggregation=false`），保持现有刷新策略不变。
- `refreshAll()`、`clear()` 等生命周期方法同步更新新缓存。
- `removeStation()` 后不自动更新，由上层触发下一次 `computeInternal` 时重建。

## 边界

### In Scope

- `StationDerivedSeed` / `Snapshot` 增加 `count` 字段
- 所有 `upsertStation` 调用侧传入 `count`
- `updateAggregation()` 产出 `EmpireGroupedFlows` 级缓存
- 删除旧的 flat caches 及对应 getter
- `getEmpireGroupedFlows()` 改为无参
- 新增 `getSectorGroupedFlows()`
- facade 层的两个 computed 改读缓存
- `useBlueprintProductionStore.getEmpireGroupedFlows()` 改为无参

### Out of Scope

- `FlowContribution` 类型变更（属于 `one-flow-contribution`）
- `workforceConsumption` 字段消除（属于 `one-flow-contribution`）
- 测试代码编写与执行
- save-binding 路径的缓存改造

## 验收标准（DoD）

1. `StationDerivedSeed` 和 `StationDerivedSnapshot` 包含 `count` 字段
2. 所有 `upsertStation` 调用侧传入 station 的 `count`
3. `updateAggregation()` 构建 `empireGroupedFlowsCache` 和 `sectorGroupedFlowsCache`（`EmpireGroupedFlows`）
4. 删除 `empireFlowsCache` / `sectorFlowsCache`（`WareProductionFlow[]`）
5. 删除 `getEmpireFlows()` / `getSectorFlows()` 方法
6. `getEmpireGroupedFlows()` 为无参，返回缓存
7. `getSectorGroupedFlows(sectorId)` 返回 sector 缓存
8. facade 的 `empireGroupedFlows` 和 `rawSectorGroupedFlowsMap` 改读缓存
9. `useBlueprintProductionStore.getEmpireGroupedFlows()` 改为无参调缓存
10. `npm run build` 通过

## 未决项

- 依赖 `one-flow-contribution` 完成后实现（`FlowContribution` 类型变更先行）
