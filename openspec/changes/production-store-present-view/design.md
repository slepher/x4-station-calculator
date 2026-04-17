# Production Store Presenter View - 设计文档

## 设计目标

本次重构的核心不是调整业务算法，而是稳定 production workbench 的分层边界：

- `store` 负责领域状态与业务动作
- `presenter` 负责 UI 组装
- `view` 负责展示与切换

当前代码已经部分 presenter 化，但 store 仍然直接暴露大量按面板命名的 getter，view 也仍持有少量直接拼装逻辑。继续沿着旧接口扩展，会让 `station` / `transit` / `planning` / `live` 的分支继续散落在多层。

本方案通过统一主状态对象，先把“数据长什么样”固定，再让 presenter 作为唯一 UI 适配层。

## 最终架构

### 1. Store

两个 store 继续保留：

- `useBlueprintProductionStore`
- `useLiveProductionStore`

但它们对外统一导出：

- `session`
- `context`
- `stationState`
- `actions`

其中前三者是 store 直接导出的主领域对象；`actions` 是业务行为。

这里的边界必须明确：

- 正式主对象出口是 `store.session / store.context / store.stationState`
- 不保留 `workbench` 兼容适配层作为正式迁移方案
- presenter 直接消费 store 主对象与 actions

### 2. Presenter

保留现有五个 presenter：

- `useProductionTabbarPresenter`
- `useProductionToolbarPresenter`
- `useProductionPlanningPresenter`
- `useProductionWareflowPresenter`
- `useProductionDashboardPresenter`

它们统一只读：

- `session`
- `context`
- `stationState`
- `actions`

presenter 的职责是：

- 把领域对象映射为子组件 props
- 绑定 UI emits 到 store actions
- 处理 station / transit / overview 的展示分支

presenter 不负责：

- 重算 `productionFlows`
- 重算 `stationAnalysis`
- 新增一层 source/facade 胶水

### 3. View

两个 workbench view 收敛为：

1. 获取 store
2. 创建 presenter
3. 将 presenter 输出传给子组件
4. 基于 `session.workbenchMode` 切换 overview / station / transit 布局

view 不再直接解释业务状态，不再从 store 拉取大段碎字段做二次组装。

## 主状态对象设计

### 1. `session`

`session` 表达当前工作台正在看什么。

```ts
interface ProductionSessionState {
  workbenchMode: 'overview' | 'station' | 'transit'
  entityType: 'overview' | 'station' | 'transit'
  mode: 'planning' | 'live'
  visualMode: 'planning' | 'live'
  activeStationId: string | null
  activeTransitSectorId: string | null
  activeBinding: string | null
  canToggle: boolean
}
```

设计约束：

- 不带任何面板数据
- 不带实体详情
- 只提供“当前工作上下文”

### 2. `context`

`context` 表达当前实体的附加上下文。

```ts
interface ProductionContextState {
  stationCode: string
  sectorId: string | null
  sectorName: string
  sectorNameId?: string
  position?: { x: number; y: number; z: number }
  sectorResources: string[]
  sectorSunlight: number
  hasBinding: boolean
  hasArchive: boolean
  archiveModules: SavedModule[]
  buildingModules: SavedModule[]
}
```

设计约束：

- 只表达环境与附属信息
- 不承载主计算结果
- station / transit 共用同一结构

### 3. `stationState`

`stationState` 是当前实体唯一的主状态对象。

```ts
interface ProductionStationState {
  entityType: 'station' | 'transit'
  id: string
  name: string
  plannedModules: SavedModule[]
  resolvedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  warePriorityLevels: Record<string, number>
  stationAnalysis: StationAnalysis
  settings: StationSettings
}
```

设计约束：

- 这是 presenter 读取主展示状态的唯一入口
- station / transit 共用一套 shape
- 任何 UI 面板需要的主结果都应优先从这里读取

## Transit 语义映射

### 1. 不再保留 `transitState`

上一轮重构已经移除了 transit hub 的独立主对象链路，当前 transit 没有必须独立存在的主状态字段。

因此：

- `transitState` 不再是主领域对象
- 若仍有 transit 展示特有派生值，只允许由 presenter 临时拼装

### 2. transit 进入 `stationState`

transit 下 `stationState` 固定按以下语义映射：

