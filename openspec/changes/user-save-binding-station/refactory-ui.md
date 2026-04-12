# user-save-binding-station Refactory UI

## Purpose

本文件聚焦 **production UI 层的去 store 穿透重构**。

目标不是先拆 domain store，而是先把 Vue 组件树的依赖边界立住：

- 除最上层入口容器外，其他 UI 组件 **不再直接依赖 `useEmpireStore`**
- 游戏静态数据、翻译辅助、Dlc/模块/ware 元数据允许直接来自 `useGameDataStore`
- 其他业务数据全部通过 `props` / `emit` / `actions` 注入

这样做的目的有两个：

1. 先把 UI 变成可复用的“纯工作台组件树”
2. 为后续 `BlueprintProductionEntry` / `LiveProductionEntry` 和双 store 拆分清障

本文件要解决的问题是：

1. 当前 production UI 组件树里，`useEmpireStore` 穿透到了哪些层
2. 哪些组件应该保留 `useGameDataStore`，哪些数据必须改为 props
3. 应该按什么顺序重构，才能让另一个 agent 无负担接手实施

---

## 当前代码观察

### O1. 当前 production UI 的 store 穿透点集中在中层组件

当前 production 工作台链路大致如下：

```text
MainWorkbench
└── ProductionWorkbenchView
    ├── StationTabBar
    ├── ContextToolbar
    ├── StationPlanningPanel
    │   ├── StationModulePicker
    │   └── StationPlanningItem
    ├── StationWareFlowsDashboard
    ├── StationDashboard
    ├── EmpireWareFlowsDashboard
    └── transit-hub/*
        ├── TransitHubBuildPanel
        ├── TransitHubCenterDashboard
        └── TransitHubMaterialsPanel
```

其中直接依赖 `useEmpireStore` 的组件包括：

- `src/components/empire/ProductionWorkbenchView.vue`
- `src/components/empire/StationTabBar.vue`
- `src/components/empire/ContextToolbar.vue`
- `src/components/empire/StationWareFlowsDashboard.vue`
- `src/components/empire/ImportPlanModal.vue`
- `src/components/empire/LoadPlanModal.vue`

这意味着当前不是“顶层容器持有 store，向下传数据”，而是“中层组件自己读 store，再继续向下拼装”。

### O2. `useGameDataStore` 依赖广泛存在，但并非都需要消除

在 production UI 子树中，直接依赖 `useGameDataStore` 的组件包括：

- `StationModulePicker.vue`
- `StationPlanningItem.vue`
- `StationDashboard.vue`
- `StationWareFlowsDashboard.vue`
- `EmpireWareFlowsDashboard.vue`
- `TransitHubCenterDashboard.vue`
- `ImportPlanModal.vue`

这些依赖里需要分两类看：

#### 可以保留的

凡是只读：

- 模块静态元数据
- ware 静态元数据
- DLC 激活信息
- 游戏翻译辅助

的组件，可以继续直接使用 `useGameDataStore`。

#### 不应保留的

凡是通过 `useGameDataStore` 之外再混读：

- 活动站点
- grouped flows
- dirty / save 状态
- 入口上下文

的组件，不应继续自己拼业务数据。

### O3. 当前最大问题不是底层叶子组件，而是中层容器组件承担了太多编排

例如：

- `ProductionWorkbenchView` 同时决定布局、决定当前模式、决定从哪些 store 取哪些数据
- `ContextToolbar` 同时处理 overview / station / transit 三类模式，并直接改 empire / binding
- `StationWareFlowsDashboard` 既读 `useStationStore`，又读 `useEmpireStore`

这类组件直接阻碍后续双入口复用，因为：

- 组件本身已经内嵌了 store 选择逻辑
- 想复用 UI 时，就必须复用整套 store 结构

---

## 本轮 UI 重构目标

### G1. 顶层容器持有 `useEmpireStore`，下层组件不再直接持有

允许保留 `useEmpireStore` 的层级：

- `MainWorkbench`
- 后续新增的入口容器，例如 `BlueprintProductionEntry` / `LiveProductionEntry`
- 过渡期内可暂时保留 `ProductionWorkbenchView` 作为最上层容器

