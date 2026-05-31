# terraforming-replay Specification

## Purpose

定义统一的 terraforming 顺序重放引擎，将当前分散在 presenter、runtime、auto-event 三处的重放逻辑合并为单一纯函数。引擎接收任意有序 log，迭代到收敛（含 auto-event 注入），通过 flags 控制产出内容。

## ADDED Requirements

### Requirement: replayExecutionLog MUST 提供统一顺序重放

系统 MUST 在 `terraformingRuntime.ts` 中提供 `replayExecutionLog()` 纯函数。

**前提** 提供有序 log `{ projectId: string }[]` 与 cluster、data

**当** 调用 `replayExecutionLog(log, cluster, data, options)`

**那么** MUST 返回 `TerraformingReplayResult { steps, goalEntries, finalStats, finalCompleted }`

**并且** 引擎 MUST 闭包内维护 running stats、runningCompleted、runningRebates，每 step 增量应用 effect

**并且** `ReplayStep` MUST 包含 `projectId`, `type: 'task' | 'auto-event'`, `valid: boolean`

**当** `flags.goals === true` 且 step 的 evaluation invalid

**那么** 引擎 MUST:
- 对 unmet **project dependency** 生成 projectGoal，虚拟满足 dependency（不应用 effects）
- 对 unmet **stat condition** 生成 statGoal，计算 delta 并应用到 runningStats（实际变化）
- goal 全部满足后重新评估 entry → entry 转为有效 → 应用 entry 的 effects → 继续

**当** `flags.goals === false` 且 step 的 evaluation invalid

**那么** 引擎 MUST 跳过该 entry 的 effects，标记 `valid: false`，继续重放后续 entry

#### Scenario: 引擎 MUST 在初始状态检测 auto-event

**前提** 调用引擎且初始 stats 满足某个 event 的 conditions

**并且** 该 event 未被插入过且 (repeatCooldown !== null 或 已完成次数 = 0)

**当** 引擎开始重放

**那么** MUST 在 steps[0] 之前插入 auto-event step

**并且** 引擎 MUST 从该 event 插入后继续检测连锁 event

#### Scenario: 引擎 MUST 在每个 task entry 之后检测 auto-event

**前提** 引擎正在重放第 i 个 task entry

**并且** 应用其 effect 后 stats 发生变化

**当** 第 i 个 task entry 处理完毕

**那么** MUST 检测所有影响 stat 的 event 是否触发

**并且** MUST 在同一位置插入触发的 event steps

**并且** 引擎 MUST 从该 event 插入后继续检测（直到不触发或超 maxIterations）

#### Scenario: 引擎 MUST 在队列末尾检测 auto-event

**前提** 所有 task entries 处理完毕

**当** 引擎到达队列末尾

**那么** MUST 再次检测所有影响 stat 的 event 是否触发

**并且** MUST 在末尾插入触发的 event steps

#### Scenario: 可重复 event MUST 由 event 属性允许再次触发

**前提** event X 的 `repeatCooldown !== null`

**并且** event X 已在之前被有效触发

**当** 后续 replay 位置再次满足 event X 的 conditions

**那么** 引擎 MUST 允许 event X 再次触发

**并且** MUST NOT 使用全局 `projectId` 去重阻止该 occurrence

#### Scenario: ONE_TIME 事件已完成时跳过

**前提** event Y 的 `repeatCooldown === null`

**并且** event Y 已被有效触发

**当** stats 满足其 conditions

**那么** MUST NOT 再次插入该事件

### Requirement: ReplayOptions.flags MUST 控制附加产出与行为

引擎 MUST 通过 `ReplayOptions.flags` 控制是否产出附加数据。

**前提** `ReplayOptions` 包含 `mode?: 'committed' | 'draft'` 与 `flags.goals`, `flags.evaluations`, `flags.stepSnapshots`

**当** `flags.goals === true`

**那么** 引擎遇到 evaluation invalid 的 entry 时 MUST 生成 GoalEntry（从 unmet stat condition 和 project dependency 推导）

**并且** MUST NOT 应用该 entry 的 effects

**并且** MUST 继续重放后续 entry

**当** `flags.goals === false`

**那么** 引擎 MUST NOT 生成 GoalEntry

**并且** invalid entry MUST 跳过 effects 且 MUST 继续重放后续 entry

