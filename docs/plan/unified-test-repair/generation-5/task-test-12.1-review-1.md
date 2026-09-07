# task-test-12.1 review-1

- Base: `761310260d1188d836326fadbdd7bdc7616de05c`
- Candidate: none
- Verdict: `cannot_resolve`
- Target merge: none

The baseline focused suite passed 21/21, but the candidate migration was not run. A temporary attempt removed approximately 361 lines from the E2E spec; it was stopped and the owned file was restored. No candidate, test task update, or validation checkpoint exists. The baseline pass is not migration completion.

Recovery requires a bounded migration that preserves all valid scenarios, updates only the E2E chapters of the owned `test_tasks.md`, then runs focused, list, build, and diff checks. Do not replace the existing suite with a smoke test.
