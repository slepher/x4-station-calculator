---
name: x4-bug-fix
description: "Fix and verify tracked bugs for X4 project. Invoke /x4:bug-fix to execute reproduction, fix, and verification workflow."
---

# X4 Bug Fix Workflow

This skill owns `/x4:bug-fix`.
It executes the fix loop for a tracked bug target.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules
- `bug-description` (optional quick target text)

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Trigger

- `/x4:bug-fix [change-name] [bug-description(optional)]`
- User asks to fix a tracked bug

## Target Resolution (MANDATORY)

1. Use the already-resolved `change-name` from the resolver.
2. If no trailing bug text is provided, target the latest open bug in `bugs.md`.
3. If trailing bug text is provided:
   - if the bug already exists, use existing bug id
   - if no matching bug exists, first route to `/x4:bug` to register bug in `bugs.md`
   - if reproduction docs are missing/stale, route to `/x4:test-doc` for doc updates

## Scope Limitation Principle (fix-local)

- Only modify code and docs required to fix the target bug.
- Do not broaden refactors outside bug impact area.
- Do not directly edit `test_tasks.md` / `ui_knowledge.md` in this skill.
- For documentation updates, delegate to `/x4:test-doc`.

## Workflow (MANDATORY)

1. Locate/confirm target bug in `bugs.md`.
2. Ensure reproduction docs are ready (delegate to `/x4:test-doc` when needed).
3. Run reproduction and verification through `/x4:test-run`.
4. If reproduction fails as expected, set status to `Confirmed`.
5. Implement fix in source code.
6. Pre-E2E build rule (MANDATORY when Playwright uses preview/dist):
   - if source code changed in this run, execute `npm run build` before any `npx playwright test` command.
   - do not run Playwright against stale `dist` artifacts.
7. Set bug status to `Fixed`.
8. Rerun bug-targeted verification through `/x4:test-run`.
9. If reproduction/verification passes, set bug status to `Verified`; otherwise continue fixing.

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
- Keep `bugs.md` as status source of truth; avoid duplicating bug state transitions in test docs.
