# Workforce Fix Specification

## Purpose

修正工人消耗在 data processor 与 production wareflow 中的口径，使系统能够区分 `workunit_idle` 与 `workunit_busy`，并在 live 模式下基于真实居民总数与生产所需人数拆分 idle / busy 消耗。

## MODIFIED Requirements

### Requirement: Workforce Consumption Source Data

工人消耗源数据 MUST 同时表达 `idle` 与 `busy` 两种人口状态，而不是只保留单一 busy 口径。

#### Scenario: 提取 idle 与 busy 双档

**前提** `wares.xml` 中存在 `workunit_idle` 与 `workunit_busy`
**当** 数据处理脚本提取 workforce consumption
**那么** 系统 MUST 同时提取两者的 `production` 配方
**并且** MUST 保留各 `method` 对应的种族映射
**并且** MUST 为每个 ware 计算“每人每小时消耗量”

#### Scenario: workforce consumption 数据语义

**前提** 运行时加载已处理的 workforce consumption 数据
**当** 类型、注释或命名描述该数据
**那么** 系统 MUST 将其描述为 workforce consumption
**并且** MUST 明确单位为“每人每小时”
**并且** MUST NOT 将原始数据语义描述为“每人每秒”

### Requirement: Live Workforce Override Semantics

live / archive 路径中的 `workforces` MUST 表示真实居民分布，而不是“全部都在工作的人口”。

#### Scenario: live 路径拆分 busy 与 idle

**前提** live / archive 路径存在 `workforces` 数组
**并且** 当前站点存在 `neededWorkforce`
**当** 系统计算 workforce consumption
**那么** 系统 MUST 先计算 `totalResidents = sum(workforces.amount)`
**并且** MUST 计算 `busyWorkers = min(totalResidents, neededWorkforce)`
**并且** MUST 计算 `idleWorkers = max(0, totalResidents - busyWorkers)`
**并且** 总 workforce consumption MUST 同时包含 busy 与 idle 两部分

#### Scenario: 不得将全部 live 居民按 busy 计算

**前提** live / archive 路径存在 `workforces`
**并且** `totalResidents > neededWorkforce`
**当** 系统计算 food / medical / race-specific food 消耗
**那么** 系统 MUST NOT 将 `totalResidents` 全量套用 busy consumption rate
**并且** 超出 `neededWorkforce` 的居民 MUST 按 idle consumption rate 计算

### Requirement: Race Allocation For Live Workforce

当 live 路径仅提供各 race 的总居民数，而未提供“各 race 中谁在工作”时，系统 MUST 按居民占比分配 busy / idle。

#### Scenario: race 比例分摊 busy / idle

**前提** `workforces` 提供多个 race 的居民数量
**并且** 系统已求得总站 `busyWorkers` 与 `idleWorkers`
**当** 系统按 race 计算 workforce consumption
**那么** 每个 race 的 `busy` 数量 MUST 按其居民占 `totalResidents` 的比例分摊
**并且** 每个 race 的 `idle` 数量 MUST 为该 race 总居民减去其 busy 分摊量
**并且** 各 race busy 分摊之和 MUST 等于总站 busyWorkers
**并且** 各 race idle 分摊之和 MUST 等于总站 idleWorkers

#### Scenario: 未知 race fallback

**前提** 某个 race 不存在于 workforce consumption 数据中
**当** 系统查找该 race 的 idle 或 busy 消耗表
**那么** 系统 MUST 使用 `default` 作为 fallback

### Requirement: Blueprint Workforce Boundary

blueprint / planning 路径在没有真实居民总数输入时，MUST 维持“仅对参与效率的人口按 busy 计算”的口径，不得臆造 idle 人口。

#### Scenario: blueprint 无总居民输入

**前提** 当前路径为 blueprint / planning
**并且** 系统没有独立的总居民输入
**当** 系统计算 workforce consumption
**那么** 当前参与效率计算的人口 MUST 按 busy consumption rate 计算
**并且** idleWorkers MUST 视为 0
**并且** 系统 MUST NOT 仅凭 habitat capacity 推导额外 idle population

