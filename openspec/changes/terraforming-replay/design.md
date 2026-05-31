# Terraforming Replay — Design

## Architecture

```
terraformingRuntime.ts (引擎层 — 纯函数)
├── replayExecutionLog(log, cluster, data, options) → TerraformingReplayResult
│   ├── 闭包: runningStats + runningCompleted + runningRebates
│   ├── 初始 auto-event 检测 (iterativeLoop)
│   ├── 逐 entry 处理:
│   │   ├── evaluation (evaluations flag)
│   │   │   ├── valid → 正常 push step + apply effects
│   │   │   └── invalid + goals flag
│   │   │       ├── project dependency unmet → projectGoal (虚拟满足，不应用 effects)
│   │   │       ├── stat condition unmet → statGoal (计算 delta，应用到 runningStats)
│   │   │       ├── 重新评估 entry → 有效 → 应用 entry 的 effects
│   │   │       └── push step (标记 valid)
│   │   │   └── invalid + !goals flag
│   │   │       ├── 跳过 effects
│   │   │       └── push step (标记 invalid)，继续
│   │   ├── stepSnapshots → 记录 stats/rebate 快照 + diff
│   │   └── 位置内 auto-event 检测 (iterativeLoop)
│   ├── 末尾 auto-event 检测 (iterativeLoop)
│   └── 返回 { steps, goalEntries, finalStats, finalCompleted }
│
│   iterativeLoop (闭包子函数):
│     while triggered && iteration < maxIterations:
│       遍历 statAffectingEvents
│         若 conditions 满足且 (ONE_TIME 未完成 || repeatable)
│         → pushStep, apply effects, triggered = true, break
│
└── TerraformingReplayResult
    ├── steps: ReplayStep[]          // 顺序 step 列表
    │   ├── projectId, type
    │   ├── valid: boolean           // valid === false 表示该 entry 在此位置不可执行
    │   ├── statsBefore/After        // stepSnapshots flag
    │   ├── completedBefore/After    // stepSnapshots flag
    │   ├── cumulativeRebatesBefore/After  // stepSnapshots flag (raw ID 聚合)
    │   ├── rebateChanges            // stepSnapshots flag (引擎 diff before/after)
    │   ├── evaluation              // evaluations flag
    │   └── taskNode                // evaluations flag (查台)
    │
    ├── goalEntries: GoalEntry[]     // goals flag
    │   ├── kind: 'stat' | 'project'
    │   ├── position                 // 发生位置 (对应 steps index)
    │   ├── dependentTaskIds         // 依赖此 goal 的 entry.id 列表
    │   ├── statGoal?: { statId, currentValue, targetValue }
    │   └── projectGoal?: { targetProjectId }
    │
    ├── finalStats                   // 最终 stats
    └── finalCompleted               // 最终 completed counts

useTerraformingPresenter (消费层)
├── executionTimeline     → replayExecutionLog(committedLog, { evaluations, stepSnapshots })
│                            + display 富化 (rebateChanges 译名, wares, delivery...)
├── computePlanDraftEntries → replayExecutionLog(draftLog, { evaluations, stepSnapshots, goals })
│                            goalEntries 来自引擎, 不再单独调 generateGoalEntries
│                            cumulativeStateAt 从 steps[i].statsBefore 构建
│                            + draft-specific display
├── getExecutionCancelValidation → replayExecutionLog(remainingLog, { evaluations })
├── effectiveCurrentStats / effectiveCompletedProjects → replayResult.finalStats / finalCompleted
├── taskTree           → 读 effectiveStats (调用引擎获得)
└── selectCluster / append → replayExecutionLog() → 写入新增的 auto-event
```

## 设计原则

1. 引擎是纯函数，输入 log + cluster + data，输出 ReplayResult。不依赖 Pinia，不修改参数。
2. 引擎闭包只维护一套 runningStats + runningCompleted + runningRebates。每步增量应用 effects。
3. auto-event 检测内化在引擎中，调用方不可见。引擎返回的 steps 中已包含 event steps。
4. flags 控制输出粒度：

   | 场景 | evaluations | stepSnapshots | goals | 说明 |
   |------|:---:|:---:|:---:|------|
   | executionTimeline | ✅ | ✅ | ❌ | 需要每步 stats/rebate 快照 + 可用性判断 |
   | computePlanDraftEntries | ✅ | ✅ | ✅ | edit 模式: stats 快照 + validity + goal |
   | cancel validation | ✅ | ❌ | ❌ | 只需 evaluation 判断后续 entry 是否失效 |
   | effective stats / taskTree | ❌ | ❌ | ❌ | 只需 finalStats / finalCompleted |
   | event 检测 (selectCluster / append) | ❌ | ❌ | ❌ | 只需新增的 auto-event projectId |

