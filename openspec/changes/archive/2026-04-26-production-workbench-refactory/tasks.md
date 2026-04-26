# Production Workbench Refactory - 实现任务

## 任务概览

- [x] T-Pre-1: BlueprintProduction 星区剥离（由 remove-blueprint-production-sector 完成）
- [x] T-Pre-2: 旧 workbench 兼容层移除（由 remove-workbench 完成）
- [ ] T-1: 公开导出 `archiveStation`，固定 live 领域对象边界
- [ ] T-2: 收窄 `context`，移除 `archiveModules` / `buildingModules`，消除 `stationContext`
- [ ] T-3: `stationState` 补齐 `modules` / `buildingModules`，`activeStationState` plan/live 切换
- [ ] T-4: 收敛 `bindingStation` / `archiveStation` 为当前实体来源，覆盖 station+transit，移除 mode 实体选源分支
- [ ] T-5: 重构 `activeStation` 为 `bindingStation | archiveStation`
- [ ] T-6: 定义并导出 `editableStationPlan`（live store + blueprint store）
- [ ] T-7: 将 station plan 编辑入口迁移到 `editableStationPlan`
- [ ] T-8: 改造 `useProductionTabbarPresenter`
- [ ] T-9: 改造 `useProductionToolbarPresenter`
- [ ] T-10: 改造 `useProductionPlanningPresenter`
- [ ] T-11: 改造 `useProductionWareflowPresenter`
- [ ] T-12: 改造 `useProductionDashboardPresenter`
- [ ] T-13: 收缩 `BlueprintProductionWorkbenchView.vue`
- [ ] T-14: 收缩 `LiveProductionWorkbenchView.vue`
- [ ] T-15: 构建验证

## Phase 1: ✅ 前置完成（来源 changes）

### T-Pre-1: BlueprintProduction 星区剥离

由 `remove-blueprint-production-sector` 完成：

- [x] StationTabBar → SectorStationTabBar 重命名
- [x] 新建简化版 StationTabBar / useStationTabBarModel
- [x] BlueprintProductionStore 移除星区属性（sectors、sectorLinks、activeTransitSectorId 等）
- [x] BlueprintProductionStore 移除星区方法（selectTransitSector、selectOverview 等）
- [x] BlueprintProductionWorkbenchView 移除 Transit/Overview 视图
- [x] LiveProductionWorkbenchView 继续使用 SectorStationTabBar

### T-Pre-2: 旧 workbench 兼容层移除

由 `remove-workbench` 完成：

- [x] 删除两个 store 中旧 getter 导出（getTabs、getToolbarXxx、getWareflowXxx、getDashboardXxx 等）
- [x] Tabbar presenter 重构：改为从 orderedStations/sectors/session 组装
- [x] Toolbar presenter 重构：改为从 session/context/stationState 组装
- [x] Planning presenter 重构：去掉 getEnforceDlcActivation 依赖
- [x] Wareflow presenter 重构：去掉 getWareflowViewMode/getEmpireGaps 依赖
- [x] Dashboard presenter 重构：去掉 getCurrentEfficiency/getActualWorkforce/getBuildPriceMultiplier 依赖
- [x] BlueprintProductionWorkbenchView 收缩
- [x] LiveProductionWorkbenchView 收缩
- [x] ProductionStationState 补全字段
- [x] ProductionSessionState 补全 wareflowViewMode
- [x] 旧 getter 静态门禁建立

## Phase 2: [ ] Presenter 层完善（主工作）

### Task 1: 公开导出 `archiveStation`，固定 live 领域对象边界

- [ ] 将 `archiveStation` computed 加入 `useLiveProductionStore` 的 public return block
- [ ] 审查 `ArchiveStationData` 类型字段：`modules`、`building`、`cargo`、`reservation`、`sector`、`position` 等
- [ ] 为后续 live 专属字段（`workforces`、`tag`、`factoryGroup` 等）预留类型空间
- [ ] 明确 `bindingStation`、`planningStationDraft` 与 `archiveStation` 的职责边界

### Task 2: 收窄 `context`，移除 `archiveModules` / `buildingModules`，消除 `stationContext` 中间层

- [ ] 从 `ProductionContextState` 类型中移除 `archiveModules` / `buildingModules` 字段
- [ ] 更新 `context` computed（live store side）：删除对 `stationContext.archiveModules` / `stationContext.buildingModules` 的引用
- [ ] `context` 的 `hasArchive` 判定保留（只表达"是否存在 archive"的判定结果）
- [ ] 消除 `stationContext` 内部 computed：将其剩余的附属字段合并到 `context` computed 直接组装
- [ ] 删除 `stationContext` computed 定义
- [ ] `visualMode` computed 中对 `stationContext.value?.hasArchive` 的依赖改为直接读取 `archiveStation.value` 判定

### Task 3: `stationState` 补齐 `modules` / `buildingModules` 统一字段

- [ ] 在 `ProductionStationState` 接口中新增 `modules: SavedModule[]` 和 `buildingModules: SavedModule[]`
- [ ] 在 `activeStationState` computed 中按 plan/live 切换填充：
  - plan: `modules = resolvedModules`，`buildingModules = []`
  - live: `modules = archiveStation.modules`，`buildingModules = archiveStation.building.modules`
