---
name: x4-test-impl
description: "Implement and supplement Unit/E2E test code for X4 Station Calculator. Trigger with /x4:test-impl <change-name>."
metadata:
  version: "1.9"
---

# X4 Test Implementation

This skill focuses on implementing test code and can run in parallel with code implementation. It is not a mandatory gate before `/x4:test` and does not write pass/fail results.

## 1. STRICT PATH RESOLUTION (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action. Stop and ask if multiple/no matches.
- Print: `Resolved change: <change-name>`.
- **DIR_VARS:** Target directories are strictly defined as:
  - `UNIT_DIR` = `tests/unit/${CHANGE_NAME}`
  - `E2E_DIR` = `tests/e2e/${CHANGE_NAME}`
- **FATAL CONSTRAINT:** NEVER read, write, or fallback to any directories outside the exact `UNIT_DIR` and `E2E_DIR`.
- **NO FUZZY MATCHING:** Substrings or similar names (e.g., `ship-build` vs `ship-build-equipment`) are strictly DIFFERENT.
- **ACTION:** If `UNIT_DIR` or `E2E_DIR` does not exist, `mkdir` them immediately. Do not ask for confirmation.

## 2. EXECUTION STEPS

1. Read requirements:
   - `openspec/changes/${CHANGE_NAME}/test_tasks.md`
   - `openspec/changes/${CHANGE_NAME}/ui_knowledge.md`
   - `openspec/test_experience.md`
2. Inspect existing tests in exact `UNIT_DIR` and `E2E_DIR`.
3. Apply 1:1 mapping from `test_tasks.md` to test cases:
   - Implement missing assertions for every unchecked verifiable checklist item (including A/B branches).
   - Keep existing passing structure unchanged.
   - Enforce E2E chapter split: `#2` -> state/transition tests; `#3` -> scenario tests.
4. Run syntax/type validation: `npx tsc -p tsconfig.test-check.json --noEmit`
5. Fix type errors and loop until clean or blocked.
6. Return summary: added/updated files, mapped items count, remaining unmapped items (with exact IDs like `2.3`), and syntax status. If 100% mapped, print: `coverage gate ready for /x4:test`.

## 3. TEST AUTHORING STANDARDS

- **Unit:** Use Vitest + Pinia setup patterns. Add `beforeEach` to load `tests/fixtures/db.json` if preloaded data is required.
- **E2E:** Use project `test-setup`, prefer locators from `ui_knowledge.md`. 
- **Assertions:** - Assert concrete observable state directly (e.g., DOM order, IDs, counts).
  - NO low-information flags (e.g., `let success = false`).
  - E2E visible checks must include positive state assertions AND explicit absence-of-error assertions.
  - Multi-plan tasks (Plan A, Plan B) require assertions repeated for each plan.
- **Drag-and-Drop:** Follow `x4-drag-test` conventions. Capture per-attempt diagnostics (order snapshots, positions). Use stable identity locators (`data-*`), avoid `nth()`.

## 4. STANDARD STATE + TRANSITION AUTHORING

When `test_tasks.md` defines reusable states, strictly implement:
1. **Helpers:** `buildStateX(...)`, `assertStateX(...)`, `switchFromXToY(...)` (apply only the transition actions).
2. **Cases:** - One `状态：<id>` case per state item (even baseline/empty states).
   - One `切换：<from>-><to>` case per transition item.
3. **Contract:** `切换：` must execute: build -> assert(from) -> switch -> assert(to).
4. **Scenarios:** Reuse helpers; avoid ad-hoc setup.
5. **Boundary:** Semantics come from `ui_knowledge.md`. If missing/ambiguous, report blocker.

## 5. GUARDRAILS

- DO NOT run `npm run build` or `npx playwright test`.
- DO NOT run full test execution for verification pass/fail.
- DO NOT write pass/fail markers to `test_tasks.md`.