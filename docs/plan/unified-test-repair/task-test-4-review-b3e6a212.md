# task-test-4 review — candidate b3e6a212

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；只读复核 immutable candidate `b3e6a212`。未修改产品、测试、fixture、配置、candidate、Git index 或 workflow 状态；唯一仓库写入是本报告。

Reviewed commit:
`b3e6a2120d663ff528a13962c6d2ca915f8b191d`，single parent `9dd1d5fe8d32aaa8623964bb221e0cf77a9dbd67`。

Evidence:

- 审查开始时 `HEAD` 为 candidate，`git status --short` 无输出。candidate 只修改 4 个 `tests/e2e/logic-flow/**` 文件并新增 1 个 `tests/legacy/e2e/**` 文件；无 `src/**`、OpenSpec、fixture 或配置改动。
- `npm exec playwright test -- --list tests/e2e/logic-flow` exit `0`，收集 `112 tests in 8 files`；默认 `testDir` 未收集 legacy。
- 从 legacy 文件自身目录执行 `npm exec playwright test -- --list logic-flow-bug-regression.spec.ts` exit `0`，独立收集 `36 tests in 1 file`。从仓库根按 canonical 配置直接指定该路径得到 `0 tests`，这是 `playwright.config.ts` 的 `testDir: './tests/e2e'` 隔离结果，不是 import 解析失败。
- legacy 文件与 `cb92fe76^` 原件相比，36 个 test declarations 和测试 body 均保留，差异仅为 3 条 import：`test-setup` 指向 `tests/test-setup.ts`，两个 helper 指向当前 canonical `tests/e2e/logic-flow/helpers/**`。路径可解析，但 helper 并未形成 legacy-local snapshot。
- `x4-drag-test` 静态检查：candidate helper 的每个 `page.mouse.move` 都带 `steps`；未发现 native drag dispatch、`dragTo()`、DOM 写入或通过 `page.evaluate` 写业务状态。helper 的 `page.evaluate` 均为读取；new-zone 在 release 前读取真实 `isHoveringNewZone`，existing target 在 release 前读取真实 `hoveredGroupId`，cancel caller 在 release 前验证 hover identity 清空。
- 短 focused command 仅选择 new-zone、4.16、4.17、E2E-3、E2E-5、E2E-15 六项，结果 `2 passed / 4 failed`：new-zone handshake 与 E2E-5 通过；4.16/4.17 均停在首次 energycells new-zone 的 `isHoveringNewZone === false`；E2E-3 停在错误的 saved-plan locator/name；E2E-15 停在 helper 的 locked postcondition。
- E2E-3 的失败快照已显示已保存方案实际名为 `我的逻辑组网`，且包含 `1 个产线组 · 1 个节点` 和 `船体部件`；产品保存结果与测试期待的 `/新建方案|New Plan/` 不同，证据指向 test locator/fixture expectation。
- E2E-15 的失败为 `dragLogicFlow.ts:145` 期待 locked-match 后 ware 数量不变（expected `0`），实际为 `1`。这正是 active `logic-flow-operation` 的“Group Locked Match 允许正常投放”行为，证明 helper postcondition 错误，而非产品失败。
- `git diff --check b3e6a212^ b3e6a212` 非零：新增 legacy 文件保留了多处 trailing whitespace，尚未通过 task-test-4 的 blocking validation。

Findings:

## F1 — blocking：legacy 数量与 import collection 已关闭，但完整 snapshot 与 diff gate 未闭合

Classification: `test-owned preservation/validation failure`。

36 个历史 declarations 已恢复，三条相对 import 均可解析，legacy 也可从自身目录独立 collection；前审“没有 legacy 原件”的 finding 已关闭。但是该文件仍直接依赖正在演进的 canonical `setupLogicFlow.ts` 和 `dragLogicFlow.ts`，而本 candidate 同时大幅修改后者，因此历史 helper 行为没有被冻结，不能称为完整、自包含的 legacy snapshot。candidate 还因该 snapshot 的 trailing whitespace 直接失败于合同要求的 `git diff --check`。

Contract basis: `task-test-4.md` ordered work 1–3、blocking `git diff --check`；`context-2.md` 迁移规则 1–4；前审 cb92 的 F1 closure 要求在必要时连同 helper snapshot 保留。Correction owner: 下一位 `task-test-4` test coding worker。Allowed paths: 仅 `tests/legacy/e2e/from-unified-e2e/logic-flow/**`。Preserve: 36 个标题、步骤和断言；legacy 继续不进入 canonical gate。

Observable closure: legacy-local helper import 不再跟随 canonical helper变化；从 legacy 目录仍收集 36/1；默认 canonical collection仍不收集 legacy；`git diff --check` exit `0`。

