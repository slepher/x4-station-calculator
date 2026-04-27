# Empire Sector Flows Cache - Tasks

## Tasks

### Phase 1: count 字段传递

- [ ] T1. `StationDerivedSeed` 增加可选 `count?: number`
- [ ] T2. `StationDerivedSnapshot` 增加 `count: number`
- [ ] T3. `upsertStation()` 从 seed 读取 `count`（默认 1）存入 snapshot
- [ ] T4. 更新 `useBlueprintProductionStore` 中所有 `upsertStation` 调用，传入 `station.count`
- [ ] T5. 更新 `useLiveProductionStore` 中所有 `upsertStation` 调用，传入 station 的 `count`
- [ ] T6. 更新 `productionStationShared.computeStationFlow` 调用，传入 `station.count ?? 1`

### Phase 2: updateAggregation 重构

- [ ] T7. 重写 `updateAggregation()`，产出 `empireGroupedFlowsCache: EmpireGroupedFlows` 和 `sectorGroupedFlowsCache: Map<string, EmpireGroupedFlows>`
- [ ] T8. 在循环中逐 station 读取 `count`，对 flow 的 `production/consumption/workforceConsumption/netRate` 乘以 `count`
- [ ] T9. 构建 `class='station'` 的贡献条目，按 `analyzeEmpireWareFlow` 的分类逻辑（supply / operations / positive）聚合
- [ ] T10. 删除 `empireFlowsCache` 字段和 `mergeFlows` 调用
- [ ] T11. 删除 `sectorFlowsCache` 字段

### Phase 3: 新 getter 与旧 getter 清理

- [ ] T12. 新增 `getSectorGroupedFlows(sectorId: string): EmpireGroupedFlows`，读取 `sectorGroupedFlowsCache`
- [ ] T13. 修改 `getEmpireGroupedFlows()` 为无参，读取 `empireGroupedFlowsCache`
- [ ] T14. 删除 `getEmpireFlows()` 方法
- [ ] T15. 删除 `getSectorFlows()` 方法
- [ ] T16. 删除 `clear()` 方法中 `empireFlowsCache` 和 `sectorFlowsCache` 的清理代码，新增 `empireGroupedFlowsCache` 和 `sectorGroupedFlowsCache` 的清理
- [ ] T17. 更新 `refreshAll()` 确保新缓存正确构建

### Phase 4: Facade 侧改读缓存

- [ ] T18. `empireFlowFacade.empireGroupedFlows`（empire 分支）改为调 `flowMap.getEmpireGroupedFlows()` 无参
- [ ] T19. guard 从 `!modulesMap.value` 改为 `!activeEmpire.value`（无需 waresMap 保护）
- [ ] T20. `empireFlowFacade.rawSectorGroupedFlowsMap` 改为遍历 sectors + 调 `flowMap.getSectorGroupedFlows(sectorId)`
- [ ] T21. 删除 `rawSectorGroupedFlowsMap` 中内联的 `analyzeEmpireWareFlow` 调用
- [ ] T22. guard 从 `!modulesMap.value || !waresMap.value` 简化为空 map 直接返回

### Phase 5: Blueprint Store 侧改读缓存

- [ ] T23. `useBlueprintProductionStore.getEmpireGroupedFlows()` 改为调 `planningDerivedMap.getEmpireGroupedFlows()` 无参
- [ ] T24. 删除 `filterFn` 参数传递

### Phase 6: 构建验证

- [ ] T25. 运行时确认 `removeStation` 后缓存正确（通过下次 `computeInternal` 重建）
- [ ] T26. `npm run build`，修复编译错误直到通过

## 执行顺序

```
Phase 1 (count 字段传递):
  T1-T6   seed/snapshot/callers

Phase 2 (updateAggregation):
  T7-T11  重写算法，新旧缓存替换

Phase 3 (getter):
  T12-T17 新 getter + 旧 getter 清理

Phase 4 (facade):
  T18-T22 两个 computed 改读缓存

Phase 5 (blueprint):
  T23-T24 无参调用

Phase 6 (build):
  T25-T26 验证
```

## 依赖

- 前置依赖：`one-flow-contribution`（`FlowContribution` 类型变更先完成，本 change 使用 `class='station'` 贡献格式）

## 完成定义

- [ ] `count` 字段正确传递到 snapshot 并影响 flow 聚合
- [ ] `updateAggregation()` 产出 `EmpireGroupedFlows` 级缓存
- [ ] 旧 flat caches 及相关 getter 已清理
- [ ] `getEmpireGroupedFlows()` 为无参缓存读取
- [ ] facade 的 empire 和 sector 聚合改读缓存
- [ ] blueprint store 使用无参调用
- [ ] `npm run build` 通过
