# Transit Refactory

## Priority

本文件优先级高于 `review2.md`。

先完成本文件，彻底删掉 transit 旧路径，再继续后续功能补线。  
禁止一边保留旧路径、一边叠加新路径。  
禁止“先接一点新逻辑，旧逻辑以后再删”。

---

## Goal

把 transit 收敛到和 station 相同的三层结构：

- `store`
- `presenter`
- `view`

明确禁止以下旧链继续存在：

- `store -> facade/source -> transit presenter -> view -> component internal recompute`
- `view` 手工拼 transit input
- `component` 内部再次根据 raw flow 重算主结果

最终必须满足：

1. `store` 导出领域状态，不导出 UI 拼装对象
2. `presenter` 负责把 store 状态组装成 UI 所需 props/emits
3. `view` 只负责展示和组件切换
4. transit 不再有专用 presenter
5. `TransitHubCenterDashboard` 不再接收 raw transit 计算原料
6. `ProductionPanelSource` 整条路径删除
7. `TransitPresenterContract` 整条路径删除

---

## Final Architecture

### A. Store

`useLiveProductionStore` 继续是唯一数据源。

store 必须直接导出当前 transit/station 的领域状态。  
不要再导出中间 source/panel/contract。

store 需要对外提供的对象固定为：

1. `session`
2. `context`
3. `stationState`
4. `transitState`
5. `workbench`

说明：

- `session`
  - 当前工作上下文
  - 如 `workbenchMode / mode / visualMode / active ids`
- `context`
  - 当前实体上下文
  - 如 `stationCode / sector info / archiveModules / buildingModules / hasArchive`
- `stationState`
  - 当前 station-like 主状态
  - 包含 `plannedModules / auto* / productionFlows / stationAnalysis / settings`
- `transitState`
  - transit 专属聚合结果
  - 只保留 transit 真正独有的数据
- `workbench`
  - 继续作为 station presenters 的输入契约
  - 本次要扩到可同时表达 station 和 transit

### B. Presenter

最终只保留这 3 个 presenter：

- `useProductionPlanningPresenter`
- `useProductionWareflowPresenter`
- `useProductionDashboardPresenter`

必须删除：

- `useTransitPlanningPresenter`
- `useTransitWareflowPresenter`
- `useTransitDashboardPresenter`

### C. View

`LiveProductionWorkbenchView.vue` 最终只允许创建这 3 个 presenter。

禁止再出现：

- `transitPresenterContract`
- transit-specific presenter 实例
- transit raw input computed

---

## Current Old Paths To Remove

以下是当前代码中仍然存在的旧路径，必须先删：

### 1. Transit 专用 presenter 路径

文件：

- `src/components/empire/presenters/useTransitPlanningPresenter.ts`
- `src/components/empire/presenters/useTransitWareflowPresenter.ts`
- `src/components/empire/presenters/useTransitDashboardPresenter.ts`
- `src/types/transit-presenter-contract.ts`
- `src/components/empire/LiveProductionWorkbenchView.vue`

现状：

- transit 仍走单独 contract
- transit 仍走单独 presenter
- 与 station presenter 体系并行

该路径必须整条删除。

### 2. ProductionPanelSource 路径

文件：

- `src/types/production-panel-source.ts`
- `src/store/logic/empireFlowFacade.ts`
- `src/store/useLiveProductionStore.ts`

现状：

- transit/station 中间又套一层 `ProductionPanelSource`
- presenter/view 仍依赖这个胶水层

该路径必须整条删除。

### 3. Transit center raw input 路径

当前 `rg` 结果表明，以下字段仍在活跃链路中：

- `localGroupedFlows`
- `solverOutput`
- `storageModulePlans`

当前活跃消费点：

- `LiveProductionWorkbenchView.vue`
- `useTransitWareflowPresenter.ts`
- `TransitHubCenterDashboard.vue`
- `useTransitHubFlowGrouping.ts`

这条路径必须删除到只剩 store 内部算法。

### 4. supplyStorageFlows 残留路径

当前 `rg` 结果表明：

- transit view/presenter 已不直接消费 `supplyStorageFlows`
- 该字段主要还残留在 `ProductionPanelSource` / `empireFlowFacade` / 类型层

该字段在 transit 路径中视为残留，必须删除。

---

## Transit Data Model After Refactor

### 1. stationState

`stationState` 是当前实体主状态。  
transit 也要进入这个框架。

最少需要包含：

- `entityType`
- `plannedModules`
- `resolvedModules`
- `autoIndustryModules`
- `autoHabitationModules`
- `autoInfrastructureModules`
- `productionFlows`
- `warePriorityLevels`
- `stationAnalysis`
- `settings`

规则：

- normal station
  - 保持现有语义
