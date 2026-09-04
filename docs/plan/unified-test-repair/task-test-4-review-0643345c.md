# task-test-4 final reviewer report

- Status: `review_complete`
- Task: `task-test-4`
- Role: generation-2 task-test-4 final reviewer
- Reviewed commit: `0643345ca66856027d56de8ef28933ffd1db325a`
- Expected parent: `83c22272eb5c0cb679723b925600ad2bb22eace6`
- Verdict: `changes_required`

## Evidence

1. Immutable candidate and scope
   - `git show -s --format='%H%n%P%n%T' 0643345c` confirms the immutable candidate and its single expected parent.
   - `83c22272..0643345c` changes only `tests/e2e/live/gap-button-response.spec.ts` and `tests/e2e/live/live-station-toolbar.spec.ts`, both inside task-test-4 owned path `tests/e2e/**`.

2. BHW-834 correction
   - Candidate case 3.10 now requires `[data-testid="sidebar-station"][data-station-id="BHW-834"]` to have count 1 and be visible, matching commit `6c967241` and the active `show-transit-hub-in-sector-list` OpenSpec behavior.
   - Focused command `npm exec playwright test -- tests/e2e/live/live-station-toolbar.spec.ts -g '3.10'` exited `0`; both matching 3.10 cases passed. This part of the candidate is accepted.

3. Gap precondition and focused failure
   - `openspec/changes/archive/2026-02-20-empire-gap-display/test_tasks.md` and `ui_knowledge.md` require station A to have a Claytronics production line with Quantum Tubes locked, then station B to expose an enabled Quantum Tubes `+` in Sector Operations.
   - Candidate calls `loadLiveBindingFixture(page)`, then directly derives the versioned `save_bindings` key, rewrites `bindings.list[0].stationPlans`, and reloads. This bypasses the repository rule that Live/save-binding setup stays on the authoritative helper path, and it uses neither normal UI operations nor the existing fixture-patch mechanism.
   - More importantly, the mutation does not establish the required observable state. The shared fixture is a connected multi-sector network with existing Quantum Tubes production. Replacing MGO-010's one Field Coils module with one Claytronics module leaves Quantum Tubes at `+212.0`; it appears in the ordinary Products group, so the active spec correctly omits an empty Sector Operations group.
   - Focused command `npm exec playwright test -- tests/e2e/live/gap-button-response.spec.ts` exited `1` at the Sector Operations visibility assertion. Chromium launched and the production build completed; this is a deterministic test-data failure, not an environment failure.

## Findings

### F1 — Dynamic `save_bindings` rewrite remains a fixture mismatch

- Classification: test-owned fixture mismatch; no product defect is established.
- Immutable evidence: `0643345c:tests/e2e/live/gap-button-response.spec.ts` lines 12-24 and the focused failure at its Sector Operations assertion.
- Contract basis: the active empire-gap specification only renders Sector Operations when a qualifying operations item exists; the archived `test_tasks.md`/`ui_knowledge.md` require that precondition before exercising `+`.
- Correction owner: current task-test-4 coding correction.
- Allowed paths: existing task-test-4 ownership, preferably only `tests/e2e/live/gap-button-response.spec.ts`; `tests/e2e/live/helpers/loadLiveBindingFixture.ts` or a test-local file under `tests/e2e/**` is allowed only if the UI-only setup proves impractical.
- Preserved invariants: keep `loadLiveBindingFixture(page)` as the sole Live fixture entry; do not modify `src/**`, shared `tests/fixtures/**`, `tests/seeds/**`, archive records, or product semantics; retain the Sector Operations-scoped Quantum Tubes locator and enabled `+` assertion.
- Minimum executable correction: remove the post-helper localStorage rewrite and second reload. Use the already loaded fixture through UI: open planning mode for fixture station `RWC-785` (already seeded with Claytronics and locked Quantum Tubes), raise its Claytronics count to a deterministic value such as `10`, then select `f36126e5-7798-ed14-3c03-938b961efa0b`, enable gaps, and assert the Sector Operations Quantum Tubes row is negative and its `+` is enabled. Click `+` and assert the selected station gains/increments `module_gen_prod_quantumtubes_01` or that the still-visible gap value changes. The larger deficit keeps the row present after one click and matches the archived guidance to preserve the operations item while verifying refresh.
- Focused closure: `npm exec playwright test -- tests/e2e/live/gap-button-response.spec.ts` exits `0` and proves the enabled gap action mutates the selected planning station and refreshes the displayed gap.

## Verdict

`changes_required`

BHW-834 is corrected and focused-pass evidence is sufficient. The gap case must not pass because its dynamic storage mutation neither follows the repository's Live fixture setup boundary nor creates the documented qualifying gap.

This is a bounded **coding correction for task-test-4**. It does **not** require expanding task-test-4 owned paths and does **not** require stopping for a user product decision. If the correction owner rejects UI setup and instead proposes changing `tests/fixtures/**`, `tests/seeds/**`, archived OpenSpec fixture documentation, or product code, that proposal crosses the current ownership/behavior boundary and must stop for explicit dispatcher/user authorization; it is not the minimum next step.

## Changes

1. Keep the accepted BHW-834 visible assertion unchanged.
2. Replace the gap test's direct `save_bindings` localStorage mutation with the UI-created deterministic deficit described in F1.
3. Run only the focused gap spec for closure. Do not create generation-3.

## Caveats

- Full E2E was not run.
- The gap failure is not attributed to the environment and is not accepted as passing.
- Candidate files, product source, git index, commits, branches, merges, and workflow status were not modified. The only intended write is this reviewer artifact.
- No generation-3 was created.