除此之外，其他 production UI 组件应逐步移除 `useEmpireStore`。

### G2. `useGameDataStore` 仅用于静态游戏数据读取

允许保留 `useGameDataStore` 的场景：

- 模块名 / ware 名 / DLC 标签显示
- `modulesMap` / `waresMap` / `findModuleForWare`
- 纯静态翻译辅助

禁止通过 `useGameDataStore` 补偿业务数据缺口，例如：

- 组件从 game data 和 business store 拼出完整工作台状态
- 组件自行推导 active station 的业务语义

### G3. 所有业务态都从 props 注入

这里的“其他数据从 props 获取”包含：

- active station / transit / overview 状态
- station settings / modules / grouped flows / analysis
- sector / station tab 结构
- dirty / save / rename / delete / import 等动作

组件层只做两件事：

- 展示
- 发出意图

业务路由留在顶层容器。

---

## 分层目标

### L1. 顶层容器层

顶层容器层负责：

- 读取 `useEmpireStore` / 未来的新入口 store
- 决定当前处于 overview / station / transit 哪种模式
- 组装共享 UI 所需的 view model
- 将业务动作包装成 props actions

### L2. 中层工作台层

中层工作台层包括：

- `ProductionWorkbenchView`
- `StationTabBar`
- `ContextToolbar`
- `StationPlanningPanel`
- `StationWareFlowsDashboard`
- `StationDashboard`
- `EmpireWareFlowsDashboard`
- `TransitHubCenterDashboard`

这些组件不应再直接读 `useEmpireStore`。

### L3. 叶子显示层

叶子显示组件包括：

- `StationPlanningItem`
- `StationModulePicker`
- `StationWareFlowGroup`
- `EmpireWareFlowGroup`
- `TransitHubQuantityView`
- `TransitHubEconomyView`
- `TransitHubStorageView`
- `TransitHubTransportView`

这些组件可以继续直接依赖 `useGameDataStore`，前提是只读静态数据和翻译数据。

---

## 目标组件边界

### C1. `ProductionWorkbenchView.vue`

#### 当前问题

当前直接依赖：

- `useEmpireStore`
- `useStationStore`

并负责：

- 读 active station / active transit
- 读 grouped flows
- 组装 transit hub model
- 决定 overview / station / transit 三种布局

#### 目标定位

退化为纯布局容器，只接收 props。

#### 建议 props

```ts
interface ProductionWorkbenchViewProps {
  isOverview: boolean
  activeTransitSectorId: string | null

  tabBar: StationTabBarProps
  toolbar: ContextToolbarProps

  overviewGroupedFlows: EmpireGroupedFlows | null
  stationPlanning: StationPlanningPanelProps | null
  stationWareFlows: StationWareFlowsDashboardProps | null
  stationDashboard: StationDashboardProps | null
  transitHub: TransitHubWorkbenchProps | null
}
```

#### 重构要求

- 不再调用 `useEmpireStore`
- 不再调用 `useStationStore`
- 不再自己组装 `transitHubModel`
- 只根据 props 渲染子组件

### C2. `StationTabBar.vue`

#### 当前问题

当前直接依赖 `useEmpireStore`，内部同时处理：

- station / sector 原始数据读取
- tab 分组
- 默认展开星区
- 选中 / 删除 / 新建动作
- binding / empire 差异

#### 目标定位

变成纯展示 + 事件发射组件。

#### 建议 props

```ts
interface StationTabBarProps {
  tabs: ProductionTabItem[]
  activeTabId: string | null
  expandedSectorId: string | null
  canCreateStation: boolean
  canOpenContextMenu: boolean
}
```

#### 建议 emits

- `select-overview`
- `select-transit`
- `select-station`
- `create-station`
- `rename-station`
- `duplicate-station`
- `delete-station`
- `expand-sector`

#### 重构要求

- 组件内不再读取 `useEmpireStore`
- tabGroups / visibleSectorGroups / defaultExpandedSectorId 改由上层提供
- 删除/复制/选择等动作全部变为 emit

### C3. `ContextToolbar.vue`

#### 当前问题

