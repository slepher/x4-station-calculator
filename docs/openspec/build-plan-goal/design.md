# build-plan-goal 设计

## 目标

为 build-plan 建立完整的目标体系：BuildGoal 类型、方案持久化、Fleet goal、logic-flow 绑定与隔离、产线自动分配。

## 领域术语

| 术语 | 含义 |
|------|------|
| BuildGoal | 用户设置的建造目标，含 production-rate / build-module / fleet 三种类型 |
| FleetEntry | Fleet goal 中的单条蓝图配方引用 |
| buildTime | Fleet 建造时间（秒），默认 3600，最小 600 |
| shipyardCount | 各类型船厂数量，默认 1，最小 1 |
| 船厂分组 | 按 ship.class 分为大型船厂(ship_l)、超大型船厂(ship_xl)、船坞(ship_m+ship_s) |
| effectiveBuildTime | 由 buildTimeMode 决定：actual→actualTotalBuildTime，planned→buildTime |
| buildTimeMode | Fleet 建造时间模式：`'actual'`（实际）或 `'planned'`（规划），默认 `'actual'` |
| SavedBuildPlanGoalsState | 方案持久化结构 |
| logicFlowPlanId | 建造目标方案关联的逻辑产线方案 id |
| 无规划 | logicFlowPlanId = null 的合法方案状态，表示所有目标直接进入待规划产线 |
| ResolvedBuildPlanLogicFlowState | build-plan 解析 logic-flow 输入后的快照状态 |
| 产线分配 | 将 goal 按三级匹配分配到 logic-flow 产线 |
| 派生 goal | 系统自动生成的 derived-rate 目标，补全 upstream isolated 节点 |

## 数据模型

### BuildGoal

```typescript
export type BuildGoal =
  | { type: 'production-rate'; wareId: string; ratePerHour: number }
  | { type: 'build-module'; moduleId: string; count: number }
  | { type: 'fleet'; buildTime: number; buildTimeMode: 'actual' | 'planned'; entries: FleetEntry[]; shipyardLCount: number; shipyardXLCount: number; wharfCount: number }
```

### Fleet 视图对象

```typescript
export interface FleetShipyardGroup {
  type: 'shipyard_l' | 'shipyard_xl' | 'wharf'
  label: string
  shipyardCount: number
  entries: FleetEntryView[]
  groupTotalBuildTime: number
}

export interface FleetGoalView {
  buildTime: number
  buildTimeMode: 'actual' | 'planned'
  shipyardLCount: number
  shipyardXLCount: number
  wharfCount: number
  groups: FleetShipyardGroup[]
  actualTotalBuildTime: number
  effectiveBuildTime: number
  mergedRates: FleetMergedRate[]
}

export interface FleetEntryView {
  shipId: string; shipName: string
  blueprintId: string; blueprintName: string
  quantity: number
  buildTime: number
  totalBuildTime: number
  materials: { wareId: string; wareName: string; totalQty: number }[]
  isBlueprintMissing: boolean
}

export interface FleetMergedRate {
  wareId: string; wareName: string; totalQty: number; ratePerHour: number
}
```

### 方案持久化

```typescript
export interface SavedBuildPlanGoalsState {
  version: number
  activeId: string | null
  list: BuildPlanGoalSnapshot[]
}

export interface BuildPlanGoalSnapshot {
  id: string
  name: string
  buildGoals: BuildGoal[]
  logicFlowPlanId: string | null
  lastUpdated: number
}
```

### Logic-Flow Snapshot 解析

```typescript
export interface LogicFlowPlanSnapshot {
  planId: string | null
  groups: ProductionLineGroup[]
  buildFlowView: BuildFlowPlanView | null
  buildFlowAssignments: BuildFlowAssignment[]
  buildFlowVirtualEdges: BuildFlowVirtualEdge[]
}

export interface ResolvedBuildPlanLogicFlowState {
  requestedPlanId: string | null
  resolvedPlanId: string | null
  source: 'active-store' | 'rebuilt-plan' | 'none'
  snapshot: LogicFlowPlanSnapshot | null
}
```

### 产线分配

```typescript
export interface ProductionLineAllocation {
  groupId?: string
  groupName: string
  isUnmatched: boolean
  goals: BuildGoal[]
}
```

## Store 设计

### useBuildPlanStore 新增字段

```typescript
const savedPlans = ref<SavedBuildPlanGoalsState>({
  version: CURRENT_BUILD_PLAN_GOALS_VERSION,
  activeId: null,
  list: []
})

const resolvedLogicFlowState = shallowRef<ResolvedBuildPlanLogicFlowState>({
  requestedPlanId: null,
  resolvedPlanId: null,
  source: 'none',
  snapshot: null
})
```

### Store 方法

- `loadPlansFromStorage()` / `savePlansToStorage()`
- `ensureActivePlan()` — 无 activeId 时自动创建默认方案
- `createNewPlan()` — 创建空方案并切换
- `switchPlan(planId)` — 加载 buildGoals + 尝试还原 logicFlowPlanId
- `deletePlan(planId)` — 删除方案 + 切换逻辑
- `updateLogicFlowPlanId()` — 切换 logicFlow 时更新当前方案的 logicFlowPlanId
- `activePlanName` (getter/setter) — 读写当前方案的 name
- `syncGoalsToActivePlan()` — 将当前 buildGoals 同步到 activePlan 并保存
- `addFleetEntry(shipId, blueprintId)` — 自动创建/追加 Fleet goal
- `removeFleetEntry(blueprintId)` — 移除 entry，entries 为空时移除 Fleet goal
- `updateFleetBuildTime(seconds)` — 更新 buildTime
- `updateFleetBuildTimeMode(mode)` — 更新 buildTimeMode
- `updateFleetEntryQuantity(blueprintId, qty)` — 更新 entry quantity
- `updateFleetShipyardCount(groupType, count)` — 更新船厂数量

