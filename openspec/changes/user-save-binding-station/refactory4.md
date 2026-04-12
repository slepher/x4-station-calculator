# user-save-binding-station Refactory 4

## Purpose

基于最新需求澄清，重新定义这一轮重构的主轴：

- 不是继续围绕“同一个 production 入口 + source-aware 切换”打补丁
- 而是承认当前产品语义已经变成“**同一类内容，拆成两个独立入口**”
- 因此，前端与 store 的重构目标都应相应升级为：
  - 前端共享工作台 UI
  - 蓝图产能 / 实况产能分别拥有独立入口与独立 domain store
  - 可复用逻辑下沉到纯 service / query / command 层

本文件用于回答四个问题：

1. 当前代码为什么仍然没有真正完成“两个入口”的拆分
2. “前端可复用、store 彻底拆分、逻辑尽量复用”分别意味着什么
3. 后续目标架构应该长什么样
4. 下一阶段应如何分步实施，避免再次退回到 source-aware 总编排器

---

## 最新判断

### R4-1. 当前代码只完成了“入口命名拆分”，没有完成“入口架构拆分”

目前系统已经具备：

- `blueprint-production`
- `live-production`

这两个 view 标识，并且 `useActiveViewStore` 已分离存储：

- `activeEmpireId`
- `activeEmpireStation`
- `activeBinding`
- `activeBindingStation`

但主业务路径仍然表现为：

- 组件层继续依赖共享 store
- 共享 store 内部再通过 `productionSource` 做 source-aware 路由
- `MainWorkbench` 中 watcher 再把两个 view 翻译回 `empire` / `save-binding`

这说明当前只是“状态字段被拆开了”，而不是“入口本身被拆开了”。

### R4-2. `useEmpireStore` 仍然是跨入口总编排器

虽然 `refactory3` 已经完成：

- `empireSourceView`
- `empireFlowFacade`
- `empireMutationService` 基础设施

但 `useEmpireStore` 仍然同时负责：

- 蓝图入口的 station / sector / sector link / save
- 实况入口的 binding station / group / draft / save
- active selection 路由
- mutation 路由
- session / lifecycle 编排

所以它依然是“两个入口共享的总入口”。

这与当前目标冲突，因为：

- 两个入口的会话语义不同
- 两个入口的 dirty/save 语义不同
- 两个入口的领域对象不同

这类差异不应继续寄生在一个 store 中。

### R4-3. 当前前端复用的是“共享 store”，不是“共享 UI”

例如 `ProductionWorkbenchView`、`StationTabBar` 等组件目前主要直接读取：

- `useEmpireStore`
- `useStationStore`

这意味着它们的复用方式本质上是：

- 共享模板
- 共享 store
- 组件内部通过 store 结果间接承受 source-aware 复杂度

这类复用会导致两个问题：

1. 组件无法真正成为“两个入口的共享工作台”
2. 每次新增入口差异，都更容易继续往 store 中堆分支

### R4-4. 下一阶段重点不应是继续做 facade，而应是建立“两个 domain store + 一套共享 contract”

如果继续沿 `refactory3` 的方向，仅把 `useEmpireStore` 拆成更多 service：

- 可以继续降低文件体积
- 但不能真正完成入口级拆分

下一阶段必须把主目标改成：

- 共享 UI 只依赖标准化 context / adapter
- 蓝图入口使用独立 store
- 实况入口使用独立 store
- store 之间不互相路由业务语义

---

## 重构目标重新定义

### G4-1. 前端代码可复用

这里的“可复用”不是指：

- 所有组件继续直接读同一个 store

而是指：

- 两个入口可以共用同一套工作台组件
- 共享组件只依赖标准输入接口
- 不直接依赖 `EmpirePlan` / `SaveBindingPlan` 的完整结构
- 不直接依赖 `productionSource`

换言之，应该复用：

- 工作台布局
- Tabbar 视图
- 上下文工具栏
- 站点规划面板
- dashboard / flow 展示组件

但共享组件不应承担“数据源路由”。

### G4-2. store 代码彻底拆分

这里的“彻底拆分”是指：

- 蓝图入口不再通过共享 store 路由到实况逻辑
- 实况入口不再通过共享 store 路由到蓝图逻辑
- session / save / dirty / selection 各自独立

最终目标应是：

- `useBlueprintProductionStore`
- `useLiveProductionStore`

分别作为两个入口的 domain store。

### G4-3. 尽量复用可以复用的逻辑

复用应发生在“逻辑内核”层，而不是“领域编排”层。

适合复用的内容：

