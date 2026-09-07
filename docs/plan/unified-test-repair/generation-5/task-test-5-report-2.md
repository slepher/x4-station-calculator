# task-test-5 failure report 2

- Task: `task-test-5.1`
- Candidate: `f9294c3292a045375f272c8c3ad12cec0e5130ea`
- Base: `761310260d1188d836326fadbdd7bdc7616de05c`
- Status: failed / incomplete
- Availability: focused runner available; cross-consumer partially unavailable and manually stopped
- Blocks: task-test-5.1, parent task-test-5, and dependents task-test-5.2, task-test-5.3, task-test-6, task-test-11

## Attempts

1. Post-fix focused run: 8 tests, 3 passed, 5 failed, exit 1.
2. Collection/list: 8 tests, exit 0.
3. `npm run build`: exit 0.
4. `git diff --check`: exit 0.
5. Helper cross-consumer: 64/165 observed, 34 passed, 29 failed, 1 interrupted, 101 not run, exit 130. Build-flow connection refusals were retained as unavailable evidence.

## Unmet acceptance and classification

The 4.6, both 4.7 directions, 4.16, and 4.17 failures all hit the shared compact-view assertion. Current evidence is `test-owned`, because `dragLogicFlow.ts` uses `toHaveCount(0)` against a `v-show` DOM node; it does not establish a product visibility failure. Legal-drag failures also need a distinct visible-state oracle. The helper's store-derived status and fallback defaults violate the contract and must be corrected before reclassification.

No product-owned failure is proven. The candidate remains retained and is not deleted, weakened, or marked passed.

## Recovery conditions

Correct the helper and owned specs with independent visibility/computed-style, Sortable-state, store-state, groups/nodes, explicit expectedStatus, and group-identity assertions. Then rerun the exact focused command, list, build, diff, and bounded cross-consumer command. Only a fresh real pointer witness after those test-owned corrections may open a product report. Runner refusals remain unavailable with exact traces.

## Evidence

- `tests/e2e/logic-flow/migration-task-test-5.1.md`
- integrate `test-results/logic-flow-*` traces and error contexts
- retained branch `workflow/unified-test-repair-retained-task-test-5` (candidate `f9294c3292a045375f272c8c3ad12cec0e5130ea`)
