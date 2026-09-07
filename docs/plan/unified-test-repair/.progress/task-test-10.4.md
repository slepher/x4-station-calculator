# task-test-10.4

Status: cannot_resolve

Subtask: generation-5 unified-test-repair / task-test-10.4
Workspace: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
Owned paths: `tests/e2e/ship/ship-build-material.spec.ts`, `tests/e2e/ship/ship-build-stat.spec.ts`, `tests/e2e/ship/metric-panel-ui.spec.ts`, `tests/e2e/ship/bugfix-ship-status-diff.spec.ts`, `tests/e2e/ship/migration-task-test-10.4.md`

## Baseline

- HEAD: `761310260d1188d836326fadbdd7bdc7616de05c`
- Runner: Playwright `npm exec playwright test`; configured reporter `list`
- Browser/project: `chromium`
- Collection: `Running 62 tests using 1 worker`
- Command:
  `PORT=21556 npm exec playwright test -- tests/e2e/ship/ship-build-material.spec.ts tests/e2e/ship/ship-build-stat.spec.ts tests/e2e/ship/metric-panel-ui.spec.ts tests/e2e/ship/bugfix-ship-status-diff.spec.ts --project=chromium --workers=1 --retries=0 --reporter=list`
- Port check: no listener was established by the preflight check; baseline started on 21556.
- Observed results before interruption: tests 1 through 46 were reported failed, including the first bugfix test, all metric-panel tests, and ship-build-material tests through test 46. The failures completed in approximately 2–6 ms each, indicating setup failure before scenario actions.
- The baseline process was interrupted by the user while output for test 46/62 was being collected. Exit code and complete per-test result set are unavailable.

## Attempts and obstruction

1. Read the required complete role protocol successfully.
2. Confirmed the requested HEAD.
3. Started the corrected four-spec baseline command with the required port, browser, worker, retry, and reporter settings.
4. The run was interrupted before completion, so the required complete baseline record cannot be produced.

## Unmet acceptance

- Complete baseline SHA/runner/browser/collection and per-test result record: incomplete because the run was interrupted.
- Accepted-spec migration document was not updated.
- No test migration was performed.
- Focused trace run, `--list` run, production build, and `git diff --check` were not run.
- No valid-use-case pass gate was reached; task cannot be marked done.

## Recovery conditions

Resume from the unchanged HEAD and workspace state, rerun the baseline to completion on port 21556, diagnose the common setup failure within the owned test paths, then write the scenario-to-rule mapping and perform the minimum migration. Run the required focused command, list command, build, and diff check; mark done only if every valid case passes.

## Changes

Only this progress evidence file was written. No commit was created.
