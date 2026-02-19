## 1. StationStateMap 基础设施

- [x] 1.1 新增 `StationState` 类型与 `StationStateMap` class，定义 `ensure/get/patch/mutate/recompute/remove/clone` 基础接口
- [x] 1.2 在 `StationStateMap` 中接入现有计算链（`calculateAutoFill`、`analyzeWareFlow`、`production/workforce/analyzeStation`）并输出统一分站结果
- [x] 1.3 定义 `fromPersisted/toPersisted` 边界，只序列化可编辑输入字段

## 2. useStationStore 代理化改造

- [x] 2.1 以 `currentStationId` 代理 `plannedModules/settings/lockedWares/warePriority` 的可写访问
- [x] 2.2 将 `autoIndustryModules/autoSupplyModules/groupedFlows/netProduction/stationAnalysis` 改为读取 `StationStateMap` 结果
- [x] 2.3 将 `addModule/removeModule/updateModuleCount/transferModuleFromAutoIndustry` 等 action 改为调用 `StationStateMap.mutate`

## 3. useEmpireStore 聚合与生命周期改造

- [x] 3.1 在 `createStation/duplicateStation/deleteStation/selectStation` 流程中同步调用 `StationStateMap` 生命周期接口
- [x] 3.2 将 `empireGroupedFlows` 聚合来源改为 `StationStateMap` 分站结果，去除重复单站计算路径
- [x] 3.3 清理或降级旧 `stationFlowCache` 真源角色，确保不存在双真源写入

## 4. 持久化与迁移

- [x] 4.1 调整保存与加载流程，确保只持久化输入字段并在加载后重算分站运行态
- [x] 4.2 补充兼容迁移逻辑，处理旧数据缺失字段与默认值填充
- [x] 4.3 将 `settings.showEmpireGaps` 纳入 `StationState` 与持久化输入字段
- [x] 4.4 将 `resourceBufferHours` 迁移逻辑改为 `s.resourceBufferHours !== undefined ? s.resourceBufferHours : 2`
- [x] 4.5 验证切站、刷新、重新进入后数据一致性与隔离性

## 5. 验证与回归

- [x] 5.1 补充单元测试：`StationStateMap` 生命周期、深拷贝隔离、重算触发、持久化边界
- [x] 5.2 补充单元测试：`useStationStore` 代理可写行为（覆盖 `v-model` 场景）
- [x] 5.3 补充集成/E2E 测试：多分站切换隔离、帝国聚合一致性、保存加载回归