**当** `flags.evaluations === true`

**那么** 每个 `ReplayStep` MUST 包含 `evaluation: TerraformingExecutionEvaluation`（调用 `evaluateTerraformingProjectExecution` + `resolveAvailableTasks`）

**并且** `ReplayStep.valid` MUST 等于 `evaluation.valid`

**当** `flags.evaluations === false`

**那么** 引擎 MUST NOT 调用 `resolveAvailableTasks` 或 `evaluateTerraformingProjectExecution`

**并且** `ReplayStep.valid` MUST 为 `true`

**当** `flags.stepSnapshots === false`

**那么** `ReplayStep` MUST NOT 包含 `statsBefore/After`、`completedBefore/After`、`cumulativeRebatesBefore/After`、`rebateChanges`

**当** `options.mode` 未指定

**那么** 引擎 MUST 按 `mode: 'committed'` 处理。

#### Scenario: goal 对 any(completed A, completed B) MUST 生成两条

**前提** entry 的 dependency 为 `any(completed A, completed B)` 且 A 和 B 均未完成

**当** 引擎 `goals` flag 打开且该 entry evaluation invalid

**那么** MUST 生成两条 projectGoal（A 和 B 各一条）

**并且** 两条 goal MUST 共用同一组 `dependentTaskIds`

#### Scenario: any(notCompleted B, completed C) 且 B 未完成 MUST NOT 生成 goal

**前提** entry 的 dependency 为 `any(notCompleted B, completed C)` 且 B 未完成

**当** 引擎 `goals` flag 打开

**那么** MUST NOT 生成 goal（`notCompleted` 分支已满足）

#### Scenario: goal MUST NOT 应用 project effects

**前提** 引擎生成了一个 **projectGoal**（虚拟满足 dependency）

**当** goal 被应用

**那么** MUST NOT 修改 runningStats

**并且** MUST NOT 应用该 project 的 stat effects 或 rebates

**并且** MUST 标记 `runningCompleted`（虚拟完成），然后在当前 entry 处理完毕后回滚

#### Scenario: stat goal MUST 实际应用 stat change

**前提** entry 的 condition 要求 stat S 达到 targetValue V，当前 currentStats[S] = Cv

**当** 引擎生成 statGoal 并应用

**那么** MUST 设置 `runningStats[S] = V`（实际修改）

**并且** 应用后满足的 entry MUST 通过重新评估变为 valid

### Requirement: replay MUST 按当前位置消费或排除 log 中的 event

引擎 MUST 使用 cursor 从左到右解释 log，event step 的权威来源是 replay 计算，不是 log 原文。

**前提** replay 在当前位置计算出应触发 event E

**当** cursor 指向的下一条 log entry 正好是 E

**那么** 引擎 MUST 消费该 log entry，输出一个 `type: 'auto-event', valid: true` 的 E step，并应用 E effects

**当** cursor 指向的下一条 log entry 不是 E

**那么** 引擎 MUST 插入一个新的 E step，应用 E effects，并且 MUST NOT 消费 cursor 指向的 log entry

**并且** 引擎 MUST NOT 扫描 cursor 之后的全部 log 来判断 E 是否已经存在

#### Scenario: future 同名 event MUST NOT 阻止当前位置插入

**前提** log 为 `task A, task B, event X`

**并且** replay 在 task A 后计算出 event X 应触发

**当** task A 处理完毕

**那么** 引擎 MUST 在 task A 和 task B 之间插入 event X

**并且** 后续 cursor 遇到原 log 中的 event X 时，若当前位置不再计算出 X，应按 mode 处理 stale/misplaced event

#### Scenario: immediate next event MUST 被当前位置触发替换

**前提** log 为 `task A, event X, task B`

**并且** replay 在 task A 后计算出 event X 应触发

**当** task A 处理完毕

**那么** 引擎 MUST 消费 log 中紧随 task A 的 event X

**并且** MUST 只输出一条 event X step，不得重复插入。

#### Scenario: draft mode stale event MUST 被排除

**前提** `options.mode === 'draft'`

**并且** cursor 当前 entry 是 event X

**当** 当前 replay 位置没有计算出 event X 应触发

**那么** 引擎 MUST 排除 event X，不输出 step，不应用 effects。

#### Scenario: committed mode stale event MUST 标为 invalid

