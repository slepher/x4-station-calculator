---
name: x4-test
description: "Execute Unit tests (Vitest) and E2E tests (Playwright) for X4 Station Calculator, then sync test documents."
metadata:
  version: "4.10"
---

# X4 Test Execution

This skill executes tests, may fix test code when needed, and synchronizes test documents.
`x4-test-impl` remains available as a parallel implementation track, not a hard prerequisite.

## Execution Model (MANDATORY)

1. `/x4:test` is self-sufficient and owns end-to-end completion for the test phase.
2. If tests are missing, outdated, or failing due to test-code issues, `/x4:test` MUST directly implement/fix tests in the same run.
3. Treat `x4-test-impl` as an optional parallel acceleration track only.
4. `/x4:test` MUST NOT wait for a separate `/x4:test-impl` run before proceeding.
5. For any failure, `/x4:test` MUST triage in order:
   - first determine whether it is a test defect;
   - only if not a test defect, classify as product defect/blocker.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules

## Steps (MANDATORY)

1. Resolve target change using `x4-user-workflow` change resolver.
2. Read `openspec/changes/<change-name>/test_tasks.md`.
3. Read `openspec/changes/<change-name>/ui_knowledge.md` for state semantics/probes and state-switch actions.
   - if missing, stop and report documentation blocker (must be produced by `/x4:doc`).
4. Enforce E2E chapter split in `test_tasks.md`:
   - chapter A = 启动与数据预置 + 初始状态 + 状态切换
   - chapter B = 业务测试内容
5. Verify test files exist:
   - `tests/unit/<change-name>/*.spec.ts`
   - `tests/e2e/<change-name>/*.spec.ts`
6. If required test cases are missing or existing tests fail:
   - triage failure cause first: test defect vs product defect
   - if test defect, continue with inline test authoring/fix
   - if product defect, do not patch source code in this skill; record blocker and continue remaining runnable cases
7. If triage result is test defect:
   - run `x4-test-impl` authoring logic inline in this skill (write/fix tests immediately)
   - continue execution instead of stopping
   - keep changes scoped to current change requirements
8. Pre-E2E build rule (MANDATORY when Playwright uses preview/dist):
   - if source code changed in this run, execute `npm run build` before any `npx playwright test` command.
   - do not run Playwright against stale `dist` artifacts.
9. Run change-scoped test commands:
   - if state chapter exists, run state-focused cases first (title prefix `状态：`)
   - then run state-transition cases (title prefix `切换：`)
   - then run remaining scenario cases (align to Scenario Content chapter)
   - command examples:
     - `npx vitest run tests/unit/<change-name> -t "状态："`
     - `npx playwright test tests/e2e/<change-name> -g "状态："`
     - `npx vitest run tests/unit/<change-name> -t "切换："`
     - `npx playwright test tests/e2e/<change-name> -g "切换："`
     - followed by full change-scoped run:
       - `npx vitest run tests/unit/<change-name>`
       - `npx playwright test tests/e2e/<change-name>`
10. Sync test results to documents:
   - update `test_tasks.md` (`[x]` for pass, `<!-- FAILED: reason -->` for fail)
   - update `openspec/test_experience.md` for locator discoveries
   - update `ui_knowledge.md` for locator updates
11. Return execution summary: pass/fail counts, failed cases, triage classification (test defect vs product defect), blockers, and any test-code changes made during this run.

## State + Transition Gate (MANDATORY)

Use this gate whenever `test_tasks.md` defines reusable states.

1. Simplified model:
   - do not use recursive dependency loading or implicit state validity inference.
   - use explicit, executable state-switch steps only.
2. Required checklist types:
   - state items: validate a single state (`状态：<id>`).
   - transition items: validate a single switch path (`切换：<from>-><to>`).
   - transition scope is minimal-required only: include only switch paths consumed by scenario tests; do not require all state-pair transitions.
3. Required run order:
   - run all `状态：` cases first
   - then all `切换：` cases
   - then scenario cases
4. Checkbox ownership (source of truth; do not duplicate in `test_tasks.md` as meta checklist):
   - state item `[x]` only by its `状态：` case pass.
   - transition item `[x]` only by its `切换：` case pass.
   - scenario item `[x]` only by scenario case pass.
5. Transition assertion contract:
   - each transition case must assert `from` state, apply switch actions, then assert `to` state.
6. Failure handling:
   - failed state/transition keeps that item unchecked and records `<!-- FAILED: reason -->`.
   - scenario cases do not backfill state/transition checkboxes.
7. Implementation fallback:
   - if required `状态：` / `切换：` cases are missing and semantics are clear in `ui_knowledge.md`, `/x4:test` must add minimal test code inline and continue.
   - do not stop waiting for `/x4:test-impl`.

## Scope Rules

- Targeted execution for current change by default.
- Full regression only when explicitly requested:
  - `npm run test:unit`
  - `npm run test:e2e`

## Guardrails

- Test code updates in `tests/**/*.spec.*` are allowed in this skill when required to satisfy current change verification.
- Prefer minimal, targeted test edits over broad refactors during verification.
- In preview/dist Playwright mode, never run E2E before refreshing artifacts with `npm run build` after code changes.
- Never skip `test_tasks.md` result sync after a test run.
- Never update `test_tasks.md` without syncing `ui_knowledge.md` when locator knowledge changed.
- Do not terminate after doc sync; continue until execution report is complete.
