# task-test-15 failure report 2

- Task: `task-test-15.3`
- Candidate: none
- Base: `761310260d1188d836326fadbdd7bdc7616de05c`
- Status: failed / incomplete
- Availability: baseline runner started but was interrupted after four failures
- Blocks: task-test-15.3 and parent task-test-15 only; independent tasks continue

## Attempts

1. Confirmed the exact target HEAD and read the owned spec plus `build-ui-component` accepted specification.
2. Started the baseline command with Chromium, one worker, retries 0, and trace on. Six tests were collected; four failed before interruption: 2.1, 2.2, 2.3, and 2.4. Cases 3.1 and 3.2 were not observed.
3. The worker confirmed no migration document existed before the run, and no owned test/spec changes were made. No candidate was created.

## Unmet acceptance and classification

- Complete baseline diagnostics and exit code are missing.
- The current test lacks accepted build-material input/result linkage coverage.
- Focused migration run, collection check, build, and diff checks are missing.
- Classification: `incomplete/unavailable handoff`; no product defect or pass is established.

## Recovery conditions

Resume from `761310260d1188d836326fadbdd7bdc7616de05c`, finish baseline diagnostics, migrate only the owned spec and mapping document, then run focused, collection, build, and diff checks. Classify unchanged failures from complete evidence before any target merge.