**前提** `options.mode === 'committed'`

**并且** cursor 当前 entry 是 event X

**当** 当前 replay 位置没有计算出 event X 应触发

**那么** 引擎 MUST 输出 `type: 'auto-event', valid: false` 的 event X step

**并且** MUST NOT 应用 event X effects。

#### Scenario: blocked stat event 即使在 log 中也 MUST 按 stale 处理

**前提** `flags.goals === true`

**并且** stat goal 已阻断 stat S

**并且** event X 的 conditions 包含 stat S

**当** cursor 遇到 event X

**那么** 引擎 MUST NOT 因 log 中存在 event X 而强制执行它

**并且** draft mode MUST 排除 X，committed mode MUST 标记 X invalid。

### Requirement: executionTimeline MUST 通过引擎获得数据

`executionTimeline` computed MUST 调用 `replayExecutionLog()` 获取 `ReplayResult`，MUST NOT 内联维护顺序循环。

**前提** 非编辑模式且 committed log 非空

**当** `executionTimeline` computed 执行

**那么** MUST 调用 `replayExecutionLog(log, cluster, data, { flags: { evaluations: true, stepSnapshots: true } })`

**并且** MUST 从 `ReplayResult.steps` 构建 `TerraformingExecutionTimelineEntry[]`

**并且** MUST 对每个 step 进行 display 富化（rebates、wares、delivery 等）

**并且** display 富化逻辑 MUST NOT 混入 stats 计算

**并且** 当同一 `projectId` 在 committed log 中重复出现时，timeline entry 的 `id` MUST 按 replay step 顺序消费对应 log entry occurrence，MUST NOT 通过 `projectId` 查找第一条匹配 entry

### Requirement: computePlanDraftEntries MUST 通过引擎获得数据（含 goals）

`computePlanDraftEntries()` MUST 调用 `replayExecutionLog()` 获取 `ReplayResult`，MUST NOT 内联维护顺序循环和 `pushTaskEntry`/`pushEventEntry` 闭包。

**前提** 编辑模式且 `draftExecutionLog` 非空

**当** `computePlanDraftEntries()` 执行

**那么** MUST 调用 `replayExecutionLog(log, cluster, data, { flags: { evaluations: true, stepSnapshots: true, goals: true } })`

**并且** `draftReplayEntries` 从 `ReplayResult.steps` 构建 `TerraformingDraftTimelineEntry[]`，`systemDisabled` 由 `!step.valid` 决定

**并且** `generatedGoals` 从 `ReplayResult.goalEntries` 聚合推导（合并同 projectId 的 projectGoal，填充 display 字段），不再调用独立重放

**并且** `cumulativeStateAt` 从 `ReplayResult.steps[i].statsBefore` 构建

#### Scenario: 互斥 task MUST 由 engine evaluation 自然标记无效

**前提** entry A（先入队）已完成，entry B（后入队）dependency 含 `notCompleted A`

**当** 引擎重放到 entry B

**那么** `evaluateTerraformingProjectExecution` MUST 返回 `valid: false`（A 已完成，违反 `notCompleted`）

**并且** 引擎 MUST NOT 试图生成 goal（`notCompleted` 不可通过执行 project 修复）

**并且** entry B MUST 被标记 `valid: false`

#### Scenario: cluster goal MUST 由 presenter 从最终状态生成

**前提** 引擎产出 `finalStats` 和 `finalCompleted`

**当** cluster objective 不满足（`objective.build_project X` 未完成或 `objective.build_housing` population 未达标）

**那么** presenter MUST 从 `replayResult.finalStats` / `replayResult.finalCompleted` 判断并生成 clusterGoal

**并且** cluster goal MUST NOT 进入引擎循环（不依赖中间步骤）

#### Scenario: 预防型 goal MUST 由 presenter 从最终状态生成

**前提** 引擎产出 `finalStats`

**当** 非 stat 影响事件的 conditions 均满足

**那么** presenter MUST 从 `replayResult.finalStats` 判断生成 `kind: 'preventive'` 的 goal

**并且** 预防型 goal MUST NOT 进入引擎循环

### Requirement: generateGoalEntries MUST 简化为 UI 聚合适配器

`generateGoalEntries()` MUST 改为接收引擎的 `GoalEntry[]` 做 UI 聚合，MUST NOT 内部重放。

