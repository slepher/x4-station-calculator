# Active Station Refactory Specification

## Purpose

定义 production workbench 中当前实体、当前实体来源与当前可编辑 planning 实体之间的职责边界，避免 `station` / `transit` 语义在 store 中重复表达或相互污染，并要求 blueprint / live 两个 store 在 station 编辑主路径上保持兼容。

## MODIFIED Requirements

### Requirement: Active Station Entity Resolution

live production store MUST 将 `activeStation` 定义为当前页面实体的统一抽象，而不是直接混入编辑语义。

#### Scenario: station 页面优先使用 binding 实体

**前提** 当前 workbench 处于 `station` 模式，并且当前 station 同时存在 binding plan 与 archive 记录

**那么** `activeStation` MUST 优先基于 `bindingStation` 归一化得到

**并且** 页面上显示的当前实体名称、类型、settings 主体 MUST 与 binding 侧一致

#### Scenario: station 页面在无 binding 时 fallback 到 archive

**前提** 当前 workbench 处于 `station` 模式，并且当前 station 不存在 binding plan 但存在 archive 记录

**那么** `activeStation` MUST 基于 `archiveStation` 归一化得到

**并且** 页面仍可获得统一的当前实体对象

#### Scenario: transit 页面也拥有当前实体

**前提** 当前 workbench 处于 `transit` 模式，并且 transit 实体存在 binding 或 archive 来源

**那么** `activeStation` MUST 仍然成立

**并且** transit 页面 MUST 通过统一当前实体抽象消费标题、位置、settings 与相关展示信息

### Requirement: Entity Source Separation

live production store MUST 将当前实体来源分离为 `bindingStation` 与 `archiveStation` 两条链路。

#### Scenario: bindingStation 表达 binding 侧当前实体来源

**前提** 当前页面存在 binding 侧实体

**那么** `bindingStation` MUST 表达当前实体在 binding 侧的原始来源

**并且** 在 `station` 模式与 `transit` 模式下都 MUST 可映射当前实体来源

#### Scenario: archiveStation 表达 archive 侧当前实体来源

**前提** 当前页面存在 archive/save 侧实体

**那么** `archiveStation` MUST 表达当前实体在 archive 侧的原始来源

**并且** 在 `station` 模式与 `transit` 模式下都 MUST 可映射当前实体来源

### Requirement: Editable Plan Separation

production workbench store MUST 将当前可编辑 planning 实体从 `activeStation` 中拆离，单独建模为 `editableStationPlan`。

#### Scenario: station 页面存在可编辑 plan

**前提** 当前 workbench 处于 `station` 模式，并且当前 station 存在 binding plan

**那么** `editableStationPlan` MUST 指向该 binding plan

**并且** station plan 的模块、锁定、优先级、settings 编辑入口 MUST 只依赖 `editableStationPlan`

#### Scenario: transit 页面没有 station plan 编辑入口

**前提** 当前 workbench 处于 `transit` 模式

**那么** `editableStationPlan` MUST 为 `null`

**并且** transit 页面 MUST 不通过 station plan 编辑入口修改当前实体

#### Scenario: blueprint store 与 live store 共享 station 编辑边界

**前提** 当前页面为普通 station 页面

**那么** blueprint store 与 live store MUST 都提供 `editableStationPlan`

**并且** 模块、锁定、优先级、station-side settings 等 station plan 编辑入口 MUST 统一依赖 `editableStationPlan`

### Requirement: Transit Mode Role Boundary

`transit` 模式 MUST 只承担页面模式和行为分流职责，不得继续作为当前实体选源主路径。

#### Scenario: transit 模式用于页面分流

**前提** 当前 workbench 处于 `transit` 模式

**那么** 系统 MAY 基于该模式切换 transit toolbar、transit dashboard、transit flow 计算与 transit settings 写入路径

#### Scenario: transit 模式不再重复决定当前实体来源

**前提** 代码正在解析当前实体、当前实体上下文或统一当前实体对象

**那么** 该逻辑 MUST 优先通过 `bindingStation`、`archiveStation`、`activeStation` 完成

**并且** MUST NOT 再通过单独的 `mode === 'transit'` 分支重新发明当前实体来源

#### Scenario: archive 实体解析不得保留模式分支残留

**前提** 系统正在解析当前实体在 archive 侧的来源

**那么** 解析逻辑 MUST 属于统一来源链路的一部分

**并且** MUST NOT 以“先保留 `mode === 'station'` / `mode === 'transit'` 分支，后续再继续收敛”的方式交付

**并且** 若 archive 来源解析内部仍通过模式分支直接决定当前实体，则该 requirement 视为未满足

### Requirement: Page Consumption Contract

workbench 页面 MUST 以当前页面真实消费点为准划分实体与编辑边界。

#### Scenario: station 页面消费当前实体与可编辑 plan

**前提** 当前页面为 `station` 页面

**那么** 页面与 presenter MUST 消费 `activeStation`

**并且** 页面与 presenter MUST 消费 `editableStationPlan`

**并且** 页面主状态输出 MUST 使用 `context` 与 `stationState(entityType = 'station')`

#### Scenario: transit 页面消费当前实体但不消费可编辑 plan

**前提** 当前页面为 `transit` 页面

**那么** 页面与 presenter MUST 消费 `activeStation`

**并且** 页面主状态输出 MUST 使用 `context` 与 `stationState(entityType = 'transit')`

**并且** 页面 MUST NOT 依赖 `editableStationPlan`
