# task-test-4 review — candidate 6c39a64e

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；复核 immutable candidate `6c39a64e`。未修改产品、测试、fixture、配置、candidate、Git index 或 workflow 状态；唯一有意仓库写入是本报告。

Reviewed commit:
`6c39a64efcc0e35bcc5bd868623d10c3e8cb50bf`，single parent `7309c802d1ab7a457554603fe9d741e1983c2613`。

Evidence:

- 审查开始时 `HEAD` 精确为 candidate，`git status --short` 无输出。candidate 仅修改 6 个 Logic Flow 测试路径（canonical 5 个、legacy helper 1 个），合计 `18 insertions / 165 deletions`；无 `src/**`、fixture、OpenSpec、配置或 workflow 状态改动。`git diff --check 7309c802 6c39a64e` exit `0`。
- worker evidence：legacy collection `36/1`、canonical Logic Flow collection `112/8`、build 与 diff-check 通过；E2E-3/5/15 首轮通过。后续 9 项 `ERR_CONNECTION_REFUSED` 是 webServer 退出后的环境结果，不计作产品或测试语义失败，也不计作通过。
- legacy provenance：`git diff cb92fe76^:tests/e2e/logic-flow/helpers/dragLogicFlow.ts 6c39a64e:tests/legacy/e2e/from-unified-e2e/logic-flow/helpers/dragLogicFlow.ts` 无输出，helper 为 byte-equivalent snapshot；legacy `setupLogicFlow.ts` 仅调整 fixture 相对路径。legacy regression 与 parent 在 `git diff -w` 下仅调整 `test-setup` 相对路径；普通 diff 的其余变化只是 trailing-whitespace normalization，36 个 declaration/body 未改变。前序 F1 关闭。
- canonical helper `dragLogicFlow.ts:55-58` 在 compact view 的 `py-12` 空白处先移动，再进入 exact target；所有 `mouse.move()` 均带 `steps`。candidate 修改路径未发现 native HTML5 drag dispatch、`dragTo()`、DOM 写入或通过 `page.evaluate` 写业务状态；helper 中 `page.evaluate` 均为状态读取。`setupLogicFlow` 的 localStorage fixture 注入是仓库规定的 beforeEach setup，不是 drag/business simulation。
- helper 在 release 前按 target identity读取真实 `getWareGroupStatus`，locked group 使用 `lockedLineage`；isolated/locked 分支先断言 expected module非空，locked-match release 后断言新增 manual node的 exact lineage与 moduleId。rejected/duplicated 分支保存并比较完整 node snapshot（含 raw-material/T0 节点字段）。这些静态修正方向正确。
- reviewer targeted command：`npm exec playwright test -- tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --grep 'isolating a node|duplicate drops|locked incompatible|isolated target|same ware|4\.16|4\.17' --workers=1`。构建成功，结果 `1 passed / 6 failed`：跨 lineage 同 ware通过；isolated、duplicate及 isolated-label 三项在第二次 drag 的 `compact-view` 仍 hidden处失败；两个 rejected 场景与 4.16/4.17 在 `spaceweed` source不存在/不可见处失败。没有一项失败到达“drag active + exact target hover + current status + target内 release + exact postcondition”。
- normative basis：current `openspec/specs/logic-flow-operation/spec.md:8-56,125-139,190-282`、`openspec/specs/logical-flow-planner/spec.md:160-224`、`openspec/specs/logic-flow-plans/spec.md:43-99`；较新的 active `openspec/changes/logic-flow-energycells/specs/logic-flow-energycells/spec.md:67-93,116-130` 覆盖旧 Energy Cells 禁拖语义。历史 E2E-3/5/15 步骤位于 archived `logic-flow-plans/test_tasks.md:117-151,213-220`。

Findings:

## F1 — closed：legacy helper与parent preservation满足要求

Classification: `passed preservation evidence`。

legacy drag helper已恢复为 `cb92fe76^` 原 snapshot；legacy parent test除必要 import path及无语义 whitespace normalization外一致，setup helper也只有必要 fixture path变化。`36/1` collection与默认不收集 legacy的边界沿用 worker evidence。该项不再要求修改。

## F2 — blocking：helper后置断言已存在，但二次 drag与一个 isolated caller仍未真正执行它们

Classification: `test-owned drag-driver/assertion defect`。

