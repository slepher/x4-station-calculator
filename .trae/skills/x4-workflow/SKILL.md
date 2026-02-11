---
name: x4-workflow
description: Orchestrate X4 Station Calculator development workflow with OpenSpec. (Trigger: /x4:discuss, /x4:doc, /x4:ff, /x4:new, /x4:apply, /x4:verify, /x4:archive)
---

# X4 Project Workflow

This skill acts as the central orchestrator for the X4 Station Calculator project. It enforces project-specific standards for document generation, localization, and test planning while delegating core actions to OpenSpec skills.

## Project Standards (MANDATORY)

**1. Immutable Headers (English Only)**
When generating or translating spec documents (`.md` in `openspec/`), **YOU MUST** preserve the following headers in English:
- `# [Name] Specification`
- `## Purpose`
- `### Requirement: [Name]`
- `#### Scenario: [Name]`
- `## ADDED Requirements`
- `## MODIFIED Requirements`
- `## REMOVED Requirements`
- `## RENAMED Requirements`

**2. Localization (Match User Language)**
- **Body Content**: The content (Purpose, Requirement descriptions, Scenario steps) **MUST** be written in the user's current conversation language (e.g., Chinese).
- **Keywords**: Keep technical terms, code references, and keywords (`SHALL`, `MUST`) in English.
- **Scenario Keywords (Chinese)**: `**前提**` (Given), `**当**` (When), `**那么**` (Then), `**并且**` (And).

**3. Delta Structures (For Changes)**
- **ADDED**: Use `## ADDED Requirements` for new features instead of `## Requirements`.
- **MODIFIED**: Use `## MODIFIED Requirements` for changes to existing logic.
- **RENAMED**: `- FROM: ### Requirement: [Old Name]` / `- TO:   ### Requirement: [New Name]`
- **REMOVED**: Must include justification. No `Scenario` blocks.

**4. Test Planning (`test_tasks.md`)**
- **Sync Rule**: Whenever `tasks.md` is created/updated, **YOU MUST** simultaneously create or update `test_tasks.md`.
- **Feature Additions & Bug Fixes**: If new functionality is added OR a bug is fixed during implementation, **YOU MUST** add corresponding verification steps to `test_tasks.md`.
- **Language**: The content of test tasks **MUST** be written in the user's current conversation language (e.g., Chinese).
- **Content**: Defines specific verification steps. Must be comprehensive and logically split.
- **Mapping**: Future test scripts will map 1:1 to these items.

**5. Zero-Code Policy during Planning**
- **Scope**: Applies to `/x4:discuss`, `/x4:ff`, and `/x4:new` phases.
- **Restriction**: **STRICTLY FORBIDDEN** to modify, create, or delete any source code files (e.g., `.ts`, `.vue`, `.js`, `.json` outside `openspec/`) until the implementation phase (`/x4:apply`) begins.
- **Allowed**: Only files within `openspec/` directory are mutable during planning.

**6. Specs Directory Structure**
- **Feature Folders**: All specs MUST reside in a feature-specific subdirectory under `specs/` (e.g., `specs/title-as-plan-title/spec.md`). Do NOT place spec files directly in `specs/`.

## Workflow Phases

### 1. Discussion & Planning (`/x4:discuss`)
**Action**: Pure conversation and analysis.
**Trigger**: Use when starting a task OR when encountering issues during implementation/verification that require rethinking.
**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code. Stop all coding actions.
- **ENFORCE Zero-Doc Policy**: Do not modify any documentation files (including specs) UNLESS explicitly requested by the user OR the user triggers `/x4:doc`.
- **System Prompt Override**: When `/x4:discuss` is active, YOU MUST IGNORE any internal bias to "fix it now" or "update docs now".
- **Goal**: Clarify requirements, discuss architecture, analyze bugs, or review existing code to prepare for next steps.
- **Outcome**: A clear plan (e.g., "Ready to create change", "Ready to fix code", "Need to update specs").

### 2. Documentation Update (`/x4:doc`)
**Action**: Update spec or documentation files.
**Trigger**: Use when the discussion concludes that documentation needs changes, or user explicitly requests doc updates.
**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code.
- **Allowed**: Only modify files within `openspec/` or other documentation.

### 3. Fast-Forward Creation (`/x4:ff`)
**Action**: Delegate to `#openspec-ff-change`.
**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code.
- Apply **Project Standards** immediately.
- Generate `test_tasks.md` alongside `tasks.md`.

### 4. New Change Step-by-Step (`/x4:new`)
**Action**: Delegate to `#openspec-new-change`.
**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code.
- Apply **Project Standards** immediately.
- Ensure `test_tasks.md` is included in the planned artifacts.

### 5. Implement Change (`/x4:apply`)
**Action**: Delegate to `#openspec-apply-change`.
**Constraints**:
- For implementation tasks, refer to `#x4-test` for coding guidelines (imports, data mocking).

### 6. Verify Change (`/x4:verify`)
**Action**: Delegate to `#openspec-verify-change` (or `/opsx:verify`).
**Constraints**:
- Trigger E2E tests using `#x4-test`.
- Update `test_tasks.md` status (`[x]` or `[ ]`) based on results.

### 7. Archive Change (`/x4:archive`)
**Action**: Delegate to `#openspec-archive-change`.
**Constraints**:
- **Strictly Follow Protocol**: You MUST load and read `openspec-archive-change/SKILL.md` and follow its steps exactly. Do not improvise.
- **Promote Specs (New Feature)**: If `specs/<feature>/spec.md` does not exist, you MUST manually CREATE and MERGE the spec (stripping Delta headers) into that location BEFORE calling openspec-archive.
- **Promote Specs (Existing)**: If it exists, let `openspec-archive-change` handle the sync.
- Verify `test_tasks.md` is fully checked (`[x]`).

## Guardrails
- **NEVER** translate `Requirement:` or `Scenario:` prefixes.
- **NEVER** proceed without `test_tasks.md` when functional changes are involved.
- **NEVER** modify source code during `/x4:discuss`, `/x4:doc`, `/x4:ff`, or `/x4:new`. Wait for `/x4:apply`.
