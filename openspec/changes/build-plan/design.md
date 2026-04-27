# build-plan 设计

## 问题

Blueprint overview 视图当前仅显示导入面板，缺少产能规划和扩展推荐功能。用户无法基于当前产能和时间/金钱预算，获得"该造什么模块、按什么顺序造"的系统化建议。

## 方案

### 1. 目标类型定义

```typescript
type BuildGoal =
  | { type: 'self-sufficient' }
  | { type: 'production-rate'; wareId: string; ratePerHour: number }
  | { type: 'build-module'; moduleId: string; count: number }
  | { type: 'fleet'; shipId: string; quantity: number }  // 占位，本次不实现
```

### 2. 约束和结果类型

```typescript
interface BuildConstraints {
  timeBudget: number       // 时间预算（秒）
  creditBudget: number     // 金钱预算（credits）
  goals: BuildGoal[]
}

interface BuildMaterial {
  wareId: string
  quantity: number          // 需要量
  currentProdRate: number   // 当前每小时净产出
  estimatedTime: number     // 预计凑齐时间（秒）
  creditsNeeded: number     // 需从 NPC 购买的花费
}

interface BuildStep {
  order: number                  // 步骤序号
  moduleId: string               // 要建造的模块 ID
  moduleCount: number            // 建造数量
  moduleBuildTime: number        // 模块自身建造时间（秒）
  materials: BuildMaterial[]     // 所需材料清单
  estimatedDuration: number      // 累计耗时
  estimatedCredits: number       // 累计金钱花费
  reason: string                 // 推荐原因（消除哪个瓶颈）
}

interface BuildPlan {
  goals: BuildGoal[]
  constraints: BuildConstraints
  steps: BuildStep[]
  totalDuration: number
  totalCredits: number
  goalsAchieved: BuildGoal[]
  goalsRemaining: BuildGoal[]
  halted: boolean                // 是否因时间/金钱耗尽而停止
  haltReason: string             // 停止原因
}
```

### 3. 算法（`calculateBuildPlan`）

**位置**: `src/store/logic/calculateBuildPlan.ts`

**输入**:
```typescript
interface CalculateBuildPlanInput {
  goals: BuildGoal[]
  timeBudget: number
  creditBudget: number
  currentModules: SavedModule[]            // 当前所有 station 的模块汇总
  settings: StationSettings                // 当前全局设置
  modulesMap: Record<string, X4Module>      // 游戏模块数据
  waresMap: Record<string, X4Ware>         // 游戏物品数据
  modulesByOutputMap: Record<string, X4Module[]>
}
```

**输出**: `BuildPlan`

**算法流程**:

```
Phase 1 - 初始产线：
  用 planProducerGroup('hullparts') 建造 1 条 hullparts 产线（含上游），tier 升序

Phase 2 - 建筑材料满足度填补 (buildmat)：
  循环直到时间耗尽：
  a. 计算已建模块的总建造耗时 T（所有 step 的 moduleBuildTime 之和）
  b. 对每种建筑物资（buildCost 中的物资），计算每小时消耗率 R = 总消耗量 / T
  c. 对每种建筑物资，计算当前每小时自产率 P（net production）
  d. 满足度 S = P / R（最低者为最紧缺）
  e. 选 S 最低的建筑物资，用 planProducerGroup(wareId) 规划 1 个产线组：
     - 添加 1 座该物资的生产者模块
     - 迭代检查生产者及其上游的 production input 缺口，补足上游模块
  f. 按 tier 升序建造该产线组
  g. 回到步骤 a

停止条件：时间预算耗尽（预算耗尽 ≠ 失败）
金钱预算：仅作为加速（NPC 购买），耗尽后等待自产不停止
```

**planProducerGroup 逻辑**：
```
输入：targetWare（建筑材料 ID）
1. currentModules 基础上添加 1 座该物资的生产者
2. 反复扫描所有计划内模块的 production inputs：
   - 若某 input 的 net production < 0（有缺口）
   - 找到该 input 的最佳生产者，添加入计划
3. 直到所有 input 缺口闭合（最多 20 次迭代）
4. 返回 currentModules 中尚未建造的模块队列（按 tier 升序）
```