- [ ] 新增 `activeTransitState` computed（若尚未创建）：负责 transit 模式的 plan/live 切换
- [ ] `stationState` transit 分支改为从 `activeTransitState.value` 读取（不做计算、不做切换）

## Phase 3: [ ] 实体来源收口

### Task 4: 收敛 `bindingStation` / `archiveStation` 为当前实体来源对象

- [ ] 明确 `bindingStation` 覆盖 station + transit 两类实体来源
- [ ] 明确 `archiveStation` 覆盖 station + transit 两类实体来源
- [ ] 移除 `bindingStation` / `archiveStation` 内部以 `mode === 'station'` / `mode === 'transit'` 作为实体选源主路径的残留
- [ ] 确认两者不再用于 UI 组装或编辑目标

### Task 5: 重构 `activeStation` 为 `bindingStation | archiveStation`

- [ ] 将 `activeStation` 改为统一实体归一化层，规则：`bindingStation ?? archiveStation`
- [ ] 保证 `station` / `transit` 页面下都可获得统一当前实体
- [ ] 删除 `activeStation` 上混入的"当前可编辑 plan"职责
- [ ] 确认 `activeStation` 的统一建立在来源层已真实收口的前提上

## Phase 4: [ ] 编辑入口迁移

### Task 6: 定义并导出 `editableStationPlan`

- [ ] 在 `useLiveProductionStore` 中新增 `editableStationPlan` computed
- [ ] 规则：`station` 模式取当前 binding plan，`transit` 模式返回 `null`
- [ ] 字段覆盖：`id`、`name`、`type`、`sectorId`、`modules`、`settings`、`lockedWares`、`warePriority`
- [ ] 在 `useBlueprintProductionStore` 中新增 `editableStationPlan`（指向普通站点对象）

### Task 7: 将 station plan 编辑入口迁移到 `editableStationPlan`

- [ ] `plannedModules` 改为只读写 `editableStationPlan`
- [ ] `lockedWares` 改为只读写 `editableStationPlan`
- [ ] `warePriority` 改为只读写 `editableStationPlan`
- [ ] station module actions 改为以 `editableStationPlan` 为 mutation target
- [ ] station ware rule actions 改为以 `editableStationPlan` 为 mutation target
- [ ] station side settings 写入口改为以 `editableStationPlan` 为 mutation target
- [ ] blueprint store 同步对齐

## Phase 5: [ ] Presenter 回收 UI 组装

### Task 8: 改造 `useProductionTabbarPresenter`

- [ ] 只从正式主接口与业务动作读取数据
- [ ] 停止依赖旧 panel-specific getter 主路径（前提已确保）
- [ ] 保持 station / transit / overview tab 映射逻辑只存在于 presenter

### Task 9: 改造 `useProductionToolbarPresenter`

- [ ] 从 store 领域对象映射 toolbar props
- [ ] `hasBinding` / `hasArchive` 改为从领域对象判定（`bindingStation !== null` / `archiveStation !== null`）
- [ ] `liveModules` / `liveBuildingModules` 改从 `archiveStation` 读取（不再从 `context`）
- [ ] 禁止 view 继续直接向 toolbar 透传零散 store 字段

### Task 10: 改造 `useProductionPlanningPresenter`

- [ ] 从 `stationState` 与必要领域对象映射 planning props
- [ ] `liveModules` / `liveBuildingModules` 改从 `archiveStation` 读取
- [ ] `hasArchive` 改为 presenter 自身从 `archiveStation !== null` 判定
- [ ] 处理 station / transit / live / planning 的显示差异

### Task 11: 改造 `useProductionWareflowPresenter`

- [ ] 从 `stationState` 读取主计算结果
- [ ] 将 view 中残留的 wareflow 展示拼装收回 presenter
- [ ] 统一交互行为到业务动作

### Task 12: 改造 `useProductionDashboardPresenter`

- [ ] 移除以 `context.archiveModules` / `context.buildingModules` 为来源的编排逻辑
- [ ] 统一从 `stationState.modules` / `stationState.buildingModules` 读取
- [ ] 删除 presenter 内对 `visualMode === 'live'` 的判断分支（不再自己选数据源）
- [ ] archive 独有 live 展示字段直接从 `archiveStation` 映射

## Phase 6: [ ] View 收缩

### Task 13: 收缩 `BlueprintProductionWorkbenchView.vue`

- [ ] 删除 `importModalOpen` computed（wrapper 包裹 `blueprintStore.importModalOpen`）
- [ ] 删除 `activeStation` computed
- [ ] 删除 `createImportStation` 函数
- [ ] 将 store 直接调用改为 presenter emits

### Task 14: 收缩 `LiveProductionWorkbenchView.vue`

- [ ] `session.workbenchMode` 区块切换改为从 presenter props 读取
- [ ] Toolbar props 改为从 presenter 获取（mode、hasBinding、hasArchive、canToggle 等）
- [ ] ImportPlanModal 绑定改为 presenter emits
- [ ] StationPlanningPanelWrapper props 改为从 presenter 获取
- [ ] 删除 `importModalActiveStation` computed（移入 ToolbarPresenter）
- [ ] 将 import modal 绑定改为 presenter emits

## Phase 7: [ ] 构建验证

### Task 15: 构建验证

- [ ] 运行 `npm run build`
- [ ] 修复编译错误
- [ ] 确认 TypeScript 编译无错误
- [ ] 记录构建结论
