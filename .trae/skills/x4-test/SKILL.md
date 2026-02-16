---
name: x4-test
description: Execute and write Unit tests (Vitest) and E2E tests (Playwright) for X4 Station Calculator.
metadata:
  version: "3.0"
---

# X4 Test Execution

This skill governs the **coding and execution** of both Unit tests (Vitest) and E2E tests (Playwright). It is invoked during the `/x4:verify` phase or whenever coding tests.

---

## 0. Test Types Overview

| Type | Framework | Location | Purpose |
|------|-----------|----------|---------|
| Unit Tests | Vitest | `tests/unit/<change-name>/` | Test pure logic, store functions, calculations |
| E2E Tests | Playwright | `tests/e2e/<change-name>/` | Test UI interactions, user flows |

**Test Directory Structure (MANDATORY)**:
```
tests/
├── test-setup.ts           # Playwright custom configuration
├── mock/
│   └── station_mock_data.json
├── unit/
│   └── CHANGE/             # Unit tests for change CHANGE
│       ├── feature-a.spec.ts
│       └── logic.spec.ts
└── e2e/
    └── CHANGE/             # E2E tests for change CHANGE
        ├── ui-flow.spec.ts
        └── integration.spec.ts
```

---

## 1. Unit Tests (Vitest)

### 1.1 Framework Stack
- **Framework**: Vitest
- **Test Location**: `tests/unit/<change-name>/`
- **Run Command**: `npm run test:unit`

### 1.2 MANDATORY Imports
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
```

### 1.3 Unit Test Patterns

**Store Testing**:
```typescript
describe('useGameDataStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('calculates volume compression rate correctly', () => {
    const store = useGameDataStore()
    // ... test logic
  })
})
```

### 1.4 Unit Test Best Practices
- **Isolation**: Each test should be independent; use `beforeEach` to reset state
- **Mocking**: Use `vi.fn()` for function mocks, `vi.mock()` for module mocks
- **No UI**: Unit tests should NOT test DOM or UI components
- **Fast**: Unit tests should complete in milliseconds

---

## 2. E2E Tests (Playwright)

### 2.1 Framework Stack
- **E2E Framework**: Playwright + Vitest
- **Test Location**: `tests/e2e/<change-name>/`
- **Mock Data**: `tests/mock/station_mock_data.json`

### 2.2 MANDATORY Imports
```typescript
import { test } from '../test-setup'; // Or relative path
import { expect } from '@playwright/test';
```
**Note**: Do NOT import `test` from `@playwright/test` directly. The custom `test-setup` handles environment configuration.

---

## 3. Test Writing Workflow

### Step 0: Check Test Files Existence (MANDATORY)
**Before proceeding**, check if test files exist for the current change:
- Unit tests: `tests/unit/<change-name>/*.spec.ts`
- E2E tests: `tests/e2e/<change-name>/*.spec.ts`

**If test files do NOT exist**:
1. Read `test_tasks.md` to understand test requirements
2. Create the test directory and files based on `test_tasks.md` items
3. Write test cases following the 1:1 mapping rule
4. Run the newly created tests
5. Update `test_tasks.md` status after test run

**If test files already exist**:
1. Read `test_tasks.md` to get the complete list of required test items
2. Read existing test files to extract current test descriptions
3. **1:1 Comparison**: Compare each `test_tasks.md` item against existing tests
4. **Identify Missing Tests**: Find items in `test_tasks.md` without corresponding test cases
5. **Supplement Missing Tests**: Add test cases for any missing items
6. Run all tests and update `test_tasks.md` status

### Step 1: Read test_tasks.md
Before writing any test, read the corresponding `test_tasks.md` from the change directory:
- Location: `openspec/changes/<change-name>/test_tasks.md`
- Understand the test requirements and expected outcomes
- Each item in `test_tasks.md` maps 1:1 to a test case

### Step 2: Check test_experience.md
**MANDATORY**: Read `openspec/test_experience.md` to find:
- Existing locators (marked with ✅)
- "定位器最佳实践" section for patterns
- "历史定位大坑" section for pitfalls to avoid

### Step 3: Write Test Code
Follow the coding standards below. Each test should map 1:1 to a `test_tasks.md` item.

### Step 4: Run and Verify
Execute tests and update documentation:
- Update `test_tasks.md` status
- Update `test_experience.md` for new locator discoveries

---

## 4. Coding Standards

### Pure UI Interactions (MANDATORY)
- Use Click, Fill, KeyPress for interactions
- **NO** `page.evaluate` for state manipulation
- **NO** direct Pinia/Vue state mutation via JS

### Store Access Rules

**Reading Store (Allowed)**:
```typescript
// ✅ Allowed: Reading store for reference
const storeValue = await page.evaluate(() => {
  return (window as any).store?.someValue;
});
```

**Writing Store (FORBIDDEN as Final Test)**:
```typescript
// ❌ NOT a valid complete test
test('bad example', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).store.addItem({ id: 1 });
  });
  // Missing: UI verification
});

// ✅ Valid test: Store setup + UI verification
test('good example', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).store.addItem({ id: 1 });
  });
  // MUST verify via UI interaction
  await expect(page.locator('.item-list .item')).toHaveCount(1);
});
```

### Timeout Limits
- **Maximum timeout for UI operations**: 500ms
- Only exceed 500ms when absolutely necessary (e.g., API calls, complex computations)

### Data Mocking
- Hardcode data from `tests/mock/station_mock_data.json` directly into test cases
- **NEVER** use `import data from '...json'`

### Performance Optimization
**Disable Animations** in `beforeEach`:
```typescript
test.beforeEach(async ({ page }) => {
  await page.addStyleTag({ 
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }' 
  });
});
```

### State Isolation
Always clear state in `beforeEach`:
```typescript
test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});
```

---

## 5. Test-Document Mapping (MANDATORY)

### 1:1 Mapping Rule
- Each `test('description', ...)` block maps **exactly 1:1** to a checklist item in `test_tasks.md`
- **NEVER** merge multiple items into one test case
- Test description should match or reference the task description

### Example Mapping

**test_tasks.md**:
```markdown
## Unit Tests
- [ ] 验证 calculateVolume 函数正确计算体积

## Web Integration Tests
- [ ] 验证新建按钮显示正确
```

**Corresponding test file**:
```typescript
// tests/unit/volume-compression/calc.spec.ts
test('验证 calculateVolume 函数正确计算体积', async () => { /* ... */ });