当前同时依赖：

- `useEmpireStore`
- `useStationStore`
- `useSaveBindingStore`
- `useActiveViewStore`

它本质上已经是一个中层 orchestrator，而不是 toolbar。

#### 目标定位

只展示当前上下文标题和当前站点编辑字段。

#### 建议 props

```ts
interface ContextToolbarProps {
  mode: 'overview' | 'station' | 'transit'
  isBindingMode: boolean

  titleModel: {
    value: string
    placeholder: string
  }

  station: {
    id: string
    name: string
    type: StationType
    count: number
    minerals: string[]
  } | null

  settings: {
    sunlight: number
    transportMinutes: number
    racePreference: string
    considerWorkforceForAutoFill: boolean
    showEmpireGaps: boolean
    transportShipCapacity: number
  } | null

  races: Array<{ value: string; label: string }>
  stationTypes: Array<{ value: StationType; label: string }>
  availableMinerals: string[]
}
```

#### 建议 emits

- `update:title`
- `update:station-name`
- `update:station-type`
- `update:station-count`
- `toggle:mineral`
- `update:sunlight`
- `update:transport-minutes`
- `update:race-preference`
- `update:workforce`
- `update:show-empire-gaps`
- `open-import`

#### 重构要求

- 不再直接调用任意业务 store
- 不再直接调用 `renameStation` / `updateEmpireName` / `renameBindingSector`
- 不再直接改 `activeStation.value.type/count/minerals`

### C4. `StationPlanningPanel.vue`

#### 当前问题

当前直接依赖 `useStationStore`，同时其子组件 `StationModulePicker` 也直接依赖 `useStationStore`。

#### 目标定位

中层组件只负责展示“规划列表 + 搜索器”，不直接知道 store。

#### 建议 props

```ts
interface StationPlanningPanelProps {
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  filteredModulesGrouped: ModuleGroupResult[]
  searchQuery: string
  enforceDlcActivation: boolean
  flashingModuleIds: string[]
  highlightedModuleIds: string[]
}
```

#### 建议 emits

- `update:search-query`
- `add-module`
- `remove-module`
- `update-module-count`
- `reorder-modules`
- `apply-scale`
- `transfer-auto-module`

#### 重构要求

- 面板本身移除 `useStationStore`
- `StationModulePicker` 改为 props + emit
- drag reorder 结果由 emit 提交给上层

### C5. `StationModulePicker.vue`

#### 当前问题

当前直接依赖：

- `useStationStore`
- `useGameDataStore`

其中 `useGameDataStore` 可保留，但 `useStationStore` 应移除。

#### 目标定位

保留游戏元数据读取，移除业务态读取。

#### 建议 props

- `searchQuery`
- `filteredModulesGrouped`

#### 建议 emits

- `update:search-query`
- `select-module`

#### 可保留依赖

- `useGameDataStore`，仅用于 DLC 标签与名称展示

### C6. `StationPlanningItem.vue`

#### 当前状态判断

该组件未依赖 `useEmpireStore`，只依赖 `useGameDataStore` 做 DLC/模块元数据展示。

#### 建议

- 保持直接依赖 `useGameDataStore`
- 不必在本轮移除

### C7. `StationWareFlowsDashboard.vue`

#### 当前问题

当前同时依赖：

- `useStationStore`
- `useEmpireStore`
- `useGameDataStore`

它既显示当前站点流量，又从 empire 侧计算 component gap，因此是当前 UI 去耦中的重点难点。

#### 目标定位

改为纯 dashboard 组件。

#### 建议 props

```ts
interface StationWareFlowsDashboardProps {
  viewMode: 'quantity' | 'volume' | 'economy' | 'transport'
  groupedFlows: GroupedFlows
  settings: {
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
  }
  empireGaps: {
    operations: any[]
    supply: any[]
  }
}
```

#### 建议 emits

- `update:view-mode`
- `update:resource-buffer-hours`
- `update:primary-product-buffer-hours`
- `update:secondary-product-buffer-hours`
- `update:buy-multiplier`
- `update:sell-multiplier`
- `add-gap-module`
- `remove-gap-module`

