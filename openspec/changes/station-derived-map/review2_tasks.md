# station-derived-map Review 2 Tasks

## Tasks

### Phase R2-1: 移除错误 watcher

- [x] R2-1. 删除 `useBlueprintProductionStore` 中监听 `stationId/gameReady/buildPrice/enforceDlcActivation` 后统一执行 `planningDerivedMap.compute(...)` 的 watch
- [x] R2-2. 禁止重新引入同类"多触发源 -> 单 compute 回调" watcher

### Phase R2-2: 收口 planning 重算入口

- [x] R2-3. 新增 `initializeAllStationDerived()`
- [x] R2-4. 新增 `recomputePlanStationDerived(stationId)`
- [x] R2-5. 新增 `recomputePlanStationFlowOnly(stationId)`
- [x] R2-6. 禁止在 blueprint store 其他路径直接手写 `planningDerivedMap.compute(...)`
- [x] R2-6a. live store planning 路径使用 `planningDerivedMap`（已替换）
- [x] R2-6b. live store 使用 `buildStationSemantics` 和 `buildArchiveSemantics`
- [x] R2-6c. live store 已有 `syncAllBindingStationsToStateMap` 和 `syncLiveFlowMapForStation`

### Phase R2-3: 绑定触发矩阵

- [x] R2-7. `gameData.isReady` 从未就绪变为就绪时，调用 `initializeAllStationDerived()`
- [x] R2-8. `gameData.enforceDlcActivation` 变动时，对全部 planning stations 执行 `recomputePlanStationDerived(stationId)` 并更新聚合
- [x] R2-9. `activeStationId` 变动时，不执行任何 derived 重算（watch 已删除）
- [x] R2-10. `buildPriceMultiplier` 变动时，不执行任何 derived 重算（watch 已删除）

### Phase R2-4: 修正 blueprint 模块变动路径

- [x] R2-11. `plannedModules` 写路径改为调用 `recomputePlanStationDerived(stationId)`
- [x] R2-12. `lockedWares` 写路径改为调用 `recomputePlanStationDerived(stationId)` + `updateAggregation`
- [x] R2-13. `warePriority` 写路径改为只调用 `updateAggregation`
- [x] R2-14. `settings` 写路径改为调用 `recomputePlanStationFlowOnly(stationId)`
- [x] R2-15. `moduleActions` 全部写路径改为调用 `recomputeDerived`
- [x] R2-15a. `wareRuleActions` 的 `recompute` 注入改为 flow-only 固定入口
- [x] R2-15b. `settingActions` 的 `recompute` 注入改为 flow-only 固定入口
- [x] R2-15c. `initializeAllStationCaches` 重命名为 `initializeAllStationDerived`
- [x] R2-15d. 函数已重命名
- [x] R2-15e. 函数已重命名

### Phase R2-5: 修正遗漏场景

- [x] R2-19a. `useLiveProductionStore.plannedModules` 使用 `recomputeBindingPlanDerived`
- [x] R2-19h. `syncAllBindingStationsToStateMap` 已更新使用 `buildStationSemantics`

### Phase R2-6: 清理调用点

- [x] R2-20. 已检查 blueprint store 所有 `planningDerivedMap.compute(...)` 调用点
- [x] R2-21. 已检查 live store 所有 `planningDerivedMap.compute(...)` 调用点
- [x] R2-22. 所有 compute 调用已移到固定入口内部或通过 actions 注入
- [x] R2-22a. 修改 `createProductionModuleActions`，将注入接口 `recompute` 改名为 `recomputeDerived`
- [x] R2-22b. blueprint/live 两个 store 适配 `recomputeDerived` 注入
- [x] R2-23. 确认 `getTabs()` 只读取 cache，不触发任何补算

### Phase R2-7: 文档与验证

- [x] R2-25. 运行 `npm run build` ✓

## 禁止事项

- [x] 禁止保留当前 watch
- [x] 禁止 `stationId` 切换触发 compute
- [x] 禁止 `buildPriceMultiplier` 变动触发 compute
- [x] 禁止 blueprint store 散落直接调用 `planningDerivedMap.compute(...)`
- [x] 禁止 module 变动路径漏掉 semantics
- [x] 禁止 setting 变动路径更新 semantics