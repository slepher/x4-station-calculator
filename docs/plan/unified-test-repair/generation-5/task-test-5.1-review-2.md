# task-test-5.1 review-2

- Candidate: `f9294c3292a045375f272c8c3ad12cec0e5130ea`
- Base: `761310260d1188d836326fadbdd7bdc7616de05c`
- Verdict: `changes_required`
- Independent reviewer: unavailable during shutdown; dispatcher evidence review retained

The formal post-fix run collected 8 tests and passed 3, failed 5. Collection, build, and diff checks passed. The candidate is not eligible for target.

The five failures all use the helper's `compact-view` oracle. `attemptWareDrag` still asserts `toHaveCount(0)` even though the component keeps the node in the DOM with `v-show`; count 1 does not prove visibility. This is test-owned and must be changed to visibility/computed style plus Sortable and store-state evidence before any product conclusion. The helper also still derives status through the store and contains fallback-style defaults, which violate the task contract. The legal-drag failures need a separate current visible-state oracle.

Cross-consumer execution was stopped at 64/165 (34 passed, 29 failed, 1 interrupted, 101 not run; exit 130); build-flow connection refusals are unavailable evidence. No new product defect is established by the formal run.

Recovery requires correcting only task-test-5.1 owned test/helper paths, then rerunning the focused 8-test command, collection, build, diff, and a bounded cross-consumer command with grouped signatures. The task remains incomplete.
