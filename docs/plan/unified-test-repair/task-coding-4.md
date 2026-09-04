# Coding Fix Task Contract

- Task: `task-coding-4`
- Bundle generation: `2`
- Plan: `plan-2.md`
- Context: `context-2.md`
- Kind: `coding`
- Mode: `normal`
- Execution strategy: `single-def`
- Worker role: `def_coding_worker`
- Lane: `coding`
- Target branch: `develop`
- Target base: `85255b1ed076ffe7704367959753dc01450bdf89`
- Depends on: `task-coding-3`
- Covers: `none`
- Trigger: `task-test-3` review finding `BUG-001`; bounded coding correction within generation-2
- Control path: `planner -> coding worker -> reviewer -> coding -> target -> integrate -> target`

## Bounded goal

修复 unmatched production goal 因 synthetic `groupId` 被误当作真实 logic-flow lineage 而忽略 `settings.racePreference` 的问题，同时保留 synthetic identity 与真实 line 的既有 lineage 语义。

## Normative references

- `openspec/changes/build-plan-preview/bugs.md`：`BUG-001`
- `openspec/changes/build-plan-preview/request.md`：Module 选择规则与 DoD 13
- `openspec/changes/build-plan-preview/design.md`：5.4 BUG-001 correction
- `openspec/changes/build-plan-preview/tasks.md`：Phase 9 `T34`-`T37`
- `docs/plan/unified-test-repair/review-task-test-3-86c2dd30.md`

这些 OpenSpec correction 是只读规范输入；coding worker 不修改 OpenSpec 或 workflow status。

## Owned paths

- `src/store/logic/buildPlanProductionLine.ts`

## Focused Unit evidence

- Target regression path: `tests/unit/build-flow-plan/buildPlanProductionLine.spec.ts`
- Integrate canonical path after refresh: `tests/unit/current/build-flow-plan/buildPlanProductionLine.spec.ts`
- Existing case: `uses settings.racePreference for unmatched derived module selection`

该 regression 已准确覆盖 `BUG-001`，由 `task-test-3` 拥有；本 fix 只读取并运行，不修改、复制或弱化断言。

## Required behavior

1. `__preview_unmatched__:<index>` 继续作为 preview line 的稳定 `groupId`。
2. `isUnmatched = true` 时，producer module 选择必须使用 `settings.racePreference`，不得根据 synthetic `groupId` 改用 allocation/default lineage。
3. `isUnmatched = false` 的真实 logic-flow line 继续使用该 line 的 lineage；manual/auto 优先级与 `findBestProducer` 行为不变。
4. `buildMaterialPlanningEnabled = false` 与 graph merge 两条 preview 路径必须共享同一语义，不得只修复单一路径。
5. compute 继续消费 preview 已选 `moduleId`，不得在 compute 重选 producer。

## Implementation simplicity

- Standard: `audit-implementation-simplicity`
- Capability disposition: `reuse` 既有 `goalToPreviewItem()`、`findBestProducer()`、`isUnmatched` 与 synthetic id；`extend` 现有调用参数或 allocation 边界，使 identity 与 lineage policy 显式分离。
- 不新增 selector、adapter、fallback 链、兼容分支、类型层或第二套 module-selection owner。
- lineage policy 的唯一判断放在最早同时拥有 `isUnmatched`、`settings.racePreference` 与真实 lineage 的现有边界；两个调用路径只传递该明确语义。
- 保持 `PreviewLinePlan.groupId`、`sourceRef`、`relatedLineGroupIds` 的 identity 表示不变；不把 runtime exception 转成新错误值。
- 修改前核对 `goalToPreviewItem()` 的全部调用者；除关闭 `BUG-001` 所需的最小 coherent delta 外不改相邻 compute/graph 行为。

## Blocking self-validation

- Commands: `npm exec vitest run -- --config vite.config.ts --dir tests/unit/build-flow-plan buildPlanProductionLine.spec.ts -t "uses settings.racePreference for unmatched derived module selection"`; `npm run build`; `git diff --check`

```bash
npm exec vitest run -- --config vite.config.ts --dir tests/unit/build-flow-plan buildPlanProductionLine.spec.ts -t "uses settings.racePreference for unmatched derived module selection"
npm run build
git diff --check
```

focused Unit 必须由 target-base regression 从 red 变 green；不得以修改测试、跳过测试或仅证明其他 worktree 的结果代替。

## Reviewer gate

- Role: `reviewer`
- Input: 基于 `85255b1ed076ffe7704367959753dc01450bdf89` 的 immutable `task-coding-4` candidate commit。
- Artifact: `/home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair/review-task-coding-4-<candidate>.md`
- Pass criteria: owned paths 无越界；unmatched identity 与 lineage policy 已分离；真实 line lineage、两条 preview 路径和 compute contract 未回归；focused Unit、`npm run build`、`git diff --check` evidence 完整；implementation simplicity requirements 满足。
- Verdict: 仅 `passed` 可进入 target；`changes_required` 回同一 fix contract correction，不新建 generation。

## Target-mediated handoff

1. coding lane 从 target base `85255b1ed076ffe7704367959753dc01450bdf89` 刷新并形成 immutable candidate。
2. reviewer `passed` 后，target owner 将 candidate 合入 `develop`。
3. integrate lane 从新的 target HEAD 刷新，禁止 candidate 从 coding 直接合入 integrate。
4. `task-test-3` 在刷新后的 cumulative candidate 上运行 canonical focused Unit 与完整 `npm run test:unit`，经 test reviewer 接受后由 integrate 进入 target。

固定路由：`coding -> target -> integrate -> target`。

## BUG-001 closure

- Evidence owner: `task-coding-4` 提供 source candidate、focused Unit、build 与 reviewer evidence；`task-test-3` 提供 target-visible canonical focused/full Unit 与 test review evidence。
- Closure owner: target owner。
- Closure gate: source candidate 已进入 target，integrate 已从该 target 刷新，canonical focused Unit、完整 Unit、build 与两次 reviewer gate 均通过。
- Closure action: target owner 将 `BUG-001` 标记为 closed，并同步 Phase 9 `T34`-`T37`；在 gate 前不得提前关闭。

## Exclusions and stop conditions

- 不修改任何 `tests/**`、OpenSpec、presenter/Vue、compute、build-flow 数据模型、fixture、runner 或 package scripts。
- 不新增依赖或测试场景。
- 若正确修复需要超出 owned path、改变已冻结业务语义或现有 regression 不能证明 BUG-001，则返回 `contract_blocked`，不得扩大范围。

## Observable completion

- Terran unmatched case 返回 `module_ter_prod_energycells_01`。
- synthetic `groupId` 保留，真实 line lineage 行为不变。
- candidate 通过 self-validation 与 reviewer，且只经 target-mediated route 交给 `task-test-3`。

## Handoff

返回 exact base/candidate、changed paths、`goalToPreviewItem()` caller trace、capability dispositions、命令/exit/result、review artifact 与未关闭 caveat；不得 stage、commit、merge 或更新 OpenSpec/workflow status。
