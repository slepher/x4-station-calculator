---
name: x4-test-doc
description: "Update test documentation artifacts (`test_tasks.md`, `ui_knowledge.md`) for X4 changes with mandatory cross-file sync. Trigger with /x4:test-doc <change-name>."
---

# X4 Test Documentation Update

This skill handles test documentation updates for the X4 Station Calculator project.

## Trigger

User invokes `/x4:test-doc <change_name>`

## Purpose

Update `test_tasks.md` and `ui_knowledge.md` based on discussion conclusions or requirement changes, with mandatory cross-file synchronization.

## Document Detail Authority (MANDATORY)

`x4-test-doc` is the single source of truth for test documentation details, including:
- test documentation conventions (`test_tasks.md`, `ui_knowledge.md`)
- test step generation rules
- fixture-to-UI knowledge synchronization rules

`x4-doc` should delegate to `x4-test-doc` for test documentation updates and must not redefine these details.

## Parameters

- `<change_name>`: The name of the change folder in `openspec/changes/` (e.g., `storage-auto-fill`).
- `<change_name>` accepts abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Input

- Discussion conclusions from `/x4:discuss`
- Existing planning artifacts (if any) to update
- Changes to `request.md` or `design.md` that affect test documentation

## Actions

1. Resolve change target and load existing test artifacts in `openspec/changes/<change-name>/`.
2. Create or update affected test artifacts: `test_tasks.md`, `ui_knowledge.md`.
3. Ensure localization matches user language.
4. Enforce cross-file consistency between test artifacts.

## Project Standards (MANDATORY)

### 1. UI Knowledge Baseline (MANDATORY)

For every `/x4:test-doc` run, `openspec/changes/<change-name>/ui_knowledge.md` is a required artifact:

- MUST ensure `ui_knowledge.md` exists for the current change.
- If missing, create it in the same documentation pass.
- MUST keep it synchronized with `test_tasks.md` whenever test-relevant semantics change.

### 1.1 Fixture-to-UI Knowledge Sync (MANDATORY)

When `/x4:test-doc` updates test-related docs, you **MUST** sync fixture-backed product/module data into `openspec/changes/<change-name>/ui_knowledge.md`:

- **Source files**:
  - `tests/fixtures/ware_fixtures.yaml`
  - `tests/fixtures/module_fixtures.yaml`
- **Trigger condition**:
  - `test_tasks.md` (or discussion conclusions) mentions specific products/modules
- **Required update**:
  - Add or update a section in `ui_knowledge.md` that maps:
    - Test keyword → fixture ware/module id
    - Display name (EN/CN if available)
    - Recommended locator/assertion target used in tests
- **If `ui_knowledge.md` does not exist**:
  - Create `openspec/changes/<change-name>/ui_knowledge.md` and include the fixture mapping section
- **Consistency rule**:
  - Keep naming in `test_tasks.md` and `ui_knowledge.md` aligned with fixture ids (avoid ad-hoc aliases unless explicitly documented)

### 2. test_tasks Step Style (MANDATORY)

When creating or updating `test_tasks.md` via `/x4:test-doc`, use the following generation rules:

1. Generate from requirements, not summaries:
   - Split each DoD / scenario into independent test items.
   - Keep branch paths separate (e.g., 覆盖导入 / 新建导入 / 帝国导入).
2. Write operation-level steps (`步骤 1..n`) for every item:
   - Unit: 输入准备 -> 函数调用 -> 结果断言。
   - Web: 页面入口 -> 用户操作 -> 可观察结果断言。
3. Keep `test_tasks.md` human-review oriented:
   - Describe user-facing operations and expected results.
   - Do NOT include locator/API/automation implementation details.
4. Put implementation details in `ui_knowledge.md`:
   - Locators, scoped selectors, fixture ids, and automation notes belong to `ui_knowledge.md`.
   - If Web steps change, sync corresponding locator/flow updates to `ui_knowledge.md` in the same update.
5. Avoid non-executable wording:
   - Do not use only "用例/验证" bullets without actionable steps.
6. Ban vague placeholder descriptions:
   - MUST NOT use vague placeholders that cannot be executed or verified in both operation and assertion steps.
   - Terms like `某个` / `任一` / `或` are allowed only when they remain rigorous:
     - the selectable scope is explicitly defined;
     - the selection condition is explicitly defined;
     - the verification criterion is explicitly defined.

### 2.1 Test Environment Knowledge (MANDATORY)

