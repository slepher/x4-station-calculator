# task-test-4 review — candidate 8ac54561

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；只读复核 immutable candidate `8ac54561`。未修改产品、测试、fixture、配置、candidate、Git index 或 workflow 状态；唯一仓库写入是本报告。

Reviewed commit:
`8ac54561e068741ea5341cc4774b81b59a4c322d`，single parent `0016e1562f49044be0e3b9d55ba7430e10adb327`。

Evidence:

- 审查开始时 `HEAD` 为 candidate，`git status --short` 无输出。candidate 只修改 4 个 `tests/e2e/logic-flow/**` 文件，并在 `tests/legacy/e2e/from-unified-e2e/logic-flow/helpers/**` 新增 2 个 helper、更新 1 个 legacy regression；无 `src/**`、OpenSpec、fixture 或配置改动。`git diff --check 8ac54561^ 8ac54561` exit `0`。
- `npm exec playwright test -- --list tests/e2e/logic-flow` exit `0`，收集 `112 tests in 8 files`。从 legacy 文件目录执行 `npm exec playwright test -- --list logic-flow-bug-regression.spec.ts` exit `0`，收集 `36 tests in 1 file`。
- legacy regression 的 `test-setup` 相对路径解析到 `tests/test-setup.ts`；legacy `setupLogicFlow.ts` 的 fixture 路径解析到 `tests/fixtures/db.json`。与 `cb92fe76^` 原件相比，36 个 declaration、标题、步骤和断言 body 都保留，差异为 import 路径和 trailing-whitespace 清理。
- legacy 已不再 import canonical helper，满足目录自包含；但其 `dragLogicFlow.ts` 不是 `cb92fe76^` 的历史 helper snapshot，而是复制了后续 canonical helper并同步加入 actual-status / post-drop 逻辑。该 helper 会改变旧 case 的执行语义，不能称为 provenance-exact 原件。
- `x4-drag-test` 静态检查：candidate canonical helper 使用真实 Mouse API，所有 `page.mouse.move()` 均带 `steps`；未发现 native drag dispatch、`dragTo()`、手工 DOM 操作或通过 `page.evaluate` 写业务状态。existing/new target 均在 helper 内于 release 前验证 `hoveredGroupId` / `isHoveringNewZone`。
- current authority：`logic-flow-operation/spec.md:8-56,125-139,190-282`；`logical-flow-planner/spec.md:160-224`；`logic-flow-plans/spec.md:43-99`；active `logic-flow-energycells` change `:67-93,116-130`。历史 E2E-3/5/15 步骤位于 archived `logic-flow-plans/test_tasks.md:117-151,213-220`。

Findings:

## F1 — blocking：legacy 36/1、路径与自包含已关闭，但 helper 不是历史原件

Classification: `test-owned preservation gap`。

36 个 legacy declarations 和其测试 body 已完整保留，collection 与 import resolution 均通过；此前“依赖 canonical helper”的问题也已关闭。剩余问题是 legacy `helpers/dragLogicFlow.ts` 相对 `cb92fe76^` 原 helper新增了状态分支和 release 后断言，并非只做路径调整。generation-2 的“旧测试原件不删除”要求不仅保留标题，也要保留其必要 helper 语义；否则未来运行 legacy 时得到的是后来修正过的 driver，而不是被迁移时的原件。

Correction owner / allowed paths: `task-test-4` test coding worker，仅 `tests/legacy/e2e/from-unified-e2e/logic-flow/helpers/dragLogicFlow.ts`。用 `cb92fe76^:tests/e2e/logic-flow/helpers/dragLogicFlow.ts` 作为 snapshot；只做使相对 import 可解析所需的调整。保留当前已经正确 path-adjusted 的 legacy `setupLogicFlow.ts`、36 个 test body 和 legacy 非默认收集边界。

Observable closure: legacy 仍 collection `36/1`，且 legacy helper 与 `cb92fe76^` 原 helper除必要路径差异外一致。

## F2 — blocking：canonical helper 的 actual status 有进步，但 locked-match 与 isolated postcondition仍不可信

Classification: `test-owned helper/assertion defect`。

