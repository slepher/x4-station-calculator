---
name: x4-test
description: Execute, create, or modify E2E tests for the X4 Station Calculator. Use this skill when the user mentions "test", "verification", "Playwright", or "E2E".
metadata:
  version: "1.0"
---

This skill governs the creation and execution of E2E tests for the X4 Station Calculator project.

**Input**: User requests related to testing, verification, or bug reproduction.

**Steps**

1.  **Check Directory Structure**
    Ensure test files mirror the `openspec/changes/` structure.
    - `openspec/changes/station-ui/design.md` -> `tests/station-ui/`

2.  **Verify Environment Setup**
    -   **MANDATORY IMPORT**: Start every test file with:
        ```typescript
        import { test } from '../test-setup'; // Or relative path to test-setup
        import { expect } from '@playwright/test';
        ```
    -   **FORBIDDEN**: Do NOT import `test` from `@playwright/test` directly.
    -   Must use `--reporter=list` when running Playwright.
    -   Must run from project root.

3.  **Validate Test Design**
    -   **Document-Script Mapping**: Verify each `test(...)` corresponds strictly to a task in `test_tasks.md` (1:1 mapping).
    -   **Logical Splitting**: Test tasks should be arranged comprehensively and split logically. They do NOT need to match implementation tasks 1:1.
    -   **Pure UI**: Reject any `page.evaluate` usage for state manipulation. Use UI interactions (Click, Fill, KeyPress) only.
    -   **Data Source**: Hardcode data from `tests/mock/station_mock_data.json` directly into test cases. Do NOT import the JSON file.

4.  **Enforce Interaction Rules**
    -   **Search**: Fill -> Wait (500ms) -> Click Result -> Press Escape.
    -   **Reset**: Always start with "New" button (handle unsaved changes dialog).
    -   **Timeouts**: Max 200ms for element waiting; use `waitForTimeout` sparingly for async logic.

5.  **Verify i18n & Logic**
    -   Check for `ui.` prefixes or `!!{id}!!` patterns to detect broken translations.
    -   Use regex for dynamic text (e.g., `/Name|名称/`).
    -   Use `locator().filter({ hasText: ... })` for nested components.

6.  **Sync & Optimize Execution**
    -   **Sync Status**: After running tests, immediately update `test_tasks.md`. Mark passing tests with `[x]` and failing tests with `[ ]`.
    -   **Skip Passed**: When planning a test run, check `test_tasks.md`. Prioritize running unchecked `[ ]` items. Skip `[x]` items unless the underlying code has been modified since the last run.

**Guardrails**
-   NEVER use `import data from '...json'` in test files.
-   NEVER manipulate Pinia/Vue state directly via JS.
-   NEVER merge multiple `test_tasks.md` items into one test case without user approval.