**UI 步骤显示**：
- 同一批内连续的相同模块合并显示（如 Energy Cell Production ×3）
- 每步显示增量：`+N = Total`（N=本次建造数，Total=该模块累计总数）
- 展开后显示该步骤的建筑材料清单及 NPC 购买费用

**停止与预算语义**：
- `halted` 仅用于算法级失败，不因预算耗尽而置为 true
- 时间耗尽：正常结束
- 金钱耗尽：继续自产，速度降低

### 4. Store 变更

**文件**: `src/store/useBlueprintProductionStore.ts`

新增内容：
- `state.buildConstraints: Ref<BuildConstraints>` — 目标列表和预算
- `state.buildPlan: Ref<BuildPlan | null>` — 计算结果
- `computed.empireModules: SavedModule[]` — 所有 station 的模块汇总
- `action.setGoal()` / `action.removeGoal()` / `action.setBudget()` — 目标管理
- `action.computeBuildPlan()` — 调用 `calculateBuildPlan` helper 并更新 `buildPlan`

### 5. Presenter 层

**文件**: `src/components/empire/presenters/useBuildPlanPresenter.ts`

```
useBuildPlanPresenter(store)
  → props:
      goals: BuildGoal[]
      constraints: BuildConstraints
      buildPlan: BuildPlan | null
      progress: { completed, total, percentage }
      warnings: string[]
      currentFlows: EmpireGroupedFlows | null  (传给右面板)
  → emits:
      addGoal(goal)
      removeGoal(index)
      setTimeBudget(seconds)
      setCreditBudget(credits)
      computePlan()
```

### 6. 组件层

| 组件 | 宽度 | 职责 |
|------|------|------|
| `BuildPlanConstraintsPanel.vue` | `lg:col-span-3` | 目标列表 CRUD、时间/金钱输入、计算按钮、进度条 |
| `BuildPlanPanel.vue` | `lg:col-span-4` | 建造步骤列表，每行可展开材料详情 |
| `EmpireWareFlowsDashboard.vue` | `lg:col-span-5` | 复用现有组件，显示所有 station 的 net flow |

### 7. BlueprintProductionWorkbenchView 变更

在 `workbenchMode === 'overview'` 时渲染新面板：

```vue
<div v-else class="main-layout mt-6">
  <div class="col-span-12 lg:col-span-3">
    <BuildPlanConstraintsPanel ... />
  </div>
  <div class="col-span-12 lg:col-span-4">
    <BuildPlanPanel ... />
  </div>
  <div class="col-span-12 lg:col-span-5">
    <EmpireWareFlowsDashboard ... />
  </div>
</div>
```

## 数据流

```
用户操作（添加目标 / 修改预算）
  ↓
Presenter.emits → Store.action
  ↓
Store 更新 buildConstraints
  ↓
用户点"计算"
  ↓
Store.computeBuildPlan()
  → 读取 empireModules（所有 station 模块汇总）
  → 调用 calculateBuildPlan({ goals, timeBudget, creditBudget, currentModules, ... })
  → 更新 state.buildPlan
  ↓
Presenter.props 重新计算
  ↓
BuildPlanPanel 渲染步骤列表
EmpireWareFlowsDashboard 渲染产能总览
```

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/store/logic/calculateBuildPlan.ts` | **新增**：纯函数 helper |
| `src/store/useBlueprintProductionStore.ts` | **修改**：新增 buildConstraints/buildPlan state，新增 empireModules computed，新增 actions |
| `src/components/empire/presenters/useBuildPlanPresenter.ts` | **新增**：presenter |
| `src/components/empire/BuildPlanPanel.vue` | **新增**：建造计划面板 |
| `src/components/empire/BuildPlanConstraintsPanel.vue` | **新增**：约束条件面板 |
| `src/components/empire/BlueprintProductionWorkbenchView.vue` | **修改**：overview 模式渲染新面板 |
| `src/types/x4.ts` 或 `src/types/build-plan.ts` | **新增**：BuildGoal / BuildConstraints / BuildPlan 等类型 |
