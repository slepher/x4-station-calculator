# user-save-binding-station Refactory 4

## Purpose

本文件基于 **UI 去耦已完成第一轮落地** 的现状，重新定义 Refactory 4 的目标架构与实施路径。

当前前提已经发生变化：

- `blueprint-production` 与 `live-production` 已经是两个独立 view
- production workbench 子树已经完成一轮 UI 去耦
- `ProductionWorkbenchView` 当前仍是唯一直接读取 `useEmpireStore` / `useStationStore` 的 production UI 顶层切入口，但它只是过渡期产物
- `StationTabBar`、`ContextToolbar`、`StationPlanningPanel`、`StationWareFlowsDashboard`、`StationDashboard`、`ImportPlanModal` 已基本转为 props / emits / 上层注入模式

因此，Refactory 4 的重点不再是继续做 UI props 化，而是：

1. 把“两个 view”升级为“两个真正独立的入口”
2. 用 `BlueprintProductionWorkbenchView` 与 `LiveProductionWorkbenchView` 分别直接接入各自 store
3. 把 `useEmpireStore` 的跨入口编排职责拆开
4. 在不回退 UI 去耦成果的前提下，建立两个 domain store，并尽量复用底层逻辑

---

## Current Baseline

### B4-1. UI 去耦第一轮已经完成，但入口装配仍集中在过渡组件 `ProductionWorkbenchView`

当前 production UI 已具备以下边界：

- `StationTabBar` 已改为 props + emits
- `ContextToolbar` 已改为 props + emits
- `StationPlanningPanel` / `StationModulePicker` 已移除中层 store 穿透
- `StationWareFlowsDashboard` / `StationDashboard` 已通过 props 接收业务数据
- `ImportPlanModal` 已移除对 `useEmpireStore` 的直接依赖，改为由上层注入当前站点、新建站点、导入 payload 等动作

但当前主路径仍然是：

- `ProductionWorkbenchView` 直接读取 `useEmpireStore`
- `ProductionWorkbenchView` 直接读取 `useStationStore`
- `ProductionWorkbenchView` 负责组装 toolbar / planning / ware-flows / dashboard / transit-hub / import-modal 所有局部 model

所以现状不是“共享工作台已经就绪”，而是：

- 子树已去耦
- 顶层仍然是单一总装配器

### B4-2. `useEmpireStore` 仍然是跨入口总编排器

虽然 UI 去耦后，组件层对 `useEmpireStore` 的依赖已经大幅收缩，但 store 层没有同步完成入口拆分。

当前 `useEmpireStore` 仍同时负责：

- blueprint 入口的 empire station / sector / sectorLink / save
- live 入口的 binding station / group / draft / save
- selection 路由
- mutation 路由
- flow facade 分发
- session / dirty / saveCurrentSource 编排

这意味着：

- 组件层不再穿透 store
- 但 domain 复杂度仍集中在同一个 source-aware 总 store

### B4-3. 当前最合适的下一步不是继续拆子组件，而是拆“入口”与“domain store”

基于现在这版代码，继续深挖 UI props 化的收益已经明显下降。

当前真正阻碍后续演进的点变成：

- `MainWorkbench` 仍然承担 view 到数据源的翻译
- 过渡组件 `ProductionWorkbenchView` 仍然承担单一入口装配
- `useEmpireStore` 仍然承担双入口编排

所以 Refactory 4 必须从“UI 去耦”切换到“入口去耦 + store 去耦”。

---

## Goals

### G4-1. 共享 UI 继续保留，且不回退

Refactory 4 不是推翻 UI 去耦成果。

必须保留的成果：

- production workbench 子树继续以 props / emits / actions 驱动
- `ImportPlanModal` 不回退为直接依赖 `useEmpireStore`
- 不新增新的中层 store 穿透
- 不重新把 `productionSource` 判断扩散回子组件

### G4-2. 让“两个 view”变成“两个直接接入各自 store 的独立入口”

目标不是继续在同一个生产工作台入口下切换 source，而是明确建立：

- `BlueprintProductionWorkbenchView`
- `LiveProductionWorkbenchView`

两个入口分别负责：

- 直接接入自己的 domain store
- 处理自己的 session / save / dirty / confirm 语义
- 向共享 workbench 子树注入各自 props / actions

### G4-3. 让 store 彻底拆分，但逻辑尽量复用

这里的“彻底拆分”指的是：

