- Evidence target: `8b5894bc85a7de3d608efa8db74357d942764519` (`develop`, tracked tree clean at inspection). The generation-7 control files are untracked and are outside this coverage fact; no test/build/browser command was run.

## Questions and scope

核对 generation-6 Revision 7 的 T010–T025、旧 M11.1–M16.2 与其历史 results，在当前 HEAD 行为下确定：旧覆盖点对应的准确 `tests/e2e` spec、已保留/已撤回候选、历史证据是否仍绑定当前候选，以及最终 runner 的边界。generation-6 的 Base 是 `d0614371558b2f6b30e8fd6b148347868228c413`，不是本次证据 target。

## Findings and locations

### 当前 runner 范围

`playwright.config.ts` 的 `testDir` 是 `./tests/e2e`，`package.json` 的 `test:e2e` 是 `playwright test tests/e2e`。当前 `find tests/e2e -name '*.spec.ts'` 为 **74 个文件**。这 74 个文件是最终 T025 的 canonical collection；`tests/e2e-skills/**/*.spec.ts`、`tests/legacy/**/*.spec.ts`、`tests/unit/**/*.spec.ts` 不属于 Playwright canonical runner。`tests/e2e` 下的 `migration-task-test-*.md` 是映射文档，不是 runner spec。

generation-6 文档中的“原 71 个 canonical 文件 + 新增补充 spec”与当前 74 的来源相符。相对原 71，新增的三个当前 spec 是：

- `tests/e2e/auto-sector-group-one-core/auto-sector-group-draft-transactions.spec.ts`
- `tests/e2e/auto-sector-group-one-core/auto-sector-group-graph.spec.ts`
- `tests/e2e/auto-sector-group-one-map/auto-sector-group-map-details.spec.ts`

另有一个同代补充覆盖：`tests/e2e/map/x4-import-move.spec.ts` 的 M9.1 placement 从旧 7 项扩为当前 8 项；它不是新增文件。

### T010–T025 与当前准确 spec

