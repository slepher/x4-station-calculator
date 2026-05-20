# 实况产能规划 — planned vs archive 差异可视化增强

## 目标

在实况产能规划模式（live production workbench）的模组规划器中，让用户直接看出 `plannedModules` 与存档模块总量（`built + building`）之间的差异，并把需要补齐的 orphan 模块集中到一个可折叠的建议区里，降低在 planned、auto、archive 三块区域之间来回对照的成本。

本次增强是在现有 `live-planning-modules` 能力之上继续演进，**保留**搜索默认数量、红色阈值警告，以及 `calculateAutoFillModules` 的参考模块优先级逻辑；auto 区不切换为 `max` 主数字，而是继续显示 auto 原始数量，并通过红色 count 与名称后 `+/-N` 弱化差异表达 archive 对照关系。

## 术语澄清

- 本 change 中如果讨论“有效模块集合 / effective modules”，指的是用于 planning / flow 语义对照的模块集合：
  - `max(plannedModules + autoModules, archive.modules + archive.building.modules)`
- 这里的 `max` 指按 `moduleId` 逐项取更大的 count，而不是数组长度比较。
- 这一定义**不是** `StationDashboard` 中用于 building scope 展示的 `effectiveModules` prop。
- `StationDashboard` 那套 `effectiveModules` 属于另一个 change 的能力边界，本 change 不讨论也不修改它。

## 已确认方案（审核重点）

### 1. 总体布局

- **触发条件**：`visualMode === 'planning'` 且存档数据（`archiveStation`）存在。
- **布局顺序**：
  1. `planned` 区
  2. `recommendedModules` 建议区
  3. `auto` 各区
  4. `<hr>`
  5. archive 参考区
- archive 区仍保留，职责是**纯参考**，不承载 orphan 提示。

### 2. planned 区差异表达

- 对 `plannedModules` 中的每个模块，都以 `archive_total = archive.modules + archive.building.modules` 作为对照基准。
- 若 `planned.count > archive_total`：
  - 在**模块名称后**显示弱化的 `+N`
  - `N = planned.count - archive_total`
  - 表达“当前规划数量比 archive 多了多少”
- 若 `planned.count = archive_total`：不显示额外标记。
- 若 `planned.count < archive_total`：
  - count 数字保持红色告警
  - 红色只表达“低于 archive 总量”，不复用 `+N`
- `+N` 与红色告警条件互斥，不存在同位冲突。

### 3. recommendedModules 建议区

- 建议区位于 `planned` 与 `auto` 之间。
- 默认**折叠**。
- 样式参照 `auto` 区，使用虚线前置，表示这是提示区而不是正式规划区。
- 折叠态只显示：
  - 标题
  - 推荐模块**种类数**
- 展开后显示推荐模块列表。

### 4. recommendedModules 的生成规则

- `recommendedModules` 不是简单的 archive-only 列表。
- 仅当某模块同时满足以下条件时，才进入建议区：
  - `planned.count < archive_total`
  - 该模块满足 orphan 判定
- 建议区显示的数量为差额：
  - `recommended_count = archive_total - planned.count`
- `planned` 中不存在该模块时，视为 `planned.count = 0`。
- orphan 不在 archive 区额外显示，也不使用独立图标。
- `recommendedModules` 中的模块与 archive 区模块一样可点击。
- 点击行为与 archive 模块保持一致：
  - 若 `plannedModules` 中不存在该模块，则以 `archive_total` 作为 count 加入
  - 若 `plannedModules` 中已存在且 `planned.count < archive_total`，则提升到 `archive_total`
  - 若 `plannedModules` 中已存在且 `planned.count >= archive_total`，则不做变更

### 5. orphan 判定规则

- 判定输入集合为 `built + building`。
- 若某模块的**任一产出**，在 archive 中**其他模块**里不存在“模块本身消费关系”，则视为 orphan。
- 只看模块本身的消费关系，不看工人等非模块消耗。
- 不考虑闭环模块场景。

### 6. archive 区行为

- archive 区保留在 `auto` 区下方，作为纯参考区。
- archive 区继续展示存档中的 built/building 模块总貌。
- archive 区显示内容与当前实现保持一致，不在本次变更中调整结构与展示方式。
- orphan 不在 archive 区单独高亮，不附加 icon，不承担推荐职责。

### 7. auto 区显示语义改为原始 auto 数量 + 统一差异表达

- **store 层不变**：`deriveFullModules` / `calculateAutoFillModules` 继续产出原始的 `autoIndustryModules`、`autoHabitationModules`、`autoInfrastructureModules`。
- **presenter 层继续以 auto 原始数量作为 auto 区主数字**，不切换为 `max` 后数量。
- 对每个 auto 模块，仍然以 `archive_total = archive.modules + archive.building.modules` 作为对照基准。
- 模块名称后显示 `diffAnnotation`：
  ```ts
  diff = auto_count - archive_total
  ```
- 若 `diff > 0`，名称后显示绿色弱化 `+N`，表达“auto 原始计算比 archive 多了 N”。
- 若 `diff < 0`，名称后显示红色弱化 `-N`，表达“auto 原始计算比 archive 少了 N”。
- 若 `diff = 0`，不显示额外标记。
- 当 `auto_count < archive_total` 时，auto 区的 `count` 主数字使用红色显示，强调“auto 原始计算值小于 archive 当前数量”。
- auto 区与 planned 区统一使用“名称后 `+/-N` 小字表达差异”的模式。

