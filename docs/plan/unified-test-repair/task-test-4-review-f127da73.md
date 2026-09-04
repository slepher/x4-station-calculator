# task-test-4 final classification review

- Status: `review_complete`
- Task: `task-test-4`
- Role: generation-2 final classification reviewer
- Reviewed commit: `f127da732123c7d0ae541bcf2eadad7f9d3f1186`
- Expected parent: `1908ad5655c6ad9d8362c8f54cc214c665794a46`
- Verdict: `changes_required`

## Evidence

1. Immutable checkpoint
   - `git show --no-patch --format='%H %P' f127da73` confirms the candidate is `f127da732123c7d0ae541bcf2eadad7f9d3f1186` with the single expected parent `1908ad5655c6ad9d8362c8f54cc214c665794a46`.
   - `git diff --name-status 1908ad56 f127da73` contains only three test files: `tests/e2e/live/contribution-name.spec.ts`, `tests/e2e/live/live-archive-valid-select.spec.ts`, and `tests/e2e/live/live-overview.spec.ts`. Neither remaining failing test was corrected by this checkpoint.
   - The supplied prior gate evidence is accepted: canonical layout, legacy preservation, selectors/setup/helper/scripts, build, and list checks passed; no full E2E was rerun in this review.

2. Gap contract and fixture
   - `openspec/specs/empire-gap-display/spec.md` still requires a gap `+` button to add the default production module and refresh gap data, but it also requires the operations group to be absent when no qualifying operations item exists. The behavior itself remains current.
   - The canonical scenario guidance in `openspec/changes/archive/2026-02-20-empire-gap-display/test_tasks.md:112-142` and `ui_knowledge.md:158-172` explicitly prepares station A with a Claytronics line and locked Quantum Tubes before station B opens the gap view and clicks `+`.
   - `tests/e2e/live/gap-button-response.spec.ts` does not establish that precondition. It loads the shared Live fixture, selects `f36126e5-7798-ed14-3c03-938b961efa0b`, toggles gap display, and assumes an operable `quantumtubes` row exists. In `tests/fixtures/db.json`, that selected plan has Antimatter Converters and Field Coils and has `lockedWares: []`; the current observed UI has neither a Sector Operations group nor an operable Quantum Tubes gap `+`.
   - Commit `31106e6865c810269461714f031e3adff5e90f5f` introduced this test together with the gap refresh fix. Round-3 commit `27b9c76f69f92c3ca6e385829a6d4cc37f03fd82` removed the Sector Operations scope and searched globally for any Quantum Tubes row, but that does not recreate the missing gap precondition and can select a non-gap/non-operable row.

3. BHW-834 current contract and history
   - Commit `fe8309edbb6876c2db1a2dbe536d865e1a67a158` originally added `tradestationCodes` filtering to `deriveBindingStationsFromRecords()` and the assertion that BHW-834 was hidden.
   - Later commit `6c9672419f7b72830175da667948231c2384fe64` deliberately removed exactly that filtering. Its current OpenSpec, `openspec/changes/show-transit-hub-in-sector-list/request.md`, `design.md`, and `specs/show-transit-hub-in-sector-list/spec.md`, requires a transit-hub station to appear as a normal station in the sector sidebar while its transit tab also remains available.
   - At `f127da73`, `src/store/logic/liveStationResolver.ts:121-153` contains no trade-station exclusion. `tests/fixtures/db.json` binds `BHW-834` as the transit station for `cluster_715_sector001_macro`, and the current UI exposes `[data-testid="sidebar-station"][data-station-id="BHW-834"]`, exactly as the newer contract requires.

## Findings

### F1 — `gap-button-response.spec.ts`: fixture mismatch, test-owned

- Classification: `fixture mismatch`, not product bug.
- Basis: the current product contract still requires gap `+` behavior, but only when a qualifying gap item exists. The canonical test does not create the documented Claytronics/locked-Quantum-Tubes producer-consumer setup, while the exact runtime evidence confirms the loaded fixture yields no such operable row.
- Correction owner and allowed path: test correction owner; keep changes within `tests/e2e/**`. Do not modify `src/**` and do not weaken the product contract.
- Canonical minimum correction: use the existing `loadLiveBindingFixture` path to provide a deterministic test-local precondition matching the documented station-A/station-B scenario, then scope the locator back to the Sector Operations group, require the Quantum Tubes `add-btn` to be enabled, click it, and assert the selected station's Quantum Tubes module/count or the same gap value changes. Remove the unsupported assumption that one click must move Quantum Tubes into Sector Products, and do not use a page-global Quantum Tubes locator.
- Focused closure: run only `tests/e2e/live/gap-button-response.spec.ts`; the test must prove an enabled gap `+` mutates the selected planning station and refreshes the displayed gap.
- Route: `test correction`; do not invoke `/x4:bug` and do not register a BUG from this evidence.

### F2 — `live-station-toolbar.spec.ts`: stale test, test-owned

- Classification: `stale test`, not product bug.
- Basis: line 245 preserves the superseded `fe8309ed` hidden-station expectation, while `6c967241` and the active `show-transit-hub-in-sector-list` OpenSpec intentionally require the opposite behavior. The current Sidebar output is contract-compliant.
- Correction owner and allowed path: test correction owner; `tests/e2e/live/live-station-toolbar.spec.ts` only.
- Canonical minimum correction: rename case 3.10 to state that a bound transit-hub station remains in the sector station list and replace `toHaveCount(0)` with a visible/exactly-one assertion for `[data-testid="sidebar-station"][data-station-id="BHW-834"]`. Preserve the separate transit entry; do not restore source filtering.
- Focused closure: run case 3.10 or `tests/e2e/live/live-station-toolbar.spec.ts`; BHW-834 must be visible as a normal station under `cluster_715_sector001_macro`.
- Route: `test correction`; do not invoke `/x4:bug` and do not register a BUG.

## Verdict

`changes_required`

Both remaining failures are test-owned, but neither may be accepted as-is. The gap case lacks its required fixture precondition, and the BHW-834 case asserts a superseded product rule. No product defect is established, so no BUG should be registered. `task-test-4` remains blocked until both canonical test corrections pass their focused runs; no generation-3 is required.

## Changes

1. Repair the deterministic gap precondition and outcome assertion in `tests/e2e/live/gap-button-response.spec.ts` without changing product code.
2. Update case 3.10 in `tests/e2e/live/live-station-toolbar.spec.ts` to the current transit-hub visibility contract.
3. Run the two focused canonical specs and retain the already-passed static gates. Full E2E is outside this review and was not run.

## Caveats

- This review classifies only the two supplied exact failures. It does not reopen the previously passed migration/static gates or the three round-4 assertion corrections.
- The candidate, product source, tests, git index, branches, merges, and workflow status were not modified. The only write is this dispatcher-requested reviewer artifact.
- No generation-3 was created.
