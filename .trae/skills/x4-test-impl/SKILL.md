---
name: x4-test-impl
description: "Implement and supplement Unit/E2E test code for X4 Station Calculator. Trigger with /x4:test-impl <change-name>."
metadata:
  version: "2.0"
---

# X4 Test Implementation

This skill focuses on implementing test code and can run in parallel with code implementation. It is not a mandatory gate before `/x4:test` and does not write pass/fail results.

## 1. TEST FILE NAMING CONVENTION (MANDATORY)

Test files MUST follow this naming pattern:

| Test Type | File Pattern | Example |
|-----------|--------------|---------|
| Unit Tests | `<change-name>.spec.test` | `ship-build-stat.spec.test` |
| E2E Tests | `<change-name>.spec.test` | `ship-build-stat.spec.test` |
| Bug Reproduction | `bug-<change-name>.spec.test` | `bug-ship-build-stat.spec.test` |
| Bug Fix Tests | `bugfix-<change-name>.spec.test` | `bugfix-ship-build-stat.spec.test` |

**Directory Structure:**
```
tests/
├── unit/
│   └── <change-name>/
│       └── <change-name>.spec.test
├── e2e/
│   └── <change-name>/
│       ├── <change-name>.spec.test          # E2E scenarios
│       ├── bug-<change-name>.spec.test       # Bug reproduction
│       └── bugfix-<change-name>.spec.test    # Bug fix verification
```

## 2. STRICT PATH RESOLUTION (MANDATORY)

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

## 5. TEST CASE CORRESPONDENCE VALIDATION (MANDATORY)

Every test case in test files MUST correspond to a test item in `test_tasks.md`:

### Correspondence Rules:

1. **Chapter 1 (单元测试)** → Unit test file `<change-name>.spec.test`
   - Each `### <Test Name>` in Chapter 1 MUST have a corresponding test case
   - Test case name format: `describe('<Test Name>')` or `it('<Test Name>')`

2. **Chapter 2 (E2E 标准状态与状态迁移)** → E2E test file `<change-name>.spec.test`
   - Each `### 状态: <id>` in Chapter 2 MUST have a corresponding test case
   - Each `### 切换: <from> -> <to>` in Chapter 2 MUST have a corresponding test case

3. **Chapter 3 (E2E 测试场景)** → E2E test file `<change-name>.spec.test`
   - Each `### <Test Scenario Name>` in Chapter 3 MUST have a corresponding test case

4. **Chapter 4 (Bug 测试)** → Bug test files
   - Bug reproduction: `bug-<change-name>.spec.test`
   - Bug fix verification: `bugfix-<change-name>.spec.test`
   - Each `### BUG-<id> <Description>` in Chapter 4 MUST have corresponding test cases in both files

### Validation Script

Run the validation script to verify correspondence:

```bash
# By change name
python3 skill-scripts/validate_test_case_refs.py <change-name>

# By file paths
python3 skill-scripts/validate_test_case_refs.py --change <change-name> --test-dir tests

# Exit code 0 = pass, 1 = fail with report
```

### Error Examples:

- ❌ Test case "档位默认状态" exists but no corresponding `### 档位默认状态` in Chapter 1
- ❌ Chapter 2 has `### 状态: empty-ship-build` but no test case for it
- ❌ Chapter 4 has `### BUG-001` but no corresponding test in `bug-<change-name>.spec.test` or `bugfix-<change-name>.spec.test`

## 6. GUARDRAILS

- DO NOT run `npm run build` or `npx playwright test`.
- DO NOT run full test execution for verification pass/fail.
- DO NOT write pass/fail markers to `test_tasks.md`.