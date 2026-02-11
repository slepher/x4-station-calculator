---
name: x4-test
description: Execute and write E2E tests for X4 Station Calculator using Playwright. (Triggered by /x4:verify or "test")
metadata:
  version: "1.1"
---

# X4 Test Execution

This skill governs the **coding and execution** of E2E tests. It is invoked during the `/x4:verify` phase or whenever coding tests.

## 1. Test Environment & Setup
- **Framework**: Playwright + Vitest.
- **Location**: `tests/` directory.
- **MANDATORY Imports**:
  ```typescript
  import { test } from '../test-setup'; // Or relative path
  import { expect } from '@playwright/test';
  ```
  *Note: Do NOT import `test` from `@playwright/test` directly.*

## 2. Coding Standards
- **Pure UI Interactions**: Use Click, Fill, KeyPress. **NO** `page.evaluate` for state manipulation.
- **Data Mocking**: Hardcode data from `tests/mock/station_mock_data.json` directly into test cases. **NO** JSON imports.
- **Timeouts**: Max 200ms for element waiting. Use `waitForTimeout` sparingly.
- **Interaction Rules**:
  - **Search**: Fill -> Wait (500ms) -> Click Result -> Press Escape.
  - **Reset**: Always start with "New" button (handle unsaved changes dialog).

## 3. Test-Document Mapping
- **Source**: Tests are derived strictly from `test_tasks.md`.
- **Mapping**: Each `test('description', ...)` block must correspond 1:1 to a checklist item in `test_tasks.md`.
- **Validation**: When running tests, verify that `test_tasks.md` accurately reflects the pass/fail status.

## 4. Verification Guardrails
- **I18n Checks**:
  - Detect broken translations: Check for `ui.` prefixes or `!!{id}!!`.
  - Use regex for dynamic text: `/Name|名称/`.
- **State Isolation**: Never manipulate Pinia/Vue state directly via JS.

## Guardrails
- **NEVER** use `import data from '...json'`.
- **NEVER** merge multiple `test_tasks.md` items into one test case.
