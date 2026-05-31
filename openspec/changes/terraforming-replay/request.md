# Terraforming Replay — 统一重放引擎

## 目标

将当前分散在 presenter、runtime、auto-event 三处的 6 种重放逻辑合并为一个位于 store 层的统一顺序重放引擎。引擎接收任意有序 log（committed 或 draft），迭代到收敛（含 auto-event 注入），通过 flags 控制产出内容，消除重复的顺序循环和 O(N²) 的无效重算。

## 已确认方案（审核重点）

### 核心引擎位置与职责

1. 引擎位于 `src/store/logic/terraformingRuntime.ts`，**纯函数**，不依赖 Pinia 或响应式。
2. 输入：有序 log + cluster + data；输出：`TerraformingReplayResult`。
3. 引擎 **闭包内维护 running stats**，增量应用每个 entry 的 effect（O(E) per step），不每步重建。

### 迭代到收敛（auto-event 内化）

4. 引擎内部在以下三个位置检测并注入 auto-event：
   - 初始状态（log 开头）检测
   - 每个 task entry 之后检测
   - 队列末尾检测
5. 任意位置检测到 event 触发后，注入 event step，并从该位置继续检测（连锁触发），直到该位置不再有新 event 或超出最大迭代轮数（当前的 20）。
6. 引擎返回的 `ReplayResult.steps` 中包含 auto-event step，由 `type: 'auto-event'` 标记。

### 统一的 `TerraformingReplayResult`

```typescript
interface ReplayStep {
  projectId: string
  type: 'task' | 'auto-event'
  statsBefore: Record<string, number>
  statsAfter: Record<string, number>
  completedBefore: Map<string, number>
  completedAfter: Map<string, number>
}

interface TerraformingReplayResult {
  steps: ReplayStep[]
  finalStats: Record<string, number>
  finalCompleted: Map<string, number>
}
```

### Flags 控制附加产出

7. `ReplayOptions.flags.goals` — 控制 goal 生成，仅在 edit 模式需要。
8. `ReplayOptions.flags.evaluations` — 控制每步是否产出 `evaluation`（调用 `evaluateTerraformingProjectExecution` + `resolveAvailableTasks`），executionTimeline 和 edit mode 需要。
9. `ReplayOptions.flags.stepSnapshots` — 控制 `ReplayStep` 是否包含 `statsBefore/After`、`completedBefore/After`，取消 validation 不需要。
10. 引擎闭包内核心循环只有一份，flags 只控制「是否额外记录」，不改变循环结构。

### 各场景使用方式

| 场景 | goals | evaluations | stepSnapshots | 备注 |
|------|-------|-------------|---------------|------|
| executionTimeline (非Edit) | ❌ | ✅ | ✅ | 从 ReplayResult 读取 steps，加 display 富化 |
| computePlanDraftEntries (Edit) | ✅ | ✅ | ✅ | 从 ReplayResult 读取 steps + goals，加 draft display |
| cancel validation (非Edit) | ❌ | ✅ | ❌ | 移除 K 及级联事件后重放，检查后续 entry 的 evaluation |
| executeAutoEvents | — | — | — | 引擎内部处理，不再独立存在 |

### Cancel Validation

11. cancel validation 保持懒计算：展开/点击取消时才跑。
12. append 后不重算已有项的 cancel validation（维持现状）。
13. 取消 entry K 时，级联移除 K 及紧随 K 的 auto-event（这些 event 由 K 触发，移除 K 后不再成立），用移除后的 log 跑引擎。

### 删除清单

14. `computeSequentialStatsFromLog()` — 被引擎覆盖。
15. `computeTerraformingRuntimeStats()` — 被引擎覆盖。
16. **presenter 内部三处内联顺序循环** — 改为读引擎结果。
17. `executeAutoEvents()` — 引擎内化。
18. `pushTaskEntry()` / `pushEventEntry()` 闭包 — 引擎内化。
19. `generateGoalEntries()` **内部的累积重放** — 改为接收 `ReplayResult`，不再内部重放。
20. `generateGoalEntries()` **内部的 lifecycle filter 重放** — 同上。

### Presenter 简化

21. `executionTimeline` computed 改为调用引擎 + 加 display 富化（rebates、ware、delivery 等）。
22. `computePlanDraftEntries` 改为调用引擎 + 加 draft 特有 display + goal 生成。
23. `generateGoalEntries` 接收 `TerraformingReplayResult` 参数，不再内部重放。
24. `effectiveCurrentStats` / `effectiveCompletedProjects` / `taskTree` 从引擎结果派生。
25. `getExecutionCancelValidation` 用引擎（不需要 stepSnapshots，只需要 evaluations）。

### Event 注入收敛规则

