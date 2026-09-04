# generation-2 task-test-4 full canonical E2E review — 6f0b3565

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` full-suite evidence classification。仅审查 immutable candidate 与 canonical E2E 证据；未修改产品代码、测试、fixture、Git index、commit、branch 或 workflow state。

Reviewed commit:
`6f0b35655c45da1399bf2a8b03416989eb0b1568`，single parent `30e1de6ba7b2c68f65d9614921d5949cd0c1e94b`。candidate 只修改 `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts`（34 insertions / 9 deletions）。审查时 control worktree HEAD 为后续文档提交 `6530b4d0c9a520444153ec901a6da3c24cf55520`；`git diff --name-status 6f0b3565 HEAD` 只有已接受 focused review 文档，没有产品或测试树差异，因此运行树在相关代码上等同 candidate。

Verdict:
`changes_required`

完整 canonical E2E gate 明确失败：`npm run test:e2e` exit `1`，`981 tests`，`379 passed / 58 skipped / 544 failed`。本轮 Chromium、fresh production build 和 preview 均正常，不能把 544 个失败归为 driver/environment；同时现有证据没有确认任何新产品 BUG。

## Evidence

- 用户提供的真实完整运行：`npm run test:e2e`；Chromium/preview 正常；最终 `379 passed / 58 skipped / 544 failed`，exit `1`。
- 完整运行后的 `test-results/.last-run.json` 曾包含精确 `544` 个 failed test id；审查开始时 `test-results/**/error-context.md` 共 `539` 份，即 5 个失败没有独立页面快照。
- 只读 collection：`npm exec playwright test -- --list --reporter=json` 收集 `981 tests / 71 files`。以 Playwright 的 file-id SHA-1 前缀将完整运行的 544 个 failed id 映射到当前 collection，`544/544` 全部成功归入 `54` 个 `tests/e2e/**` 文件；无 legacy、Unit 或 skill test 混入。
- 本轮没有第二次运行 full suite。只对 full run 中 candidate 文件的两个失败做 focused 复核：
  `npm exec playwright test -- tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts --grep "locked incompatible drops|leaving a locked target"`，结果 `2 failed`。两者均在 `dragLogicFlow.ts:39` 等待 `.ware-card-wrapper[data-ware-id="spaceweed"]:visible` 时 30 秒超时，未进入 active drag、目标 hover 或 postcondition。
- `git diff --check 6f0b3565^ 6f0b3565` exit `0`；审查与 focused run 后源码、测试和 Git index 无变化。

### Failure counts by area and file

以下计数为完整运行的 `failed/collected`：

| Area | Failed | Files |
| --- | ---: | --- |
| auto-sector | 38 | `auto-sector-group-one-binding` 4/25；`auto-sector-group-one-core` 34/34 |
| build | 34 | `build-flow/build-flow` 27/27；`build-plan-preview/build-plan-preview` 1/8；`build-ui-component/build-ui-component` 6/6 |
| tooltip / drag | 9 | `button-tooltip-integration` 4/4；`button-tooltip-side/button-tooltip-side` 4/4；`compact-drag-view` 1/2 |
| DLC / version | 11 | `dlc-setting/dlc-setting` 2/30；`dlc-settings/dlc-settings` 2/14；`dlc-settings/dlc-tag-display` 4/7；`game-version-switch/game-version-switch` 3/6 |
| Logic Flow | 54 | `import-logic-flow` 34/34；`logic-flow-bug-regression` 2/14；`logic-flow-drag-feedback` 2/5；`logic-flow-incompatible-drag` 2/2；`logic-flow-interaction` 3/16；`logic-flow-new-feat` 5/19；`logic-flow-plans` 4/11；`ui-adjust` 2/14 |
| map | 75 | `advanced-resource-filter` 23/23；`bugfix-advanced-resource-filter` 1/1；`map-dlc` 18/20；`map-refactory` 15/19；`map-search` 2/20；`resource-pie` 8/8；`x4-import-move` 6/6；`x4-map-tooltip` 2/7 |
| production | 82 | `empire-crud` 1/4；`import-export` 5/24；`module-management` 9/12；`settings` 13/13；`station-dashboard` 16/33；`station-management` 14/23；`station-resource-group` 9/16；`ware-flow` 15/48 |
| sector | 2 | `sector-flow-filter/sector-flow-filter` 2/3 |
| ship | 195 | `abandon-selected-ship` 3/3；`bugfix-abandon-selected-ship` 1/1；`bugfix-build-ship-equipment-panel` 9/9；`bugfix-ship-build-panel-ship` 2/2；`bugfix-ship-level-blueprint` 1/1；`bugfix-ship-status-diff` 1/1；`build-ship-equipment-panel` 31/31；`osaka-default-preset` 6/6；`ship-build-equipment` 31/31；`ship-build-material` 31/31；`ship-build-panel-ship` 12/12；`ship-build-stat` 15/15；`ship-build-storage` 27/27；`ship-build` 7/17；`ship-items` 11/11；`ship-level-blueprint` 7/7 |
| toolbar | 44 | `toolbar-action2one/toolbar-action2one` 44/46 |
| **Total** | **544** | **54 files** |

### Representative error-context

- Candidate residuals, retained by the focused rerun:
  - `test-results/logic-flow-logic-flow-bug--93854-ted-feedback-and-no-preview-chromium/error-context.md`
  - `test-results/logic-flow-logic-flow-bug--a5183-eserves-its-base-lock-style-chromium/error-context.md`
- Full-run contexts inspected before the focused rerun included:
  - `test-results/auto-sector-group-one-core-d0da6--自动分组与连接-1-1-Clean-slate-分组-chromium/error-context.md`
  - `test-results/map-map-refactory-map-refactory-2-1-状态-地图渲染-默认视图-chromium/error-context.md`
  - `test-results/production-module-manageme-d16ab-e-1-Basic-Storage-Auto-Fill-chromium/error-context.md`

Playwright 在 focused run 开始时按默认行为清理并重建了 `test-results/`，所以最终磁盘只保留两个 focused context；上面的 544-id/539-context 数和文件级映射是在清理前完成并记录的。不得把当前目录只剩 2 份 context 误读为 full run 只有 2 个失败，也不得据此声称 full suite 已重跑或通过。

## Documentation and history basis

- `docs/plan/unified-test-repair/task-test-4.md` 要求 `tests/e2e/**` 成为唯一 canonical 产品 E2E、逐项迁移 locator/fixture/Live helper，并以完整 `npm run test:e2e` 通过作为 blocking gate。
- `docs/plan/unified-test-repair/context-2.md` 与 `plan-2.md` 要求重复、过期或绑定退役实现的测试不进入 canonical，原件保留在 `tests/legacy/**`；产品测试失败按 owned path 修复，不跨到 `src/**`。
- 仓库 E2E 规则要求普通场景执行 fixture -> reload -> UI language；Live/save-binding/archive 场景必须使用唯一 `loadLiveBindingFixture(page)`。
- `openspec/specs/logic-flow-operation/spec.md` 仍要求 current drag status、锁定不兼容拦截、Auto 转正、isolation/T0 截断、取消投放与模块名语义；`openspec/specs/logical-flow-planner/spec.md` 仍要求 moduleId 隔离、lineage 与锁定组行为。因此应先让测试建立可见候选和真实拖拽前提，不能因 source locator 不存在就否定产品需求。
- `openspec/test_experience.md` 已记录 Ship Build helper 必须在 selector/workspace 间收敛当前视图，不能把 `ship-build-filters` 或 workspace-only locator 当作所有场景的唯一成功入口；本轮 ship 批量失败仍与该已知 test-owned family 对齐。
- 上一 full review `task-test-4-review-full-0bfd04c9.md` 的结果为 `1019 tests / 640 failed`，已识别 raw active-view、8.0/9.0 storage key、500ms readiness、Ship workspace/selector 等 test-owned 迁移缺口。之后 `da2ebf52` 将 7 个 pre-fix `bug-*` spec 移到 legacy；`b7613a25..6f0b3565` 只集中修复 Logic Flow 测试。当前降至 `981 tests / 544 failed`，与这段历史范围一致，不表示其余区域已完成迁移。
- Candidate 的先前 focused review `task-test-4-review-6f0b3565.md` 已以 fresh build/Chromium 证明四个重点场景通过：isolation/T0、Auto promotion、Replace、双 lineage/SVG。当前 full failed-id 映射也没有命中这四个场景；candidate 文件整体为 2/14 failed，故其余 12 条（包括 candidate 实际修改的三条）在 full run 中仍通过。

## Failure-family classification

### F1 — stale/retired pre-fix tests: current failures `0`; historical closure `12`

上一 full checkpoint 有 12 个失败来自 7 个 pre-fix/vacuous `bug-*` canonical spec。commit `da2ebf52` 已把这些原件移至 `tests/legacy/e2e/**`，当前 71-file collection 不再包含它们，当前 544 failures 中该 family 为 0。

这只关闭已识别的 7 个文件；不能推导其余未分析失败都是 stale。后续若某条 current assertion 与现行 OpenSpec 相反，必须逐条迁到 legacy 或删除 current assertion，同时保留历史原件。

Owner/paths: `task-test-4` test worker；仅 `tests/e2e/**` 与 `tests/legacy/e2e/**`。不得以修改产品 DOM/compatibility 分支保留退役断言。

### F2 — confirmed canonical fixture/setup/selector mismatch: `118` failures / `5` files

1. `logic-flow/logic-flow-bug-regression.spec.ts`: 2。focused 证据确认 `.tab-btn:nth(1)` 后 `spaceweed` 不是可见候选，helper 在 source lookup 超时；真实 drag 尚未开始。属于 test-owned category/race/source setup mismatch，不是 product bug。
2. `logic-flow/import-logic-flow.spec.ts`: 34。该文件自上一 full checkpoint 未被 Logic Flow correction chain 修改；既有证据显示它只注入旧 `x4_logic_flow_plans`/旧版本 key 并期待 current sidebar import 状态，失败发生在 fixture/version/state 建立阶段。
3. `auto-sector-group-one-binding.spec.ts`: 4；`auto-sector-group-one-core.spec.ts`: 34。两者在 authoritative Live helper 后又手工迁移 storage key/reload；core 仍使用 `#debug-ready-marker` 500ms deadline。当前整组/近整组失败与已记录的 fixture ownership 和 readiness race 一致。
4. `toolbar-action2one.spec.ts`: 44。shared `beforeEach` 只执行空 `page.evaluate` 后 reload，并以 500ms 等待 ready marker；各 case 再零散加载 fixture。44/46 的成组失败仍是 canonical setup/readiness 迁移问题。

Owner/paths: `task-test-4` test worker，仅修改上述 `tests/e2e/**` 文件并复用现有 canonical helper/稳定 test-id。不得修改 `src/**`，不得新增产品兼容逻辑，不得改共享产品 fixture 语义来迎合旧断言。

Closure: 每个文件先证明 current fixture、版本、reload、UI language 与目标 root 可见，再进入行为交互；focused run 消除 source/ready/sidebar 前置超时。

### F3 — unresolved at assertion level: `426` failures / `49` files

这些失败已按文件归档，但本轮没有逐条 stack/交互链审查，不能批量归为 stale、product bug 或 environment。历史与页面快照提示其中多数仍属于 setup/selector/contract migration；这只是下一轮调查假设，不是 426 条逐项定论。

- build 34：`build-flow` 27、`build-plan-preview` 1、`build-ui-component` 6。
- tooltip/drag 9：`button-tooltip-integration` 4、`button-tooltip-side` 4、`compact-drag-view` 1。
- DLC/version 11：`dlc-setting` 2、`dlc-settings` 2、`dlc-tag-display` 4、`game-version-switch` 3。
- remaining Logic Flow 18：`logic-flow-drag-feedback` 2、`logic-flow-incompatible-drag` 2、`logic-flow-interaction` 3、`logic-flow-new-feat` 5、`logic-flow-plans` 4、`ui-adjust` 2。
- map 75：8 个文件，见上表。
- production 82：8 个文件，见上表。
- sector 2：`sector-flow-filter`。
- ship 195：16 个文件，见上表；优先核对已知 selector/workspace helper family。

下一轮必须先通过 truthful current UI setup 和可见目标，再检查真实 interaction 与 exact postcondition。若 case 在此前就失败，归 test-owned；若 assertion 本身描述退役行为，归 stale 并移 legacy；只有四项都成立后仍稳定相反，才可升级 product bug。

### F4 — driver/environment: `0`

完整运行与 focused run 均成功完成 fresh build、启动 preview 和 Chromium，并有大量测试通过。500ms readiness、locator timeout 或并行下的测试等待是 test-owned setup 证据，不是环境豁免。Browserslist/chunk-size warning 也不是失败原因。

### F5 — product bug: `0 confirmed`

没有现有失败满足“truthful current UI setup + visible current target + active real interaction + exact postcondition 后仍稳定相反”。两个 candidate 相关失败在 source 可见性阶段即停止；其余 426 条尚未逐条完成该证明。因此本轮不创建、也不建议创建 BUG artifact。若后续 focused case 满足上述四项并稳定相反，再由 coding owner 建立 BUG artifact；test worker 不改 `src/**`。

## Changes required / minimum next worker scope

下一轮最小 worker 只处理 `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts` 中两个 `spaceweed` case：通过 current UI 明确选择能显示该候选的 category/race，或换成在当前 category/race 下可见且确实不兼容的现行 ware；release 前保留 active drag、exact target identity 和 current rejected status，release 后保留 no-preview/no-mutation 精确断言。不要修改 shared 产品行为或 `src/**`。

Focused closure 仅运行：

```text
npm exec playwright test -- tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts --grep "locked incompatible drops|leaving a locked target"
```

这两个 case 通过后，按独立小批次处理 F2 的 `import-logic-flow`、auto-sector、toolbar setup；F3 必须继续逐 family 分析，不能一次性弱化断言。最终仍需新的完整 `npm run test:e2e` exit `0` 才能接受 task-test-4。

明确禁止修改：`src/**`、`tests/fixtures/**`、`tests/seeds/**`、OpenSpec 产品语义、Playwright driver/browser 配置。当前没有授权或证据支持产品修复。

## Caveats

- 未运行第二次 full suite；不得宣称 full suite 通过。
- 426 个失败及 58 个 skipped 尚未逐条分类。58 skipped 不计入 544 failures，但在最终验收前仍需判定为 current behavior（启用并修复）或 stale/duplicate（保留到 legacy）。
- full run 的 list reporter 没有留下统一 assertion stack 报告；因此本报告只把证据充分的 118 条判为 confirmed test-owned，并把其余 426 条明确保留为未分析，而不是用数量推导 BUG 或过期。
- 唯一写入是本 reviewer artifact。