```ts
{
  entityType: 'transit',
  plannedModules: [],
  resolvedModules: autoInfrastructureModules,
  autoIndustryModules: [],
  autoHabitationModules: [],
  autoInfrastructureModules: sectorAutoInfrastructureModules,
  productionFlows: sectorFinalProductionFlows,
  warePriorityLevels: {},
  stationAnalysis: emptyStationAnalysis,
}
```

这样的好处：

- presenter 不必维护另一套主状态入口
- transit/station 可以共享 planning / wareflow / dashboard presenter
- view 不需要识别更多中间对象

## Contract 重构策略

### 1. 目标

不再保留 `ProductionWorkbenchStoreContract` 作为兼容适配层主入口。

若类型层仍需要一个统一接口，它也必须直接表达 `session/context/stationState/actions`，且不得作为旧 getter 的包装外壳继续存在。

### 2. 迁移方式

本次采用一次性收口路线，不保留兼容适配层：

- presenter 直接改读 `session/context/stationState/actions`
- 旧的 `getToolbarXxx/getDashboardXxx/getWareflowXxx` 直接删除或停止导出
- 不允许新增 `workbench` 过渡层来承接旧调用

若因同一提交内编辑顺序必须短暂保留旧符号，必须同时：

- 用 `@deprecated` 标记旧符号
- 为旧符号调用建立静态告警
- 在本次 change 完成前删除这些旧符号

### 3. 行为入口

`actions` 统一收敛以下行为：

- 选择工作对象
- 更新名称 / 模块 / 设置
- 切换 live/planning
- 导入、创建、删除、复制
- ware lock / priority 变更

动作命名继续按功能，不按面板分组。

## Presenter 迁移设计

### 1. Tabbar Presenter

只负责：

- tabs 结构
- 当前激活 tab
- sector 展开状态
- 站点创建/删除/切换行为

不负责解释 station details。

### 2. Toolbar Presenter

只从：

- `session`
- `context`
- `stationState`

映射 toolbar 所需 props。

toolbar 的 station/transit 差异由 presenter 分支处理，而不是由 store 暴露不同 getter。

### 3. Planning Presenter

只从 `stationState` 取：

- `plannedModules`
- `autoIndustryModules`
- `autoHabitationModules`
- `autoInfrastructureModules`

只从 `context` 取：

- `archiveModules`
- `buildingModules`

### 4. Wareflow Presenter

只从 `stationState` 取：

- `productionFlows`
- `warePriorityLevels`
- `settings`

只从 `session` 判断当前是否为 transit/station。

gap 操作继续走统一 action，不单独新增 transit 专用接口。

### 5. Dashboard Presenter

只从 `stationState` 取：

- `resolvedModules`
- `stationAnalysis`
- `settings`

只从 `context` 取 live archive/building 模块作为展示分支。

## View 收敛设计

### 1. BlueprintProductionWorkbenchView

最终只保留：

- 加载 active empire
- 创建五个 presenter
- 将 presenter props/emits 传给子组件

### 2. LiveProductionWorkbenchView

最终只保留：

- 加载 active binding
- 创建五个 presenter
- 根据 `session.workbenchMode` 选择 overview / transit / station 区块
- 将 presenter props/emits 传给子组件

### 3. 明确删除的职责

view 中必须清掉：

- 直接从 store 取大量碎字段再 computed
- 对 toolbar / dashboard / planning 数据做局部组装
- transit 特有的第二套主状态对象解释

## 风险与控制

### 1. 迁移中残留旧入口

一次性收口时，最容易发生的是局部文件还在调用旧 getter 或旧 contract。

控制方式：

- 旧入口全部标记 `@deprecated`
- 对旧入口调用建立静态告警门禁
- 本次 change 合并前必须删净旧入口

### 2. transit 映射空值约定

transit 被并入 `stationState` 后，部分字段需要空值约定。

控制方式：

- `plannedModules = []`
- `warePriorityLevels = {}`
- `stationAnalysis = 空结构`

这样 presenter 与 view 不必处理 `null` 主状态。

### 3. 双 store 语义对齐

blueprint 与 live store 需要共享同一 contract，但两者数据来源不同。

控制方式：

- 只统一对外对象 shape
- 不强迫内部实现路径一致

## 实施顺序

1. 定义 `session/context/stationState/actions` 类型边界
2. 在两个 production store 中补齐三类主对象与动作出口
3. 修改五个 presenter 直接改读主对象
4. 清理两个 workbench view 中的碎状态读取
5. 删除多余 getter / 类型残留
6. 为残留旧入口建立并验证静态告警
