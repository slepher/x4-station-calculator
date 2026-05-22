# Station Derived Map Specification

## Purpose

定义 `StationDerivedMap` 作为 station 级派生快照缓存抽象，覆盖现有 production derived cache，并在保持 blueprint/planning 与 archive/live 双实例结构的前提下纳入 station semantic derived 数据。

## ADDED Requirements

### Requirement: 分站运行态单一真源 (Station Runtime Single Source of Truth)

系统 SHALL 为每个 `stationId` 维护独立分站运行态，并通过统一映射容器读取 station 级派生快照。

**变更说明**：`productionFlows` 等派生数据继续从独立 map 获取，但该 map 的抽象名从 `StationProductionFlowMap` 调整为 `StationDerivedMap`，以允许后续承载 semantic derived 数据。

#### Scenario: 查询分站运行态
- **前提** 分站运行态已存在
- **当** 系统调用 `get(stationId)`
- **那么** 系统 SHALL 返回该分站运行态对象
- **并且** 返回对象 SHALL 不直接内嵌 `productionFlows`
- **并且** station 级派生数据 SHALL 通过 `StationDerivedMap` 获取

### Requirement: 分站派生与计算一致性 (Derived and Computed Consistency)

系统 SHALL 在同一分站上下文内，以同一输入集生成 station derived 结果，避免同一时刻出现多套不一致结果。

#### Scenario: 规划模块变更触发重算
- **前提** 某分站已有运行态
- **当** 用户修改该分站 `plannedModules`
- **那么** 系统 SHALL 基于该分站输入重新计算 production derived 数据
- **并且** 系统 SHALL 同步触发 `StationDerivedMap.compute(stationId, ...)`
- **并且** 后续已纳入该 map 的 semantic derived 数据 SHALL 与本次输入保持一致

#### Scenario: 设置变更触发重算
- **前提** 某分站已有运行态
- **当** 用户修改 `settings`
- **那么** 系统 SHALL 重新计算受影响的 station derived 数据
- **并且** 旧缓存结果 SHALL 被新结果替换

### Requirement: Station Derived 独立计算层 (Station Derived Independent Compute Layer)

系统 SHALL 提供 `StationDerivedMap` 作为 station 级派生快照缓存抽象。

#### Scenario: 第一阶段仅改名
- **前提** 系统已存在 `StationProductionFlowMap`
- **当** 第一阶段实施重构
- **那么** 系统 SHALL 将类名与主引用名改为 `StationDerivedMap`
- **并且** 系统 SHALL 一次性完成全仓替换，不保留兼容别名
- **并且** 系统 SHALL NOT 允许 `StationProductionFlowMap` 与 `StationDerivedMap` 在实现阶段长期并存
- **并且** SHALL 保持既有 compute/get/updateAggregation/remove/clear 行为不变
- **并且** SHALL 不在第一阶段修改缓存字段结构

#### Scenario: 保持双实例结构
- **前提** 系统同时存在 blueprint/planning 与 archive/live 两条路径
- **当** 系统创建或读取 `StationDerivedMap`
- **那么** 系统 SHALL 保持至少两个实例
- **并且** blueprint/planning 路径 SHALL 使用其既有实例
- **并且** archive/live 路径 SHALL 使用独立实例
- **并且** 系统 SHALL NOT 将两套来源硬合并为单实例双源分支

### Requirement: Station Semantic Derived Cache

系统 SHALL 将 station semantic derived 数据缓存到 `StationDerivedMap`。

#### Scenario: blueprint/planning 实例缓存 semantic derived
- **前提** 某 blueprint 或 binding plan station 已有模块数据
- **当** 系统计算该 station 的 derived cache
- **那么** 系统 SHALL 将 `tag` 与 `factoryGroup` 写入该 station 对应 cache
- **并且** 若可得，系统 SHALL 同步写入 `productionProfile` 与 `profileName`

#### Scenario: archive/live 实例缓存 semantic derived
- **前提** 某 archive station record 已载入
- **当** 系统计算 archive/live derived cache
- **那么** 系统 SHALL 优先读取 archive 记录已有的 semantic 字段
- **并且** 系统 SHALL 将其写入该 station 对应 cache
- **并且** 若 archive 字段缺失，系统 SHALL 按约定 fallback 规则补齐

### Requirement: Station Derived 聚合查询 (Station Derived Aggregation Query)

系统 SHALL 继续提供 empire/sector 级聚合查询能力，并保持对现有 production derived 数据的支持。

#### Scenario: Empire 载入时预计算所有 station derived
- **前提** empire 或 binding 数据载入完成
- **当** 系统调用 `computeAll(...)`
- **那么** 系统 SHALL 遍历目标实例管理范围内的 station 集合
- **并且** SHALL 更新每个 station 的 derived cache
- **并且** SHALL 保持既有 empire/sector production 聚合缓存可用

### Requirement: Station Derived 生命周期同步 (Station Derived Lifecycle Sync)

系统 SHALL 确保 station 实体生命周期与 `StationDerivedMap` 同步。

#### Scenario: 删除分站时同步清理
- **前提** 某 station 被删除或不再属于当前实例的管理范围
- **当** 系统执行移除逻辑
- **那么** 系统 SHALL 同步执行对应 `StationDerivedMap.remove(stationId)`
- **并且** 相关聚合缓存 SHALL 重新计算

#### Scenario: tab 组装读取 semantic derived
- **前提** station semantic derived 已写入 cache
- **当** `useBlueprintProductionStore.getTabs()` 或 `useLiveProductionStore.getTabs()` 组装 `ProductionTabItem`
- **那么** 系统 SHALL 优先从对应 `StationDerivedMap` 读取 `tag` / `factoryGroup`
- **并且** store SHALL NOT 再把 `classifyPlayerStationPoi(...)` 作为长期主路径直接写在 `getTabs()` 中
