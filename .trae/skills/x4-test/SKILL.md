---
name: x4-test
description: Execute and write E2E tests for X4 Station Calculator using Playwright.
metadata:
  version: "1.2"
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
- **Timeouts**: **STRICT 500ms** limit for element waiting (expect default). Use `waitForTimeout` only when absolutely necessary (e.g. debouncing).
- **Viewport**: Always use `1920x1080` (configured in `playwright.config.ts`).
- **Performance Optimization**:
  - **Disable Animations**: In `beforeEach`, inject CSS to disable all transitions/animations:
    ```typescript
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    ```
  - **Fast Inputs**: Use `dispatchEvent` for inputs to bypass slow typing if needed, but prefer standard `fill` unless too slow.
- **Interaction Rules**:
  - **Search**: Fill -> Wait (e.g., 300ms for debounce) -> Click Result.
  - **Reset**: Always clear state (localStorage/sessionStorage) in `beforeEach`.

## 3. Test-Document Mapping
- **Source**: Tests are derived strictly from `test_tasks.md`.
- **Mapping**: Each `test('description', ...)` block must correspond 1:1 to a checklist item in `test_tasks.md`.
- **Validation**: When running tests, verify that `test_tasks.md` accurately reflects the pass/fail status.

## 4. Execution Protocol
- **Scope**: You **MUST** run both **Unit Tests** (Vitest) and **Web Integration Tests** (Playwright). Do not omit either type if they exist in `test_tasks.md`.
- **Targeted Execution**: When starting verification, only run the tests corresponding to the current items in `test_tasks.md`. Do not run the full regression suite unless requested.
- **Status Sync**: After every test run, you **MUST** update `test_tasks.md`:
  - **Pass**: Mark with `[x]`.
  - **Fail**: Mark with `[ ]` and append `<!-- FAILED: [Reason] -->`.

## 5. Verification Guardrails
- **Pre-Test Check**: **ALWAYS** run `npm run build` before running tests to ensure there are no syntax errors in the codebase.
- **I18n Checks**:
  - Detect broken translations: Check for `ui.` prefixes or `!!{id}!!`.
  - Use regex for dynamic text: `/Name|名称/`.
- **State Isolation**: Never manipulate Pinia/Vue state directly via JS.

## Guardrails
- **NEVER** use `import data from '...json'`.
- **NEVER** merge multiple `test_tasks.md` items into one test case.