- transit
  - `plannedModules = autoInfrastructureModules`
  - `resolvedModules = autoInfrastructureModules`
  - `autoIndustryModules = []`
  - `autoHabitationModules = []`
  - `autoInfrastructureModules = sector aggregation 最终结果`
  - `productionFlows = sector 最终 flows`
  - `warePriorityLevels = {}`
  - `stationAnalysis` 可为空结构，右侧材料区不依赖它

### 2. transitState

`transitState` 只保留 transit 独有数据。

固定字段：

- `sectorId`
- `groupedFlows`
- `storageFlows`
- `storageModulePlans`

说明：

- `groupedFlows`
  - 为 transit wareflow 展示结果
- `storageFlows`
  - 为 transit center volume/transport 展示结果
- `storageModulePlans`
  - 仅作为 build 注解
  - 不是 planning 主结果

### 3. context

`context` 继续承载：

- `hasArchive`
- `archiveModules`
- `buildingModules`
- `stationCode`
- `sectorName`
- 其它上下文字段

---

## Hard Decisions

以下路线写死，不允许 agent 再做设计选择。

### D1. planning transit 主模块结果就是 `autoInfrastructureModules`

planning transit 左侧和右侧都以：

- `stationState.autoInfrastructureModules`

作为主模块结果。

禁止使用：

- `storageModulePlans` 作为主模块结果
- `resolvedModules` 作为另一套 transit planning 结果

### D2. TransitHubCenterDashboard 不再接 raw input

`TransitHubCenterDashboard` 不再接收：

- `sectorId`
- `sectors`
- `stations`
- `localGroupedFlows`
- `solverOutput`

它改成纯展示组件，只接：

- `groupedFlows`
- `storageFlows`
- `viewMode`
- `buyMultiplier`
- `sellMultiplier`
- `productBufferHours`

### D3. supplyStorageFlows 从 transit 链彻底删除

在 transit 路径中删除：

- `supplyStorageFlows` 类型字段
- `supplyStorageFlows` source 字段
- `supplyStorageFlows` presenter 字段

保留范围仅限：

- empire/overview 自己独立使用的地方

### D4. storageModulePlans 只做注解

`storageModulePlans` 只允许出现在：

- `transitState.storageModulePlans`
- `TransitHubBuildPanel` 的可选注解 props

禁止作为：

- planning 主模块来源
- center dashboard 主输入
- materials panel 主输入

### D5. 不保留双链过渡

每一阶段必须做到：

- 删旧路径
- 编译通过
- 再补新路径

不允许：

- 旧 presenter 保留，新的 presenter 也接上
- 旧 component internal recompute 保留，store 新数据也接上

---

## Execution Order

严格按以下顺序执行。

---

## Phase 1. 删除 transit 专用 presenter

### 目标

让 transit 不再有专用 presenter。

### 必做

1. 删除文件：
   - `src/components/empire/presenters/useTransitPlanningPresenter.ts`
   - `src/components/empire/presenters/useTransitWareflowPresenter.ts`
   - `src/components/empire/presenters/useTransitDashboardPresenter.ts`
2. 删除文件：
   - `src/types/transit-presenter-contract.ts`
3. 修改：
   - `src/components/empire/LiveProductionWorkbenchView.vue`
4. 删除其中：
   - transit presenter imports
   - `transitPresenterContract`
   - transit presenter instances

### 完成标准

- `rg "useTransitPlanningPresenter|useTransitWareflowPresenter|useTransitDashboardPresenter|TransitPresenterContract" src`
  - 无结果

### 此阶段允许的临时状态

- `LiveProductionWorkbenchView.vue` 可先直接使用已有 `planningPresenter / wareflowPresenter / dashboardPresenter`
- 只要 build 能过，允许 presenter 内部先返回空 transit 数据

---

## Phase 2. 删除 ProductionPanelSource 路径

### 目标

删掉 store 和 presenter 之间的中间 source 胶水层。

### 必做

1. 删除文件：
   - `src/types/production-panel-source.ts`
2. 删除 `empireFlowFacade.ts` 中以下接口和实现：
   - `getStationPanelSource`
   - `getTransitPanelSource`
3. 删除 `useLiveProductionStore.ts` 中以下函数：
   - `getPlanningStationPanelSource`
   - `getLiveStationPanelSource`
   - `getActiveStationPanelSource`
   - `getPlanningTransitPanelSource`
   - `getLiveTransitPanelSource`
   - `getActiveTransitPanelSource`

### 替代方案

把这些中间 source 里的有效数据，直接并入：

- `stationState`
- `transitState`
- `context`
- `session`

### 完成标准

- `rg "ProductionPanelSource|getStationPanelSource|getTransitPanelSource|PanelSource" src`
  - 无业务结果

