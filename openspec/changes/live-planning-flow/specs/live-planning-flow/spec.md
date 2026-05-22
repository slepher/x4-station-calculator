# Live Planning Flow Specification

## Purpose

定义实况产能页面在 `planning` 模式且存在 archive 数据时的主 flow 计算口径：系统必须使用 `planned + auto` 与 archive 全量模块逐项 `max` 后的有效模块集来重算 planning 主 `productionFlows`，并让这套 flow 直接替代旧 planning flow，继续驱动后续所有 flow 聚合、volume allocation 主视图与展开明细，同时保持现有隐式职责分离不变。

## ADDED Requirements

### Requirement: Planning Flow Effective Module Merge Activates Only When Archive Exists

系统 SHALL 仅在 `visualMode === 'planning'` 且当前 station 存在 `archiveStation` 时启用新的有效模块合并口径。

#### Scenario: Planning station with archive uses effective module merge

- **前提** 当前 workbench 为 station
- **并且** `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **当** 系统构建该 station 的 planning flow 计算输入
- **那么** 系统启用新的有效模块逐项 `max` 合并口径

#### Scenario: Planning station without archive keeps old flow path

- **前提** 当前 workbench 为 station
- **并且** `visualMode = planning`
- **并且** 当前 station 不存在 `archiveStation`
- **当** 系统构建该 station 的 planning flow 计算输入
- **那么** 系统继续使用现有旧 planning 计算路径

### Requirement: Effective Modules Use ModuleId-Wise Max Over Planned Plus Auto And Archive Totals

系统 SHALL 使用如下规则构建 `effectiveModules`：

- 左侧输入：`plannedModules + autoIndustryModules + autoHabitationModules + autoInfrastructureModules`
- 右侧输入：`archive.modules + archive.building.modules`
- 合并规则：按 `moduleId` 逐项比较 `count` 并取较大值

#### Scenario: Archive count wins for an existing module

- **前提** 左侧输入中 `module_hab_l_01 = 2`
- **并且** archive 总量中 `module_hab_l_01 = 5`
- **当** 系统构建 `effectiveModules`
- **那么** `effectiveModules` 中 `module_hab_l_01 = 5`

#### Scenario: Planned plus auto count wins for an expanded module

- **前提** 左侧输入中 `module_arg_prod_hull_01 = 8`
- **并且** archive 总量中 `module_arg_prod_hull_01 = 3`
- **当** 系统构建 `effectiveModules`
- **那么** `effectiveModules` 中 `module_arg_prod_hull_01 = 8`

### Requirement: All Archive Modules Participate In Max Merge

archive 侧的全部模块 SHALL 参与逐项 `max`，而不是只让生产模块参与。

#### Scenario: Existing storage is preserved by merge

- **前提** archive 中 `module_storage_container_l_01 = 4`
- **并且** 左侧输入中该模块数量为 `1`
- **当** 系统构建 `effectiveModules`
- **那么** `effectiveModules` 中该存储模块数量为 `4`

#### Scenario: Existing pier is preserved by merge

- **前提** archive 中 `pier_arg_l_01 = 3`
- **并且** 左侧输入中该模块数量为 `0`
- **当** 系统构建 `effectiveModules`
- **那么** `effectiveModules` 中该船坞/泊位模块数量为 `3`

### Requirement: Implicit Responsibility Separation Remains Unchanged

系统 SHALL 保持现有隐式职责分离，不新增显式 `productionOnlyModules` 分类层。

#### Scenario: Planned modules may still contain all module types

- **前提** `plannedModules` 同时包含 production、habitation、storage、pier 类型模块
- **当** 系统进入本 change 的计算链
- **那么** 系统仍允许这些模块共同存在于 `plannedModules`
- **并且** MUST NOT 先引入新的显式 production-only 过滤集合

#### Scenario: Flow membership is still determined by module outputs and inputs

- **前提** 某模块存在于 `effectiveModules`
- **并且** 该模块没有可参与生产流的 `outputs / inputs`
- **当** 系统重算 `productionFlows`
- **那么** 该模块不会因为处于 `effectiveModules` 而被强行作为生产流节点写入 flow

### Requirement: Workforce And Efficiency Recompute From Effective Modules

启用条件成立时，系统 SHALL 基于 `effectiveModules` 重算 `workforce` 与 `efficiency`。

#### Scenario: Existing archive habitation affects planning workforce result

- **前提** planning 左侧 habitation 数量为 `1`
- **并且** archive 中同 habitation 数量为 `4`
- **当** 系统构建 `effectiveModules` 并重算 workforce / efficiency
- **那么** habitation 相关 workforce 结果按 `4` 的口径参与计算

### Requirement: Production Flows Recompute From Effective Modules

启用条件成立时，系统 SHALL 基于 `effectiveModules` 重算 planning `productionFlows`。

#### Scenario: Existing archive production module affects planning production flow

- **前提** planning 左侧某生产模块数量为 `2`
- **并且** archive 中同模块数量为 `5`
- **当** 系统重算 planning `productionFlows`
- **那么** 该模块对应产出与消耗按 `5` 的口径参与 flow 计算

### Requirement: Effective Planning Flow Becomes The Canonical Aggregation Base

在启用条件成立时，系统 SHALL 让基于 `effectiveModules` 重算出的 planning `productionFlows` 直接替代旧 planning flow，并作为后续所有 flow 聚合的唯一基准。

#### Scenario: Effective planning flow replaces the old planning flow

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **当** 系统基于 `effectiveModules` 重算 planning `productionFlows`
- **那么** 这套 `productionFlows` 直接替代旧 planning flow 数据源

#### Scenario: Flow aggregation uses the same canonical planning flow

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **当** 系统继续计算 `derivedProductionFlows`、volume 主视图或展开明细
- **那么** 这些后续聚合结果都基于同一套新的 planning `productionFlows`
- **并且** MUST NOT 同时保留“展示 flow”和“聚合 flow”两套并行基准

### Requirement: Ware Priority Semantics Remain Unchanged

本次 change SHALL NOT 修改 `warePriorityLevels` 的既有判定规则。

#### Scenario: Existing ware priority branching remains unchanged

- **前提** 某个 ware 的优先级当前依赖既有 `plannedModules` 相关分支逻辑
- **当** 本次 change 启用
- **那么** 该优先级判定规则保持不变
- **并且** 本次 change 不把它改写为基于 `effectiveModules` 的新语义

### Requirement: Wares Produced By Archive Modules Cannot Be Locked In Planning Archive Mode

在 `planning + archive` 场景下，若某个 ware 由 archive 中存在的生产模块产出，则系统 SHALL 禁止对该 ware 执行 lock 操作。

#### Scenario: Archive produced ware cannot be locked

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** archive 中存在某个生产模块会产出 `energycells`
- **当** 用户尝试对 `energycells` 执行 lock
- **那么** 系统拒绝该 lock 操作

#### Scenario: Lock restriction does not rewrite ware priority semantics

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** 某个 ware 由 archive 生产模块产出
- **当** 系统判定该 ware 的优先级分支逻辑
- **那么** `warePriorityLevels` 仍按既有规则判定
- **并且** lock 禁止约束不会把优先级逻辑改写成另一套语义

### Requirement: Recommended Modules Are View-Only And Must Not Affect Flow Calculation

`recommendedModules` SHALL 仅作为左侧 planning 面板的视图因素，MUST NOT 参与 `effectiveModules` 构建，也 MUST NOT 直接参与 flow 计算。

#### Scenario: Recommended module does not change effective flow before user adds it to plan

- **前提** 左侧 `recommendedModules` 中存在某个建议模块
- **并且** 该模块尚未被用户加入 `plannedModules`
- **当** 系统构建 `effectiveModules` 并重算 planning flow
- **那么** 该建议模块不会仅因存在于 `recommendedModules` 而进入计算输入

### Requirement: Planning Wareflow View Uses Canonical Planning Flow

在启用条件成立时，planning 的普通 wareflow 视图 SHALL 使用新的 canonical planning flow 数据。

#### Scenario: Planning wareflow list uses effective flow

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **当** 用户查看普通 wareflow 列表
- **那么** 列表展示结果来自新的 canonical planning flow 数据

### Requirement: Planning Volume View Reuses The Allocation View Shape Defined By Live Cargo Volume

在启用条件成立时，planning 的 volume 主视图 SHALL 不再保留旧 volume list，而是复用 `live-cargo-volume` 定义的 allocation 视图骨架。

#### Scenario: Planning volume uses allocation shell instead of old list

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** 当前 `viewMode = volume`
- **当** 系统渲染 planning volume 主视图
- **那么** 系统渲染与 `live-cargo-volume` 一致的 allocation 视图骨架
- **并且** MUST NOT 继续渲染旧的 planning volume list

### Requirement: Planning Volume Current And Target Stay On Archive Data While Recommended And Detail Follow Canonical Planning Flow

在启用条件成立时，planning volume 的 `currentCount / targetCount` SHALL 继续读取 archive 数据；`recommendedCount` 与展开明细 SHALL 使用 canonical planning flow 继续推导。

#### Scenario: Planning volume row mixes archive current target with canonical planning recommendation

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** 当前 `viewMode = volume`
- **当** 系统渲染 planning volume 某个 ware 行
- **那么** `currentCount` 来自 archive `cargo`
- **并且** `targetCount` 来自 archive `targetCounts`
- **并且** `recommendedCount` 来自 canonical planning flow 推导结果

### Requirement: Planning Volume View And Its Detail Use The Same Canonical Planning Flow Base

在启用条件成立时，planning 的 volume 主视图与展开明细 SHALL 一起切换到基于 canonical planning flow 的聚合结果，二者 MUST 使用同一套 planning flow 基准。

#### Scenario: Planning volume detail uses the same effective flow source

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** 当前 `viewMode = volume`
- **并且** 用户展开某个 ware 的明细
- **当** 系统渲染展开明细
- **那么** 明细与主视图使用同一套 canonical planning flow 基准
- **并且** MUST NOT 出现主视图已切新口径、明细仍沿用旧口径的情况

### Requirement: Live Mode Overview Transit And StationDashboard Remain Unchanged

本次 change SHALL NOT 改变 `live` 模式、`overview`、`transit`，以及 `StationDashboard` 的语义。

#### Scenario: Live mode remains unchanged

- **前提** 当前 `visualMode = live`
- **当** 用户查看中间资源面板
- **那么** 系统继续沿用现有 live 模式语义

#### Scenario: StationDashboard remains out of scope

- **前提** 用户查看 `StationDashboard`
- **当** 本次 change 已落地
- **那么** `StationDashboard` 的行为与口径不因本次 change 被重新定义
