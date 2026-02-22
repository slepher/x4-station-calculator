---
name: x4-doc
description: "Update OpenSpec planning artifacts for X4 (`request/spec/design/tasks/test_tasks/ui_knowledge`) based on discussion conclusions, with mandatory cross-file sync."
---

# X4 Documentation Update

This skill handles documentation updates for the X4 Station Calculator project.

## Trigger

User invokes `/x4:doc <change_name> [spec_name]`

## Purpose

Update OpenSpec planning artifacts based on discussion conclusions, and keep request/spec/design/tasks/test_tasks/ui_knowledge consistent in one documentation pass.

## Document Detail Authority (MANDATORY)

`x4-doc` is the single source of truth for document details used by both `/x4:new` and `/x4:ff`, including:
- document structure and content conventions
- writing style and localization rules
- test documentation conventions (`test_tasks.md`, `ui_knowledge.md`)
- documentation synchronization/update rules

`x4-new` and `x4-ff` should orchestrate progression only and must not redefine these details.

## Parameters

- `<change_name>`: The name of the change folder in `openspec/changes/` (e.g., `storage-auto-fill`). If it doesn't exist, create it.
- `[spec_name]` (Optional): The sub-folder name for the spec (e.g., `storage-logic`). If provided, create `specs/<spec_name>/spec.md`. If omitted, use the change name or default location.
- `<change_name>` accepts abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Input

- Discussion conclusions from `/x4:discuss`
- Existing planning artifacts (if any) to update

## Actions

1. Resolve change target and load existing planning artifacts in `openspec/changes/<change-name>/`.
2. Create or update affected artifacts: `request.md`, `design.md`, `tasks.md`, `test_tasks.md`, `ui_knowledge.md`, and `specs/<feature>/spec.md` when applicable.
3. Apply Delta Structures if modifying existing specs.
4. Ensure localization matches user language.
5. Enforce cross-file consistency:
   - requirement/DoD changes must be reflected in `tasks.md` and `test_tasks.md`;
   - Web Integration test changes must be synced into `ui_knowledge.md`;
   - fixture-backed product/module mentions must sync into `ui_knowledge.md`.

## Project Standards (MANDATORY)

### 0. `request.md` Positioning (MANDATORY)

`request.md` must serve two goals at the same time:

1. **Reviewability**: user can quickly judge whether requirements are correctly understood.
2. **Single-source generation input**: downstream artifacts (`spec/design/tasks/test_tasks/ui_knowledge`) can be generated from `request.md` without relying on chat history.

#### 0.1 Required Content (Minimum)

When creating/updating `request.md`, it MUST contain:

1. `目标`：一句话到三句话说明本次变更要解决什么。
2. `已确认方案（审核重点）`：按主题列出已定方案（入口、流程、映射、异常/告警、保存策略等）。
3. `边界`：`In Scope` 与 `Out of Scope`。
4. `验收标准（DoD）`：可验证条目（面向行为与结果）。
5. `未决项`：若无，明确写“无”。

#### 0.2 Granularity Rule (Very Important)

`request.md` should be **medium-granularity**:

1. MUST NOT be too brief (e.g., only discussion summary bullets).
2. MUST NOT be over-detailed design/implementation doc (algorithm internals, file-level implementation details, test code details).
3. MUST focus on decisions and constraints that are required for later document generation.

#### 0.2.1 Detail Parity Rule (MANDATORY)

If user requirements and final discussion conclusions contain concrete details, `request.md` MUST preserve that level of detail.

1. Do NOT downsample confirmed details into vague summaries.
2. Keep explicit branch behaviors, mapping constraints, exception/warning handling, and acceptance-critical conditions.
3. Compression is allowed only for duplicated wording, not for loss of confirmed requirements.

#### 0.3 Single-Source Rule

`request.md` MUST include enough confirmed decisions so that a different agent can generate later artifacts using `request.md` alone.
Do not rely on “implicit context from previous conversation” for key requirements.

#### 0.4 Orchestrator Validation Hook

When `/x4:new` or `/x4:ff` needs to validate `request.md`, they must reuse Section 0 checks in this file instead of redefining local criteria.

### 1. Immutable Headers (English Only)

