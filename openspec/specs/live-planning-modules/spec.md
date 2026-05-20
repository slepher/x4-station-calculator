# Live Planning Modules Specification

## Purpose

在实况产能规划模式下，模组规划器 SHALL 同时提供 planned 与 archive 的差异表达、orphan 模块建议区、自动模块相减，以及保留既有 archive 参考区和 autoFill 参考模块优先级，使用户能够更快识别哪些模块已超出存档、哪些 orphan 模块仍需补齐。

---

## MODIFIED Requirements

### Requirement: Planning Panel Difference Visualization

`StationPlanningPanel` 在规划模式且存档数据存在时，SHALL 基于 `archive.modules + archive.building.modules` 计算每个 planned 模块与 archive 总量的差异，并按差异方向分别渲染。

#### Scenario: planned 数量高于 archive 总量

- **前提** 存档总量 solar = 5，`plannedModules` 含 `{ id: "solar", count: 8 }`
- **当** 规划器渲染 solar 项
- **那么** solar 的模块名称后显示弱化的 `+3`
- **并且** count 数字不显示红色

#### Scenario: planned 数量等于 archive 总量

- **前提** 存档总量 solar = 5，`plannedModules` 含 `{ id: "solar", count: 5 }`
- **当** 规划器渲染 solar 项
- **那么** 模块名称后不显示 `+N`
- **并且** count 数字保持默认颜色

#### Scenario: planned 数量低于 archive 总量

- **前提** 存档总量 solar = 5，`plannedModules` 含 `{ id: "solar", count: 2 }`
- **当** 规划器渲染 solar 项
- **那么** solar 的 count 数字显示为红色
- **并且** 模块名称后不显示 `+N`

---

### Requirement: Recommended Modules Section

`StationPlanningPanel` 在规划模式且存档数据存在时，SHALL 在 planned 区与 auto 区之间渲染 `recommendedModules` 建议区，用于提示需要补齐的 orphan 模块差额。

#### Scenario: 建议区默认折叠

- **前提** `recommendedModules` 非空
- **当** 规划器首次渲染
- **那么** 建议区默认折叠
- **并且** 折叠态只显示推荐模块种类数

#### Scenario: 无推荐模块时不显示建议区

- **前提** `recommendedModules` 为空
- **当** 规划器渲染
- **那么** 不渲染建议区

#### Scenario: 展开后显示推荐差额

- **前提** `recommendedModules` 含 `{ id: "solar", count: 3 }`
- **当** 用户展开建议区
- **那么** 列表中显示 solar
- **并且** 显示的数量为 3
- **并且** 该数量表示 `archive_total - planned_count`

#### Scenario: 点击推荐模块添加到 planned

- **前提** archive 总量 solar = 5，`plannedModules` 不含 solar
- **并且** `recommendedModules` 含 `{ id: "solar", count: 5 }`
- **当** 用户点击建议区中的 solar
- **那么** `plannedModules` 新增 `{ id: "solar", count: 5 }`

#### Scenario: 点击推荐模块提升已有 planned 数量

- **前提** archive 总量 solar = 5，`plannedModules` 含 `{ id: "solar", count: 2 }`
- **并且** `recommendedModules` 含 `{ id: "solar", count: 3 }`
- **当** 用户点击建议区中的 solar
- **那么** `plannedModules` 中 solar 的 count 变为 5

#### Scenario: 折叠状态为共享运行时状态

- **前提** 某个 station 中用户将建议区展开
- **当** 用户切换到另一个 station 的 planning 视图
- **那么** 建议区保持展开
- **并且** 刷新页面后恢复默认折叠

---

### Requirement: Orphan-based Recommendation Rule

系统 SHALL 仅将满足 orphan 判定且 `planned.count < archive_total` 的模块加入 `recommendedModules`。

#### Scenario: archive-only orphan 进入建议区

- **前提** archive 总量 chip = 2，`plannedModules` 不含 chip
- **并且** chip 满足 orphan 判定
- **当** presenter 计算 `recommendedModules`
- **那么** `recommendedModules` 含 `{ id: "chip", count: 2 }`

#### Scenario: planned 数量不足的 orphan 进入建议区

- **前提** archive 总量 solar = 5，`plannedModules` 含 `{ id: "solar", count: 2 }`
- **并且** solar 满足 orphan 判定
- **当** presenter 计算 `recommendedModules`
- **那么** `recommendedModules` 含 `{ id: "solar", count: 3 }`

