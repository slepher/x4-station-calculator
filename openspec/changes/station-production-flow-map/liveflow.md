# Live Flow 重构优先方案

## Purpose

本文件定义 `useLiveProductionStore` 的 live flow 改造路线。

本次不直接在现状上硬加双 `FlowMap`。  
必须先重构当前聚合链，再添加 planning/live 双数据源切换。

原因：

- 当前聚合责任分散
- `compute` 触发点重复
- save-binding 路径存在隐式重复计算
- transit hub 已建立在多层派生之上

若直接叠加 live 逻辑，后续只会更乱。

---

## Target

最终要达到：

1. station 页
- `ModulePlanner`
- `StationWareFlowsDashboard`
- `StationDashboard`
都支持 `planning | live` 切换

2. transit hub 页
- `LiveTransitToolbar` 增加 mode toggle
- `TransitHubCenterDashboard`
- `TransitHubBuildPanel`
- `TransitHubMaterialsPanel`
按特殊规则切换

3. 双 `FlowMap`
- `planningFlowMap`
- `liveFlowMap`

但这些都必须建立在“聚合职责先收口”之后。

---

## Core Principle

## P1. 先重构，后添加

执行顺序必须是：

1. 重构当前聚合链
2. 明确计算责任
3. 明确调用时机
4. 再加双 `FlowMap`
5. 再接 station / transit UI 切换

禁止：

- 直接在现有 `empireFlowFacade + liveProductionFlows + store scattered compute` 上叠加 live 分支

## P2. `FlowMap` 负责算，store 负责调

责任必须固定：

- `StationProductionFlowMap`
  - 负责单站 compute
  - 负责 empire/sector aggregation cache
- `useLiveProductionStore`
  - 负责何时调
  - 负责算哪些站
  - 负责选 planning/live 数据源
  - 负责 transit 特殊规则
- source/helper
  - 只负责组 station set
  - 不负责触发 compute
- facade/composable
  - 只负责把已算好的数据装配给 UI

## P3. 不新增新的 station 主语义

本次仍保持：

- `activeStation` 是唯一主站点

不新增：

- `currentStation`
- `sessionStation`
- `liveStationRuntime`

mode 切换只切派生数据源，不切站点身份。

---

## Current Problem

当前聚合链至少有 4 层：

1. `StationProductionFlowMap`
- 单站 cache
- empire/sector aggregation cache

2. store 侧
- blueprint/live 各自分散触发 `compute`
- live 有 `syncAllBindingStationsToStateMap`

3. `buildSaveBindingProductionFlows`
- 组 derived stations
- 又再次触发 `stationProductionFlowMap.compute`
- 再做 `analyzeEmpireWareFlow`

4. `empireFlowFacade`
- empire grouped
- sector grouped
- sector internal
- sector link calc
- transit input

问题不在算法本身。  
问题在职责重叠。

最大问题：

- 同一批站可能被重复 `compute`
- 聚合入口不唯一
- 后续双 `FlowMap` 无法自然落位

---

## Refactor Goal

重构完成后，聚合链必须变成：

```text
source station set
  -> FlowMap.compute / FlowMap.updateAggregation
  -> facade read aggregated result
  -> UI composable / component derive
```

必须去掉：

```text
source helper
  -> compute
  -> analyze
store
  -> compute
facade
  -> analyze
```

也就是：

- source helper 不再触发计算
- facade 不再负责重复聚合
- store 不再把同一件 compute 做两遍

---

## Phase Plan

## Phase R1. 梳理并切断重复 compute

目标：

- 先把“谁在调用 compute”收口

### R1.1 要保留的 compute 入口

只允许两类入口：

1. 单站变更后
- store 直接调 `flowMap.compute(stationId, ...)`

2. 批量同步后
- store 直接调 `flowMap.updateAggregation(stations)`
- 或 `flowMap.computeAll(...)`

### R1.2 要移除的隐式 compute

必须处理 `buildSaveBindingProductionFlows(...)`。

当前它做了两件事：

- 构造 derived stations
- 对 derived stations 再次 `stationProductionFlowMap.compute`

这必须拆开。

### R1.3 拆分结果

`liveProductionFlows.ts` 应拆成两类职责：

1. source 构造
- `buildSaveBindingStations(...)`
- 只返回 station list / transit hub list

2. aggregate 读取
- `buildSaveBindingAggregateFromFlowMap(...)`
- 只从 `flowMap` 读取已算好的 flows 再聚合

禁止：

- source 构造函数内部自行触发 `compute`

### R1 验收