- When test implementation requires preloaded data, use `tests/fixtures/db.json` in `beforeEach` to seed the environment.
- `db.json` is generated from `tests/seeds/*.yaml`. If dynamic UI elements need validation, derive expected data from the corresponding seed content.
- This is knowledge for test implementation only; do NOT add it as checklist items in `test_tasks.md`.

### 3. Requirement-Change Test Migration (MANDATORY)

When requirements change and existing `test_tasks.md` steps become unexecutable:

1. Replace obsolete interaction steps with executable steps for the new flow in the same update.
2. Do NOT leave contradictory old wording (e.g., removed controls such as old "继续" flow) in active checklist items.
3. Keep historical execution records, but add a migration note that defines the new valid regression scope.
4. If old `[x]` items no longer represent the current behavior, add corresponding new regression items as unchecked and explicitly mark them as the current baseline.

### 3.1 test_tasks.md Four-Chapter Structure (MANDATORY)

`test_tasks.md` MUST use a five-chapter structure:

- **Chapter 1: 单元测试 (Unit Tests)**
  - Each unit test as a separate section (`### [Test Name]`)
  - Structure: 前提 -> 输入准备 -> 函数调用 -> 结果断言
- **Chapter 2: E2E 标准状态与状态迁移 (E2E Standard States & Transitions)**
  - Each state as a separate section (`### 状态: [State ID]`)
  - Each transition as a separate section (`### 切换: [From] -> [To]`)
  - State setup and validation for E2E scenarios
- **Chapter 3: E2E 测试场景 (E2E Test Scenarios)**
  - Each E2E test as a separate section (`### [Test Scenario Name]`)
  - Structure: 前提 -> 用户操作 -> 可观察结果断言
- **Chapter 4: Bug 测试 (Bug Tests)**
  - Each bug test as a separate section (`### [Bug ID] [Bug Description]`)
  - Structure: 前提 -> 触发操作 -> 预期错误结果 -> 预期修复结果
  - Combines bug reproduction and regression in a single section

Use **document-global chapter numbering** (e.g., `## 1 单元测试`, `## 2 E2E 标准状态与状态迁移`, `## 3 E2E 测试场景`, `## 4 Bug 测试`, `## 5 失败原因及可能的推断`). Each test item within chapters is a separate section, not a checklist item.

### 3.1.1 test_tasks.md Content Restriction (MANDATORY)

**test_tasks.md 只能包含五章内容，不允许包含额外知识说明**：

- ✅ 允许：五章结构（单元测试、E2E标准状态与状态迁移、E2E测试场景、Bug测试、失败原因及可能的推断）
- ✅ 允许：任务、步骤、子行为/子断言的 checkbox 结构
- ❌ 禁止：计算公式、技术说明、参考表格等知识性内容
- ❌ 禁止：子章节（如 `### 2.5 装备映射`）
- ❌ 禁止：非测试步骤的说明性文本块

**知识唯一性原则**：
- 所有测试相关的知识（如装备配置、计算公式、数据来源）应放在 `ui_knowledge.md`
- `test_tasks.md` 只描述"要测什么"，不描述"怎么测"或"为什么这样"

### 3.2 Test Section Internal Structure (MANDATORY)

Each test section (`### [Test Name]`) MUST contain:

1. **详细前提 (Detailed Preconditions)**:
   - 明确指定测试所需的初始状态、数据、配置
   - 禁止模糊描述如"选择一艘舰船"、"选择一项装备"
   - 必须指定具体对象（如：选择舰船 `ship_azeroth` / 选择装备 `weapon_plasma_01`）

2. **操作步骤作为子任务 (Operation Steps as Subtasks)**:
   ```
   #### 步骤 1: [操作描述]
   - 具体动作
   - 预期中间结果

   #### 步骤 2: [操作描述]
   - 具体动作
   - 预期中间结果
   ```

3. **结果断言 (Result Assertions)**:
   - 明确的预期结果
   - 可观测的验证点
   - **必须使用实际断言方法**: 直接写出测试中使用的断言，如 `toBe(1000)`, `greaterThan(300)`, `toContain('text')`, `toHaveCount(5)` 等
   - 禁止仅描述预期值而不写断言方法

**禁止的模糊描述示例**:
- ❌ "选择一艘舰船" -> ✅ "点击选择 ID 为 `ship_azeroth` 的舰船"
- ❌ "选择一项装备" -> ✅ "从装备列表中选择 `weapon_plasma_01`"
- ❌ "点击某个按钮" -> ✅ "点击标记为 `确认` 的按钮（data-testid: confirm-btn）"

