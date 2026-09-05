# task-test-8.3 migration record

- Worktree: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
- Branch: `workflow/unified-test-repair-integrate`
- Required HEAD: `761310260d1188d836326fadbdd7bdc7616de05c`
- Scope: `tests/e2e/map/map-dlc.spec.ts`
- Git commit: `9915c3960ad32883a2c3ca6f9354cc2b852366f7`

## Commands and evidence

Baseline was run to completion with:

```text
npm exec playwright test -- tests/e2e/map/map-dlc.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
```

Baseline exit: `1`; result: `20` tests, `2 passed`, `18 failed`. The primary stale oracle was the shared fixed polygon count: expected `173`/`88`, received `325`/`164`. Trace artifacts were written under `test-results/map-map-dlc-*/`.

An intermediate candidate run after the fixture/oracle edit was intentionally interrupted after repeated English `Sector Map` locator failures. It did not complete and is not a candidate pass.

The candidate was then run to completion with the same command after changing the navigation locator to `/Sector Map|星区地图/`. Candidate exit: `1`; result: `20` tests, `2 passed`, `18 failed`.

Candidate evidence:

- `3.13` and `3.14` passed.
- `13` tests reported `net::ERR_CONNECTION_REFUSED` during `page.goto('/')` after the preview server became unavailable. These are runner unavailable evidence, not product failures.
- `2.5`, `3.1`, `3.11`, and `3.15` still failed because the `Cluster_408_macro` oracle resolved to count `0`.
- `3.12` timed out waiting for `map-station-entry-button`.
- Candidate traces and error contexts are under `test-results/map-map-dlc-*/`.

No post-candidate test run was made. `git diff --check` was not run after the final edits because the user requested immediate stop; build output was produced by the Playwright web server startup during candidate execution.

## Changes made

- Added fixture loading to both describe `beforeEach` blocks: deep-copy `tests/fixtures/db.json`, delete `vsn`, inject every key into localStorage, set `isTestEnv=true`, reload, then select `zh-CN` through `data-testid="language-select"`.
- Replaced fixed total polygon-count assertions with specific cluster/sector visibility assertions.
- Changed the map navigation role locator to support the localized `星区地图` label.
- No `localStorage.clear`, store-direct user action, `skip`, `fixme`, or `only` was added.

## Classification and recovery

- `test-owned`: fixed-count polygon oracles and the English-only navigation locator.
- `unknown`: the current accepted identifier/oracle for the missing `Cluster_408_macro` and the station-entry action could not be established within this bounded test-only run.
- `unavailable`: the preview runner became unreachable for 13 tests (`ERR_CONNECTION_REFUSED`).
- `product-owned`: none established.
- `infeasible`: no separate infeasible case established.

Recovery requires a fresh runner session with the candidate server kept available, followed by an authoritative accepted map-DLC contract for the current visible DLC cluster/sector and station-search entry. Then rerun the exact focused command and `git diff --check`; do not alter product code or expand beyond the three owned paths.