- `stationComputeService`
- station state 与 recompute 流程
- grouped flows / transit hub / tab-group 的纯查询逻辑
- station command builder
- importer / plan payload 转换
- 共享的 workbench view-model 组装逻辑

不应强行复用的内容：

- empire 的 session/save/saveAs 生命周期
- binding 的 draft/save/discard 生命周期
- covered station / virtual station 的派生编排
- empire sector link 的持久化编排

原则是：

- 复用“怎么算”
- 不复用“谁负责保存、切换、确认”

---

## 建议目标架构

### A4-1. 入口层：两个独立 entry component

建议建立两个入口组件：

- `BlueprintProductionEntry.vue`
- `LiveProductionEntry.vue`

它们分别负责：

- 装配各自 store
- 组装共享工作台所需的 context
- 承担各自的加载、切换、保存、确认语义

`MainWorkbench` 只负责根据 active view 选择入口组件，不再自己做 source-aware watcher 编排。

### A4-2. 共享 UI 层：`ProductionWorkbenchView` 退化为纯工作台

`ProductionWorkbenchView` 不再直接依赖：

- `useEmpireStore`
- `useStationStore`

而是接收标准化的 `ProductionWorkbenchContext`（或同等 composable 输出）。

这个共享 context 至少应包含：

- `tabs`
- `activeTabId`
- `activeStation`
- `activeTransitSectorId`
- `isOverview`
- `isDirty`
- `canSave`
- `overviewGroupedFlows`
- `stationGroupedFlows`
- `transitHubModel`
- 一组显式 actions

例如：

- `selectStation`
- `selectTransitSector`
- `createStation`
- `deleteStation`
- `renameStation`
- `saveCurrentEntry`

### A4-3. Domain store 层：蓝图 / 实况彻底分离

建议抽出：

#### `useBlueprintProductionStore`

职责：

- active empire / active station / active transit sector
- empire station / sector / sector link mutation
- empire grouped flows / transit hub 计算结果
- save / saveAs / delete / dirty snapshot

#### `useLiveProductionStore`

职责：

- active binding / active binding station / active group transit
- covered station + virtual station 派生
- binding station / group mutation
- binding grouped flows / transit hub 计算结果
- draft / save / discard / confirm lifecycle

### A4-4. 共享内核层：query / command / compute / adapter

建议把“仍应复用的逻辑”收敛到独立文件层次，例如：

- `store/logic/stationComputeService.ts`
- `store/logic/productionWorkbenchQueries.ts`
- `store/logic/productionWorkbenchCommands.ts`
- `store/logic/productionTabViewModel.ts`

这些文件只接收输入依赖，不直接绑定某个 domain store。

### A4-5. 兼容层：短期保留，长期删除

短期可以保留：

- `productionSource`
- `activeId`
- `activeStationId`

这类 computed 兼容层，用于减少迁移面。

但它们只能作为过渡适配层，不能再成为新主路径。

最终应删除：

- `useEmpireStore` 内部对 binding 的主路径路由
- `useStationStore` 内部对 `productionSource` 的写路径路由
- `MainWorkbench` 中把 view 再翻译为 source 的 watcher 编排

---

## 实施顺序

### Phase 1: 先定义共享 contract，再迁移共享 UI

第一步不是先继续拆 store，而是先明确共享工作台真正需要的数据和动作。

先做：

- `ProductionWorkbenchContext`
- `StationTabBarContext`
- `StationPlanningContext`
- `ProductionDashboardContext`

目标：

- 让共享组件先与具体 store 解耦
- 防止后续入口拆分时组件继续回头依赖总 store

### Phase 2: 建立两个 entry component

创建：

- `BlueprintProductionEntry.vue`
- `LiveProductionEntry.vue`

先不追求 store 一次性完全拆完，先让入口层真正分开。

这样可以先完成：

- 入口装配责任分离
- `MainWorkbench` 简化
- 两个入口的上下文边界清晰化

### Phase 3: 建立两个 domain store

在 entry component 之后，再正式拆 store：

- `useBlueprintProductionStore`
- `useLiveProductionStore`

迁移策略：

- 蓝图侧先接管 empire 相关 selection / mutation / session
- 实况侧再接管 binding 相关 selection / mutation / session

此阶段允许保留一层 façade 兼容旧调用，但新代码必须直接接入新 store。

### Phase 4: 下沉逻辑复用层

当两个 store 边界稳定后，再继续整理复用逻辑：

- station commands
- compute deps / recompute
- tab 分组与展开规则
- grouped flows / transit hub 查询
- imported payload 应用

要求：

- 共享逻辑必须是纯 service / query / command
- 不再把“蓝图 / 实况差异”塞回共享层

### Phase 5: 拆 session / dirty / save 生命周期