#### 可保留依赖

- `useGameDataStore`，仅用于 ware / module 静态查询与翻译

#### 重构要求

- 不再直接读取 `useEmpireStore`
- 不再直接读取 `useStationStore`
- `groupedFlows` / `empireGaps` / `settings` 都由上层注入

### C8. `StationDashboard.vue`

#### 当前问题

当前直接依赖：

- `useStationStore`
- `useGameDataStore`

其中 `useGameDataStore` 可保留，`useStationStore` 应逐步移除。

#### 目标定位

改为“分析结果显示组件”。

#### 建议 props

- `stationAnalysis`
- `settings`
- `currentEfficiency`
- `actualWorkforce`
- `plannedModulesOverride`
- `hideWorkersView`

#### 建议 emits

- `update:transport-ship-capacity`
- `update:build-price-multiplier`
- `update:manual-workforce`
- `update:workforce-auto`
- `update:use-hq`

#### 可保留依赖

- `useGameDataStore`，用于翻译与静态模块/ware 查表

### C9. `EmpireWareFlowsDashboard.vue`

#### 当前状态判断

当前没有 `useEmpireStore` 依赖，只依赖 props + `useGameDataStore`。

#### 建议

- 可直接保留现状
- 可作为“目标模式”的参考样板

### C10. `TransitHubCenterDashboard.vue`

#### 当前状态判断

当前没有 `useEmpireStore`，只依赖 props + `useGameDataStore`。

#### 建议

- 保持现状
- 作为 transit 子树的标准模式

### C11. `ImportPlanModal.vue`

#### 当前问题

当前直接依赖：

- `useEmpireStore`
- `useGameDataStore`
- `useLogicFlowStore`
- `useStatusStore`

它不是工作台主体的一部分，但由 `ContextToolbar` 打开，因此属于本轮 UI 去耦的旁支重点。

#### 目标定位

保留：

- `useGameDataStore`
- `useLogicFlowStore`
- `useStatusStore`

移除：

- `useEmpireStore`

#### 建议 props

- `isOverview`
- `activeStationId`
- `activeStationName`
- `canImportIntoCurrentStation`

#### 建议 emits / actions

- `create-station-for-import`
- `apply-import-payload-to-station`
- `close`

#### 重构要求

- 当前站点选择和新建站点动作由上层注入
- modal 不再自己决定如何访问 empire store

### C12. `LoadPlanModal.vue`

#### 当前问题

当前直接依赖 `useEmpireStore` 和 `useSaveBindingStore`。

虽然它不在 production workbench 子树内部，但仍属于同一工作流 UI。

#### 本轮建议

先不纳入“production workbench 子树拆耦”主路径。  
原因：

- 这是 toolbar 级 modal
- 与当前工作台内层 props 化不是同一批风险

#### 处理策略

- 文档中标记为二阶段外围任务
- 不阻塞 workbench 子树先完成去耦

---

## 建议新增类型与中间层

### T1. 新增 `production-ui.types.ts`

建议位置：

- `src/components/empire/production-ui.types.ts`
  或
- `src/types/production-ui.ts`

至少包含：

- `ProductionTabItem`
- `StationTabBarProps`
- `ContextToolbarProps`
- `StationPlanningPanelProps`
- `StationWareFlowsDashboardProps`
- `StationDashboardProps`
- `TransitHubWorkbenchProps`
- `ProductionWorkbenchViewProps`

### T2. 禁止新增单一 `productionUiViewModel.ts`

不建议新增：

- `src/store/logic/productionUiViewModel.ts`

原因：

- 它会演化成新的 UI 总映射器
- 本质上仍会围绕 `useEmpireStore` 聚合全部工作台数据
- 当 `empireStore` 未来被消除时，这个文件会成为新的迁移阻塞点

本轮目标不是创建一个新的“UI facade 总文件”，而是按组件边界把 props 组装逻辑拆散。

### T3. 按组件边界拆分局部 view-model / composable

建议用多个局部模型替代单一总映射文件。

建议文件拆分如下：

#### `useProductionWorkbenchLayoutModel`

建议位置：

