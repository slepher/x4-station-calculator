---
name: x4-test-doc
description: "Update test documentation artifacts (`test_tasks.md`, `knowledge.md`) for X4 changes with mandatory cross-file sync, then pass x4-test-doc-viewer gate. Trigger with /x4:test-doc <change-name>."
---

# X4 Test Documentation Update

This skill handles test documentation updates for the X4 Station Calculator project.

## Trigger

User invokes `/x4:test-doc <change_name>`

## Purpose

Update `test_tasks.md` and `knowledge.md` based on discussion conclusions or requirement changes, with mandatory cross-file synchronization.

## P0 Execution Block (READ FIRST, MANDATORY)

1. Actionable-step rule (Chapter 3/4):
   - For non-reference subtask lines in Chapter 3/4, write executable steps with concrete target/action/assertion.
   - Reference lines (`状态:` / `切换:`) are the only allowed short-form exception.
2. Vague wording ban:
   - Forbidden vague phrasing in task steps: `抽样`, `检查`, `验证`, `变化`, `某一个`, `选一个`, `合理即可`.
3. Blocked protocol:
   - If key data is missing, ask one consolidated blocking-question batch and mark blocked.
   - After user feedback, continue with direct file edits; do not return to abstract advisory mode.
4. Chapter order gate:
   - Chapter 2 generation is blocked until Chapter 3 case-first draft is complete.
   - If Chapter 2 is generated before Chapter 3 case-first draft, Chapter 2 must be fully rewritten; patch-fix on existing Chapter 2 is forbidden.

## Document Detail Authority (MANDATORY)

`x4-test-doc` is the single source of truth for test documentation details, including:
- test documentation conventions (`test_tasks.md`, `knowledge.md`)
- test step generation rules
- fixture-to-UI knowledge synchronization rules

Test-documentation commands (for example `/x4:test` and `/x4:test-doc`) should rely on this skill for test documentation updates and must not redefine these details.

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
2. Create or update affected test artifacts: `test_tasks.md`, `knowledge.md`.
3. Ensure localization matches user language.
4. Enforce cross-file consistency between test artifacts.
5. Submit final draft to `/x4:test-doc-viewer` for approval.
6. If reviewer rejects, rewrite in this skill and resubmit until reviewer passes.

## Missing Artifact Policy (MANDATORY)

- If `openspec/changes/<change-name>/test_tasks.md` is missing, create it in the same run.
- If `openspec/changes/<change-name>/knowledge.md` is missing, create it in the same run.
- Missing files are **not** a blocker condition for `/x4:test-doc`; the skill MUST bootstrap required files first, then continue.
- Do not ask the user to create these files manually.

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
   - cross-file 同步（`test_tasks.md` 与 `knowledge.md` 同步）
4. 失败处理优先级
   - 先修结构/规则类失败
   - 再修证据类失败
   - 最后修表达类失败

#### A.2 UI Knowledge Baseline (MANDATORY)

For every `/x4:test-doc` run, `openspec/changes/<change-name>/knowledge.md` is a required artifact:

- MUST ensure `knowledge.md` exists for the current change.
- If missing, create it in the same documentation pass.
- MUST keep it synchronized with `test_tasks.md` whenever test-relevant semantics change.

#### A.2.1 Test Tasks Baseline (MANDATORY)

For every `/x4:test-doc` run, `openspec/changes/<change-name>/test_tasks.md` is a required artifact:

- MUST ensure `test_tasks.md` exists for the current change.
- If missing, create it in the same documentation pass.
- MUST keep it synchronized with `knowledge.md` whenever test-relevant semantics change.

#### A.3 Fixture-to-UI Knowledge Sync (MANDATORY)

When `/x4:test-doc` updates test-related docs, you MUST sync fixture-backed product/module data into `openspec/changes/<change-name>/knowledge.md`:

- Source files:
  - `tests/fixtures/ware_fixtures.yaml`
  - `tests/fixtures/module_fixtures.yaml`
- Trigger condition:
  - `test_tasks.md` (or discussion conclusions) mentions specific products/modules
- Required update:
  - Add or update a section in `knowledge.md` that maps:
    - Test keyword -> fixture ware/module id
    - Display name (EN/CN if available)
    - Recommended locator/assertion target used in tests
- Consistency rule:
  - Keep naming in `test_tasks.md` and `knowledge.md` aligned with fixture ids

#### A.4 Cross-File Sync Rules (MANDATORY)

When `test_tasks.md` changes:
- Sync relevant test semantics in `knowledge.md` in the same pass.
- Keep ids/names consistent across the two files.
- Keep implementation-level locator/probe details in `knowledge.md`, not in task descriptions.

#### A.5 Quality Rules (MANDATORY)