这是“彻底拆分”是否真正完成的关键验收点。

必须将：

- empire save / saveAs / delete / snapshot
- binding save / discard / confirm / draft restore

彻底拆到两个入口各自的 session service 中。

如果这一阶段不拆，系统最终仍会保留一个跨入口总编排器。

### Phase 6: 删除兼容层与旧主路径

最后再移除：

- `useEmpireStore` 中对 binding 的核心编排
- `useStationStore` 中基于 `productionSource` 的写路由
- `MainWorkbench` 里的 source-aware watcher
- 共享组件对旧 store 的直接依赖

只有完成这一阶段，才能说“两个入口拆分完成”。

---

## 成功标准

只有同时满足以下条件，才算达成本阶段目标：

- `MainWorkbench` 不再负责把两个入口重新翻译成 `productionSource`
- `ProductionWorkbenchView` 不再直接依赖 `useEmpireStore` / `useStationStore`
- 蓝图入口与实况入口拥有各自独立 store
- 共享组件仅依赖标准化 context / adapter
- empire 与 binding 的 session/save/dirty 生命周期已独立
- 可复用逻辑沉到纯 service / query / command，而不是共享总 store

---

## 非目标

本阶段不追求：

- 一次性重写所有旧组件
- 一次性删除所有兼容 computed
- 强行统一 empire 与 binding 的持久化模型

本阶段真正追求的是：

- 先把“两个入口”的架构边界立起来
- 再在边界内做逻辑复用
- 最后逐步清退旧总编排器

---

## 细化执行说明

### E4-1. 重构主线

本轮重构的目标不是继续优化 `productionSource` 分支结构，而是将“蓝图产能 / 实况产能”从“同一入口下的数据源切换”升级为“两个独立入口下的共享工作台”。

这意味着后续所有设计判断都应遵循以下优先级：

1. 先区分入口边界
2. 再抽共享 UI
3. 最后下沉可复用逻辑

禁止继续以“共享总 store + source-aware 路由”作为长期目标架构。  
兼容层可以保留，但只能服务迁移过程，不能继续成为新主路径。

### E4-2. 架构目标

目标架构如下：

```text
MainWorkbench
├── BlueprintProductionEntry
│   └── useBlueprintProductionStore
│       └── shared query / command / compute services
└── LiveProductionEntry
    └── useLiveProductionStore
        └── shared query / command / compute services

共享 UI 层：
ProductionWorkbenchView
StationTabBar
ContextToolbar
StationPlanningPanel
StationDashboard / Flow Dashboard
```

该架构强调三件事：

- 入口独立：蓝图与实况分别拥有自己的生命周期、选择状态、保存语义
- UI 共享：两个入口复用同一套工作台组件
- 逻辑下沉：复用发生在 `service/query/command` 层，而不是发生在“共享 domain store”层

### E4-3. 分层原则

#### 入口层

入口层负责：

- 决定当前展示的是哪个业务入口
- 初始化对应 domain store
- 处理 load / save / discard / confirm 等入口级生命周期
- 将 domain 数据组装为共享 UI 可消费的 context

入口层不负责：

- 大量业务计算
- 组件内部布局判断
- 横跨两个入口的统一路由逻辑

#### Domain Store 层

蓝图与实况各自拥有独立 store。

蓝图入口 store 负责：

- empire 的 selection
- station / sector / sector link mutation
- empire grouped flows
- empire save / saveAs / delete / snapshot / dirty

实况入口 store 负责：

- binding 的 selection
- covered station / virtual station 派生
- binding station / group mutation
- binding grouped flows
- draft / save / discard / confirm / restore

domain store 不应再互相调用或通过 `productionSource` 判断彼此职责。

#### 共享 UI 层

共享 UI 组件只处理：

- 展示
- 事件分发
- 基于标准化 context 的局部交互

共享 UI 不应直接依赖：

- `useEmpireStore`
- `useSaveBindingStore`
- `useStationStore`
- `productionSource`

#### 共享逻辑层

共享逻辑层只允许包含：

- compute service
- query builder
- command builder
- view-model mapper

共享逻辑层必须保持“输入明确、输出明确”，避免将业务状态藏在全局 store 中。

### E4-4. 共享 Contract 设计

#### `ProductionWorkbenchContext`

建议定义统一上下文，作为共享工作台唯一依赖。

建议包含以下字段：

```ts
interface ProductionWorkbenchContext {
  mode: 'blueprint' | 'live'
  title: string
  isDirty: boolean
  canSave: boolean

  activeTabId: string | null
  activeStationId: string | null
  activeTransitSectorId: string | null
  isOverview: boolean

  tabs: ProductionTabItem[]
  overview: ProductionOverviewModel | null
  stationPanel: ProductionStationPanelModel | null
  transitPanel: ProductionTransitPanelModel | null

  actions: ProductionWorkbenchActions
}
```

