---
name: x4-apply
description: "Implement a change for X4 Station Calculator. Trigger with /x4:apply <change-name>."
metadata:
  version: "1.0"
---

# X4 Apply

This skill is the single implementation entry for `/x4:apply`.
It extends `openspec-apply-change` with X4-specific bug and test-task discipline.
It does not execute test cases during apply.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules

## Steps (MANDATORY)

1. Read and follow `.trae/skills/openspec-apply-change/SKILL.md` as the base implementation workflow.
2. Read apply context files from OpenSpec instructions and implement pending items in `tasks.md`.
3. Mark each completed task immediately (`- [ ]` -> `- [x]`).
4. If a bug is found during implementation, run the bug loop below before continuing.
5. After all code modifications are complete, run build validation:
   - `npm run build`
   - if compile errors exist, fix and rerun build until pass or explicit blocker
6. Stop when all implementation tasks are done and build passes, or a blocker requires user decision.

## Bug Loop (MANDATORY when bug found)

```text
发现 Bug -> 记录到 bugs.md -> 添加复现测试到 test_tasks.md
-> 修复 Bug（实现层）-> 在 /x4:verify 执行复现与回归测试
```

Required actions:
- Add bug record to `openspec/changes/<change-name>/bugs.md`.
- Add 1:1 reproduction item to `openspec/changes/<change-name>/test_tasks.md`.
- Do not run tests in `/x4:apply`; execute reproduction and regression in `/x4:verify`.

## Unrelated Bug Handling

If a discovered bug is out of current change scope:
1. Record it for later.
2. Finish current change first.
3. Create a separate change: `fix-<bug-name>`.

## Boundaries

- `/x4:apply` is implementation-focused.
- Do not treat `/x4:apply` as final full verification.
- Full build + full test + final pass/fail decision belongs to `/x4:verify`.
- `/x4:apply` runs build validation after modifications and no test commands.

## Constraints

- Zero-Contamination Principle (apply-local):
  - do not rewrite non-target logic
  - do not add/remove comments unless explicitly requested
  - do not reformat unrelated code
- If implementation introduces new test scenarios, update:
  - `openspec/changes/<change-name>/test_tasks.md`
  - `openspec/changes/<change-name>/ui_knowledge.md` (follow `x4-doc` sync rules)
- For test implementation standards, use `x4-test-impl`.
- For test execution and result sync, use `x4-test`.
- Do not execute `npm run test:*` or `playwright` in `/x4:apply`.

## Output

- Implemented code changes.
- Updated `openspec/changes/<change-name>/tasks.md`.
- Updated `bugs.md` and test artifacts when bug workflow was triggered.
