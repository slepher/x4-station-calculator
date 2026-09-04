---
name: x4-apply
description: "Implement an X4 change with its focused Unit tests. Trigger with /x4:apply and a change name."
metadata:
  version: "1.0"
---

# X4 Apply

This skill is the single implementation entry for `/x4:apply`.
It extends `openspec-apply-change` with X4-specific bug discipline.
It owns implementation and the focused Unit tests that protect each behavior-changing task. It must not execute E2E tests or full test suite runs.

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
3. For each behavior-changing task, add or update the smallest focused Unit test under `tests/unit/**` and run that file before marking the task complete.
   - Use RED -> GREEN -> REFACTOR when a meaningful pre-change failure can be demonstrated.
   - For pure refactors, first prove the focused Unit test passes, refactor, then prove it still passes.
   - Documentation-only or mechanically test-neutral tasks may state why no Unit change is needed.
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
- Focused Unit tests (individual files via `npm run test:unit -- tests/unit/...`) are required for behavior-changing apply tasks.

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
- Focused Unit authoring and execution (`npm run test:unit -- tests/unit/<path>`) belong to apply.
- Do NOT run E2E tests (`playwright`, `npm run test:e2e`) or full unit test suites during apply.
- E2E planning, implementation, and execution belong to the canonical
  `x4-e2e-test` orchestrator; do not duplicate its phase routing here.

## Constraints

- Zero-Contamination Principle (apply-local):
  - do not rewrite non-target logic
  - do not add/remove comments unless explicitly requested
  - do not reformat unrelated code
- Do not execute full test suites (`npm run test:unit` without path, `npm run test:e2e`) or `playwright` in `/x4:apply`.
- Focused Unit tests are required for behavior changes: `npm run test:unit -- tests/unit/<specific-file>`.

## Output

- Implemented code changes.
- Added or updated focused Unit tests under `tests/unit/**`, or an explicit test-neutral reason.
- Updated `openspec/changes/<change-name>/tasks.md`.
- Updated `bugs.md` when bug workflow was triggered.