| generation-6 task | 原 M/覆盖点 | 当前准确 spec | 当前事实、保留成果与历史缺口 |
|---|---|---|---|
| T010 | A7 runner、build、canonical Unit、完整 E2E；smoke 为 build UI | 全部当前 74 个 `tests/e2e/**/*.spec.ts`；smoke `tests/e2e/build-ui-component/build-ui-component.spec.ts` | T010-A5 的 `1024/1024` Unit、`843/74` collection、`6/6` smoke 只绑定旧 dirty candidate；没有 HEAD `8b5894bc` 的完整 E2E/Unit/build 结果。最终必须一次收集并运行当前 74 文件，不能以 focused 结果拼接。 |
| T011 | M2.1-FOCUS，自动 active station/transit 变化保护工作台 | 目标 `tests/e2e/auto-sector-group-one-binding/auto-sector-group-focus.spec.ts` 当前不存在；既有 `tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts` | 既有 16 项迁移成果保留。T011-A1/A2 已确认当前公开事件没有合格的自动 A→B identity witness；不能用显式 sidebar 点击或 `page.evaluate` 事务代替。历史 focus 缺口仍是“无当前入口”的事实，不能据此授权新产品入口。 |
| T012/T013 | M5.3/FIX-M5.3 独立 drag demo：normal、cancel、Auto、Isolate、duplicate、Reset、locked reject/accept；compact 两项 | `tests/e2e/vue-drag-test.spec.ts`；`tests/e2e/compact-drag-view.spec.ts` | T012-A2 的四个 owned 输入 hash 与当前 `DragTestPage.vue`/presenter/store/Unit 相符；T013-A6 输入 hash 也与当前两份 E2E 相符。历史 T013-A6 为 combined `10/10`（compact 2 + drag 8），可作为该候选的保留结果；仍需按当前 HEAD 的最终候选/独立接受记录闭合，不能外推全量 E2E。 |
| T014 | M7.2 AutoSupply 原 Case5、module/settings 回归 | `tests/e2e/production/module-management.spec.ts`、`tests/e2e/production/settings.spec.ts` | HEAD 当前 `module-management.spec.ts:125` 仍是 `test.skip('Case 5: AutoSupply Storage')`。generation-6 T014-A1 的 AutoSupply source/store/presenter/Unit 与 Case5 激活均属于被 HEAD 撤回的候选；其 E2E/runtime 结果不能代表当前代码。其余 M7.2 历史 24 项成果保留为历史事实，当前缺口按当前行为重写/退休。 |
| T015 | M7.3 sector 来源 3.2/3.3/3.9/3.12；dashboard/ware-flow 回归 | `tests/e2e/production/station-resource-group.spec.ts`、`tests/e2e/production/station-dashboard.spec.ts`、`tests/e2e/production/ware-flow.spec.ts` | 当前 `station-resource-group.spec.ts` 仍使用 `sector-1`/saved empire 路线；当前 `src/components/map/presenters/useMapResourceFilterPresenter.ts` 不存在，`MapResourceFilterAdvancedPanel.vue` 仍直接读 `savedEmpires`。T015-A1 的真实 sourceView/presenter/Unit/E2E 候选已由 HEAD 撤回；其 `93/97` 及静态清单仅是旧候选证据。 |
| T016 | M9.1 六个导入 + station placement；新增 sector placement、实体/sector/position Save/reload | `tests/e2e/map/x4-import-move.spec.ts` | 当前文件有 8 项：6 个导入、station placement、sector placement；HEAD 保留了 pointer、空间 identity、dirty/save/reload 断言。T016-A4 报告的候选 hash `466e2d2f...` 与当前文件 hash `5801942d...` 不同，因此历史 `8/8` 行为可保留但不自动作为 HEAD runtime proof。 |
| T017 | M10.2 装备选择六 spec；Fit 2/3、race tags >3 两行、selector 几何；Equipment canonical Unit | `tests/e2e/ship/ship-build-equipment.spec.ts`、`tests/e2e/ship/ship-equipment-selector.spec.ts`、`tests/e2e/ship/bugfix-ship-equipment-selector.spec.ts`、`tests/e2e/ship/build-ship-equipment-panel.spec.ts`、`tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts`、`tests/e2e/ship/osaka-default-preset.spec.ts` | HEAD 提交说明明确“Revert uncommitted ... ship equipment layout ... changes with associated tests”。T017-A4 的 46/46 与其 candidate hash 绑定撤回候选，当前六 spec/source hash 不同；不得用旧布局结果要求恢复已消失行为或当作当前 pass。M10.2 原已保留的 43 项属于历史覆盖，当前实现行为需重新核对。 |
| T018 | M11.1 build-flow 菜单、绑定、真实拖放、归档、持久化 | `tests/e2e/build-flow/build-flow.spec.ts` | 当前路径有原 27 个声明（2.1–2.11、3.1–3.16）；generation-6 无 T018 runtime result。当前 spec 是既有迁移输入，旧 M11 的 27 点不能当成已运行通过，需按当前 UI 行为重写 stale 条款。 |
| T019 | M12.1 目标、Fleet、方案 CRUD、active 隔离、保存/reload | `tests/e2e/build-plan-goal/build-plan-goal.spec.ts` | 当前正好保留 2.1–2.9、3.1–3.12 共 21 项；T019-A2 的 test hash `59201ceaa...` 与 HEAD 当前文件相符，证明静态实现内容保留，但该结果明确未运行 browser/build/Unit。 |
| T020 | M13.1 derived/required/moduleId、graph/SCC、用户目标分离 | `tests/e2e/build-plan-preview/build-plan-preview.spec.ts` | 当前正好 9 项（2.1、2.2、3.1–3.6、4.1）；T020-A2 hash `5be60b7b...` 与当前文件相符，旧 5/4 runtime 只属历史，当前 focused/full runtime 未验证。 |
| T021 | M14.1 的 2.1/2.2/3.1/3.2/3.4 五项 | `tests/e2e/build-plan-compute/build-plan-compute.spec.ts` | 当前 spec 保留六项并仍含 3.3；旧 T021-A1 以 `--grep-invert '3.3'` 得到 5/5，不能记作六项通过。 |
| T022 | M14.1 原 3.3：build-material 卡片默认汇总 → steps → 汇总 | 同一 `tests/e2e/build-plan-compute/build-plan-compute.spec.ts` | 3.3 当前仍在 collection；generation-6 明确要求同时具备 `groupType='build-material'`、非空 modules、正的非 energycells target rates。未找到该当前公开 fixture/路径，原 energycells+last 路线证据过时；不应新增 skip 或产品入口。 |
| T023 | M15.2 No Demand/Resource 文案 + Label 80/Hours 70 几何 | `tests/e2e/button-tooltip-integration.spec.ts`、`tests/e2e/button-tooltip-side/button-tooltip-side.spec.ts` | HEAD 保留 `FavoriteButton.vue` 的 `min-width:80px/70px`、两个 spec 的 1280×720 geometry/nowrap 断言；当前 hashes 与 T023-A2 facts 相符。T024 旧“80/70 未覆盖”事实已被 T023 候选取代；T023-A2 历史为两 spec 8/8，仍需独立 review/dispatcher 记录，不等于全量验收。 |
| T024 | 只读核对 M2.1 call-count/live-flow、M15.2 宽度、M16.2 Live/archive/reference-floor/bulk | 无 owned E2E spec；消费上述 M2.1/T023/M16.2 consumers | M2.1 精确调用次数和 confirm→Live numeric oracle 未冻结；M16.2 历史 51/51 只涵盖 station/Blueprint DLC。Live/archive/reference-floor/DLC 交集与 DLC×bulk policy 仍未验证且不自动构成产品范围。 |
| T025 | A7 最终整体验收 | 当前全部 74 个 `tests/e2e/**/*.spec.ts` | 必须绑定同一 HEAD-derived candidate 的 fresh build、canonical Unit、完整 Playwright collection/run、diff 与 review。当前没有该结果；历史 `843/74` 是 collection，不能代表执行通过。 |