**前提** 引擎已产出 `ReplayResult.goalEntries`

**当** presenter 处理 goal

**那么** `generateGoalEntries()` MUST 接收 `goalEntries: GoalEntry[]` + `draftEntries` + `pmap` + display 参数

**并且** MUST 合并同 `projectId` 的 projectGoal，合并同 `statId + targetValue` 的 statGoal

**并且** MUST 填充 `hasExistingTask`、`existingDraftEntryId` 等 display 字段

**并且** MUST NOT 内部维护 stats 循环或 lifecycle filter 循环

**理由**: goal 语义数据已由引擎在单次重放中产出，presenter 仅做 UI 聚合。

#### Scenario: 「移动到此处」按钮 MUST 保持正常工作

**前提** 引擎产出 `goalEntries` 含 `targetProjectId`

**当** 用户后续将 target project 添加到 draft queue

**那么** presenter MUST 交叉比对 `goalEntries` 与 `draftEntries` 设置 `hasExistingTask: true`

**并且** UI MUST 渲染「移动到此处」按钮

**并且** 此行为不受引擎变更影响（引擎产出 raw data，presenter 做 UI 聚合）

#### Scenario: 插入到 goal 对应位置 MUST 不受影响

**前提** 用户点击 task 加入 queue

**当** `resolveInsertIndex` 根据 goal 的 `position` 确定插入位置

**那么** 新引擎的 `GoalEntry.position`（step index）MUST 与现状 `generatedGoals.position` 语义一致

**并且** `resolveInsertIndex` 逻辑 MUST NOT 因引擎变更而变化

### Requirement: getExecutionCancelValidation MUST 通过引擎获得数据

`getExecutionCancelValidation()` MUST 调用 `replayExecutionLog()` 获取 `ReplayResult`，MUST NOT 内联维护顺序循环。

**前提** 取消 entry K

**并且** 移除 K 以及 K 后面连续紧邻的所有 event entry 后的剩余 log 为 `remainingLog`

**当** 调用引擎

**那么** MUST 调用 `replayExecutionLog(remainingLog, cluster, data, { flags: { evaluations: true, stepSnapshots: false } })`

**并且** MUST NOT 内联循环或调用 `resolveAvailableTasks`

**并且** 这次 replay MUST 允许重新插入仍由 remaining log 触发的 event；若重新插入 event 后后续 task 全部 valid，则 MUST 允许 cancel。

**并且** 实现 MAY 从被取消 task 的上一个保留 entry 的 replay state 开始重放 suffix；该优化 MUST 与整条 `remainingLog` 重放得到相同 validation 结果。

#### Scenario: cancel validation MUST remove all contiguous events after target task

**前提** execution log 为 `task A, event X, event Y, task B`

**当** 对 `task A` 执行 cancel validation

**那么** `remainingLog` MUST 为 `task B`

**并且** `event X` 和 `event Y` MUST NOT 作为 stale event 参与 validation

#### Scenario: cancel validation MUST stop removing at next task

**前提** execution log 为 `task A, event X, task B, event Y`

**当** 对 `task A` 执行 cancel validation

**那么** `remainingLog` MUST 为 `task B, event Y`

**并且** `task B` MUST 保留用于判断后续 task 是否仍 valid

### Requirement: effectiveCurrentStats 和 effectiveCompletedProjects MUST 从引擎派生

Presenter 的 `effectiveCurrentStats` 和 `effectiveCompletedProjects` computed MUST 从引擎的 `ReplayResult.finalStats` 和 `ReplayResult.finalCompleted` 派生。

**前提** committed log 或 draft log 不为空

**当** 计算 effective stats 时

**那么** MUST 调用引擎获取 `ReplayResult`

**并且** `effectiveCurrentStats` MUST 等于 `ReplayResult.finalStats`

**并且** `effectiveCompletedProjects` MUST 等于 `ReplayResult.finalCompleted`

### Requirement: stepSnapshots MUST 包含累计折扣快照

`stepSnapshots` flag 打开时，引擎 MUST 在 `ReplayStep` 中提供累计折扣数据。

**前提** `flags.stepSnapshots === true`

**当** 引擎记录 step

**那么** `ReplayStep` MUST 包含:
- `cumulativeRebatesBefore/After: RebateKey[]` — 按 raw `wareGroup`/`ware` ID 聚合的累计折扣值
- `rebateChanges: Array<{ key: RebateKey; before: number; after: number }>` — 本步折扣变化（引擎 diff）

