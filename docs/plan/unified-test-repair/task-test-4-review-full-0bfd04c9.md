# generation-2 task-test-4 full canonical E2E review

Status:
`review_complete`

Task:
`task-test-4` generation-2 task-scoped reviewer；基于当前 control worktree / HEAD 的完整 canonical E2E 产物，对 immutable candidate `0bfd04c9` 做最终失败归因。未修改 candidate、测试、源码、fixture、workflow status、git index 或提交。

Reviewed commit:
`0bfd04c9ecb84b6a7af0da21d654ba33e53b3638`

Current evidence checkpoint:

- 当前 HEAD：`400fded98d13c102cc0872664410c0d7b2bb3c06`，审查前 `git status --short` 无输出。
- candidate direct parent：`ed5837e46f8a1fcc4767d928b012374bd6a46c29`。
- candidate 之后实际有两个文档/状态提交，而不是一个：`231ee335` 仅修改 `docs/plan/unified-test-repair/status-integrate.md`，`400fded9` 仅新增此前的 reviewer artifact。`git diff --name-status 0bfd04c9 HEAD` 没有测试或产品代码差异，因此当前 E2E 树仍等同 candidate 的测试/产品状态。

Verdict:
`changes_required`

## Evidence

### Canonical run and collection

- 用户提供的真实完整命令与结果：`npm run test:e2e`；Chromium 可启动；`1019 tests`，`321 passed`，`58 skipped`，`640 failed`，约 `16.4m`。
- `test-results/.last-run.json` 当前为 `status: failed`，包含精确 `640` 个 failed test id。
- `find test-results -mindepth 2 -maxdepth 2 -name error-context.md | wc -l` 得到 `636`；因此绝大多数失败有当前页面快照，4 个失败只有 failed id，无单独页面快照。
- `npm exec playwright -- test tests/e2e --list --reporter=json` exit `0`，收集 `1019` tests / `78` files；其中 `962` 个 expected status 为 passed、`57` 个为静态 skipped。完整运行的第 58 个 skip 是运行时 skip。
- 将 list reporter 的 spec id 与 `.last-run.json` 交叉：`60/78` 个文件至少一个失败，`18/78` 个文件无失败。
- 迁移来源交叉：原 `tests/e2e/**` 的 18 个文件贡献 `138` 个失败；原 `tests/unified-e2e/**` 的 60 个文件贡献 `502` 个失败。故失败不是只来自后来搬入的 18 个 legacy-origin spec；原 unified 候选本身也未适配当前产品契约。
- `playwright.config.ts` 当前 `testDir: './tests/e2e'`，完整命令未收集 `tests/legacy/**`、Unit 或 skill tests。640 个失败全部位于本任务 owned canonical path，并直接阻塞 `task-test-4.md:33-40` 的 full E2E gate。

### Contract, repository rules, OpenSpec, and history

- `docs/plan/unified-test-repair/task-test-4.md:26-31` 要求逐项识别 legacy 行为、完成 locator / fixture / Sidebar / Live helper 迁移；`:35-40` 要求完整 `npm run test:e2e` 通过。
- `docs/plan/unified-test-repair/context-2.md:32-36` 明确：重复、过期、仅绑定退役实现的测试不进入 canonical，原件留在 legacy。
- `CLAUDE.md:153-188` 明确普通 E2E `beforeEach` 必须执行 `db fixture -> reload -> UI language`；`CLAUDE.md` 的 Live rule 要求 save-binding/archive 场景走唯一 `loadLiveBindingFixture(page)`。
- `openspec/test_experience.md:132-148` 已记录 ship selector/workspace helper 必须先收敛当前视图，不能把 `ship-build-filters` 或 workspace-only locator 当作唯一入口成功条件；当前 ship 批量失败与该历史缺陷签名一致。
- 当前 OpenSpec 仍要求 Logic Flow、Advanced Resource Filter、Ship Build、Station Dashboard、Tooltip 等行为，见 `openspec/specs/logical-flow-planner/spec.md`、`advanced-resource-filter/spec.md`、`ship-build-material/spec.md`、`ship-build-stat/spec.md`、`equipment-panel/spec.md`、`station-dashboard/spec.md`、`button-tooltip/spec.md`。失败页面大多未到达这些行为断言，不能据此否定产品需求。
- commit `bd71924f` 引入对象形态的 `useActiveViewStore`；commit `d73b9c85` 以 Sidebar 替换旧 horizontal tab bars。当前 `src/store/useActiveViewStore.ts:25-70` 对 `x4_station_active_view` 执行 `JSON.parse` 并读取对象字段；裸 JSON string 不含 `activeView`，会落回 `blueprint-production`。
- 当前 `src/assets/versions.json` 默认 `9.0`，其 storage keys 带 `_v9`；`tests/fixtures/db.json` 仍只有 8.0 无后缀 keys，且无 `x4_game_version`。`tests/e2e/live/helpers/loadLiveBindingFixture.ts:94-150` 已按 `gameDataStore.getStorageKey()` 动态重映射，完整跑中 Live 43/43 通过；多数普通 spec 仍直接注入旧 keys 或根本不加载 fixture。
- commit `9cb7d4bd` 只修正了 27 个 canonical 文件的部分 setup/locator；随后各 reviewer round 只聚焦 Live。此前 `task-test-4-review-5e530b63.md` 明确没有完整 E2E pass，`task-test-4-review-0bfd04c9.md` 的 focused gap run 又停在 Chromium launch。当前完整跑首次给出了可归因的全量 gate 证据。

