# One Flow Contribution Specification

## Purpose

Unify three contribution types (`BaseModuleFlowAtom`, `ModuleFlowAtom`, `StationFlowAtom`) into a single `FlowContribution` type identified by `class`, and eliminate the separate `workforceConsumption` field.

## MODIFIED Requirements

### Requirement: FlowContribution 类型定义

`FlowContribution` SHALL 替代现有的 `BaseModuleFlowAtom`、`ModuleFlowAtom` 和 `StationFlowAtom`。

#### Scenario: 统一类型结构

**前提** (Given) `FlowContribution` 类型定义
**当** (When) 检查其字段
**那么** (Then) 包含：
- `id: string`：实体标识（stationId / moduleId / race）
- `class: string`：归属类别（`'station'` / `'module'` / `'workforce'`）
- `type: 'production' | 'consumption'`：产消方向
- `count: number`：数量
- `amount: number`：贡献量（正=产出，负=消耗）
- `bonusPercent: number`：效率加成

**并且** (And) 可选包含二阶段衍生字段：
- `volumeFlow?: number`
- `valueFlow?: number`
- `transportFlow?: number`

### Requirement: WareProductionFlow 类型变更

#### Scenario: contributions 类型替换

**前提** (Given) `WareProductionFlow` 定义
**当** (When) 获取 `contributions`
**那么** (Then) 类型为 `FlowContribution[]`
**并且** (And) 只包含 `class='module'` 和 `class='workforce'` 的条目

#### Scenario: workforceConsumption 字段消除

**前提** (Given) `WareProductionFlow` 定义
**当** (When) 检查字段列表
**那么** (Then) `workforceConsumption` 字段已移除
**并且** (And) workforce 产生的消耗量已并入 `consumption` 字段

### Requirement: EmpireWareFlow 类型变更

#### Scenario: contributions 类型替换

**前提** (Given) `EmpireWareFlow` 定义
**当** (When) 获取 `contributions`
**那么** (Then) 类型为 `FlowContribution[]`
**并且** (And) 只包含 `class='station'` 的条目

#### Scenario: workforceConsumption 字段消除

**前提** (Given) `EmpireWareFlow` 定义
**当** (When) 检查字段列表
**那么** (Then) `workforceConsumption` 字段已移除
**并且** (And) workforce 产生的消耗量已并入 `consumption` 字段

### Requirement: WareFlow 类型变更

#### Scenario: contributions 类型替换

**前提** (Given) `WareFlow` 定义
**当** (When) 获取 `contributions`
**那么** (Then) 类型为 `FlowContribution[]`
**并且** (And) 只包含 `class='module'` 的条目

### Requirement: 自动 workforce contribution 生成规则

#### Scenario: 直接用工人数量

**前提** (Given) 自动 workforce 计算完成
**当** (When) 生成 contribution
**那么** (Then) 不生成居住舱模块的 contribution
**并且** (And) 生成一条 `{ id: '<race>', class: 'workforce', type: 'consumption', count: <workerCount>, amount: -<hourlyAmount>, bonusPercent: 0 }`
**并且** (And) race 使用实际种族名（如 `'argon'`、`'teladi'`）

#### Scenario: 消耗量在 contribution

**前提** (Given) workforce contribution 生成
**当** (When) 检查 contribution
**那么** (Then) `amount` 为负的实际消耗值（如 `-24.0`）
**并且** (And) `type` 为 `'consumption'`
**并且** (And) `class` 为 `'workforce'`
**并且** (And) workforce 消耗也累计到 flow 顶层的 `consumption` 字段

### Requirement: filter/group 逻辑迁移

#### Scenario: workforce 判定改为检查 class

**前提** (Given) 需要判定 workforce 来源的 filter 或 group 逻辑
**当** (When) 判定
**那么** (Then) 不再检查 `workforceConsumption` 字段
**并且** (And) 改为遍历 `contributions` 检查是否存在 `class='workforce'` 的条目

### Requirement: 类型导出清理

#### Scenario: 旧类型不在主要位置导出

**前提** (Given) 类型迁移完成
**当** (When) 检查导出
**那么** (Then) `BaseModuleFlowAtom`、`ModuleFlowAtom`、`StationFlowAtom` 不再通过主入口导出
**并且** (And) 保留兼容别名（可选）或完全清理（根据团队决策）

## REMOVED Requirements

### Requirement: stationContributions 双路径消除

`WareProductionFlow.stationContributions` 和 `DerivedProductionFlow.stationContributions` 字段被移除，所有 `class='station'` 的贡献条目统一写入 `contributions`。

#### Scenario: stationContributions 字段移除

**前提** (Given) `WareProductionFlow` 定义
**当** (When) 检查字段列表
**那么** (Then) `stationContributions` 字段不存在
**并且** (And) 站级贡献（`class='station'`）写入 `contributions` 字段

#### Scenario: DerivedProductionFlow.stationContributions 移除

**前提** (Given) `DerivedProductionFlow` 定义
**当** (When) 检查字段列表
**那么** (Then) `stationContributions` 字段不存在
**并且** (And) `contributions` 包含所有类型的贡献条目（`class='module'` / `class='workforce'` / `class='station'`）

### Requirement: FlowContribution 冗余字段消除

`FlowContribution` 中移除 `production`、`consumption`、`workforceConsumption`、`netRate` 字段。产消方向由 `type` 承担，数值由 `amount` 承担。这三个字段在 contribution 层仅是 `WareProductionFlow`/`EmpireWareFlow` 流层级字段的冗余拷贝，无独立消费方。

#### Scenario: 冗余字段移除

**前提** (Given) `FlowContribution` 定义
**当** (When) 检查字段列表
**那么** (Then) `production` 字段不存在
**并且** (And) `consumption` 字段不存在
**并且** (And) `workforceConsumption` 字段不存在
**并且** (And) `netRate` 字段不存在
