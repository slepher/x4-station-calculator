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
2. If no trailing bug text is provided, target the latest unfinished bug task in `test_tasks.md` Chapter 4.
3. If trailing bug text is provided:
   - if the bug already exists, use existing bug id
   - if no matching bug exists, first route to `/x4:bug` to register bug in `bugs.md`
   - if reproduction docs are missing/stale, route to `/x4:test-doc` for doc updates

## Scope Limitation Principle (fix-local)

- Only modify code and docs required to fix the target bug.
- Do not broaden refactors outside bug impact area.
- Do not directly edit `test_tasks.md` / `ui_knowledge.md` in this skill.
- For documentation updates, delegate to `/x4:test-doc`.

## Single Source Rule (MANDATORY)

- Execution/closure decisions MUST be based on `test_tasks.md` (Chapter 4) and test run outcomes.
- `bugs.md` status is reference metadata only; do not use it as behavior gate.

## Workflow (MANDATORY)

1. **Resolve bug-task pair**:
   - locate target bug in `bugs.md` and its corresponding Chapter 4 task in `test_tasks.md`
   - if task is missing, delegate to `/x4:test-doc` to backfill unchecked (`[ ]`) task first
2. **Write reproduction test (MANDATORY)**: Create a test in `tests/e2e/<change-name>/bug-<change-name>.spec.ts` that reproduces the bug.
3. Run reproduction test (**evidence-only**, no result-apply):
   - Execute the bug reproduction file directly (e.g., `pnpm exec playwright test tests/e2e/<change-name>/bug-<change-name>.spec.ts`)
   - Reproduction file MUST assert `修复前` expectations only; if it asserts `修复后`, treat test as invalid and fix test first
   - This step is for existence confirmation only; do **not** apply checklist updates to `test_tasks.md`
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
7. **Pre-E2E build rule (MANDATORY)**: If source code changed, execute `npm run build` before fix verification Playwright run in step 8.
8. Run fix verification test (bugfix-<change-name>.spec.ts via x4-test-run):
   - Test passes → bug fixed → Continue to step 9
   - Test fails → fix failed → Return to step 6
9. Update `bugs.md` status note to `Fixed` (reference only, non-gating).
10. **Verify bug-task sync (MANDATORY)**: Run verification script to ensure Chapter 4 task closure:
    ```bash
    python3 skill-scripts/verify_bug_sync.py <change-name> --json
    ```
    If script returns errors, route by error type before proceeding:
    - task not completed: use `/x4:test-run` apply flow; do not edit checklist states manually
    - missing/invalid test task entry: delegate to `/x4:test-doc` and backfill as unchecked (`[ ]`) tasks first, then rerun step 8 via `/x4:test-run` for result-apply
    - do not "force-pass" sync by manually toggling checklist states
    - do not directly edit `test_tasks.md` / `ui_knowledge.md` in this skill
11. Update `bugs.md` status note to `Verified` (reference only, non-gating).

## Sync Recovery Subflow (MANDATORY)

When `verify_bug_sync.py` fails:

1. Ensure Chapter 4 task exists via `/x4:test-doc` with unchecked defaults (`[ ]`).
2. Ensure both test routes exist:
   - `bug-<change-name>.spec.ts` covers `修复前`
   - `bugfix-<change-name>.spec.ts` covers `修复后`
3. Run fix verification via `/x4:test-run` (not direct manual checklist edits).
4. Re-run `verify_bug_sync.py`; only when clean, update reference status in `bugs.md`.

## Status Labels (Reference Only)

```text
New -> Confirmed -> Fixed -> Verified
  \-> Rejected (if not a real bug)
```

## Constraints

- **MANDATORY**: Must write reproduction test BEFORE fixing code. No code changes allowed until test confirms bug is reproducible.
- **MANDATORY**: Must run `verify_bug_sync.py` before considering bug closure complete.
- **MANDATORY**: No status transition (`Confirmed`/`Fixed`/`Verified`/`Rejected`) without at least one relevant test execution in the current run.
- **MANDATORY**: If test execution is blocked (env/infra/permission), STOP and report blocked; do not close bug status.
- Reproduction phase (step 3) is evidence-only and must not mark Bug/Bug-fix checklist items as completed.
- Only fix verification phase (step 8, via `/x4:test-run`) may apply test run results to `test_tasks.md`.
- Never manually toggle checklist completion states to satisfy sync checks.
- Reproduction-pass means "bug reproduced", not "bug fixed".
- Rejected bugs must not be converted into `修复后` bug-route tests and must not be completion-applied.
- Do not skip reproduction-before-fix or reproduction-after-fix.
- In preview/dist Playwright mode, never run fix verification E2E after code changes without refreshing artifacts using `npm run build`.
- Keep bug docs and test docs synchronized with actual fix status.
- Keep changes scoped to the current change unless user requests separate change extraction.
- Keep `test_tasks.md` as the execution source of truth; `bugs.md` status is reference metadata only.

## Output (MANDATORY)

- Must include executed test command(s) and concise pass/fail outcome for this run.
- If no test command was executed in this run, output must be `BLOCKED` and bug status must remain unchanged.
