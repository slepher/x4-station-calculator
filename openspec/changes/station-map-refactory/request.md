# useStationStore 重构讨论结论（request）

## 1. 背景与现状

当前架构采用：
- `useStationStore` 维护当前活跃分站的本地状态（如 `plannedModules`、`settings` 等）
- `useEmpireStore` 维护帝国级数据与所有分站缓存

现状中的主要问题：
1. 双源状态问题：`useStationStore` 与 `useEmpireStore.activeStation` 通过双向 watch 同步，存在一致性风险。
2. 计算重复：单站计算与帝国缓存刷新存在重复路径（AutoFill、WareFlow 等），维护成本高。
3. 缓存时序复杂：`stationFlowCache` 依赖切站/更新时间触发，容易出现“缓存未及时刷新”边界问题。
4. UI 绑定耦合：部分组件（如规划区）直接通过 `v-model="store.plannedModules"` 修改状态，要求新方案兼容可写代理行为。

## 2. 重构目标

本次重构目标：
1. 新建 `StationStateMap`（普通 class），作为每个分站运行态与计算结果的统一承载。
2. `useStationStore` 不再持有当前分站的“副本状态”，改为通过 `currentStationId` 代理访问。
3. 重点保障以下数据按分站稳定保存与切换：
   - `plannedModules`
   - `autoIndustryModules`
   - 资源产出/消耗计算结果（如 groupedFlows、netProduction 等）
4. 让单站视图与帝国聚合使用同一套分站计算结果，避免重复计算实现漂移。

## 3. 方案概述

### 3.1 单一真源

引入分层职责：
- `StationStateMap`：按 `stationId` 存储可编辑状态 + 派生状态 + 计算结果。
- `useStationStore`：仅做当前分站代理与对外 API 适配。
- `useEmpireStore`：保留帝国/分站元数据管理与持久化，不再维护独立的站点计算缓存逻辑。

### 3.2 StationState 结构

建议每个 station 维护以下结构：
- 可编辑字段：
  - `plannedModules`
  - `lockedWares`
  - `warePriority`
  - `settings`
  - `settings.showEmpireGaps`
- 派生字段：
  - `autoIndustryModules`
  - `autoSupplyModules`
  - `allIndustryModules`
  - `allModules`
- 计算字段：
  - `groupedFlows`
  - `workforceBreakdown`
  - `actualWorkforce`
  - `profitBreakdown`
  - `netProduction`
  - `stationAnalysis`
- 元信息：
  - `revision`
  - `lastComputedAt`
  - `computeFingerprint`

### 3.3 StationStateMap 类 API（建议）

- `ensure(stationId, seed?)`
- `get(stationId)`
- `patch(stationId, partial)`
- `mutate(stationId, updater)`
- `recompute(stationId, deps)`
- `remove(stationId)`
- `clone(fromId, toId)`
- `fromPersisted(stationId, plan)`
- `toPersisted(stationId)`

## 4. useStationStore 代理化设计

`useStationStore` 保留现有对 UI 的接口名称，内部改为基于 `currentStationId` 代理：

1. 可写代理（computed get/set）：
   - `plannedModules`
   - `settings`
   - `lockedWares`
   - `warePriority`

2. 只读代理（computed）：
   - `autoIndustryModules`
   - `autoSupplyModules`
   - `allIndustryModules`
   - `allModules`
   - `groupedFlows`
   - `netProduction`
   - `stationAnalysis`

3. 现有 actions（`addModule/removeModule/updateModuleCount/...`）统一改为调用 `StationStateMap.mutate()`。

目标是保证 UI（尤其 `v-model="store.plannedModules"`）不需要大改即可兼容。

## 5. useEmpireStore 调整

1. 弱化或移除 `stationFlowCache` 作为独立真源。
2. 帝国聚合（`empireGroupedFlows`）直接读取 `StationStateMap` 中每站 `groupedFlows` 结果。
3. 分站生命周期操作与 `StationStateMap` 同步：
   - `createStation` -> `ensure`
   - `deleteStation` -> `remove`
   - `duplicateStation` -> `clone`
4. 持久化策略建议：
   - 默认只持久化可编辑字段（modules/settings/priority/locks，包含 `settings.showEmpireGaps`）
   - 派生和计算字段运行时重算（避免版本漂移）

补充迁移规则：
- `resourceBufferHours` 兼容逻辑使用：`s.resourceBufferHours !== undefined ? s.resourceBufferHours : 2`

## 6. 迁移实施顺序

1. 新增 `StationStateMap` 及 `StationState` 类型定义。
2. 接入 `useStationStore`（保持对外 API 名称不变）。
3. 将 `useEmpireStore` 的帝国聚合改为读取 `StationStateMap`。
4. 清理重复计算路径与旧缓存逻辑。
5. 回归测试：
   - 分站切换隔离
   - 规划区增删改拖拽
   - 资源流视图一致性
   - 帝国聚合一致性
   - 存档/读档/复制分站

## 7. 约束与风险

1. 响应式风险：数组原地修改与 `v-model` 需要确保仍可触发正确更新。
2. 深拷贝风险：复制分站时必须彻底断开引用，避免站点互相污染。
3. 计算依赖风险：游戏数据版本变化时，旧缓存不可盲信，应优先重算。
4. 兼容性风险：外部组件和测试广泛依赖现有 `useStationStore` 字段名，重构需保持接口稳定。

## 8. 验收标准

满足以下条件视为重构成功：
1. 每个分站的 `plannedModules`/`autoIndustryModules`/资源流计算互相独立。
2. 切换 `currentStationId` 时，UI 与计算结果瞬时切换且无串站。
3. 单站和帝国总览读取的分站数据一致，不出现重复算法差异。
4. 保存/读取后状态可恢复，且无明显性能退化。