- Avoid vague placeholders in operation/assertion descriptions.
- Avoid placeholder wording (e.g., `TODO`, `待补充`) in any chapter.
- Use concrete, reproducible identifiers from code/assets/fixtures.
- Keep wording executable and reviewable.
- In Chapter 3/4, for non-reference subtasks (not standalone `状态:` / `切换:` lines), use executable step wording:
  - include scope (`在 <scope>`), target (`对 <target>`), action (`执行 <action>`), observable assertion (`断言 <result>`).
- Do not use vague-only statements as standalone subtask lines.
- Anti-patterns (forbidden):
  - Do not add low-business-value `状态:` / `切换:` only to satisfy reference count.
  - Do not use undefined action verbs such as `抽样`, `检查`, `确认` as operation placeholders.
- Minimal executable syntax (mandatory for non-reference subtasks):
  - Each step must include: scope + action + target + assertion.
  - Assertion must include `#期望: [...]` for deterministic outcomes.
  - Exception: Chapter 4 reproducible-step items follow B.2.7 and may omit `#期望: [...]`.

#### A.6 Chapter 3 Planning Gate (MANDATORY)

Before drafting Chapter 3, run this preparation workflow:

1. One-pass high-level thinking first:
   - Read `AGENTS.md` before Chapter 3 planning.
   - Build a planning table for candidate `3.x` cases:
     - case goal
     - target UI/scope
     - action chain
     - assertion intent
     - required data
     - data source path
2. Data provenance first:
   - For each planned case, identify where concrete data comes from before writing final task lines.
   - Prefer existing artifacts and fixtures over assumptions.
3. Fast-fail unknowns:
   - If key data source cannot be found quickly, collect blocking questions and ask the user once in a consolidated batch.
   - Questions must focus on missing data needed to make task steps concrete and executable.
4. Then per-task deepening:
   - After user feedback, perform detailed per-task thinking and fetch concrete data for each task.
   - Do not write vague operation text if concrete data is still missing.
5. Drafting gate:
   - Draft Chapter 3 concrete case flows first, without `状态:` / `切换:` reference lines at this stage.
   - Once Chapter 3 concrete content is ready, execute extraction via A.7.

#### A.7 Case-First Extraction Strategy (MANDATORY)

Use the following extraction workflow to reduce abstract wording and improve reachable E2E flow quality:

1. Prerequisites:
   - Chapter 1 and Chapter 3 concrete content is already drafted (per A.6).
   - Do not draft Chapter 2 directly before those concrete contents exist.
   - Until Chapter 3 case-first draft is complete, Chapter 2 generation is forbidden.
   - If Chapter 2 is created early, discard and rewrite Chapter 2 from extraction output; do not patch old Chapter 2.
2. Chapter 2 generation gate:
   - Every Chapter 2 item must come from extracted shared blocks in Chapter 3.
   - If no shared block meets extraction thresholds, keep flow details in Chapter 3 and do not force-create Chapter 2 abstraction.
3. Extract shared blocks from Chapter 3 to Chapter 2:
   - If the same flow block is reused by at least 2 cases and contains at least 3 action steps, extract it to Chapter 2.
4. Promote Chapter 2 shared blocks to canonical state/transition:
   - If a Chapter 2 block still contains repeated patterns with at least 3 action steps, normalize it as `状态:` or `切换:`.
   - Run this normalization pass once only; do not perform iterative re-extraction loops.
5. Inline low-value transition back to Chapter 3:
   - If a `切换:` block has only 1 action step after normalization, remove that transition and inline the action step back into Chapter 3 case flow.
6. Extraction scope and step counting:
   - When extracting shared blocks, include both action steps and observation/assertion points to keep semantic integrity.
   - For all `>=3 steps` decisions, count action steps only.
   - Observation/assertion items (including `#期望: [...]`) are not counted as steps.
7. Observation backfill after extraction:
   - After finalizing Chapter 2 `状态:`/`切换:`, if an item lacks observable checks, add at least one observation/assertion line.
   - Shared observation points should live in Chapter 2 item body; case-specific assertions remain in Chapter 3.
8. Post-extraction execution:
   - Replace reusable Chapter 3 blocks with Chapter 2 references in the same extraction pass.
   - After extraction completes, run validation directly; do not run an additional standalone rewrite phase for Chapter 3.

#### A.8 Execution Evidence Block (MANDATORY)

Before final delivery in each `/x4:test-doc` run, output an explicit evidence block:

1. `Case 抽取表`:
   - Include: case id, reused block id/description, extractable-as-state decision (`yes/no`).
2. `抽取决策`:
   - For each reusable block, state keep-inline vs extract-to-state/transition and concrete reason.
- Missing either section is failure for this run.

#### A.9 Repeat-Failure Rollback Strategy (MANDATORY)

If the same issue category is reported more than once in the same run:

