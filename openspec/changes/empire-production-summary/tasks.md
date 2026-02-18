## 1. 类型定义

- [ ] 1.1 在 `src/types/x4.ts` 中添加 `EmpireFlowAtom` 接口（扩展 `ModuleFlowAtom`，添加 `stationId` 和 `stationName` 字段）
- [ ] 1.2 在 `src/types/x4.ts` 中添加 `EmpireWareFlow` 接口（包含汇总数据和 `EmpireFlowAtom[]` 明细）
- [ ] 1.3 在 `src/types/x4.ts` 中添加 `EmpireGroupedFlows` 接口（包含 `products`、`operations`、`supply` 三组）

## 2. 缓存机制

- [ ] 2.1 在 `useEmpireStore.ts` 中添加 `stationFlowCache` ref（`Map<stationId, GroupedFlows>`）
- [ ] 2.2 在 `useEmpireStore.ts` 中添加 `refreshStationFlowCache(stationId)` 方法
- [ ] 2.3 在 `useEmpireStore.ts` 的 `initialize` 方法中为所有空间站初始化缓存
- [ ] 2.4 在 `updateStationModules` 方法中调用 `refreshStationFlowCache` 更新缓存
- [ ] 2.5 在 `useEmpireStore.ts` 中添加 `getStationFlowCache(stationId)` getter

## 3. 聚合逻辑

- [ ] 3.1 创建 `src/store/logic/analyzeEmpireWareFlow.ts` 文件
- [ ] 3.2 实现 `aggregateSupplyGroup` 函数（从各站 `rateGroups.supply` 聚合）
- [ ] 3.3 实现 `aggregateCandidates` 函数（从各站 `rateGroups.operations` 和过滤后的 `rateGroups.positive` 聚合）
- [ ] 3.4 实现 `classifyCandidates` 函数（根据 `netRate` 归类到产品组或运营组）
- [ ] 3.5 实现 `analyzeEmpireWareFlow` 主函数（整合上述函数，返回 `EmpireGroupedFlows`）
- [ ] 3.6 在 `useEmpireStore.ts` 中添加 `empireGroupedFlows` computed 属性

## 4. 帝国视图组件

- [ ] 4.1 创建 `src/components/EmpireWareFlowsDashboard.vue` 主组件
- [ ] 4.2 实现视图切换 UI（数量视图/经济视图）
- [ ] 4.3 创建 `src/components/EmpireWareFlowGroup.vue` 分组容器组件
- [ ] 4.4 创建 `src/components/EmpireWareFlow.vue` 单个资源流项组件
- [ ] 4.5 实现明细展开功能（显示各空间站贡献）

## 5. UI 集成

- [ ] 5.1 修改 `StationWorkbench.vue`，在 `activeStationId === null` 时渲染 `EmpireWareFlowsDashboard`
- [ ] 5.2 添加 i18n 翻译键（产品/运营/补给、产品收入/运营支出/补给收入/补给支出）

## 6. 测试

- [ ] 6.1 编写 `analyzeEmpireWareFlow` 单元测试
- [ ] 6.2 编写 EmpireStore 缓存机制单元测试
- [ ] 6.3 编写帝国视图组件 E2E 测试
