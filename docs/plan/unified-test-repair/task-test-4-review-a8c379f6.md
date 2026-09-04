# task-test-4 review — candidate a8c379f6

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；只读复核 immutable candidate `a8c379f6`。未修改产品、测试、fixture、配置、candidate、Git index 或 workflow 状态；唯一有意仓库写入是本报告。

Reviewed commit:
`a8c379f6a47e327ecd2ff3b5ad69829fe73a43aa`，single parent `867eb27cc161389ca2f768a94b947cb6214b02e1`。

Evidence:

- 审查开始时 `HEAD` 为 candidate，`git status --short` 无输出。candidate 仅修改 4 个 `tests/e2e/logic-flow/**` 文件，无 `src/**`、legacy、fixture、OpenSpec、配置或 workflow 状态改动。`git diff --check a8c379f6^ a8c379f6` exit `0`；`tests/unified-e2e/` 不存在。
- `npm exec playwright test -- --list tests/e2e/logic-flow` exit `0`，收集 `112 tests in 8 files`。从 legacy 目录执行 collection exit `0`，收集 `36 tests in 1 file`；默认 `testDir` 仍只指向 canonical `tests/e2e`。
- legacy regression 相对 `cb92fe76^` 原件仅调整 `test-setup` 路径；legacy `setupLogicFlow.ts` 也仅调整 fixture 相对路径。但 legacy `helpers/dragLogicFlow.ts` 不是原 helper snapshot：它加入 `DropStatus`、额外 helpers、store status 与 post-drop 分支，仍改变历史原件的 driver 语义。
- Playwright focused run（仅 drag regression、4.16/4.17、E2E-3/5/15，共 12 项）在沙盒内因 Chromium `sandbox_host_linux.cc:41 ... Operation not permitted` 全部未启动；按 reviewer 协议在可启动 Chromium 的执行边界重跑后得到 `3 passed / 9 failed`。通过：hover-leave cancel、E2E-5、E2E-15。失败：6 个 regression drag、4.16、4.17、E2E-3。该 run 的 webServer 同时完成 `npm run build`（含 `vue-tsc -b`）并成功产出 Vite build。
- 额外单例 `Compact view toggles on drag start and end` 稳定停在 `dragLogicFlow.ts:65`：EC drag 已使 compact view 出现，但移动到 new-zone 后 `isHoveringNewZone` 始终为 `false`。同一 focused run 中 `weaponcomponents` 的 new-zone hover/leave case通过，证据指向 Tier-0 source 与 compact target 的 Mouse 路径/dragenter handshake，而非已证实的 EC 产品禁拖。
- current authority：`openspec/specs/logic-flow-operation/spec.md:8-56,125-139,190-282`、`openspec/specs/logical-flow-planner/spec.md:160-224`、`openspec/specs/logic-flow-plans/spec.md:43-99`、active `logic-flow-energycells/spec.md:67-93,116-130`；历史 E2E-3/5/15步骤为 archived `logic-flow-plans/test_tasks.md:117-151,213-220`。按 `x4-drag-test`，每个 release 必须先有可观察 target-hover 或 hover-off 信号，并在 release 后验证结果。

Findings:

## F1 — blocking：legacy 36/1、路径、自包含与 diff gate通过，但 drag helper仍非历史原件

Classification: `test-owned preservation gap`。

`logic-flow-bug-regression.spec.ts` 的 36 个 declaration/body与原件一致（仅必要 import path变化），legacy-local `setupLogicFlow.ts` 也是原件加必要 fixture path变化；collection和 canonical 隔离均通过。但 `tests/legacy/e2e/from-unified-e2e/logic-flow/helpers/dragLogicFlow.ts` 仍是后续增强版，不是 `cb92fe76^:tests/e2e/logic-flow/helpers/dragLogicFlow.ts` 的 snapshot。candidate 未触碰该文件，因此前序 8ac54561 F1 未闭合。

Contract basis: `task-test-4` 的“旧 E2E 原件全部保留”与前序 reviewer 的明确 closure。Correction owner: 下一位 `task-test-4` test coding worker。Allowed path: 仅 legacy `helpers/dragLogicFlow.ts`。Preserve: 36 个测试 body、已正确调整的两条相对路径、legacy 不进入默认 gate。

Observable closure: legacy drag helper与 `cb92fe76^` 原件除必要路径差异外一致；legacy仍独立 collection `36/1`；`git diff --check`仍为零。