26. 引擎注入 event 前检查 `upcomingLogHasEvent(event.id)`：若 log 中存在同名 event，不重复注入。
27. edit 模式下，goals flag 打开时：若某 entry 的 unmet stat condition 的 stat 属于事件的 condition stat 集合，该 stat 被阻断，后续 per-entry 和 end-of-queue 的 auto-event injection 跳过条件涉及已阻断 stat 的事件。初始 phase 不受影响。

### Goal 生成规则

28. engine 的 goal 生成检查 `project.predecessors`（非仅 `dependencies`）：
    - `type: 'project', any` → 均未完成则生成所有成员 projectGoal
    - `type: 'project', !any` → 每个未完成成员独立生成 projectGoal
29. `GoalEntry.statGoal` 必须包含 `targetStatConditionIndex: number`，记录该 stat goal 对应的 project conditions 数组索引，供 UI 定位条件定义。
30. airpressure 是派生 stat（由氧气+甲烷+CO2 导出），engine 在 goal 循环中：
    - 按依赖排序（airpressure 在气体 stat 之后处理）
    - airpressure goal 设定后，减除当前气体贡献，使 `deriveAirPressure` 重算后恰好落在目标值
31. presenter 的 `resolveInsertIndex` 检查预防型 goal：若待插入 project 的 effects 命中预防型 goal 的 `targetStatId`，插入到队列最前端（position 0）。

### 接口变更

26. `useTerraformingStore` 不新增 mutation，不改变持久化。引擎是纯计算层。
27. `TerraformingPresenterStore` 接口增加 `terraformingReplayLog(flags): TerraformingReplayResult`（或等价计算入口），移除 `terraformingCurrentStats`、`terraformingCompletedProjects` 的直接暴露（改为从 replay 结果派生）。
28. presenter 中 `executeAutoEvents()` 移除，execution log 增删后 presenter 直接调引擎跑一次拿到最终 auto-event 插好的结果，将新增的 event 写回 store。

### 复杂度收益

| 场景 | 当前 | 统一引擎后 |
|------|------|-----------|
| executionTimeline | O(N² × E) | O(N × E) |
| computePlanDraftEntries | O(N² × E) | O(N × E) |
| cancel validation (单次) | O(N² × E) | O(N × E) |
| executeAutoEvents | O(N × E × I) | 内化，无额外开销 |

## 边界

### In Scope

- 在 `terraformingRuntime.ts` 中实现 `replayExecutionLog()`
- `TerraformingReplayResult` / `ReplayStep` 类型定义
- `ReplayOptions` + flags 定义
- `useTerraformingPresenter` 中所有重放路径改为调引擎
- `generateGoalEntries` 签名变更（接收 `ReplayResult`）
- 删除 `computeSequentialStatsFromLog`、`computeTerraformingRuntimeStats`、`executeAutoEvents`
- 删除 presenter 三处内联循环、`pushTaskEntry`/`pushEventEntry` 闭包
- event blocking（stat goal 阻断后续 auto-event injection）
- predecessors goal 生成（`project.predecessors` 检查）
- 预防型 goal satisfier 前端插入（`resolveInsertIndex` 返回 0）
- deriveAirPressure goal 调节（airpressure 按依赖排序 + 气体贡献减除）
- `npm run build` 无编译错误

### Out of Scope

- 测试编写与执行
- Store 持久化 schema 修改（不涉及）
- UI 组件修改（组件通过 props 消费，行为不变）
- Export/Import 修改
- Cancel validation 懒计算策略变更（维持现状行为）

## 验收标准（DoD）

1. 所有现有功能在重构前后行为一致：non-edit timeline 展示、edit mode queue 编辑、goal 生成、auto-event 触发、cancel validation。
2. `executionTimeline`、`computePlanDraftEntries`、`getExecutionCancelValidation` 均通过引擎获得顺序 stats，不再各自维护循环。
3. `generateGoalEntries` 接收 `TerraformingReplayResult`，内部再无重放。
4. `computeTerraformingRuntimeStats` 和 `computeSequentialStatsFromLog` 已删除。
5. `executeAutoEvents` `pushTaskEntry` `pushEventEntry` 已移除。
6. 引擎的 ReplayResult 中的 stats 与当前多种重放路径的 stats 一致（无上下限处理误差）。
7. 引擎正确执行 event 阻断（stat goal 产生后，auto-event 条件涉及该 stat 的事件不触发）。
8. 引擎正确生成 predecessors 对应的 project goal。
9. 预防型 goal satisfier 插入到队列最前端。
10. `GoalEntry.statGoal.targetStatConditionIndex` 已填充，UI 可据此显示 stat 变化。
11. 引擎正确调节 deriveAirPressure（gas contribution 减除），使 airpressure goal 的目标值在 `deriveAirPressure` 重算后准确落在目标 state。
12. `npm run build` 无编译错误。

## 未决项

无。