#### Scenario: manualWorkforce 按 race 拆分后进入共享后处理

**前提** 当前路径为 blueprint / planning
**并且** `workforceAuto === false`
**并且** 用户通过 `settings.manualWorkforce` 指定总站人数
**当** 系统计算 workforce consumption
**那么** 系统 MUST 先根据当前 habitation 环境将 `manualWorkforce` 拆分为各 race 人口
**并且** 拆分后的 race population entries MUST 与 `workforceOverride` 进入同一套 busy / idle 后处理流程
**并且** 系统 MUST NOT 将拆分后的 `manualWorkforce` 继续按 busy-only 旧路径处理

### Requirement: Workforce Contribution Class Semantics

workforce 相关 contribution MUST 仅通过现有 `class` 体系区分 busy 与 idle，不新增 contribution 字段数量。

#### Scenario: busy workforce 使用现有 class

**前提** 系统生成 workforce consumption contribution
**当** 该 contribution 对应 busy workforce
**那么** contribution MUST 使用 `class: 'workforce'`
**并且** MUST 保持 `type: 'consumption'`

#### Scenario: idle workforce 使用独立 class

**前提** 系统生成 workforce consumption contribution
**当** 该 contribution 对应 idle workforce
**那么** contribution MUST 使用 `class: 'workforce_idle'`
**并且** MUST 保持 `type: 'consumption'`
**并且** 系统 MUST NOT 为区分 busy/idle 新增 contribution 字段数量

#### Scenario: auto 路径不生成 idle contribution

**前提** 当前计算路径为 auto workforce census
**当** 系统生成 workforce contribution
**那么** 系统 MUST 只生成 `class: 'workforce'`
**并且** MUST NOT 生成 `class: 'workforce_idle'`

#### Scenario: busy 为 0 时不生成 busy contribution

**前提** 当前计算路径会构造 workforce contribution
**并且** 某条 race 或总站在当前计算结果下 `busyWorkers === 0`
**当** 系统生成 workforce contribution
**那么** 系统 MUST NOT 生成 `class: 'workforce'` 的 0 值 contribution

#### Scenario: idle 为 0 时不生成 idle contribution

**前提** 当前计算路径允许存在 idle workforce
**并且** `idleWorkers === 0`
**当** 系统生成 workforce contribution
**那么** 系统 MUST NOT 生成 `class: 'workforce_idle'` contribution
**并且** 系统 MUST 避免在明细中出现数量为 0 的 idle workforce 项

### Requirement: Wareflow Workforce Contribution Correctness

wareflow 中由 workforce 产生的 consumption MUST 反映 idle / busy 拆分后的真实总量。

#### Scenario: live wareflow 合并 busy 与 idle 消耗

**前提** live / archive 路径存在真实 `workforces`
**当** 系统生成 food / medical / race-specific food 的 flow
**那么** `consumption` MUST 等于该 ware 的 busy 部分与 idle 部分之和
**并且** `contributions` MUST 通过 `class: 'workforce'` 与 `class: 'workforce_idle'` 可追溯其 workforce 语义
**并且** 相关 flow MUST 继续归入 supply 组

#### Scenario: manualWorkforce wareflow 合并 busy 与 idle 消耗

**前提** blueprint / planning 路径存在 `settings.manualWorkforce`
**并且** 该人数在当前 habitation 环境下已拆分为 race population entries
**当** 系统生成 food / medical / race-specific food 的 flow
**那么** `consumption` MUST 等于该 ware 的 busy 部分与 idle 部分之和
**并且** `contributions` MUST 使用与 `workforceOverride` 相同的 busy / idle contribution 规则

#### Scenario: 非 workforce 物资不受影响

**前提** 系统执行本次 workforce consumption 修正
**当** 检查非 workforce 驱动的模块输入输出 ware
**那么** 这些 ware 的生产与消耗规则 MUST 保持不变
