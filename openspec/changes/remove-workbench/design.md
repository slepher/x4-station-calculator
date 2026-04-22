# remove-workbench 设计文档

## 设计目标

本次变更不是改 production 算法，而是把 production workbench 剩余的旧兼容接口层删干净，并固定长期可维护的分层边界。

这里的 “remove-workbench” 专指：

- 删除 store 对外暴露的旧 `workbench` / panel getter 兼容接口
- 删除 presenter 对这些旧接口的依赖
- 删除 view 中为了兼容旧接口而保留的碎状态组装

这里的 “remove-workbench” 不包括：

- 删除 `session.workbenchMode`
- 删除 production workbench 入口页面本身
- 删除所有文件名/组件名中的 `Workbench`

## 正式边界

### 1. store 正式主边界

两个 production store 的正式长期主边界固定为：

- `session`
- `context`
- `stationState`
- 正式动作接口

正式动作接口按职责分为两层：

1. 领域动作
   - `settingActions`
   - `moduleActions`
   - `wareRuleActions`
   - 选择类动作：`selectStation`、`selectTransitSector`、`setExpandedSector`
2. 入口生命周期动作
   - blueprint：`saveEmpire`、`saveEmpireAs`、`loadEmpire`、`deleteEmpire`、`createEmpire`
   - live：`openBinding`、`saveBinding`、`discardChanges`、`toggleMode`

### 2. 允许长期保留的入口级导出

以下导出不属于旧兼容层，允许长期保留：

- `capabilities`
- `isReady`
- `isDirty`
- `isEmptyForSave`
- `importModalOpen`
- `activeStationId`
- blueprint:
  - `activeEmpire`
  - `savedEmpires`
  - `orderedStations`
- live:
  - `activeBinding`
  - `sectors`
  - `orderedStationsBySector`
  - `expandedSectorId`
  - `getPlanningStationCache`
- import 辅助能力：
  - `createStation`
  - `deleteStation`
  - `renameStation`
  - `getStationById`
  - `updateStationModules`
  - `applyImportedStationPayload`

这些导出属于入口 store 需要承担的页面或生命周期职责，不属于“旧 workbench 兼容 getter”。

## 必删接口清单

以下接口全部定义为本次必删项，不保留替代同级 getter：

- `getTabs`
- `getActiveTabId`
- `getExpandedSectorId`
- `getTitleModel`
- `getToolbarStation`
- `getToolbarRaces`
- `getToolbarStationTypes`
- `getAvailableMinerals`
- `getSingleBerthThroughput`
- `getEnforceDlcActivation`
- `getWareflowViewMode`
- `getEmpireGaps`
- `getCurrentEfficiency`
- `getActualWorkforce`
- `getBuildPriceMultiplier`
- `selectOverview`
- `selectTransit`
- `expandSector`
- `openImport`

本次不接受“保留旧接口，再新增一层中间 getter”的做法。

## 逐接口替代方案

### 1. Tabbar 相关

#### `getTabs`

替代方式：

- 不再由 store 返回已经长成 tabbar props 的数组
- 改由 `useProductionTabbarPresenter` 自己组装

正式输入：

- blueprint:
  - `orderedStations`
  - `session`
- live:
  - `sectors`
  - `orderedStationsBySector`
  - `session`

组装规则：

- blueprint:
  - 直接把 `orderedStations` 映射为 station tabs
- live:
  - presenter 负责在 `sectors` 与 `orderedStationsBySector` 上叠加 transit tab
  - transit tab id 统一为 `transit:${sectorId}`

#### `getActiveTabId`

替代方式：

- 不再作为 store getter 导出
- 改由 presenter 基于以下字段推导：
  - `session.workbenchMode`
  - `session.activeStationId`
  - `session.activeTransitSectorId`

#### `getExpandedSectorId`

替代方式：

- 改为正式状态字段 `expandedSectorId`

#### `selectOverview`

替代方式：

- 改为 `selectStation(null)`

#### `selectTransit`

替代方式：

- 改为正式动作 `selectTransitSector(sectorId | null)`

#### `expandSector`

替代方式：

- 改为正式动作 `setExpandedSector(sectorId | null)`

### 2. Toolbar 相关

#### `getTitleModel`

替代方式：

- 改由 presenter 组装 `{ value, placeholder }`

正式输入：

- blueprint:
  - `titleValue`
- live:
  - `titleValue`
- `titlePlaceholder`
- placeholder 常量由 presenter 内定义

#### `getToolbarStation`

替代方式：

- 改由 presenter 基于 `stationState` 与必要 context 组装

#### `getToolbarRaces`

替代方式：

- 改为 presenter 内静态选项表

#### `getToolbarStationTypes`

替代方式：

- 改为 presenter 内静态选项表

#### `getAvailableMinerals`

替代方式：

- 改为 presenter 内静态选项表

#### `getSingleBerthThroughput`

替代方式：

- 改由 presenter 基于 `stationState.settings.transportShipCapacity` 派生

### 3. Planning 相关

#### `getEnforceDlcActivation`

替代方式：

- 改为正式字段 `stationState.enforceDlcActivation`

原因：

- 它本质属于 station settings，而不是一个需要单独 getter 的 panel prop

### 4. Wareflow 相关

#### `getWareflowViewMode`

替代方式：

- 改为正式字段 `session.wareflowViewMode`

原因：

- view mode 是当前工作台会话状态的一部分，不应继续作为 panel getter 暴露

