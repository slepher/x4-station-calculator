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

- [x] 删除 `executeAutoEvents()` 函数
- [x] 新增 canonical sync 函数，调用 `replayExecutionLog(..., { mode: 'draft' })` 生成 projectId 序列并替换 store log

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

- [x] `import { computeTerraformingRuntimeStats }` → 改为 `import { replayExecutionLog }`
- [x] Mock store 移除 `terraformingCurrentStats` 暴露
- [x] Mock store 移除 `terraformingCompletedProjects` 暴露
- [x] 测试场景和断言保留不变（仍然通过 presenter API `executionTimeline` / `planEntries` 验证）

---

## T12: 适配 `dependency-presenter.spec.ts`

**File**: `tests/unit/terraforming-log-edit/dependency-presenter.spec.ts`

- [x] `TerraformingPresenterStore` 已移除 `terraformingCurrentStats` 字段要求
- [x] `TerraformingPresenterStore` 已移除 `terraformingCompletedProjects` 字段要求
- [x] 测试场景不变: dependency expression → systemDisabled / goal 生成 → 断言保留

---

## T13: 确认 `dependency-expression.spec.ts` 不受影响

**File**: `tests/unit/terraforming-log-edit/dependency-expression.spec.ts`

- [x] 确认 `evaluateTerraformingProjectExecution` 未被删除或改名
- [x] 0 改动

---

## T14: 验证构建与单元测试

- [x] `npm run build` 无编译错误
- [x] `npm run test:unit -- tests/unit/terraforming-replay/engine.spec.ts` 通过
- [x] `npm run test:unit -- tests/unit/terraforming-event/timing.spec.ts` 通过
- [x] `npm run test:unit -- tests/unit/terraforming-log-edit/dependency-presenter.spec.ts` 通过
- [x] `npm run test:unit -- tests/unit/terraforming-log-edit/dependency-expression.spec.ts` 通过
- [x] 确认所有删除的 import 引用均已清理

---

## T15: 修正 event cursor replay 语义

**Files**: `src/store/logic/terraformingRuntime.ts`, `tests/unit/terraforming-replay/engine.spec.ts`

- [x] `ReplayOptions` 新增 `mode?: 'committed' | 'draft'`，默认 committed
- [x] 删除“扫描后续全部 log 是否存在同名 event”的逻辑，改为只检查 cursor 下一条是否为当前位置触发的 event
- [x] replay 计算出 event E 时，若 cursor 下一条是 E 则消费/替换，否则插入 E
- [x] draft/edit mode 下，cursor 遇到未触发 event 时排除，不输出 step，不应用 effects
- [x] committed/non-edit mode 下，cursor 遇到未触发 event 时输出 invalid auto-event step，不应用 effects
- [x] blocked stat event 即使在 log 中也按 stale event 处理
- [x] 新增 engine 单测覆盖 immediate event 消费、future event 不抑制当前位置插入、draft stale event 排除、committed stale event invalid、blocked event stale

---

## T16: 修正 event 重复与 cancel validation 需求语义

**Files**: `src/components/empire/presenters/useTerraformingPresenter.ts`, `src/store/logic/terraformingRuntime.ts`, `tests/unit/terraforming-replay/engine.spec.ts`, `tests/unit/terraforming-replay/cancel-validation.spec.ts`

- [x] 文档明确同 id event 是否可重复触发由 event 属性决定，禁止用全局 `projectId` 去重替代规则
- [x] 新增 engine 单测覆盖 one-time event 已有效触发后不重复触发
- [x] 新增 engine 单测覆盖 repeatable event 在后续位置再次满足条件时允许再次触发
- [x] 文档明确 cancel validation 只移除当前 task 以及其后连续紧邻的所有 event，直到下一个非 event entry
- [x] 文档明确 cancel validation 的剩余 log 只跑一次 replay，若 replay 重新插入 event 后后续 task valid 则允许 cancel
- [x] 文档明确 cancel validation 可从被取消 task 的上一个保留 entry 状态开始重放 suffix，结果必须等价于全量 remaining log 重放
- [x] 新增 presenter 单测覆盖 cancel validation 会排除目标 task 后的多个连续 event
- [x] 新增 presenter 单测覆盖 cancel validation 允许 replay 重新插入 event 来满足后续 task
- [x] 新增 presenter 单测覆盖 cancel validation 只检查被取消 entry 之后的后续 task
- [x] 修改 `getExecutionCancelValidation()` 的 remainingLog 构造逻辑
- [x] 运行新增/相关单测通过

---

## T17: 非 edit auto-event 同步改为 canonical projectId 序列

**Files**: `src/components/empire/presenters/useTerraformingPresenter.ts`, `tests/unit/terraforming-replay/auto-event-sync.spec.ts`

- [x] 文档明确 execution log 持久化只有 projectId 序列，entry id 只是 hydrate 后内存/UI 临时标识
- [x] 文档明确 event 是 replay 派生结果，没有独立业务身份
- [x] 文档明确 selectCluster/append 后用 `mode: 'draft'` replay 结果替换 canonical projectId 序列
- [x] 新增 presenter 单测覆盖已有错位 event 不会阻止 canonical auto-event 同步
- [x] 替换 `executeAutoEvents()` 为 canonical sync 函数，并移除旧的 `Set(projectId)` 判断
- [x] 运行新增/相关单测通过

---

## T18: 需求审查剩余行为收敛

**Files**: `src/components/empire/presenters/useTerraformingPresenter.ts`, `tests/unit/terraforming-replay/rebate-raw-id.spec.ts`, `tests/unit/terraforming-replay/can-append.spec.ts`

- [x] 新增 presenter 单测覆盖 rebate 按 raw wareGroup id 匹配，展示名碰撞不误打折
- [x] 修改 `computeProjectDiscount()` 输入使用 raw `RebateKey[]`，display name 只用于展示
- [x] 新增 presenter 单测覆盖 `canAppendCommittedProject()` 使用 replay-derived state，stale event 不算 completed
- [x] 修改 `canAppendCommittedProject()` 从当前 committed log 的 replay result 取 stats/completed
- [x] 运行新增/相关单测通过

---

## T19: timeline UI id 按 occurrence 映射

**Files**: `src/components/empire/presenters/useTerraformingPresenter.ts`, `tests/unit/terraforming-replay/auto-event-sync.spec.ts`

- [x] 文档明确 `TerraformingExecutionEntry.id` 不是 store 持久业务身份，仅为 hydrate 后 UI 临时标识
- [x] 文档明确 timeline 从 replay step 回填 id 时必须按 occurrence 顺序消费 log entry
- [x] 新增 presenter 单测覆盖同一 `projectId` 重复出现时 timeline 行 id 分别对应第一/第二个 log entry
- [x] 修改 `executionTimeline` 的 id 回填逻辑，移除 `log.find(projectId)` 首条匹配
- [x] 运行新增/相关单测通过