- save-binding 路径只剩 store 触发 compute
- `liveProductionFlows.ts` 不再隐式重算 station

---

## Phase R2. 固定聚合责任边界

目标：

- 让每层只做一件事

### R2.1 `StationProductionFlowMap`

只保留：

- `compute(...)`
- `computeAll(...)`
- `updateAggregation(...)`
- `getCache(...)`
- `getEmpireFlows()`
- `getSectorFlows()`

不加：

- mode 判断
- archive/binding 读取
- transit 特殊规则

### R2.2 `useLiveProductionStore`

负责：

- 组 planning station set
- 组 live station set
- 决定何时调 `planningFlowMap/liveFlowMap`
- 决定 station/transit 读哪套 source

不必把每个 `compute` 再包一层函数。  
允许 store 直接调用：

```ts
planningFlowMap.compute(...)
planningFlowMap.updateAggregation(...)

liveFlowMap.compute(...)
liveFlowMap.updateAggregation(...)
```

### R2.3 `empireFlowFacade`

职责收口为：

- 读取已存在的聚合结果
- 组装：
  - `empireGroupedFlows`
  - `sectorInternalDataMap`
  - `sectorLinkCalcMap`

不再承担：

- 触发 `compute`
- 对同一 source 再做第二轮隐式聚合

### R2 验收

- `FlowMap` 负责算
- store 负责调
- facade 负责读和装

---

## Phase R3. 统一 source station set 概念

目标：

- 后续双 `FlowMap` 前，先统一输入模型

必须明确三种 station set：

1. `planningStationSet`
- 来自 binding/planned stations

2. `liveStationSet`
- 来自 archive 覆盖到的真实站

3. `sectorStationSet`
- 某个 sector 下的 source station 子集

### R3.1 planningStationSet

来源：

- `derivedBindingStations`
- 或 blueprint/live 当前 planning source stations

### R3.2 liveStationSet

来源：

- 当前 binding scope 覆盖到
- 且 archive 中存在 `station` record 的站

不包含：

- 无 archive 的纯 binding 虚拟站

### R3.3 输出结构

建议统一成：

```ts
interface FlowSourceStation {
  id: string
  sourceKey: string
  sectorId: string | null
  station: StationPlan
}
```

说明：

- `id`
  - workbench station identity
- `sourceKey`
  - 实际喂给 flowMap 的 key
  - planning = binding plan id
  - live = archive code
- `station`
  - 当前 source 下的 station-like input

### R3 验收

- planning/live/transit 聚合都先从 station set 出发
- 不再到处临时拼一份 stations 数组

---

## Phase A1. 引入双 FlowMap

在 R1-R3 完成后，才进入添加阶段。

## A1.1 实例

```ts
planningFlowMap = stationProductionFlowMap
liveFlowMap = new StationProductionFlowMap()
```

## A1.2 key 规则

- `planningFlowMap`
  - key = `binding plan id`

- `liveFlowMap`
  - key = `archive code`

无 archive 的站：

- 不进 `liveFlowMap`

## A1.3 live 计算规则

live station 输入：

- modules = `archiveStation.modules`
- settings = `binding.settings ?? DEFAULT_STATION_SETTINGS`
- `skipAutoFill = true`
- `skipPostAutoModules = true`
- `lockedWares = []`
- `warePriority = {}`

结果：

- `autoIndustryModules = []`
- `autoHabitationModules = []`
- `autoInfrastructureModules = []`

---

## Phase A2. station 页接双 source

## A2.1 planning

- planner = binding modules
- wareflow = planningFlowMap
- dashboard = planning analysis

## A2.2 live

- planner = `archiveStation.modules`
- wareflow = liveFlowMap
- dashboard = live analysis

## A2.3 station 页约束

- 无 `archiveStation` 不允许切到 live
- live 模式只读
- 本次不纳入 `archiveStation.building.modules`

---

## Phase A3. transit hub 接双 source

前提：

- station 页切换稳定后再做

## A3.1 transit context

store 必须提供：

```ts
interface TransitHubModeContext {
  hasArchiveTradeStation: boolean
  tradeStationCode: string
  archiveModules: SavedModule[]
  buildingModules: SavedModule[]
  modeBehavior: 'full-switch' | 'wareflow-only'
}
```

## A3.2 archive 判定

规则：

1. 找当前 `activeTransitSectorId`
2. 找 `group.tradeStation.saveStationCode`
3. 在 `playerStationRecords` 中找同 code 的 `station` record
4. 找到则 `hasArchiveTradeStation = true`

