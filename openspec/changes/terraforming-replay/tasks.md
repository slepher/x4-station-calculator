# Terraforming Replay — Tasks

## T1: 新增 `TerraformingReplayResult` 类型与 `ReplayOptions`

**File**: `src/store/logic/terraformingRuntime.ts`

- [x] 新增 `ReplayFlags` interface（`goals`, `evaluations`, `stepSnapshots`，均为可选 boolean）
- [x] 新增 `ReplayOptions` interface（`flags?: ReplayFlags`）
- [x] 新增 `RebateKey` interface（`id: string`, `type: 'wareGroup' | 'ware'`, `value: number`）
- [x] 新增 `ReplayStep` interface（`projectId`, `type`, `valid`, `statsBefore?`, `statsAfter?`, `completedBefore?`, `completedAfter?`, `cumulativeRebatesBefore?`, `cumulativeRebatesAfter?`, `rebateChanges?`, `evaluation?`）
- [x] 新增 `GoalEntry` interface（`id`, `kind`, `position`, `dependentTaskIds`, `statGoal?`, `projectGoal?`）
- [x] 新增 `TerraformingReplayResult` interface（`steps`, `goalEntries`, `finalStats`, `finalCompleted`）

---

## T2: 实现 `replayExecutionLog()` 引擎

**File**: `src/store/logic/terraformingRuntime.ts`

- [x] 实现 `replayExecutionLog(log, cluster, data, options)` 纯函数
- [x] 闭包维护 `runningStats`（从 `buildTerraformingBaseStats` 起始）、`runningCompleted` 和 `runningRebates`（按 `g:<wareGroup>` / `w:<ware>` key 聚合）
- [x] 实现 `applyRebateEntries(projectId, count)` — 增量更新 runningRebates
- [x] 实现 `snapshotRebates()` — 输出 `{ raw: Map, list: RebateKey[] }`
- [x] 实现 `diffRebates(before, after)` — 输出 `rebateChanges`
- [x] 实现 `injectEventsAtPosition()` 闭包（迭代检测 + 注入 auto-event，最大 20 轮）
- [x] 初始位置调用 `injectEventsAtPosition()`
- [x] 遍历 log 每个 entry 时的 eval + goals 分支逻辑
- [x] 实现 `generateGoalsForEntry()` — project dependency goal 虚拟满足，stat condition goal 实际设置 runningStats，重新评估 entry
- [x] 末尾调用 `injectEventsAtPosition()`
- [x] 返回 `{ steps, goalEntries, finalStats: currentStats(), finalCompleted }`
- [x] export `replayExecutionLog`

---

## T3: 重构 `executionTimeline` 使用引擎

**File**: `src/components/empire/presenters/useTerraformingPresenter.ts`

- [x] 删除旧的 `evaluateEntry()` 闭包和内联循环
- [x] 改为调用 `replayExecutionLog(log, cluster, data, { flags: { evaluations: true, stepSnapshots: true } })`
- [x] 从 `replayResult.steps` 构建 `TerraformingExecutionTimelineEntry[]`
- [x] `availableBeforeExecution` 从 `step.valid` 取
- [x] `blockedReason` 从 `step.evaluation?.reasons` 取
- [x] `cumulativeRebates` / `rebateChanges` 从 engine step 取 raw ID，presenter `resolveRebateName()` 译名

---

## T4: 重构 `computePlanDraftEntries` 使用引擎

**File**: `src/components/empire/presenters/useTerraformingPresenter.ts`

- [x] 删除 `pushTaskEntry()` 闭包
- [x] 删除 `pushEventEntry()` 闭包
- [x] 删除内联 auto-event 检测循环
- [x] 改为调用 `replayExecutionLog(draftLog, cluster, data, { flags: { evaluations: true, stepSnapshots: true, goals: true } })`
- [x] 从 `replayResult.steps` 构建 `TerraformingDraftTimelineEntry[]`，`systemDisabled` = `!step.valid`
- [x] `draftReplayEntries` / `generatedGoals` 从 engine result 派生

---

## T7: 重构 auto-event 处理（替换 `executeAutoEvents`）

**File**: `src/components/empire/presenters/useTerraformingPresenter.ts`