5. 引擎增量维护累计折扣：每步只处理当前 project 的 rebates，累计到 runningRebates（按 raw `wareGroup`/`ware` ID 聚合，不译名）。`stepSnapshots` 开时推入 `cumulativeRebatesBefore/After`，并 diff 得出 `rebateChanges`。
6. `evaluateTerraformingProjectExecution` 和 `resolveAvailableTasks` 只在该 step 需要 evaluation 时才调用。
7. engine 对 auto-event 注入有最大迭代次数保护（`maxIterations = 20`）。
8. engine 不关心 log 是 committed 还是 draft —— 它只看到 `{ projectId: string }[]`。

### `goals` flag 行为

9. `goals` flag 打开时，引擎遇到 evaluation invalid 的 entry：
   - 对 **project dependency goal**（需 A 或 B）：虚拟满足 dependency，**不应用** project 的 effects 或 stat changes
   - 对 **stat condition goal**（stat S 需达到 V）：计算 delta = V - current，**实际应用到 runningStats**
   - goal 全部满足后重新评估 entry → entry 转为有效 → 应用 entry 的 effects → 继续
10. `goals` flag 关闭时，引擎遇到 evaluation invalid 的 entry：
   - 跳过该 entry 的 effects，标记 `valid: false`，继续下一个 entry
11. goal 对 dependency 的处理：
    - `completed A` 未完成 → 生成 projectGoal{A}
    - `any(completed A, completed B)` 均未完成 → 生成**两条** projectGoal（A 和 B 各一条）
    - `any(notCompleted B, completed C)` 且 B 未完成 → 不生成 goal（`notCompleted` 分支已满足）
    - `notCompleted B` → 不生成 goal（无法通过执行 project 满足）
12. **互斥规则**（`notCompleted`）由引擎 evaluation 自然保证，无需额外处理。先入队 entry A 完成后，后入队 entry B（dependency 含 `notCompleted A`）自动被标记 `valid: false`。
13. **UI 适配**: engine 产出 `goalEntries`（含 `targetProjectId`），presenter 的 `generateGoalEntries` 交叉比对 `draftExecutionLog` 设置 `hasExistingTask` / `existingDraftEntryId`，UI 据此渲染「移动到此处」按钮。引擎变更不影响此行为。
14. **cluster goal** 不进入引擎循环。原因是 cluster objective 只依赖最终状态，不依赖中间步骤。presenter 从 `replayResult.finalStats` / `replayResult.finalCompleted` 判断 `cluster.objectives` 是否满足，不满足则生成 clusterGoal。与现状一致。
15. **预防型 goal** 同上，不进入引擎循环。presenter 从 `replayResult.finalStats` 检测非 stat 影响的重复事件（如地震）的条件是否满足，满足则生成 `kind: 'preventive'` goal。
16. **插入到 goal 对应位置**（`resolveInsertIndex`）不受影响。新引擎的 `GoalEntry.position` 语义与现状 `generatedGoals[i].position` 一致（无效 entry 在 steps 中的 index），presenter 交叉比对逻辑不变。

### 操作行为影响评估