### 其他已保留 M 覆盖族（不属于 T011–T024 的新缺口）

这些路径构成 T010/T025 的其余 canonical scope；generation-6 plan/results 记载的历史成果仍可追溯，但没有在 HEAD 上重新运行：

- M1.1/M1.2：`tests/e2e/live/live-archive-valid-select.spec.ts`；`tests/e2e/binding/save-binding-crud.spec.ts`。
- M2.1 主 16 项：`tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts`。
- M3.1/M3.2：`tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts`、`auto-sector-group-draft-transactions.spec.ts`、`auto-sector-group-graph.spec.ts`；`tests/e2e/auto-sector-group-one-map/auto-sector-group-one-map.spec.ts`、`auto-sector-group-map-details.spec.ts`。
- M4.1/M4.2/M4.3：`tests/e2e/live/live-overview.spec.ts`、`live-station-dashboard.spec.ts`、`contribution-name.spec.ts`、`gap-button-response.spec.ts`、`live-flow-map.spec.ts`、`live-station-toolbar.spec.ts`、`live-transit-toolbar.spec.ts`。
- M5.1/M5.2：`tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts`、`logic-flow-incompatible-drag.spec.ts`、`logic-flow-bug-regression.spec.ts`、`logic-flow-interaction.spec.ts`、`logic-flow-new-feat.spec.ts`。
- M6.1/M6.2：`tests/e2e/logic-flow/logic-flow-plans.spec.ts`、`import-logic-flow.spec.ts`、`ui-adjust.spec.ts`。
- M7.1/M7.4：`tests/e2e/production/empire-crud.spec.ts`、`station-management.spec.ts`、`import-export.spec.ts`。
- M8.1/M8.2/M8.3：`tests/e2e/map/map-refactory.spec.ts`、`map-search.spec.ts`、`x4-map-tooltip.spec.ts`、`advanced-resource-filter.spec.ts`、`bugfix-advanced-resource-filter.spec.ts`、`resource-pie.spec.ts`、`map-dlc.spec.ts`。
- M10.1/M10.3/M10.4/M10.5：`tests/e2e/ship/ship-build.spec.ts`、`ship-build-panel-ship.spec.ts`、`bugfix-ship-build-panel-ship.spec.ts`、`abandon-selected-ship.spec.ts`、`bugfix-abandon-selected-ship.spec.ts`、`ship-level-blueprint.spec.ts`、`bugfix-ship-level-blueprint.spec.ts`、`ship-build-storage.spec.ts`、`ship-items.spec.ts`、`ship-build-material.spec.ts`、`ship-build-stat.spec.ts`、`metric-panel-ui.spec.ts`、`bugfix-ship-status-diff.spec.ts`、`ship-dlc.spec.ts`。
- M15.1/M15.3/M15.4：`tests/e2e/toolbar-action2one/toolbar-action2one.spec.ts`、`tests/e2e/build-ui-component/build-ui-component.spec.ts`、`tests/e2e/sector-flow-filter/sector-flow-filter.spec.ts`。
- M16.1/M16.2：`tests/e2e/game-version-switch/game-version-switch.spec.ts`、`tests/e2e/dlc-setting/dlc-setting.spec.ts`、`tests/e2e/dlc-settings/dlc-settings.spec.ts`、`tests/e2e/dlc-settings/dlc-tag-display.spec.ts`。

