# task-test-4 review — candidate 8edb93c1

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；复核 immutable candidate `8edb93c1` 的 Logic Flow 测试修正。未修改产品、测试、fixture、配置、workflow 状态或 candidate；唯一写入是本报告。

Reviewed commit:
`8edb93c198045287c7890a96e7d806f4fbc7b342`，parent `b9ca172f2db2ec8d7aeea602888e980fc1819d0f`。

Evidence:

- candidate 可精确解析，审查开始时 `HEAD` 即 candidate，`git status --short` 无输出。candidate 实际触及 10 个测试路径：八个 focused spec、`helpers/setupLogicFlow.ts` 和新增 `helpers/dragLogicFlow.ts`；无 `src/**`、OpenSpec、fixture、legacy 或配置变更。`git diff --check 8edb93c1^ 8edb93c1` exit `0`。
- 按要求未重跑浏览器测试。现有 worker smoke 是 13 tests / 3 passed / 10 failed；`test-results/.last-run.json` 记录 10 个 failed IDs，目录可精确归并为 `compact-drag-view.spec.ts` 2 个失败与 `logic-flow-plans.spec.ts` 8 个失败。失败的 plan cases 为 E2E-1、3、4、5、7、11、14、15；因此通过的是 E2E-2、9、12。
- collection-only 命令 `npm exec playwright test -- --list <八个 focused spec>` exit `0`，共收集 105 tests；未收集 legacy。未运行完整 E2E。
- `task-test-4.md:10-12,26-30,33-42` 要求 canonical E2E 完成 locator/fixture 迁移并通过 feature-scoped gate；`context-2.md:32-36,48-55` 要求旧原件保留、重复/过期用例不进入 canonical。
- `openspec/test_experience.md:73-85` 将 Logic Flow 拖拽测试路由到 `x4-drag-test` 并列出 Normal / Duplicated / Locked / Rejected 状态。当前 `x4-drag-test` 的适用 guardrail 是：Mouse API、每次 `mouse.move` 带 `steps`、目标 hover 状态在 `mouse.up()` 前断言、不得用 native drag dispatch、`page.evaluate` 模拟拖拽或手工 DOM 操作。
- 对 candidate 触及的 10 个文件做静态扫描：98 个 `page.mouse.move` 全部带 `steps`；35 个直接 `page.mouse.up`；没有 `dispatchEvent`、`dragTo()`、`startDragging/handleHover/handleDrop` 的 evaluate 模拟，也没有 `removeChild` / DOM 写入。`logic-flow-bug-regression.spec.ts:733,799` 的两个 `document.querySelector*` 是 DOM 读取，不是拖拽模拟或 DOM 修改。
- 新 helper 在 [dragLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/dragLogicFlow.ts#L18) 使用 stepped Mouse API，在 [dragLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/dragLogicFlow.ts#L29) 移入目标，并在 [dragLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/dragLogicFlow.ts#L31) 到 [dragLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/dragLogicFlow.ts#L38) 分别断言 new、rejected、existing-group hover，之后才在 [dragLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/dragLogicFlow.ts#L41) release。其 `page.evaluate` 只读取 `hoveredGroupId`，不模拟事件。
- 当前 OpenSpec 明确要求紧凑视图 `grid-cols-4`，并要求悬停新建产线时显示预览标题和蓝色虚线占位符（[logical-flow-planner/spec.md](../../../openspec/specs/logical-flow-planner/spec.md#L88)、[logical-flow-planner/spec.md](../../../openspec/specs/logical-flow-planner/spec.md#L105)）。当前产品也使用 `compact-view grid grid-cols-4`，新建区 hover 由 `isHoveringNewZone` 切换预览（[LogicFlowPlanningZone.vue](../../../src/components/logic-flow/LogicFlowPlanningZone.vue#L382)、[LogicFlowPlanningZone.vue](../../../src/components/logic-flow/LogicFlowPlanningZone.vue#L490)）。

Findings:

## F1 — blocking：共享 drag helper 合规，但 candidate 未满足“所有拖拽路径”的 guardrail，且新建区握手仍未跑通

Classification: `test-owned drag helper / hover handshake`。

共享 helper 的静态形态符合 Mouse/steps/pre-release-hover 规则；candidate 也没有 native drag、evaluate 拖拽模拟或手工 DOM 修改。问题是它没有在当前 smoke 中建立有效的新建区 hover：八个依赖首次 new-zone drop 的失败都在空 planning page 结束，worker 已报告失败点为 new planning zone hover。helper 自己在 hover 成立前拒绝 release，说明失败仍是测试驱动前置条件未建立，不能从该断言直接推出产品违反 OpenSpec。

此外，八文件仍保留未走共享 helper 的 drop-intending 手写路径，部分在 `mouse.up()` 前没有目标 hover 断言：

- `logic-flow-drag-feedback.spec.ts:120-123` 移入 new zone 后直接 release；
- `logic-flow-bug-regression.spec.ts:609-612`（Bug 13 new zone）、`:663-666`（Bug 15 existing group）及 `:1326-1328`（Bug 16.2 new zone）直接 release；
- `ui-adjust.spec.ts:215-226` 甚至没有把 pointer 移入定位到的 new zone，就 release；
- `ui-adjust.spec.ts:39-50` 和 `logic-flow-interaction.spec.ts:115-123` 只证明 compact view 出现，没有验证用例声称的 compact grid/目标 phase。

Contract basis: `x4-drag-test` guardrail；OpenSpec new-zone preview scenario。Correction owner: 下一位 `task-test-4` coding worker。Allowed paths: `tests/e2e/logic-flow/helpers/dragLogicFlow.ts` 与这八个 focused specs。Preserve: real Mouse API、所有 move 的 `steps`、pre-release observable hover、drop 后 UI postcondition；不得改 `src/**` 或用 store/DOM 模拟拖拽。

Focused closure: 先让一个 clean new-zone drop、一个 existing-group drop、一个 rejected hover、一个 move-away/cancel case 通过；每个 drop path 在 release 前可观察对应 UI/store hover，release 后断言具体 group/node 或不变结果。不要先跑完整 suite。

## F2 — blocking：`clean` 仍是“清空 seeded active plan 的 groups”，`seeded` 模式无人使用

Classification: `test-owned clean/seeded fixture contract`。

[setupLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/setupLogicFlow.ts#L16) 正确保留了 fixture -> reload -> UI language -> UI view 顺序；但 `clean` 分支只点击 `.clear-all-btn`（[setupLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/setupLogicFlow.ts#L33)）。该按钮最终调用 `clearAllGroups()`，只清 groups/active group，不清当前 plan identity、saved plan、settings 或 snapshot（[useLogicFlowCandidatePresenter.ts](../../../src/components/logic-flow/presenters/useLogicFlowCandidatePresenter.ts#L219)、[useLogicFlowStore.ts](../../../src/store/useLogicFlowStore.ts#L850)）。helper 随后还把 `Logic Flow 1` 接受为 clean 标题（[setupLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/setupLogicFlow.ts#L40)）。

八个 spec 的九个 setup 调用全部传 `'clean'`；没有 caller 使用 `'seeded'`。现有 10 份失败快照均显示 `Logic Flow 1` 和零 group，精确证明该混合状态仍存在。它污染 plan count、existing-save、load、dirty-check 和 default-lock 前提；3 个 smoke 通过不等于 clean contract 合格，例如 E2E-12 直接调用 store 的空保存路径即可绕过 UI 而通过。

Contract basis: `task-test-4.md:28-29` 的 fixture/current-browser migration，前轮已接受的 clean/seeded correction。Correction owner: 下一位 test coding worker。Allowed paths: `setupLogicFlow.ts` 和 focused specs 的 mode selection。Preserve: canonical `db.json` 注入、删 `vsn`、reload、通过 UI 选语言/视图；不要修改 fixture 或产品 normalization。

Focused closure: `clean` 必须断言“未绑定 saved active plan 的新工作区”完整状态，`seeded` 必须断言 `Logic Flow 1` 与 3 groups；plan cases 按场景选 mode。至少一个 clean 与一个 seeded caller 先通过 setup-only/focused assertion。

## F3 — blocking：直接构造业务状态、旧 locator residue 和弱/过期断言仍大量存在

Classification: `test-owned state construction / selector / assertion migration`。

Plan smoke 已直接暴露两类问题：

- E2E-7 在 [logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L103) 直接赋值 `store.groups`，手写 `module-hullparts` 节点，再直接 `saveCurrentPlan()` / `clearAll()`；这既不验证浏览器建模路径，也绕过当前 plan normalization/rebuild 契约。应使用 seeded plan 和 Load UI。
- E2E-4/E2E-5 在 [logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L67) 与 [logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L82) 直接调用 `saveCurrentPlan()`，而当前 OpenSpec 要求新方案点击 Save 后显示 SmartSaveDialog、已有方案点击 Save 后更新原方案（[logic-flow-plans/spec.md](../../../openspec/specs/logic-flow-plans/spec.md#L57)）。E2E-12 同样直接 `clearAll()` / `saveCurrentPlan()`，没有验证规范要求的 warning UI（[logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L192)）。
- E2E-1 已换成当前 `.plan-title-text` locator，却只断言元素拥有用于定位它自己的类（[logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L17)）；用例名称与 current OpenSpec 要求的是 `text-purple-400` 主题，以及保存/新建/加载按钮颜色（[title-as-plan-title/spec.md](../../../openspec/specs/title-as-plan-title/spec.md#L74)）。这是弱化/过期断言，不是产品失败。
- E2E-3 允许 SmartSaveDialog 不存在时继续通过分支（[logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L48)）；E2E-14 保留不存在的 `.new-group-zone` fallback，并只验证入口可见，未完成 archived/current contract 所要求的可交互创建行为（[logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L211)）。

未进入 13-test smoke 的 regression/canonical 文件也未完成迁移：

- `logic-flow-bug-regression.spec.ts:15-35` 的公共 setup 直接 `clearAllGroups/addGroup/expandUpstream/toggleNodeIsolation`；同文件还有大量同类 evaluate mutation，例如 `:64-73`、`:90-94`、`:491-497`、`:1203-1209`，并在 `:992-1001` 直接写 `node.isIsolated = true`。这些是直接构造业务状态，不是 E2E 用户前提。
- `logic-flow-drag-feedback.spec.ts:187` 直接 `logicFlowStore.groups = []`；它也应使用明确 setup mode/UI 前提。
- `logic-flow-bug-regression.spec.ts:1019-1060` 在测试内重写一套 T0 递归算法，再断言该副本的输出，不能证明浏览器当前行为。
- setup 固定中文后，`logic-flow-bug-regression.spec.ts:1302` 仍使用 English-only `button:has-text("Agri/Life")`；`:1078-1096` 已找到 current `language-select`，却仍按自定义 dropdown 点击 option/fallback menu，而 repository 约定是 `selectOption()`。
- 弱/可空跑断言仍见 `logic-flow-new-feat.spec.ts:227-236,279-289,461-477` 的 optional branches；`ui-adjust.spec.ts:32-50` 的“等宽布局”未断言 `grid-cols-4`，`:207-226` 的“新建规划区预览位置”既不 hover new zone，也不断言预览或位置。

Contract basis: task-test-4 的 canonical “真实浏览器行为”目标、current OpenSpec 与 `context-2` 的 duplicate/stale classification。Correction owner: 下一位 test coding worker。Allowed paths: 八个 focused specs及既有两个 helpers；若某纯 store case 无独立浏览器价值，保留原件在既有 legacy/history，不应新增 test framework。Preserve: plan create/save/load、title theme/edit、lineage/lock/preview 等仍有 current OpenSpec 的行为；不要通过放宽 count、optional branch 或 store-only assertion 取绿。

Focused closure: 13-test scope先做到 13/13，且 E2E-1 精确断言主题、E2E-7 只经 fixture/UI load；随后静态确认上述直接业务写入、English-only locator、optional/no-op assertion 已按 current-contract 分类并清理，再跑八文件 105-test scope。

## F4 — no issue：未误删需要保留的当前行为

Classification: `preservation passed for this delta`。

`git diff -U0 8edb93c1^ 8edb93c1 | rg '^[+-]\s*test'` 无 test declaration 增删；candidate 只收敛 helper/selector/断言，没有删除新 case。背景所述 compact vertical case 是 parent `14a0a1ca` 删除的 canonical 旧断言，原件仍在 [tests/legacy/e2e/from-e2e/compact-drag-view.spec.ts](../../../tests/legacy/e2e/from-e2e/compact-drag-view.spec.ts#L57)。其 `display:flex/flex-direction:column` 与 current `grid-cols-4` 契约相反（[logic-flow-ui-adjust/spec.md](../../../openspec/specs/logic-flow-ui-adjust/spec.md#L22)），所以不应恢复到 canonical。

Correction owner: none for deletion. Preserve: legacy original继续不进入 Playwright gate；current compact grid behavior仍由 canonical current-contract case覆盖。

## F5 — failure ownership：当前 10 个 smoke failure 全部留给 test coding worker；没有可开的产品 bug

| 失败组 | 数量 | 当前分类 | 最小修正 |
| --- | ---: | --- | --- |
| `compact-drag-view` 两 case + plan E2E-3/4/5/11/14/15 | 8 | test-owned new-zone hover/helper + contaminated clean state | 修共享 Mouse helper 的真实 hover 握手，按场景选择 clean/seeded，保留 pre-up hover assertion |
| plan E2E-1 | 1 | test-owned weak/过期 assertion | 按 `title-as-plan-title` 精确验证紫色主题，不以 selector class 自证 |
| plan E2E-7 | 1 | test-owned direct business-state construction | 使用 seeded fixture 和 Load UI，不直接赋值 store |

当前没有一个失败在“truthful fixture mode + current locator + real Mouse hover handshake + exact current OpenSpec assertion”全部满足后仍复现相反产品结果。因此不得仅凭 hover assertion timeout、空截图或 3/10 smoke 结果创建 bug。

只有下一轮先修正测试后，某个最小 case仍稳定违反 current OpenSpec，才可开 bug；例如真实 pointer 已观察 `isHoveringNewZone`/preview phase 后，UI仍不呈现 [logical-flow-planner/spec.md](../../../openspec/specs/logical-flow-planner/spec.md#L105) 的 preview，或 seeded plan 经 Load UI 后没有按 [logic-flow-plans/spec.md](../../../openspec/specs/logic-flow-plans/spec.md#L83) 加载。bug evidence 必须附 exact focused command、current selector、前置状态和相反 UI 结果；在此之前 owner 仍是 test coding worker。

Verdict:
`changes_required`

Candidate `8edb93c1` 明显改善了重复 drag helper、steps、current ware/title/language selectors 和部分 UI-adjust assertion；但 13-test smoke 仍为 3 passed / 10 failed，且所有九个 setup caller 仍使用伪 clean。共享 helper 的 new-zone hover 尚未跑通，手写拖拽仍有 guardrail 缺口，plan/regression 仍直接构造业务状态并保留弱/过期断言。当前失败仍是 test-owned，无产品 bug 证据。

Changes:

1. 只先改 `helpers/setupLogicFlow.ts`、`helpers/dragLogicFlow.ts`、`compact-drag-view.spec.ts`、`logic-flow-plans.spec.ts`：建立 truthful clean/seeded，跑通一个 new/existing/rejected/cancel pointer handshake，并把 plan save/load/theme/warning 改为 UI-observable contract。
2. 重跑同一 13-test smoke；要求 13/13，且不以移除 hover assertion、direct store write、optional branch 或放宽断言换绿。
3. 再清理其余六个 focused specs：保留专用视觉拖拽时补齐 pre-up hover；把 regression 的业务状态改由 UI/既有 fixture建立，或将没有独立浏览器价值的纯 store/重复 case留在 legacy/history。
4. 运行八文件 105-test focused scope和 `git diff --check`。完整 `npm run test:e2e` 留到 focused convergence 后；本轮不支持任何 `src/**`、OpenSpec、fixture 或 bug-artifact修改。

Caveats:

- 本轮遵从“短静态/collection”要求，没有重跑 13 tests 或完整 E2E；运行证据只有 `--list` 与 `git diff --check`，失败归并使用 worker 已留下的 `.last-run.json` 和 10 份 error-context。
- error-context 只含失败时页面快照，没有 assertion stack；因此报告不声称 helper timeout 的内部原因已被证明，只能确定测试尚未建立 required hover precondition。这正是不能升级产品 bug 的原因。
- 105-test scope尚未重跑；F3 中未进入 13-test smoke 的问题是静态可证 migration debt，不宣称它们是本轮 10 个首失败签名。