| 操作 | 影响 | 说明 |
|------|:---:|------|
| **插入到 goal 对应位置** | ❌ 不受影响 | `GoalEntry.position` 语义一致 |
| **拖拽排序 / 复制 / 移除 draft** | ❌ 不受影响 | 仅修改 `draftExecutionLog`，触发引擎重算 |
| **mutual exclusion 检测** | ❌ 不受影响 | presenter 端基于 `draftExecutionLog` 统计 |
| **goal 点击过滤** | ❌ 不受影响 | `activeGoalFilterIds` set 逻辑不变 |
| **moveTaskBeforeDependency** | ❌ 不受影响 | 依赖 `goal.dependentTaskIds`，引擎产出同字段 |
| **goalCanSatisfyTaskIds** | ❌ 不受影响 | presenter 遍历 projects 匹配，不涉及引擎 |
| **startQueueEdit / cancelQueueEdit / completeQueueEdit** | ❌ 不受影响 | 门面方法，仅迁移 draft ↔ committed |
| **executionTimeline** | ✅ 改为引擎 | 删除内联循环，数据来自 `replayResult.steps` |
| **computePlanDraftEntries** | ✅ 改为引擎 | 删除内联循环 + pushTaskEntry/pushEventEntry |
| **getExecutionCancelValidation** | ✅ 改为引擎 | 删除内联循环，数据来自 `replayResult.steps` |
| **effective stats / taskTree** | ✅ 改为引擎 | 从 `replayResult.finalStats/Completed` 派生 |
| **executeAutoEvents** | ✅ 移除 | 引擎内化 |
| **toggleProject (non-edit)** | ✅ 简化 | auto-event 部分移除，引擎替代 |
| **setProjectCount (non-edit)** | ✅ 简化 | 同上 |
| **selectCluster (空队列 event)** | ✅ 简化 | 跑引擎检测初始 auto-event |
| **canAppendCommittedProject** | ✅ 改为引擎 | `store.currentStats` 不再存在，改用 `effectiveReplayResult.finalStats` |
| **generateGoalEntries** | ✅ 简化 | 不再内部重放，改为 UI 聚合 `replayResult.goalEntries` |
| **statGoalLineModels / planDisplayEntries** | ❌ 不受影响 | 消费同 shape 数据，纯 UI display |

## Engine Design

### 函数签名

```typescript
interface ReplayFlags {
  goals?: boolean
  evaluations?: boolean
  stepSnapshots?: boolean
}

interface ReplayOptions {
  flags?: ReplayFlags
}

interface ReplayStep {
  projectId: string
  type: 'task' | 'auto-event'
  valid: boolean
  statsBefore?: Record<string, number>
  statsAfter?: Record<string, number>
  completedBefore?: Map<string, number>
  completedAfter?: Map<string, number>
  cumulativeRebatesBefore?: RebateKey[]
  cumulativeRebatesAfter?: RebateKey[]
  rebateChanges?: Array<{ key: RebateKey; before: number; after: number }>
  evaluation?: TerraformingExecutionEvaluation
  taskNode?: TaskNode | null
}

interface RebateKey {
  id: string
  type: 'wareGroup' | 'ware'
  value: number
}

interface GoalEntry {
  id: string
  kind: 'stat' | 'project'
  position: number
  dependentTaskIds: string[]
  statGoal?: { statId: string; currentValue: number; targetValue: number }
  projectGoal?: { targetProjectId: string }
}

interface TerraformingReplayResult {
  steps: ReplayStep[]
  goalEntries: GoalEntry[]
  finalStats: Record<string, number>
  finalCompleted: Map<string, number>
}

function replayExecutionLog(
  log: Array<{ projectId: string }>,
  cluster: TerraformingCluster,
  data: TerraformingData,
  options?: ReplayOptions,
): TerraformingReplayResult
```

### 核心实现

