# task-test-5-fix-1 独立审查 1

Status: `approved`

Task: `task-test-5-fix-1`

Reviewed commit: `d309409c0ec22e4d5cc214560e4328cf220c6b14`

Base: `da05d84514c90428fd4e51907df9b6424fa5ccff`

Target: `develop`，审查时为 `da05d84514c90428fd4e51907df9b6424fa5ccff`

## Evidence

- `git rev-parse d309409c^{commit}`、`git rev-parse HEAD`、`git rev-parse workflow/unified-test-repair-coding` 均为 `d309409c0ec22e4d5cc214560e4328cf220c6b14`；candidate 工作树没有 tracked、untracked 或 unstaged 内容。
- `git merge-base --is-ancestor da05d84514c90428fd4e51907df9b6424fa5ccff d309409c` exit `0`；`git rev-list --count <base>..<candidate>` 为 `1`。累计 diff 只有合同声明的三条 owned path：
  - `src/components/logic-flow/presenters/useLogicFlowCandidatePresenter.ts`
  - `src/components/logic-flow/LogicFlowCandidateZone.vue`
  - `tests/unit/logic-flow/logic-flow-candidate.spec.ts`
- `git diff --check da05d84514c90428fd4e51907df9b6424fa5ccff..d309409c0ec22e4d5cc214560e4328cf220c6b14` exit `0`。无 `tests/e2e/**`、helper、fixture、store、规范、配置或其他治理文件变化；没有新的版本化 runner/test entry。
- worker 原始命令记录位于 `/home/slepher/.codex/sessions/2026/09/05/rollout-2026-09-05T17-35-21-01a070ec-2d91-75e0-9057-ac48b09cdfd2.jsonl`。指定 Unit 命令 exit `0`，5 files / 41 tests passed；`npm run build` exit `0`，产物为 `dist/assets/index-CP3CRFsZ.js`；`git diff --check` exit `0`。
- Chromium pointer 命令为 `node --import tsx --input-type=module` stdin 脚本，cwd `/home/slepher/project/x4-station-calculator/.worktree/coding`，preview `127.0.0.1:4285`，viewport `1440x1000`，每个输入独立 context，复用 `setupLogicFlow(page, 'clean')`。首次 sandbox launch 因 `Operation not permitted` 不可用；同一完整脚本获运行权限后 exit `0`，stdout 分别报告 Ore blocked、Energy Cells blocked、Hull Parts pointer lifecycle and quick add passed。Unit/build 没有替代 pointer 结果。
- pointer traces：
  - `test-results/pointer-candidate-ore.zip`，SHA-256 `270e8cbbefd15a5e1f002440aef6c556ae0f21c2da9d1794faaf63fe7ddcb293`
  - `test-results/pointer-candidate-energycells.zip`，SHA-256 `cf4949f764c859d13622bc45aaeece130ffa8ecbc174819c9b1f19458ea73596`
  - `test-results/pointer-candidate-hullparts.zip`，SHA-256 `2209acfa4bc64e029b94dd8973a8c1018cef20c654e8b10631f7b6a22fafd0fe`
- 三份 trace 均记录 game version `8.0`、UI `zh-CN` 与真实 Mouse API。Ore/Energy Cells 在 `mouse.down` 后横移 100px，卡片保持 `draggable=false`，不存在 `.ware-card-add-btn`，没有 `sortable-chosen|ghost|drag`，compact view 隐藏，`isDragging=false`、dragging ware/lineage 为 null，释放后 groups 精确仍为空。Hull Parts 在真实 pointer 后 `isDragging=true`、`draggingWareId=hullparts`、compact view 可见；移至候选区外释放后 drag/hover 状态清空、groups 仍为空，随后同一卡片的 `.ware-card-add-btn` 打开菜单并创建一个包含 manual Hull Parts 的 group。
- worker 验证发生在 base HEAD 上的三条未提交 owned diff，dispatcher 随后先复核同一 diff/name list/diff-check，只 `git add` 这三条路径并生成 candidate；当前 candidate 累计 diff 与 worker 记录逐字一致。因此 pre-commit pointer/build 结果与不可变 candidate 的内容绑定。trace 与 `dist/` 受 `.gitignore` 管理，是合同要求的本地证据，不是 candidate 内未记录的版本化产物。

