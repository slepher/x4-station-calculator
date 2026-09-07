# task-test-8.3 failure report 1

- Task: `task-test-8.3`
- Candidate: `98dc4532f75143077d0dae2d0b2f91ae60de88cf`
- Base/Execution target: `761310260d1188d836326fadbdd7bdc7616de05c`
- Status: failed / incomplete
- Availability: partially unavailable; 13 candidate cases hit `ERR_CONNECTION_REFUSED`
- Blocks: task-test-8.3 and parent task-test-8 only; independent tasks continue

## Attempts

1. Baseline focused run: 20 tests, 2 passed, 18 failed, exit 1; fixed polygon totals expected 173/88 but current observed totals were 325/164.
2. Candidate focused run: 20 tests, 2 passed, 18 failed, exit 1. Thirteen cases were runner unavailable, four had unresolved `Cluster_408_macro` oracles, and one timed out on `map-station-entry-button`.
3. `git diff --check`: exit 0 after the candidate was frozen.

## Unmet acceptance

- Candidate does not pass the focused suite.
- Current accepted visible DLC cluster/sector identity is unresolved for four cases.
- Current station-search/resource-entry action is unresolved for one case.
- Runner stability is unresolved for thirteen cases.

The task remains unfinished. Its original task, migration checkpoint, traces, and failure evidence are retained; no skip or pass waiver is applied. No product-owned failure has been proven.

## Recovery conditions

Start a fresh stable preview runner, confirm the accepted map-DLC visible cluster/sector and station-search oracles, then rerun the exact task-test-8.3 focused command with Chromium, one worker, retries 0, trace on, followed by `git diff --check`. Reclassify each failure from fresh evidence. Product changes require the task-test-8 target-mediated route; runner errors remain unavailable with exact logs.

## Evidence

- `tests/e2e/map/migration-task-test-8.3.md`
- integrate `test-results/map-map-dlc-*/`
- retained branch `workflow/unified-test-repair-retained-task-test-8-3`