### Logic-Flow Snapshot 解析流程

```ts
resolveLogicFlowStateForBuildPlan()
```

输入：
- 当前 build-plan 的 `logicFlowPlanId`
- `logicFlowStore.savedPlans.activeId`
- `logicFlowStore` 当前 active 的已重建状态
- `logicFlowStore.savedPlans.list`

判定规则：
- 同 active：`logicFlowPlanId === activeId` → 直接复用 active store 数据，`source = 'active-store'`
- 非 active：按绑定 plan 重建 snapshot，保存到 build-plan store，`source = 'rebuilt-plan'`
- 无可用 plan：`source = 'none'`，`snapshot = null`
- `logicFlowPlanId = null`：视为"无规划"而非错误；`source = 'none'`，`snapshot = null`，后续 preview / compute 继续走待规划产线分支

### Active 隔离约束

- `switchPlan(planId)` 不再触发 `logicFlowStore.loadPlan(...)`
- build-plan 方案切换只更新自身 `buildGoals`、`logicFlowPlanId` 和 `resolvedLogicFlowState`
- preview / compute 只消费 `resolvedLogicFlowState.snapshot`

### Watcher 规则

- 永远监听 build-plan 自身输入：`buildGoals`、`buildMaterialPlanningEnabled`、`logicFlowPlanId`
- 仅在 `resolvedLogicFlowState.source === 'active-store'` 时响应 active logic-flow 的实时编辑变化
- 非 active 时 active logic-flow 的实时编辑不影响当前 build-plan

## 产线自动分配算法

### 三级匹配

```
function computeProductionLineAllocation(goals, flowPlan, buildFlowView):
  // Layer 1: Build-flow outputMaterialTag 匹配
  for each goal:
    wareId = extractWareId(goal)
    for each bfg in buildFlowView.buildFlowGroups:
      for each tag in bfg.outputMaterialTags:
        if tag.wareId == wareId:
          sourceGroupId = findConnection(tag, assignments, virtualEdges)
          if sourceGroupId: allocate to sourceGroupId; continue to next goal

  // Layer 2: Logic-flow 节点匹配 (manual 优先, auto 兜底, 排除 isolated)
  for each goal:
    scan groups: manual node match → allocate
    if unmatched: scan groups: auto node match → allocate

  // Layer 3: 待规划产线
  unmatched goals → virtual "待规划产线" group
```

### 派生 Goal 生成

```
for each user goal:
  module = getProductionModule(goal)
  walkUpstream(module, covered):
    for each inputWareId in module.inputs:
      if isolated node exists for inputWareId && !seenIsolatedWares.has(inputWareId):
        add derivedGoal { type: 'derived-rate', wareId: inputWareId, ratePerHour: 0 }
        seenIsolatedWares.add(inputWareId)
      nextModule = findModuleForWare(inputWareId)
      if nextModule: walkUpstream(nextModule, covered)
```

- 派生 goal 不持久化，goals 或 logic-flow 变化时全量重算
- derived-rate 不可编辑数量、不可删除
- `covered` 集合初始包含：user goal wareIds + 所有产线节点的 wareIds

## Fleet 建造时间计算

- 单艘建造时间：来自 `resolveBlueprintMaterialCost` 携带的 `production.time`
- 每组总建造时间：`ceil(Σ(单艘buildTime × quantity) / shipyardCount)`
- 实际总花费：`max(所有组总建造时间)`
- 有效建造时间（effectiveBuildTime）：由 buildTimeMode 决定
  - `actual`：effectiveBuildTime = actualTotalBuildTime
  - `planned`：effectiveBuildTime = buildTime
- 派生 rate：`Math.ceil(同 wareId 总需求 / effectiveBuildTime × 3600)`

## UI 组件架构

- `BuildGoalSearchBox` — 组合搜索框（product / module / fleet 三类别）
- `FleetGoalSearchBox` — Fleet 专用搜索框
- `FleetGoalCard` — Fleet 卡片（标题栏 + 原生 select 下拉菜单(实际/规划) + 船厂分组 + 条目列表 + rate 汇总）
- `WarePlanningItem` — 目标卡片（颜色条 + 名称 + 数量输入 + 删除）
- `ProductionLineAllocationSection` — 产线分配区域

## 涉及文件

| 文件 | 角色 |
|------|------|
| `src/types/build-plan.ts` | BuildGoal / FleetEntry / SavedBuildPlanGoalsState / ProductionLineAllocation / LogicFlowPlanSnapshot / ResolvedBuildPlanLogicFlowState |
| `src/store/useBuildPlanStore.ts` | 方案 CRUD + Fleet 方法 + resolvedLogicFlowState + watcher |
| `src/store/logic/buildPlanLogicFlowSource.ts` | snapshot 解析层 |
| `src/store/logic/resolveBlueprintMaterialCost.ts` | 蓝图材料解析纯函数 |
| `src/store/logic/computeProductionLineAllocation.ts` | 产线分配核心算法 |
| `src/components/empire/presenters/useBuildPlanPresenter.ts` | 方案/Fleet/分配 Presenter |
| `src/components/empire/BuildPlanConstraintsPanel.vue` | 约束面板 UI |