- `src/components/empire/composables/useProductionWorkbenchLayoutModel.ts`

职责：

- 只负责 overview / station / transit 三种布局判断
- 只负责 `ProductionWorkbenchView` 顶层布局 props

#### `useStationTabBarModel`

建议位置：

- `src/components/empire/composables/useStationTabBarModel.ts`

职责：

- 只负责 `StationTabBar` 所需 tab 数据、展开状态、active tab 和相关 actions

#### `useContextToolbarModel`

建议位置：

- `src/components/empire/composables/useContextToolbarModel.ts`

职责：

- 只负责 `ContextToolbar` 所需 title/station/settings/mineral/actions

#### `useStationPlanningPanelModel`

建议位置：

- `src/components/empire/composables/useStationPlanningPanelModel.ts`

职责：

- 只负责 `StationPlanningPanel` 与 `StationModulePicker` 的规划列表、搜索结果、增删改动作

#### `useStationWareFlowsModel`

建议位置：

- `src/components/empire/composables/useStationWareFlowsModel.ts`

职责：

- 只负责 `StationWareFlowsDashboard` 所需 groupedFlows/settings/empireGaps/actions

#### `useStationDashboardModel`

建议位置：

- `src/components/empire/composables/useStationDashboardModel.ts`

职责：

- 只负责 `StationDashboard` 所需分析结果、workforce、build settings 与更新动作

#### `useTransitHubWorkbenchModel`

建议位置：

- `src/components/empire/composables/useTransitHubWorkbenchModel.ts`

职责：

- 只负责 transit hub 三块面板输入：build panel / center dashboard / materials panel

#### `useImportPlanModalModel`

建议位置：

- `src/components/empire/composables/useImportPlanModalModel.ts`

职责：

- 只负责 `ImportPlanModal` 所需上下文和导入动作注入

### T4. 局部模型拆分原则

每个 view-model / composable 文件都必须满足：

- 只服务一个中层组件或一个局部布局
- 输入明确
- 输出明确
- 不跨组件回读其他中层状态
- 不演化成新的跨组件总编排器

禁止出现一个文件同时负责：

- tab bar
- toolbar
- planning panel
- ware flows
- dashboard
- transit hub
- import modal

这类“大而全 UI adapter”。

### T5. 直接以 `ProductionWorkbenchView` 作为当前顶层切入口

本轮不建议额外增加：

- `ProductionWorkbenchContainer.vue`

原因：

- 会增加一层短命中间层
- 后续进入 `BlueprintProductionEntry` / `LiveProductionEntry` 时还要再迁一次
- 当前阶段完全可以直接在 `ProductionWorkbenchView` 内完成“顶层读取 store、向下 props 化”这一步

因此本轮的过渡策略改为：

- `ProductionWorkbenchView` 暂时作为当前 production UI 唯一允许读取 `useEmpireStore` / `useStationStore` 的顶层组件
- 其余子组件逐步移除 store 依赖，改为由 `ProductionWorkbenchView` 注入 props / actions

---

## 推荐实施顺序

### Phase UI-1: 先建立 props 类型和顶层切入口

执行项：

1. 新建 `production-ui.types.ts`
2. 按组件边界创建多个局部 view-model / composable
3. 直接将 `ProductionWorkbenchView` 设为当前 production UI 顶层切入口
4. `MainWorkbench` 仍然渲染 `ProductionWorkbenchView`，但后续不再允许更深层组件直接读 `useEmpireStore`

目标：

- 给后续 agent 一个单一顶层切入口
- 避免一边拆子组件，一边让子组件继续读 store

### Phase UI-2: 先拆 `ProductionWorkbenchView` 和 `StationTabBar`

原因：

- 这是最上层以下最关键的两层
- 它们一旦 props 化，后面其他子组件就可以稳定改造

执行项：

1. `ProductionWorkbenchView` 改为纯 props
2. `StationTabBar` 改为纯 props + emit
3. 将 tab 分组与默认展开逻辑移到 `useStationTabBarModel`

### Phase UI-3: 再拆 `ContextToolbar`

原因：

- 这是当前 store 穿透最重的组件
- 但依赖较多，适合在外层结构稳定后处理

