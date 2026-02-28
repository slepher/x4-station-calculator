---
name: x4-test
description: "Execute tests, triage failures, and sync documents. Mandatorily delegates all test authoring/fixing to x4-test-impl."
metadata:
  version: "5.2"
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

## 4. Document Synchronization
Update documents based STRICTLY on the final run results.

### 4.1 Checkbox State Format

Use the following format in `test_tasks.md`:
- **Pass** → `[✓]`
- **Fail** → `[✗]`
- **Pending** → `[ ]`

### 4.2 Checkbox State Management Rules

The following rules define how checkbox states should be updated in `test_tasks.md`:

| Chapter | Test Type | Checkbox Ownership | Rule |
|---------|-----------|-------------------|------|
| 1 单元测试 | Unit tests | Unit test execution | Pass → `[✓]`, Fail → `[✗]` |
| 2 状态 | State tests | State tests only | Pass → `[✓]`, Fail → `[✗]` |
| 2 切换 | Transition tests | Transition tests only | Pass → `[✓]`, Fail → `[✗]` |
| 3 E2E测试场景 | Scenario tests | Scenario tests only | Pass → `[✓]`, Fail → `[✗]` |
| 4 Bug测试 | Bug tests | Bug tests only | Pass → `[✓]`, Fail → `[✗]` |

**Checkbox Ownership Constraints**:
- `状态：` checkboxes are ONLY ticked by state tests in Chapter 2
- `切换：` checkboxes are ONLY ticked by transition tests in Chapter 2
- Scenario tests (Chapter 3) do NOT backfill state/transition checkboxes
- State/transition tests do NOT backfill scenario checkboxes

### 4.3 Checkbox Update Rules

1. **After each test run**, update `test_tasks.md`:
   - Pass → Mark as `[✓]`
   - Fail → Mark as `[✗]`

2. **Chapter 5 Failure Lessons**:
   - For each failed test, add/update entry in Chapter 5
   - Format:
     ```markdown
     - [ ] <test-id>
         - [ ] <lesson/推断>
     ```

3. **Never backfill**:
   - Do NOT mark a test as passed if it wasn't executed
   - Do NOT use scenario test results to mark state/transition tests (or vice versa)

### 4.4 test_experience.md & ui_knowledge.md

- **`test_experience.md`**: Append any new locator discoveries or updates
- **`ui_knowledge.md`**: Append any new UI knowledge or updates

## 5. Test Results Validation (MANDATORY)

After test execution, you MUST validate that `test_tasks.md` has been correctly updated using the validation script:

### Validation Script Usage

```bash
# Full run - all tests executed
python3 skill-scripts/validate_test_results.py <change-name> --passed <n> --failed <n> --failures "<failure1>,<failure2>,..."

# Partial run - only some tests executed
python3 skill-scripts/validate_test_results.py <change-name> --passed <n> --failed <n> --failures "<failure1>,<failure2>,..." --executed "1.1,1.2,2.1,3.1"
```

### What the Validation Script Checks

1. **Checkbox Count Match**:
   - Number of `[x]` (checked) tasks matches `--passed` count
   - Number of `[ ]` (unchecked) tasks matches `--failed` count

2. **Failed Test Status**:
   - All failed test IDs are unchecked `[ ]` in test_tasks.md

3. **Chapter 5 Validation** (失败原因及可能的推断):
   - Each failed test ID has a corresponding lesson entry in Chapter 5
   - Lessons are not empty (contain actual content)

4. **Partial Run Support**:
   - If `--executed` is provided, only validates the executed tests
   - Useful for validating incremental test runs

### Validation Workflow

1. Run tests and collect pass/fail results
2. Update test_tasks.md checkbox states based on results
3. Add failure lessons to Chapter 5 for any failed tests
4. Run validation script to verify correctness:
   ```bash
   python3 skill-scripts/validate_test_results.py <change-name> \
     --passed <passed-count> \
     --failed <failed-count> \
     --failures "<failure-id-1>,<failure-id-2>,..."
   ```
5. **If validation FAILS**:
   - Print error message showing what needs to be fixed
   - Update test_tasks.md to fix the issues:
     - Mark passed tests as `[x]`
     - Mark failed tests as `[ ]`
     - Add failure lessons to Chapter 5
   - Re-run validation script until it passes

**IMPORTANT**: The validation script is the source of truth. If it reports mismatches, you MUST fix test_tasks.md accordingly and re-run. Do not ignore validation failures.

## 6. Final Output
Return a single execution summary: Pass/Fail counts, failed cases with Triage classification (Product Defect blockers), validation status, and a list of synced files. Do not terminate early after doc sync.
