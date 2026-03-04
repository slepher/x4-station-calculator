---
name: x4-doc
description: "Update OpenSpec planning artifacts for X4 (`request/spec/design/tasks`) based on discussion conclusions, with mandatory cross-file sync. Test docs delegated to x4-test-doc + x4-test-doc-viewer gate."
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
- documentation synchronization/update rules

`x4-new` and `x4-ff` should orchestrate progression only and must not redefine these details.

**Test Documentation Authority**: Test documentation details (`test_tasks.md`, `ui_knowledge.md`) are delegated to `/x4:test-doc` skill, and final draft approval is gated by `/x4:test-doc-viewer`.

## Parameters

- `<change_name>`: The name of the change folder in `openspec/changes/` (e.g., `storage-auto-fill`).
- `[spec_name]` (Optional): The sub-folder name for the spec (e.g., `storage-logic`). If provided, create `specs/<spec_name>/spec.md`. If omitted, use the change name or default location.
- `<change_name>` accepts abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Input

- Discussion conclusions from `/x4:discuss`
- Existing planning artifacts (if any) to update

## Actions

1. Resolve change target and load existing planning artifacts in `openspec/changes/<change-name>/`.
2. Create or update affected artifacts: `request.md`, `design.md`, `tasks.md`, `specs/<feature>/spec.md` when applicable.
3. For test documentation updates (`test_tasks.md`, `ui_knowledge.md`), delegate to `/x4:test-doc` skill.
4. Require `/x4:test-doc-viewer` review pass for the final test-doc draft before considering test-doc update complete (must run in dedicated isolated reviewer subagent).
5. If reviewer returns `review_status=rewrite_required`, route back to `/x4:test-doc` rewrite and resubmit to viewer until pass.
6. Apply Delta Structures if modifying existing specs.
7. Ensure localization matches user language.
8. Enforce cross-file consistency:
   - requirement/DoD changes must be reflected in `tasks.md`;
   - test documentation updates are delegated to `/x4:test-doc` and gated by `/x4:test-doc-viewer`.

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

### 5. Test Documentation Delegation (MANDATORY)

For test documentation updates (`test_tasks.md`, `ui_knowledge.md`), delegate to `/x4:test-doc` skill and enforce `/x4:test-doc-viewer` review pass:
- Do NOT directly modify `test_tasks.md` or `ui_knowledge.md` in `/x4:doc`.
- Use `/x4:test-doc` for all test documentation changes.
- Use `/x4:test-doc-viewer` as final reviewer gate for test documentation.

### 5.1 Test-Doc Review Loop (MANDATORY)

When `/x4:doc` flow includes test documentation:

1. Run `/x4:test-doc <change-name>` to produce/update final draft.
2. Run `/x4:test-doc-viewer <change-name>` as reviewer gate in a dedicated isolated reviewer subagent.
3. If reviewer returns `review_status=rewrite_required`:
   - route back to `/x4:test-doc` with blocking rewrite items;
   - rerun `/x4:test-doc-viewer` after rewrite.
4. `/x4:doc` must not report test-doc complete until reviewer returns `review_status=pass`.
5. If isolated reviewer subagent cannot be created, stop and report blocker; do not perform in-thread review fallback.

### 6. Task Scope Boundary (MANDATORY)

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
