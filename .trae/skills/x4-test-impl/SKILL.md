---
name: x4-test-impl
description: "Implement and supplement Unit/E2E test code for X4 Station Calculator. Trigger with /x4:test-impl <change-name>."
metadata:
  version: "1.10"
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

## 6. TEST CASE NAME + STEP COMMENTS VALIDATION (MANDATORY)

### Validation Script
Use `validate_test_case_refs.py` to validate correspondence (python is fallback, prefer python3):
```bash
python3 skill-scripts/validate_test_case_refs.py <change-name>
```

**Validation covers:**
1. **Case Name Correspondence**: Test case names in files must match task names in test_tasks.md by prefix (e.g., `1.1` matches `1.1 档位默认状态`)
2. **Step Comment Correspondence**: Each subtask in test_tasks.md must have a corresponding comment in the test file, matching by prefix (e.g., `1.1.1` matches `1.1.1 读取当前档位状态`)
3. **Step Has Code**: Each step comment must be followed by at least one line of actual code (operation or assertion). Empty steps (comments without code) will fail validation.
4. **Assertion Match**: For steps with expectations (e.g., `（期望 toBe('summary')）`), the test file must contain corresponding assertions. For sub-item assertions, all assertion values must be verified.

### Validation Rules

**Test case names只需以对应标号开头即可:**

| test_tasks.md 任务项 | 测试文件用例名（宽松匹配） |
|---------------------|-------------------------|
| `- [ ] 1.1 档位默认状态` | `it("1.1 ...", ...)` 或 `it("1.1 档位默认状态", ...)` |
| `- [ ] 2.1 状态: heron-selected` | `it("2.1 ...", ...)` |
| `- [ ] 2.2 切换: heron-selected -> detail-mode` | `it("2.2 ...", ...)` |
| `- [ ] 3.1 Case: 中列属性区双档位渲染` | `it("3.1 ...", ...)` |

**子任务注释只需以对应标号开头即可:**
- test_tasks.md: `- [ ] 1.1.1 读取当前档位状态`
- test comment: `// 1.1.1 读取当前档位状态` 或 `// 1.1.1: 读取当前档位状态`

### ⚠️ MANDATORY: 禁止修改 test_tasks.md

**x4-test-impl 严格禁止为了通过脚本验证而修改 test_tasks.md。**

- test_tasks.md 的修改只能由 x4-test-doc 负责
- 如果验证脚本报告不通过，应检查测试代码是否正确实现，而非修改文档
- 修改 test_tasks.md 属于违规行为，将导致验证失败

### Bidirectional Validation
- **test_tasks.md → 测试文件**: 每个任务项在测试文件中有对应用例
- **测试文件 → test_tasks.md**: 每个用例在 test_tasks.md 中有对应任务项
- **第五章说明**: 第五章（失败原因及可能的推断）不需要验证，无对应测试文件，仅用于记录测试失败原因

### Test File Naming Convention
- Unit tests: `tests/unit/${CHANGE_NAME}/${CHANGE_NAME}.spec.test`
- E2E tests: `tests/e2e/${CHANGE_NAME}/${CHANGE_NAME}.spec.test`
- Bug reproduction: `tests/e2e/${CHANGE_NAME}/bug-${CHANGE_NAME}.spec.test`
- Bug fix: `tests/e2e/${CHANGE_NAME}/bugfix-${CHANGE_NAME}.spec.test`

## 7. TEST STEP COMMENTS (MANDATORY)

Every test case must have step comments that map 1:1 to steps in test_tasks.md.

### Step Comment Format (新格式: 标号开头)
```typescript
it("1.1 档位默认状态", async ({ page }) => {
  // 1.1.1 渲染已选飞船的船只建造属性区。
  await page.waitForSelector('.ship-build-stats')

  // 1.1.2 读取当前档位状态。
  const currentMode = await page.evaluate(() => ...)

  // 1.1.3 断言默认档位为 "summary"。
  expect(currentMode).toBe('summary')
})
```