---

## Phase 3. 先把 store 改成直接导出 transit 结果

### 目标

先让 store 给出 transit 的最终结果，再让 presenter 组装。

### 必做

在 `useLiveProductionStore.ts` 中，保证 `workbench` 能直接提供 transit 当前结果。

### 必须新增/实现的数据

#### 1. session

至少包含：

- `workbenchMode`
- `mode`
- `visualMode`
- `activeStationId`
- `activeTransitSectorId`
- `canToggle`

#### 2. context

至少包含：

- `hasArchive`
- `archiveModules`
- `buildingModules`
- `stationCode`
- `sectorName`
- `sectorNameId`
- `position`
- `sectorResources`
- `sectorSunlight`

#### 3. stationState

至少包含：

- `entityType`
- `plannedModules`
- `resolvedModules`
- `autoIndustryModules`
- `autoHabitationModules`
- `autoInfrastructureModules`
- `productionFlows`
- `warePriorityLevels`
- `stationAnalysis`
- `settings`

#### 4. transitState

至少包含：

- `sectorId`
- `groupedFlows`
- `storageFlows`
- `storageModulePlans`

### Transit 规则

#### transit planning

- `plannedModules = autoInfrastructureModules`
- `resolvedModules = autoInfrastructureModules`
- `productionFlows = sector final production flows`
- `groupedFlows = 由 productionFlows 派生的 transit grouped result`
- `storageFlows = 由 groupedFlows 派生`
- `storageModulePlans = 由 storageFlows 派生`

#### transit live with archive

- 左侧/右侧模块来源：
  - `context.archiveModules + context.buildingModules`
- 中间 flow 来源：
  - live sector final production flows

#### transit live without archive

- 左侧/右侧模块来源：
  - planning `autoInfrastructureModules`
- 中间 flow 来源：
  - live sector final production flows
- `visualMode = planning`

### 完成标准

- `useLiveProductionStore` 不再依赖 panel source 向外吐 transit 数据
- transit 现有结果都可从 `session/context/stationState/transitState/workbench` 拿到

---

## Phase 4. 改造 useProductionPlanningPresenter

### 目标

让左侧 presenter 同时支持 station 和 transit。

### 必做

修改：

- `src/components/empire/presenters/useProductionPlanningPresenter.ts`

它必须直接从 store/workbench 读取：

- 当前 `workbenchMode`
- 当前 `visualMode`
- 当前 `plannedModules`
- 当前 `autoIndustryModules`
- 当前 `autoHabitationModules`
- 当前 `autoInfrastructureModules`
- 当前 `archiveModules`
- 当前 `buildingModules`
- 当前 `storageModulePlans`
- 当前 `hasArchive`

### 规则

- station 左侧
  - 继续喂给 `StationPlanningPanelWrapper`
- transit planning 左侧
  - `modules = autoInfrastructureModules`
  - `modulePlans = transitState.storageModulePlans`
- transit live with archive
  - `ArchiveModuleList`
  - `modules = archiveModules`
  - `buildingModules = buildingModules`
- transit live without archive
  - 继续 `TransitHubBuildPanel`
  - `modules = autoInfrastructureModules`

### 完成标准

- `LiveProductionWorkbenchView.vue` 左侧 transit 区只用 `planningPresenter`

---

## Phase 5. 改造 useProductionWareflowPresenter

### 目标

让中间 presenter 同时支持 station 和 transit。

### 必做

修改：

- `src/components/empire/presenters/useProductionWareflowPresenter.ts`

它必须直接从 store/workbench 读取：

- 当前 `workbenchMode`
- 当前 `visualMode`
- station 的 `productionFlows / warePriorityLevels / settings`
- transit 的 `groupedFlows / storageFlows / settings`

### 规则

- station 中间区
  - 继续喂给 `StationWareFlowsDashboard`
- transit 中间区
  - 喂给 `TransitHubCenterDashboard`
  - 不再经过 raw input

### 必须同时修改

修改：

- `src/components/empire/transit-hub/TransitHubCenterDashboard.vue`

删除 props：

- `sectorId`
- `sectors`
- `stations`
- `localGroupedFlows`
- `solverOutput`

新增/保留 props：

- `groupedFlows`
- `storageFlows`
- `viewMode`
- `buyMultiplier`
- `sellMultiplier`
- `productBufferHours`

### 组件内部要求

删除：

- `useTransitHubFlowGrouping()`
- `computeTransitHubGrouping(...)`
- 任何根据 raw input 二次重算 grouped/storage 的逻辑

`TransitHubCenterDashboard` 只保留展示派生：

- quantity/economy 展示用 `groupedFlows`
- volume/transport 展示用 `storageFlows`

### 完成标准

