# build-plan-active-flow 任务

## 任务列表

### T1: 定义 build-plan 使用的 logic-flow snapshot 类型 [x]

- 修改 `src/types/build-plan.ts`
- 新增 `LogicFlowPlanSnapshot`
- 新增 `ResolvedBuildPlanLogicFlowState`
- 明确 `source` 取值：
  - `active-store`
  - `rebuilt-plan`
  - `none`

### T2: 新增 build-plan 专用 logic-flow 解析模块 [x]

- 新增 `src/store/logic/buildPlanLogicFlowSource.ts`
- 提供 active snapshot 提取入口
- 提供按指定 `logicFlowPlanId` 重建 snapshot 的入口
- 复用现有 logic-flow 推导能力，不复制另一套 build-flow 派生算法

### T3: 在 build-plan store 增加 resolved logic-flow 状态 [x]

- 修改 `src/store/useBuildPlanStore.ts`
- 新增 `resolvedLogicFlowState`
- 新增统一入口 `resolveLogicFlowStateForBuildPlan()`
- build-plan 当前方案切换后，先解析 resolved snapshot，再驱动 preview

### T4: 解除 build-plan 对 active logic-flow 实时字段的直接依赖 [x]

- 修改 `src/store/useBuildPlanStore.ts`
- `computeBuildFlowPlanPreview()` 只读取 `resolvedLogicFlowState.snapshot`
- `computePlan()` 只读取 `resolvedLogicFlowState.snapshot`
- 删除 build-plan 计算流程中直接回读 `logicFlowStore.groups / buildFlowView / assignments / virtualEdges` 的路径

### T5: 保证 build-plan 切换读取源不影响 logic-flow active [x]

- 修改 `src/store/useBuildPlanStore.ts`
- `switchPlan(planId)` 不再通过 `logicFlowStore.loadPlan(...)` 恢复关联 plan
- build-plan 只更新自身 `buildGoals`、`logicFlowPlanId`、resolved snapshot
- 明确 build-plan 读取非 active plan 时不修改 logic-flow 当前 active 编辑上下文

### T6: 调整 watcher 联动规则 [x]

- 修改 `src/store/useBuildPlanStore.ts`
- build-plan 自身输入变化时，重新解析 resolved snapshot 并刷新 preview
- 仅在 resolved source 为 `active-store` 时，响应 active logic-flow 的实时编辑变化
- 当 resolved source 为 `rebuilt-plan` 时，active logic-flow 的实时变化不再影响当前 build-plan

### T7: 构建验证 [x]

- 运行 `npm run build`
- 若存在编译错误，修正直到通过或形成明确 blocker