When generating or translating spec documents (`.md` in `openspec/`), **YOU MUST** preserve the following headers in English:
- `# [Name] Specification`
- `## Purpose`
- `### Requirement: [Name]`
- `#### Scenario: [Name]`
- `## ADDED Requirements`
- `## MODIFIED Requirements`
- `## REMOVED Requirements`
- `## RENAMED Requirements`

### 2. Localization (Match User Language)

- **Body Content**: The content (Purpose, Requirement descriptions, Scenario steps) **MUST** be written in the user's current conversation language (e.g., Chinese).
- **Design Docs**: The content of `design.md` (Architecture, Decisions, etc.) **MUST** be written in the user's current conversation language.
- **Keywords**: Keep technical terms, code references, and keywords (`SHALL`, `MUST`) in English.
- **Scenario Keywords (Chinese)**: `**前提**` (Given), `**当**` (When), `**那么**` (Then), `**并且**` (And).

### 3. Delta Structures (For Changes)

- **ADDED**: Use `## ADDED Requirements` for new features instead of `## Requirements`.
- **MODIFIED**: Use `## MODIFIED Requirements` for changes to existing logic.
- **RENAMED**: `- FROM: ### Requirement: [Old Name]` / `- TO:   ### Requirement: [New Name]`
- **REMOVED**: Must include justification. No `Scenario` blocks.

### 4. Specs Directory Structure

- **Feature Folders**: All specs MUST reside in a feature-specific subdirectory under `specs/` (e.g., `specs/title-as-plan-title/spec.md`). Do NOT place spec files directly in `specs/`.

### 5. UI Knowledge Baseline + Fixture Sync (MANDATORY)

For every `/x4:doc` run, `openspec/changes/<change-name>/ui_knowledge.md` is a required artifact:

- MUST ensure `ui_knowledge.md` exists for the current change.
- If missing, create it in the same documentation pass.
- MUST keep it synchronized with `test_tasks.md` whenever test-relevant semantics change.

### 5.1 Fixture-to-UI Knowledge Sync (MANDATORY)

When `/x4:doc` updates test-related docs, you **MUST** sync fixture-backed product/module data into `openspec/changes/<change-name>/ui_knowledge.md`:

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

### 6. test_tasks Step Style (MANDATORY)

When creating or updating `test_tasks.md` via `/x4:doc`, use the following generation rules:

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
   - Do not use only “用例/验证” bullets without actionable steps.

### 6.1 Requirement-Change Test Migration (MANDATORY)

When requirements change and existing `test_tasks.md` steps become unexecutable:

1. Replace obsolete interaction steps with executable steps for the new flow in the same update.
2. Do NOT leave contradictory old wording (e.g., removed controls such as old “继续” flow) in active checklist items.
3. Keep historical execution records, but add a migration note that defines the new valid regression scope.
4. If old `[x]` items no longer represent the current behavior, add corresponding new regression items as unchecked and explicitly mark them as the current baseline.

### 6.1.1 E2E Two-Chapter Layout (MANDATORY)

When writing `test_tasks.md`, E2E MUST be split into two chapters:

1. Bootstrapping & State chapter
   - startup checks
   - fixture/data preloading checks
   - initial state checks (`状态：` mapped items)
   - state-switch checks (`切换：` mapped items)
2. Scenario Content chapter
   - business behavior and user-flow assertions
   - all non-state scenario coverage

### 6.2 State + Transition Chapter in `test_tasks.md` (MANDATORY)

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

### 6.3 Standard State Task Contract (MANDATORY)

When requirements introduce reusable states, `x4-doc` MUST document both state tests and state-switch tests as first-class checklist items.

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

### 7. Task Scope Boundary (MANDATORY)

When creating or updating planning artifacts:

- `tasks.md` is implementation-only and MUST NOT include:
  - writing test code
  - running tests
- Test work must be tracked in `test_tasks.md` and handled by test-phase skills.
- `/x4:apply` scope MUST NOT include writing tests or running tests.
- `/x4:apply` must include build validation after code writing is complete:
  - `npm run build`
  - if build has compile errors, fix code and rerun build until pass or explicit blocker

## Constraints

- **ENFORCE Zero-Code Policy**: Do not touch source code
- Only modify files within `openspec/` or other documentation

## Output

- Updated OpenSpec planning artifacts (all affected files, not only spec files)
- Confirmation of changes made

## Example Usage

```
/x4:doc storage-auto-fill
/x4:doc storage-auto-fill storage-logic
```
