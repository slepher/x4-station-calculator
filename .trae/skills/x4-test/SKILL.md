---
name: x4-test
description: "Execute Unit tests (Vitest) and E2E tests (Playwright) for X4 Station Calculator, then sync test documents."
metadata:
  version: "4.3"
---

# X4 Test Execution

This skill executes existing tests and synchronizes test documents.
It does not create or modify test case code. Test implementation belongs to `x4-test-impl`.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules

## Steps (MANDATORY)

1. Resolve target change using `x4-user-workflow` change resolver.
2. Read `openspec/changes/<change-name>/test_tasks.md`.
3. Verify test files exist:
   - `tests/unit/<change-name>/*.spec.ts`
   - `tests/e2e/<change-name>/*.spec.ts`
4. If required test cases are missing, stop and return:
   - missing case list
   - instruction to run `/x4:test-impl <change-name>` first
5. Run test commands:
   - `npm run test:unit`
   - `npx playwright test`
6. Sync test results to documents:
   - update `test_tasks.md` (`[x]` for pass, `<!-- FAILED: reason -->` for fail)
   - update `openspec/test_experience.md` for locator discoveries
   - update `ui_knowledge.md` for locator updates
7. Return execution summary: pass/fail counts, failed cases, and blockers.

## Scope Rules

- Targeted execution for current change by default.
- Full regression only when explicitly requested.

## Guardrails

- Do not create or modify `tests/**/*.spec.*` in this skill.
- Do not backfill missing tests in this skill.
- Never skip `test_tasks.md` result sync after a test run.
- Never update `test_tasks.md` without syncing `ui_knowledge.md` when locator knowledge changed.
- Do not terminate after doc sync; continue until execution report is complete.
