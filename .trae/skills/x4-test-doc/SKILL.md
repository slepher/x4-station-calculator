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

### 0. Document Responsibilities (MANDATORY)

**test_tasks.md** (测试任务结构):
- 任务标记: `[✓]` 成功 / `[✗]` 失败 / `[ ]` 未开始
- 步骤结构: `步骤 <n>: <描述>`
- 子断言: `<field>: <value>`
- **不包含**: locators、selectors、fixture ids、semantics 等实现细节

**ui_knowledge.md** (测试知识库):
- Locators / Selectors / data-testid
- Fixture IDs 映射表
- State/Transition 语义
- Build/Assert 动作定义
- 自动化实现细节

**分离原则**: test_tasks.md 描述"测什么"，ui_knowledge.md 描述"怎么测"

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

`test_tasks.md` MUST use a four-chapter structure:

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

### 3.2 Task Marker for Each Test Case (MANDATORY)

Each test case in `test_tasks.md` MUST have a task marker for tracking:

- **成功**: `- [✓] <Test Case Name>` - 测试通过
- **失败**: `- [✗] <Test Case Name>` - 测试失败（失败原因见第五章）
- **未开始**: `- [ ] <Test Case Name>` - 尚未执行
- **Placement**: At the beginning of each test section
- **注意**: 不再在其他章节保留失败注释，失败原因统一在第五章记录

Example:
```markdown
## 1 单元测试

- [ ] 档位默认状态

### 档位默认状态

- [ ] 任务：档位默认状态
    - [ ] 前提
    - [ ] 步骤 1：渲染属性区
    - [ ] 步骤 2：读取档位状态
    - [ ] 步骤 3：断言默认档位

#### 前提
- 具体前提描述

#### 步骤 1：渲染属性区
- 调用渲染函数

## 2 E2E 标准状态与状态迁移

- [ ] 状态: empty-ship-build
- [ ] 切换: empty-ship-build -> heron-vanguard-selected

### 状态: empty-ship-build
...
```

### 3.2.1 Step Task Markers (MANDATORY)

Each step under a test case MUST have a task marker:

- **Format**: `- [ ] 步骤 <n>: <description>` or `- [x] 步骤 <n>: <description>`
- **Placement**: Immediately after the case task marker, at greater indentation than case
- **Steps must be contiguous**: No blank lines between step markers at the same level

**缩进结构示例**:
```markdown
- [ ] 任务：档位默认状态
    - [ ] 步骤 1：渲染属性区
    - [ ] 步骤 2：读取档位状态
    - [ ] 步骤 3：断言默认档位
```
- Case 任务标记: indent 0 (基线)
- 步骤标记: indent 4 (比 case 多 4 空格)
- 步骤下的子断言: indent 8 (比步骤多 4 空格)

### 3.2.2 Subtask/Assertion Task Markers (MANDATORY)

子任务/断言标记必须比步骤标记多缩进一级:

- **Format**: `- [ ] <Field>: <value>` or `- [x] <Field>: <value>`
- **Placement**: 必须比对应的步骤标记多缩进 (indent = step_indent + 4 或更多)
- **数据描述行**: 描述输入/设置数据的行不应有任务标记
- **断言行**: 验证预期结果的行必须有任务标记
- **必须紧挨**: 同一级别的子任务标记之间不能有空行

**完整示例**:
```markdown
- [ ] 任务：大太刀满装备DPS计算
    - [x] 步骤 1：进入船只建造视图
    - [x] 步骤 2：选择大太刀
    - [x] 步骤 3：配置满装备
    - [x] 步骤 4：切换到详细档位
    - [x] 步骤 5：验证所有属性值
      - [x] 船体: **16,100 MJ**
      - [x] 护盾: **12,878 MJ**
      - 引擎: `engine_ter_m_allround_01_mk1` × 1
      - [x] 速度: **198 m/s**
```
Note:
- `引擎: ...` 是数据描述 (无标记)
- `船体:`, `护盾:`, `速度:` 是断言 (有标记)

### 3.3 Test Section Internal Structure (MANDATORY)

Each test section (`### [Test Name]`) in test_tasks.md MUST contain:

1. **任务标记与步骤 (Task Markers & Steps)**:
   - 任务标记: 成功 `[✓]` / 失败 `[✗]` / 未开始 `[ ]`
   - 步骤标记: `步骤 <n>: <描述>`
   - 子断言标记: 验证点 `<field>: <value>`

2. **禁止模糊描述**:
   - test_tasks.md 只包含可执行的步骤结构
   - 具体的 locators、selectors、fixture ids 等知识性内容，参考 `ui_knowledge.md`
   - 禁止在 test_tasks.md 中写入 `data-testid`、`xpath` 等实现细节

3. **知识分离原则**:
   - test_tasks.md: 测试结构、步骤、断言
   - ui_knowledge.md: locators、semantics、fixture mapping、自动化细节

### 3.3 State/Transition Reference Integrity (MANDATORY)

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
   - The validation script expects the NEW four-chapter format with explicit state/transition markers:
     - `### 状态: <id>` for states
     - `### 切换: <from> -> <to>` for transitions
     - `- 前提: 状态 <id>` for state references in Chapter 3 or 4
     - `- 前提: 切换 <from> -> <to>` for transition references in Chapter 3 or 4
     - `### BUG-[数字] <描述>` for bug tests (Chapter 4)
   - Legacy checkbox format (`- [ ] 状态：xxx`) will NOT pass validation - this is expected

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
5. Do not add meta checklist items (e.g., consumer-scope note, checkbox-ownership note) in `test_tasks.md`;
   checkbox ownership rules are maintained by `x4-test` skill.

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

### 5. Chapter 5: 失败原因及可能的推断 (MANDATORY)

记录所有测试失败用例的原因和教训:

- **格式**: `[ ] <Case名称> -> <子格式>: <教训以及心得>`
- **子格式**: 可为 `原因`, `教训`, `心得`, `推断` 等
- **规则**:
  - 每个失败的 Case 对应一条或多条心得
  - 禁止重复心得
  - 禁止过期心得（已修复的问题应删除对应记录）
  - 心得之间必须紧挨，不能有空行
  - 与 Case 保持相同缩进
  - 成功或未开始的 Case 不出现在本章
- **与其他章节的关系**: 失败原因不再在其他章节（步骤/子任务）保留注释

示例:
```markdown
## 5 失败原因及可能的推断

- [ ] 档位切换行为
    - [ ] 原因: 状态管理未正确触发重新渲染
    - [ ] 教训: 档位切换后需要强制刷新属性区组件

- [ ] 简略字段对齐
    - [ ] 原因: 字段映射表缺少简略模式配置
    - [ ] 推断: 可能需要在 gameData 中添加 simpleFields 配置
```

### 6. Localization (Match User Language)

- **Body Content**: The content **MUST** be written in the user's current conversation language (e.g., Chinese).
- **Keywords**: Keep technical terms, code references, and keywords (`SHALL`, `MUST`) in English.
- **Scenario Keywords (Chinese)**: `**前提**` (Given), `**当**` (When), `**那么**` (Then), `**并且**` (And).

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
