# Station Production Flow Map Specification

## Purpose

定义 ProductionFlow 计算的独立抽象层，从 StationStateMap 拆分 flow 相关逻辑，支持单站、sector、empire 级别聚合查询。

## MODIFIED Requirements

### Requirement: 分站运行态单一真源 (Station Runtime Single Source of Truth)

系统 SHALL 为每个 `stationId` 维护独立 `StationState`，并通过统一映射容器读写以下核心数据：
- `plannedModules`
- `lockedWares`
- `warePriority`
- `settings`
- `settings.showEmpireGaps`
- `autoIndustryModules`
- `actualWorkforce`
- `currentEfficiency`
- `warePriorityLevels`
- `stationAnalysis`

**变更说明**：移除 `productionFlows` / `groupedFlows` 字段，由 `StationProductionFlowMap` 管理。

#### Scenario: 查询分站运行态
- **前提** 分站运行态已存在
- **当** 系统调用 `get(stationId)`
- **那么** 系统 SHALL 返回该分站运行态对象
- **并且** 返回对象 SHALL 不包含 `productionFlows` 字段
- **并且** flow 数据 SHALL 通过 `StationProductionFlowMap` 获取

### Requirement: 分站派生与计算一致性 (Derived and Computed Consistency)

系统 SHALL 在同一分站上下文内，以同一输入集生成派生模块和计算结果，避免同一时刻出现多套不一致结果。

#### Scenario: 规划模块变更触发重算
- **前提** 某分站已有运行态
- **当** 用户修改该分站 `plannedModules`
- **那么** 系统 SHALL 基于该分站输入重新计算 `autoIndustryModules`
- **并且** 系统 SHALL 同步触发 `StationProductionFlowMap.compute(stationId)`
- **并且** `stationAnalysis` SHALL 同步更新

#### Scenario: 设置变更触发重算
- **前提** 某分站已有运行态
- **当** 用户修改 `settings`（如工人运算、缓冲时间）
- **那么** 系统 SHALL 重新计算该分站派生模块
- **并且** 系统 SHALL 同步触发 `StationProductionFlowMap.compute(stationId)`
- **并且** 旧计算结果 SHALL 被新结果替换

## ADDED Requirements

### Requirement: ProductionFlow 独立计算层 (ProductionFlow Independent Compute Layer)

系统 SHALL 提供 `StationProductionFlowMap` 作为 ProductionFlow 计算的单一真源，独立于 `StationStateMap`。

#### Scenario: 单站 ProductionFlow 计算
- **前提** 某分站已有 `StationPlan` 数据
- **当** 系统调用 `StationProductionFlowMap.compute(stationId, deps)`
- **那么** 系统 SHALL 读取该分站 `plannedModules/settings/lockedWares/warePriority`
- **并且** 系统 SHALL 调用 `calculateProductionFlows` 独立计算
- **并且** 计算结果 SHALL 存入 `Map<stationId, WareProductionFlow[]>`

#### Scenario: 获取单站 ProductionFlow
- **前提** 单站 ProductionFlow 已计算
- **当** 系统调用 `getStationFlows(stationId)`
- **那么** 系统 SHALL 返回该分站 `WareProductionFlow[]`
- **并且** 返回数组 SHALL 按 `orderIndex` → `tier` → `netRate` 排序

#### Scenario: 获取单站 GroupedFlows
- **前提** 单站 ProductionFlow 已计算
- **当** 系统调用 `getGrouped(stationId)`
- **那么** 系统 SHALL 返回 `GroupedFlows` 对象
- **并且** `rateGroups` SHALL 包含 positive/operations/supply/resources 分组
- **并且** `volumeGroups` SHALL 包含 solid/liquid/container 分组

### Requirement: Empire/Sector 聚合查询 (Empire/Sector Aggregation Query)

系统 SHALL 提供预计算的 empire/sector 级别聚合 flow 数据，支持跨站生产分析。

#### Scenario: Empire 载入时预计算所有 flows
- **前提** Empire 数据载入完成
- **当** 系统调用 `StationProductionFlowMap.computeAll(empire, deps)`
- **那么** 系统 SHALL 遍历 empire.stations 所有分站
- **并且** 每个 stationId SHALL 执行 `compute(stationId, deps)`
- **并且** 系统 SHALL 预计算 `empireFlowsCache` 合并所有分站 flows
- **并且** 系统 SHALL 预计算 `sectorFlowsCache` 按 sectorId 分组

#### Scenario: 获取 Empire 级别 flows
- **前提** Empire flows 已预计算
- **当** 系统调用 `getEmpireFlows()`
- **那么** 系统 SHALL 返回所有 station 合并的 `WareProductionFlow[]`
- **并且** 相同 wareId 的 production/consumption SHALL 累加
- **并且** contributions SHALL 标记来源 stationId

#### Scenario: 获取 Sector 级别 flows
- **前提** Sector flows 已预计算
- **当** 系统调用 `getSectorFlows(sectorId)`
- **那么** 系统 SHALL 返回该 sector 所有 station 合并的 `WareProductionFlow[]`
- **并且** 相同 wareId 的 production/consumption SHALL 累加

### Requirement: ProductionFlow 生命周期同步 (ProductionFlow Lifecycle Sync)

系统 SHALL 确保 `StationProductionFlowMap` 与 `StationStateMap` 生命周期同步。

#### Scenario: 删除分站时同步清理
- **前提** 分站被用户删除
- **当** 系统执行 `StationStateMap.remove(stationId)`
- **那么** 系统 SHALL 同步执行 `StationProductionFlowMap.remove(stationId)`
- **并且** 聚合缓存 SHALL 重新计算

#### Scenario: 分站数据变更后更新聚合
- **前提** 单站 ProductionFlow 已重新计算
- **当** `compute(stationId)` 完成
- **那么** 系统 SHALL 更新该 stationId 对应缓存
- **并且** empire/sector 聚合缓存 SHALL 重新计算