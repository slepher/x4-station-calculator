## 1. 类型定义

- [x] 1.1 在 `src/types/x4.ts` 中为 `StationPlan` 添加 `count` 字段（可选，默认为 1）
- [x] 1.2 在 `src/types/x4.ts` 中添加 `EmpireFlowAtom` 接口（扩展 `ModuleFlowAtom`，添加 `stationId`、`stationName`、`stationCount` 字段）
- [x] 1.3 在 `src/types/x4.ts` 中添加 `EmpireWareFlow` 接口（包含汇总数据和 `EmpireFlowAtom[]` 明细）
- [x] 1.4 在 `src/types/x4.ts` 中更新 `EmpireGroupedFlows` 接口（聚合层保留 `operations`、`supply` 两组；总览展示层再按 `netRate` 拆分产品/运营）

## 2. 空间站数量功能

- [x] 2.1 在 `useEmpireStore.ts` 的 `createDefaultStation` 中添加 `count: 1` 默认值
- [x] 2.2 在 `useEmpireStore.ts` 的数据加载逻辑中，处理 `count` 为 `null` 或 `undefined` 的情况，设为 `1`
- [x] 2.3 修改 `ContextToolbar.vue` 中的 `stationCount` computed，绑定到 `empireStore.activeStation.count`
- [x] 2.4 在 `ContextToolbar.vue` 中设置 `stationCount` 的 `min` 为 `0`

## 3. 缓存机制

- [x] 3.1 在 `useEmpireStore.ts` 中添加 `stationFlowCache` ref（`Map<stationId, GroupedFlows>`）
- [x] 3.2 在 `useEmpireStore.ts` 中添加 `refreshStationFlowCache(stationId)` 方法
- [x] 3.3 在 `useEmpireStore.ts` 中添加 watch 监听 `activeStation` 变化（比较 stationId 和 lastUpdated，避免切换 tab 时触发）
- [x] 3.4 在 `useEmpireStore.ts` 的 `initialize` 方法中为所有空间站初始化缓存
- [x] 3.5 在 `loadEmpire` 方法中清空旧缓存并为新帝国所有空间站创建缓存
- [x] 3.6 在 `createStation` 方法中创建新缓存
- [x] 3.7 在 `deleteStation` 方法中删除对应缓存
- [x] 3.8 在 `duplicateStation` 方法中创建新缓存
- [x] 3.9 在 `useEmpireStore.ts` 中添加 `getStationFlowCache(stationId)` getter

## 4. 聚合逻辑

- [x] 4.1 创建 `src/store/logic/analyzeEmpireWareFlow.ts` 文件
- [x] 4.2 实现 `aggregateSupplyGroup` 函数（从各站 `rateGroups.supply` 聚合，乘以 `count`，跳过 `count === 0`）
- [x] 4.3 实现 `aggregateCandidates` 函数（从各站 `rateGroups.operations` 和过滤后的 `rateGroups.positive` 聚合，乘以 `count`）
- [x] 4.4 实现 `classifyCandidates` 函数（根据 `netRate` 归类到产品组或运营组）
- [x] 4.5 实现 `analyzeEmpireWareFlow` 主函数（整合上述函数，返回 `EmpireGroupedFlows`）
- [x] 4.6 在 `useEmpireStore.ts` 中添加 `empireGroupedFlows` computed 属性

## 4.5. 产物过滤逻辑优化

- [x] 4.5.1 创建 `src/store/logic/filterGroupedFlowsByPriority.ts` 文件
- [x] 4.5.2 实现 `filterGroupedFlowsByPriority` 函数（过滤 `rateGroups.positive` 中 `priorityLevel === 0` 的资源）
- [x] 4.5.3 修改 `refreshStationFlowCache`，在 `analyzeWareFlow` 后调用 `filterGroupedFlowsByPriority`
- [x] 4.5.4 修改 `analyzeEmpireWareFlow`，移除 `getWarePriorityLevel` 参数
- [x] 4.5.5 修改 `empireGroupedFlows` computed，移除全局 `getWarePriorityLevel` 函数

## 5. 帝国视图组件

- [x] 5.1 创建 `src/components/EmpireWareFlowsDashboard.vue` 主组件
- [x] 5.2 实现视图切换 UI（数量视图/经济视图）
- [x] 5.3 创建 `src/components/EmpireWareFlowGroup.vue` 分组容器组件
- [x] 5.4 创建 `src/components/EmpireWareFlow.vue` 单个资源流项组件
- [x] 5.5 实现明细展开功能（显示各空间站贡献，包含 `stationCount`）

## 6. UI 集成

- [x] 6.1 修改 `StationWorkbench.vue`，在 `activeStationId === null` 时渲染 `EmpireWareFlowsDashboard`
- [x] 6.2 添加 i18n 翻译键（产品/运营/补给、产品收入/运营支出/补给收入/补给支出）

## 7. 测试

- [x] 7.1 编写 `analyzeEmpireWareFlow` 单元测试
- [x] 7.2 编写 EmpireStore 缓存机制单元测试
- [x] 7.3 编写空间站数量功能单元测试
- [x] 7.4 编写帝国视图组件 E2E 测试
