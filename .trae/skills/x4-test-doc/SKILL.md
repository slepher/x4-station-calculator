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

## Mandatory Requirements

### Chapter A: Agent-Only Mandatory

#### A.1 Execution Baseline (MANDATORY)

1. 建模策略
   - 先算候选再写文档
   - 必须引用代码/数据来源，不得臆测
2. 协作策略
   - 出现冲突时以最新规则/脚本为准
3. 产出质量标准
   - 用词具体、可执行、可复现
   - cross-file 同步（`test_tasks.md` 与 `ui_knowledge.md` 同步）
4. 失败处理优先级
   - 先修结构/规则类失败
   - 再修证据类失败
   - 最后修表达类失败

#### A.2 UI Knowledge Baseline (MANDATORY)

For every `/x4:test-doc` run, `openspec/changes/<change-name>/ui_knowledge.md` is a required artifact:

- MUST ensure `ui_knowledge.md` exists for the current change.
- If missing, create it in the same documentation pass.
- MUST keep it synchronized with `test_tasks.md` whenever test-relevant semantics change.

#### A.3 Fixture-to-UI Knowledge Sync (MANDATORY)

When `/x4:test-doc` updates test-related docs, you MUST sync fixture-backed product/module data into `openspec/changes/<change-name>/ui_knowledge.md`:

- Source files:
  - `tests/fixtures/ware_fixtures.yaml`
  - `tests/fixtures/module_fixtures.yaml`
- Trigger condition:
  - `test_tasks.md` (or discussion conclusions) mentions specific products/modules
- Required update:
  - Add or update a section in `ui_knowledge.md` that maps:
    - Test keyword -> fixture ware/module id
    - Display name (EN/CN if available)
    - Recommended locator/assertion target used in tests
- Consistency rule:
  - Keep naming in `test_tasks.md` and `ui_knowledge.md` aligned with fixture ids

#### A.4 Cross-File Sync Rules (MANDATORY)

When `test_tasks.md` changes:
- Sync relevant test semantics in `ui_knowledge.md` in the same pass.
- Keep ids/names consistent across the two files.
- Keep implementation-level locator/probe details in `ui_knowledge.md`, not in task descriptions.

#### A.5 Quality Rules (MANDATORY)

- Avoid vague placeholders in operation/assertion descriptions.
- In Chapter 2 subtasks, avoid placeholder wording (e.g., `TODO`, `待补充`) as an agent writing-quality requirement.
- Use concrete, reproducible identifiers from code/assets/fixtures.
- Keep wording executable and reviewable.

### Chapter B: Agent+Verify Mandatory

#### B.1 Execution Flow With Verify (MANDATORY)

- 操作流程固定：写文档 -> 跑脚本 -> 修复 -> 再跑。
- `x4-test-doc` 输出必须可被 `validate_test_tasks_refs.py` 校验。

#### B.2 test_tasks.md Format Contract (MANDATORY)

`test_tasks.md` MUST follow this structure and numbering model.

##### B.2.1 Four-Chapter Structure (MANDATORY)

The document MUST include exactly 4 chapters, in order:

- `## 1 单元测试`
- `## 2 E2E 标准状态与状态迁移`
- `## 3 E2E 测试场景`
- `## 4 Bug 测试`

Rules:
- All four chapters MUST exist.
- Chapter content can be empty (no forced minimum items per chapter).
- Do NOT create chapter 5.

##### B.2.2 Task Tree Structure (MANDATORY)

Only checklist task-tree structure is allowed in chapters 1..4:

- Top-level task (0-space indent):
  - `- [ ] x.x <description>`
- Subtask (2-space indent):
  - `  - [ ] x.x.x <description>`
- Subtask child (4-space indent, optional):
  - `    - [ ] x.x.x.n <description>`

Indent levels are fixed to 0 / 2 / 4 spaces.

##### B.2.3 Numbering Rules (MANDATORY)

- Top-level tasks use 2-level numbering: `x.x`
- Subtasks use 3-level numbering: `x.x.x`
- Third-level children, when used, must use 4-level numbering: `x.x.x.n`
- Subtasks under the same parent MUST start from `.1` and increment continuously.
- Third-level child numbering under the same parent subtask MUST start from `.1` and increment continuously.
- Top-level checkbox state in `test_tasks.md` MUST be `[ ]` when produced by `/x4:test-doc`.
- Newly added or backfilled checklist items (top-level/subtask/child) MUST default to `[ ]`; do not write `[✓]`/`[x]` manually in doc-update phase.
- Do not infer completion from `bugs.md` status (e.g., `Verified`): `/x4:test-doc` never marks completion based on bug status.
- Validator compatibility note: historical docs MAY contain other checkbox states, but this does not change the output requirement above.

