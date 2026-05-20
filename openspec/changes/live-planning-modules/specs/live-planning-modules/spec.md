# Live Planning Modules Specification

## Purpose

在实况产能规划模式下，模组规划器 SHALL 同时提供 planned 与 archive 的差异表达、orphan 模块建议区、auto 模块的原始 auto 数量与彩色 `+/-N` 差异表达，以及保留既有 archive 参考区和 autoFill 参考模块优先级，使用户能够更快识别哪些模块已超出存档、哪些 orphan 模块仍需补齐。

## Terminology

- 本 spec 若提到“有效模块集合 / effective modules”，指 planning / flow 语义中的模块集合：
  - `max(plannedModules + autoModules, archive.modules + archive.building.modules)`
- `max` SHALL 表示按 `moduleId` 逐项比较 count 并取较大值。
- 本术语 SHALL NOT 指向 `StationDashboard` 中 building scope 使用的 `effectiveModules` prop。

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
- **并且** 模块名称后显示红色弱化的 `-3`

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

### Requirement: Auto Modules Must Display Raw Auto Count With Colored Diff Annotation

Presenter 层 SHALL 为 `autoIndustryModules`、`autoHabitationModules`、`autoInfrastructureModules` 计算两层显示语义：
- 主数字：`auto_count`
- 名称后差异：`diff = auto_count - archive_built_count - archive_building_count`

store 层的 `autoIndustryModules` 等保持原始完整数值不变。

#### Scenario: auto count is lower than archive total

- **前提** `autoIndustryModules` 含 `{ id: "module_hull_01", count: 3 }`
- **并且** 存档中该模块已建 5、在建 0
- **当** presenter 计算 auto 区显示数据
- **那么** auto 区主数字显示为 `3`
- **并且** count 数字显示为红色
- **并且** 模块名称后显示红色弱化的 `-2`

#### Scenario: auto count is higher than archive total

- **前提** `autoIndustryModules` 含 `{ id: "module_hull_01", count: 5 }`
- **并且** 存档中该模块已建 3、在建 1
- **当** presenter 计算 auto 区显示数据
- **那么** auto 区主数字显示为 `5`
- **并且** 模块名称后显示绿色弱化的 `+1`

#### Scenario: auto section uses the same colored name-side diff style as planned section

- **前提** auto 区和 planned 区都存在差异展示
- **当** 规划器渲染模块项
- **那么** 两个区块都将差异值显示在模块名称后
- **并且** `+N` 使用绿色
- **并且** `-N` 使用红色

### Requirement: Clicking Auto Module Must Add Max Of Auto Count And Archive Total To Planned

系统 SHALL 使用 `max(auto_count, archive_total)` 作为 auto 模块点击加入 planned 时的目标数量，而不是使用 auto 当前显示数量。

#### Scenario: click auto adds archive-preserving target count

- **前提** `autoIndustryModules` 含 `{ id: "module_hull_01", count: 3 }`
- **并且** archive 总量 `module_hull_01 = 5`
- **当** 用户点击 auto 区中的该模块
- **那么** 加入或提升到 `plannedModules` 的目标数量为 `5`

### Requirement: Diff Annotation Must Disappear When Difference Returns To Zero

当某模块的差异数量从非零回到零时，系统 SHALL 移除对应的 `diffAnnotation`，不得保留过期的 `+N` 或 `-N`。

#### Scenario: planned diff annotation is removed when +1 returns to zero

- **前提** 某个 planned 模块之前显示绿色弱化的 `+1`
- **并且** 用户调整该模块数量后使其与 `archive_total` 相等
- **当** 规划器重新渲染该模块项
- **那么** 原先的 `+1` 必须消失
- **并且** 模块名称后不再显示差异标记

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

---

### Requirement: Auxiliary Auto Modules Must Also Use Archive-aware Reference Priority

在 live 模式下，辅助 auto 模块的候选选择 SHALL 也参考 `archive.modules + archive.building.modules`，而不只是参考 planned/existing 或数据库默认候选。

这条规则覆盖：

- storage 模块
- habitation 模块
- pier 模块

