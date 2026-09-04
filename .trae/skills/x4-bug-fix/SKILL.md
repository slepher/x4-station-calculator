---
name: x4-bug-fix
description: "Fix a tracked X4 bug with current-run Unit or E2E reproduction and verification evidence. Trigger with /x4:bug-fix."
---

# X4 Bug Fix Workflow

This skill owns `/x4:bug-fix`. It keeps reproduction, implementation, and verification in the workflow that owns the affected boundary.

## Input

- `change-name`, resolved with `x4-user-workflow`
- an existing bug in `openspec/changes/<change-name>/bugs.md`

## Workflow

1. Resolve the bug and classify its smallest observable boundary:
   - Unit boundary: route task documentation to `/x4:doc`, then implement source and `tests/unit/**` together through `/x4:apply`.
   - Browser-only boundary: route documentation and Playwright work through `x4-e2e-test`.
2. Before changing source, run the focused reproduction and keep its current-run failure evidence.
3. Implement the smallest in-scope fix through `/x4:apply`.
4. Rerun the same focused Unit test. If browser verification is required, run the change-scoped `x4:e2e-test-run` path after a fresh build.
5. Update the bug status only from current-run evidence:
   - reproducible before fix -> `Confirmed`
   - owning verification passes after fix -> `Fixed`
   - required Unit and E2E verification pass -> `Verified`
   - a valid reproduction cannot reproduce the report -> `Rejected`

## Boundaries

- Do not use legacy `test_tasks.md`, `x4-test-*`, or `verify_bug_sync.py` as an execution or closure gate.
- Do not manually change Unit or E2E task completion to manufacture a pass.
- Do not run E2E from `/x4:apply`; use `x4:e2e-test-run`.
- If verification is blocked by environment or permission, report `BLOCKED` and keep the bug status unchanged.
- Keep the fix local to the tracked bug. Record unrelated findings separately.

## Output

- Resolved change and bug ID.
- Chosen Unit and/or E2E verification owner.
- Commands run and concise before/after results.
- Final bug status or blocker.