- [x] `executeAutoEvents()` 函数体内联循环改为调用 `replayExecutionLog()` 检测新增 event
- [x] 保留函数签名，调用方不变

---

## T8: 重构 `effectiveCompletedProjects` / `effectiveCurrentStats` / `taskTree`

**File**: `src/components/empire/presenters/useTerraformingPresenter.ts`

- [x] `effectiveCompletedProjects` computed 改为从引擎结果派生
- [x] `effectiveCurrentStats` computed 改为从引擎结果派生
- [x] `taskTree` 使用新的 effective stats

---

## T9: 删除废弃函数与 import 清理

**Files**: `src/store/logic/terraformingRuntime.ts`, `src/components/empire/presenters/useTerraformingPresenter.ts`

- [x] 删除 `computeTerraformingRuntimeStats()` 函数定义及 export（terraformingRuntime.ts）
- [x] 删除 `computeSequentialStatsFromLog()` 函数定义及 export（terraformingRuntime.ts）
- [x] `useTerraformingStore.ts` 改用 `replayExecutionLog`
- [x] presenter 删除 `computeCumulativeRebates()`、`getEventStatIds()`、`buildAutoEventStatLines()`
- [x] presenter 删除 `findTaskNodeById()`、`pushTaskEntry()`、`pushEventEntry()`、`evaluateEntry()`

---

## T10: 新增 `engine.spec.ts` 直接测试引擎

**File**: `tests/unit/terraforming-replay/engine.spec.ts`（新建）

- [x] OceanOfFantasy: 3 clouds → solidify + volcano
- [x] OceanOfFantasy: goals between volcano and academy
- [x] OceanOfFantasy: jumpstart+hydro+clouds → event positions
- [x] OceanOfFantasy: commit preserves event order
- [x] FrontierEdge: no airpressure stat goal, population present
- [x] BlackHoleSun: wat_import + clouds → warming ×2
- [x] BlackHoleSun: afterStats temp 6→5
- [x] BlackHoleSun edit: cloud → warming → cloud → warming
- [x] BlackHoleSun edit: stat change values 6→5, 5→6

引擎是纯函数，不依赖 Pinia / presenter / mock store。

---

## T11: 适配 `timing.spec.ts`（保留 presenter 测试）

**File**: `tests/unit/terraforming-event/timing.spec.ts`

- [ ] `import { computeTerraformingRuntimeStats }` → 改为 `import { replayExecutionLog }`
- [ ] Mock store 的 `terraformingCurrentStats` 改为从 `replayExecutionLog(...).finalStats` 获取
- [ ] Mock store 的 `terraformingCompletedProjects` 改为从 `replayResult.finalCompleted` 获取
- [ ] 测试场景和断言保留不变（仍然通过 presenter API `executionTimeline` / `planEntries` 验证）

---

## T12: 适配 `dependency-presenter.spec.ts`

**File**: `tests/unit/terraforming-log-edit/dependency-presenter.spec.ts`

- [ ] 若 `TerraformingPresenterStore` 移除 `terraformingCurrentStats` → mock store 移除该字段
- [ ] 若 `TerraformingPresenterStore` 移除 `terraformingCompletedProjects` → mock store 移除该字段
- [ ] 测试场景不变: dependency expression → systemDisabled / goal 生成 → 断言保留

---

## T13: 确认 `dependency-expression.spec.ts` 不受影响

**File**: `tests/unit/terraforming-log-edit/dependency-expression.spec.ts`

- [ ] 确认 `evaluateTerraformingProjectExecution` 未被删除或改名
- [ ] 0 改动

---

## T14: 验证构建与单元测试

- [ ] `npm run build` 无编译错误
- [ ] `npm run test:unit -- tests/unit/terraforming-replay/engine.spec.ts` 通过
- [ ] `npm run test:unit -- tests/unit/terraforming-event/timing.spec.ts` 通过
- [ ] `npm run test:unit -- tests/unit/terraforming-log-edit/dependency-presenter.spec.ts` 通过
- [ ] `npm run test:unit -- tests/unit/terraforming-log-edit/dependency-expression.spec.ts` 通过
- [ ] 确认所有删除的 import 引用均已清理