#### `ProductionTabItem`

用于统一 TabBar 输入，不暴露具体 domain 对象。

```ts
interface ProductionTabItem {
  id: string
  type: 'overview' | 'unassigned-station' | 'transit' | 'station'
  label: string
  icon?: string
  sectorId: string | null
  expanded?: boolean
  active?: boolean
}
```

#### `ProductionWorkbenchActions`

统一工作台行为入口。

```ts
interface ProductionWorkbenchActions {
  selectOverview(): void
  selectStation(stationId: string): void
  selectTransitSector(sectorId: string): void

  createStation?(): void
  renameStation?(stationId: string, name: string): void
  deleteStation?(stationId: string): void
  duplicateStation?(stationId: string): void

  saveCurrent(): void
  discardCurrent?(): void
}
```

#### 约束

共享 contract 必须满足以下约束：

- 不直接暴露 `EmpirePlan`
- 不直接暴露 `SaveBindingPlan`
- 不要求 UI 组件知道当前 source 是什么
- 不要求 UI 组件自行拼装 tab/group/overview/transit 逻辑

### E4-5. 组件迁移策略

#### `ProductionWorkbenchView`

目标：

- 从“直接读 store 的页面组件”退化为“纯共享工作台壳”

迁移后职责：

- 根据 `context.isOverview` 决定 overview 布局
- 根据 `context.activeTransitSectorId` 决定 transit 布局
- 根据 `context.stationPanel` 决定 station 布局

禁止继续：

- 在内部读取 `useEmpireStore`
- 在内部读取 `useStationStore`
- 在内部推导 source 差异

#### `StationTabBar`

目标：

- 从“读 store + 拼 tab + 执行动作”改为“展示 tabs + 抛事件”

迁移后输入：

- `tabs`
- `activeTabId`
- `canCreateStation`

迁移后输出：

- `selectOverview`
- `selectTransitSector`
- `selectStation`
- `createStation`
- `deleteStation`
- `duplicateStation`

tab 的分组规则、默认展开规则、折叠展开逻辑，不应继续散落在组件内部，应迁移到 query/view-model 层。

#### `ContextToolbar`

目标：

- 从“跨入口读多个 store”改为“入口注入上下文”

输入应包括：

- `title`
- `isDirty`
- `canSave`
- `canRename`
- `onRename`
- `onSave`
- `onDiscard`

#### `StationPlanningPanel`

目标：

- 只关心当前站点编辑模型
- 不关心这是蓝图站点还是 binding 站点

输入应包括：

- `station`
- `settings`
- `modules`
- `actions.updateModules`
- `actions.updateSettings`
- `actions.importPlan`

#### `StationDashboard` / Flow Dashboard

目标：

- 接收上游算好的 dashboard model
- 不直接访问 domain store
- 不自行拼装 dirty/save/source 分支

### E4-6. 入口组件设计

#### `BlueprintProductionEntry`

职责：

- 初始化蓝图入口 store
- 组装蓝图工作台 context
- 注入蓝图侧 save / saveAs / delete / selection / mutation 行为
- 作为蓝图入口唯一页面装配器

不应承担：

- binding 相关逻辑
- `productionSource` 翻译逻辑

#### `LiveProductionEntry`

职责：

- 初始化实况入口 store
- 组装实况工作台 context
- 注入 draft / save / discard / confirm 行为
- 作为实况入口唯一页面装配器

不应承担：

- empire 相关逻辑
- 通过共享 store 路由到蓝图逻辑

#### `MainWorkbench`

重构目标：

- 只根据 `activeView` 渲染入口组件
- 不再通过 watcher 做：
  - view -> source
  - source -> load empire
  - source -> open binding

入口切换后的加载逻辑，应内聚在入口组件或入口 store 中。

### E4-7. Store 拆分策略

#### `useBlueprintProductionStore`

建议逐步迁入以下职责：

- 当前 empire 读取
- 当前 station / transit selection
- station / sector / sector link mutation
- empire grouped flows
- transit hub view model
- save / saveAs / delete / snapshot / dirty

建议复用：

- `empireFlowFacade`
- `empireSourceView`
- `stationComputeService`
- 通用 command/query builders

最终要求：

- 蓝图入口不再通过 `productionSource` 分支访问 binding 逻辑

#### `useLiveProductionStore`

建议逐步迁入以下职责：