## Findings

无阻断 finding。

1. **候选身份与所有权：通过。** 短 SHA 正确解析；HEAD、branch ref 与 immutable candidate 一致；base 是直接父提交；只有一条 candidate commit 和三条 owned path。无非 owned diff、错误 SHA、越权测试入口或意外版本化产物。
2. **presenter 资格：通过。** `isCandidateSelectable` 先拒绝缺数据/null tier，再精确拒绝 `ware.id === 'energycells'` 或既有 `gameData.isRawMaterialWare(wareId)`；recycling 分支保持原样。它没有使用 `tier === 0` 作为总禁用条件，因此不会禁用所有 Tier 0 非资源产物。`waresByTier.isSelectable`、`startDrag` 和 `quickAdd` 继续消费同一资格责任面。
3. **Sortable 与合法路径：通过。** `<draggable filter=".is-locked-tier">` 复用 presenter 输出的锁定 class。已安装 Sortable 的 `_onTapStart` 在 `_prepareDragStart` 前匹配 filter、preventDefault 并 return；真实 Ore/Energy Cells trace 证明 pointer tap start 未进入 Sortable 或 store drag。`:group` 的 `pull: 'clone'`、`:clone`、`:sort="false"`、`@start`、`@end` 均未改变；Hull Parts trace 证明合法 source 可启动、结束、保持候选卡并继续 quick-add。
4. **Unit 断言：通过。** Unit 使用真实 `.ware-card-add-btn`，同时断言 Ore、Silicon、Energy Cells 的 `draggable=false` 与按钮不存在；Hull Parts 是 `draggable=true`、按钮存在的合法对照。vuedraggable mock 不证明 filter，但独立 Chromium pointer trace 已覆盖该平台行为。
5. **产品签名：通过并关闭。** `LF-T0-SORTABLE` 由 Ore 的真实 down/move/release、Sortable class、compact/store 状态和 groups 不变 oracle 关闭；`LF-ENERGY-SELECTABLE` 由同一独立 oracle 关闭。Hull Parts 正例证明 clone/sort=false/start/end/quick-add 路径未受损。结论没有把 Unit/build 当 pointer 证据。
6. **最小只读检查：通过。** reviewer 运行了 `git rev-parse`、`git show`/`git diff`、ancestor/count/status/ignored-evidence 检查和 range `git diff --check`；未修改 candidate、产品、测试或规范，未重跑已由完整 worker 记录和 trace 支持的测试。
7. **target 状态：符合待合并候选。** `git merge-base --is-ancestor d309409c develop` exit `1`，说明审查时 candidate 尚未进入 `develop`；本审查没有执行合并。

## Verdict

`approved`

该 verdict 只批准 immutable candidate `d309409c0ec22e4d5cc214560e4328cf220c6b14` 进入合同的 target 路由；不将暂停的 `task-test-5.1` 或父 `task-test-5` 判为完成。

## Changes

无需 candidate 修正。

## Caveats

- target 合并前置已经满足：candidate 身份、owned range、静态语义、Unit/build、真实 Chromium pointer 与 diff-check 均通过。dispatcher 合入 `develop` 后必须记录 immutable target SHA，并要求 `git merge-base --is-ancestor d309409c0ec22e4d5cc214560e4328cf220c6b14 <target-sha>` exit `0`。
- integrate 只能同步已包含 candidate 的 target；其 Execution base 必须满足 `git merge-base --is-ancestor <target-sha> <integrate-execution-base>` exit `0`。不得把测试 checkpoint `b2060a45d41697593e09ac405a9064f436cc5fd1` 当作 coding base 或先合入 target。
- 合并风险低且集中在 `LogicFlowCandidateZone.vue` 同一 `<draggable>` 配置和 presenter 的 `isCandidateSelectable`。若 target 在合并前改动这些责任面，应重新审查最终合并 diff并重跑同一 pointer 脚本。
- target/integrate 到达后仍须按合同恢复 `task-test-5.1`：完成其 test-owned oracle/setup 修正，重跑 focused、collection、build、diff 和 helper cross-consumer。该恢复门不撤销本次对两条产品签名的关闭结论。
