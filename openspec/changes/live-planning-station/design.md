# live-planning-station 设计文档

## 架构概览

本 change 不新增新的 dashboard 组件，而是继续复用现有 `StationDashboard`，通过 `store -> presenter -> vue` 三层链路为 planning + archive 场景提供新的 dashboard 输入语义。

```
archiveStation + planning station state (store)
  ├─ archive built modules
  ├─ archive current total modules
  ├─ final planned modules
  └─ effective target modules
           ↓
useProductionDashboardPresenter
  ├─ builtScopeModules
  ├─ buildingScopeModules
  ├─ allScopeModules
  ├─ displayModules     -> materials / time / volume
  └─ workerModules      -> workers
           ↓
LiveProductionWorkbenchView
           ↓
StationDashboard
  ├─ materials          -> displayModules
  ├─ time               -> displayModules
  ├─ volume             -> displayModules
  └─ workers            -> workerModules
```

## 核心决策

1. 仅在 `visualMode === 'planning' && archiveStation != null` 时启用新口径。
2. 不创建新的 dashboard 组件，继续复用 `StationDashboard`。
3. `moduleScope` 按钮继续复用现有三态控制，不新增 planning 专用切换入口。
4. planning 下仅当仍存在待建设模组时显示 `moduleScope` 按钮，并默认进入 `building`。
5. planning 下若已不存在待建设模组，则隐藏 `moduleScope` 按钮并固定保持 `built`。
6. planning dashboard 的 `building` 不再等于 archive 原始 `buildingModules`，而是等于 `effectiveTarget - built`。
7. `buildingInProgress` 保留展示意义，但不参与 planning scope 的数量扣减。
8. `materials / time / volume` 跟随 `moduleScope` 切换。
9. `workers` 不跟随 `moduleScope`，固定看 `allScopeModules`。
10. `workers` 保持 planning 下现有手动 / 自动 workforce 交互，不读取 archive workforce 值。

## 数据语义

### 1. 基础集合

在 planning + archive 下，需要先得到四个基础集合：

```text
builtModules = archive.modules

finalPlannedModules =
  plannedModules
  + autoIndustryModules
  + autoHabitationModules
  + autoInfrastructureModules

currentTotalModules =
  archive.modules
  + archive.building.modules

effectiveTargetModules =
  max(finalPlannedModules, currentTotalModules)
```

其中 `max` 为按 `moduleId` 逐项取大。

### 2. dashboard scope 组装

基于上述集合，planning dashboard 的三态定义为：

```text
builtScopeModules = builtModules
buildingScopeModules = effectiveTargetModules - builtModules
allScopeModules = effectiveTargetModules
```

这里 `buildingScopeModules = all - built` 的设计比“archive building + 新增部分”更稳，因为它直接把 planning 下的在建语义定义为“除已建之外，达到规划目标前仍待建设的全部模块”。

这个定义自动满足两件事：

1. 当前 archive 中已在建的模块不会被削减
2. 规划新增只会在其基础上继续增加

同时它也为 `moduleScope` 的显示与默认值提供了统一判定：

1. 当 `buildingScopeModules` 非空时，说明仍有待建设内容，应显示按钮并默认进入 `building`
2. 当 `buildingScopeModules` 为空时，说明规划目标已不高于 built，总体不再需要建设，应隐藏按钮并固定 `built`

### 3. buildingInProgress 的边界

live 语义下，dashboard building scope 采用“从统计输入里扣除 in-progress，再单独展示 in-progress 卡片”的规则。  
planning 下主统计也需要保持这套规则。

原因：

- planning 的 `building` 基础集合虽然仍然定义为 `effectiveTarget - built`
- 但 dashboard 主统计若不扣减 `buildingInProgress`，会与单独的 in-progress 展示发生重复计入
- 这个重复会同时污染模块数量、建材、工期与体积

因此 planning 下：

- `buildingInProgress` 继续透传给 dashboard
- 继续用于单独展示
- `building` scope 的 `displayModules` 需要像 live 一样先扣除 `buildingInProgress`
- `workerModules` 仍不受它影响，继续固定使用 `allScopeModules`
- `buildingCargo` 与 `buildingReservation` 继续透传给 dashboard
- 材料缺口继续在 dashboard 内按 live 既有规则，用当前 `building` scope 需求扣减这两类材料

## 视图口径

### 1. materials / time / volume

这三个 tab 在 planning + archive 下继续跟随 `moduleScope`：

- `built` -> `builtScopeModules`
- `building` -> `buildingScopeModules`
- `all` -> `allScopeModules`

因此它们表达的是“在当前选中 scope 下的建材 / 工期 / 体积成本”。

其中建筑仓库材料、在途材料以及材料缺口的展示规则继续与 live 模式保持一致：

- 建筑仓库材料与在途材料继续作为 dashboard summary 区块展示
- `materialGap` 继续只在 `building` scope 下计算
- `materialGap = 已排除 in-progress 的当前 building scope 建材需求 - buildingCargo - buildingReservation`

### 2. workers

workers tab 在 planning + archive 下是特例：

- 不跟随 `moduleScope`
- 固定使用 `allScopeModules`
- 不读取 archive 的 `actualWorkforce`
- 不读取 archive 的 `currentEfficiency`

它表达的是“规划完成后的工人需求 / 容量 / 效率模拟”，而不是 built 或 building 的切片值。

同时 workers tab 继续保留 planning 模式下现有交互：

- `workforceAuto`
- 手动工人数输入
- 基于当前输入实时更新效率

## 分层落点

### Store

store 负责提供 planning dashboard 需要的领域输入，不直接产出 UI 命名的三态结果。

建议至少具备以下语义结果：

- `archiveBuiltModules`
- `archiveCurrentTotalModules`
- `finalPlannedModules`
- `effectiveTargetModules`

这些结果可以复用现有 planning state / archive state 的派生链路实现，不强制要求某一种特定实现路径。

### Presenter

`useProductionDashboardPresenter` 负责把 store 提供的基础集合组装成 dashboard 可直接消费的输入。

建议显式区分两类输入：

- `displayModules`
  - 给 materials / time / volume
  - 跟随 `moduleScope`
- `workerModules`
  - 给 workers
  - planning + archive 下固定为 `allScopeModules`

这样可以避免组件内部再根据模式猜测口径。

### Vue

`LiveProductionWorkbenchView` 继续只通过 presenter 向 `StationDashboard` 传递数据。

`StationDashboard` 本体不直接访问 store，也不在组件内部重算 planning dashboard 三态语义。

## 与 live-planning-flow 的关系

`live-planning-flow` 与本 change 共享一部分 planning 目标语义，但关注点不同：

- `live-planning-flow`
  - 关注中间 `wareflow / volume` 计算链
- `live-planning-station`
  - 关注右侧 `StationDashboard` 的 built/building/all 统计口径

设计上允许二者共用“final planned modules”或“effective target modules”的底层能力，但文档语义必须保持分离，避免把 flow 的 `effectiveModules` 直接当成 dashboard 的唯一输出。

## 非目标

本 change 不重新定义：

- `live-planning-modules` 左侧模块面板
- `overview` / `transit` 的 dashboard 行为
- `live` 模式下既有 dashboard scope 语义
- testing 流程