**并且** `RebateKey` MUST 包含 `id: string`, `type: 'wareGroup' | 'ware'`, `value: number`

**并且** 引擎 MUST 闭包内增量维护 `runningRebates`，每步仅处理当前 project 的 rebates

**并且** presenter MUST 消费 raw ID 进行译名

### Requirement: computeCumulativeRebates MUST 不再被逐步调用

Presenter 的 `executionTimeline` 和其他 display 逻辑 MUST 从引擎 step 取累计折扣 raw ID，MUST NOT 逐 step 调用 `computeCumulativeRebates()`。

**理由**: 引擎已乘积维护累计折扣并产出 snapshots，presenter 不需要重复计算。

### Requirement: computationalDiscount MUST 按 raw ID 匹配

`computeProjectDiscount()` MUST 改为按 raw ID 匹配折扣，MUST NOT 按译名匹配。

**前提** 引擎产出 raw ID 的 `cumulativeRebates` 和 `rebateChanges`

**当** `computeProjectDiscount` 判断某个 ware 是否受折扣影响

**那么** MUST 用 `wareGroupMap.get(w.ware)` 匹配 `RebateKey.type === 'wareGroup'` 的 `id`

**并且** MUST 用 `w.ware` 匹配 `RebateKey.type === 'ware'` 的 `id`

### Requirement: selectCluster 和 appendExecution 后 MUST 统一走引擎

非编辑模式 cluster 切换（空队列）和 append 操作后，引擎 MUST 处理 auto-event 注入。

持久化 execution log MUST 被视为 `projectId[]` 序列；`TerraformingExecutionEntry.id` 只是 hydrate 后供 UI 删除、展开和缓存使用的内存临时标识，MUST NOT 参与 replay 业务判断。

当 presenter 需要为 timeline、取消按钮或展开状态保留 `TerraformingExecutionEntry.id` 时，该 id MUST 只作为 UI 临时标识使用；重复 `projectId` 的多次 occurrence MUST 保持各自 log entry id，不得合并或引用第一次 occurrence。

event MUST 被视为 replay 从 task 序列派生出的 canonical projectId，不存在独立业务身份。log 中已有的 event 只是上一次 replay 派生后写入的 projectId；若后续 replay 不再生成该 event，canonical sync MUST 移除它。

**前提** `selectCluster` 后 executionLog 为空

**当** 需要执行初始 auto-event

**那么** MUST 调用 `replayExecutionLog([], cluster, data, { mode: 'draft', flags: {} })` 获取 canonical `ReplayResult`

**并且** MUST 将 store execution log 替换为 `ReplayResult.steps.map(step => step.projectId)` 对应的 projectId 序列

**前提** `appendTerraformingProjectExecution` 完成后

**当** 需要检查 auto-event

**那么** MUST 调用 `replayExecutionLog(log, cluster, data, { mode: 'draft', flags: {} })` 获取 canonical `ReplayResult`

**并且** MUST 将 store execution log 替换为 `ReplayResult.steps.map(step => step.projectId)` 对应的 projectId 序列

**并且** MUST NOT 通过“原 log 是否包含同名 event projectId”判断是否追加 event。

#### Scenario: misplaced existing event MUST NOT suppress canonical auto-event

**前提** execution log 中已存在 `event X`

**并且** replay 在后续追加的 `task A` 后才生成 `event X`

**当** 非 edit 模式执行 auto-event sync

**那么** store 中 canonical projectId 序列 MUST 为 `task A, event X`

**并且** 原先错位的 `event X` MUST NOT 保留在原位置。

### Requirement: event 阻断 MUST 基于 stat goal 阻止后续 auto-inject

引擎 MUST 维护 `blockedStatIds`（事件条件涉及且已被 goal 阻断的 stat 集合）。

**前提** `flags.goals === true`

**并且** 某 entry 的 evaluation invalid

**当** 该 entry 的 conditions 中有未被满足的 stat，且该 stat 在 `eventStatIds`（来自所有事件的 condition stat 集合）中

**那么** 该 stat MUST 被加入 `blockedStatIds`

**并且** 后续的 per-entry 和 end-of-queue 的 `injectEventsAtPosition` MUST 跳过条件涉及已阻断 stat 的事件