该 requirement 复用的是“参考模块优先”的候选来源语义，而不是工业模块的 ware 产出配额语义。

#### Scenario: storage modules prefer archive/building reference candidates

- **前提** 当前需要补 container storage 容量
- **并且** archive/building 中存在某个 container storage 模块
- **当** 系统选择 storage 候选模块
- **那么** 应优先从 archive/building 中出现过的 container storage 候选中选择
- **并且** 不应直接跳到数据库默认最大仓储模块

#### Scenario: habitation modules prefer archive/building reference candidates

- **前提** 当前需要补 habitation 容量
- **并且** archive/building 中存在 habitation 模块
- **当** 系统选择 habitation 候选模块
- **那么** 应优先从 archive/building 中出现过的 habitation 候选中选择

#### Scenario: pier modules prefer archive/building reference candidates

- **前提** 当前需要补泊位
- **并且** archive/building 中存在 pier 模块
- **当** 系统选择 pier 候选模块
- **那么** 应优先从 archive/building 中出现过的 pier 候选中选择

---

### Requirement: Auxiliary Reference Selection Must Use Category-specific Capability Metrics

系统在比较辅助模块候选优劣时 SHALL 按模块类别使用不同能力维度，而不是沿用工业模块的产出 ware 指标。

#### Scenario: storage candidates are compared by cargo capacity

- **前提** 存在多个 container storage 候选
- **当** 系统比较这些 storage 候选
- **那么** 应按 `cargo.capacity` 作为能力比较维度

#### Scenario: habitation candidates are compared by workforce capacity

- **前提** 存在多个 habitation 候选
- **当** 系统比较这些 habitation 候选
- **那么** 应按 `workforce.capacity` 作为能力比较维度

#### Scenario: pier candidates are compared by berth capacity

- **前提** 存在多个 pier 候选
- **当** 系统比较这些 pier 候选
- **那么** 应按 `dockingCount` / 泊位能力作为能力比较维度

---

### Requirement: Auxiliary Reference Selection Must Preserve Existing Gap-to-count Semantics

辅助模块的 reference-aware priority SHALL 只影响候选模块的选择顺序，不改变各类辅助模块原有的缺口换算方式。

#### Scenario: storage gap still converts to count by storage capacity

- **前提** 当前需要补齐 container storage 容量
- **当** 系统完成 storage 自动选择
- **那么** 仍按容量缺口换算 storage 模块数量
- **并且** reference-aware priority 只影响“选哪种 storage”

#### Scenario: habitation gap still converts to count by workforce capacity

- **前提** 当前需要补齐 habitation 工人容量
- **当** 系统完成 habitation 自动选择
- **那么** 仍按工人容量缺口换算 habitation 模块数量
- **并且** reference-aware priority 只影响“选哪种 habitation”

#### Scenario: pier gap still converts to count by berth capacity

- **前提** 当前需要补齐泊位
- **当** 系统完成 pier 自动选择
- **那么** 仍按泊位缺口换算 pier 模块数量
- **并且** reference-aware priority 只影响“选哪种 pier”

---

### Requirement: Auto Industry Count Must Not Depend On Final Workforce Result

系统 SHALL 将 `autoIndustryModules` 的数量计算建模为“由 `considerWorkforceForAutoFill` 开关决定的理论效率估算”，而不是依赖第二阶段算出的最终实际工人数量。

#### Scenario: workforce toggle on uses full-efficiency assumption for industry sizing

- **前提** `considerWorkforceForAutoFill = true`
- **当** 系统计算 `autoIndustryModules`
- **那么** 应按带工人加成的理论效率估算工业模块数量
- **并且** 不读取第二阶段最终 `actualWorkforce`

#### Scenario: workforce toggle off uses empty-efficiency assumption for industry sizing

- **前提** `considerWorkforceForAutoFill = false`
- **当** 系统计算 `autoIndustryModules`
- **那么** 应按无工人加成的理论效率估算工业模块数量
- **并且** 不读取第二阶段最终 `actualWorkforce`

---

### Requirement: Live Planning Final Result Must Use Two-stage Evaluation

系统 SHALL 以二阶段顺序生成 live planning 的最终结果，而不是把 habitation / infrastructure 混入第一阶段工业自动补全。

