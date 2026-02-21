---
name: x4-doc
description: "Update spec or documentation files for X4 project. Invoke when user triggers /x4:doc to update specs based on discussion conclusions."
---

# X4 Documentation Update

This skill handles documentation updates for the X4 Station Calculator project.

## Trigger

User invokes `/x4:doc <change_name> [spec_name]`

## Purpose

Update spec or documentation files based on discussion conclusions.

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
- Existing specs (if any) to update

## Actions

1. Create or update spec files in `openspec/` directory
2. Apply Delta Structures if modifying existing specs
3. Ensure localization matches user language
4. When test scenarios mention specific products/modules, sync related fixture data into `ui_knowledge.md`

## Project Standards (MANDATORY)

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

### 5. Fixture-to-UI Knowledge Sync (MANDATORY)

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

When creating or updating `test_tasks.md` via `/x4:doc`, Web Integration items must use operation-level steps from the first draft:

- Steps must be explicit UI actions in chronological order, e.g. click, input, rename, drag, save, refresh, wait for visible.
- Steps must include concrete UI targets (button text/class, tab name, input field).
- Do not use implementation wording in `步骤` (e.g. `mouse.move`, `boundingBox`, `locator()`, `evaluate()`, array diff logic).
- If `test_tasks.md` step wording changes, sync equivalent operation wording to `ui_knowledge.md` in the same update.

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

- Updated spec files
- Confirmation of changes made

## Example Usage

```
/x4:doc storage-auto-fill
/x4:doc storage-auto-fill storage-logic
```