## F2 — blocking：shared drag helper 的 hover 握手合规，但状态真值与 release postcondition 不可靠

Classification: `test-owned drag-helper defect`。

静态 guardrail 已明显改善：真实 Mouse API、全部 move 有 `steps`、release 前读取真实 hover signal、没有 evaluate 写业务状态，这部分符合 `x4-drag-test`。阻塞点在状态与结果语义：

- `expectedStatus` 直接覆盖 store 实际 status，却不先断言两者一致；调用者可把 Auto/Isolate/Replace 等状态强制解释为 `normal` 或 `locked`，存在假阳性入口。
- helper 使用 `isolate`，store/current UI 使用 `isolated`；当前靠 caller 强制覆盖绕开，而非统一 current status vocabulary。
- `locked` 被实现为投放后 ware 数量不变；active spec 明确 locked-match 应允许投放并强制映射血统。focused E2E-15 的 `0 -> 1` 已直接证实该 helper expectation 反向。
- `drop: false` 后由 caller release 时，helper不再执行 postcondition。两个 isolate retained cases只验证 pre-up `Connect` 后直接 `mouse.up()`，没有验证解除隔离、正确 module/lineage 与上游扩展；因此 pre-up 合规不能替代 post-up contract。

Contract basis: `x4-drag-test` Interaction Phase Verification；`openspec/specs/logic-flow-operation/spec.md` Normal/Duplicated/Auto/Isolate/Locked/Rejected 状态与结果。Correction owner: 下一位 `task-test-4` test coding worker。Allowed paths: `tests/e2e/logic-flow/helpers/dragLogicFlow.ts` 及实际 release 的 focused callers。Preserve: Mouse API、每个 move 的 `steps`、真实 `hoveredGroupId/isHoveringNewZone`、release 前状态断言、只读 evaluate。

Observable closure: helper 先验证 actual status，再按 actual status断言 UI；locked-match release 后新增且 lineage/module 映射正确；isolate release 后节点解除隔离并恢复上游；duplicate/rejected release 后节点和相关 T0 均不变；new-zone只建一组；cancel hover-off 后完全不变。

## F3 — blocking：retained canonical cases仍有假阳性/弱断言，cb92 的 current browser coverage 大量未补

Classification: `test-owned assertion gap + continue coding`。

- `isolating a node removes its candidate preview` 仍断言不存在于 current DOM 的 `.preview-node` 为 0；current preview 使用 `.compact-node`。该断言可永久空跑，且 release 后不验证 Connect 结果。
- `the same ware can coexist across two selected lineages` 只断言两个 `hullparts` DOM 节点，没有断言两个不同 `moduleId/lineage` 或各自模块名称，不能证明 active module-ID physical isolation contract。
- duplicate 的 red label 与投放后单节点已有有效方向；new-zone 的真实 hover和单组/单节点 postcondition已由本轮 focused run通过；cancel case也保留 hover-off 与不变结果。这三类可保留。
- locked rejection仍未形成可信闭环：regression case只有 pre-up no-preview；4.17 虽有 post-up总节点不变，但其前置并未建立一个与 dragged ware不兼容的 locked lineage。
- cb92 标出的下列 current browser intents仍无等价强 owner：Auto→Manual；Replace lineage；两个同 ware节点的两条具体连线；Isolate release 后 Connect/扩展；locked-match 接受并强制 lineage；多组精确目标切换；existing/preview/new-header/drag-ghost 三处模块名称；隔离不被扩展打破及两项 T0 preview停止；语言切换；locked rejection 后 T0 不变。lineage coexist/selection 也仍需从“count=2”加强为精确 module/lineage。

Contract basis: cb92 F2/F3 的 23/13 历史分类；active `logical-flow-planner`、`logic-flow-operation` 与 `logic-flow-energycells` change。Correction owner: 下一位 `task-test-4` test coding worker。Allowed paths: 现有 `tests/e2e/logic-flow/**` 与 helper；不得改 `src/**`。Preserve: 13 个 store-only/重复场景只留 legacy，不恢复为 canonical；一个强 browser case可合并同一 active scenario的重复历史意图。

Observable closure: 删除/替换 vacuous locator；用最小 Normal/Duplicated/Auto/Isolate/Replace/Locked-match/Rejected/new-zone/cancel matrix闭合上述行为，并逐项给出 pre-up UI signal 与 post-up精确结果。

## F4 — blocking：plans 与 incompatible 修正只有 E2E-5 闭合

Classification: `test-owned locator/setup failure + stale historical expectation + continue coding`。