```typescript
function replayExecutionLog(log, cluster, data, options) {
  const flags = options?.flags ?? {}
  const { evaluations, stepSnapshots, goals } = flags

  const steps: ReplayStep[] = []
  const goalEntries: GoalEntry[] = []
  let goalSeq = 0

  let runningStats = buildTerraformingBaseStats(cluster)
  const runningCompleted = new Map<string, number>()
  const runningRebates = new Map<string, number>()  // key: "g:<id>" / "w:<id>", value: 累计%
  const projectMap = buildProjectMap(data)
  const ignoredStats = getTerraformingIgnoredStats(cluster)

  function currentStats() {
    return deriveAirPressure(cluster, { ...runningStats }, ignoredStats)
  }

  // rebate helpers (省略, 见上文)
  function rebateKey(r) { ... }
  function snapshotRebates() { ... }
  function applyRebateEntries(projectId, count) { ... }
  function diffRebates(before, after) { ... }

  function pushStep(projectId: string, type: 'task' | 'auto-event', isValid: boolean) {
    const step: ReplayStep = { projectId, type, valid: isValid }
    if (stepSnapshots) {
      step.statsBefore = currentStats()
      step.completedBefore = new Map(runningCompleted)
      const rbBefore = snapshotRebates()
      step.cumulativeRebatesBefore = rbBefore.list
    }
    if (isValid) {
      runningStats = applyProjectEffectsToTerraformingStats(
        runningStats, new Map([[projectId, 1]]), projectMap, ignoredStats
      )
      runningCompleted.set(projectId, (runningCompleted.get(projectId) ?? 0) + 1)
      applyRebateEntries(projectId, 1)
    }
    // invalid: effects skipped
    if (stepSnapshots) {
      step.statsAfter = currentStats()
      step.completedAfter = new Map(runningCompleted)
      const rbAfter = snapshotRebates()
      step.cumulativeRebatesAfter = rbAfter.list
      step.rebateChanges = diffRebates(rbBefore.raw, rbAfter.raw)
    }
    steps.push(step)
  }

  function generateGoalsForEntry(entry, evalResult, stepIndex) {
    const project = projectMap.get(entry.projectId)
    if (!project) return

    // 1. Project dependency goals: 虚拟满足，不应用 effects
    const clusterProjectIds = new Set(getRuntimeTerraformingProjectIds(cluster))
    const depGoals = extractUnmetDependencyGoals(
      project.dependencies, runningCompleted, projectMap, clusterProjectIds
    )
    const depIdsChosen: string[] = []
    for (const dg of depGoals) {
      const key = `project:${dg.targetProjectId}`
      const existing = goalEntries.find(g => g.projectGoal?.targetProjectId === dg.targetProjectId)
      if (existing) {
        existing.dependentTaskIds.push(entry.id)
      } else {
        goalEntries.push({
          id: `goal-${++goalSeq}`, kind: 'project', position: stepIndex,
          dependentTaskIds: [entry.id],
          projectGoal: { targetProjectId: dg.targetProjectId },
        })
      }
      // 虚拟完成: 标记 dependency 满足，不应用 effects
      runningCompleted.set(dg.targetProjectId, (runningCompleted.get(dg.targetProjectId) ?? 0) + 1)
      depIdsChosen.push(dg.targetProjectId)
    }

    // 2. Stat condition goals: 计算 delta，实际应用到 runningStats
    for (let ci = 0; ci < project.conditions.length; ci++) {
      const condition = project.conditions[ci]!
      if (checkStatConditionMet(condition, currentStats(), data.stats)) continue
      const targetValue = computeTargetValue(condition, currentStats(), data.stats)
      const currentValue = currentStats()[condition.stat] ?? 0
      
      goalEntries.push({
        id: `goal-${++goalSeq}`, kind: 'stat', position: stepIndex,
        dependentTaskIds: [entry.id],
        statGoal: { statId: condition.stat, currentValue, targetValue },
      })
      
      // 实际应用 stat change: runningStats[stat] = targetValue
      runningStats[condition.stat] = targetValue
    }

    // 3. 重新评估 entry — 现在应该通过
    const afterGoalStats = currentStats()
    const runtimeCluster = { ...cluster, projectIds: getRuntimeTerraformingProjectIds(cluster) }
    const treeAfter = resolveAvailableTasks(runtimeCluster, {
      stats: afterGoalStats, completedProjects: runningCompleted
    }, data)
    const reEval = evaluateTerraformingProjectExecution(
      project, { stats: afterGoalStats, completedProjects: runningCompleted },
      projectMap, (await buildRuntimeClusterForReplay(cluster, data)).clusterProjects, data.stats
    )
    
    // entry 现在应该 valid
    const isValidNow = reEval.valid
    const step: ReplayStep = { projectId: entry.projectId, type: 'task', valid: isValidNow }
    
    if (stepSnapshots) {
      step.statsBefore = afterGoalStats
      step.completedBefore = new Map(runningCompleted)
      const rbBefore = snapshotRebates()
      step.cumulativeRebatesBefore = rbBefore.list
    }
    
    if (isValidNow) {
      runningStats = applyProjectEffectsToTerraformingStats(
        runningStats, new Map([[entry.projectId, 1]]), projectMap, ignoredStats
      )
      runningCompleted.set(entry.projectId, (runningCompleted.get(entry.projectId) ?? 0) + 1)
      applyRebateEntries(entry.projectId, 1)
    }
    
    if (stepSnapshots) {
      step.statsAfter = currentStats()
      step.completedAfter = new Map(runningCompleted)
      const rbAfter = snapshotRebates()
      step.cumulativeRebatesAfter = rbAfter.list
      step.rebateChanges = diffRebates(rbBefore.raw, rbAfter.raw)
    }
    
    steps.push(step)
    
    // 回滚虚拟完成的 project dependency（仅统计，不影响依赖判断）
    for (const pid of depIdsChosen) {
      const c = runningCompleted.get(pid) ?? 0
      if (c > 0) runningCompleted.set(pid, c - 1)
    }
  }

  const maxIterations = 20
  const insertedEventIds = new Set<string>()
  const runtimeProjectIds = new Set(getRuntimeTerraformingProjectIds(cluster))
  const statAffectingEvents = data.projects.filter(
    p => p.group === 'events' && isStatAffectingEvent(p) && runtimeProjectIds.has(p.id)
  )

  // iterative event injection closure
  function injectEventsAtPosition() {
    let triggered = true
    let iter = 0
    while (triggered && iter < maxIterations) {
      triggered = false; iter++
      for (const event of statAffectingEvents) {
        if (event.repeatCooldown === null && insertedEventIds.has(event.id)) continue
        if (event.repeatCooldown === null && (runningCompleted.get(event.id) ?? 0) > 0) continue
        if (checkAllConditions(event.conditions, currentStats(), data.stats)) {
          pushStep(event.id, 'auto-event', true)
          insertedEventIds.add(event.id)
          triggered = true
          break
        }
      }
    }
  }

  // 1. Initial events
  injectEventsAtPosition()

  // 2. Process each log entry
  for (const entry of log) {
    const stepIndex = steps.length
    const project = projectMap.get(entry.projectId)
    
    if (evaluations && project) {
      const beforeStats = currentStats()
      const { clusterProjects } = buildRuntimeClusterForReplay(cluster, data)
      const evalResult = evaluateTerraformingProjectExecution(
        project, { stats: beforeStats, completedProjects: runningCompleted },
        projectMap, clusterProjects, data.stats
      )
      
      if (evalResult.valid) {
        // valid: 正常执行
        pushStep(entry.projectId, 'task', true)
      } else if (goals) {
        // invalid + goals: 生成 goal 使 entry 满足
        generateGoalsForEntry(entry, evalResult, stepIndex)
      } else {
        // invalid + !goals: 跳过 effects
        pushStep(entry.projectId, 'task', false)
      }
    } else {
      // no evaluations flag: always valid
      pushStep(entry.projectId, 'task', true)
    }

    injectEventsAtPosition()
  }

  // 4. End-of-queue events
  injectEventsAtPosition()

  return {
    steps,
    goalEntries,
    finalStats: currentStats(),
    finalCompleted: new Map(runningCompleted),
  }
}
```