- blueprint 不再通过共享 store 路由到 binding
- live 不再通过共享 store 路由到 empire
- save / discard / saveAs / delete / snapshot 各自独立

这里的“尽量复用”指的是：

- 复用 compute / query / command / importer / mapper
- 不复用 session 语义与入口生命周期

原则是：

- 复用“怎么算”
- 不复用“谁负责保存、切换、确认”

---

## Target Architecture

### A4-1. 两个入口直接接入各自 store + 一套共享子组件树

目标结构如下：

```text
MainWorkbench
├── BlueprintProductionWorkbenchView
│   └── useBlueprintProductionStore
└── LiveProductionWorkbenchView
    └── useLiveProductionStore

共享 UI：
- StationTabBar
- ContextToolbar
- StationPlanningPanel
- StationWareFlowsDashboard
- StationDashboard
- TransitHub*
- ImportPlanModal
```

### A4-2. `ProductionWorkbenchView` 的处理方式

`ProductionWorkbenchView` 不作为 Refactory 4 完成后的保留对象。

Refactory 4 完成后必须满足以下要求：

- `BlueprintProductionWorkbenchView` 直接组合已去耦子组件
- `LiveProductionWorkbenchView` 直接组合已去耦子组件
- `ProductionWorkbenchView` 从主路径移除

`ProductionWorkbenchView` 当前承担的以下职责，必须迁移到两个入口组件：

- overview / station / transit 布局编排
- 子组件 props / emits 接线
- import modal 展示与关闭状态
- toolbar / planning / ware-flows / dashboard / transit-hub 的业务 mapping
- blueprint/live 分支语义

### A4-3. 共享 props / actions contract 层

禁止新增单一的“大而全 viewModel 文件”。

Refactory 4 必须按当前局部 model 方向建立以下共享 props / actions contract：

- `ProductionTabBarContext`
- `ProductionToolbarContext`
- `ProductionPlanningContext`
- `ProductionWareFlowsContext`
- `ProductionDashboardContext`
- `ProductionTransitHubContext`
- `ProductionImportContext`

这些 contract 必须满足以下要求：

- 只暴露共享 UI 需要的数据
- 不直接暴露 `EmpirePlan` / `SaveBindingPlan`
- 不要求共享组件自己理解 `productionSource`
- 不要求共享组件自己决定保存语义
- 不用于替代入口组件对 store 的直接接入

### A4-4. 两个 domain store

#### `useBlueprintProductionStore`

职责：

- active empire / station / transit selection
- empire station / sector / sectorLink mutation
- empire grouped flows / transit hub 数据
- save / saveAs / delete / snapshot / dirty
- 为 `BlueprintProductionWorkbenchView` 提供完整主路径数据与动作

#### `useLiveProductionStore`

职责：

- active binding / station / transit selection
- covered station / virtual station 派生
- binding station / group mutation
- binding grouped flows / transit hub 数据
- draft / save / discard / confirm / restore
- 为 `LiveProductionWorkbenchView` 提供完整主路径数据与动作

### A4-5. 可复用逻辑下沉层

Refactory 4 必须保留并继续复用以下底层逻辑：

- `stationComputeService`
- `stationCommands`
- importer / blueprint parser / payload builder
- `empireSourceView` 中已经抽出的纯读取逻辑
- `empireFlowFacade` 中已经抽出的 flow / transit 查询逻辑
- tab / dashboard / ware-flow / transit-hub 局部 model 的纯映射逻辑

以下逻辑禁止继续作为共享层保留：

- `saveCurrentSource`
- 统一的 source-aware session 编排
- 统一的 source-aware dirty/save/discard 决策

---

## Refactor Strategy

### Phase 1. 固化 UI 边界，不再新增回退

在进入入口拆分前，先明确施工规则：

- 已去耦子组件中禁止新增 `useEmpireStore`
- 已去耦子组件中禁止新增 `useStationStore`
- `useGameDataStore` 仅用于静态游戏数据与翻译
- 任何新逻辑不得重新扩散 `productionSource` 到子组件

这一步的目标不是新增代码，而是确保 Refactory 4 不会破坏已经完成的 UI 去耦成果。

### Phase 2. 创建两个直接接入 store 的入口组件

禁止新增额外的“外层大 container”。

Refactory 4 必须创建两个入口组件，并让它们直接接入各自 store：