// tests/e2e/volume-compression/ui.spec.ts
test('验证新建按钮显示正确', async ({ page }) => { /* ... */ });
```

---

## 6. Synchronization Protocol (MANDATORY)

### After Each Test Run
**You MUST** update `test_tasks.md` immediately after running tests:

```markdown
## Web Integration Tests
- [x] 验证新建按钮显示正确
- [ ] 验证搜索功能正常 <!-- FAILED: Timeout waiting for .result-item -->
- [x] 验证模块添加成功
```

### Sync Checklist
- [ ] `test_tasks.md` status matches test results
- [ ] Failed tests have `<!-- FAILED: reason -->` comments
- [ ] Test case code matches `test_tasks.md` description

---

## 7. Locator Loop Protocol (MANDATORY)

### On Test Failure (Timeout/Element Not Found)
1. Read `openspec/test_experience.md` → Check "历史定位大坑" section
2. Try alternative locators from the knowledge base
3. If new locator works, update `test_experience.md` with:
   - Logical description (user language)
   - Correct locator path (✅)
   - Any pitfalls discovered
4. **Continue task** - do NOT terminate turn

### On Test Success (New Locator Discovered)
1. Record the successful locator to `test_experience.md`
2. Include: logical description, DOM path (✅), special data/conditions
3. **Continue task** - do NOT terminate turn

---

## 8. Execution Protocol

### Pre-Test Checklist
1. Run `npm run build` to ensure no syntax errors
2. Verify `playwright.config.ts` baseURL matches preview server
3. Check test environment: `isTestEnv` flag should be available

### Test Execution
```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/CHANGE/feature.spec.ts

# Run with headed browser (debugging)
npx playwright test --headed

# Run unit tests
npm run test:unit
```

### Scope Rules
- **Targeted Execution**: Only run tests for current `test_tasks.md` items
- **Full Regression**: Only when explicitly requested

---

## 9. Specialized Testing

### Drag Testing
For Vue drag-and-drop testing with `vuedraggable`, invoke the `x4-drag-test` skill:
```
Skill: x4-drag-test
```

---

## 10. Guardrails

- **NEVER** use `import data from '...json'`
- **NEVER** merge multiple `test_tasks.md` items into one test case
- **NEVER** skip updating `test_tasks.md` after test runs
- **NEVER** skip updating `test_experience.md` for locator discoveries
- **NEVER** use `page.evaluate` to manipulate Vue/Pinia state as the only verification
- **NEVER** exceed 500ms timeout for UI operations unless absolutely necessary
- **NEVER** terminate turn after updating documentation - continue with the task
- **NEVER** place test files outside the change-specific directory