- 4.16 从 archived “unlocked incompatible target hidden/dimmed”改为 unlocked normal/allowed，方向符合较新的 active `logic-flow-operation`：只有 locked mismatch 才 Rejected。旧 hidden/dimmed 期待属于 stale historical expectation，不应恢复 canonical。但当前 case首次 energycells建组即未建立 new-zone hover，尚无通过证据。
- 4.17 的 active contract 是 locked mismatch → red/Rejected/no mutation；candidate 创建的是 default locked group后拖 default-supported `hullparts`，并未建立 mismatch。即使 energycells前置修通，强制 `expectedStatus: 'rejected'` 仍不是真实契约前提。
- E2E-3 已走 UI SmartSaveDialog 和 Load UI，但没有按历史 E2E task输入确定名称，随后错误寻找 `/新建方案|New Plan/`；快照中的实际保存名是 current默认 `我的逻辑组网`。这是 test-owned locator/expectation，不能报产品保存 bug。
- E2E-5 已通过短 focused run，并通过 reload → new → Load UI证明同名 `Existing Plan` 只有一份且新增 `weaponcomponents` 被持久化；该项闭合。
- E2E-15 已补“加入更高 tier manual节点后名称变化”的正确 body；当前只被 helper错误的 locked-match“不应新增”postcondition阻塞，继续修 helper后复验即可。

Contract basis: active `logic-flow-operation` locked semantics、`logic-flow-plans` Save Existing/Create New、archived plan E2E-3/5/15 steps。Correction owner: 下一位 `task-test-4` test coding worker。Allowed paths: `dragLogicFlow.ts`、`logic-flow-incompatible-drag.spec.ts`、`logic-flow-plans.spec.ts`。Preserve: E2E-5 的 reload/load persistence proof；不要恢复 stale 4.16 hidden/dimmed expectation，也不要放宽为“not red”而省略正常投放结果。

Observable closure: 4.16使用真实 unlocked前提并完成 normal drop；4.17使用真实 incompatible locked lineage并验证 pre-up Rejected及 post-up节点/T0不变；E2E-3输入确定名称并在 Load modal定位该方案及其 Hull Parts；E2E-15在修正 locked helper后通过动态标题断言。

## F5 — failure ownership：当前没有可升级的产品 bug

Classification: `test-owned / stale / continue coding`。

本轮 4 个 focused失败均在 current contract尚未被正确建立或测试期待反向时发生：两项停在 energycells new-zone hover前置，E2E-3 是已保存后的错误名称定位，E2E-15 是 helper拒绝 active spec允许的 locked-match mutation。worker报告的 `1 passed / 9 failed` 与另一次中止也不得直接转换为产品缺陷。

只有在 truthful clean/locked/unlocked/lineage setup、真实 target hover、current status断言和精确 postcondition全部成立后，同一最小 case仍稳定得到相反结果，才可附 exact focused command、前置状态和实际 UI/store结果建议 product bug。当前证据未达到该门槛。

Verdict:
`changes_required`

36 个 legacy declarations和独立 collection已恢复，new-zone及 E2E-5也有有效通过证据；但 legacy helper snapshot、`git diff --check`、locked-match helper语义、isolate/rejected postcondition、4.17真实前提、E2E-3 locator，以及 cb92列出的多项 current browser coverage仍未闭合。

Changes:

1. 最小先修 `tests/e2e/logic-flow/helpers/dragLogicFlow.ts`：assert actual status，不用 caller override掩盖分类；修 locked-match为允许新增/强制 lineage；统一 isolated vocabulary。同步只改需要 post-up closure 的 regression/incompatible callers。
2. 修 `logic-flow-incompatible-drag.spec.ts` 的 4.16/4.17真实 unlocked/locked-mismatch前提；修 `logic-flow-plans.spec.ts` E2E-3确定名称 locator。保留已通过的 E2E-5，E2E-15只等待 helper修正后复验。
3. 在 canonical 用最少场景补 F3列出的 current intents；优先 Auto、Replace、Isolate release、Locked-match/Rejected、module-name、isolation/T0、language、multi-target。不要恢复13个 store-only/重复 legacy cases。
4. 为 legacy regression保存其依赖的 helper snapshot并清理 trailing whitespace。然后仅做：legacy 36 collection、canonical 112+ collection、一个九状态 drag matrix、E2E-3/5/15、`git diff --check`；完整 suite留到这些 focused gate闭合后。

Caveats:

- 本轮按用户要求只做静态、collection和 6-case短 focused evidence；未运行完整 Logic Flow 或完整 E2E suite。
- energycells 两次 new-zone hover失败仍归 test-owned前置/driver未闭合；它与 active EC contract存在张力，但尚未在排除 helper/geometry/setup后形成产品 bug证据。
- `x4-drag-test` 使本审查明确接受只读 `page.evaluate`，并要求所有实际 release都同时具备 pre-up hover/leave signal与 post-up结果；candidate只完成前半部分。
