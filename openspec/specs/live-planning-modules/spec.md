# Live Planning Modules Specification

## Purpose

在实况产能规划模式下，模组规划器 SHALL 展示存档中已建模块和在建模块作为参考区域，并提供自动模块相减、点选添加、搜索默认数量联动和阈值警告等交互机制。

---

## Requirements

### Requirement: 已建模块区展示

`StationPlanningPanel` 在规划模式且存档数据存在时，SHALL 在自动基础设施区下方渲染"已建模块区"（`tier_built`），以平铺方式列出 `archive.modules` 中的模块。

#### Scenario: 存档无已建模块

- **前提** `archive.modules` 为空
- **当** 规划模式加载规划器
- **那么** "已建模块区"不渲染

#### Scenario: 存档有已建模块

- **前提** `archive.modules` 包含 `[{ id: "module_solar_01", count: 3 }, { id: "module_hull_01", count: 2 }]`
- **当** 规划模式加载规划器
- **那么** "已建模块区"渲染 2 个 module item，分别显示 count=3 和 count=2
- **并且** 模块按 `archive.modules` 原有顺序平铺，不按 group 分组

#### Scenario: 存档模块不在 game data 中

- **前提** `archive.modules` 包含 `[{ id: "mod_unknown_x", count: 1 }]`，该 id 不在 `modulesMap` 中
- **当** 规划模式加载规划器
- **那么** 该模块被跳过，不出现在已建模块区

---

### Requirement: 在建模块区展示

`StationPlanningPanel` 在规划模式且存档数据存在时，SHALL 在已建模块区下方渲染"在建模块区"（`tier_building`），以平铺方式列出 `archive.building.modules` 中的模块。

其行为和"已建模块区"一致，包括空数据隐藏、未知模块跳过、平铺无分组。

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
- **那么** 结果不含该模块（count 为 0 被过滤）

#### Scenario: 无存档数据时不扣除

- **前提** 无 `archiveStation`
- **当** presenter 计算 effectiveAutoIndustryModules
- **那么** 结果 = `autoIndustryModules` 原始值，不做任何扣除

---

### Requirement: 点击已建/在建区添加模块

已建模块区和在建模块区中的模块 item SHALL 以 `readonly` 模式渲染，且数字可点击（非 `noClick`）。点击数字时：
- 默认数量 `default_count = archive.modules[moduleId] + archive.building.modules[moduleId]`
- 若 plannedModules 中**不含**该模块 → 以 `{ id: moduleId, count: default_count }` 添加到 plannedModules
- 若 plannedModules 中**已含**该模块：
  - 且 `planned.count < default_count` → 将该模块 count 提升至 `default_count`
  - 且 `planned.count >= default_count` → 不做任何操作

#### Scenario: 已建区点击添加新模块

- **前提** 已建模块区显示 `{ id: "solar", count: 4 }`，在建模块区显示 `{ id: "solar", count: 1 }`，plannedModules 不含 solar
- **当** 用户点击已建区 solar 的数字
- **那么** plannedModules 新增 `{ id: "solar", count: 5 }`

#### Scenario: 已建区点击提升已有模块

- **前提** plannedModules 含 `{ id: "solar", count: 2 }`，存档总量 = 4 + 1 = 5
- **当** 用户点击已建区或在建区的 solar 数字
- **那么** plannedModules 中 solar 的 count 变为 5

#### Scenario: 已建区点击不重复添加

- **前提** plannedModules 含 `{ id: "solar", count: 6 }`，存档总量 = 4 + 1 = 5
- **当** 用户点击已建区或在建区的 solar 数字
- **那么** plannedModules 中 solar 的 count 保持 6，不做任何变更

---

### Requirement: 搜索框添加默认数量

从 `StationModulePicker` 搜索框添加模块时：
- 若 plannedModules **不含**该模块 → 默认 count = `archive.modules[moduleId] + archive.building.modules[moduleId]`（存档总量），若无存档数据则为 1
- 若 plannedModules **已含**该模块 → 每次增量 `count + 1`（现有行为不变）

#### Scenario: 搜索添加新模块有存档数据

- **前提** 存档中 module_hull_01 已建 3、在建 1，plannedModules 不含此模块
- **当** 用户从搜索框选择 module_hull_01
- **那么** plannedModules 新增 `{ id: "module_hull_01", count: 4 }`

#### Scenario: 搜索添加已存在模块

- **前提** plannedModules 含 `{ id: "solar", count: 3 }`
- **当** 用户从搜索框选择 solar
- **那么** plannedModules 中 solar 的 count 变为 4（+1）

---

### Requirement: 红色阈值警告

对于 `plannedModules` 中所有模块，若 `planned.count < archive_total`（存档总量），该模块的计数 SHALL 以红色渲染。

#### Scenario: 规划数量低于存档总量

- **前提** 存档总量 solar = 5，plannedModules 含 `{ id: "solar", count: 3 }`
- **当** 规划器渲染 solar 项
- **那么** solar 的 count 数字显示为红色

#### Scenario: 规划数量不低于存档总量

- **前提** 存档总量 solar = 5，plannedModules 含 `{ id: "solar", count: 10 }`
- **当** 规划器渲染 solar 项
- **那么** solar 的 count 数字显示为默认颜色（非红色）

#### Scenario: 无存档数据

- **前提** 无 `archiveStation`
- **当** 规划器渲染所有 planned 模块
- **那么** 所有 count 数字显示为默认颜色，无红色警告
