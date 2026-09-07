# unified-test-repair direct migration collector packet

- Context status: `ready`
- Collector role: `context_collector`
- Evidence target: `d590ede41d41913ab18f5c5a18247bf956a4685a`
- Target branch: `develop`
- Collection date: `2026-09-07` (Asia/Shanghai)

## Status and result

当前 `HEAD` 是 `d590ede4`。`git status --short` 还包含环境负责人刚加入的 `playwright.config.ts` dirty 修改，以及 unified-test-repair 的治理状态、`.progress/`、generation-4/5 和本次工作区文档 dirty/untracked；没有产品代码或 canonical 测试路径的已确认用户修改。generation-5 的 status/plan 仍把 `da05d84514c90428fd4e51907df9b6424fa5ccff` 当作 Base，必须在新合同中改为当前完整 SHA。`d590ede4` 是 8 批 retained candidate 的最后一次合并；合入不等于通过。

当前 canonical 资产为 `tests/e2e` 71 个 spec 文件、`tests/unit` 163 个文件；历史保留面为 `tests/legacy/e2e` 26、`tests/legacy/unit` 115。generation-5 已将 71 个 E2E 组织为 16 个父任务、36 个平级子项；这些功能边界、Owned paths 和规范映射仍可复用，但其中的 lane、merge gate、旧 Base 和“已合入候选可关闭”叙述不能复用。没有 collection 数字被当作通过证据。

## 可立即派发的三个单元

1. **Live archive helper / task-test-1.1**：
   `tests/e2e/live/helpers/loadLiveBindingFixture.ts`、`tests/e2e/live/live-archive-valid-select.spec.ts`、对应迁移文档。规范为 `openspec/specs/active-binding/spec.md` 和 `openspec/specs/save-local-storage/spec.md`。当前 spec 已尝试同 GUID 双时间项、无效 archive、双向 UI 选择和 reload，但 focused 修正运行在 `page.goto('/')` 前遇到 `ERR_CONNECTION_REFUSED`；helper 仍有 `list[0]?.id || null`（line 66）和 archive metadata 由 fixture 预计算的边界。恢复要求是可启动 runner 上重跑两项真实 UI witness、collection、build、diff 和 helper consumers。其下游为 binding CRUD、Auto Sector binding/core/map、Live consumers；共享入口只能由此 owner 修改。

2. **Logic Flow drag helper / task-test-5.1**：
   `tests/e2e/logic-flow/helpers/dragLogicFlow.ts`、`setupLogicFlow.ts`、`logic-flow-drag-feedback.spec.ts`、`logic-flow-incompatible-drag.spec.ts`。规范为 `openspec/specs/logical-flow-planner/spec.md` 和 `openspec/specs/logic-flow-operation/spec.md`。当前 helper 仍以 `toHaveCount(0)` 检查 `v-show` 常驻的 `compact-view`（line 14）、用 `groups[0]` 的消费者仍存在、由 `getWareGroupStatus` 推导 expected status，且以 `|| 'default'`、`?? 0` 兜底。产品 T0 修复已在 `761310260d1188d836326fadbdd7bdc7616de05c` 进入 develop，但修复后的测试纠错尚未关闭：必须先用可见性、Sortable 状态、store drag state、groups/nodes 不变和独立 group identity oracle 重做，再复验 Ore/Energy Cells 禁止操作及合法产物对照。该单元完成前阻塞 Logic Flow consumers、Build Flow；不阻塞其他功能。

3. **独立小功能 / task-test-15.2**：
   `tests/e2e/button-tooltip-integration.spec.ts`、`tests/e2e/button-tooltip-side/button-tooltip-side.spec.ts`、迁移文档；规范为 `openspec/specs/button-tooltip/spec.md`。无 Live、Logic Flow 或 Auto Sector 依赖，适合与两个共享 helper 单元并行。验收只保留真实 hover/focus/leave、当前稳定按钮锚点、方向和隐藏状态；不能用固定 delay、if-visible 或条件式通过。若需要普通 db fixture，按仓库 beforeEach 规则注入 db、reload、通过 `language-select` UI 设语言。

## 16 个可派发功能边界（已有 36 子项可沿用）