- 当前 binding 读取
- covered station + virtual station 派生
- station / group selection
- station / group mutation
- binding grouped flows
- transit hub view model
- draft / save / discard / restore / confirm

最终要求：

- 实况入口不再通过 `productionSource` 分支访问 empire 逻辑

#### `useEmpireStore` 的后续定位

短期：

- 可保留为迁移兼容 facade

中期：

- 只保留 empire 侧旧调用兼容

长期：

- 从主路径退场，不再承担 binding 编排职责

#### `useStationStore` 的后续定位

短期：

- 可作为 active station facade 存在

中期：

- 逐步收缩为“站点编辑 UI 适配层”

长期：

- 不再负责 source-aware 写路由
- 只保留共享站点编辑逻辑的薄包装，或被入口内 composable 替代

### E4-8. 可复用逻辑的下沉范围

#### 应复用的逻辑

应下沉为纯 service/query/command 的部分：

- `stationComputeService`
- persisted -> state -> recompute 流程
- tab 分组与展开规则
- overview / station / transit 面板 view-model
- grouped flows 聚合逻辑
- transit hub 查询逻辑
- 导入 payload 应用逻辑
- 站点编辑命令 builder

#### 不应强行复用的逻辑

以下逻辑不应为了“统一”而重新合并：

- empire 的 save / saveAs / delete 语义
- binding 的 draft / discard / confirm 语义
- covered station / virtual station 的派生编排
- empire sector link 的持久化策略

#### 判断标准

如果一段逻辑必须知道：

- 当前入口是谁
- 持久化模型是什么
- 保存/放弃语义是什么

那么它就不应属于共享层，而应属于入口 store 或 session service。

### E4-9. Session 生命周期拆分要求

#### 蓝图侧 Session Service

建议抽出独立模块负责：

- `loadEmpire`
- `saveEmpire`
- `saveEmpireAs`
- `deleteEmpire`
- `takeSnapshot`
- `isDirty`
- `requiresSaveAsOnSave`

#### 实况侧 Session Service

建议抽出独立模块负责：

- `openBinding`
- `saveBindingDraft`
- `discardBindingDraft`
- `restoreBindingDraft`
- `confirmBeforeLeave`
- `isDirty`

#### 验收标准

只有当两侧 session 生命周期彻底独立后，才能说 store 已完成“入口级拆分”。  
否则系统仍然会保留一个跨入口总编排器。

### E4-10. 兼容层策略

#### 可暂时保留的兼容层

迁移期间允许保留：

- `productionSource`
- `activeId`
- `activeStationId`

这些 computed 只能服务于旧代码迁移。

#### 明确禁止

从 Refactory 4 开始，禁止：

- 在新组件中继续新增 `productionSource` 判断
- 在新 store 中继续新增 source-aware mutation 路由
- 在入口层之外继续写 `view -> source -> load` 的 watcher 逻辑

#### 删除顺序

建议在以下条件满足后删除兼容层：

1. 两个入口组件已落地
2. 共享工作台已改吃 context
3. 两个 domain store 已接管主路径
4. 回归测试已覆盖两条入口链路

### E4-11. 任务拆分建议

#### 第一批任务：立骨架

- 定义共享 contract
- 改造 `ProductionWorkbenchView`
- 创建 `BlueprintProductionEntry`
- 创建 `LiveProductionEntry`
- 简化 `MainWorkbench`

目标：先把“两个入口”的骨架立起来。

#### 第二批任务：拆主路径

- 创建 `useBlueprintProductionStore`
- 创建 `useLiveProductionStore`
- 将共享 UI 逐步切换到新入口 context
- 停止新主路径使用 `productionSource`

目标：让新入口真正接管主业务流。

#### 第三批任务：下沉复用层

- 整理 query / command / view-model
- 整理 station 编辑命令
- 整理 tab / overview / transit 聚合逻辑

目标：保证拆分后不产生大面积重复代码。

#### 第四批任务：删除旧路径

- 收缩 `useEmpireStore`
- 收缩 `useStationStore`
- 删除 watcher-based source route
- 删除兼容 computed 主路径依赖

目标：完成迁移闭环。

### E4-12. 最终完成标准

本轮重构只有在以下条件全部满足时才算完成：

- `blueprint-production` 与 `live-production` 已成为真正独立入口
- `MainWorkbench` 不再承担入口到 source 的翻译职责
- `ProductionWorkbenchView` 不再直接依赖总 store
- 共享 UI 全部改为依赖标准化 context / props / actions
- 蓝图与实况拥有各自独立 domain store
- save / dirty / discard / confirm 生命周期已独立
- 复用逻辑已沉到底层 service/query/command
- 旧总编排器不再是主路径
