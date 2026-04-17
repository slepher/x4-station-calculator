# Production Store Presenter View 重构需求

## 目标

将 production 主链重构为稳定的 `store -> presenter -> view` 三层结构。

store 只导出领域对象与业务动作；presenter 负责从领域对象组装 UI；view 只负责创建 presenter、切换组件与展示，不再手工拼接碎状态。

## 已确认方案（审核重点）

### 1. store 主对象收敛为 3 类

store 直接对外导出主状态对象，固定为：

1. `session`
2. `context`
3. `stationState`

另外保留 `actions` 作为业务行为入口。

不保留 `workbench` 作为兼容适配层。

### 2. `session` 只表达当前工作上下文

`session` 固定包含：

- `workbenchMode`
- `entityType`
- `mode`
- `visualMode`
- `activeStationId`
- `activeTransitSectorId`
- `activeBinding`
- `canToggle`

`session` 不承载任何面板数据，不承载标题栏、规划栏、dashboard 的派生 props。

### 3. `context` 只表达当前实体的附加上下文

`context` 固定包含：

- `stationCode`
- `sectorId`
- `sectorName`
- `sectorNameId`
- `position`
- `sectorResources`
- `sectorSunlight`
- `hasBinding`
- `hasArchive`
- `archiveModules`
- `buildingModules`

`context` 用于表达当前实体的外部环境和存档/绑定附加信息，不承担主计算结果。

### 4. `stationState` 是唯一主状态对象

`stationState` 固定包含：

- `entityType`
- `id`
- `name`
- `plannedModules`
- `resolvedModules`
- `autoIndustryModules`
- `autoHabitationModules`
- `autoInfrastructureModules`
- `productionFlows`
- `warePriorityLevels`
- `stationAnalysis`
- `settings`

`stationState` 是当前实体的唯一主状态。station 与 transit 都进入同一框架，不再保留 `transitState` 作为独立主对象。

### 5. transit 不再保留独立主对象

上一轮重构后，transit 已经没有必须独立成主领域对象的专属字段。

transit 语义直接映射到 `stationState`：

- `entityType = 'transit'`
- `plannedModules = []`
- `resolvedModules = autoInfrastructureModules`
- `autoIndustryModules = []`
- `autoHabitationModules = []`
- `autoInfrastructureModules = sector 聚合后的基础设施结果`
- `productionFlows = sector final flows`
- `warePriorityLevels = {}`
- `stationAnalysis = 空结构`

任何 transit 特有的展示拼装，都应由 presenter 进行派生，不再由 store 输出单独主对象。

### 6. presenter 是唯一 UI 组装层

`useProductionTabbarPresenter`
`useProductionToolbarPresenter`
`useProductionPlanningPresenter`
`useProductionWareflowPresenter`
`useProductionDashboardPresenter`

统一从 `session/context/stationState` 读取数据，并组装对应 UI props / emits。

presenter 不再依赖一长串按面板命名的 store getter，也不重新计算业务结果。

### 7. view 只负责展示

两个 workbench view 最终只保留：

- 选择 store
- 创建 presenter
- 传递 presenter 输出到子组件
- 基于 `session` 做区域切换

view 不再手写大段 `computed(() => store.xxx)` 组合 UI 数据，不再直接消费零散 store 字段。

### 8. 不保留兼容适配层，并要求静态告警

本次变更不保留 `workbench` 兼容适配层，也不保留旧的 panel-specific getter 作为过渡主路径。

若为了同一提交内的迁移顺序，短暂保留旧入口，必须同时满足：

- 旧入口全部标记 `@deprecated`
- 对旧入口的调用必须触发静态告警
- 静态告警必须进入门禁，不能依赖人工约束或 reviewer 记忆

要求效果是：

- 新代码只能读取 `store.session / store.context / store.stationState`
- 新代码只能调用统一 `actions`
- 任何继续调用旧入口的代码都必须被工具直接指出

## 边界

### In Scope

- `useBlueprintProductionStore` / `useLiveProductionStore` 主状态对象收敛
- `ProductionWorkbenchStoreContract` 按领域对象重构
- 5 个 production presenter 改为从领域对象组装 UI
- `BlueprintProductionWorkbenchView.vue` / `LiveProductionWorkbenchView.vue` 继续瘦身
- 清理 `transitState` 作为独立主对象的设计残留

### Out of Scope

- 生产流算法和 sector 聚合算法重写
- wareflow 展示规则调整
- toolbar / dashboard 视觉改版
- 新增测试用例与测试执行
- 其他非 production workbench 模块重构

## 验收标准（DoD）

1. production store 主状态对外固定为 `session/context/stationState`
2. 不再把 `transitState` 作为独立主对象导出
3. transit 主展示结果可完全通过 `stationState` 表达
4. presenter 只从领域对象与动作接口读取数据，不再依赖面板导向 getter 主路径
5. `BlueprintProductionWorkbenchView.vue` 只保留 store 选择、presenter 创建与展示逻辑
6. `LiveProductionWorkbenchView.vue` 只保留 store 选择、presenter 创建与展示逻辑
7. store 不再新增新的 panel-specific getter
8. 不保留 `workbench` 兼容适配层作为主路径
9. 若同一提交内短暂残留旧入口，调用点必须出现静态告警
10. TypeScript 编译无错误
11. `npm run build` 成功

## 未决项

无
