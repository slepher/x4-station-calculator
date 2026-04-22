# remove-workbench 实现任务

## Tasks

- [x] Task 1: 创建 `remove-workbench` 规划文档并同步上下游 change 结论
- [x] Task 2: 扩展正式类型，补齐替代旧 getter 所需字段
- [x] Task 3: 重构 `useProductionTabbarPresenter`
- [x] Task 4: 重构 `useProductionToolbarPresenter`
- [x] Task 5: 重构 `useProductionPlanningPresenter`
- [x] Task 6: 重构 `useProductionWareflowPresenter`
- [x] Task 7: 重构 `useProductionDashboardPresenter`
- [x] Task 8: 收缩 `BlueprintProductionWorkbenchView.vue`
- [x] Task 9: 收缩 `LiveProductionWorkbenchView.vue`
- [x] Task 10: 删除 `useBlueprintProductionStore` 旧兼容导出
- [x] Task 11: 删除 `useLiveProductionStore` 旧兼容导出
- [x] Task 12: 清理 `production-workbench-contract.ts` 与相关残留类型
- [x] Task 13: 建立旧接口静态门禁
- [ ] Task 14: build 验证

## Phase 1: 文档与输入冻结

### Task 1: 创建 `remove-workbench` 规划文档并同步上下游 change 结论

- [x] 创建 `openspec/changes/remove-workbench/request.md`
- [x] 创建 `openspec/changes/remove-workbench/specs/remove-workbench/spec.md`
- [x] 创建 `openspec/changes/remove-workbench/design.md`
- [x] 创建 `openspec/changes/remove-workbench/tasks.md`
- [x] 将 `production-store-present-view` 中未完成项映射为本次 change 的直接任务
- [x] 将 `user-save-binding-station/station-store-refactory.md` 中已完成的前置迁移视为已知前提，不重复造桥

## Phase 2: 正式边界补齐

### Task 2: 扩展正式类型，补齐替代旧 getter 所需字段

**文件**

- 修改：`src/types/production-workbench-contract.ts`
- 修改：`src/store/useBlueprintProductionStore.ts`
- 修改：`src/store/useLiveProductionStore.ts`

**必须落实**

- [x] 在 `ProductionStationState` 新增 `stationType`
- [x] 在 `ProductionStationState` 新增 `count`
- [x] 在 `ProductionStationState` 新增 `minerals`
- [x] 在 `ProductionStationState` 新增 `enforceDlcActivation`
- [x] 在 `ProductionStationState` 新增 `empireGaps`
- [x] 在 `ProductionStationState` 新增 `currentEfficiency`
- [x] 在 `ProductionStationState` 新增 `actualWorkforce`
- [x] 在 `ProductionStationState` 新增 `buildPriceMultiplier`
- [x] 在 `ProductionSessionState` 新增 `wareflowViewMode`
- [x] 为两个 store 新增正式动作 `selectTransitSector(sectorId | null)`
- [x] 为两个 store 新增正式动作 `setExpandedSector(sectorId | null)`
- [x] 为 live store 新增正式字段 `expandedSectorId`
- [x] 将 `enforceDlcActivation` 收口到 `stationState.enforceDlcActivation`

**完成标准**

- [x] 后续 presenter 不再需要通过旧 getter 才能拿到 tabbar/toolbar/planning/wareflow/dashboard 所需主数据

## Phase 3: Presenter 重构

### Task 3: 重构 `useProductionTabbarPresenter`

**文件**

- 修改：`src/components/empire/presenters/useProductionTabbarPresenter.ts`

**必须删除的依赖**

- [x] `getTabs`
- [x] `getActiveTabId`
- [x] `getExpandedSectorId`
- [x] `selectOverview`
- [x] `selectTransit`
- [x] `expandSector`

**必须改为读取**

- [x] `session`
- [x] `capabilities`
- [x] blueprint: `orderedStations`
- [x] live: `sectors`
- [x] live: `orderedStationsBySector`
- [x] live: `expandedSectorId`
- [x] 正式动作：`selectStation`
- [x] 正式动作：`selectTransitSector`
- [x] 正式动作：`setExpandedSector`

**必须落实的组装规则**

