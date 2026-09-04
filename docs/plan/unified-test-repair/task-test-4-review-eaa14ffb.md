# generation-2 task-test-4 review — eaa14ffb

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` immutable candidate review。仅审查 candidate、当前 Logic Flow 契约、相关测试知识与 focused browser evidence；未修改产品代码、测试、fixture、Git index、commit、branch 或 workflow state。唯一仓库写入是本报告。

Reviewed commit:
`eaa14ffbb092300a167381c66be002cfe31016dc`，single parent `4ac8fc6c601de02b13457634e616664f3b1f8ca8`。审查开始与 focused run 后 `HEAD` 均精确匹配 candidate，worktree clean。candidate 仅修改 `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts`，4 insertions / 2 deletions：把两个 `spaceweed` case 的 positional tab setup 改为通过 UI 明确选择 `Agricultural + Teladi`；无 `src/**`、helper、fixture、OpenSpec 或配置改动。`git diff --check eaa14ffb^ eaa14ffb` exit `0`。

Evidence:

- Reviewer focused command：`npm exec playwright test -- tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts --grep "locked incompatible drops|leaving a locked target"`。fresh `npm run build` 成功，preview 与 Chromium 正常启动；结果 `1 passed / 1 failed`，exit `1`。这复现了用户提供的首次有效证据。未运行 Logic Flow collection 或完整 suite。
- `locked incompatible drops show rejected feedback and no preview` 通过。新 UI setup 确实使 `spaceweed` 可见；shared helper在 release 前确认 `isDragging === true`、exact `hoveredGroupId`、current `getWareGroupStatus(...) === rejected`、`border-red-600` 与 `Rejected` label，release 后确认该 ware 数量及完整 nodes shape 不变。因此旧的 source/category setup mismatch 已关闭。
- `leaving a locked target clears identity but preserves its base lock style` 到达完整有效前提：同一 truthful UI setup、真实 stepped Mouse API、active drag、exact group hover、current `rejected` status、红色 Rejected UI；随后 `page.mouse.move(50, 50, { steps: 10 })`，`hoveredGroupId === null` 成立。唯一相反结果是 target 仍为 `border-red-600 bg-red-900/10`，未恢复期待的 `border-amber-500/50`。
- 当前 `openspec/specs/logic-flow-operation/spec.md:8-56` 将 Normal/Duplicated/Auto/Isolate/Locked/Rejected 定义为拖拽到“目标组”时的停靠状态；locked mismatch 才显示红色 Rejected，locked match显示琥珀色。`:275-282` 又要求 hover 后移出并在空白释放属于取消，不添加产品。离开后该组已不再是当前 target，Rejected visual identity 不应继续占据其 base identity。
- `x4-drag-test` 的 Interaction Phase Verification 明确要求“悬停后离开”可观察为 `target hover on -> target hover off -> release`；guardrails 要求真实 Mouse API、每次 move 带 `steps`、release 前断言 hover。candidate 与 shared helper均满足这些约束，没有 native HTML5 drag dispatch、`dragTo()`、DOM 模拟或通过 `page.evaluate` 写业务状态。
- `openspec/changes/archive/2026-02-16-vue-drag-test/test_tasks.md:68-78` 的 Mouse API leave 场景明确要求 Zone B 在移出后恢复原始状态；`:141-148` 只在 incompatible ware 位于 locked target 时要求红框/Rejected。`openspec/test_experience.md:77-85` 同样把 amber 定义为 Locked、red-600 定义为 Rejected，并区分 hover/cancel phase。
- Git history没有后续产品契约把“离开后仍保持 Rejected”设为期望。`b3e6a212` 基于前序 review 将相反的“离开后不得有 amber”修正为 `hoveredGroupId === null` 后恢复 `border-amber-500/50`，并新增本次 locked-rejected leave case；`a8c379f6` 的 focused evidence已证明普通 locked target leave 后 amber base style通过，`6f0b3565` review继续接受该 owner。`eaa14ffb` 只修 source setup，没有改写该 postcondition。
- 产品原因可由当前代码直接解释：`useLogicFlowStore.handleMoveOut()` 清除 preview，并把对应 `hoveredGroupId` 置空；但 `LogicFlowPlanningZone.vue:399-406,439-465` 的边框与 label先无条件求值 `isRejected(group, null)`，该函数只看仍在进行的 dragged ware 与 group compatibility，不看 `hoveredGroupId`。所以 leave identity 已清理，Rejected presentation仍覆盖 locked amber base style。

Findings:

## F1 — blocking：离开 locked rejected target 后 Rejected visual identity 未清理

Classification: `product-owned current behavior mismatch / confirmed product bug`。

该失败不是 stale assertion，也不是 test-owned setup/driver问题。它满足升级门槛：truthful current UI setup、可见 source、真实 active drag、exact target hover、current rejected status、exact hover leave、`hoveredGroupId === null` 和精确 visual postcondition均已建立；fresh build、preview、Chromium也正常。实际红框与当前“停靠状态只属于当前 target、leave 后恢复原始状态、locked base 为 amber”的契约稳定相反。

不得仅把测试改成接受 `border-red-600`，也不得删除 lock-style assertion。Correction owner 应是后续 coding/BUG lane，而不是 `task-test-4` test owner。允许的最小产品范围是 `src/components/logic-flow/LogicFlowPlanningZone.vue` 的 compact-group transient visual predicate：Rejected border/label只在该 group 是当前 `hoveredGroupId` 时显示；leave 后回落到既有 locked amber base。必须保留 `getWareGroupStatus()`、drop permission、locked mismatch拒绝、hover期间 red/Rejected、无 preview与无 mutation语义。相同无 hover gate 的 Duplicate presentation应由 coding owner做同根边界核查，但没有证据时不要扩大成额外重构。

Observable closure：原 focused command中两项均通过；第二项在 mouse up 前依次观察到 rejected hover、leave 后 `hoveredGroupId === null`、Rejected label消失及 `border-amber-500/50` 恢复，mouse up 后 `spaceweed` 不存在。

## F2 — blocking：case 名称声称 no-preview，但当前 canonical test没有显式观察该 postcondition

Classification: `test-owned assertion gap`。

`locked incompatible drops show rejected feedback and no preview` 当前通过 shared helper验证 Rejected UI与 release 后完整 nodes不变，但 helper没有在 release 前断言 exact target内不存在 `spaceweed` compact preview/新增 T0 preview。`beforeNodes` 是 store group nodes snapshot，不能替代 transient UI preview assertion。candidate 没有删除该断言——它在更早的 `8ac54561` correction中已被移除——但本轮声称“保留 no-preview”与实际 cumulative test不符。

最小 test-owner correction：只在 shared helper的 `resolvedStatus === 'rejected'` pre-release 分支增加 exact target、exact dragged ware 的 UI no-preview断言；保留现有真实 Mouse API、active/exact hover、red/Rejected与 release 后完整 nodes不变。不要新增 helper层、fixture或兼容 selector。

Verdict:
`changes_required`

candidate 的 Agricultural + Teladi UI setup 修复本身正确且边界干净，并使一个 previously blocked case通过、另一个到达可判定的真实产品失败；但 focused gate仍为 `1 passed / 1 failed`，且 cumulative no-preview coverage有一处明确测试断言缺口。`task-test-4` 不能以修改断言接受红框来关闭。

Changes:

1. Dispatcher/产品 coding owner 基于 F1 建立一个 bounded BUG artifact，再只修 compact locked-target 的 transient Rejected presentation ownership；本 reviewer 不创建 artifact、不修改 `src/**`。
2. `task-test-4` test owner按 F2补一条 exact pre-release no-preview UI assertion，不改场景语义或产品代码。
3. 两项合并到同一目标后只重跑：`npm exec playwright test -- tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts --grep "locked incompatible drops|leaving a locked target"`；随后由原 task-test-4 流程继续其既有 gate。本轮不要求、也未运行完整 suite。

Caveats:

- worker 的 Logic Flow collection `ERR_CONNECTION_REFUSED` / localStorage `SecurityError` 属于其 webserver/runner context，不能用于判定产品通过或失败；本 verdict不依赖该运行。
- 当前 active OpenSpec没有逐字写出 CSS token `border-amber-500/50` 的 leave 句子；该精确 postcondition由“target-scoped drag status + cancel/hover-off语义”、相关 test task/test experience、既有 locked base实现及连续 accepted review/history共同确定。若产品 owner要改变这项 UX，应先显式修改产品契约，而不是静默弱化 canonical assertion。
- 本 review仅绑定 immutable `eaa14ffb` 与上述两个 focused case；不声称 Logic Flow collection或完整 E2E suite通过。