- outside→exact target enter、真实 actual status、isolated/locked expected module非空、locked-match exact lineage/module，以及 rejected/duplicate完整 snapshot比较均已静态闭合；不是当前阻塞点。
- targeted run证明 isolated、duplicate和 isolated-label都在第二次 drag尚未令 `isDragging/compact-view` 生效时终止，故 candidate 新增的 isolated/duplicate postcondition没有得到 current browser执行证据。最小修正应在 shared helper建立可重复的 outside→source→drag-active握手，并在进入 target前显式证明 compact view/drag state，而不是放宽 timeout或状态断言。
- `logic-flow-bug-regression.spec.ts:49-59` 仍以 `{ drop:false }` 手工 release，之后只断言 `.flow-node` 不含 `/isolated/` class；current `FlowNode.vue`没有该隔离 class contract，因此该断言可空跑。它应让 helper完成 target内 release及 connect/module/upstream postcondition，或删除与前一完整 isolated owner重复的 release路径。
- rejected与duplicate的 helper snapshot比较本身足以冻结 T0/raw-material集合；无需再增加另一套只比较总数的断言。当前缺的是让 truthful caller实际到达这些分支。

Contract basis: active Isolate/Duplicated/Locked/Rejected contracts及 `x4-drag-test` interaction phase。Correction owner: `task-test-4` test coding worker。Allowed paths: `tests/e2e/logic-flow/helpers/dragLogicFlow.ts` 与必要 status callers。Preserve: real Mouse API、每次 move的 `steps`、pre-up exact target identity、现有 exact node snapshot及 module/lineage断言。

Observable closure: isolated、duplicate、rejected各至少一个 canonical case在真实 source、drag active、目标 hover仍成立时 release，并执行 helper对应 postcondition；不再以 `drop:false` + 不存在的 CSS class代替结果。

## F3 — blocking：4.16/4.17的 lock方向正确，但 source前置不成立

Classification: `test-owned setup failure + stale historical expectation`。

- 4.16 显式关闭 default lock，以 EC 创建 unlocked industrial group，并要求 `actual available -> normal`及 release 后 `spaceweed`存在；这是 current unlocked acceptance方向。archived 4.16 的 hidden/dimmed期待已过期，不得恢复。
- 4.17 显式开启 lock，以 EC 创建 default-locked group，并要求 `spaceweed -> rejected`；helper在目标内 release后比较完整 snapshot，这是 current locked mismatch方向。
- 但两项都没有通过 UI切换到显示 `spaceweed` 的生活/农业候选分类。targeted run中 4.16停在 `scrollIntoViewIfNeeded()` 等待不存在的 source，4.17和 regression rejected case停在 helper的 visible-source断言；因此前置语义尚未建立，不能声称4.16/4.17 browser闭合。应先用 UI选择正确分类/lineage，证明 source可见，同时保留已经创建的 unlocked或locked目标组，再执行完整 hover/release断言。

Correction owner / allowed paths: `task-test-4` test coding worker，仅 `logic-flow-incompatible-drag.spec.ts`、`logic-flow-bug-regression.spec.ts` 和必要 shared helper。Observable closure: 4.16真实 unlocked + visible source + normal target drop；4.17真实 locked mismatch + visible source + pre-up Rejected + target内 release后 exact nodes/T0不变。

## F4 — closed：E2E-3保持在 saved-list modal contract内

Classification: `passed test contract`。

`logic-flow-plans.spec.ts:40-59` 通过 UI输入确定名称 `E2E-3 Plan`、保存并新建、验证工作区清空，再打开 Load modal并唯一定位该名称。删除 plan card内的 Hull Parts文本断言是正确修正：current modal contract只要求列出已保存方案，archived E2E-3也只要求“保存到列表”；内容恢复由 E2E-5 的 reload/load path负责。worker首轮 E2E-3/5/15通过可作为限定 smoke，后续 connection-refused rerun不推翻该证据。

## F5 — blocking：current browser coverage仍未补齐

Classification: `test-owned remaining coverage; continue task-test-4`。

candidate主要修已有 helper/caller，没有新增前序 `8ac54561` F4要求的强 browser owners。按 active OpenSpec与当前 canonical逐项复核，仍缺或仅部分覆盖：

- Auto→Manual：没有 caller显式要求 `expectedStatus:'auto'`，也没有同时证明 Auto/Manual label转换、release后 source=`manual`及实线结果。
- Replace lineage：没有 caller显式建立不同 lineage Auto节点、验证 Replace并在 release后比较 exact lineage/moduleId。
- 同 ware跨 lineage：本轮 case只证明 count=`2`（且 targeted通过），仍未证明两个 distinct lineage、两个 non-empty/distinct moduleId、对应模块名称，以及两条指向下游的具体 SVG连接。
- 空 group首节点与多组 target切换：没有对空 existing group的首节点投放，也没有在两个可见组之间依次验证 exact hoveredGroupId/target切换。
- 模块名：existing compact node、existing-target preview、new-line header、drag ghost四处仍无能区分 module name与ware name的强 UI断言。
- 隔离边界：尚无 browser case证明后续扩展不会自动打破既有隔离，以及 T0/raw-material preview在隔离节点停止；当前 connect case不能替代这两个相反方向的合同。
- i18n：没有一个非 optional browser case在 UI切换语言后同时验证候选区与规划区文本更新。
- default lock：`logic-flow-bug-regression.spec.ts:96-103` 只点击创建两个空组并读取 lock boolean；尚未用真实产品投放证明 lock-on/off创建的新组携带正确状态。