- [x] blueprint tabs 由 presenter 把 `orderedStations` 映射为 station tabs
- [x] live tabs 由 presenter 在 `sectors` 与 `orderedStationsBySector` 上叠加 transit tab
- [x] transit tab id 固定为 `transit:${sectorId}`
- [x] activeTabId 由 presenter 根据 `session.workbenchMode`、`session.activeStationId`、`session.activeTransitSectorId` 推导

### Task 4: 重构 `useProductionToolbarPresenter`

**文件**

- 修改：`src/components/empire/presenters/useProductionToolbarPresenter.ts`

**必须删除的依赖**

- [x] `getTitleModel`
- [x] `getToolbarStation`
- [x] `getToolbarRaces`
- [x] `getToolbarStationTypes`
- [x] `getAvailableMinerals`
- [x] `getSingleBerthThroughput`

**必须改为读取**

- [x] `session`
- [x] `context`
- [x] `stationState`
- [x] `settingActions`
- [x] 正式标题源字段

**必须落实的组装规则**

- [x] title model 由 presenter 组装
- [x] station 基本信息由 presenter 从 `stationState` 组装
- [x] races 选项表移入 presenter
- [x] stationTypes 选项表移入 presenter
- [x] available minerals 选项表移入 presenter
- [x] throughput 由 presenter 基于 settings 派生

### Task 5: 重构 `useProductionPlanningPresenter`

**文件**

- 修改：`src/components/empire/presenters/useProductionPlanningPresenter.ts`

**必须删除的依赖**

- [x] `getEnforceDlcActivation`

**必须改为读取**

- [x] `session`
- [x] `context`
- [x] `stationState`
- [x] `moduleActions`

**必须落实的组装规则**

- [x] `enforceDlcActivation` 直接改读 `stationState.enforceDlcActivation`
- [x] presenter 内只处理 station/transit 展示分支，不再向 store 请求 planning panel getter

### Task 6: 重构 `useProductionWareflowPresenter`

**文件**

- 修改：`src/components/empire/presenters/useProductionWareflowPresenter.ts`

**必须删除的依赖**

- [x] `getWareflowViewMode`
- [x] `getEmpireGaps`

**必须改为读取**

- [x] `session.wareflowViewMode`
- [x] `stationState.productionFlows`
- [x] `stationState.settings`
- [x] `stationState.empireGaps`
- [x] `wareRuleActions`
- [x] `moduleActions`
- [x] `settingActions`

### Task 7: 重构 `useProductionDashboardPresenter`

**文件**

- 修改：`src/components/empire/presenters/useProductionDashboardPresenter.ts`

**必须删除的依赖**

- [x] `getCurrentEfficiency`
- [x] `getActualWorkforce`
- [x] `getBuildPriceMultiplier`

**必须改为读取**

- [x] `stationState.currentEfficiency`
- [x] `stationState.actualWorkforce`
- [x] `stationState.buildPriceMultiplier`
- [x] `stationState.settings`
- [x] `context.archiveModules`
- [x] `context.buildingModules`

## Phase 4: View 收缩

### Task 8: 收缩 `BlueprintProductionWorkbenchView.vue`

**文件**

- 修改：`src/components/empire/BlueprintProductionWorkbenchView.vue`

**必须删除**

- [x] 为 panel 数据组装服务的多余 computed
- [x] 对旧 getter 兼容层的隐式依赖

**最终只保留**

- [x] `loadEmpire`
- [x] `importModalOpen`
- [x] presenter 创建
- [x] 子组件渲染

### Task 9: 收缩 `LiveProductionWorkbenchView.vue`

**文件**

- 修改：`src/components/empire/LiveProductionWorkbenchView.vue`

**必须删除**

- [x] 为 panel 数据组装服务的多余 computed
- [x] 对旧 getter 兼容层的隐式依赖
- [x] 把 transit 解释为第二套主状态对象的写法

**最终只保留**

- [x] `openBinding`
- [x] `importModalOpen`
- [x] presenter 创建
- [x] 基于 `session.workbenchMode` 的区块切换
- [x] overview 特有渲染
- [x] 子组件渲染

## Phase 5: Store 旧兼容导出清理

### Task 10: 删除 `useBlueprintProductionStore` 旧兼容导出

**文件**

- 修改：`src/store/useBlueprintProductionStore.ts`

**必须删除的导出**