### Exact review commands

本轮未重新执行 1019 项；使用现有 full-run 产物并只运行 collection/read-only 命令：

```text
git status --short
git rev-parse HEAD
git log --oneline --decorate -12
git show --stat --oneline 231ee335
git show --stat --oneline 400fded9
git diff --name-status 0bfd04c9 HEAD
git show -s --format='%H%n%P%n%T%n%s' 0bfd04c9
git diff --name-status 0bfd04c9^ 0bfd04c9
find test-results -mindepth 2 -maxdepth 2 -name error-context.md | wc -l
jq '.status, (.failedTests|length)' test-results/.last-run.json
npm exec playwright -- test tests/e2e --list --reporter=json
```

失败按文件计数通过 list JSON 中的 spec id 与 `test-results/.last-run.json.failedTests` 精确 join；没有重新执行测试体。

## Failure summary by file

格式为 `failed/collected`；未列出的 18 个文件为 `0 failed`。

| Area | Files |
| --- | --- |
| auto-sector (`37`) | `auto-sector-group-one-binding` 3/25；`auto-sector-group-one-core` 34/34 |
| build (`34`) | `build-flow/build-flow` 27/27；`build-plan-preview/build-plan-preview` 1/8；`build-ui-component/build-ui-component` 6/6 |
| tooltip / drag (`12`) | `button-tooltip-integration` 4/4；`button-tooltip-side/button-tooltip-side` 4/4；`compact-drag-view` 3/3；`vue-drag-test` 1/20 |
| DLC / version (`12`) | `dlc-setting/dlc-setting` 3/30；`dlc-settings/dlc-settings` 2/14；`dlc-settings/dlc-tag-display` 4/7；`game-version-switch/game-version-switch` 3/6 |
| logic-flow (`138`) | `import-logic-flow` 34/34；`logic-flow-bug-regression` 36/36；`logic-flow-drag-feedback` 5/5；`logic-flow-incompatible-drag` 2/2；`logic-flow-interaction` 15/15；`logic-flow-new-feat` 21/21；`logic-flow-plans` 11/11；`ui-adjust` 14/14 |
| map (`76`) | `advanced-resource-filter` 23/23；`bug-advanced-resource-filter` 1/1；`bugfix-advanced-resource-filter` 1/1；`map-dlc` 18/20；`map-refactory` 15/19；`map-search` 2/20；`resource-pie` 8/8；`x4-import-move` 6/6；`x4-map-tooltip` 2/7 |
| production (`82`) | `empire-crud` 1/4；`import-export` 5/24；`module-management` 9/12；`settings` 13/13；`station-dashboard` 16/33；`station-management` 14/23；`station-resource-group` 9/16；`ware-flow` 15/48 |
| sector (`2`) | `sector-flow-filter/sector-flow-filter` 2/3 |
| ship (`206`) | `abandon-selected-ship` 3/3；`bug-build-ship-equipment-panel` 7/7；`bug-ship-build-panel-ship` 2/2；`bug-ship-level-blueprint` 1/1；`bug-ship-status-diff` 1/1；`bugfix-abandon-selected-ship` 1/1；`bugfix-build-ship-equipment-panel` 9/9；`bugfix-ship-build-panel-ship` 2/2；`bugfix-ship-level-blueprint` 1/1；`bugfix-ship-status-diff` 1/1；`build-ship-equipment-panel` 31/31；`osaka-default-preset` 6/6；`ship-build-equipment` 31/31；`ship-build-material` 31/31；`ship-build-panel-ship` 12/12；`ship-build-stat` 15/15；`ship-build-storage` 27/27；`ship-build` 7/17；`ship-items` 11/11；`ship-level-blueprint` 7/7 |
| toolbar (`41`) | `toolbar-action2one/toolbar-action2one` 41/46 |

## Findings and semantic classification

### F1 — stale/pre-fix tests remain in canonical (`12` observed failures; test-owned)

Classification: **1) 过期测试/预期需迁移**。