## Presenter 变更

### executionTimeline 重构

```
Before:
  computed<TerraformingExecutionTimelineEntry[]> {
    自己维护 completedProjects, sequentialStats
    for 每个 log entry:
      调 evaluateEntry() + resolveAvailableTasks
      算 before/after stats, rebates (computeCumulativeRebates), wares, deliveries
      push 到 results
  }

After:
  computed<TerraformingExecutionTimelineEntry[]> {
    const replayResult = replayExecutionLog(log, cluster, data, {
      flags: { evaluations: true, stepSnapshots: true }
    })
    replayResult.steps 按序读:
      对每个 step: 
        statsBefore/After → 直接取 (引擎已算)
        completedBefore/After → 直接取
        cumulativeRebatesBefore/After → 直接取 (raw ID，presenter 译名)
        rebateChanges → 直接取 (引擎已 diff)
        availableBeforeExecution = step.valid (由 engine evaluation 决定)
        blockedReason = step.evaluation?.reasons (若有)
        + 纯 game data 富化: wares, deliveries, dockModules, deliveryDetails, price, projectDuration
      → push 到 results
  }
```

### computePlanDraftEntries 重构

```
Before:
  自己维护 completedProjects, sequentialStats
  pushTaskEntry() / pushEventEntry() 闭包
  初始 / 每步后 / 末尾 的事件检测循环
  最后调 generateGoalEntries() 做二次重放

After:
  const replayResult = replayExecutionLog(draftLog, cluster, data, {
    flags: { evaluations: true, stepSnapshots: true, goals: true }
  })
  
  replayResult.steps 按序:
    构建 TerraformingDraftTimelineEntry[]
    systemDisabled = !step.valid (引擎标记)
    systemDisabledReason = step.evaluation?.reasons
  
  cumulativeStateAt = replayResult.steps.map(s => ({ stats: s.statsBefore! }))
  
  // goals 来自引擎, 不再单独调 generateGoalEntries
  aggregatedGoals = replayResult.goalEntries
    ↔ 合并同 projectId 的 projectGoal
    ↔ 填充 hasExistingTask 等 display 字段
    ↔ 转换为 TerraformingGoalEntry[] 用于 UI
```

