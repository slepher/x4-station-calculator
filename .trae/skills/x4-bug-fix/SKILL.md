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

Phase isolation:
- This skill must run only when the explicit command is `/x4:bug-fix`.
- If current invocation is `/x4:bug`, do not execute any step in this skill; return handoff instruction only.

## Target Resolution (MANDATORY)

1. Use the already-resolved `change-name` from the resolver.
2. If no trailing bug text is provided, target the latest unfinished canonical
   Unit or active E2E bug case for the resolved change.
3. If trailing bug text is provided:
   - if the bug already exists, use existing bug id
   - if no matching bug exists, first route to `/x4:bug` to register bug in `bugs.md`
   - if browser reproduction docs are missing/stale, route to `/x4:e2e-test`

## Scope Limitation Principle (fix-local)

- Only modify code and docs required to fix the target bug.
- Do not broaden refactors outside bug impact area.
- Do not directly edit active E2E planning artifacts in this skill.
- For browser documentation updates, route to `/x4:e2e-test`.

## Single Source Rule (MANDATORY)

- Execution/closure decisions MUST be based on the selected canonical Unit or
  active E2E case and its test outcome.
- `bugs.md` status is reference metadata only; do not use it as behavior gate.

## Workflow (MANDATORY)

1. **Resolve bug-case pair**:
   - locate target bug in `bugs.md` and its corresponding canonical Unit or active E2E case
   - keep Unit reproduction in `tests/unit/**`
   - route browser reproduction through `/x4:e2e-test` in `tests/e2e/**`
2. **Write reproduction test (MANDATORY)** at the selected Unit or active E2E boundary.
3. Run reproduction test (**evidence-only**, no result-apply):
   - For browser cases, hand off reproduction execution to `/x4:e2e-test` and consume its evidence.
   - Reproduction file MUST assert `修复前` expectations only; if it asserts `修复后`, treat test as invalid and fix test first
   - This step is for existence confirmation only; do **not** apply legacy checklist updates
   - Test passes → bug exists (reproduced), NOT "already fixed" → Continue to step 6
   - Test fails → bug not reproduced → validate reproduction quality first; if reproduction is valid and still not reproduced, report as Rejected
4. If reproduction test fails, only fix selector/wait/fixture defects and rerun. Do not rewrite `bug-*.spec.ts` into `修复后` assertions.
   - If rerun passes, continue to step 6
   - If rerun still fails with valid reproduction, continue to step 5
5. **Rejected path (false positive)**: When reporting as `Rejected`, stop the fix loop:
   - keep `bug-*.spec.ts` as `修复前` route semantics
   - do not move `修复后` assertions into bug route (`修复后` belongs to `bugfix-*.spec.ts`)
   - do not mark Chapter 4 checklist items as completed for this rejected bug
   - rejected decision requires explicit evidence from reproduction validation in the **current run** (historical docs alone are insufficient)
   - record executed test command and observed result in bug note when setting `Rejected`
   - update `bugs.md` status to `Rejected` and record concise rejection evidence
6. Update `bugs.md` status note to `Confirmed` (reference only, non-gating) and implement fix in source code.
7. **Pre-browser build rule (MANDATORY)**: If source code changed and the
   selected boundary is browser, execute `npm run build` before verification.
8. Run fix verification at the selected Unit or active E2E boundary:
   - For browser cases, use `/x4:e2e-test` and consume its canonical result.
   - Test passes → bug fixed → Continue to step 9
   - Test fails → fix failed → Return to step 6
9. Update `bugs.md` status note to `Fixed` (reference only, non-gating).
10. Record the canonical Unit or active E2E evidence in the bug note.
11. Update `bugs.md` status note to `Verified` (reference only, non-gating).

## Sync Recovery Subflow (MANDATORY)

When the selected canonical evidence fails:

1. Ensure the selected Unit or active E2E case covers `修复前`.
2. Ensure its fix verification covers `修复后`.
3. Rerun the selected canonical verification; only when clean, update status in `bugs.md`.

## Status Labels (Reference Only)

```text
New -> Confirmed -> Fixed -> Verified
  \-> Rejected (if not a real bug)
```

## Constraints

- **MANDATORY**: Must write reproduction test BEFORE fixing code. No code changes allowed until test confirms bug is reproducible.
- **MANDATORY**: Must run selected canonical Unit or active E2E verification before considering bug closure complete.
- **MANDATORY**: No status transition (`Confirmed`/`Fixed`/`Verified`/`Rejected`) without at least one relevant test execution in the current run.
- **MANDATORY**: If test execution is blocked (env/infra/permission), STOP and report blocked; do not close bug status.
- Reproduction phase (step 3) is evidence-only and must not mark Bug/Bug-fix checklist items as completed.
- Unit and active E2E results are evidence; no legacy `test_tasks.md` apply flow is required.
- Never manually toggle checklist completion states to satisfy sync checks.
- Reproduction-pass means "bug reproduced", not "bug fixed".
- Rejected bugs must not be converted into `修复后` bug-route tests and must not be completion-applied.
- Do not skip reproduction-before-fix or reproduction-after-fix.
- In preview/dist Playwright mode, never run fix verification E2E after code changes without refreshing artifacts using `npm run build`.
- Keep bug docs and test docs synchronized with actual fix status.
- Keep changes scoped to the current change unless user requests separate change extraction.
- Keep canonical Unit or active E2E evidence as execution source of truth; `bugs.md` status is reference metadata only.

## Output (MANDATORY)

- Must include executed test command(s) and concise pass/fail outcome for this run.
- If no test command was executed in this run, output must be `BLOCKED` and bug status must remain unchanged.