| 父任务 | 当前 spec 文件范围 | 当前规范来源（示例） | 依赖事实 |
|---|---|---|---|
| 1 | live archive select、save-binding CRUD、Live fixture helper | `active-binding`、`save-binding`、`save-local-storage` | helper owner 先行；1.1 failure 只阻塞其消费者闭包 |
| 2 | `auto-sector-group-one-binding.spec.ts` | binding mode/draft、virtual station change specs | 消费 1 的 archive fixture；同一 draft 生命周期保持在一个子项 |
| 3 | Auto Sector core/map 两个 spec | auto-sector core/trade/map/color/binding-preview/virtual-station specs | 依赖 2；core 与 map 各自保留真实 pointer witness，不以跨 worker 运行态交接 |
| 4 | Live overview/dashboard、contribution、gap、flow map、station/transit toolbar | `production-ui`、`station-dashboard`、`live-workforce-integration`、`ware-flow-display`、`empire-gap-display`、toolbar specs | 消费 1；按展示、选择联动、toolbar 分三个子项 |
| 5 | Logic Flow drag/incompatible、interaction/regression/new-feat、compact/vue drag | `logical-flow-planner`、`logic-flow-operation`、`module-id` | helper/oracle owner 先行；产品修复已在 target，迁移未闭合 |
| 6 | Logic Flow plans/import/UI adjust | `logic-flow-plans`、`import-logic-flow`、`import-export`、`logic-flow-ui-adjust` | 依赖 5 的 setup/helper contract |
| 7 | empire/station CRUD、module/settings、dashboard/resource-group/ware-flow、import-export | `empire-management`、station tabs/bar/dashboard/resource-group、ware-flow、storage-auto-fill、import-export | 各子项可独立 browser context；当前 7.1 candidate 21/27 passed 后仍有 6 个 test-owned/stale failure |
| 8 | map refactory/search/tooltip、advanced resource/resource pie、map DLC | `vue-svg-map`、`map-search`、`x4-map-tooltip`、`advanced-resource-filter`、`map-resource-filter`、`map-dlc` | 不依赖 Live/Auto Sector；历史候选 8.1/8.2/8.3 均未完成，runner 与 current ID oracle 要分开分类 |
| 9 | `map/x4-import-move.spec.ts` | `x4-import-move`、`map-station`、`empire-management` | 若使用 archive 才消费 1；导入、拖动、确认/reload 是自身 witness |
| 10 | Ship selection/build/equipment/blueprint/material/stat/status/DLC 全部 canonical 与 bugfix spec | `equipment-panel`、`ship-build-stat`、`ship-build-material`、`ship-status-diff`、`metric-panel-ui`、ship archived specs | 当前只有 incomplete/unavailable handoff；不得把历史 ship 全量失败当产品结论 |
| 11 | `build-flow/build-flow.spec.ts` | `build-flow` change spec/test_tasks | 依赖 Logic Flow helper/setup 进入可用 target；真实 drag/menu/persistence |
| 12 | `build-plan-goal/build-plan-goal.spec.ts` | build-plan-goal change spec/test_tasks | 无明确依赖；旧候选曾删代码后恢复，focused/list/build/diff 尚未完成 |
| 13 | `build-plan-preview/build-plan-preview.spec.ts` | build-plan-preview spec/test_tasks | 当前候选 5 passed/4 failed；缺版本 key、有效 logic-flow 选择、graph null/SCC 空边界 |
| 14 | `build-plan-compute/build-plan-compute.spec.ts` | build-plan-compute、build-plan-steps spec/test_tasks | 当前候选 5/6，3.3 无 accepted public route 到 details switch；保留 unknown，不弱化 |
| 15 | toolbar-action2one、tooltip 两 spec、build UI component、sector flow filter | context-toolbar/title-as-plan-title/import-export、button-tooltip、build-ui-component、empire-production-summary/ware-flow | 15.2 可立即并行；15.1/15.3/15.4 尚无完整执行证据 |
| 16 | game-version-switch、两套 DLC setting/tag spec | game-version-switch、dlc-tag、station-dlc-tag、map-dlc、ship-dlc | 16.1 仍有 9.0 beta/旧 8.0 storage stale assumption；16.2 首次失败后未完成分类 |

## 当前失败、停止重试和恢复条件

- **必须停止沿旧路线反复重试**：task-test-1.1 的原 candidate 曾出现 `2 passed`，但 trace 证明点击前目标 archive 已经 active；修正后进入 `page.goto` 前 `ERR_CONNECTION_REFUSED`。不能把旧 pass 当行为证明，也不能把环境失败归产品。
- **task-test-5.1 保留但暂停**：post-fix focused 为 3 passed/5 failed；失败集中在共享 compact-view assertion，现有 `v-show` count oracle、group index、被测函数推导 expected 和 fallback 必须先修。T0 Ore `sortable-chosen sortable-ghost` 与 Energy Cells `draggable=true`/quick-add 是已确认历史产品签名；修复已进入 develop，必须用新 oracle 真实复验后才能关闭。
- **task-test-7.1 保留未完成**：candidate 27 collected，21 passed、6 failed、0 skipped；6 项为 reorder/save-reload/cancel、旧 results-popover locator、未完成真实 empire save/reload。不得重复同一旧 oracle，恢复条件是精确 order/identity/save witness 后完整 27 项重跑。
- **task-test-8.1/8.2/8.3 保留未完成**：8.1 candidate 中断（baseline 46，27 passed/19 failed；候选仅观测到 19 pass）；8.2 为 11 passed/21 failed，其中 15 次 connection refused；8.3 为 2 passed/18 failed，其中 13 次 connection refused、4 个 `Cluster_408_macro` unknown、1 个 station entry timeout。先恢复稳定 runner，再单独修 stale/current ID oracle；未形成产品结论。
- **task-test-13.1/14.1 保留 unknown/incomplete**：13.1 candidate 5 passed/4 failed，`flow-plan-menu-item-logic-flow-1` stale，material group setup 未达；14.1 baseline 5/5，candidate 5/6，3.3 无法到达 build-material details switch，最终 rerun 又 connection refused。不得删除或弱化 3.3。
- **task-test-10、12、15、16 的未执行/中断证据只标 unavailable/incomplete**；16.1 的 9.0 beta 与旧 storage 是 test-owned stale，应迁移后再跑；没有 fresh reproduction 时不能声称产品失败或通过。