- `rg "localGroupedFlows|solverOutput" src/components/empire/LiveProductionWorkbenchView.vue src/components/empire/presenters src/components/empire/transit-hub/TransitHubCenterDashboard.vue`
  - 不再存在 transit UI 链业务用法

---

## Phase 6. 改造 useProductionDashboardPresenter

### 目标

让右侧 presenter 同时支持 station 和 transit。

### 必做

修改：

- `src/components/empire/presenters/useProductionDashboardPresenter.ts`

它必须直接从 store/workbench 读取：

- 当前 `workbenchMode`
- station 的 `stationAnalysis / settings / currentEfficiency / buildPriceMultiplier`
- transit 的当前模块展示结果：
  - planning: `autoInfrastructureModules`
  - live: `archiveModules + buildingModules`

### 规则

- station 右侧
  - 继续喂给 `StationDashboard`
- transit 右侧
  - 喂给 `TransitHubMaterialsPanel`
  - 不再依赖 transit 专用 presenter

### 完成标准

- `LiveProductionWorkbenchView.vue` 右侧 transit 区只用 `dashboardPresenter`

---

## Phase 7. 删除 supplyStorageFlows transit 路径

### 目标

删掉已经残留的 transit `supplyStorageFlows`。

### 必做

删除 transit 路径中的：

- `production-panel-source.ts` 相关定义
- `empireFlowFacade.ts` transit source 字段
- 任何 presenter 里的 `supplyStorageFlows`

### 保留范围

只允许保留在 empire/overview 自己确实还用的地方。

### 完成标准

- `rg "supplyStorageFlows" src/components/empire src/store/logic/empireFlowFacade.ts src/types`
  - transit 链无结果

---

## Phase 8. 清理 TransitHubCenterDashboard 的 defineExpose

### 目标

彻底禁止 center 组件成为数据源。

### 必做

删除：

- `defineExpose({ storageModulePlans, storageFlows })`

文件：

- `src/components/empire/transit-hub/TransitHubCenterDashboard.vue`

### 完成标准

- center 组件不再被任何其它组件当成数据生产者使用

---

## Phase 9. LiveProductionWorkbenchView 收口

### 目标

view 只做组件切换。

### 必做

最终 `LiveProductionWorkbenchView.vue` 只允许：

- 创建 `tabbarPresenter`
- 创建 `toolbarPresenter`
- 创建 `planningPresenter`
- 创建 `wareflowPresenter`
- 创建 `dashboardPresenter`

禁止出现：

- transit raw input computed
- transit presenter contract
- transit presenter instances
- transit source/panel helper calls

### 完成标准

- `LiveProductionWorkbenchView.vue` 中 transit 只是条件渲染不同组件
- 数据全来自 3 个 presenter

---

## Verification Gates

每完成一个 phase 都必须通过以下检查，再进入下一阶段。

### Gate A. 搜索检查

```bash
rg "useTransitPlanningPresenter|useTransitWareflowPresenter|useTransitDashboardPresenter|TransitPresenterContract" src
rg "ProductionPanelSource|getStationPanelSource|getTransitPanelSource" src
rg "localGroupedFlows|solverOutput" src/components/empire/LiveProductionWorkbenchView.vue src/components/empire/presenters src/components/empire/transit-hub/TransitHubCenterDashboard.vue
```

### Gate B. 构建检查

```bash
npm run build
```

### Gate C. 行为检查

必须人工确认：

1. station 页面未回归
2. transit planning 左侧显示 `autoInfrastructureModules`
3. transit live with archive 左侧显示 `archiveModules + buildingModules`
4. transit center 不再依赖 raw input
5. transit materials 正确分析当前显示模块

---

## Prohibited Decisions

以下路线禁止再出现：

1. 再新建 transit 专用 presenter contract
2. 再新建 panel/source/resource 胶水层
3. 让 `TransitHubCenterDashboard` 继续内部计算主结果
4. 让 `storageModulePlans` 重新变成 planning 主模块来源
5. 保留新旧两套路径并存
6. 为了迁移方便继续保留旧 transit presenter 到最后

---

## Definition Of Done

全部完成后必须满足：

1. transit 专用 presenter 全删
2. `TransitPresenterContract` 全删
3. `ProductionPanelSource` 全删
4. `TransitHubCenterDashboard` 变为纯展示组件
5. `useProductionPlanningPresenter` 同时支持 station/transit 左侧
6. `useProductionWareflowPresenter` 同时支持 station/transit 中间区
7. `useProductionDashboardPresenter` 同时支持 station/transit 右侧
8. transit planning 主模块结果固定为 `autoInfrastructureModules`
9. transit live 主模块结果固定为 `archiveModules + buildingModules`
10. `npm run build` 通过

