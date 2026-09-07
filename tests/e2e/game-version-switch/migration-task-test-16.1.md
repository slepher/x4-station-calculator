# M16.1 Game version switch migration

Base: `d590ede41d41913ab18f5c5a18247bf956a4685a`; direct workspace candidate, no commit. Contract: `docs/plan/unified-test-repair/direct-migration/tasks/M16.1.md`; original scope: generation-5 task-test-16 §16.1. Normative source: `openspec/specs/game-version-switch/spec.md`.

## Current inputs and boundaries

`src/assets/versions.json` explicitly defaults to 9.0 stable. It maps stable 9.0 to `x4_empire_data_v9`, `x4_logic_flow_plans_v9`, `x4_ship_blueprints_v9`; 8.0 stable uses corresponding unsuffixed keys. Beta 9.0 still exists but the modal hides it by default when a stable counterpart exists. Tests therefore use the two available stable choices, with fixed independent expectations rather than deriving expected keys or version values from the store.

Ordinary beforeEach clones `tests/fixtures/db.json`, deletes `vsn`, and initializes both stable namespaces with clean empire v5, flow v3, ship v5 state. Ship state uses `ships: []`, `activeShipId: null`, `activeBlueprintId: null`. It removes version selection as fixture setup, reloads and selects zh-CN via `language-select`. No base fixture/helper is modified. All business mutations occur through UI; evaluate only initializes fixture or reads storage/document identity. No Live/archive fixture is needed. Logic Flow is explicitly clean and created via the existing quick-add menu, so no shared drag/setup helper dependency is introduced.

Read-only flow tracing: VersionSettingsModal currently directly consumes game/blueprint/flow/ship stores; no version settings presenter exists. Its current selected/new-module behavior delegates to saveEmpireAs/saveCurrentPlanAs/saveAsBlueprint before setVersion. Blueprint toolbar and Logic Flow candidate presenters were inspected for supported UI entry paths. No product architecture changes were made.

## Mapping

| Original ID | Current behavior and UI action | Independent expected / migrated test |
|---|---|---|
| 2.1 | Toolbar version button opens modal | Title, 9.0::stable selection, data isolation warning; 2.1 |
| 2.2 | Select available 8.0 stable target | Exact 8.0::stable and enabled switch; 2.2 |
| 3.1 | First visit red dot; confirm effective version | Dot visible initially, absent after confirmation and reload; 3.1 |
| 3.2 | Add station, save named empire, switch 9→8→9 | Original exact storage snapshot retained; one named plan; target has zero stations, returning has one; persisted version exactly 8.0 stable; 3.2 |
| 16.1 required selective dirty save (coverage absent in original spec file) | Add station, quick-add hullparts production line, choose Katana and fit engine; open modal, select target, toggle select-all, select one of three modules | All three initially unchecked; three independent nonempty default names under select-all; blank checked name blocks save; chosen plan saved with exact supplied name, both unchecked module payloads unchanged; ship identity fixed to Katana; parameterized 3.3 empire/logic_flow/ship_blueprints |
| 16.1 required discard-switch (coverage absent in original spec file) | Same three dirty UI actions, select target and click switch with none checked | All source module storage snapshots unchanged; 3.4 |
| 3.5 | Same effective version without stored selection, while three modules dirty | Selection persisted as 9.0 stable, performance.timeOrigin unchanged (actual no-reload witness), all module snapshots unchanged, flow group retained; 3.5 |
| 3.6 | Confirm version via UI, then create three dirty modules and reopen same-version modal | Switch disabled; dirty/save branch absent; 3.6 |

All 6 original tests retained through mapped current cases; missing three-module save/discard requirements added. No skip/fixme/only, conditional success, store-write business simulation or weak existence-only isolation check.

## Failure classification and evidence

- Baseline: 6 collected, 3 passed / 3 failed, exit 1. 2.2 and 3.2 select hidden beta option (stale); 3.5 expects obsolete default 8.0 but persisted 9.0 stable (stale). Logs `/tmp/x4-migration-M16.1/baseline.log`, traces under `baseline/`.
- First migrated probe: 4 passed / 3 failed / 1 interrupted / 1 not run, exit 130. Quick-add button is translated outside its clipped card until hover; missing hover is test-owned. Stopped duplicate route after identifying it, added real card hover. Clean ship schema also corrected to current array shape before subsequent verification.
- Corrected two-module probe: 9/9 passed, exit 0, `/tmp/x4-migration-M16.1/focused-final.log`; insufficient alone for original three-module requirement, followed by expanded run.
- Final three-module focused and collection results are recorded in `docs/plan/unified-test-repair/direct-migration/results/M16.1.md`.

No product defect candidate established. Build and canonical Unit were reported passing by ENV/parent and reused via the assigned preview-only config; this worker did not rebuild or run Rust build. Chromium keeps its own sandbox via narrowly escalated browser commands.

## Reusable ship UI witness

Clean ship v5 fixture → `top-view-btn-ship-build` → `ship-build-filter-class-btn-ship_m` → `ship-build-filter-race-btn-terran` → unique `ship-build-ship-name` matching `/^武士刀$|^Katana$/` → `ship-build-confirm-ship`. Within `ship-build-panel-fit`, choose `slot-type-engine`, then the first `[data-testid^="slot-"]:not([data-testid^="slot-type-"])`. In `equipment-picker`, choose the first **`[data-testid^="candidate-engine_"]`**, confirm with `picker-confirm`, and wait for picker hidden. Engine choice need not depend on a particular engine id to create dirty state; version-save assertion independently verifies saved Katana identity/name and untouched other modules.

Do not copy the nearby ship spec's broad `[data-testid^="candidate-"]`. Its first entry is `candidate-empty`; on a fresh empty blueprint this changes no equipment and produces no dirty module. Expanded probe established this test-owned failure: 10 collected, 6 passed / 4 failed, exit 1 (`three-modules.log`, traces `three-modules/`). All four failures were the missing ship dirty checkbox. Restricting to actual engine candidates preserves the genuine user equipment action. No neighboring Ship spec was changed.
