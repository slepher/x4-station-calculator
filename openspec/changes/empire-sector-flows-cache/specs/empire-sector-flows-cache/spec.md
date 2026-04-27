# Empire Sector Flows Cache Specification

## Purpose

Replace flat `WareProductionFlow[]` caches in `StationDerivedMap` with `EmpireGroupedFlows`-level caches built during `updateAggregation()`, so facade reads directly from cache without recomputing `analyzeEmpireWareFlow`.

## ADDED Requirements

### Requirement: StationDerivedSeed 增加 count

#### Scenario: count 可选默认 1

**前提** (Given) `StationDerivedSeed` 定义
**当** (When) 创建 seed 时不传 `count`
**那么** (Then) `snapshot.count` 默认为 1

#### Scenario: count 影响 flow 聚合

**前提** (Given) station 的 `count > 1`
**当** (When) `updateAggregation()` 构建 `EmpireGroupedFlows`
**那么** (Then) 每个 flow 的 `production/consumption/netRate` 按 `count` 相乘

### Requirement: updateAggregation 产出 EmpireGroupedFlows

#### Scenario: empire 级缓存

**前提** (Given) `updateAggregation()` 执行
**当** (When) 构建缓存
**那么** (Then) `empireGroupedFlowsCache` 为 `EmpireGroupedFlows` 类型
**并且** (And) 包含全帝国所有 station 的聚合，按 `count` 加权
**并且** (And) contributions 为 `class='station'` 的条目

#### Scenario: sector 级缓存

**前提** (Given) `updateAggregation()` 执行
**当** (When) 构建 sector 缓存
**那么** (Then) `sectorGroupedFlowsCache` 为 `Map<string, EmpireGroupedFlows>`
**并且** (And) 每个 sector 的 `EmpireGroupedFlows` 只包含该 sector 内的 station

### Requirement: 无参 getEmpireGroupedFlows

#### Scenario: 返回缓存

**前提** (Given) `updateAggregation()` 已执行
**当** (When) 调用 `getEmpireGroupedFlows()`
**那么** (Then) 返回 `empireGroupedFlowsCache`
**并且** (And) 不接受任何参数

### Requirement: getSectorGroupedFlows

#### Scenario: 按 sectorId 返回缓存

**前提** (Given) `updateAggregation()` 已执行
**当** (When) 调用 `getSectorGroupedFlows(sectorId)`
**那么** (Then) 返回 `sectorGroupedFlowsCache` 中对应 sector 的 `EmpireGroupedFlows`
**并且** (And) sector 不存在时返回空的 `EmpireGroupedFlows`

## REMOVED Requirements

- **删除 `empireFlowsCache`**：不再以 `WareProductionFlow[]` 形式缓存帝国级聚合。
- **删除 `sectorFlowsCache`**：不再以 `Map<string, WareProductionFlow[]>` 形式缓存 sector 聚合。
- **删除 `getEmpireFlows()`**：不再提供 `WareProductionFlow[]` 形式的帝国流读取。
- **删除 `getSectorFlows()`**：不再提供 `WareProductionFlow[]` 形式的 sector 流读取。

理由：以上缓存和 getter 无外部调用，功能已被新的 `EmpireGroupedFlows` 级缓存替代。