Immutable evidence:

- Seven `bug-*` files contain 14 explicitly pre-fix cases: `map/bug-advanced-resource-filter.spec.ts` plus six `ship/bug-*.spec.ts` files. 12 are in the 640 failures; `bug-abandon-selected-ship` is expected-fail at runtime and `bug-ship-equipment-selector` did not fail.
- These cases coexist with `bugfix-*` cases that assert the opposite/current behavior. Examples: `bug-ship-status-diff.spec.ts:81` requires no positive diff while `bugfix-ship-status-diff.spec.ts:83` requires a positive diff; `bug-abandon-selected-ship.spec.ts:82-96` calls `testInfo.fail()` and asserts the known pre-fix absence.
- `map/bug-advanced-resource-filter.spec.ts:42-67` describes the pre-fix outcome but never asserts `count`; it is a vacuous canonical test even if setup passes.
- Commits `9183c1bf`, `1725868e`, `cd7d46bf`, `5759882c`, `b7a9afb2`, `5541b657`, and the corresponding archived OpenSpec work record the fixes. A `BUG` word in the title is historical metadata, not evidence that the product is currently broken.

Contract basis: `context-2.md:34-35` excludes duplicate, stale, or retired-implementation tests from canonical while preserving originals under legacy.

Correction owner / minimum scope: task-test-4 coding correction, only `tests/e2e/**` and `tests/legacy/e2e/**`. Keep one current-behavior regression per fixed bug; move pre-fix reproductions to legacy (or rewrite only where they encode a still-current behavior not covered by the bugfix case). Do not touch `src/**`.

Closure: no pre-fix expectation, runtime `testInfo.fail()`, or vacuous bug test remains in canonical; retained current regression cases pass after common setup repair.

New bug artifact: **no**.

### F2 — old active-view initialization causes the approximately 15-second whole-group timeouts (`107` failures; test-owned)

Classification: **2) canonical setup/initialization migration failure**。

Immutable evidence:

- Seven logic-flow specs write `localStorage.setItem('x4_station_active_view', 'flow')`, then wait for `.candidate-zone` with `{ timeout: 15000 }`: `logic-flow-bug-regression` 36/36、`logic-flow-drag-feedback` 5/5、`logic-flow-incompatible-drag` 2/2、`logic-flow-interaction` 15/15、`logic-flow-new-feat` 21/21、`logic-flow-plans` 11/11、`ui-adjust` 14/14，共 104。
- `compact-drag-view.spec.ts:8-23` uses the same raw string, writes through the obsolete `stationStore.activeView`, then waits `.station-workbench` and `.candidate-zone` for 15 seconds；3/3 fail。
- Representative `error-context.md` snapshots show the top toolbar and Blueprint workbench, not Logic Flow. This exactly matches current `useActiveViewStore` parsing: JSON string `"flow"` has no `.activeView`, so initialization falls back to `blueprint-production`.
- The waits are test-authored action/selector waits. Browser and page are alive; this is not a 15-second product hang and not infrastructure.

Correction owner / minimum scope: task-test-4 coding correction in the eight listed specs. Remove raw active-view storage and obsolete store writes; use canonical fixture/reload, then click stable `top-view-btn-flow` and assert the current Logic Flow root before behavior-specific steps. Do not add a product compatibility branch for raw-string storage.

Focused closure: run these eight files; no failure may stop in their shared `beforeEach`, and the 15-second absent `.candidate-zone` / `.station-workbench` signature must be zero.

New bug artifact: **no**.

### F3 — canonical fixture/version/readiness contract is incomplete (`test-owned`; broad, overlapping the file table)

Classification: **2) fixture/setup migration failure**。

Immutable evidence:

- 22 failing files representing `362` failed tests contain neither `tests/fixtures/db.json` nor `loadLiveBindingFixture`; this directly violates `CLAUDE.md:153-188`. Some navigate with only `isTestEnv`, then expect saved stations/plans/ships. Their snapshots show default Blueprint state or Ship Build filters with every race count `0`.
- Files that do inject `db.json` often write only 8.0 keys. The product defaults to 9.0 and reads `_v9` keys. The successful Live helper resolves this exact mismatch dynamically; the general canonical setup does not.
- `auto-sector-group-one-core` 34/34, `toolbar-action2one` 41/46, and `dlc-setting` 3/30 use a hard `#debug-ready-marker` timeout of only 500ms after reload. Their all/mostly grouped failure under `fullyParallel: true`, while the Live helper's 2-second readiness path and all Live tests pass, classifies this as a brittle test setup deadline, not an unavailable runner.
- `logic-flow/import-logic-flow.spec.ts` injects only `x4_logic_flow_plans` without the current version key mapping and then expects current sidebar import entries; all 34 fail before establishing the intended domain states.