#### `getEmpireGaps`

替代方式：

- 改为正式字段 `stationState.empireGaps`

原因：

- gap 结果属于当前实体可展示的正式领域结果，不应继续通过 panel getter 暴露

### 5. Dashboard 相关

#### `getCurrentEfficiency`

替代方式：

- 改为 `stationState.currentEfficiency`

#### `getActualWorkforce`

替代方式：

- 改为 `stationState.actualWorkforce`

#### `getBuildPriceMultiplier`

替代方式：

- 改为 `stationState.buildPriceMultiplier`

### 6. Misc 相关

#### `openImport`

替代方式：

- 改为 view 直接操作 `importModalOpen`

原因：

- 这是页面级 modal 显隐状态，不需要再包装一层旧风格 action

## Presenter 重构方案

### 1. `useProductionTabbarPresenter`

必须修改为直接面向正式输入：

- `session`
- `capabilities`
- blueprint: `orderedStations`
- live: `sectors`、`orderedStationsBySector`、`expandedSectorId`
- 正式动作：
  - `selectStation`
  - `selectTransitSector`
  - `setExpandedSector`
  - `createStation`
  - `renameStation`
  - `duplicateStation`
  - `deleteStation`

删除依赖：

- `getTabs`
- `getActiveTabId`
- `getExpandedSectorId`
- `selectOverview`
- `selectTransit`
- `expandSector`

### 2. `useProductionToolbarPresenter`

必须修改为直接面向：

- `session`
- `context`
- `stationState`
- `settingActions`
- 正式标题源
- presenter 内静态选项表

删除依赖：

- `getTitleModel`
- `getToolbarStation`
- `getToolbarRaces`
- `getToolbarStationTypes`
- `getAvailableMinerals`
- `getSingleBerthThroughput`

### 3. `useProductionPlanningPresenter`

必须修改为直接面向：

- `session`
- `context`
- `stationState`
- `moduleActions`

删除依赖：

- `getEnforceDlcActivation`

### 4. `useProductionWareflowPresenter`

必须修改为直接面向：

- `session`
- `stationState`
- `settingActions`
- `moduleActions`
- `wareRuleActions`

删除依赖：

- `getWareflowViewMode`
- `getEmpireGaps`

### 5. `useProductionDashboardPresenter`

必须修改为直接面向：

- `session`
- `context`
- `stationState`
- `settingActions`

删除依赖：

- `getCurrentEfficiency`
- `getActualWorkforce`
- `getBuildPriceMultiplier`

## View 收缩方案

### 1. `BlueprintProductionWorkbenchView.vue`

最终只保留：

- `loadEmpire`
- `importModalOpen`
- presenter 创建
- 组件渲染

必须删除：

- 为 panel 数据创建的中间 computed
- 任何对旧 getter 兼容接口的依赖

### 2. `LiveProductionWorkbenchView.vue`

最终只保留：

- `openBinding`
- `importModalOpen`
- presenter 创建
- `session.workbenchMode` 区块切换
- overview 特有渲染
- 组件渲染

必须删除：

- 任何依赖旧 getter 的中间组装
- 任何把 transit 当作第二套主状态对象解释的写法

## 类型调整方案

### 1. `ProductionStationState` 扩展

为了彻底去掉旧 getter，本次正式扩展 `ProductionStationState`，新增：

- `stationType`
- `count`
- `minerals`
- `enforceDlcActivation`
- `empireGaps`
- `currentEfficiency`
- `actualWorkforce`
- `buildPriceMultiplier`

并要求：

- station / transit 均提供稳定 shape
- transit 下使用空结构或合法派生值，避免 presenter 处理 `null`

### 2. `ProductionSessionState` 扩展

为了彻底去掉 `getWareflowViewMode`，本次正式扩展 `ProductionSessionState`，新增：

- `wareflowViewMode`

### 3. 正式动作接口扩展

为了彻底去掉 `selectTransit` 与 `expandSector`，本次正式动作接口新增：

- `selectTransitSector(sectorId: string | null)`
- `setExpandedSector(sectorId: string | null)`

## 静态门禁方案

本次必须建立旧接口静态门禁。

门禁对象至少包括：

- `getTabs`
- `getActiveTabId`
- `getExpandedSectorId`
- `getTitleModel`
- `getToolbar`
- `getAvailableMinerals`
- `getSingleBerthThroughput`
- `getEnforceDlcActivation`
- `getWareflow`
- `getEmpireGaps`
- `getCurrentEfficiency`
- `getActualWorkforce`
- `getBuildPriceMultiplier`
- `selectOverview`
- `selectTransit`
- `expandSector`
- `openImport`

门禁要求：

- 旧定义若迁移期短暂残留则加 `@deprecated`
- 新调用必须被工具指出
- change 完成前 store return 中不再出现这些导出

## 执行顺序

固定执行顺序如下：

1. 扩展正式类型与正式动作边界
2. 改 `useProductionTabbarPresenter`
3. 改 `useProductionToolbarPresenter`
4. 改 `useProductionPlanningPresenter`
5. 改 `useProductionWareflowPresenter`
6. 改 `useProductionDashboardPresenter`
7. 收缩 `BlueprintProductionWorkbenchView.vue`
8. 收缩 `LiveProductionWorkbenchView.vue`
9. 删除两个 production store 中的旧导出与 wrapper
10. 建立静态门禁
11. build 验证