1. Discard current `test_tasks.md` draft.
2. Restart from Chapter 3 case-first drafting.
3. Re-run extraction to regenerate Chapter 2.
4. Do not reuse old numbering patches to repair previous draft.

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
- If a chapter has zero checklist items, it is still valid and must not be backfilled with placeholder tasks.
- This rule has higher priority than chapter-specific task-type rules below.
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
- For newly created top-level tasks by `/x4:test-doc`, checkbox state MUST be `[ ]`.
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

Note:
- The above type constraints apply only when a chapter contains top-level tasks.
- They do not imply any minimum item count for any chapter.

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
  - Case subtasks MUST explicitly reference Chapter 2 semantics via standalone `状态:` / `切换:` lines where applicable.

- Chapter 4 top-level descriptions MUST be `BUG-<number>: <bug-description>`:
  - `<bug-description>` MUST state observable failure behavior, not root-cause speculation.
  - Bug subtasks MUST include:
    - at least one reproducible step item (without `#期望`);
    - at least one `修复前` assertion item (with `#期望: [...]`);
    - at least one `修复后` assertion item (with `#期望: [...]`).
  - Numbering special case (MANDATORY): `修复前` assertion and `修复后` assertion MUST use the same task number (same step id pair).
  - In Chapter 4, this is the only allowed same-number duplication; other numbering must still follow contiguous increment rules.
  - If Chapter 4 has no bug items, this section is non-applicable (valid empty chapter).

#### B.3 Chapter 2 State/Transition Reference Integrity (MANDATORY)

- Every Chapter 2 state/transition item must be connected to Chapter 3 or Chapter 4 usage path.
- Write references in checklist subtask/child lines under cases/bug tasks using exact standalone forms:
  - `状态: <state-id>`
  - `切换: <from-state> -> <to-state>`
- Do not prepend/append extra text on those reference lines.
- Chapter 2 `状态:` must contain at least 3 non-expectation steps (`#期望` lines are excluded from step count).
- Chapter 2 `切换:` must contain at least 2 non-expectation steps (`#期望` lines are excluded from step count).
- Every Chapter 2 state/transition must be referenced at least 2 times in Chapter 3/4.
- In Chapter 3/4, each top-level case (each `3.x Case` / `4.x BUG`) can contain at most one `状态:` reference line.
- If the above checks fail, rewrite the corresponding Chapter 3 case steps and re-extract Chapter 2 items.
- After updating `test_tasks.md`, run validator and ensure no isolated Chapter 2 items remain.

#### B.4 Validation Workflow (MANDATORY)

1. Write/update docs per this skill.
2. Pre-delivery lint (mandatory):
   ```bash
   python3 skill-scripts/validate_test_tasks_refs.py <change-name> --json
   ```
3. If lint fails:
   - Return to Chapter 3 case rewrite and re-extract Chapter 2.
   - Do not fix by only adding references in Chapter 3/4.
4. Rerun lint until pass.
5. Perform final agent check for cross-file consistency (`test_tasks.md` <-> `knowledge.md`).

#### B.5 Reviewer Gate Workflow (MANDATORY)

`x4-test-doc` final output is blocked by `x4-test-doc-viewer` review gate:

1. After B.4 passes, run `/x4:test-doc-viewer <change-name>` in a dedicated isolated reviewer subagent.
2. Reviewer handoff must be minimal and review-only:
   - resolved `change-name`
   - target file paths (`test_tasks.md`, `knowledge.md`)
   - optional previous blocking issue ids
3. If reviewer result is `review_status: rewrite_required`, `x4-test-doc` MUST:
   - apply all blocking rewrite items to `test_tasks.md` and `knowledge.md`;
   - rerun `validate_test_tasks_refs.py` until pass;
   - resubmit to `/x4:test-doc-viewer` using a fresh isolated reviewer subagent.
4. Only when reviewer returns `review_status: pass` can this skill be considered complete.
5. Do not bypass reviewer gate, even if validator already passes.
6. If reviewer subagent cannot be started, stop and report blocker; do not downgrade to in-thread reviewer mode.

## Constraints

- ENFORCE Zero-Code Policy: Do not touch source code.
- Only modify files within `openspec/changes/<change-name>/`.
- Do not update `request.md`, `design.md`, `tasks.md`, or `specs/**/spec.md` unless explicitly required by user.
- Do not change checklist completion states for existing test items in this skill; status updates must come from test execution apply flow (`/x4:test-run`).

## Output

- Updated test documentation artifacts (`test_tasks.md`, `knowledge.md`)
- Viewer gate result from `/x4:test-doc-viewer` (`review_status: pass`)
- Confirmation of changes made
- `Execution Evidence Block` (from A.8) must be included before completion claim.
- Must include actual edited file paths for this run.
- If no file edit is possible due to missing required data, output `BLOCKED` with one consolidated question batch.

## Example Usage

```
/x4:test-doc storage-auto-fill
/x4:test-doc ship-week-select
```