执行项：

1. 定义 toolbar props / emits
2. 移除 `useEmpireStore` / `useSaveBindingStore` / `useActiveViewStore` / `useStationStore`
3. 由容器接管 rename / updateSetting / openImport 等动作

### Phase UI-4: 再拆 `StationPlanningPanel` / `StationModulePicker`

执行项：

1. `StationPlanningPanel` props 化
2. `StationModulePicker` 移除 `useStationStore`
3. drag reorder 和 add/remove/update 通过 emit 上抛

### Phase UI-5: 再拆 `StationWareFlowsDashboard` / `StationDashboard`

原因：

- 它们对 station store 的依赖较深
- 但一旦 container 已经能组装 view-model，拆起来就只是接口迁移

执行项：

1. `StationWareFlowsDashboard` 移除 `useEmpireStore` / `useStationStore`
2. `StationDashboard` 移除 `useStationStore`
3. 保留 `useGameDataStore`

### Phase UI-6: 最后处理 `ImportPlanModal`

原因：

- 它横跨导入流程，变更面较大
- 不应阻塞主体工作台 props 化

执行项：

1. 从 `ContextToolbar` 中把 station/binding/overview 业务态先抽成 props
2. 再把 `ImportPlanModal` 的 station 创建与 payload 应用动作改为上层注入

---

## 另一位 agent 的直接施工规则

为了让另一个 agent 无负担直接开始，执行时应严格遵守以下规则。

### R1. `ProductionWorkbenchView` 以下禁止新增 `useEmpireStore`

凡是 production UI 子树中的新改动：

- 如果组件不是 `ProductionWorkbenchView`
- 就不能新增 `useEmpireStore`

### R2. 可以保留 `useGameDataStore`，但只能读静态数据

允许：

- `modulesMap`
- `waresMap`
- `getDlcDisplayName`
- `isDlcActive`
- `findModuleForWare`

不允许：

- 通过 game data 拼工作台业务态

### R3. 先做接口迁移，不要同时做业务语义改写

本轮重点是 **拆 UI 和 store 的耦合**，不是顺手改业务语义。

因此：

- 不要在同一轮里修改 tab 行为语义
- 不要同时改 binding / empire 的业务规则
- 先确保“同样的数据，经 props 传入后界面还能工作”

### R4. 先保留 `useStationStore` 在顶层容器中集中读取

中层组件移除 `useStationStore`，不代表本轮必须立刻消灭 `useStationStore`。

过渡方案允许：

- `ProductionWorkbenchView` 读 `useStationStore`
- 再把 `plannedModules/settings/groupedFlows/stationAnalysis` 下发给子组件

### R5. 每完成一层就停止扩散旧模式

例如：

- `StationTabBar` 一旦 props 化，后续相关改动都必须走 props
- 不允许一边 props 化，一边保留新的 store 读取分支

---

## Definition of Done

当且仅当以下条件满足时，才算本轮 `refactory-ui` 达成：

- `ProductionWorkbenchView` 不再直接依赖 `useEmpireStore`
- `StationTabBar` 不再直接依赖 `useEmpireStore`
- `ContextToolbar` 不再直接依赖 `useEmpireStore`
- `StationWareFlowsDashboard` 不再直接依赖 `useEmpireStore`
- `StationPlanningPanel` 与 `StationModulePicker` 不再直接依赖 `useStationStore`
- `StationDashboard` 不再直接依赖 `useStationStore`
- production UI 子树中，除 `ProductionWorkbenchView` 外，不再出现新的 `useEmpireStore`
- 允许保留的 `useGameDataStore` 依赖均只用于静态元数据和翻译
- 所有业务数据都能从顶层容器通过 props/actions 注入

---

## 非目标

本文件不要求在本轮内完成：

- 双入口 store 最终落地
- `useEmpireStore` 的 domain 拆分
- `LoadPlanModal` / toolbar 体系整体重构
- map / logic-flow / ship-build 子树统一改造

本轮唯一目标是：

- 把 production workbench 子树变成“顶层持有 store，内层吃 props”的结构

为后续 store 拆分和双入口复用扫清障碍。
