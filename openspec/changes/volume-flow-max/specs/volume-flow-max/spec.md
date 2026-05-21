# Volume Flow Max Specification

## Purpose

统一 volume 占用算法，移除 `sum/max` 双模式，确保 wareflow 展示、transit-hub volume 视图与 infrastructure storage 需求计算共享同一套 `max` 口径。

## ADDED Requirements

### Requirement: Shared Buffer Occupancy Formula

系统 SHALL 使用单一共享公式计算 ware 的 buffer 占用，不允许由多个调用方各自维护独立实现。

#### Scenario: 计算单个 ware 的总占用数量

**前提** 系统已知某个 ware 的 `consumption`、`netRate`、`resourceBufferHours`、`primaryProductBufferHours`、`secondaryProductBufferHours`、`unitVolume` 与 ware priority
**当** 系统计算该 ware 的 buffer 占用
**那么** 系统 MUST 先计算 `consumptionBufferCount = consumption * resourceBufferHours`
**并且** 若 `netRate > 0` 且 ware priority 允许产物缓冲，系统 MUST 计算 `productionBufferCount`
**并且** `totalOccupiedCount` MUST 等于 `max(consumptionBufferCount, productionBufferCount)`
**并且** `totalOccupiedVolume` MUST 等于 `totalOccupiedCount * unitVolume`

#### Scenario: 产物缓冲不生效时

**前提** 某个 ware 的 `netRate <= 0`，或该 ware priority 不允许产物缓冲
**当** 系统计算该 ware 的 buffer 占用
**那么** 系统 MUST 令 `productionBufferCount = 0`
**并且** `totalOccupiedCount` MUST 仍按 `max(consumptionBufferCount, productionBufferCount)` 得出

### Requirement: No Sum/Max Toggle

系统 SHALL 不再提供 `sum/max` 选择能力。

#### Scenario: 任意调用方请求 volume 占用计算

**前提** 任意 store / facade / presenter 调用 volume 占用相关逻辑
**当** 调用方获取 `totalOccupiedCount` 或 `totalOccupiedVolume`
**那么** 系统 MUST 只返回 `max` 口径结果
**并且** 系统 MUST NOT 要求调用方传入 `sum/max` 模式参数
**并且** 系统 MUST NOT 暴露兼容旧 `sum` 模式的公开分支

### Requirement: Volume Views and Infrastructure Stay Consistent

所有 volume 消费方 SHALL 使用同一口径。

#### Scenario: station wareflow volume 与 transit-hub volume

**前提** station wareflow volume 视图与 transit-hub volume 视图展示相同 ware 的占用信息
**当** 系统派生展示数据
**那么** 两个视图 MUST 基于同一共享 buffer 占用公式
**并且** 两个视图 MUST NOT 因为调用路径不同而出现 `sum`/`max` 口径差异

#### Scenario: infrastructure storage 需求

**前提** 系统根据 production flows 计算 auto infrastructure modules 的 storage 需求
**当** 系统聚合某 transport type 的 storage volume
**那么** 每个 ware 的占用量 MUST 基于与 wareflow 视图相同的共享 buffer 占用公式
**并且** storage 需求 MUST NOT 再使用独立内联的 `consumption + production` 实现
