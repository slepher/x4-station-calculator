---
name: x4-user-workflow
description: "Orchestrate X4 Station Calculator development workflow with OpenSpec. (Trigger: /x4:discuss, /x4:doc, /x4:ff, /x4:new, /x4:apply, /x4:verify, /x4:archive)"
---

# X4 Project Workflow

This skill acts as the central orchestrator for the X4 Station Calculator project. It enforces project-specific standards for document generation, localization, and test planning while delegating core actions to OpenSpec skills.

## Project Standards (MANDATORY)

**1. Immutable Headers (English Only)**f
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
- **Design Docs**: The content of `design.md` (Architecture, Decisions, etc.) **MUST** be written in the user's current conversation language.
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
- **Grouping**: Tasks **MUST** be grouped into "**Unit Tests**" (for logic/functions) and "**Web Integration Tests**" (for UI/E2E).
- **Performance First**: Web Integration Tests **MUST** be designed for extreme speed (target <500ms per interaction). Avoid long waits.
- **Content**: Defines specific verification steps. Must be comprehensive and logically split.
- **Mapping**: Future test scripts will map 1:1 to these items.

**5. Test Experience & Locator Loop (MANDATORY)**
- **Sync Rule**: Whenever an E2E test passes or fails due to a locator issue, **YOU MUST** immediately update `openspec/test_experience.md`.
- **Content**: Record the successful DOM path (✅), the logical description, and any "Pitfalls" (e.g., timing issues, i18n mismatches).
- **Continuity**: Updating this documentation is a sub-step of the current task. Do NOT terminate the turn after updating.

**6. Zero-Code Policy during Planning**
- **Scope**: Applies to `/x4:discuss`, `/x4:ff`, and `/x4:new` phases.
- **Restriction**: **STRICTLY FORBIDDEN** to modify, create, or delete any source code files (e.g., `.ts`, `.vue`, `.js`, `.json` outside `openspec/`) until the implementation phase (`/x4:apply`) begins.
- **Allowed**: Only files within `openspec/` directory are mutable during planning.

**6. Specs Directory Structure**
- **Feature Folders**: All specs MUST reside in a feature-specific subdirectory under `specs/` (e.g., `specs/title-as-plan-title/spec.md`). Do NOT place spec files directly in `specs/`.

**7. General Development Rules (Imported from Project Rules)**
**变更零污染准则 (Zero-Contamination Principle)**：
  - **禁止重写非变动逻辑**：LLM 严禁自行手工编写、复写或重构任何任务目标之外的逻辑行。在构造替换文本时，除必须修改的逻辑点外，其余部分必须与原文件内容保持物理一致, 但是可以提醒用户, 逻辑存在问题, 请检查并修复。
  - **禁止添加或者删除注释**：LLM 严禁添加或删除任何代码行中的注释。即使注释内容错误或不规范，也不能被修改。但是可以提醒用户, 注释内容必须与代码逻辑保持一致。
  - **否定排版偏好**：原始代码的排版（包括缩进、空格、换行等）被视为受保护的项目资产。严禁以“美化”、“优化”或“清理”为由进行任何未授权的变动。但是可以提醒用户, 排版存在问题, 请检查并修复。
  - **例外说明**：上述限制仅在用户未明确发出排版指令时生效。若用户明确要求“重新排版”或“重构风格”，则 LLM 应按指令执行格式变动。

**工作环境要求**：
  - **运行环境**：Windows PowerShell（使用分号分隔命令）
  - 使用git的的时候应该禁用less功能, 否则会导致git命令无法正常执行
  - 执行命令行任务的时候应该先确认当前目录为工作目录再执行, 否则会导致任务执行失败
  - i18n 的原则是只要i18n本身, 不需在组件中硬编码fallback 
    **举例** 是t('ui.volume_overview') 而不是 t('ui.volume_overview') || 'Volume Overview'

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

### 2. Documentation Update (`/x4:doc <change_name> [spec_name]`)
**Action**: Update spec or documentation files.
**Trigger**: Use when the discussion concludes that documentation needs changes, or user explicitly requests doc updates.
**Parameters**:
- `<change_name>`: The name of the change folder in `openspec/changes/` (e.g., `storage-auto-fill`). If it doesn't exist, create it.
- `[spec_name]` (Optional): The sub-folder name for the spec (e.g., `storage-logic`). If provided, create `specs/<spec_name>/spec.md`. If omitted, use the change name or default location.
**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code.
- **Allowed**: Only modify files within `openspec/` or other documentation.

### 3. Fast-Forward Creation (`/x4:ff`)
**Action**: **MANDATORY**: Search for and read `.trae/skills/openspec-ff-change/SKILL.md`.
**Context Injection**:
- **Language**: You MUST generate all documentation (specs, tasks) in the user's current conversation language (e.g., Chinese).
- **No-Translate**: Do NOT translate `Requirement:`, `Scenario:`, or `SHALL`/`MUST` keywords.
- **Test Tasks**: You MUST generate `test_tasks.md` immediately after the spec/tasks are created.
**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code.
- Apply **Project Standards** immediately.

### 4. New Change Step-by-Step (`/x4:new`)
**Action**: **MANDATORY**: Search for and read `.trae/skills/openspec-new-change/SKILL.md`.
**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code.
- Apply **Project Standards** immediately.
- Ensure `test_tasks.md` is included in the planned artifacts.

### 5. Implement Change (`/x4:apply`)
**Action**: **MANDATORY**: Search for and read `.trae/skills/openspec-apply-change/SKILL.md`.
**Constraints**:
- For implementation tasks, refer to `#x4-test` for coding guidelines (imports, data mocking).

### 6. Verify Change (`/x4:verify`)
**Action**: **MANDATORY**: Search for and read `.trae/skills/openspec-verify-change/SKILL.md`.
**Constraints**:
- Trigger E2E tests using `#x4-test`.
- Update `test_tasks.md` status (`[x]` or `[ ]`) based on results.

### 7. Archive Change (`/x4:archive`)
**Action**: **MANDATORY**: Search for and read `.trae/skills/openspec-archive-change/SKILL.md`.
**Constraints**:
- **Strictly Follow Protocol**: You MUST load and read `openspec-archive-change/SKILL.md` and follow its steps exactly. Do not improvise.
- **Promote Specs (New Feature)**: If `specs/<feature>/spec.md` does not exist, you MUST manually CREATE and MERGE the spec (stripping Delta headers) into that location BEFORE calling openspec-archive.
- **Promote Specs (Existing)**: If it exists, let `openspec-archive-change` handle the sync.
- Verify `test_tasks.md` is fully checked (`[x]`).

## Guardrails
- **NEVER** translate `Requirement:` or `Scenario:` prefixes.
- **NEVER** proceed without `test_tasks.md` when functional changes are involved.
- **NEVER** modify source code during `/x4:discuss`, `/x4:doc`, `/x4:ff`, or `/x4:new`. Wait for `/x4:apply`.
