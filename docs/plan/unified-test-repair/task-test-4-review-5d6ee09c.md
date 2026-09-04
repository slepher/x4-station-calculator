# generation-2 task-test-4 BUG-001 fix review — 5d6ee09c

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` 的 BUG-001 immutable fix review。仅审查 candidate、BUG artifact、Logic Flow 规范/测试知识与相关历史；未修改产品代码、测试、Git index 或 BUG 状态。唯一仓库写入是本报告。

Reviewed commit:
`5d6ee09c8b2ae8a6c5e08ab1054d5c4682812829`，single parent `f6d5d6ad31dfe0d14dbe6cbd9c6ef8e299da11af`。审查开始时 `HEAD` 精确匹配 candidate，worktree clean。candidate 仅修改声明的 3 个文件，合计 4 insertions / 2 deletions。

Evidence:

- 根因与最小性：`LogicFlowPlanningZone.vue` 原先仅由 dragged ware/group compatibility 决定 compact Rejected border/label，未绑定当前 hover identity；`handleMoveOut()` 已正确清除 `hoveredGroupId`。candidate 只给这两个 transient presentation predicate 增加 `logicFlow.hoveredGroupId === group.id`，未改 store、drop permission、status priority、preview lifecycle 或 mutation 路径。leave 后自然回落到既有 locked amber 分支，没有新增 abstraction/fallback。
- hover 与拒绝语义保持：shared helper 在 release 前确认 active drag、exact `hoveredGroupId`、current `rejected` status、`border-red-600`、可见 `rejected-label`，以及 exact target 内 `.compact-node.animate-pulse` 数量为 0；release 后比较完整 nodes snapshot，确认 locked mismatch 不产生 mutation。
- leave postcondition：regression 在 mouse up 前确认 `hoveredGroupId === null`、`rejected-label` 数量为 0、locked base `border-amber-500/50` 恢复；在 target 外 release 后 `spaceweed` 数量仍为 0。
- Reviewer 原 focused command：`npm exec playwright test -- tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts --grep "locked incompatible drops|leaving a locked target"`，fresh build/preview/Chromium 正常，`2 passed`，exit `0`。worker 的 standalone `npm run build` pass 与 focused `2 passed` 一致。
- Reproducible-before：`task-test-4-review-eaa14ffb.md` 记录同一 focused command 在修复前为 `1 passed / 1 failed`，失败精确发生在 leave 后仍为 red Rejected；从 `eaa14ffb` 到 candidate parent 仅新增 review/BUG 文档，无产品或测试行为变化。因此 parent 具有可信 red-before，candidate 具有 current green-after。
- No-preview 断言边界：selector 限定 exact target 的 `.compact-node.animate-pulse`，只观察 preview node，不会匹配 header T0 resource pulse 或既有 compact node。active helper 中 actual rejected 分支仅由本次两个 regression 场景进入，二者均通过。另一个旧 locked-conflict case 使用 positional `.tab-btn.nth(1)`，单独复核在 source lookup 阶段因无 visible `spaceweed` 超时，尚未开始 drag、也未到新增断言，分类为既有 `test-owned setup`，不是 candidate 回归。
- Drag guardrails：candidate 使用真实 Playwright Mouse API；所有新增/相关 `mouse.move()` 均带 `steps`；hover/red/label/no-preview 均在 `mouse.up()` 前断言；没有 native HTML5 drag dispatch、`dragTo()`、DOM 模拟或通过 `page.evaluate` 写业务状态。符合 `x4-drag-test` interaction-phase 与 guardrail 要求。
- 规范一致性：`openspec/specs/logic-flow-operation/spec.md`、`openspec/specs/logical-flow-planner/spec.md`、`openspec/logic-flow-operation.md` 与 `openspec/test_experience.md` 均把 Rejected 定义为当前 locked mismatch drop target 的 transient red feedback，把 Locked 定义为 amber base；candidate 精确恢复该 ownership。
- Logic Flow collection 实际运行：`npm exec playwright test -- tests/e2e/logic-flow` 收集 `115 tests in 8 files`，结果 `63 passed / 52 failed`；其中 `logic-flow-bug-regression.spec.ts` 全部通过。52 failures 的 family 分布与既有 `task-test-4-review-full-6f0b3565.md` 完全一致，正好比其 54 failures 少本次修复的 2 个 bug-regression failures，故没有 candidate 引入 collection regression 的证据。这些仍是 paused `task-test-4` 的既有 test/setup/UI expectation 工作，不由本 BUG fix 关闭。
- Diff hygiene：worker `git diff --check` pass；reviewer 对 `5d6ee09c^..5d6ee09c` 复核无输出。

Findings:

无 candidate-blocking finding。产品修复局限于 transient presentation，hover 期间 rejected/red、locked mismatch rejection、no-preview、release/leave no-mutation 均有直接通过证据。

Logic Flow collection 的 52 个既有失败仍阻断 `task-test-4` 整体完成，但不阻断本 immutable BUG-001 fix candidate；passing fix review 不代表 paused parent task 已完成。

Verdict:
`passed`

BUG-001 已满足 reproducible-before + passing-after。建议由有状态权限的 owner 将 `openspec/changes/logic-flow-logic/bugs.md` 从 `Confirmed` 更新为 `Verified`（因此也已满足 `Fixed`）；该缺陷是纯浏览器 presentation 行为，没有适用的 Unit owner gate，required focused E2E 与 build 已通过。本 reviewer 未修改状态。

Changes:
无要求 candidate 修改。后续仅需由 BUG 状态 owner 消费本 review evidence；`task-test-4` 的其余 collection failures继续按原 owner处理。

Caveats:

- 未运行 `npm run test:e2e` full suite，按用户要求不声称完整产品 E2E gate 通过。
- Logic Flow collection 已运行但未全绿；不能把 `63/52` 写成 collection pass，也不能将这些既有失败归因于本 candidate。
- 未修改代码、测试、Git index 或 `openspec/changes/logic-flow-logic/bugs.md`。
