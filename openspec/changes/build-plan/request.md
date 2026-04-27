# build-plan 需求

## 目标

在 Blueprint 的星区总览视图（overview）中新增产能爬坡建造规划功能。用户设定时间预算和金钱预算后，系统根据用户指定的多个建造目标，自动规划模组建造顺序，包含前置产能依赖链，并显示预计所需时间和金钱花费。

## 已确认方案（审核重点）

### 目标类型（列表，可多个）

- **自举（self-sufficient）**：以 Claytronics + Hull Parts 达到正净产出为终点。无额外参数。
- **目标产量（production-rate）**：要求指定 ware 的净产出率达到 N/小时。参数：`wareId` + `ratePerHour`。
- **目标建筑（build-module）**：要求建造指定数量的某个模块及其前置链。参数：`moduleId` + `count`。
- **舰队（fleet）**：占位接口，本次不实现。

### 约束模型

- **时间预算 T**：所有建造步骤中模块 buildTime 的累计上限。材料凑齐时间不单独计算（材料凑齐时间由产能自动产出决定，不计入 T）。
- **金钱预算 C**：从 NPC 购买材料的 credits 累计上限。零产能时全部材料从 NPC 购买，自产后自产部分不花钱。采用 ware 的 `price` 字段作为买入价。

### 算法原则

- 从目标列表递归展开上游产能依赖链。
- 贪婪瓶颈优先：始终选择当前瓶颈最大的 ware，建造其最优生产模块。
- 金钱效率权衡：在瓶颈相当的候选中，优先选择金钱消耗更低的模块。
- 逐步模拟：每建完一个模块后更新产能，重新评估瓶颈，决定下一步。
- 当所有目标达成或时间/金钱任一耗尽时停止。

### UI 布局

- **位置**：Blueprint 的 overview 视图（无 station 选中时自动显示）。
- **Tab**：名称为"星区总览"（复用现有 `sector.overview` i18n key），图标为 playerHQ（与 live 的 overview tab 一致）。
- **比例**：`lg:col-span-3` / `lg:col-span-4` / `lg:col-span-5`（3:4:5）。
- **左面板**：约束条件（目标列表添加/删除、时间预算、金钱预算、重新计算按钮、步骤进度条）。
- **中面板**：建造计划步骤列表（每步显示模块名、材料清单、预计耗时、金钱花费）。
- **右面板**：总产能汇总（复用现有 `EmpireWareFlowsDashboard` 控件）。

### Store / Helper 架构

- Store 接口放在 `useBlueprintProductionStore`（修改现有 store）。
- 计算逻辑作为纯函数 helper `/src/store/logic/calculateBuildPlan.ts`。
- Store 提供对外接口（actions）、成员状态、computed 计算结果。
- Helper 通过参数对象接收所需数据，不绑定 store。

### Presenter / Component

- 新 presenter：`useBuildPlanPresenter`。
- 新组件：`BuildPlanPanel.vue`（中面板）、`BuildPlanConstraintsPanel.vue`（左面板）。
- 右面板复用现有 `EmpireWareFlowsDashboard.vue`。

## 边界

### In Scope

- 三种目标类型（自举、目标产量、目标建筑）的建造计划生成。
- 时间预算和金钱预算双约束。
- NPC 购买材料的价格计算（ware.price）。
- 贪婪瓶颈优先的规划算法。
- 替代现有 blueprint overview 空白内容的 UI 面板（左约束 / 中计划 / 右产能）。
- Store → Presenter → Component 三层架构。

### Out of Scope

- 舰队目标（fleet）的完整实现（仅保留类型占位接口）。
- 地球改造目标（缺少游戏数据）。
- 并行建造（多模块同时建造）模拟。
- 规划结果的持久化存储。
- 舰队配装方案（equipment）的展开计算。

## 验收标准（DoD）

1. Blueprint overview 视图显示新的 3:4:5 面板布局（左约束/中计划/右产能）。
2. 用户可添加多种类型的目标（自举、产量、建筑），以列表形式管理。
3. 用户可设定时间预算和金钱预算。
4. 系统根据目标和约束生成建造计划步骤列表。
5. 每个步骤显示模块名称、材料清单、预计耗时、金钱花费。
6. 目标全部达成或时间/金钱耗尽时停止生成步骤并给出提示。
7. 自举目标以 Claytronics + Hull Parts 正净产出为终止条件。
8. 右面板通过 EmpireWareFlowsDashboard 显示所有 station 的 net ware flow 汇总。
9. 无 TypeScript 编译错误。
10. 构建通过（`npm run build`）。

## 未决项

无