#### Scenario: stage one calculates only autoIndustryModules

- **前提** planning 站点进入自动补全计算
- **当** 系统执行第一阶段
- **那么** 第一阶段只产生 `autoIndustryModules`
- **并且** 不在此阶段产出最终 `autoHabitationModules`
- **并且** 不在此阶段产出最终 `autoInfrastructureModules`

#### Scenario: stage two recalculates final flow after habitation is added

- **前提** 第一阶段已得到 `autoIndustryModules`
- **当** 系统执行第二阶段
- **那么** 系统先确定 `canonicalBaseModules = max(planned + autoIndustry, archive.modules + archive.building.modules)`
- **并且** 基于这份 `canonicalBaseModules` 计算 `autoHabitationModules`
- **并且** 再基于 `canonicalBaseModules + autoHabitation` 重算最终 `productionFlows`
- **并且** 最终 `actualWorkforce` 与 `currentEfficiency` 来自这次重算后的结果

#### Scenario: habitation sizing must follow canonical base instead of pre-canonical base

- **前提** archive 中某生产模块数量大于当前 `planned + autoIndustry` 的数量
- **当** 系统在第二阶段计算 `autoHabitationModules`
- **那么** habitation 数量应按 canonical 的 `max(...)` 生产模块基准补齐
- **并且** 不得继续按较小的 `planned + autoIndustry` 基准补齐

#### Scenario: infrastructure uses final flow from stage two

- **前提** 第二阶段已得到最终 `productionFlows`
- **当** 系统计算 `autoInfrastructureModules`
- **那么** 应基于这份最终 `productionFlows` 计算仓储与港口需求
- **并且** 不得再回头修改 `autoIndustryModules`

---

### Requirement: Two-stage Derivation Boundary Must Not Be Confused With Cache-layer Boundary

系统 SHALL 区分“station 业务推导阶段”与“缓存真源层 / 当前站展示层”的边界；不得把前者误实现成后者。

#### Scenario: aggregation must continue to read final canonical planning flow

- **前提** planning + archive 场景下，station 已完成产业推导阶段与支撑推导阶段
- **当** transit / sector / empire 聚合继续读取 planning flow
- **那么** 聚合必须读取缓存真源层中的最终 canonical planning flow
- **并且** 不得退回去读取只完成产业推导阶段的中间 flow

#### Scenario: current station display layer must not own a second aggregation truth

- **前提** 当前 active station 需要展示 `autoHabitationModules`、最终 `productionFlows` 与 `autoInfrastructureModules`
- **当** 系统组装当前站展示态
- **那么** 展示层可以复用或补充最终结果
- **并且** 不得让展示层独占一套与缓存真源层不同的 flow 真相

---

### Requirement: Blueprint Final Result Must Match Two-stage Semantics

blueprint 视图的最终展示结果 SHALL 与 live planning 的二阶段求值语义一致，即使内部仍允许拆成两步计算。

#### Scenario: blueprint exposes the same final habitation and infrastructure semantics

- **前提** blueprint 与 live 使用同一站点配置和同一计算规则
- **当** 系统生成 blueprint 侧最终展示数据
- **那么** blueprint 侧最终 `autoHabitationModules`、最终 `productionFlows`、`autoInfrastructureModules` 的语义应与 live 相同
- **并且** 不得因为内部拆成两步而改变最终结果

#### Scenario: storage count is still derived from capacity deficit

- **前提** 系统已经算出 container storage 容量缺口
- **当** 系统使用 reference-aware priority 选中 storage 模块
- **那么** 最终 `count` 仍按容量缺口换算

#### Scenario: habitation count is still derived from workforce deficit

- **前提** 系统已经算出 habitation 容量缺口
- **当** 系统使用 reference-aware priority 选中 habitation 模块
- **那么** 最终 `count` 仍按工人容量缺口换算

#### Scenario: pier count is still derived from berth deficit

- **前提** 系统已经算出泊位缺口
- **当** 系统使用 reference-aware priority 选中 pier 模块
- **那么** 最终 `count` 仍按泊位缺口换算