##### B.2.4 Chapter-Specific Top-Level Task Types (MANDATORY)

- Chapter 1: `- [ ] 1.x <description>`
- Chapter 2: only
  - `- [ ] 2.x 状态: <state-id>`
  - `- [ ] 2.x 切换: <from-state> -> <to-state>`
- Chapter 3: only
  - `- [ ] 3.x Case: <scenario-name>`
- Chapter 4: only
  - `- [ ] 4.x BUG-<number>: <bug-description>`

##### B.2.5 Required/Forbidden Formats (MANDATORY)

Required:
- Use numbered subtasks (`x.x.x`) under each top-level task.
- Allow optional third-level checklist items under subtasks for child behaviors/assertions, and they must be numbered as `x.x.x.n`.
- For concrete-value expectations (numeric or deterministic string values), use inline marker format: `#期望: [...]`.
  - Examples:
    - `再充延迟: 1 s #期望: ['1 s']`
    - `断言字段集合包含36项字段标签 #期望: [36]`
- UI existence/visibility expectations are descriptive examples only; the unified marker remains `#期望: [...]`.

Forbidden:
- Markdown sub-chapters for test items (e.g., `### 2.1`, `### BUG-001 ...`)
- Unnumbered top-level task lines
- Top-level `x.x.x` numbering

##### B.2.6 Top-Level Last-Subtask Expectation Rule (MANDATORY)

Applies to all top-level tasks (`x.x`) in Chapter 1/2/3/4:

- The last subtask should be expectation-oriented.
- If the last subtask itself already contains expectation semantics, it is valid.
- If the last subtask itself does NOT contain expectation semantics, then ALL third-level child items under that last subtask MUST contain expectation semantics.

##### B.2.7 Chapter 2-4 Task Description Semantics (MANDATORY)

- Chapter 2 top-level descriptions MUST be canonical state/transition declarations only:
  - `状态: <state-id>` uses canonical state declaration syntax.
  - `切换: <from-state> -> <to-state>` must be directional and keep `from/to` ids consistent with state declarations.
- Chapter 2 subtasks MUST describe verifiable preconditions/actions/assertions tied to that state/transition.

- Chapter 3 top-level descriptions MUST be `Case: <scenario-name>`:
  - `<scenario-name>` MUST be concise and uniquely distinguishable within Chapter 3.
  - Case subtasks MUST explicitly reference Chapter 2 semantics via `状态:` / `切换:` text where applicable.

- Chapter 4 top-level descriptions MUST be `BUG-<number>: <bug-description>`:
  - `<bug-description>` MUST state observable failure behavior, not root-cause speculation.
  - Bug subtasks MUST include:
    - at least one reproducible step item (without `#期望`);
    - at least one `修复前` assertion item (with `#期望: [...]`);
    - at least one `修复后` assertion item (with `#期望: [...]`).
  - Numbering special case (MANDATORY): `修复前` assertion and `修复后` assertion MUST use the same task number (same step id pair).
  - In Chapter 4, this is the only allowed same-number duplication; other numbering must still follow contiguous increment rules.

#### B.3 Chapter 2 State/Transition Reference Integrity (MANDATORY)

- Every Chapter 2 state/transition item must be connected to Chapter 3 or Chapter 4 usage path.
- Write references in checklist subtask lines under cases/bug tasks with explicit `状态:` / `切换:` wording.
- After updating `test_tasks.md`, run validator and ensure no isolated Chapter 2 items remain.

#### B.4 Validation Workflow (MANDATORY)

1. Write/update docs per this skill.
2. Run:
   ```bash
   python3 skill-scripts/validate_test_tasks_refs.py <change-name> --json
   ```
3. Fix all failures and rerun until pass.
4. Perform final agent check for cross-file consistency (`test_tasks.md` <-> `ui_knowledge.md`).

## Constraints

- ENFORCE Zero-Code Policy: Do not touch source code.
- Only modify files within `openspec/changes/<change-name>/`.
- Do not update `request.md`, `design.md`, `tasks.md`, or `specs/**/spec.md` unless explicitly required by user.
- Do not change checklist completion states for existing test items in this skill; status updates must come from test execution apply flow (`/x4:test-run`).

## Output

- Updated test documentation artifacts (`test_tasks.md`, `ui_knowledge.md`)
- Confirmation of changes made

## Example Usage

```
/x4:test-doc storage-auto-fill
/x4:test-doc ship-week-select
```
