# remove-workbench

## 目标

本次变更要把 production workbench 中残留的旧 `workbench` / panel getter 兼容层彻底移除，收口为可直接长期维护的正式边界。

本次完成后，`useBlueprintProductionStore` 与 `useLiveProductionStore` 的主读取入口统一为 `session`、`context`、`stationState` 与正式动作接口；presenter 不再依赖 `getTabs`、`getToolbarXxx`、`getWareflowXxx`、`getDashboardXxx` 等旧接口。

## 已确认方案（审核重点）

### 1. 本次移除的对象是什么

本次移除的是 production store 对外暴露的旧兼容接口层，包括：

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

这些接口统一视为旧 `workbench` 兼容层，不再允许作为正式主路径长期保留。

### 2. 本次不移除的对象是什么

以下对象属于正式领域状态或入口级能力，不在本次移除范围内：

- `session.workbenchMode`
- `session.activeStationId`
- `session.activeTransitSectorId`
- `context`
- `stationState`
- `capabilities`
- `settingActions`
- `moduleActions`
- `wareRuleActions`
- `isReady`
- `isDirty`
- `isEmptyForSave`
- blueprint 入口生命周期能力：
  - `saveEmpire`
  - `saveEmpireAs`
  - `requiresSaveAsOnSave`
  - `loadEmpire`
  - `deleteEmpire`
  - `createEmpire`
- live 入口生命周期能力：
  - `openBinding`
  - `saveBinding`
  - `discardChanges`
  - `toggleMode`
- import / modal / 入口辅助能力：
  - `importModalOpen`
  - `createStation`
  - `deleteStation`
  - `renameStation`
  - `selectStation`
  - `getStationById`
  - `updateStationModules`
  - `applyImportedStationPayload`

### 3. 旧接口的替代方案已固定

旧接口不会被另一组同级 getter 替换，而是改为“store 提供正式领域对象 + presenter 自己组装 UI”。

具体替代关系固定如下：

- `getTabs`
  - 改为由 presenter 基于正式状态组装
  - blueprint 来源：`orderedStations`
  - live 来源：`sectors`、`orderedStationsBySector`
- `getActiveTabId`
  - 改为由 presenter 基于 `session.workbenchMode`、`session.activeStationId`、`session.activeTransitSectorId` 推导
- `getExpandedSectorId`
  - 改为正式字段 `expandedSectorId`
- `selectOverview`
  - 改为正式动作 `selectStation(null)`
- `selectTransit`
  - 改为正式动作 `selectTransitSector(sectorId | null)`
- `expandSector`
  - 改为正式动作 `setExpandedSector(sectorId | null)`
- `getTitleModel`
  - 改为 presenter 基于 `titleValue`、`titlePlaceholder` 与 placeholder 常量组装
- `getToolbarStation`
  - 改为 presenter 基于 `stationState` 与必要上下文字段组装
- `getToolbarRaces`
  - 改为 presenter 内静态选项表
- `getToolbarStationTypes`
  - 改为 presenter 内静态选项表
- `getAvailableMinerals`
  - 改为 presenter 内静态选项表
- `getSingleBerthThroughput`
  - 改为 presenter 基于 `stationState.settings` 派生
- `getEnforceDlcActivation`
  - 改为正式字段 `stationState.enforceDlcActivation`
- `getWareflowViewMode`
  - 改为正式字段 `session.wareflowViewMode`
- `getEmpireGaps`
  - 改为正式字段 `stationState.empireGaps`
- `getCurrentEfficiency`
  - 改为正式字段 `stationState.currentEfficiency`
- `getActualWorkforce`
  - 改为正式字段 `stationState.actualWorkforce`
- `getBuildPriceMultiplier`
  - 改为正式字段 `stationState.buildPriceMultiplier`
- `openImport`
  - 改为 view 直接写 `importModalOpen`

### 4. presenter 的职责边界已固定

- presenter 必须从 `session/context/stationState` 与正式动作接口读取
- presenter 负责生成 tabbar / toolbar / planning / wareflow / dashboard 的 UI props
- presenter 不再向 store 请求“已经长成某个面板 props 的 getter”

### 5. view 的职责边界已固定

- `BlueprintProductionWorkbenchView.vue` 只保留：
  - load active empire
  - 创建 presenter
  - modal 开关
  - 渲染子组件
- `LiveProductionWorkbenchView.vue` 只保留：
  - open active binding
  - 创建 presenter
  - 按 `session.workbenchMode` 切 overview / station / transit
  - modal 开关
  - 渲染子组件

### 6. 旧入口门禁已作为本次强制项

- 旧接口在迁移阶段必须加 `@deprecated`
- 仓库必须建立静态门禁，阻止新增旧接口调用
- 本次 change 完成前，production store 不再导出上述旧接口

## 边界

### In Scope

- `useBlueprintProductionStore` 旧兼容接口清理
- `useLiveProductionStore` 旧兼容接口清理
- 五个 presenter 的输入边界重构
- 两个 workbench view 的收缩
- `production-workbench-contract.ts` 与相关类型清理
- 静态告警门禁

### Out of Scope

- production 算法重写
- 非 production 领域的 “workbench” 命名清理
- map workbench 重构
- UI 视觉改版
- 测试编写与测试执行流程设计

## 验收标准（DoD）

- `useBlueprintProductionStore` 不再导出旧 `workbench` / panel getter 兼容接口
- `useLiveProductionStore` 不再导出旧 `workbench` / panel getter 兼容接口
- `useProductionTabbarPresenter` 不再调用 `getTabs/getActiveTabId/getExpandedSectorId/selectOverview/selectTransit/expandSector`
- `useProductionToolbarPresenter` 不再调用 `getTitleModel/getToolbarStation/getToolbarRaces/getToolbarStationTypes/getAvailableMinerals/getSingleBerthThroughput`
- `useProductionPlanningPresenter` 不再调用 `getEnforceDlcActivation`
- `useProductionWareflowPresenter` 不再调用 `getWareflowViewMode/getEmpireGaps`
- `useProductionDashboardPresenter` 不再调用 `getCurrentEfficiency/getActualWorkforce/getBuildPriceMultiplier`
- `BlueprintProductionWorkbenchView.vue` 不再手工组装 panel 主数据
- `LiveProductionWorkbenchView.vue` 不再手工组装 panel 主数据
- `session.workbenchMode` 保留为正式状态字段
- build 通过
- 新增任何旧接口调用都会触发工具告警或失败

## 未决项

- 无