### Rules
1. **One-to-one mapping**: Each step in test_tasks.md must have a corresponding comment in the test case
2. **No empty blocks**: Comments must be immediately followed by actual code (no empty lines between comment and code)
   - **Every step must have at least one line of code**: Operations (e.g., `await page.click(...)`, `const x = ...`) OR assertions (e.g., `expect(...).toBe(...)`)
   - Steps without code will fail validation
3. **宽松匹配 (标号开头)**: Step comments只需以对应标号开头即可:
   - test_tasks.md: `- [ ] 1.1.1 渲染已选飞船的船只建造属性区。`
   - test comment: `// 1.1.1 渲染已选飞船的船只建造属性区。` 或 `// 1.1.1: 渲染已选飞船的船只建造属性区。`
4. **Assertion must match exactly**: The assertion code under the step comment must match the assertion documented in test_tasks.md exactly (e.g., `toBe(1000)`, `greaterThan(300)`, `toContain('text')`). Do not change assertion values or methods.
5. **Sub-item assertions must be verified**: For steps with sub-items containing expectations (e.g., `  - [ ] 船体: 16,100 MJ（期望 toBe('16,100 MJ')）`), all assertions must be present in the test file
6. **Order matters**: Steps must appear in the same order as in test_tasks.md

### Example - Complex Steps with Sub-items
```typescript
it("3.6 Case: 大太刀满装备DPS计算", async ({ page }) => {
  // 3.6.1 进入船只建造视图，选择 class=M、race=terran、type=corvette。
  await page.click('[data-testid="ship-build-btn"]')
  await page.click('[data-testid="class-M"]')

  // 3.6.2 选择大太刀（ship_ter_m_corvette_02_a）。
  await page.click('[data-testid="ship-ter-m-corvette-02-a"]')

  // 3.6.3 配置满装备：
  //   - 引擎: engine_ter_m_allround_01_mk1 × 1
  await page.selectEquipment('engine', 'engine_ter_m_allround_01_mk1')
  //   - 护盾: shield_ter_m_standard_02_mk2 × 2
  await page.selectEquipment('shield', 'shield_ter_m_standard_02_mk2', 2)
  //   - 武器: weapon_ter_m_beam_01_mk2 × 4
  await page.selectEquipment('weapon', 'weapon_ter_m_beam_01_mk2', 4)

  // 3.6.4 切换到"详细"档位。
  await page.click('[data-testid="stats-mode-detail"]')

  // 3.6.5 验证属性值：
  //   - 船体: 16,100 MJ
  const hull = await page.getStatValue('hull')
  expect(hull).toBe('16,100 MJ')
  //   - 护盾: 12,878 MJ
  const shield = await page.getStatValue('shield')
  expect(shield).toBe('12,878 MJ')
})
```

## 8. VALIDATION WORKFLOW (MANDATORY)

Follow this order when implementing tests:

1. **Write tests following rules in Sections 1-7**:
   - Exact directory paths (UNIT_DIR, E2E_DIR)
   - Test case names只需以对应标号开头即可 (宽松匹配)
   - Step comments只需以对应标号开头即可 (宽松匹配)
   - **Every step must have at least one line of code** (operations or assertions)
   - Assertions under step comments must EXACTLY match assertions documented in test_tasks.md

2. **Python validation (first pass)**:
   ```bash
   python3 skill-scripts/validate_test_case_refs.py <change-name>
   ```
   - Fix any case name mismatches
   - Fix any step comment mismatches
   - **Fix steps without code**: Every step comment must have corresponding code
   - Fix any assertion mismatches (including sub-item assertions)
   - Repeat until Python validation passes

3. **Agent validation (second pass)**:
   - Verify test files exist in correct locations
   - Verify syntax/type correctness: `npx tsc -p tsconfig.test-check.json --noEmit`
   - Verify all test_tasks.md items have corresponding test cases
   - Verify step comments are present and correctly placed (no empty lines between comment and code)
   - Verify every step has at least one line of code
   - Verify assertions under step comments exactly match assertions in test_tasks.md (e.g., `toBe(1000)`, `greaterThan(300)`)

## 9. GUARDRAILS

- DO NOT run `npm run build` or `npx playwright test`.
- DO NOT run full test execution for verification pass/fail.
- DO NOT write pass/fail markers to `test_tasks.md`.