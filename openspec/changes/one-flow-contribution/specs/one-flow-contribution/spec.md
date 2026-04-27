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
- `count: number`：数量
- `amount: number`：贡献量
- `bonusPercent: number`：效率加成
- `production: number`：产出
- `consumption: number`：消耗
- `workforceConsumption: number`：人力消耗
- `netRate: number`：净产出

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
**并且** (And) 生成一条 `{ id: '<race>', class: 'workforce', count: <workerCount>, amount: 0, bonusPercent: 0, production: 0, consumption: 0, workforceConsumption: 0, netRate: 0 }`
**并且** (And) race 使用实际种族名（如 `'argon'`、`'teladi'`）

#### Scenario: 消耗量在顶层

**前提** (Given) workforce contribution 生成
**当** (When) 检查 flow 字段
**那么** (Then) `amount` 为 0
**并且** (And) workforce 消耗已计入 flow 顶层的 `consumption` 字段

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
