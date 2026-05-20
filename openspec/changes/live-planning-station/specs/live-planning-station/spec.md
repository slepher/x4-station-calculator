# Live Planning Station Specification

## Purpose

定义实况产能页面在 `planning` 模式且存在 archive 数据时，右侧 `StationDashboard` 的 planning scope 语义：系统必须以“已建不减少、在建不削减、规划只会继续新增”的方式构建 `built / building / all` 三态，并让 `workers` tab 固定基于规划完成后的总模块口径进行分析，同时保持当前 planning workforce 交互能力不变。

## ADDED Requirements

### Requirement: Planning StationDashboard Activates Only When Archive Exists

系统 SHALL 仅在 `visualMode === 'planning'` 且当前 station 存在 `archiveStation` 时启用新的 planning dashboard 口径。

#### Scenario: Planning station with archive uses planning dashboard semantics

- **前提** 当前 workbench 为 station
- **并且** `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **当** 系统构建 `StationDashboard` 输入
- **那么** 系统启用 planning dashboard 的新 scope 语义

#### Scenario: Planning station without archive keeps existing dashboard semantics

- **前提** 当前 workbench 为 station
- **并且** `visualMode = planning`
- **并且** 当前 station 不存在 `archiveStation`
- **当** 系统构建 `StationDashboard` 输入
- **那么** 系统继续沿用当前既有 dashboard 语义

### Requirement: Effective Target Modules Use ModuleId-Wise Max Over Final Planned And Current Total

系统 SHALL 使用如下规则构建 planning dashboard 的 `effectiveTargetModules`：

- `finalPlannedModules = plannedModules + autoIndustryModules + autoHabitationModules + autoInfrastructureModules`
- `currentTotalModules = archive.modules + archive.building.modules`
- `effectiveTargetModules = max(finalPlannedModules, currentTotalModules)`

其中 `max` 为按 `moduleId` 逐项比较 `count` 并取较大值。

#### Scenario: Current total wins when plan is smaller than current construction state

- **前提** `finalPlannedModules` 中某模块数量为 `1`
- **并且** `currentTotalModules` 中同模块数量为 `3`
- **当** 系统构建 `effectiveTargetModules`
- **那么** 该模块在 `effectiveTargetModules` 中的数量为 `3`

#### Scenario: Planned target wins when plan expands beyond current total

- **前提** `finalPlannedModules` 中某模块数量为 `6`
- **并且** `currentTotalModules` 中同模块数量为 `2`
- **当** 系统构建 `effectiveTargetModules`
- **那么** 该模块在 `effectiveTargetModules` 中的数量为 `6`

### Requirement: Planning Dashboard Scope Uses Built And Effective Target

系统 SHALL 使用如下规则构建 planning dashboard 三态：

- `builtScopeModules = archive.modules`
- `buildingScopeModules = effectiveTargetModules - archive.modules`
- `allScopeModules = effectiveTargetModules`

#### Scenario: Built scope uses only archive built modules

- **前提** archive 已建模块中某生产模块数量为 `10`
- **并且** archive 在建中同模块数量为 `2`
- **并且** planning 目标中同模块数量为 `15`
- **当** 用户查看 `built` scope
- **那么** 该模块在 dashboard 中按 `10` 参与统计

#### Scenario: Building scope preserves current building and adds more when needed

- **前提** archive 已建模块中某模块数量为 `10`
- **并且** archive 在建中同模块数量为 `2`
- **并且** planning 目标中同模块数量为 `15`
- **当** 用户查看 `building` scope
- **那么** 该模块在 dashboard 中按 `5` 参与统计

#### Scenario: All scope uses effective target modules

- **前提** archive 已建模块中某模块数量为 `10`
- **并且** archive 在建中同模块数量为 `2`
- **并且** planning 目标中同模块数量为 `11`
- **当** 用户查看 `all` scope
- **那么** 该模块在 dashboard 中按 `12` 参与统计

### Requirement: Planning Building Scope Never Reduces Current Building Counts

planning dashboard 的 `building` scope SHALL NOT 削减 archive 中当前已经在建的模块数量，而只允许在其基础上继续新增。

#### Scenario: Smaller planning target does not shrink current building scope

- **前提** archive 已建模块中某模块数量为 `10`
- **并且** archive 在建中同模块数量为 `2`
- **并且** planning 目标中同模块数量为 `11`
- **当** 系统构建 `buildingScopeModules`
- **那么** 该模块在 `buildingScopeModules` 中的数量仍为 `2`

### Requirement: Auto Generated Modules Participate In Planning Building Scope

当 auto 生成的 habitation、storage、dock 或 pier 使 `effectiveTargetModules` 超过当前总量时，这些模块 SHALL 进入 planning dashboard 的 `building` scope。

#### Scenario: Auto generated habitation becomes part of planning building scope

- **前提** archive 中某 habitation 模块总量为 `1`
- **并且** auto 结果使该 habitation 在 `finalPlannedModules` 中数量为 `3`
- **当** 系统构建 `buildingScopeModules`
- **那么** 该 habitation 模块在 `buildingScopeModules` 中数量为 `2`

### Requirement: Planning Dashboard Keeps BuildingInProgress As Display Context Only

planning dashboard SHALL 保留 `buildingInProgress` 的展示语义，但 MUST NOT 用它去扣减 planning `building` scope 的模块数量。

#### Scenario: Building in progress is shown but does not shrink building scope

- **前提** archive 中存在 `buildingInProgress`
- **并且** 当前处于 planning + archive 场景
- **当** 系统构建 `buildingScopeModules`
- **那么** 系统不会因为 `buildingInProgress` 存在而扣减 `buildingScopeModules`
- **并且** dashboard 仍可显示该在建上下文

### Requirement: Materials Time And Volume Tabs Follow Module Scope In Planning Mode

在 planning + archive 下，`materials`、`time`、`volume` 三个 tab SHALL 跟随当前 `moduleScope` 选择对应的 dashboard 模块集合。

#### Scenario: Materials tab uses building scope modules

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** `moduleScope = building`
- **当** 用户查看 `materials` tab
- **那么** dashboard 使用 `buildingScopeModules` 进行统计

#### Scenario: Volume tab uses built scope modules

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** `moduleScope = built`
- **当** 用户查看 `volume` tab
- **那么** dashboard 使用 `builtScopeModules` 进行统计

### Requirement: Planning Workers Tab Uses All Scope And Ignores Module Scope Switching

在 planning + archive 下，`workers` tab SHALL 固定使用 `allScopeModules`，并且 MUST NOT 随 `moduleScope` 的 built/building/all 切换而改变模块口径。

#### Scenario: Workers tab ignores built scope switch

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** `moduleScope = built`
- **当** 用户查看 `workers` tab
- **那么** dashboard 仍使用 `allScopeModules` 进行工人分析

#### Scenario: Workers tab ignores building scope switch

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 `archiveStation`
- **并且** `moduleScope = building`
- **当** 用户查看 `workers` tab
- **那么** dashboard 仍使用 `allScopeModules` 进行工人分析

### Requirement: Planning Workers Tab Does Not Use Archive Workforce Values

在 planning + archive 下，`workers` tab SHALL 使用当前 planning 口径重新计算 workforce 结果，而 MUST NOT 直接使用 archive 中已有的 workforce 数值。

#### Scenario: Archive workforce does not override planning workers analysis

- **前提** archive 中存在某个当前工人数值
- **并且** 当前处于 planning + archive 场景
- **当** 用户查看 `workers` tab
- **那么** dashboard 的工人分析结果不直接读取 archive workforce 数值

### Requirement: Planning Workers Tab Keeps Workforce Auto And Manual Controls

在 planning + archive 下，`workers` tab SHALL 保持当前 planning 模式已有的 workforce 交互能力，包括自动模式切换和手动工人数编辑。

#### Scenario: Workforce auto can still be toggled in planning workers tab

- **前提** 当前处于 planning + archive 场景
- **当** 用户在 `workers` tab 切换 `workforceAuto`
- **那么** dashboard 接受该切换并按当前 planning 口径更新工人结果

#### Scenario: Manual workforce can still be edited in planning workers tab

- **前提** 当前处于 planning + archive 场景
- **并且** `workforceAuto = false`
- **当** 用户修改当前工人数值
- **那么** dashboard 按新的手动工人数值和 `allScopeModules` 重算效率与工人结果

### Requirement: Existing Module Scope Control Is Reused In Planning Mode

planning dashboard SHALL 继续复用现有 `moduleScope` 控制入口，而不新增新的 planning dashboard scope 控件。

#### Scenario: Planning dashboard uses existing module scope control

- **前提** 当前处于 planning + archive 场景
- **当** 用户查看 toolbar
- **那么** 系统继续使用现有 `moduleScope` 控件切换 `built / building / all`

### Requirement: Live Overview And Transit Dashboard Semantics Remain Unchanged

本次 change SHALL NOT 改变 `live` 模式、`overview`、`transit`，以及非 planning+archive 场景下 `StationDashboard` 的既有语义。

#### Scenario: Live mode dashboard remains unchanged

- **前提** 当前 `visualMode = live`
- **当** 用户查看 `StationDashboard`
- **那么** 系统继续沿用当前 live dashboard 语义

#### Scenario: Transit dashboard remains unchanged

- **前提** 当前 workbench 为 `transit`
- **当** 用户查看右侧 dashboard
- **那么** 本次 change 不重新定义其统计口径
