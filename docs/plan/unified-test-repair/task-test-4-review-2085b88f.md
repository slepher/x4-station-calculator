# task-test-4 final parent reviewer report

- Status: `review_complete`
- Task: `task-test-4`
- Role: generation-2 task-test-4 final parent reviewer
- Reviewed commit: `2085b88f3da631930dde64616bf8e97eb50677a3`
- Expected parent: `46a1024ca1bebc501dcc5d60a098bccf4f67286b`
- Verdict: `changes_required`

## Evidence

1. Immutable candidate and scope
   - `git show --no-patch --format='%H%n%P%n%T%n%s' 2085b88f` confirms candidate `2085b88f3da631930dde64616bf8e97eb50677a3`, single parent `46a1024ca1bebc501dcc5d60a098bccf4f67286b`, and tree `1c292dd7e40638bfdea61fca72b9c862a405a80e`.
   - `46a1024c..2085b88f` changes only `tests/e2e/live/gap-button-response.spec.ts`, inside task-test-4 ownership.
   - Accepted prior facts remain closed: canonical E2E migration, legacy preservation, Playwright routing/scripts, stable selectors, fixture/reload/UI-language setup, unique Live helper, build/list gates, and the BHW-834 correction are not reopened.

2. Candidate behavior and fixture precondition
   - Candidate uses the authoritative `loadLiveBindingFixture(page)`, selects `cluster_715_sector001_macro` / `RWC-785`, enters planning mode, changes the Claytronics count to `10`, then selects `cluster_100_sector001_macro` / `f36126e5-7798-ed14-3c03-938b961efa0b` and requires a negative Quantum Tubes row in Sector Operations before clicking its enabled `+`.
   - The accepted first focused run reached the behavior assertion but failed because Sector Operations was not visible. This is a real test-data/precondition failure, not an environment failure, and there is no focused pass for this candidate.
   - `tests/fixtures/db.json` gives RWC-785 a locked `quantumtubes` input and binds it to game GUID `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`. Its matching `save_old.json` archive contains 33 Quantum Tube production modules in the bound network. One module produces `470 / 720 * 3600 = 2350` Quantum Tubes/hour, while one Claytronics module consumes `400 / 900 * 3600 = 1600` Quantum Tubes/hour. Therefore count `10` adds only 16,000/hour demand against up to 77,550/hour archived Quantum Tube production and does not deterministically create a negative gap.
   - Archived gap test guidance already names a large value such as `100` for preserving the operations deficit while exercising refresh (`openspec/changes/archive/2026-02-20-empire-gap-display/test_tasks.md:132-135`; `ui_knowledge.md:160-171`). At count `100`, RWC-785 alone consumes 160,000 Quantum Tubes/hour, exceeding the 77,550/hour archive production; one `+` adds only 2,350/hour, so the row remains negative and observable after the click.

3. Reviewer focused command
   - Command run exactly once: `npm exec playwright -- test tests/e2e/live/gap-button-response.spec.ts`.
   - Exit: `1`; the test body did not execute (reported duration `3ms`).
   - Exact environment signature: `Error: browserType.launch: Target page, context or browser has been closed`; Chromium logged `[FATAL:content/browser/sandbox_host_linux.cc:41] Check failed: . shutdown: Operation not permitted (1)` and exited via `signal=SIGTRAP`.
   - This launch failure is unavailable runtime evidence. It is not classified as a product/test behavior failure and is not counted as a pass. The two previously reported `ERR_CONNECTION_REFUSED` webServer runs likewise remain environment failures, not product failures or passes.

## Findings

### F1 — Claytronics count `10` does not establish the required Quantum Tubes deficit

- Classification: test-owned fixture mismatch.
- Immutable evidence: `2085b88f:tests/e2e/live/gap-button-response.spec.ts` sets and verifies `10` at lines 35-37, then assumes Sector Operations exists at lines 55-56; the accepted executable run failed at that visibility assertion.
- Contract basis: the current empire-gap specification omits an empty Sector Operations group and enables `+` only for a qualifying negative gap. The archived scenario requires a deliberately large count, exemplified by `100`, so the gap remains visible across the mutation.
- Correction owner: current task-test-4 test correction.
- Allowed path: `tests/e2e/live/gap-button-response.spec.ts` only; no fixture, seed, helper, archive, product-source, or OpenSpec change is required.
- Preserved invariants: keep `loadLiveBindingFixture(page)` as the sole Live setup entry, perform the precondition through planning UI, retain stable Sidebar selectors, keep the Sector Operations-scoped Quantum Tubes locator, require a negative value and enabled `+`, then verify the displayed value changes.
- Minimum correction: change `claytronicsCount.fill('10')` and `toHaveValue('10')` to `100`. Do not weaken or remove the negative-gap, enabled-button, click, or refreshed-value assertions.
- Focused closure: `npm exec playwright -- test tests/e2e/live/gap-button-response.spec.ts` exits `0` in a Chromium-capable environment and proves the real gap behavior.

## Verdict

`changes_required`

The candidate has no explicit focused exit `0`, and its one behavior-bearing run still failed because count `10` did not create Sector Operations. The latest reviewer run failed before test execution for an exact Chromium sandbox environment reason; that failure neither establishes a product defect nor permits acceptance.

This is not `context_blocked`: task-test-4's existing `tests/e2e/**` ownership can establish the documented precondition with the two literal-value edits above. No generation-3 or product decision is needed.

## Changes

1. In `tests/e2e/live/gap-button-response.spec.ts`, change the Claytronics input and matching value assertion from `10` to `100`.
2. Re-run only `npm exec playwright -- test tests/e2e/live/gap-button-response.spec.ts` in a Chromium-capable environment.
3. Accept only when that command exits `0` and the negative Sector Operations Quantum Tubes row, enabled `+`, click, and value refresh all execute successfully.

## Caveats

- No full E2E was run.
- Candidate code/tests, fixtures, product source, git index, commits, branches, merges, and workflow status were not modified. The only write is this reviewer artifact.
- No generation-3 was created.