**并且** 初始 phase 的 injection（`injectEventsAtPosition(true)`）MUST NOT 受阻断影响

### Requirement: deriveAirPressure MUST 在 airpressure goal 后调节

引擎在 `generateGoalsForEntry` 中 MUST：

**前提** airpressure 为派生 stat（由氧气+甲烷+CO2 的 `floor(总和/4)` 贡献）

**当** stat conditions 按「氧气/甲烷/CO2 在前，airpressure 在后」顺序处理后

**并且** `runningStats['airpressure']` 在 goal 循环中被修改

**那么** MUST 计算当前气体贡献：`currentContrib = floor((oxygen + methane + CO2) / 4)`，initialContrib = `floor(初始气体/4)`

**并且** MUST 设置 `runningStats['airpressure'] = runningStats['airpressure'] - (currentContrib - initialContrib)`，使随后的 `deriveAirPressure` 将值准确推到目标 state

### Requirement: predecessors MUST 生成 project goal

引擎的 `generateGoalsForEntry` MUST 检查 `project.predecessors`（非仅 `dependencies`）：

**前提** project 有 type=`project` 的 predecessors

**当** `any` predecessors 均未完成

**那么** MUST 为每个 any predecessor 生成 projectGoal（目标 `ref`）

**当** 非-`any` predecessor 未完成

**那么** MUST 为该 predecessor 生成 projectGoal

### Requirement: GoalEntry.statGoal MUST 包含 targetStatConditionIndex

`GoalEntry.statGoal` MUST 包含 `targetStatConditionIndex: number` 字段，记录该 stat goal 对应 project 的 conditions 数组中第几个 condition。presenter 的 `statGoalLineModels` 依赖此字段定位条件定义。

### Requirement: 预防型 goal satisfier MUST 插入队列最前端

`resolveInsertIndex` MUST 检查预防型 goal（`kind === 'preventive'`），若待插入的 project 的 effects 命中预防型 goal 的 `targetStatId`，MUST 返回 0（队列最前端）。

## REMOVED Requirements

### Requirement: computeSequentialStatsFromLog MUST 删除

**理由**: 被 `replayExecutionLog()` 完全替代。

**前提** 所有调用处已改为 `replayExecutionLog()`

**当** 代码中存在 `computeSequentialStatsFromLog` 定义

**那么** MUST 移除该函数及所有 import 引用

### Requirement: computeTerraformingRuntimeStats MUST 删除

**理由**: 基于计数的聚合方式在存在 effect 上下限时会产生不正确的结果，且被引擎的顺序重放替代。

**前提** 所有调用处已改为 `replayExecutionLog()`

**当** 代码中存在 `computeTerraformingRuntimeStats` 定义

**那么** MUST 移除该函数及所有 import 引用

### Requirement: executeAutoEvents MUST 删除

**理由**: auto-event 注入已在引擎内部完成。

**前提** 非编辑模式事件注入改为通过引擎

**当** 代码中存在 `executeAutoEvents` 函数

**那么** MUST 移除该函数及所有调用

### Requirement: pushTaskEntry / pushEventEntry 闭包 MUST 删除

**理由**: 被引擎的 step 生成替代。

**前提** `computePlanDraftEntries` 改为从引擎读取

**当** 代码中存在这两个闭包

**那么** MUST 移除

### Requirement: 三处内联顺序循环 MUST 删除

**理由**: executionTimeline、computePlanDraftEntries、getExecutionCancelValidation 中各自维护的顺序循环被引擎替代。

**前提** 三处均改为调引擎

**当** 代码中存在这些内联循环

**那么** MUST 移除对应的循环逻辑和局部变量（`sequentialStats`, `completedProjects` 等）

## MODIFIED Requirements

### Requirement: TerraformingPresenterStore 接口 MUST 调整

**前提** 从引擎获得 stats 后

**当** presenter 初始化

**那么** `TerraformingPresenterStore` MUST 移除独立的 `terraformingCurrentStats` 和 `terraformingCompletedProjects` computed 要求

**并且** MUST 新增 `terraformingReplayLog(flags): TerraformingReplayResult` 或等价的引擎入口

**理由**: presenter 不再需要从 store 取这两个 computed（它们本身也不再存在），而是从引擎结果派生。
