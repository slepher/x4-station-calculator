# task-test-12 failure report 1

- Task: `task-test-12.1`
- Base: `761310260d1188d836326fadbdd7bdc7616de05c`
- Candidate: none
- Status: incomplete
- Availability: baseline runner available; candidate stopped after over-deletion risk
- Blocks: task-test-12.1 and parent task-test-12 only; independent tasks continue

## Evidence

The baseline focused command exited 0 with 21/21 tests passed. During migration the worker temporarily deleted about 361 lines from `build-plan-goal.spec.ts`; dispatcher stopped the work and the file was restored. Candidate focused, list, build, and `git diff --check` were not run. No product or test failure can be classified from the unchanged baseline.

## Unmet acceptance

No current fixture/locator/assertion migration was completed. The owned OpenSpec E2E task chapters were not updated. The task remains unfinished and no pass claim is made.

## Recovery

Resume with all original valid scenarios intact. Make the smallest owned test and E2E task-document changes needed for current accepted behavior, then run the exact focused command, list, build, and diff checks. Preserve independent expected values and UI actions; do not use smoke-test replacement or weaken assertions.