- `dragLogicFlow.ts:75-85` 已不再用 caller 的 `expectedStatus` 覆盖 actual status；`isolated` vocabulary也已对齐 store。这两项关闭。
- locked target 的 UI 以 `group.lockedLineage` 作为 effective lineage（`LogicFlowPlanningZone.vue:31-47`），helper却以 `store.draggingLineage || 'default'` 查询 actual status（`:67-74`），因此非-default locked group的分类不一定等于真实 UI分类。
- `useLogicFlowStore.stopDragging()` 在 drop时清空 `draggingLineage`（`:153-159,224-260`）；helper却在 `page.mouse.up()` 后才读取 lineage（`dragLogicFlow.ts:155-164`），非-default locked-match会退成 `default`。返回对象虽读取 `moduleId`，`toMatchObject` 并未断言它，尚未证明“强制血统映射”。
- 两个 isolated caller都用 `{ drop: false }` 后自行 release，绕过 helper的 isolated postcondition。`logic-flow-bug-regression.spec.ts:19-20` 随后要求 `.flow-node` class匹配 `/isolated/`，既与 active Connect 后解除隔离相反，当前 `FlowNode.vue:97-106` 也根本没有 `isolated` class；`:64-65` 的 `not.toHaveClass(/isolated/)` 因同一原因可空跑。两项都未证明正确 module/lineage及上游恢复。
- duplicate 的 pre-up red/label与 release后单节点已有一个有效 owner；new-zone与 hover-leave cancel也有有效 pre-up signal及 postcondition。4.17 已补 rejected release 后总节点不变，但 generic helper和 retained rejected case仍只检查 dragged ware count/无 preview，未精确冻结 T0/raw-material 集合。
- cumulative canonical仍有 `logic-flow-interaction.spec.ts:181-195` 的 release：只证明 drag active/stop，没有 release 前 target-hover或 hover-off，也没有 group/node不变 postcondition；`logic-flow-new-feat.spec.ts:33-52` 的旧 cancel case仍以“locked base amber class消失”判断 leave，与 current locked样式冲突。两项属于 test-owned guardrail residue。

Correction owner / allowed paths: `task-test-4` test coding worker，限 `tests/e2e/logic-flow/helpers/dragLogicFlow.ts` 及上述实际 release callers。Preserve: real Mouse API、每次 move 的 `steps`、只读 `page.evaluate`、pre-up target identity / hover-off、current status-specific UI。

Observable closure: release 前缓存 dragging lineage并按 target effective lineage验证 actual status；locked-match后断言新增 manual node的 exact lineage和非空/正确 moduleId；isolated release后断言 Connect、解除隔离、module及上游恢复；rejected后 exact nodes/T0 不变；所有手工 `mouse.up()` 前都有 target hover或明确 hover-off，之后有对应 postcondition。

## F3 — blocking：4.16/4.17基本闭环；plans 仅 E2E-5闭合，E2E-3与E2E-15仍受测试问题阻塞

Classification: `test-owned remaining work + stale historical expectation`。

- 4.16 现在先关闭 default lock，以 unlocked group建立 `actual available -> normal`，并在 drop后验证 `spaceweed` 可见；这符合较新的 active contract。archived 4.16 的 hidden/dimmed期待已被当前“只有 locked mismatch才 Rejected”语义淘汰，属于 `stale`，不得恢复。未重跑 browser，所以只确认 test shape已闭环，不能声称 runtime passed。
- 4.17 已把实际拖拽 ware改为 default locked lineage不支持的 `spaceweed`，release前验证 red/Rejected/non-dim，release后验证总节点数不变；active locked-reject前提与结果静态闭环。`:32-34` 的 `hullpartsSource` 只做无关可见性检查，应删除但不是产品缺陷。
- E2E-3 现在能定位 previous run 已证实的默认名 `我的逻辑组网` 并验证 Hull Parts，但没有执行 archived E2E-3 明确要求的“输入方案名称”。Current `SmartSaveDialog` 在 NEW + unsaved plan下确实显示 input；应填确定名称并以该名称定位，避免 locale默认名自证。
- E2E-5 保留 UI save、reload、new、Load、同名 plan唯一、加载后 `weaponcomponents` 及标题，静态上已闭合覆盖保存与持久化；保留不动。
- E2E-15 已补加入更高 tier manual node和动态标题变化；其场景当前被 F2 的 locked-match helper阻塞。修 helper后应保留该 body，并同时由 helper证明 forced lineage/module mapping。