- `BlueprintProductionWorkbenchView` 直接接入 `useBlueprintProductionStore`
- `LiveProductionWorkbenchView` 直接接入 `useLiveProductionStore`

两个入口组件必须负责：

- 读取各自 store
- 直接组合共享子组件树并注入所需 props / actions
- 承担各自入口的 session / save / dirty / discard / confirm 语义
- 替代 `ProductionWorkbenchView` 当前的顶层装配职责

### Phase 3. 创建两个 domain store，并先拆 session

两条入口真正难拆的不是展示，而是生命周期。

本阶段创建：

- `useBlueprintProductionStore`
- `useLiveProductionStore`

并先拆：

- blueprint session service
- live session service

执行顺序固定为先 session，原因如下：

- save / saveAs / discard / confirm 是两个入口最大的语义分叉
- 只要 session 还没拆，mutation 再怎么抽文件，最终仍会回到总 store 做编排

### Phase 4. 让两个 domain store 接管主路径

在 session 服务就位后，两个 domain store 按以下顺序接管主路径：

1. selection
2. grouped flows / transit hub
3. station mutation
4. session / dirty / save

禁止一次性整包替换所有能力。

### Phase 5. 收缩旧兼容层

只有当两个入口都已跑通后，才开始收缩：

- `useEmpireStore` 中对 binding 的主路径编排
- `useStationStore` 中基于 `productionSource` 的写路由
- `MainWorkbench` 中 view -> source -> load 的 watcher 翻译

兼容层必须遵循以下规则：

- 迁移期允许存在
- 新代码不得继续依赖
- 迁移完成后集中删除

---

## Implementation Guidance

### I4-1. `MainWorkbench` 的目标

`MainWorkbench` 最终只负责：

- 根据 `activeView` 选择 `BlueprintProductionWorkbenchView` 或 `LiveProductionWorkbenchView`

`MainWorkbench` 禁止继续负责：

- 自动把 view 翻译为 `productionSource`
- 在自己内部协调 empire / binding 的加载逻辑

### I4-2. `ProductionWorkbenchView` 的目标

当前它还是顶层装配器；Refactory 4 完成后必须被移除。

`ProductionWorkbenchView` 当前承担的布局、props 注入、modal 接线职责，必须分别迁移到：

- `BlueprintProductionWorkbenchView`
- `LiveProductionWorkbenchView`

### I4-3. `ImportPlanModal` 的目标

既然它已经去掉了对 `useEmpireStore` 的直接依赖，Refactory 4 必须继续保持：

- 由入口层或 workbench 顶层注入导入相关 action
- 不回退为自己决定当前 source / 当前 store

`ImportPlanModal` 归入 `ProductionImportContext`，并且不得再次成为新的业务旁路。

### I4-4. 局部 composable 的目标

当前这批局部 model 已经存在。Refactory 4 必须按以下方式处理：

- 让它们成为共享 contract 的组成部分
- 把依赖从“直接读 store”调整为“入口组件提供 computed / actions”
- 去掉不必要的 `as any`
- 校正 transit / overview / station 三种模式下的 contract 一致性

---

## Non-Goals

本轮不要求一次性完成以下内容：

- 一步删除整个 `useEmpireStore`
- 一步删除整个 `useStationStore`
- 一次性把所有 production 逻辑改造成完全无 store 的纯 view

Refactory 4 的交付目标是：

- 从“UI 已去耦但入口未去耦”的中间态
- 推进到“两个入口成立、两个 domain store 成立、共享子组件树可持续复用、`ProductionWorkbenchView` 已移除”的状态

---

## Definition of Done

只有满足以下条件，才可认为 Refactory 4 完成：

- `blueprint-production` 与 `live-production` 已成为真正独立入口
- `BlueprintProductionWorkbenchView` 与 `LiveProductionWorkbenchView` 已分别直接接入各自 store
- `MainWorkbench` 不再承担 view -> source -> load 的双重翻译
- `ProductionWorkbenchView` 已从主路径移除
- 共享子组件树继续保持 props / emits / actions 驱动
- `useBlueprintProductionStore` 与 `useLiveProductionStore` 已接管各自主路径
- blueprint 与 live 的 session / dirty / save 语义已经独立
- 新主路径中不再扩散 `productionSource` 兼容判断
- `useEmpireStore` 与 `useStationStore` 仅保留过渡兼容职责，且不再是主路径核心
