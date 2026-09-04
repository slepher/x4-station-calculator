# Review: task-coding-4 candidate `af6c5423`

Status: complete

Task: `task-coding-4`（unified-test-repair generation-2）

Reviewed commit: base `5ad351e8b80d2bcd710793e1b15a407d5396b8b6` → candidate `af6c54239517001672708a3e84185c2ece2de764`

## Evidence

- Candidate 边界：coding worktree clean，HEAD 精确为 candidate；candidate 的唯一 parent 与 merge-base 均为 `5ad351e8b80d2bcd710793e1b15a407d5396b8b6`。
- Owned path：`git diff --name-status 5ad351e8 af6c5423` 仅为 `M src/store/logic/buildPlanProductionLine.ts`；差异为 5 行（4 additions、1 deletion），无 tests、OpenSpec、compute、类型、presenter/Vue、fixture、runner 或 package script 改动。
- `goalToPreviewItem()` caller trace：全仓仅 2 个生产调用方，均在 owned file 内：
  - `mergeGraphAndAllocationLines()`：graph merge 路径传入 `alloc.isUnmatched`。
  - `buildAllocationOnlyPreviewLines()`：`buildFlowView = null` 与 `buildMaterialPlanningEnabled = false` 共用路径传入 `alloc.isUnmatched`。
- Identity/lineage：`buildUnmatchedPreviewGroupId(index)` 未改，仍返回 `__preview_unmatched__:<index>`；`relatedLineGroupIds`、`sourceRef`、`PreviewLinePlan.groupId` 构造未改。`goalToPreviewItem()` 仅将 producer policy 改为 `isUnmatched ? settings.racePreference : lineage`。allocation owner 仍产生“真实 groupId + `isUnmatched=false`”或“无真实 groupId + `isUnmatched=true`”，故真实 manual/auto lineage 与 `findBestProducer()` 行为保持不变。
- Compute contract：静态追踪确认 preview derived item 的 `moduleId` 经 `buildPreferredModuleIds()` 传给 `computeGoalModules()` / `expandGoalsRespectingLockedWares()`，compute 优先读取该 module；candidate 未改 compute，未新增 producer 重选 owner。
- 规范/历史：核对 `bugs.md` BUG-001、`request.md` DoD 13、`design.md` 5.4、`tasks.md` T34–T37、`review-task-test-3-86c2dd30.md`，以及历史 commit `0420c25c` 的 race-preference 修复语义；candidate 与当前 correction 一致。
- Focused Unit（隔离副本，candidate）：`npm exec vitest run -- --config vite.config.ts --dir tests/unit/build-flow-plan buildPlanProductionLine.spec.ts -t "uses settings.racePreference for unmatched derived module selection"`，exit 0，`1 passed | 6 skipped`；observable moduleId 为 `module_ter_prod_energycells_01`。将隔离副本恢复为 base 的唯一源码差异后，同一命令 exit 1，received `module_gen_prod_energycells_01`，证明 red → green。
- Build（隔离副本，candidate）：`npm run build`，exit 0；`vue-tsc -b` 与 Vite production build 完成。
- Diff hygiene：`git diff --check 5ad351e8 af6c5423`，exit 0。
- Simplicity：复用既有 `goalToPreviewItem()`、`findBestProducer()`、`isUnmatched` 和 synthetic id；仅扩展既有私有函数参数。未新增 selector、adapter、fallback chain、compatibility branch、类型层、状态通道、错误表示或依赖；lineage policy 位于最早同时持有 `isUnmatched`、settings 和 lineage 的既有边界。

## Findings

无阻断或需修正 finding。

## Verdict

passed

## Changes

无 reviewer 修改；candidate 未修改、未提交、未 merge。仅新增本 review artifact。

## Caveats

- task contract 文本保留旧 target base `85255b1e…`，本次 dispatcher assignment 明确指定并已验证的 immutable base 为 `5ad351e8b80d2bcd710793e1b15a407d5396b8b6`；本 verdict 仅适用于该精确 range。
- 补充运行整个旧路径 `tests/unit/build-flow-plan/buildPlanProductionLine.spec.ts` 时，除本次 focused case 外有 4 个依赖 fixture 中文 group name 的既有失败；它们不在 blocking self-validation 内，且 candidate 未改测试/fixture。按 contract，刷新后的 canonical focused/full Unit 仍由 `task-test-3` integrate lane 负责。
- build 仅有既有 Browserslist 数据过期与 chunk-size warning，不影响 exit 0。