不应恢复为 canonical的 stale项：archived 4.16 hidden/dim、旧 Energy Cells禁拖/no-plus、raw ore直接业务写入、store-only priority/merge tests，以及用不存在的 `.isolated` class表达隔离。允许用最少强场景合并同一 active behavior，不要求恢复36个 canonical declarations。

## F6 — blocking guardrail residue：仍有错误 hover-off与无 target release

Classification: `test-owned guardrail violation / false positive`。

- `logic-flow-new-feat.spec.ts:33-53` 已新增 `hoveredGroupId === null`，但仍要求 locked target在 leave后不含 amber class；current lock base样式应保留 amber。该旧期待与 `logic-flow-bug-regression.spec.ts:85-93` 的正确 cancel owner矛盾，应删除错误 class断言或让此重复 case退出 canonical。
- `logic-flow-interaction.spec.ts:181-195` 的 `startWareDrag()` 后直接 `mouse.up()`，release前没有 target-hover或明确 hover-off，release后也只看 drag flag，没有 group/node不变 postcondition，仍违反 `x4-drag-test` phase guardrail。
- 除上述项外，静态扫描确认 canonical Logic Flow所有 `mouse.move()`都有 `steps`；未发现 native drag dispatch或以 `page.evaluate`写业务来模拟 drag。只读 store观察不是违规，fixture localStorage setup也不是该 guardrail的假阳性。

Correction owner / allowed paths: `task-test-4` test coding worker，仅上述 canonical test/helper路径。Observable closure: 每个 release前有 exact target hover或 hover-off，release后有对应 mutation/no-mutation；locked leave保留 base amber。

## F7 — failure ownership：当前无可继续到 product coding 的已证实 bug

Classification:

| 类别 | 剩余证据 |
| --- | --- |
| `test-owned` | 二次 drag未启动、`spaceweed`分类/source未建立、isolated假阳性、两个 release guardrail residue、F5 current browser coverage缺口 |
| `stale` | archived 4.16 hidden/dim、旧 EC禁拖、`.isolated` CSS期待、旧 locked leave去 amber、store-only/direct-write历史实现 |
| `继续 coding` | 继续 `task-test-4` test coding；当前没有 `src/**` product-coding finding |

本轮6个 focused失败全部发生在 drag-active或source前置之前。worker的9项 `ERR_CONNECTION_REFUSED`同样只是环境失败。没有 case满足“truthful setup + visible source + drag active + exact hover/leave + current status + exact release postcondition”后仍得到相反产品结果，因此不得仅凭这些失败开产品 bug。只有修正上述 test-owned前置后仍稳定矛盾，才可携 exact command、fixture/category/lineage/lock前提、pre-up signal和post-up实际结果建议 product coding。

Verdict:
`changes_required`

legacy provenance、outside→target enter、helper的 status/module/lineage/snapshot方向和 E2E-3 modal contract均已闭合；但状态 postcondition仍被二次 drag启动失败或 `drop:false`绕过，4.16/4.17没有建立可见 source，两个 drag guardrail residue尚存，且 F5 多项 active browser contracts仍无强 owner。

Changes:

1. 修 shared helper的可重复 source→drag-active握手；让 isolated/duplicate/rejected真实执行目标内 release与现有精确 postcondition，移除 isolated CSS假阳性。
2. 4.16/4.17及 regression rejected通过 UI切换到正确候选分类，保留 unlocked acceptance / locked mismatch语义并复验。
3. 修 locked cancel base样式与 `interaction 5.1` release guardrail。
4. 用最少强 canonical cases补 F5列出的 Auto、Replace、lineage/module/connections、empty/multi-target、module-name、isolation/T0、i18n、default-lock coverage。
5. 仅重跑 legacy/canonical collection、diff-check、九状态 drag matrix、4.16/4.17及 E2E-3/5/15；完整 suite留到 focused gate闭合后。

Caveats:

- 按用户要求未运行完整 suite。reviewer只运行7项 focused browser evidence；其构建成功，但 `1 passed / 6 failed`不能外推为完整 Logic Flow结果。
- worker的 `36/1`、`112/8` collection与 build/diff通过只证明解析和静态 gate；E2E-3/5/15首轮通过是限定 smoke。webServer退出后的 `ERR_CONNECTION_REFUSED`不参与行为判定。