Correction owner / allowed paths: `task-test-4` test coding worker，仅 `dragLogicFlow.ts`、`logic-flow-plans.spec.ts` 和必要的 retained regression caller。Preserve 4.16/4.17 current semantics及 E2E-5 reload/load proof。

## F4 — blocking：cb92 的 C behaviors仍有大量 current browser coverage缺口

Classification: `test-owned coverage gap; continue test coding`。

按 cb92 原始 `C` / `C/R` 分类与后续 active OpenSpec核对：

- 已有可信 owner：duplicate `12.1`、new-zone `13.1`、cancel `36`；4.16可承接 unlocked acceptance。locked reject由4.17基本承接。
- 部分承接但未闭合：`1.1/2.1/8.1` isolation/label/Connect（错误或空跑 postcondition）；`3.1` 同 ware跨 lineage（只断言 count=2，未断言两个 moduleId/lineage/模块名）；locked-match `11.2`（未证明 module mapping）；默认锁定 `35`（已有 UI toggle和 on/off group state，但应与实际 product drop形成一个完整 owner）；locked reject `11.1/16.1` 尚缺 exact T0集合不变断言。
- 仍无等价强 browser owner：Auto→Manual `4.1`；Replace lineage `5.1`；两个同 ware节点的两条具体 SVG 连线 `7b.1`；空 group拖入首节点 `10.1`；多组间精确 hover/target切换 `15.1`；existing/preview node、new-line header、drag ghost三处模块名称 `28/29/30`；隔离不被扩展打破 `31`；隔离边界停止 T0 preview `33`；UI语言切换同时更新候选/规划文本 `34`。
- 不应恢复为 canonical：method-only priority、store-only合并等 `L-D` 原件；raw `ore.isIsolated` 的旧 31/32实现、archived 4.16 hidden/dim、旧 Energy Cells禁拖均为 `stale/L-X`。它们只留 legacy。

Correction owner / allowed paths: `task-test-4` test coding worker，限现有 `tests/e2e/logic-flow/**`。允许一个强 browser case合并同一 active scenario，不要求恢复36条 canonical declarations；不得以 direct store write、optional branch、宽松 count或产品兼容代码取绿。

## F5 — failure ownership：当前没有需要 product coding 的已证实 bug

Classification:

| 类别 | 当前项目 |
| --- | --- |
| `test-owned` | legacy helper provenance、locked/isolated helper、手工 release guardrail、E2E-3确定名称、C behavior coverage缺口 |
| `stale` | archived 4.16 hidden/dim、raw ore isolation实现、旧 EC禁拖、method-only/重复 canonical residue |
| `需要 coding` | 仅需要继续 `task-test-4` test coding；当前无 `src/**` product-coding finding |

candidate 最后未重跑 browser smoke；本 reviewer按要求也未运行浏览器。没有任何“完整 current setup + verified hover/leave + exact current contract”后仍稳定相反的结果，因此不得报产品 bug。若完成 F2/F4 后 focused case仍失败，才可附 exact command、fixture/lineage/lock前提、pre-up signal和post-up实际结果路由给 product coding owner。

Verdict:
`changes_required`

Collection、diff-check、legacy 36 declarations和自包含路径均有进展，4.16/4.17与 E2E-5也基本闭环；但 isolated case存在确定的反向/空跑断言，locked-match helper在 release 后读取已清空 lineage且未验证 moduleId，E2E-3未输入确定名称，cb92 的多项 C behavior仍无 canonical browser owner。静态证据已足以拒绝，无需长测试。

Changes:

1. 把 legacy drag helper还原为 `cb92fe76^` 的 provenance-exact snapshot；保持 legacy `36/1` collection。
2. 最小修 canonical helper：release前缓存/effective lineage，locked-match验证 exact module mapping；补 isolated、rejected postcondition，并修两个手工 release residue。
3. E2E-3填确定名称；保留 E2E-5；E2E-15仅随 helper修正复验；保留当前4.16/4.17分工。
4. 用最少强场景补 F4 的 partial/missing C behaviors。随后只跑 legacy/canonical collection、`git diff --check`、九状态 drag matrix、4.16/4.17及 E2E-3/5/15；这些 focused gate通过后再跑完整 suite。

Caveats:

- 本轮按用户要求只做 static/collection；未运行 browser smoke、完整 Logic Flow或完整 E2E，未声称任何 browser case runtime passed。
- `112/8` 与 `36/1` 只证明可解析、可收集，不替代 interaction/postcondition review。