### generateGoalEntries 简化

```
Before:
  内部累积重放 + lifecycle filter 重放 (两轮独立重放)

After:
  generateGoalEntries 被引擎 goalEntries 替代
  仍保留的函数仅做 UI 富化:
    接收 goalEntries → 合并, 去重, 填充 display 字段
    → 输出 TerraformingGoalEntry[] 供 planDisplayEntries 使用
```

### getExecutionCancelValidation 重构

```
Before:
  自己维护 replayCounts
  逐 entry 调 evaluateEntry() + computeTerraformingRuntimeStats()

After:
  const remainingLog = log.filter(..., 移除 K + 级联事件)
  const replayResult = replayExecutionLog(remainingLog, cluster, data, {
    flags: { evaluations: true, stepSnapshots: false }
  })
  replayResult.steps 按序检查:
    若 step.valid 为 false 且 stepIndex >= targetIndex:
      → affectedEntryIds.push(step.projectId)
```

### effective stats / taskTree

```
const effectiveReplayResult = computed(() => {
  const log = isQueueEditing.value ? draftLog : committedLog
  return replayExecutionLog(log, cluster, data, { flags: {} })
})
effectiveCompletedProjects = computed(() => effectiveReplayResult.value.finalCompleted)
effectiveCurrentStats = computed(() => effectiveReplayResult.value.finalStats)
taskTree = computed(() =>
  resolveAvailableTasks(runtimeCluster, {
    stats: effectiveCurrentStats.value,
    completedProjects: effectiveCompletedProjects.value,
  }, data)
)
```

### auto-event 处理

```
Before:
  selectCluster → executeAutoEvents()
  toggleProject (non-edit) → canAppend → append → executeAutoEvents()
  setProjectCount (non-edit) → append → executeAutoEvents()

After:
  selectCluster → replayExecutionLog([], ...) → 将新 event 写 store
  toggleProject (non-edit) → canAppend → append → 
    replayExecutionLog(log, ...) → 计算差异 → 将新 event 追加 store
  setProjectCount (non-edit) 同上
```

## 删除文件/函数清单

| 文件 | 删除内容 |
|------|---------|
| `src/store/logic/terraformingRuntime.ts` | `computeTerraformingRuntimeStats()`, `computeSequentialStatsFromLog()` 函数定义及 export |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | `executeAutoEvents()` |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | `pushTaskEntry()` 闭包 |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | `pushEventEntry()` 闭包 |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | `executionTimeline` 内的 `evaluateEntry()` 闭包和内联循环 |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | `computePlanDraftEntries` 内的内联循环和 auto-event 检测 |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | `generateGoalEntries` 内的累积重放循环和 lifecycle filter 重放 |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | `getExecutionCancelValidation` 内的 `evaluateEntry()` 闭包和内联循环 |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | `executionTimeline` 中对 `computeCumulativeRebates` 的逐步调用 (改为从引擎 step 取 raw ID，presenter 仅译名) |

### 保留但用法变更

| 函数 | 变更 |
|------|------|
| `computeCumulativeRebates()` | 不再每步调用 (O(N×P) → O(1) per step)，引擎产出 raw ID 聚合 |
| `computeProjectDiscount()` | 匹配逻辑改为按 raw ID 匹配，不再按译名匹配 |
| `generateGoalEntries()` | 不再内部重放；改为接收引擎 `goalEntries` 做 UI 聚合 |

## 不修改的文件

| File | 原因 |
|------|------|
| `src/store/useTerraformingStore.ts` | 持久化和 CRUD 不变，引擎是纯计算层 |
| `src/store/useGameDataStore.ts` | 不变 |
| `src/store/useLiveProductionStore.ts` | 不变 |
| `src/store/useBlueprintProductionStore.ts` | 不变 |
| `src/store/logic/terraformingTaskResolver.ts` | 纯数据解析，不变 |
| `src/components/empire/terraforming/*.vue` | 纯展示组件，props 驱动，不变 |
| `src/types/x4.ts` | 不变 |
| `src/locales/*.json` | 不变 |