## A3.3 transit special rule

### 有 archive trade station

- `TransitHubCenterDashboard` 切
- `TransitHubBuildPanel` 切
- `TransitHubMaterialsPanel` 切

### 无 archive trade station

- 仍允许切到 live
- 只切 `TransitHubCenterDashboard`
- `TransitHubBuildPanel` 保持 planning
- `TransitHubMaterialsPanel` 保持 planning
- toggle 颜色保持 planning 色

---

## Phase A4. toolbar 与 view 接线

## A4.1 `LiveTransitToolbar.vue`

新增：

- `mode`
- `canToggle`
- `toggleVisualState`
- `hasArchiveTradeStation`
- `toggleMode`

## A4.2 `LiveProductionWorkbenchView.vue`

作为 mode 分发层：

- 选择 planning/live transit input
- 选择 planning/live storage module plans
- 应用 transit 特殊规则

---

## Detailed Task Plan

## Task Group R

### R-1
- [x] 从 `buildSaveBindingProductionFlows(...)` 移除隐式 `compute`
  - 已拆分为 `readSaveBindingAggregatedFlows`（只读取）和 `buildTransitHubsFromBinding`

### R-2
- [x] 拆出 source station builder
- [x] 拆出 aggregate reader
  - `deriveBindingStationsFromRecords` (source builder)
  - `readSaveBindingAggregatedFlows` (aggregate reader)

### R-3
- [x] 收口 `useLiveProductionStore` 中 planning 聚合触发点
- [x] 确保同一 source 的批量同步只算一次
  - `syncAllBindingStationsToStateMap` 批量同步

### R-4
- [x] 收口 `empireFlowFacade` 为只读聚合装配层
  - facade 只从 `flowMap.getCache` 读取，不触发 compute

### R-5
- [x] 定义 `planningStationSet/liveStationSet`
  - 通过 `derivedBindingStations` 和 `playerStationRecords` 区分

## Task Group A

### A-1
- [x] `StationProductionFlowMap` 支持第二实例

### A-2
- [x] 新增 `liveFlowMap`
  - 已在 `useLiveProductionStore` 中创建

### A-3
- [x] station 页接 live wareflow
  - `activeStationState` 根据 mode 选择 flowMap

### A-4
- [x] station 页接 live dashboard
  - `StationDashboard` 使用 `activeStationState.resolvedModules`

### A-5
- [x] transit context 判定
  - 已实现 `transitHubContext` computed，检测 `hasArchiveTradeStation`

### A-6
- [x] transit hub 双 source 输入
  - 已传递 mode props 到 LiveTransitToolbar

### A-7
- [x] `LiveTransitToolbar` 增加 toggle
  - 已添加 mode/canToggle/hasArchiveTradeStation props 和 toggle UI

### A-8
- [x] transit special rule 接线
  - 已实现 `toggleVisualState`：无 archive 时颜色保持 planning
  - 已实现 `activeTransitHubInput` / `activeTransitStorageModulePlans`
  - CenterDashboard 根据 mode 切换，BuildPanel/MaterialsPanel 根据 mode + hasArchive 切换

### A-9
- [x] `npm run build`
  - 构建已通过

### Step 5 (新增)
- [x] 补 `syncLiveFlowMapForStation(stationId)`
- [x] settings setter / updateStationSettingsDirect 后重算 live cache

### Step 6 (新增)
- [x] 补 transit hub e2e
  - transit hub toggle 按钮 UI 存在且文本变化 ✅
  - transit hub 无 archive 时按钮文本变化但样式保持 planning 色 ✅
  - transit hub 有 archive 时切换后建筑模块面板存在 ✅
  - transit hub 无 archive 时切换后建筑模块面板内容不变 ✅
  - 所有 6 条测试通过

---

## Validation

最终必须满足：

1. save-binding 路径无重复 compute
2. `FlowMap` 只负责算，不负责业务调度
3. store 直接调 `flowMap.compute/updateAggregation`，不额外过度包装
4. facade 不再隐式触发第二轮 station compute
5. 双 `FlowMap` 能独立工作
6. station 页三块都能切 source
7. transit hub 按 special rule 切 source
8. 无 archive trade station 时 toggle 颜色保持 planning
9. 本次不纳入 `archiveStation.building.modules`
10. `npm run build` 通过

---

## Out of Scope

本次不做：

- 将 `archiveStation.building.modules` 纳入 live flow
- 改造 Vue 为“已建成 / 在建”双展示
- 新增第二套 station 主语义
- 将所有 compute 都包成 store 小函数
