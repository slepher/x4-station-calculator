- Task: T003
- Contract revision: 1
- Result: T003-A4.md
- Candidate snapshot: corrected `tests/e2e/vue-drag-test.spec.ts`; no source/Unit/helper/fixture/config changes
- Verdict: changes-required

## Findings

1. **Medium — Reset is still invoked only after pointer cancellation has already cleaned the active drag.** The corrected test establishes `{ active: true, item: 'item-3', hover: 'B' }`, but then calls `page.mouse.up()` and `idle(page)` before clicking Reset. The A4 Reset trace preserves that order and shows the first idle assertion passing before the Reset click, so `active/item/hover` and Sortable artifacts are already clear when Reset runs. The correction uses real pointer and visible UI actions, and it proves Reset clears the nonempty event history and restores exact ownership, but the second idle assertion only proves that an already-idle state remains idle; it does not prove Reset cleans an active/hovered drag as required by T003 acceptance and the prior A2 review. Owner: T003 implementation owner. Allowed correction: change only `tests/e2e/vue-drag-test.spec.ts` so the visible Reset control is activated through UI input while the real pointer drag is still active and hovering B, then assert `active/item/hover`, Sortable artifacts, exact A/B ownership, and event history before releasing any remaining pointer input. If the demo cannot satisfy that interaction, retain the focused failure and return the product behavior to the planner under T003 acceptance 3. Verification: rerun the exact two-spec focused command with `--workers=1 --retries=0 --trace=on` into a fresh attempt directory, rerun the scoped `git diff --check`, and independently inspect the Reset trace ordering and assertions.

## Acceptance

The A4 focused run passed as written: `.last-run.json` reports `passed`, ten trace archives are present with no recorded trace errors, and the embedded spec blobs match the reviewed current files (`57e08f1d6ae04bb15773644ad7b2c3bf59070c68` for `vue-drag-test.spec.ts` and `b0dcada7cb2fb62057706d5d5cfdc839ef5cde2e` for the unchanged compact regression). The current candidate diff is confined to the Reset case in `vue-drag-test.spec.ts`; the compact spec is unchanged, and the scoped `git diff --check` passes.

The retained A2 acceptance for the other scenarios remains valid. In A4, the Reset trace adds real mouse move/down/move/up actions, proves the active item and B hover before release, carries a nonempty drag event history into the Reset click, and then proves exact initial ownership (`A = item-1..item-5`, `B = []`), empty history, and no Sortable artifacts. Those are accepted results. The unmet part is attribution of active/hover and Sortable cleanup to Reset itself, because pointer release and a complete idle check occur first.

## Explanation

The focused command result remains `10 passed, 0 failed, 0 skipped`; that test pass is retained and is not converted into a failure. Independent review remains `changes-required` because the correction exercises another cancellation before Reset and therefore does not close the prior Reset-specific cleanup finding. Remaining scope is one focused Reset interaction correction or a planner-visible product failure; final canonical E2E remains T010/T025 scope.