### 3.3 Task Numbering & Format (MANDATORY - STRICT ENFORCEMENT)

**CRITICAL**: Each task MUST have a number in format `<章节号>.<序号>`

#### Checkbox State Format

test_tasks.md 使用三种状态标记测试执行结果：

| 状态 | 符号 | 含义 | 使用场景 |
|------|------|------|----------|
| 通过 | `[✓]` | 测试通过 | 测试运行后由 x4-test 更新 |
| 失败 | `[✗]` | 测试失败 | 测试运行后由 x4-test 更新 |
| 待处理 | `[ ] | 未执行/未更新 | 初始状态 |

**注意**：
- test-doc 创建文档时使用 `[ ]`（待处理状态）
- x4-test 运行测试后更新为 `[✓]` 或 `[✗]`
- 验证脚本根据这三种状态进行验证

#### Task Format: `- [ ] <章节号>.<序号> <描述>`

| 章节 | 允许的描述类型 | 正确示例 |
|------|---------------|----------|
| 1 单元测试 | 任意描述 | `- [ ] 1.1 档位默认状态` |
| 2 E2E标准状态与状态迁移 | `状态:` 或 `切换:` | `- [ ] 2.1 状态: heron-selected`<br>`- [ ] 2.2 切换: heron-selected -> detail-mode` |
| 3 E2E测试场景 | `Case:` | `- [ ] 3.1 Case: 中列属性区双档位渲染` |
| 4 Bug测试 | `Bug:` | `- [ ] 4.1 Bug: 点击保存无响应` |

**标号规则**:
- 格式：`<章节号>.<序号>`，如 `1.1`, `1.2`, `2.1`
- `<序号>` 从 1 开始连续递增
- 标号位于 `[ ]` 之后，描述之前

**错误格式**:
- ❌ `- [ ] 档位默认状态` (缺少标号)
- ❌ `- [ ] 1.1.1 档位默认状态` (序号有多层)
- ❌ `- [ ] 3.1 场景: xxx` (第三章应用 `Case:`)
- ❌ `- [ ] 2.1 Case: xxx` (第二章只能用 `状态:` 或 `切换:`)

#### Step Format (Nested under tasks):
```
- [ ] 1.1 档位默认状态
  - [ ] 步骤 1: 读取当前档位状态
  - [ ] 步骤 2: 断言默认档位为 "summary"
```

#### Sub-behaviors Format (Nested under Steps):
- 子项目与步骤之间采用两格缩进，总共缩进为四格
- 子行为/子断言使用 checkbox 格式
- **子项目断言必须包含期望值**: 使用 `（期望 toBe('16,100 MJ')）` 格式记录断言
```
- [ ] 3.1 Case: 大太刀满装备DPS计算
  - [ ] 步骤 1: 配置装备
    - [ ] 引擎: engine_ter_m_allround_01_mk1 × 1
    - [ ] 护盾: shield_ter_m_standard_02_mk2 × 2
  - [ ] 步骤 2: 验证属性值
    - [x] 船体: **16,100 MJ**（期望 toBe('16,100 MJ')）
    - [x] 护盾: **12,878 MJ**（期望 toBe('12,878 MJ')）
```

### 3.4 Chapter 2 Content Restriction (MANDATORY)

**Chapter 2 只能包含**:
- `- [ ] 2.x 状态: <state-id>`
- `- [ ] 2.x 切换: <from> -> <to>`

**禁止内容**:
- ❌ 测试用例 (`Case:`, `场景:`, `任务:`)
- ❌ 子章节 (`### 2.1`)

### 3.5 Chapter 3 Content Restriction (MANDATORY)

**Chapter 3 只能包含**:
- `- [ ] 3.x Case: <test-scenario-name>`

**禁止内容**:
- ❌ 状态/切换定义
- ❌ 场景: 等其他格式

### 3.6 Chapter 4 Content Restriction (MANDATORY)

**Chapter 4 只能包含**:
- `- [ ] 4.x Bug: <bug-description>`

### 3.7 State/Transition Reference Integrity (MANDATORY)

Every state/transition in **Chapter 2** MUST be referenced:

1. **Reference Requirements**:
   - Each state/transition in Chapter 2 (`## 2 E2E 标准状态与状态迁移`) MUST be referenced either:
     - By another state/transition in Chapter 2, OR
     - By a test scenario in Chapter 3, OR
     - By a bug test in Chapter 4
   - The reference chain MUST trace back to Chapter 3 or 4 (no isolated chains that only exist in Chapter 2)

2. **Verifiable Format Specification** (Python script validation):

   **State Definition**:
   ```markdown
   ### 状态: <state-id>
   ```

   **Transition Definition**:
   ```markdown
   ### 切换: <from-state> -> <to-state>
   ```

   **State Reference in Chapter 3 or 4**:
   ```markdown
   ### <Test Scenario Name>
   - 前提: 状态 <state-id>
   ```

   **Transition Reference in Chapter 3 or 4**:
   ```markdown
   ### <Test Scenario Name>
   - 前提: 切换 <from-state> -> <to-state>
   ```

3. **Valid Reference Patterns**:
   ```
   ## 2 E2E 标准状态与状态迁移

   ### 状态: empty-empire          # 直接被章节3或4引用 ✓

   ### 切换: empty -> one         # 被章节3或4引用 ✓

   ### 切换: one -> two            # 在章节2内部被引用，且链追溯到章节3或4 ✓
   ```

4. **Invalid Patterns (Forbidden)**:
   ```
   ## 2 E2E 标准状态与状态迁移

   ### 状态: unused-state         # 没有任何引用 ❌

   ### 切换: orphan -> x           # 只在章节2内部引用，但从未连接到章节3或4 ❌
   ```

5. **Validation Rule**:
   - After creating/updating test_tasks.md, verify that every Chapter 2 item has a reference path to Chapter 3 or 4
   - If an item is only referenced by other Chapter 2 items, trace the full chain to ensure at least one item in the chain is referenced by Chapter 3 or 4

6. **Bug Test Structure (MANDATORY)**:
   - Chapter 4 (Bug 测试) combines reproduction and regression:
     - 前提: 测试前置条件
     - 触发操作: 复现bug的操作步骤
     - 预期错误结果: 未修复时的错误表现
     - 预期修复结果: 修复后的正确行为
   - Bug ID format: `### BUG-[数字] <描述>`
   - Example:
     ```
     ## 4 Bug 测试

     ### BUG-001 点击保存无响应

     #### 前提
     - 已选择一艘舰船
     - 已完成配置

     #### 触发操作
     - 步骤1: 点击"保存"按钮
     - 步骤2: 等待1秒

     #### 预期错误结果
     - 保存无响应，无任何反馈

     #### 预期修复结果
     - 弹出保存成功提示
     - 数据已持久化
     ```

   - **Python Validation Script** (`skill-scripts/validate_test_tasks_refs.py`):
     ```bash
     # By change name
     python3 skill-scripts/validate_test_tasks_refs.py <change-name>

     # By file path
     python3 skill-scripts/validate_test_tasks_refs.py --file <path-to-test_tasks.md>

     # Exit code 0 = pass, 1 = fail with report
     ```

7. **Format Migration Note**:
   - The validation script expects the NEW five-chapter format with explicit state/transition markers:
     - `### 状态: <id>` for states
     - `### 切换: <from> -> <to>` for transitions
     - `- 前提: 状态 <id>` for state references in Chapter 3 or 4
     - `- 前提: 切换 <from> -> <to>` for transition references in Chapter 3 or 4
     - `### BUG-[数字] <描述>` for bug tests (Chapter 4)
   - Legacy checkbox format (`- [ ] 状态：xxx`) will NOT pass validation - this is expected

### 3.8 Chapter 5: 失败原因及可能的推断 (MANDATORY)

After test run completes:
1. Collect all failed test cases from current run
2. For each failed case, add/update entry in Chapter 5:
   ```markdown
   ## 5 失败原因及可能的推断

   - [ ] <Failed Case Name>
       - [ ] <子格式>: <教训/心得/推断>
   ```
3. If a previously failed case now passes:
   - Remove its Chapter 5 entry (no stale records)
   - Mark as `[✓]` in the respective chapter

### 4. State + Transition Chapter in `test_tasks.md` (MANDATORY)

When tests depend on reusable states, `test_tasks.md` must use a simplified model: explicit states and explicit state-switch paths.

1. `test_tasks.md` state/switch section MUST include:
   - state list (`状态：<id>`)
   - state-switch list (`切换：<from>-><to>`)
   - only include necessary state-switch items that are consumed by scenario tests; do not model full pairwise transitions.
