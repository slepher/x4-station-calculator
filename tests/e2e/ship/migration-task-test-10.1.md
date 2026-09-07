# M10.1 ship selection and discard migration

Base `d590ede41d41913ab18f5c5a18247bf956a4685a`; direct workspace, no commit. Contract M10.1 owns five ship specs, this migration record, and results/M10.1.md. M16.1/M16.2 and all product/helper/base fixture paths are read-only.

## Authority and current inputs

Read canonical equipment-panel/ship-build-stat and archived 2026-03-03 ship-build, 2026-03-09 abandon-selected-ship, plus 2026-03-09 ship-build-panel-ship spec/request/design (accepted later selector behavior). The later spec explicitly replaces immediate selection with pending→confirm and the old 4:6 layout with 1:1:1 filter/candidate/status columns. Candidate list is now a single column within the middle column. New/Discard must retain ship context, clear equipment, and preserve hull materials.

Read current ShipBuildView/Selector/Workspace/PanelShip, ship store selection/reset and Toolbar dispatch. These remain legacy direct-store consumers; test scope changes no product layers. Static 9.0 data provides independent expected values: Katana `ship_ter_m_corvette_01_a` hull 12,200, Odachi `ship_ter_m_corvette_02_a` hull 16,100 (same-class delta +3,900); Osaka `ship_ter_l_destroyer_01_a` hull 104,000 (cross-class, no diff). Old 11,000/5,100/95,000 expectations are obsolete for the explicitly selected 9.0 version.

Fixture plan: every beforeEach injects db.json excluding vsn, sets 9.0 stable, reloads, chooses language via UI. Clean initial selector/discard cases use current ship v5 state `{version:5,activeShipId:null,activeBlueprintId:null,ships:[]}` under x4_ship_blueprints_v9. Current-ship panel/regression cases copy the fixture's existing ship v5 payload to v9 and preserve its Katana blueprint as a genuine loaded starting state. All tested choices/fit/save/discard actions use UI, storage and store reads only observe results. Actual engine candidate selector is `candidate-engine_`, excluding empty option per M16.1 evidence.

## Baseline inventory / migration mapping

Collection before any test edits: **35 tests in five files**, exit 0, `/tmp/x4-migration-M10.1/collection-baseline.log`. Shared FIX-M5.2 rebuild completed with parent-confirmed exit 0 before browser baseline.

| Original file/IDs | Current purpose / independent witness plan |
|---|---|
| ship-build: 状态、切换 (2) | Current selector entry, toolbar theme and disabled actions without ship; blueprint-production→ship UI tab switch |
| ship-build: class/race/type visibility and intersection (5) | Required filters, exact current candidate identities/counts, class-dependent type options |
| ship-build: localization + race/type counts (3) | Fixed translated Katana name, static subset cardinalities |
| ship-build: 4:6 layout | Migrate to accepted three-column 1:1:1 geometry |
| ship-build: 3-column result cards | Migrate to current middle candidate column with equal-width stacked cards; retain geometric witness |
| ship-build: single choice / change / lower panels (3) | Pending changes highlight/preview only; confirmation enters workspace; change returns selector without losing ship |
| ship-build: adaptive detail height | Current selector status panel and workspace content have adaptive height |
| panel-ship 2.1 | Current loaded Katana automatically pending-highlighted; blueprint unchanged |
| panel-ship 2.2 | Odachi pending, selected Katana unchanged, exact 16,100 (+3,900) hull |
| panel-ship 2.3, 3.3 | Confirm pending Odachi; workspace identity becomes Odachi and equipment cleared |
| panel-ship 2.4, 3.1 | Cancel current selection; original Katana blueprint retained |
| panel-ship 3.2 + bugfix-panel 4.1 | Confirm same ship (not cancel); returns workspace with identical blueprint |
| panel-ship 3.4 | Same-class filter edits, cancel; current ship retained and no forced filter reset requirement preserved |
| panel-ship 3.5 | Pending Osaka different class; exact 104,000, no diff |
| panel-ship 3.6 | Same-class compare reverses after confirming Odachi; Katana target 12,200 (-3,900) |
| panel-ship 3.7, 3.8 + bugfix-panel 4.2 | Genuine >10 candidates (all-race M corvette =11); pager header geometry, exact two pages, active/disabled states and page content changes |
| abandon 2.1 | Clean Odachi selected then real engine assignment makes dirty and New opens actual discard dialog |
| abandon 2.2, 3.1 + bugfix-abandon 4.1 | Actual discard/reset, same ship across view/blueprint/materials; equipment removed, hull materials remain; fresh draft clean |

No opaque runtime cardinality or store-derived expected output substitutes for static oracle. No skip/fixme, conditional success or literal self-assertions retained.

## Current-run evidence

- Original representative baseline: 0 passed / 5 failed, exit 1, `baseline.log` and `baseline/`; stale removed filter anchor and unversioned fixture assumptions.
- First migrated focused: 20 passed / 15 failed, exit 1, `focused.log` and `focused/`. Thirteen failures shared the test-owned omission of the MJ unit; race count whitespace and nonexistent Load button caused the other two. Corrected exact text and verified Load is unreachable by absence, consistent with abandon-selected-ship's no-ship action requirement (not a weakened clickable action).
- Final focused: **34 passed / 1 failed / 0 skipped**, exit 1, `final.log` and `final/`. Full 35-case collection remains intact. Previous failures remain as historical evidence, not current success claims.
- The one product candidate is panel 3.4: loaded Katana → change ship → add Argon race while staying M → cancel → change ship again. Argon is active before cancel but idle afterward. Blueprint identity/content remains unchanged. Accepted request explicitly says no selector-entry refill and no same-class cancel tag refill. Current `ShipBuildView.vue:25` unmounts selector and its local filter refs are refilled by `ShipBuildSelectorView.vue:159` immediate watcher on every mount. No product edits or repeated product-failure runs.
- Unmet acceptance: same-class filter preservation across cancel/reopen. Restore by independently fixing selector filter lifetime/refill semantics, rebuilding dist, and rerunning this exact 35-case scope. No dependency on unrelated DLC failures.

All evidence is under `/tmp/x4-migration-M10.1/`. Diagnostics and original test-setup imports are retained; source/helpers/base fixtures and other tasks are unchanged by this contract.

## Authorized post-fix consumer migration

fix-ship-selector-filter-lifetime intentionally retains Selector with v-show so same-class filters survive cancel. Fresh-build original case3.4 passed, but full35 exposed bugfix-panel4.1's obsolete DOM-count0 expectation (workspace was already visible). Parent explicitly authorized only that assertion's migration to `toBeHidden()`; workspace visibility, selectedShipId and exact blueprint invariance assertions remain. The test verifies leaving selector, not destroying its local state. No source rebuild required for this one-line test correction.

Preserved first post-fix full:34passed/1failed, `/tmp/x4-migration-M10.1/post-fix/full.log` and trace. Authorized correction precise case4.1:1/1 passed exit0, `post-fix/consumer-precise.log`. Original case3.4 precise:1/1 passed exit0, `post-fix/precise.log`. Final full35 result recorded in the current result report.
