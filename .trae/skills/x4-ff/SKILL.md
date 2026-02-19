---
name: x4-ff
description: "Fast-forward create all OpenSpec artifacts for X4 project. Invoke when user triggers /x4:ff to quickly generate spec, design, tasks, test_tasks, and ui_knowledge."
---

# X4 Fast-Forward Creation

This skill quickly creates all artifacts needed for implementation in one go.

## Trigger

User invokes `/x4:ff <change_name>`

## Purpose

Quickly create all artifacts needed for implementation in one go.

## Input

- Change name (kebab-case) OR description of what to build
- **If coming from `/x4:discuss`**: Discussion conclusions from previous conversation

## Actions

### Step 1: Check Context

Determine if this `/x4:ff` follows a `/x4:discuss` phase:
- **Yes**: Discussion conclusions exist in current conversation context
- **No**: User provides change name/description directly

### Step 2: Generate `request.md` (If from Discuss)

**If coming from `/x4:discuss`**, **YOU MUST** first generate `request.md`:

1. Create change directory: `openspec/changes/<change-name>/`
2. Generate `request.md` with complete discussion conclusions:
   - Feature description and business context
   - User scenarios and acceptance criteria
   - Technical constraints and dependencies
   - Any decisions made during discussion

**request.md Template**:
```markdown
# Request: [Change Name]

## 背景

[Business context and problem statement]

## 功能描述

[Feature description from discussion]

## 用户场景

[User scenarios and acceptance criteria]

## 技术约束

[Technical constraints and dependencies]

## 讨论结论

[Key decisions made during discussion]
```

### Step 3: Read OpenSpec FF Skill

**MANDATORY**: Read `.trae/skills/openspec-ff-change/SKILL.md` for detailed steps

### Step 4: Generate All Artifacts

Generate all artifacts in dependency order (based on `request.md` content):
- `spec.md` (or delta spec)
- `design.md` (if needed)
- `tasks.md`
- `test_tasks.md` (MANDATORY for functional changes)
- `ui_knowledge.md` (MANDATORY if test_tasks.md includes Web Integration Tests)
- `bugs.md` (if bugs were identified)

## Context Injection

- **Language**: Generate all documentation in user's current conversation language
- **No-Translate**: Do NOT translate `Requirement:`, `Scenario:`, or `SHALL`/`MUST` keywords
- **Test Tasks**: Generate `test_tasks.md` immediately after spec/tasks are created
- **UI Knowledge**: Generate `ui_knowledge.md` immediately after `test_tasks.md` is created

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

### 4. Request Document (`request.md`)

- **Purpose**: Captures the complete discussion conclusions before entering `/x4:new` or `/x4:ff`.
- **Location**: `openspec/changes/<change-name>/request.md`.
- **Role**: **Single Source of Truth** for generating all OpenSpec artifacts. Nothing should be omitted.

### 5. Test Planning (`test_tasks.md`)

- **Sync Rule**: Whenever `tasks.md` is created/updated, **YOU MUST** simultaneously create or update `test_tasks.md`.
- **UI Knowledge Sync**: Whenever `test_tasks.md` is updated with new Web Integration Tests, **YOU MUST** simultaneously update `ui_knowledge.md`.
- **Language**: The content **MUST** be written in the user's current conversation language.
- **Grouping**: Tasks **MUST** be grouped into "**Unit Tests**" and "**Web Integration Tests**".

### 6. UI Knowledge Base (`ui_knowledge.md`)

- **Sync Rule**: MUST be generated based strictly on the actions defined in `test_tasks.md`.
- **Update Sync**: Whenever `test_tasks.md` is updated (new tests added), **YOU MUST** update `ui_knowledge.md` to include locators and flows for the new tests.
- **Scope Limitation**: Only provide flows, locators, and data bindings for elements and actions explicitly required by `test_tasks.md`. Do NOT document the entire UI or irrelevant features.
- **Dynamic Locator Extraction**: Since a global UI Map does not exist, **YOU MUST scan and parse the relevant source code files** (e.g., frontend components, HTML templates) to find the exact DOM selectors (IDs, classes, `name` attributes) for the required steps.
- **Data Binding Constraint**: All test data sources **MUST** be mapped to files in the `test/fixtures/` directory. You must explicitly clarify the search/input logic (e.g., whether an input requires a fixture's `id` field or `name` field).

### 7. Specs Directory Structure

- **Feature Folders**: All specs MUST reside in a feature-specific subdirectory under `specs/` (e.g., `specs/title-as-plan-title/spec.md`). Do NOT place spec files directly in `specs/`.

## Constraints

- **ENFORCE Zero-Code Policy**: Do not touch source code
- Apply **Project Standards** immediately
- **Nothing from `request.md` should be omitted**
- **If from discuss**: Generate `request.md` BEFORE other artifacts

## Output

- Change directory with all artifacts
- Status: "All artifacts created! Ready for implementation."
