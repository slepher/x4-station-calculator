# build-plan-active-flow 设计

## 目标

把 `build-plan` 当前“直接读 active logic-flow store”的模式，收敛为“先解析 snapshot，再用 snapshot 驱动 preview / compute”。

本次设计只处理输入解析与状态归属，不扩展算法职责。

## 当前问题

当前 `useBuildPlanStore` 同时承担了两件事：

1. 保存 build-plan 自身目标与计算结果
2. 直接读取 `useLogicFlowStore` 当前 active 的运行时状态

这会带来三类问题：

1. build-plan 虽然保存了 `logicFlowPlanId`，但计算时仍可能吃到当前 active logic-flow 的实时内容
2. build-plan 若切换方案并尝试恢复关联 flow，会影响 logic-flow UI 当前 active
3. watcher 无法区分“我依赖的是 active plan”还是“我依赖的是另一个已保存 plan”

## 方案

### 1. 引入独立 snapshot 解析层

新增一个 build-plan 专用 logic 模块，负责把 logic-flow 数据整理成 build-plan 可消费的快照。

建议新增：

```ts
interface LogicFlowPlanSnapshot {
  planId: string | null
  groups: ProductionLineGroup[]
  buildFlowView: BuildFlowPlanView | null
  buildFlowAssignments: BuildFlowAssignment[]
  buildFlowVirtualEdges: BuildFlowVirtualEdge[]
}

interface ResolvedBuildPlanLogicFlowState {
  requestedPlanId: string | null
  resolvedPlanId: string | null
  source: 'active-store' | 'rebuilt-plan' | 'none'
  snapshot: LogicFlowPlanSnapshot | null
}
```

职责边界：

- logic 模块负责解析 snapshot
- `useBuildPlanStore` 负责保存 resolved 结果
- preview / compute 只读 resolved 结果

### 2. 解析流程

统一入口：

```ts
resolveLogicFlowStateForBuildPlan()
```

输入：

- 当前 build-plan 的 `logicFlowPlanId`
- `logicFlowStore.savedPlans.activeId`
- `logicFlowStore` 当前 active 的已重建状态
- `logicFlowStore.savedPlans.list`

输出：

- `ResolvedBuildPlanLogicFlowState`

判定规则：

#### 2.1 同 active

若：

```ts
buildPlan.logicFlowPlanId === logicFlowStore.savedPlans.activeId
```

则：

- 直接从 `logicFlowStore` 读取当前 active 的已重建结果
- `source = 'active-store'`
- 不做额外重建

#### 2.2 非 active

若：

```ts
buildPlan.logicFlowPlanId !== logicFlowStore.savedPlans.activeId
```

则：

- 从 `logicFlowStore.savedPlans.list` 找到对应保存方案
- 基于保存数据重建 `groups / buildFlowView / assignments / virtualEdges`
- `source = 'rebuilt-plan'`
- 将结果写入 `useBuildPlanStore` 的 resolved 状态

#### 2.3 无可用 plan

若 build-plan 未绑定 plan，或绑定的 plan 已不存在：

- `source = 'none'`
- `snapshot = null`

### 3. 状态归属

`useBuildPlanStore` 新增：

```ts
const resolvedLogicFlowState = shallowRef<ResolvedBuildPlanLogicFlowState>({
  requestedPlanId: null,
  resolvedPlanId: null,
  source: 'none',
  snapshot: null,
})
```

这是 build-plan 真相层状态的一部分。

后续：

- `computeBuildFlowPlanPreview()` 只从 `resolvedLogicFlowState.snapshot` 取 `groups / buildFlowView / assignments / virtualEdges`
- `computePlan()` 同样只读取 `resolvedLogicFlowState.snapshot`
- 不再在这两个流程里直接回读 `logicFlowStore.groups` 等实时字段

### 4. active 隔离

这是本次设计的强约束：

- build-plan 读取哪个 logic-flow plan，只影响 build-plan 自己
- logic-flow 当前 active plan 是 logic-flow 工作台自己的上下文
- 两者不能互相篡改

因此：

- `switchPlan(planId)` 不再触发 `logicFlowStore.loadPlan(...)`
- build-plan 方案切换只更新自身 `buildGoals`、`logicFlowPlanId` 和 `resolvedLogicFlowState`
- 若需要读取非 active plan，直接在 build-plan 内部重建 snapshot，不借道切换 logic-flow active

### 5. watcher 规则

当前 watcher 直接监听 active logic-flow 的字段，这需要改成按依赖关系区分。

建议规则：

#### 5.1 永远监听 build-plan 自身输入

- `buildGoals`
- `buildFlowMode`
- 当前 build-plan 的 `logicFlowPlanId`

这些变化都应触发重新解析 resolved snapshot，并据此刷新 preview。

#### 5.2 仅在“同 active”时监听 active logic-flow 实时变化

只有当：

```ts
resolvedLogicFlowState.source === 'active-store'
```

时，以下变化才触发 preview 重算：

- `logicFlowStore.groups`
- `logicFlowStore.buildFlowGroups`
- `logicFlowStore.buildFlowAssignments`
- `logicFlowStore.buildFlowVirtualEdges`

#### 5.3 非 active 时不受 active 编辑影响

当：

```ts
resolvedLogicFlowState.source === 'rebuilt-plan'
```

时，active logic-flow 的实时编辑不应触发当前 build-plan preview / compute 更新。

## 数据流

```text
build-plan current plan
  -> logicFlowPlanId
  -> resolveLogicFlowStateForBuildPlan()
     -> active-store snapshot | rebuilt-plan snapshot | none
  -> resolvedLogicFlowState
  -> preview
  -> compute
```

与当前设计相比，唯一新增中间层就是“snapshot 解析层”；它是本次解耦所必需的最小新增层，不承担 presenter 或 UI 组装职责，不违反 store -> presenter -> vue 的约束。

## 影响范围

主要影响：

- `src/store/useBuildPlanStore.ts`
- `src/types/build-plan.ts`
- 新增 `src/store/logic/buildPlanLogicFlowSource.ts`

尽量不改：

- `src/store/logic/buildPlanProductionLine.ts`
- `src/store/logic/buildFlowPlanGraph.ts`
- build-plan presenter 的展示逻辑

## 风险与控制

### 风险 1

非 active plan 的重建逻辑若与 active store 当前构建逻辑不一致，会出现同 plan 不同结果。

控制：

- snapshot 重建逻辑必须复用 logic-flow 现有推导能力，不单独复制算法

### 风险 2

watcher 改造后可能出现 preview 不刷新或过度刷新。

控制：

- 先统一“所有 preview 输入都来自 resolved snapshot”
- 再按 `source` 区分 watcher 条件

### 风险 3

遗留 presenter 或组件仍直接读取 logic-flow store 参与 build-plan 计算语义。

控制：

- 本次只允许 presenter 读取 build-plan store 已产出的结果
- 不允许 presenter 再对 build-plan 输入做二次拼装
