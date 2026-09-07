# task-test-7 failure report 1

- Task: `task-test-7.1`
- Candidate: `3a047bab582e208623e6b0b56535684e330b0209`
- Base: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- Status: failed / incomplete
- Availability: available for bounded rerun; reviewer rerun was interrupted on request
- Blocks: task-test-7.1, parent task-test-7, and dependents of parent task-test-7 only

## Attempted

1. Frozen base focused run: 27 collected, 4 passed, 15 failed, 8 skipped, exit 1.
2. Candidate focused run on `PORT=21558`: 27 collected, 21 passed, 6 failed, 0 skipped, exit 1.
3. `git diff --check`: exit 0.
4. `npm run build`: exit 0.
5. Reviewer rerun was stopped after 19 passed, 6 failed, 1 interrupted, 1 not run, exit 130. This is supplementary evidence only.

## Unmet acceptance and classification

| Failure | Classification | Unmet item |
| --- | --- | --- |
| Label reorder success | test-owned | Current drag/order oracle does not match observed behavior |
| Save/reload order | test-owned | Reorder persistence oracle remains unresolved |
| Cancel reorder | test-owned | Cancel oracle remains unresolved |
| W3 save/reload | stale | `.results-popover .result-item` is an obsolete locator |
| W4 cancel reorder | test-owned | Cancel oracle remains unresolved |
| Empire save/reload | test-owned | Test does not complete the real save flow; identity recovery is unproven |

The candidate also needs removal of `?? []`, `|| ''`, conditional dialog handling, and the weakened `count > 0` assertion to satisfy the migration contract. No product defect is established by this evidence. The task remains unfinished and its candidate is retained; it is not deleted, weakened, or marked passed.

## Recovery conditions

The owner must correct the six test-owned/stale items within the three owned paths, use current UI anchors and exact order/identity oracles, and rerun the focused command with 27 passed, 0 failed, 0 skipped. Before that rerun, integrate must contain target `761310260d1188d836326fadbdd7bdc7616de05c`; also run `git diff --check`. If a corrected witness demonstrates a product failure, return a new bounded product report through the workflow target-mediated route. If the runner becomes unavailable, retain the exact command and environment error without claiming a pass.

## Evidence paths

- `tests/e2e/production/migration-task-test-7.1.md`
- `test-results/` in the integrate worktree, including the six candidate traces
- Candidate commits `833e2d5b...` and `3a047bab...`

The original task and candidate remain retained for recovery. Independent tasks continue.