## F2 — blocking：actual-status 与 locked-match方向已修正，但 isolated/rejected/duplicate postcondition没有被 canonical case真正执行

Classification: `test-owned helper/assertion gap`。

- `dragLogicFlow.ts:70-89` 先读取真实 `getWareGroupStatus`，再把 `available`解释为 unlocked `normal` 或 locked-match `locked`；`expectedStatus`只与结果比较，不再覆盖 actual status。此项关闭。
- locked-match 在 release 前缓存 locked group effective lineage，release 后要求同 ware count `+1`、manual node lineage匹配，并再次比较 `findModuleForWare` 得到的 moduleId；focused E2E-15通过，证明当前 default locked-match允许新增。方向已关闭，但 `expectedModuleId` 类型允许 `undefined`，尚缺一个非空断言，不能让“lookup和node都缺 moduleId”共同通过。
- helper为 `isolated` 增加了解除隔离、moduleId与 auto-upstream断言，为 `rejected/duplicated` 增加完整 node snapshot不变断言；但 canonical所有对应 caller都传 `{ drop:false }`，这些分支从未执行。`logic-flow-bug-regression.spec.ts:66-69` 手工 release 后只检查不存在于 `FlowNode` class contract中的 `/isolated/`；`:52-56` 与 4.17 都先移出 target再 release，验证的是 cancel，不是 rejected drop；duplicate 的 target release仅检查同 ware count，未冻结 nodes/T0。故这些 postcondition仍未闭环。
- cancel owner `logic-flow-bug-regression.spec.ts:38-47` 有 target-hover（helper）、hover-off、release与不变结果，并在 focused run通过；new-zone owner也有 pre-up signal与 postcondition。保留。

Contract basis: active Normal/Duplicated/Auto/Isolate/Locked/Rejected 语义及 `x4-drag-test` phase sequence。Correction owner: 下一位 `task-test-4` test coding worker。Allowed paths: canonical `helpers/dragLogicFlow.ts` 与必要 status callers。

Observable closure: 至少各有一个 canonical isolated/rejected/duplicate case在目标仍 hover 时 release，使 helper对应 post-drop分支实际执行；locked/isolated expected module先证明非空，再比较 exact lineage/moduleId；rejected/duplicate冻结完整 nodes（含 T0）不变。

## F3 — blocking：并非所有手工 release 都有明确 hover/leave signal

Classification: `test-owned drag-driver guardrail violation`。

本 candidate只在若干 case里增加 `mouse.move(50, 50)`，没有完成 mandatory hover-off assertion：`logic-flow-bug-regression.spec.ts:19-20,28-29,55-56`、`logic-flow-incompatible-drag.spec.ts:44-45`。前序已指出且本轮未改的 `logic-flow-new-feat.spec.ts:33-40` 仍以错误的 locked-border消失断言代替 hover-off；`logic-flow-interaction.spec.ts:184-190` 仍只有 drag active → release，没有 target-hover或 hover-off及不变 postcondition。其余通过 `dragWareToTarget(..., {drop:false})` 后不移动鼠标的 release可继承 helper已验证的 target identity/new-zone signal。

Correction owner / allowed paths: `task-test-4` test coding worker，仅上述 canonical case与 shared helper。Preserve: Mouse API、每次 move 的 `steps`、不 dispatch native DnD、不通过 evaluate写业务状态。

Observable closure: 每个真实 drag release前明确断言 target hover或 hover-off；cancel后不变，success后精确变更。非 draggable probe `attemptWareDrag` 可保留其“compact view未出现”信号。

## F4 — blocking：4.16/4.17 setup方向正确但 driver未闭合；plans仅 E2E-5/15通过

Classification: `test-owned setup/locator failure + stale historical expectation`。

