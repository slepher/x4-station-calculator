---
name: x4-openspec-standard
description: Enforce OpenSpec standards during document generation, translation, and formatting. This skill MUST be activated whenever creating new spec files or modifying existing ones.
metadata:
  version: "1.1"
---

This skill ensures OpenSpec documents are generated, translated, and formatted correctly. It applies strict structural requirements immediately upon document creation, not just during translation.

**Input**: Any request to generate, write, create, translate, or format OpenSpec files (`.md` in `openspec/`).

**Steps**

1.  **Generate/Protect Immutable Headers**
    When creating or translating documents, **YOU MUST** generate the following headers in English, strictly following the casing/pattern:
    -   `# [Name] Specification`
    -   `## Purpose`
    -   `### Requirement: [Name]` (Keep "Requirement:" in English)
    -   `#### Scenario: [Name]` (Keep "Scenario:" in English)
    -   `## ADDED Requirements`
    -   `## MODIFIED Requirements`
    -   `## REMOVED Requirements`
    -   `## RENAMED Requirements`

2.  **Localize Content (Match User Language)**
    -   **Rule**: The body content (Purpose, Requirement descriptions, Scenario steps) **MUST** be written in the same language as the user's current conversation (e.g., if user speaks Chinese, write body in Chinese).
    -   **Exceptions**: Keep technical terms, code references, and keywords (`SHALL`, `MUST`) in English.
    -   **Scenario Steps**: Recommended keywords for Chinese:
        -   `**前提**` (Given)
        -   `**当**` (When)
        -   `**那么**` (Then)
        -   `**并且**` (And)

3.  **Handle Special Delta Structures**
    -   **RENAMED**:
        -   `- FROM: ### Requirement: [Old Name]`
        -   `- TO:   ### Requirement: [New Name]`
    -   **REMOVED**:
        -   Must include justification text.
        -   No `Scenario` blocks allowed.

4.  **Synchronize Test Tasks**
    -   When creating or generating a task list (e.g., `tasks.md`), **YOU MUST** simultaneously create a `test_tasks.md` file in the same directory.
    -   This file should define specific verification steps. While 1:1 mapping with implementation tasks is not required, the test tasks must be comprehensive, logically split, and strictly mapped 1:1 to future test scripts.

**Guardrails**
-   NEVER translate `Requirement:` or `Scenario:` prefixes.
-   NEVER translate the keywords `SHALL` or `MUST` inside requirement bodies.
-   NEVER translate the delta section headers (ADDED, MODIFIED, etc.).
-   NEVER modify the indentation level of headers.