### 8. planned 区补充 -N 逻辑

- planned 区不再只有 `+N`。
- 对 `plannedModules`：
  - `diff = planned.count - archive_total`
  - `diff > 0` 时显示绿色弱化 `+N`
  - `diff < 0` 时显示红色弱化 `-N`
  - `diff = 0` 时不显示差异标记
- `planned.count < archive_total` 时，count 主数字仍保持红色告警。
- 这样 planned 与 auto 的差异表达规则统一为：
  - 主数字显示该区块自己的主数量
  - 名称后显示彩色 `+/-N`

### 9. 减少用户对 auto 数量语义困惑的方案

- 用户最容易困惑的是：
  1. auto 区主数字到底表示什么
  2. 点击 auto 模块后为什么加入到 planned 的数量可能大于当前看到的 auto 数量
- 为减少困惑，本次建议：
  1. auto 分组标题下增加一行短说明，例如“数字为 auto 计算结果，名称后 `+/-N` 为相对现有建筑差异”
  2. 当用户点击 auto 模块加入 planned 时，实际加入数量使用：
     ```ts
     target_count = max(auto_count, archive_total)
     ```
  3. 如现有组件支持 tooltip，可补充：
     - `auto raw = X`
     - `archive current = Y`
     - `click add -> planned = max(X, Y)`
- 该方案的目标是同时回答两个问题：
  - “auto 算出来多少？” → 看主数字
  - “点击后 planned 会补到多少？” → 看 tooltip / 说明中的 `max(auto, archive)`

### 10. 搜索框添加默认数量

- 从 `StationModulePicker` 搜索框添加新模块时：
  - 若模块已在 `plannedModules` 中，每次点击 `count + 1`（现有行为不变）。
  - 若模块不在 `plannedModules` 中，默认数量 = 存档中该模块的 `built + building` 总量。
- 无存档数据时，默认数量保持为 1。

### 11. autoFill 参考模块优先级保留

- `calculateAutoFillModules` 的参考模块优先级方案保持不变。
- live 模式下，参考模块继续取 `archive.modules + archive.building.modules`。
- P1–P8 优先级、按产能计算配额、P1+P2 共享配额的规则全部保留。

### 12. 展开/折叠状态

- `recommendedModules` 的展开/折叠状态存放在 `useLiveProductionStore`。
- 该状态对所有 station 通用，共享同一个运行时状态。
- 该状态**不持久化**。

## 边界

### In Scope

- `plannedModules` 相对 archive 总量的差异标注
- `recommendedModules` 建议区（默认折叠、显示推荐模块种类数、展开列表）
- orphan 判定与 orphan 差额推荐
- archive 区继续保留为纯参考区
- auto 区主数字继续显示 auto 原始计算数量
- auto / planned 区名称后统一显示彩色 `+/-N`
- auto 区点击加入 planned 时使用 `max(auto_count, archive_total)` 作为目标数量
- 搜索框新模块默认数量 = archive 总量
- `plannedModules` 红色阈值警告
- `calculateAutoFillModules` 参考模块优先级保留
- `recommendedModules` 折叠状态的非持久 store 管理

### Out of Scope

- live 模式的 `ArchiveModuleList` 行为变更
- orphan 图标、orphan 在 archive 区的单独视觉提示
- `StationDashboard` 中 building scope 用的 `effectiveModules` prop 改动
- E2E 测试（由独立测试流程负责）

## 验收标准（DoD）

1. 在 planning 模式且存在存档数据时，`plannedModules` 中 `planned.count > archive_total` 的模块会在名称后显示弱化 `+N`。
2. 在 planning 模式且存在存档数据时，`plannedModules` 中 `planned.count < archive_total` 的模块 count 数字显示为红色。
3. 建议区位于 `planned` 与 `auto` 之间，默认折叠，并显示推荐模块种类数。
4. 仅当模块满足 orphan 判定且 `planned.count < archive_total` 时，该模块进入 `recommendedModules`。
5. 建议区中每个推荐模块显示的数量为 `archive_total - planned.count`。
6. `recommendedModules` 中的模块可点击，点击后按 archive 总量加入或提升 `plannedModules`。
7. archive 区仍保留为纯参考区，不显示 orphan 图标或独立 orphan 标记，且沿用当前显示内容不变。
8. 自动模块区主数字继续显示 auto 原始计算数量，而不是 `max` 后数量。
9. 自动模块区在 `auto_count < archive_total` 时，count 主数字显示为红色。
10. planned 与 auto 两个区块的模块名称后都显示彩色 `+/-N`，其中 `+N` 为绿色，`-N` 为红色。
11. 点击 auto 模块加入 planned 时，实际加入数量使用 `max(auto_count, archive_total)`，而不是 auto 当前显示数量。
12. 搜索框添加新模块时，若该模块当前不在 `plannedModules` 中，则默认 count = archive 总量；若已存在，仍每次 `+1`。
13. `calculateAutoFillModules` 在 live 模式下继续按既有 P1–P8 优先级和配额规则运行。
14. `recommendedModules` 的展开/折叠状态在 `useLiveProductionStore` 中共享，但刷新后不保留。

## 未决项

无。
