# task-test-8 failure report 1

- Task: `task-test-8.2`
- Candidate: `e2f182a5ce7523b86972dc2799861a88e9d99741`
- Base/Execution target: `761310260d1188d836326fadbdd7bdc7616de05c`
- Status: failed / incomplete
- Availability: partially unavailable; 15 candidate cases hit `ERR_CONNECTION_REFUSED`
- Blocks: task-test-8.2 and parent task-test-8 only; independent tasks continue

## Attempts

1. Baseline focused run stopped after repeated resource-entry failures: exit 130, 8 failed, 1 interrupted, 23 did not run.
2. Candidate focused run: exit 1, 11 passed, 21 failed. Fifteen failures were runner connection refusals; six were stale/test-owned.
3. `git diff --check`: exit 0.

## Unmet acceptance and classification

- `advanced-resource-filter` 3.17: stale test action/locale anchor.
- `resource-pie` 3.1–3.4: stale uppercase sector identity.
- `resource-pie` 3.5: stale hidden resource-entry locator.
- Fifteen other candidate cases: unavailable runner (`ERR_CONNECTION_REFUSED`), with no user action or product oracle reached.

The candidate has not demonstrated the complete focused suite. It remains retained and is not marked passed. No product-owned failure is established by this run.

## Recovery conditions

Restore a stable preview/runner, then rerun the exact task-test-8.2 focused command with Chromium, one worker, retries 0, trace on. Correct only owned stale/test-owned anchors, preserve the independent expected resource sets and all valid coverage, and rerun `git diff --check`. Acceptance requires all effective tests to pass with no skipped tests. If a stable run demonstrates a product defect, return it through the task-test-8 target-mediated route; if the runner fails again, retain its exact error and keep the task incomplete.

## Evidence

- `tests/e2e/map/migration-task-test-8.2.md`
- integrate `test-results/**/trace.zip` and `error-context.md`
- retained branch `workflow/unified-test-repair-retained-task-test-8-2`