### HEAD history affecting evidence identity

`git show HEAD` states: “Revert uncommitted AutoSupply, ship equipment layout, and map resource source changes with their associated tests. Current implementation is the behavioral authority; historical OpenSpec does not authorize restoring old behavior.” This is direct historical evidence for T014/T015/T017 candidate withdrawal. The same commit retains drag and other approved test repairs, including current changes to `vue-drag-test.spec.ts`, `build-plan-goal.spec.ts`, `build-plan-preview.spec.ts`, `x4-import-move.spec.ts`, and both tooltip specs. Therefore old results must be split by candidate identity: T012/T013/T019/T020/T023 inputs are retained or hash-match current files; T014/T015/T017 are withdrawn; T016 behavior is retained but its reported candidate hash differs from current HEAD and needs fresh evidence.

## Recommended close reading

- Planner should use `generation-6/plan.md` Revision 7’s acceptance mapping only as history, then bind each decision to the current files above.
- For withdrawn work, read `git show HEAD`, current `module-management.spec.ts:125`, current `MapResourceFilterAdvancedPanel.vue:146-223`, and current ship files; do not revive T014/T015/T017 source changes from old results.
- For retained/rewriteable tests, inspect current `build-flow.spec.ts`, `build-plan-goal.spec.ts`, `build-plan-preview.spec.ts`, `build-plan-compute.spec.ts`, `x4-import-move.spec.ts`, `vue-drag-test.spec.ts`, and tooltip specs. Current behavior and user authorization supersede old M wording.
- T025 should use `playwright.config.ts`/`package.json` as the runner authority and collect all 74 current files; no `tests/e2e-skills` or legacy path belongs in the final run.

## Unknowns and coverage limits

- No browser, build, Unit, Playwright `--list`, or test command was run; current per-file runtime counts and current full collection total are therefore unverified. The 74-file count is filesystem fact only.
- The current behavioral outcomes of T014/T015/T017 after withdrawal are not inferred. Their old candidate results are stale; the packet does not decide which current cases should be retained, rewritten, or retired.
- T011’s missing automatic UI event, T022’s qualifying build-material card route, M2.1 numeric call/live-flow oracle, and M16.2 Live/archive/reference-floor/DLC policy remain unresolved. Their absence is evidence of missing current coverage, not authorization to add product behavior.
- The current x4-import placement file is retained but differs from T016-A4’s recorded candidate hash; exact current runtime behavior remains unverified.
- Historical result “accepted/complete” labels are not dispatcher acceptance and cannot close T025.
