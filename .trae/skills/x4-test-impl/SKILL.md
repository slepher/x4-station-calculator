---
name: x4-test-impl
description: "Implement and supplement Unit/E2E test code for X4 Station Calculator. Trigger with /x4:test-impl <change-name>."
metadata:
  version: "1.2"
---

# X4 Test Implementation

This skill only implements test code.
It does not execute test commands and does not write pass/fail results.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules

## Steps (MANDATORY)

1. Resolve target change using `x4-user-workflow` change resolver.
2. Read:
   - `openspec/changes/<change-name>/test_tasks.md`
   - `openspec/changes/<change-name>/ui_knowledge.md` (for E2E)
   - `openspec/test_experience.md`
3. Inspect existing tests:
   - `tests/unit/<change-name>/*.spec.ts`
   - `tests/e2e/<change-name>/*.spec.ts`
4. Apply 1:1 mapping from `test_tasks.md` to test cases:
   - create missing files if needed
   - add missing test cases only
   - keep existing passing structure unchanged unless required
5. Ensure standards:
   - Unit: Vitest + Pinia setup patterns
   - E2E: use project `test-setup`, prefer locators from `ui_knowledge.md`
   - Drag-and-drop cases: follow `x4-drag-test` conventions
   - Assertion quality (MANDATORY):
     - Do not use low-information pass/fail flags such as `let success = false` as the primary assertion target.
     - Assert concrete observable state directly (e.g., final DOM order, item IDs, counts, positions).
     - For retry-based interactions (especially drag-and-drop), capture per-attempt diagnostics in assertion messages:
       - observed order snapshots (prefer stable ids like `data-*` ids)
       - position snapshots when relevant (e.g., x/y centers)
     - Avoid index-drift interactions during retries:
       - prefer stable identity locators (`data-station-id`, `data-testid`, etc.) over `nth()` when source/target can move.
6. Run syntax/type validation using:
   - `npx tsc -p tsconfig.test-check.json --noEmit`
7. If syntax/type errors are found, fix test code and rerun the same command until clean or explicit blocker.
8. Return implementation summary:
   - added/updated files
   - mapped items count (done/total)
   - remaining unmapped items (if any)
   - syntax validation status

## Guardrails

- Do not run `npm run build`.
- Do not run full test execution for verification pass/fail in this skill.
- Syntax/type validation for changed test files is required and allowed.
- Do not run `npx playwright test`.
- Do not write pass/fail markers to `test_tasks.md`.
- Do not treat this skill as verification completion.
