---
name: x4-test
description: "Execute tests, triage failures, and sync documents. Mandatorily delegates all test authoring/fixing to x4-test-impl and document updates to x4-test-doc."
metadata:
  version: "6.2"
---

# X4 Test Execution Pipeline

This skill owns the end-to-end test execution and document synchronization. It operates strictly in **Silent Execution Mode**: do not pause for recoverable steps, do not apologize, and complete all operations in a single output flow.

## 1. Boundary & Anti-Misuse Guard (MANDATORY)
- **Resolve Change**: Use `x4-user-workflow` rules to resolve `<change-name>`. Print: `Resolved change: <change-name>`.
- **Pre-check Delegation**: You MUST explicitly call/inline `x4-test-impl`'s anti-misuse guard to verify exact directory boundaries. Do not duplicate the directory guard logic here. Do not reuse or ask about similarly named directories.

## 2. Delegation to x4-test-impl (MANDATORY)
- `x4-test` MUST NOT author or fix test code directly.
- If test files (`tests/**/<change-name>/*.spec.ts`) are missing, OR if existing tests fail due to test-code defects (not product defects), you MUST mandatorily invoke `x4-test-impl` to handle directory creation, test authoring, and test fixing.
- Wait for `x4-test-impl` to apply its own Test Code Contract (state helpers & assertion rules), then resume this pipeline.

## 3. Execution Pipeline
1. **Pre-test Build**: If source code was changed, strictly execute `npm run build` before running Playwright. Never run against stale artifacts.
2. **Targeted Run Order**:
   - `npx vitest/playwright ... -t/-g "状态："` (State checks)
   - `npx vitest/playwright ... -t/-g "切换："` (Transition checks)
   - Run remaining scenario tests.
3. **Failure Triage**: Classify failures instantly.
   - *Test Defect*: Delegate to `x4-test-impl` to fix, then re-run.
   - *Product Defect*: Leave test as failed, record blocker, do not patch source code, and continue running remaining cases.

## 4. Document Synchronization (MANDATORY)

**Delegates to x4-test-doc for change-specific document updates.**

After test run completes, invoke `x4-test-doc <change-name>` to:
- Update test_tasks.md with pass/fail markers (`[✓]` / `[✗]` / `[ ]`)
- Update ui_knowledge.md with new locator discoveries
- Update Chapter 5 (失败原因及可能的推断) with failure lessons
- Remove stale records when previously failed cases now pass

**Global Experience Update:**
- If new learnings are NOT specific to the current change (general test patterns, reusable locators, framework insights), update `openspec/test_experience.md` instead.
- Change-specific learnings go to `openspec/changes/<change-name>/ui_knowledge.md`.

## 5. Final Output
Return a single execution summary: Pass/Fail counts, failed cases with Triage classification (Product Defect blockers), and a list of synced files. Do not terminate early after doc sync.