Correction owner / minimum scope: task-test-4 coding correction, limited to `tests/e2e/**`. Reuse one canonical non-Live setup helper that (a) loads `db.json` without `vsn`, (b) deterministically pins the fixture's 8.0 version or maps fixture data through current `gameDataStore.getStorageKey()`, (c) reloads once, (d) waits on one stable readiness contract, and (e) changes language through UI. Keep `loadLiveBindingFixture` as the only Live/archive entry. Do not modify `tests/fixtures/**` or `src/**` under this task.

Focused closure: static audit finds no canonical spec bypassing the required setup without a documented data-independent reason; affected setup scopes pass in parallel and no `500ms #debug-ready-marker` cluster remains.

New bug artifact: **no**.

### F4 — selectors and state helpers still encode retired UI states (remaining behavior-level failures are not yet product evidence)

Classification: **2) canonical selector/helper/expectation migration**, with some cases to be reclassified under **1)** after current OpenSpec comparison.

Immutable evidence:

- The area/file table shows complete-file failures after the limited `9cb7d4bd` correction: build 34、logic-flow 138、map 76、production 82、ship 206、toolbar 41. Sample snapshots show the app rendered, but the expected test state was never reached.
- Current examples include old generic CSS and fixed-mode assumptions: `.search-input` / `.result-item` / `.list-wrapper` in `production/settings.spec.ts`; direct `shipBuildStore.activeView = 'maps'` in map/resource setup; ship helpers that require only `ship-build-filters` or only workspace panels after navigation; old `.station-workbench` in compact drag.
- `openspec/test_experience.md:134-148` already identifies the ship selector/workspace convergence defect and explicitly warns that these locators cannot be used as unconditional entry-state assertions.
- Current OpenSpecs preserve the underlying user behavior. Since the failures are dominated by setup/state convergence and retired selectors, no sampled failure isolates a current product implementation contradiction.

Correction owner / minimum scope: task-test-4 coding correction within failing `tests/e2e/**` files. Repair common setup first, then migrate each area against its active `openspec/specs/**` contract and stable `data-testid`. Do not bulk-change assertions from screenshots, do not weaken assertions to counts `>= 0`, and do not add compatibility DOM/classes in `src/**`.

Focused closure sequence: Logic Flow eight-file setup cluster → ship selector/workspace cluster → map/resource cluster → production/build/toolbar cluster → complete `npm run test:e2e`. A behavior-level failure may route to product coding only after its setup passes and a focused run contradicts an active OpenSpec requirement.

New bug artifact: **not now**. Create one only for a focused, current-contract failure that survives fixture/setup/selector migration, with the exact OpenSpec scenario and observable product output.

### F5 — environment/infrastructure classification

Classification: **4) none in the current full run**。

- Chromium launched and 321 tests passed; the suite ran for about 16.4 minutes. The 640 failures are not browser-launch or webServer-unavailable signatures.
- `task-test-4-review-0bfd04c9.md` recorded an earlier sandbox `SIGTRAP` before test execution. That evidence is valid only for that earlier runner and is superseded for availability classification by this successful full launch.
- Parallel load may expose the 500ms readiness race, but an unrealistic test-authored timeout remains test/setup ownership; it is not grounds to waive the full gate.

## Skipped tests

The 58 skipped tests are not part of the 640 failures, but they remain migration evidence: 57 are statically skipped and one is runtime-skipped. Before acceptance, each must be classified as either a current behavior to enable/fix or a stale/duplicate case to preserve under `tests/legacy/e2e/**`. They do not justify a product bug artifact by themselves.

## Changes required

1. Remove/move the 14 pre-fix/vacuous `bug-*` cases from canonical or convert only unique current behavior; preserve originals under legacy.
2. Fix the eight-file raw active-view initialization cluster that causes 107 approximately-15-second failures.
3. Establish one version-aware ordinary E2E setup path and replace missing/8.0-key-only setup; replace the 500ms readiness race.
4. After setup is green, migrate remaining selectors and state-convergence helpers per active OpenSpec and stable `data-testid`; retain behavior assertions rather than weakening them.
5. Re-run focused clusters, then `npm run test:e2e`; acceptance requires exit `0` with no unexplained canonical failures. Classify all skips explicitly.

## Caveats

- This review intentionally did not rerun the complete suite. Counts come from the supplied real run, current `.last-run.json`, 636 page snapshots, and a fresh read-only `--list` id map.
- The list reporter does not preserve full assertion stack traces for the completed run; therefore findings do not claim that every post-setup assertion is stale. They identify the smallest proven common blockers and require focused reclassification after those blockers are removed.
- No product defect is confirmed by current evidence. No new bug artifact is required at this checkpoint.
- The only write from this review is this report.
