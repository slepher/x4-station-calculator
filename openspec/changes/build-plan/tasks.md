# build-plan 任务

## 任务列表

### T1: 定义类型（BuildGoal / BuildConstraints / BuildPlan）[x]

- 新建 `src/types/build-plan.ts`
- 定义 `BuildGoal` union type（self-sufficient、production-rate、build-module、fleet占位）
- 定义 `BuildConstraints`（timeBudget、creditBudget、goals）
- 定义 `BuildMaterial`、`BuildStep`、`BuildPlan`
- 定义 `CalculateBuildPlanInput` / `CalculateBuildPlanOutput`
- 文件: `src/types/build-plan.ts`

### T2: 实现算法 helper（calculateBuildPlan）[x]

- 文件: `src/store/logic/calculateBuildPlan.ts`
- 参数对象模式，不绑定 store
- 实现两阶段轮建造算法：

  **Phase 1 - 初始产线**：
  - 用 `planProducerGroup('hullparts')` 建造 1 条 hullparts 产线（含上游），tier 升序
  - 不建 claytronics，不建完整自给自足链

  **Phase 2 - 建筑材料满足度填补 (buildmat)**：
  - 循环直到时间耗尽：
    a. 计算已建模块总耗时 T
    b. 对每种 buildCost 物资，算每小时消耗率 R = 总消耗量 / T
    c. 算当前自产率 P（net production from currentModules）
    d. 满足度 S = P / R
    e. 选 S 最低的建材，调用 `planProducerGroup(wareId)`：
       - 添加 1 座该物资的生产者
       - 递归补足 production input 缺口
    f. 按 tier 升序建造该产线组

  **planProducerGroup**：
  - 基于 currentModules 规划 1 个产线组（1 生产者 + 所需上游）
  - 迭代补足所有 production input（最多 20 次），直到闭环

  **停止**：时间耗尽（不等于失败）
  **金钱**：仅加速（NPC 买），耗尽后自产不停止

### T3: 扩展 useBlueprintProductionStore [x]

- 新增 state：`buildConstraints`（Ref<BuildConstraints>）、`buildPlan`（Ref<BuildPlan | null>）
- 新增 computed：`empireModules`（所有 station 的 SavedModule 汇总）
- 新增 actions：`setBuildGoal()`、`removeBuildGoal()`、`setTimeBudget()`、`setCreditBudget()`、`computePlan()`
- `computePlan` 调用 `calculateBuildPlan` helper
- 文件: `src/store/useBlueprintProductionStore.ts`

### T4: 实现 presenter（useBuildPlanPresenter）[x]

- 新建 `src/components/empire/presenters/useBuildPlanPresenter.ts`
- 返回 props：goals、constraints、buildPlan、progress、warnings、currentFlows
- 返回 emits：addGoal、removeGoal、setTimeBudget、setCreditBudget、computePlan
- 负责将 store 数据转为 UI 展示结构（进度百分比、警告文本等）

### T5: 实现约束面板（BuildPlanConstraintsPanel.vue）[x]

- 新建 `src/components/empire/BuildPlanConstraintsPanel.vue`
- 显示目标列表（可添加/删除目标行）
- 目标类型下拉（自举 / 目标产量 / 目标建筑）
- 目标产量：ware 搜索 + 产出率输入
- 目标建筑：模块搜索 + 数量输入
- 时间预算输入（小时）
- 金钱预算输入（credits）
- 计算按钮
- 进度条（已完成/总步数）

### T6: 实现建造计划面板（BuildPlanPanel.vue）[x]

- 新建 `src/components/empire/BuildPlanPanel.vue`
- 显示建造步骤列表（有序）
- 每行：步骤序号、模块名、预计耗时、累计花费
- 可展开/折叠的材料清单详情
- 停止提示（若因预算耗尽而中断）
- 空状态提示（未计算时）

### T7: 修改 BlueprintProductionWorkbenchView [x]

- 将 overview 模式渲染从当前空面板改为新面板
- 左面板：`BuildPlanConstraintsPanel`
- 中面板：`BuildPlanPanel`
- 右面板：`EmpireWareFlowsDashboard`（复用）
- 引入 presenter 并绑定 props/emits
- 文件: `src/components/empire/BlueprintProductionWorkbenchView.vue`

### T8: 构建验证 [x]

- `npm run build` 通过

### T9: 初始化 activeEmpireStation 为 null 时保持在总览 [x]

- `src/store/useBlueprintProductionStore.ts`：`loadEmpire` 中 `storedTabId === null` 时保持 `activeStationId = null`
- 刷新页面时不会自动跳转到第一个 station

## 依赖顺序

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
```

T5 和 T6 可以并行开发。

## 元注释

T1 中 BuildGoal/BuildPlan 类型如果合并到一个文件便于维护，可放在新建的 `src/types/build-plan.ts` 中，保持与 `x4.ts` 的对齐方式一致（`import type` 引用）。
