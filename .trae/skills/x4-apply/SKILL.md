---
name: x4-apply
description: "Implement a change for X4 Station Calculator. Trigger with /x4:apply <change-name>."
metadata:
  version: "1.0"
---

# X4 Apply

This skill is the single implementation entry for `/x4:apply`.
It extends `openspec-apply-change` with X4-specific bug discipline.
It supports TDD (test-driven development) during apply, including running individual unit tests, but must not execute E2E tests or full test suite runs.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Steps (MANDATORY)

1. Read and follow `.trae/skills/openspec-apply-change/SKILL.md` as the base implementation workflow.
2. Read apply context files from OpenSpec instructions and implement pending items in `tasks.md`.
3. When using TDD (`/tdd` flag), follow TDD tracer-bullet loop per task:
   - RED: Write one unit test → verify it fails (`npm run test:unit -- tests/unit/<file>`)
   - GREEN: Write minimal implementation to pass
   - REFACTOR: Clean up while keeping tests green
   - Mark task complete
4. Mark each completed task immediately (`- [ ]` -> `- [x]`).
5. If a bug is found during implementation, run the bug loop below before continuing.
6. After all code modifications are complete, run build validation:
   - `npm run build`
   - if compile errors exist, fix and rerun build until pass or explicit blocker
7. Stop when all implementation tasks are done and build passes, or a blocker requires user decision.

## Bug Loop (MANDATORY when bug found)

```text
发现 Bug -> 记录到 bugs.md -> 修复 Bug（实现层）
-> 在 /x4:verify 执行验证
```

Required actions:
- Add bug record to `openspec/changes/<change-name>/bugs.md`.
- Do not run E2E tests or full test suites in `/x4:apply`; execute verification in `/x4:verify`.
- TDD unit tests (individual files via `npm run test:unit -- tests/unit/...`) are allowed during apply.

## Unrelated Bug Handling

If a discovered bug is out of current change scope:
1. Record it for later.
2. Finish current change first.
3. Create a separate change: `fix-<bug-name>`.

## Boundaries

- `/x4:apply` is implementation-focused.
- Do not treat `/x4:apply` as final full verification.
- Full build + full test + final pass/fail decision belongs to `/x4:verify`.
- `/x4:apply` runs build validation after code modifications.
- TDD cycle (`npm run test:unit -- tests/unit/<path>`) is allowed during apply for individual unit tests.
- Do NOT run E2E tests (`playwright`, `npm run test:e2e`) or full unit test suites during apply.

## Constraints

- Zero-Contamination Principle (apply-local):
  - do not rewrite non-target logic
  - do not add/remove comments unless explicitly requested
  - do not reformat unrelated code
- Do not execute full test suites (`npm run test:unit` without path, `npm run test:e2e`) or `playwright` in `/x4:apply`.
- TDD unit tests are allowed: `npm run test:unit -- tests/unit/<specific-file>`.

## Output

- Implemented code changes.
- Updated `openspec/changes/<change-name>/tasks.md`.
- Updated `bugs.md` when bug workflow was triggered.