- [x] `getTabs`
- [x] `getActiveTabId`
- [x] `getExpandedSectorId`
- [x] `getTitleModel`
- [x] `getToolbarStation`
- [x] `getToolbarRaces`
- [x] `getToolbarStationTypes`
- [x] `getAvailableMinerals`
- [x] `getSingleBerthThroughput`
- [x] `getEnforceDlcActivation`
- [x] `getWareflowViewMode`
- [x] `getEmpireGaps`
- [x] `getCurrentEfficiency`
- [x] `getActualWorkforce`
- [x] `getBuildPriceMultiplier`
- [x] `selectOverview`
- [x] `selectTransit`
- [x] `expandSector`
- [x] `openImport`

**必须保留的正式导出**

- [x] `session`
- [x] `context`
- [x] `stationState`
- [x] 正式动作接口
- [x] `capabilities`
- [x] `isReady`
- [x] `isDirty`
- [x] `isEmptyForSave`
- [x] `importModalOpen`
- [x] blueprint 生命周期动作
- [x] import 辅助能力

### Task 11: 删除 `useLiveProductionStore` 旧兼容导出

**文件**

- 修改：`src/store/useLiveProductionStore.ts`

**必须删除的导出**

- [x] `getTabs`
- [x] `getActiveTabId`
- [x] `getExpandedSectorId`
- [x] `getTitleModel`
- [x] `getToolbarStation`
- [x] `getToolbarRaces`
- [x] `getToolbarStationTypes`
- [x] `getAvailableMinerals`
- [x] `getSingleBerthThroughput`
- [x] `getEnforceDlcActivation`
- [x] `getWareflowViewMode`
- [x] `getEmpireGaps`
- [x] `getCurrentEfficiency`
- [x] `getActualWorkforce`
- [x] `getBuildPriceMultiplier`
- [x] `selectOverview`
- [x] `selectTransit`
- [x] `expandSector`
- [x] `openImport`

**必须保留的正式导出**

- [x] `session`
- [x] `context`
- [x] `stationState`
- [x] 正式动作接口
- [x] `capabilities`
- [x] `isReady`
- [x] `isDirty`
- [x] `isEmptyForSave`
- [x] `importModalOpen`
- [x] live 生命周期动作
- [x] `sectors`
- [x] `orderedStationsBySector`
- [x] `expandedSectorId`
- [x] import 辅助能力

## Phase 6: 类型与门禁清理

### Task 12: 清理 `production-workbench-contract.ts` 与相关残留类型

**文件**

- 修改：`src/types/production-workbench-contract.ts`
- 修改：相关 presenter store 类型声明

**必须落实**

- [x] 删除旧 contract 中对 panel getter 的表达
- [x] 增加 `stationType`
- [x] 增加 `count`
- [x] 增加 `minerals`
- [x] 增加 `enforceDlcActivation`
- [x] 增加 `empireGaps`
- [x] 增加 `currentEfficiency`
- [x] 增加 `actualWorkforce`
- [x] 增加 `buildPriceMultiplier`
- [x] 增加 `wareflowViewMode`
- [x] 清理与旧兼容层绑定的注释与命名

### Task 13: 建立旧接口静态门禁

**文件**

- 修改：静态检查配置文件
- 修改：必要的 lint / grep / script 门禁文件

**必须覆盖**

- [x] `getTabs`
- [x] `getActiveTabId`
- [x] `getExpandedSectorId`
- [x] `getTitleModel`
- [x] `getToolbar`
- [x] `getAvailableMinerals`
- [x] `getSingleBerthThroughput`
- [x] `getEnforceDlcActivation`
- [x] `getWareflow`
- [x] `getEmpireGaps`
- [x] `getCurrentEfficiency`
- [x] `getActualWorkforce`
- [x] `getBuildPriceMultiplier`

**完成标准**

- [x] 旧接口定义已从 production store / presenter 主路径删除，无残留兼容导出
- [x] 新增任意旧接口调用时，工具会报错或告警

## Phase 7: 验证

### Task 14: build 验证

**必须执行**

- [x] `npm run build`

**必须确认**

- [ ] blueprint workbench 可进入 station 主视图
- [ ] live workbench 可进入 overview / station / transit
- [ ] import modal 仍可打开
- [x] `session.workbenchMode` 仍为正式状态字段
- [x] store 已不再导出旧兼容接口
