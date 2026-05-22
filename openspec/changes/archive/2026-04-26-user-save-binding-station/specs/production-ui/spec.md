# Production UI Specification

## Purpose

量化生产界面（ProductionWorkbenchView）在 `save-binding` production source 下需要适配用户交互体验。

## ADDED Requirements

### Requirement: Binding Production Source

系统 MUST 在 `useEmpireStore` 中提供 `productionSource` 状态管理。

#### Scenario: productionSource 默认值
- **前提** 系统初始化
- **当** 读取 productionSource
- **那么** 默认值 SHALL 为 `'empire'`

#### Scenario: 切换到 binding
- **前提** 用户进入 binding
- **当** 调用 `switchToBinding(gameGuid)`
- **那么** productionSource SHALL 切换为 `'save-binding'`

#### Scenario: 切换回 empire
- **前提** 用户结束 binding
- **当** 调用 `switchToEmpire()`
- **那么** productionSource SHALL 切换回 `'empire'`

### Requirement: Binding Dirty State

系统 MUST 在 binding 模式下合并 dirty 状态。

#### Scenario: binding 模式下 dirty 来源
- **前提** productionSource 为 `'save-binding'`
- **当** 读取 `isDirty`
- **那么** isDirty SHALL 等于 `saveBindingStore.isDirty`

#### Scenario: empire 模式下 dirty 来源
- **前提** productionSource 为 `'empire'`
- **当** 读取 `isDirty`
- **那么** isDirty SHALL 基于 empire 序列化快照比较

### Requirement: Binding Save Routing

系统 MUST 根据 productionSource 路由保存操作。

#### Scenario: binding 模式保存
- **前提** productionSource 为 `'save-binding'`
- **当** 调用 `saveCurrentSource()`
- **那么** 系统 SHALL 调用 `saveBindingStore.saveBinding()`

#### Scenario: empire 模式保存
- **前提** productionSource 为 `'empire'`
- **当** 调用 `saveCurrentSource()`
- **那么** 系统 SHALL 调用 `saveEmpire()`

### Requirement: StationPlanningPanel Binding Adaptations

系统 MUST 在 binding 模式下调整 StationPlanningPanel 行为。

#### Scenario: 显示保存绑定按钮
- **前提** productionSource 为 `'save-binding'` 且 `saveBindingStore.isDirty`
- **当** 渲染标题栏
- **那么** 系统 SHALL 显示保存绑定按钮

#### Scenario: 蓝图导入目标
- **前提** productionSource 为 `'save-binding'`
- **当** 用户导入蓝图模块
- **那么** 系统 SHALL 更新 `BindingStationPlan.modules` 和 `settings`

### Requirement: StationTabBar Binding Adaptations

系统 MUST 在 binding 模式下调整 StationTabBar 行为。

#### Scenario: binding 模式星区列表
- **前提** productionSource 为 `'save-binding'`
- **当** 渲染 StationTabBar
- **那么** 星区列表 SHALL 来自 binding groups
- **并且** 空间站列表 SHALL 来自 derived stations

#### Scenario: 创建虚拟空间站
- **前提** productionSource 为 `'save-binding'`
- **当** 用户创建新空间站
- **那么** 系统 SHALL 创建 `BindingStationPlan` 且不包含 `saveStationCode`

### Requirement: StationDashboard Binding Adaptations

系统 MUST 在 binding 模式下调整 StationDashboard 保存行为。

#### Scenario: binding 模式保存按钮
- **前提** productionSource 为 `'save-binding'`
- **当** 用户点击保存按钮
- **那么** 系统 SHALL 调用 `saveBindingStore.saveBinding()`

### Requirement: useStationStore Binding Routing

系统 MUST 在 binding 模式下通过 `useStationStore` 将编辑操作路由到 binding store。

#### Scenario: updateModules 路由到 binding
- **前提** productionSource 为 `'save-binding'`
- **当** 调用 `updateModules(stationId, modules)`
- **那么** 系统 SHALL 从 `stationId` 提取 planId
- **并且** 调用 `saveBindingStore.updateStationPlan(gameGuid, planId, { modules })`

#### Scenario: updateSetting 路由到 binding
- **前提** productionSource 为 `'save-binding'`
- **当** 调用 `updateSetting(key, value)`
- **那么** 系统 SHALL 从 `stationId` 提取 planId
- **并且** 调用 `saveBindingStore.updateStationPlan(gameGuid, planId, { settings })`
- **并且** 同步更新 `StationStateMap` 以触发 recompute
