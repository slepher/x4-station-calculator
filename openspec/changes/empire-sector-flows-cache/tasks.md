# Empire Sector Flows Cache - Tasks

## Tasks

### Phase 0: 构造函数扩展

- [x] T0a. `StationDerivedMap` 构造函数增加 `options?: { hasSector?: boolean }`
- [x] T0b. `StationDerivedMapOptions` 接口新增 `sectorLinks?: string[]`
- [x] T0c. 所有构造调用侧传参：
  - `useBlueprintProductionStore` → 不传 options（`hasSector: false`）
  - `useLiveProductionStore` → `createDerivedMap()` 传 `{ hasSector: true, sectorLinks }`
  - `productionStationShared` → 不传 options

### Phase 1: count 字段传递

- [x] T1. `StationDerivedSeed` 增加可选 `count?: number`
- [x] T2. `StationDerivedSnapshot.count` 从 seed 读取（而非硬编码 1），默认 1
- [x] T3. `upsertStation()` 从 seed 读取 `count` 存入 snapshot
- [x] T4a. `useBlueprintProductionStore.syncPlanStationDerivedSnapshot`（L307）：seed 追加 `count: station.count`
- [x] T4b. `useBlueprintProductionStore.getSavedStationGroupedFlows`（L344）：seed 追加 `count: station.count`
- [x] T4c. `useBlueprintProductionStore.initializeAllStationDerived`（L360）：seed 追加 `count: station.count`
- [x] T5. `productionStationShared.computeStationFlow`（L184）：seed 追加 `count: station.count ?? 1`
- [x] T6. 确认 live 侧 4 处 `upsertStation` 不传 count（默认 1）

### Phase 2: updateAggregation 重构

- [x] T7. 按 `hasSector` 分支实现：
  - `false`：只构建 `empireFlowsCache`（count 加权 merge）
  - `true`：构建全部 3 份缓存
- [x] T8. local 合并逻辑：循环内读取 `snapshot.count`，对 `production/consumption/netRate` 乘以 `count`
- [x] T9. `contributions[].amount` 也乘以 `count`
- [x] T10. 合并到 `empireFlowsCache`（始终）和 `sectorFlowsCache`（`hasSector=true` 时）
- [x] T11. solver 衔接：`buildExternalCache()` 从 `sectorFlowsCache` 提取 container netByWare → 调 `solveMultiWareByLink()` → 输出转 `WareProductionFlow[]` → `sectorExternalCache`
- [x] T12. 新增私有字段 `sectorExternalCache: Map<string, WareProductionFlow[]>`

### Phase 3: getter 变更

- [x] T13. 删除 `getEmpireGroupedFlows()` 方法
- [x] T14. 从 import 中移除 `analyzeEmpireWareFlow`
- [x] T15. 保留 `getEmpireFlows()` / `getSectorFlows(sectorId)`（内容已含 count）
- [x] T16. 新增 `getSectorExternalFlows(sectorId): WareProductionFlow[]`（不存在返回 `[]`）
- [x] T17. 新增 `getSectorCombinedFlows(sectorId): WareProductionFlow[]`（`mergeFlows` 合并 local + external）

### Phase 4: Facade 层改读缓存

- [x] T18. 实现 `classifyAndEnrichFlows(flows: WareProductionFlow[], waresMap): EmpireGroupedFlows`
- [x] T19. `empireGroupedFlows` computed → 读 `flowMap.getEmpireFlows()` + `classifyAndEnrichFlows()`
- [x] T20. `rawSectorGroupedFlowsMap` computed → 读 `flowMap.getSectorFlows(sector.id)` + `classifyAndEnrichFlows()`
- [x] T21. guard 简化：`modulesMap` guard 移除，`waresMap` guard 保留
- [x] T22. `getSectorFinalProductionFlows` → `inputFlowMap.value.getSectorCombinedFlows(sectorId)`
- [x] T23. 删除 `sectorLinkCalcMap` computed（solver 移至 StationDerivedMap）
- [x] T24. 删除 `mergeSectorLinkIntoEmpireGroupedFlows` 函数
- [x] T25. 从 import 中移除 `analyzeEmpireWareFlow`、`solveMultiWareByLink`、`SectorLinkInput`、`SolveMultiWareByLinkOutput`、`parseSectorLinkKey`（facade 不再需要）
- [x] T26. 确认 `sectorInternalDataMap` 读 `rawSectorGroupedFlowsMap` 接口不变

### Phase 5: 构建验证

- [ ] T27. 运行时确认 `removeStation` 后 3 份缓存 stale 但不会崩溃
- [x] T28. `npm run build` 通过

## 执行顺序

```
Phase 0 (constructor):
  T0a-T0c  hasSector 选项 + 调用侧传参

Phase 1 (count):
  T1-T6    seed 加 count → blueprint 4 处传入

Phase 2 (updateAggregation):
  T7-T12   hasSector 分支 + 3 份缓存构建

Phase 3 (getter):
  T13-T17  删除 getEmpireGroupedFlows + 新增 getter

Phase 4 (facade):
  T18-T26  3 个入口改读缓存 + 删除 sectorLinkCalcMap

Phase 5 (build):
  T27-T28  验证
```

## 依赖

- 前置依赖：`one-flow-contribution`（`FlowContribution` 类型变更先完成）

## 完成定义

- [x] `StationDerivedMap` 构造函数支持 `hasSector` 选项
- [x] `count` 正确传递（blueprint 侧 4 处）
- [x] `updateAggregation()` 按 `hasSector` 分支产出最多 3 份 `WareProductionFlow[]` 缓存
- [x] `sectorFlowsCache` 含 count 加权 local 贡献
- [x] `sectorExternalCache` 含 solver 物流贡献
- [x] `getEmpireGroupedFlows()` 删除，`getSectorExternalFlows()` 新增
- [x] facade 3 个入口改读缓存（empire / sector local / sector 含物流）
- [x] facade `sectorLinkCalcMap` + `mergeSectorLinkIntoEmpireGroupedFlows` 删除
- [x] `npm run build` 通过
- [ ] T27. 运行时确认 `removeStation` 后 3 份缓存 stale 但不会崩溃
