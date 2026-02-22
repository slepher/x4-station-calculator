---
name: x4-bug-fix
description: "Fix and verify tracked bugs for X4 project. Invoke /x4:bug-fix to execute reproduction, fix, and verification workflow."
---

# X4 Bug Fix Workflow

This skill owns `/x4:bug-fix`.
It executes the full fix loop for an existing or newly provided bug target.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules
- `bug-description` (optional quick target text)

## Trigger

- `/x4:bug-fix [change-name] [bug-description(optional)]`
- User asks to fix a tracked bug

## Target Resolution (MANDATORY)

1. Resolve change using `x4-user-workflow` rules.
2. If no trailing bug text is provided, target the latest open bug in `bugs.md`.
3. If trailing bug text is provided:
   - register/update this bug in `bugs.md` (status at least `New`)
   - add/update reproduction item in `test_tasks.md`
   - sync `ui_knowledge.md` when reproduction is Web Integration

## Scope Limitation Principle (fix-local)

- Only modify code and docs required to fix the target bug.
- Do not broaden refactors outside bug impact area.
- In `ui_knowledge.md`, only add elements/actions required by the new reproduction task.
- Do not document unrelated UI elements.

## Workflow (MANDATORY)

1. Locate/confirm target bug in `bugs.md`.
2. Ensure reproduction task exists in `test_tasks.md` (and `ui_knowledge.md` for Web Integration).
3. Run reproduction test:
   - `npm run test:unit` for unit reproduction
   - `npx playwright test` for E2E reproduction
4. If reproduction fails as expected, set status to `Confirmed`.
5. Implement fix in source code.
6. Pre-E2E build rule (MANDATORY when Playwright uses preview/dist):
   - if source code changed in this run, execute `npm run build` before any `npx playwright test` command.
   - do not run Playwright against stale `dist` artifacts.
7. Set bug status to `Fixed`.
8. Rerun reproduction test.
9. If reproduction passes, set bug status to `Verified`; otherwise continue fixing.

## Status Transitions

```text
New -> Confirmed -> Fixed -> Verified
  \-> Rejected (if not a real bug)
```

## Constraints

- Do not skip reproduction-before-fix or reproduction-after-fix.
- In preview/dist Playwright mode, never run E2E before refreshing artifacts with `npm run build` after code changes.
- Keep bug docs and test docs synchronized with actual fix status.
- Keep changes scoped to the current change unless user requests separate change extraction.