2. Do not use complex dependency-loading graphs as the primary mechanism.
   - keep execution intent explicit via switch paths.
3. Scenario items should clearly indicate required state/switch prerequisites when needed.
4. Keep `test_tasks.md` concise:
   - no locator/probe/automation details in `test_tasks.md`
   - detailed semantics belong to `ui_knowledge.md`
5. Do not add meta checklist items (e.g., consumer-scope note) in `test_tasks.md`;
   State management rules are defined in `x4-test` skill.

### 4.1 Standard State Task Contract (MANDATORY)

When requirements introduce reusable states, `x4-test-doc` MUST document both state tests and state-switch tests as first-class checklist items.

1. State item structure in `test_tasks.md`:
   - keep state ids and switch ids as executable checklist units
   - avoid implicit inference wording
2. Transition wording:
   - each transition item should be expressible as:
     - assert from-state -> execute switch actions -> assert to-state
3. Mid-run insertion rule:
   - if a new state or switch is introduced, update both files in one pass:
     - `test_tasks.md`: add state/switch checklist entries and scenario references
     - `ui_knowledge.md`: add corresponding build/assert/switch semantics
4. Multiple baselines rule:
   - multiple baseline states are allowed and independent.
   - each baseline and each baseline-related switch needs its own checklist entry.

### 4.2 Standard State Update Scope (MANDATORY)

When the user request **contains a test standard-state portion** (e.g. "标准状态", state setup path, state-switch preconditions):

1. For the standard-state portion, allowed files are strictly:
   - `openspec/changes/<change-name>/test_tasks.md`
   - `openspec/changes/<change-name>/ui_knowledge.md`
2. For the standard-state portion, MUST NOT update:
   - `request.md`, `design.md`, `tasks.md`, `specs/**/spec.md`
   unless the user explicitly asks to change product requirements/design/spec at the same time.
3. If the same request also includes non-standard-state changes, process those parts with normal rules.
4. Keep cross-file sync within test artifacts only:
   - state checklist/steps in `test_tasks.md`
   - state actions/probes/locators semantics in `ui_knowledge.md`
5. Do not promote standard-state test detail into requirement/DoD narrative by default.

### 5. Localization (Match User Language)

- **Body Content**: The content **MUST** be written in the user's current conversation language (e.g., Chinese).

## Validation Workflow (MANDATORY)

Follow this order when creating/updating test documentation:

1. **Write documentation following rules in Sections 1-5**:
   - Five-chapter structure: 单元测试、E2E标准状态与状态迁移、E2E测试场景、Bug测试、失败原因及可能的推断
   - Task format: `- [ ] <章节号>.<序号> <描述>`
   - Step format: `- [ ] 步骤 <n>: <description>`
   - Sub-item indent: 4 spaces total (task at 0, step at 2, sub-item at 4)
   - No extra knowledge content (knowledge goes to ui_knowledge.md)
   - **Steps must be concrete and executable** - avoid vague descriptions like "选择一艘舰船" or "点击某个按钮"
   - **禁止模糊描述**: Must use specific identifiers (e.g., `ship_azeroth`, `weapon_plasma_01`, `data-testid: confirm-btn`)

2. **Python validation (first pass)**:
   ```bash
   python3 skill-scripts/validate_test_tasks_refs.py <change-name>
   ```
   - Fix any format errors
   - Repeat until Python validation passes

3. **Agent validation (second pass)**:
   - Verify all chapters are present and correctly structured
   - Verify task numbering is sequential within each chapter
   - Verify steps are concrete and executable (no vague descriptions)
   - Verify assertions use actual test methods (e.g., `toBe(1000)`, `greaterThan(300)`, not just expected values)
   - Verify state/transition reference integrity (Chapter 2 items must be referenced by Chapter 3 or 4)
   - Verify cross-file consistency between test_tasks.md and ui_knowledge.md

## Constraints

- **ENFORCE Zero-Code Policy**: Do not touch source code
- Only modify files within `openspec/changes/<change-name>/`
- Do not update `request.md`, `design.md`, `tasks.md`, or `specs/**/spec.md` unless explicitly required

## Output

- Updated test documentation artifacts (`test_tasks.md`, `ui_knowledge.md`)
- Confirmation of changes made

## Example Usage

```
/x4:test-doc storage-auto-fill
/xx:test-doc ship-week-select
```