- 4.16 已建立 unlocked group并要求 `actual available -> normal`及 drop后 `spaceweed`出现；4.17 已建立 default locked group与不支持的 `spaceweed` mismatch，要求 pre-up Rejected。二者方向符合 current specs，archived 4.16 hidden/dim期待仍为 stale，不得恢复。
- 两项本轮都在第一个 EC new-zone 的 `isHoveringNewZone === false` 停止。单例复现显示 EC drag已启动、compact view曾可见，但 new-zone dragenter未建立；同 helper的 Tier-2 new-zone case通过。当前 helper在 compact view切换后直接以 target center移动，Tier-0 source与第一格 new-zone几何重叠时可能没有形成 outside→target enter。应先修可观察 Mouse 路径并复验；现有证据不足以报 active EC 产品 bug。
- 4.17 当前在验证 Rejected UI后先 move away再 release，只证明取消后总数不变；应在 target hover仍成立时 release，并验证 exact nodes/T0不变。
- E2E-3 已输入确定名称、清空工作区并在 Load modal唯一找到 `E2E-3 Plan`，但最后要求 plan card包含 Hull Parts。`LoadFlowPlanModal`只展示 plan name、数量与 group display name；archived E2E-3也只要求“方案保存到列表”。本轮实际 card为 `E2E-3 Plan ... 1 个产线组 · 1 个节点 空`，所以失败是超出契约的 test expectation；可删该断言，或点击 Load后在工作区验证 Hull Parts。
- E2E-5 focused通过，证明 existing plan直接保存、reload后同名唯一且新增 `weaponcomponents`可加载；E2E-15 focused通过，证明加入更高 tier manual node后动态标题更新。两项关闭并应保留。

Correction owner / allowed paths: `task-test-4` test coding worker，仅 `dragLogicFlow.ts`、`logic-flow-incompatible-drag.spec.ts`、`logic-flow-plans.spec.ts`。Preserve: 4.16 unlocked acceptance、4.17 locked mismatch、E2E-5 reload/load proof、E2E-15动态标题 body。

## F5 — blocking：前序 current browser coverage缺口未被本 candidate处理

Classification: `test-owned remaining coverage`。

candidate只改 helper、两个 focused spec和 plan E2E-3 locator，未补前序 8ac54561 F4列出的 canonical owners。Auto→Manual、Replace lineage、同 ware不同 moduleId/lineage、两条具体 SVG连线、空 group首节点、多组 target切换、existing/preview/new-header/drag-ghost模块名、隔离扩展/T0边界、语言切换等 current behavior仍未闭合。不要恢复 stale/store-only legacy case；允许用最少强场景合并同一 active behavior。

## F6 — failure ownership：剩余 smoke失败没有充分当前产品 bug证据

Classification:

| 类别 | 当前证据 |
| --- | --- |
| `test-owned` | legacy helper provenance；Tier-0/二次 drag几何 handshake；未执行的 status postcondition；缺失 hover-off；E2E-3超出 UI contract的 ware-text断言；canonical coverage缺口 |
| `stale` | archived 4.16 hidden/dim；旧 EC 禁拖；以不存在的 `.isolated` class判断隔离；旧 locked-border leave期待 |
| `product-owned` | 无已证实项 |

worker 的 `11 passed / 13 failed` 和本轮 `3 passed / 9 failed` 都不能按失败数量升级 bug。当前失败要么在 target hover前终止，要么断言非 current UI contract；尚无一个 case同时满足 truthful setup、drag active、exact target hover、current status、target内 release与精确 postcondition后仍稳定得到相反产品结果。

Verdict:
`changes_required`

actual status、locked-match方向、E2E-5和E2E-15已有实质闭合，collection/build/diff gate也通过；但 legacy helper仍非原件，isolated/rejected/duplicate postcondition未被任何 canonical drop执行，release guardrail仍有缺口，4.16/4.17被 Mouse handshake阻塞，E2E-3保留错误 UI expectation，且前序 canonical behavior coverage未补。

Changes:

1. 还原 legacy `dragLogicFlow.ts` 为 `cb92fe76^` 原 snapshot，仅保留必要路径调整。
2. 最小修 shared Mouse 路径（compact view出现后确保 outside→exact target enter），并让 isolated/rejected/duplicate各一个 case在目标内 release、执行现有精确 postcondition；补 expected module非空检查。
3. 给列出的手工 release补真实 hover/hover-off与 postcondition；4.17不得先 leave，E2E-3改为契约内 saved-list断言或 Load后节点断言。
4. 用最少强 canonical cases补前序 F4仍缺的 current behaviors。随后只重跑 legacy/canonical collection、diff-check、状态 matrix、4.16/4.17、E2E-3/5/15；完整 suite留待这些 focused gate闭合。

Caveats:

- 未运行完整 suite。首次 focused run的 12 个 Chromium launch失败仅为 sandbox环境证据；有效 browser结论来自沙盒外限定重跑。
- collection `112/8`、legacy `36/1` 与 build通过不替代交互语义审查；最后修改后的完整 browser smoke仍未提供。
