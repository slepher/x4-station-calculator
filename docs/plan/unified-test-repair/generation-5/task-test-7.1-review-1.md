# task-test-7.1 review-1

- Candidate: `3a047bab582e208623e6b0b56535684e330b0209`
- Base: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- Verdict: `changes_required`
- Target merge: prohibited

Candidate ancestry, the three owned paths, and `git diff --check` are valid. The migration improved the focused run from 4/27 passed with 8 skipped to 21/27 passed with 0 skipped. The remaining six failures are retained and do not constitute completion.

## Findings

- `test-owned`: label reorder success.
- `test-owned`: reorder followed by save/reload.
- `test-owned`: cancel reorder.
- `stale`: W3 still uses the obsolete `.results-popover .result-item` locator.
- `test-owned`: W4 cancel reorder.
- `test-owned`: empire save/reload evidence does not complete the real save flow, so it cannot be called a product defect.
- The candidate also contains contract violations requiring correction before acceptance: `?? []`, `|| ''`, conditional dialog handling, and a weakened `count > 0` assertion.

The reviewer rerun was stopped after 19 passed, 6 failed, 1 interrupted, and 1 not run (exit 130). It does not replace the complete candidate run: 27 collected, 21 passed, 6 failed, 0 skipped (exit 1).

The task-test-5-fix-1 target `761310260d1188d836326fadbdd7bdc7616de05c` changes only Logic Flow candidate/presenter and its Unit test. No evidence currently requires reopening task-test-7.1 solely because of that fix, but a target-visible focused rerun is mandatory before any later acceptance.

## Recovery gate

Return to task-test-7.1 after its owned locator/oracle corrections are made. Sync target `761310260d1188d836326fadbdd7bdc7616de05c` into integrate, then rerun the original focused Playwright command with Chromium, one worker, retries 0, trace on, plus `git diff --check`. Acceptance requires 27 passed, 0 failed, 0 skipped, and both commands exit 0. Preserve all existing traces and this review history.