## Shared fixture/helper ownership

`loadLiveBindingFixture.ts` 是 Live/save/archive 的唯一入口；普通 E2E 使用 `tests/fixtures/db.json`（删除 `vsn`）、reload、`[data-testid="language-select"]` UI 设语言；不得 `localStorage.clear()`。Logic Flow 使用 `setupLogicFlow(page, 'clean'|'seeded')`，必须明确 `x4_game_version` 和 plans key。共享 helper 的消费者只能提出 failure signature，不能复制 helper 或在自身 spec 越权修正。每个 feature 使用独立 browser context；共享 helper 的后续改动只触发其 owner 的 bounded cross-consumer rerun，不把所有父任务合并为一个整体。

## Environment and runner

`playwright.config.ts:18` 使用 `tests/e2e`，`playwright.config.ts:26` 设置 baseURL，当前工作树 `playwright.config.ts:41-49` 已由环境负责人加入同一 preview URL 的显式 `webServer.url`；这是 dirty path，尚未属于 `d590ede4`。环境负责人报告修正后 archive focused 2/2 通过，且此前失败确实发生在 Vite 就绪前；后续合同应把该修正作为执行前提或单独记录归属，不能把旧 `ERR_CONNECTION_REFUSED` 当产品失败。精确 focused 命令由各子任务合同生成：Playwright Chromium、`--workers=1 --retries=0 --trace=on`，随后 collection、`npm run build`、`git diff --check`；不运行 `build-rust`（本次未改 Rust）。

## Evidence index

- `git rev-parse HEAD`, `git status --short`, `git log`: current target and dirty-path facts.
- `docs/plan/unified-test-repair/status.md:9-18`: stale generation-5 base/status and incomplete list.
- `docs/plan/unified-test-repair/generation-5/current-failure-summary-1.md:1-52`: current failure summary, confirmed T0 product signatures, environment evidence.
- `docs/plan/unified-test-repair/generation-5/retained-branches-review-1.md:5-15,19-57`: 9 retained candidates and why their merges do not close tasks.
- `docs/plan/unified-test-repair/generation-5/task-test-{1..16}.md`: exact existing parent/subtask boundaries, owned files, normative sources and focused commands; reuse boundaries after replacing old base/gate language.
- `tests/e2e/live/live-archive-valid-select.spec.ts:22-166`: current double-time archive UI witness; `tests/e2e/live/helpers/loadLiveBindingFixture.ts:43-106`: archive construction and active-ID behavior.
- `tests/e2e/logic-flow/helpers/dragLogicFlow.ts:14,44-116`: stale compact-view, fallback and status-oracle seams; `tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts:22-38`: remaining `groups[0]` consumers.
- `tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts:277-280,857-902`: stale Exit expectation and cross-group pointer candidate.
- `tests/e2e/map/resource-pie.spec.ts:82-165`, `tests/e2e/map/map-dlc.spec.ts:80-223`: remaining uppercase/legacy map identifiers and weak count oracles.
- `openspec/specs/active-binding/spec.md:8-178`, `openspec/specs/save-binding/spec.md:8-145`, `openspec/specs/logical-flow-planner/spec.md:88-203`: current archive, binding, drag/T0/lineage requirements.
- `openspec/changes/build-plan-preview/specs/build-plan-preview/spec.md:9-155`, `openspec/changes/build-plan-compute/specs/build-plan-compute/spec.md:9-145`, `openspec/changes/build-flow/specs/build-flow/spec.md:178-503`: current Build Plan/Flow responsibility and public behavior sources.

## Searches and coverage limits

Read complete collector role protocol and `CLAUDE.md`; inspected current git target, generation-5 status/plan/lanes/reports, merged commit history, all canonical E2E file names, current shared helpers, relevant specs and current accepted OpenSpec sources. Static scans covered skip/fixme, storage setup, stale IDs/locators and direct helper seams. No full E2E, full Unit, build, or Rust build was run by this collector; ENV agent owns current build/unit evidence. Historical reports are not fresh behavior evidence. Unknown accepted-spec conflicts (especially old station-tabs directory wording and Auto Sector old Exit/UUID text) remain reviewer questions.

## Changes

Only this new collector packet was written. No product, test, fixture, configuration, status, lane, branch, index or commit was modified.

## Caveats

This packet reports facts and bounded seams; it does not accept generation-5 merges, choose final task topology, classify unobserved product failures, or replace a fresh focused run. Parent agent should create the new dispatch contracts from these boundaries and keep each retained failure task alive until its stated recovery evidence exists.