#### Scenario: 非 orphan 模块不进入建议区

- **前提** archive 总量 ec = 10，`plannedModules` 含 `{ id: "ec", count: 0 }`
- **并且** ec 不满足 orphan 判定
- **当** presenter 计算 `recommendedModules`
- **那么** `recommendedModules` 不含 ec

---

### Requirement: Orphan Determination

系统 SHALL 基于 `built + building` 的 archive 模块集合判定 orphan。

#### Scenario: 任一产出无人消费则为 orphan

- **前提** 某模块产出 ware A 与 ware B
- **并且** archive 中其他模块对 ware A 存在模块本身消费关系
- **并且** archive 中其他模块对 ware B 不存在模块本身消费关系
- **当** presenter 判定该模块是否 orphan
- **那么** 该模块被视为 orphan

#### Scenario: 仅工人消耗不构成消费关系

- **前提** 某模块的某个产出只被工人或其他非模块机制消耗
- **当** presenter 判定该模块是否 orphan
- **那么** 该模块被视为 orphan

#### Scenario: 其他模块存在模块本身消费关系则该产出不命中 orphan 条件

- **前提** 某模块的产出 ware A 在 archive 其他模块中存在模块本身消费关系
- **当** presenter 判定该产出是否无人消费
- **那么** ware A 不应触发 orphan 条件

---

### Requirement: Archive Reference Area

在规划模式下，archive 区 SHALL 保留为纯参考区，不承担 orphan 推荐职责。

#### Scenario: archive 区不显示 orphan icon

- **前提** 某模块满足 orphan 判定
- **当** 规划器渲染 archive 区
- **那么** 该模块在 archive 区不显示 orphan icon
- **并且** 不显示独立 orphan 标签

#### Scenario: archive 区沿用当前展示结构

- **前提** archive 区当前实现已存在 built/building 展示结构
- **当** 本次变更落地
- **那么** archive 区继续沿用当前显示内容
- **并且** 本次变更不调整其结构与展示方式

---

### Requirement: 自动模块显示相减

Presenter 层 SHALL 计算 `effectiveAutoIndustryModules`、`effectiveAutoHabitationModules`、`effectiveAutoInfrastructureModules`：
- 对每个自动模块，`display_count = max(0, auto_count - archive_built_count - archive_building_count)`
- `display_count === 0` 的模块从数组中移除
- store 层的 `autoIndustryModules` 等保持原始完整数值不变

#### Scenario: 自动模块被部分扣除

- **前提** `autoIndustryModules` 含 `{ id: "module_hull_01", count: 5 }`，存档中该模块已建 3、在建 1
- **当** presenter 计算 effectiveAutoIndustryModules
- **那么** 结果含 `{ id: "module_hull_01", count: 1 }`

#### Scenario: 自动模块被完全扣除

- **前提** `autoIndustryModules` 含 `{ id: "module_hull_01", count: 3 }`，存档中该模块已建 3、在建 0
- **当** presenter 计算 effectiveAutoIndustryModules
- **那么** 结果不含该模块

---

### Requirement: 搜索框添加默认数量

从 `StationModulePicker` 搜索框添加模块时：
- 若 `plannedModules` 不含该模块 → 默认 count = `archive.modules[moduleId] + archive.building.modules[moduleId]`
- 若 `plannedModules` 已含该模块 → 每次增量 `count + 1`

#### Scenario: 搜索添加新模块有存档数据

- **前提** 存档中 module_hull_01 已建 3、在建 1，`plannedModules` 不含此模块
- **当** 用户从搜索框选择 module_hull_01
- **那么** `plannedModules` 新增 `{ id: "module_hull_01", count: 4 }`

#### Scenario: 搜索添加已存在模块

- **前提** `plannedModules` 含 `{ id: "solar", count: 3 }`
- **当** 用户从搜索框选择 solar
- **那么** `plannedModules` 中 solar 的 count 变为 4

---

### Requirement: AutoFill Reference Priority

在 live 模式下，`calculateAutoFillModules` SHALL 继续使用 `archive.modules + archive.building.modules` 作为参考模块集合，并保留既有 P1–P8 优先级和按产能计算的配额规则。

#### Scenario: 参考模块优先级仍然生效

- **前提** live 模式下存在 archive modules 与 building modules
- **当** `calculateAutoFillModules` 选择补齐模块
- **那么** 仍按既有 P1–P8 顺序匹配
- **并且** P1 与 P2 共享同一份参考配额
