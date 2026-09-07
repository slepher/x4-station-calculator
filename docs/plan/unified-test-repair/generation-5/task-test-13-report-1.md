# task-test-13 failure report 1

- Task: `task-test-13.1`
- Candidate: `d852d943eca26c005f8894651642b726271a9ad6`
- Base: `761310260d1188d836326fadbdd7bdc7616de05c`
- Status: failed / incomplete
- Availability: runner available for bounded focused run
- Blocks: task-test-13.1 and parent task-test-13 only; independent tasks continue

## Attempts

1. Baseline focused run: 7 passed, 1 failed (2.2), exit 1.
2. Candidate focused run: 5 passed, 4 failed, exit 1.
3. Candidate migration stopped before document mapping and before build/list/diff checks.

## Unmet acceptance and classification

- 2.2 material group did not appear after the checkbox action: unresolved test-owned setup/oracle.
- 3.1–3.3 cannot find `flow-plan-menu-item-logic-flow-1`: stale test locator.
- Current migration mapping and owned OpenSpec E2E task update are missing.

The candidate remains retained and is not marked passed. No product-owned failure is established.

## Recovery conditions

Keep the original valid preview scenarios, correct only the stale locator and deterministic setup/oracle, complete the migration document and only the E2E chapters of the owned `test_tasks.md`, then rerun the exact focused command, list, build, and `git diff --check`. Classify fresh failures before any target merge.
