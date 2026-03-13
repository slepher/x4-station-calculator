# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development server (hot reload)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Unit tests (Vitest)
npm run test:unit
# Run single test file
npm run test:unit -- tests/unit/<path>/<file>.spec.ts

# E2E tests (Playwright)
npm run test:e2e
# Run single test file
npm run test:e2e -- tests/e2e/<path>/<file>.spec.ts
# Interactive UI mode
npm run test:e2e:ui

# Install Playwright browsers
npm run playwright:install
```

## Project Architecture

This is a Vue 3 + TypeScript + Vite application for X4: Foundations station planning. It uses Pinia for state management with a multi-layered store architecture.

### Key Technologies

- **Vue 3** with `<script setup>` SFCs
- **Pinia** for state management
- **Vue I18n** for internationalization (en/zh-CN)
- **Vue Tippy** for tooltips
- **Vue Draggable** for drag-and-drop (vuedraggable@4)
- **Tailwind CSS** for styling
- **Playwright** for E2E testing
- **Vitest** for unit testing

### Data Locations

- **App UI texts**: `src/locales/en.json`, `src/locales/zh-CN.json`
- **Game data**: `src/assets/x4_game_data/8.0-Diplomacy/data/*.json`
- **Game locale texts**: `src/assets/x4_game_data/8.0-Diplomacy/locales/`
  - Locale keys correspond to `nameId` field in game entities (e.g., `{20101,60201}`)
  - Format: `{page,id}` where page is the text page number

### Store Architecture

The application uses a hierarchical store structure with four main stores:

#### 1. `useGameDataStore` - Game Data Source

Loads and provides X4 game data (modules, wares, medical consumption). Pre-computes:
- `waresMap` / `modulesMap` - Lookup maps for game entities
- `modulesByOutputMap` - Maps wareId → modules that produce it
- `wareSetsByIndustrialRace` / `wareSetsByRace` - Race-specific ware sets for logic flow
- `volumeCompressionMap` - Pre-computed volume compression ratios

#### 2. `useEmpireStore` - Empire Management

Manages multi-station empires with V2 storage schema:
- `activeEmpire` - Current working empire with stations array
- `stationFlowCache` - Computed flow data per station (via `StationStateMap`)
- Handles data migration from V1 (single station) to V2 (empire-based)
- Persistence: `localStorage` key `x4_empire_data`

#### 3. `useStationStore` - Station Planning (Legacy Bridge)

Bridge layer that connects to `StationStateMap` for actual computations:
- Uses `getActiveContext()` to get current station state from `stationStateMap`
- Provides `applyAndRecompute()` pattern for state mutations
- Delegates all calculations to `StationStateMap.recompute()`

#### 4. `useLogicFlowStore` - Logic Flow Planning

Manages production line groups with upstream expansion:
- `groups` - Array of `ProductionLineGroup` with nodes
- Node types: manual (user-added), auto (auto-expanded), isolated (disconnected)
- Drag-and-drop support for adding wares to groups
- Lineage tracking for race-specific module selection

### State Management Pattern: StationStateMap

`StationStateMap` (in `src/store/state/StationStateMap.ts`) is a reactive state container outside Pinia:

```typescript
// Pattern for state mutations
function applyAndRecompute(writer: (stationId: string) => void) {
  const ctx = getActiveContext()
  const stationId = ctx.station?.id || '__local__'
  writer(stationId)
  const deps = getComputeDeps()
  if (deps) stationStateMap.recompute(stationId, deps)
  syncActiveStationFromState(false)
}
```

Computation pipeline in `recompute()`:
1. `calculateAutoFill()` - Determines auto-industry modules based on gaps
2. `calculateWorkforceBreakdown()` / `calculateActualWorkforce()` - Workforce needs
3. `buildResolvedWarePriority()` - Priority levels for ware filtering
4. `analyzeWareFlow()` - Builds grouped flows with volume calculations
5. `analyzeStation()` - Cost/volume/time analysis

### Type System

Core types in `src/types/x4.ts`:
- `X4Module` / `X4Ware` - Game data entities
- `StationPlan` - Persisted station configuration
- `WareFlow` - Computed flow with quantity, volume, value dimensions
- `FlowNode` / `ProductionLineGroup` - Logic flow entities
- `EmpirePlan` - V2 empire storage schema

### Key Utilities

- `@/store/logic/useGameData.ts` - Game data builders and pre-computation
- `@/store/logic/analyzeWareFlow.ts` - Flow analysis with buffer calculations
- `@/store/logic/logicFlowStream.ts` - Upstream expansion algorithm

### Testing Structure

Tests are organized by feature with co-located unit and E2E tests:

```
tests/
├── e2e/<feature-name>/          # Playwright tests
├── unit/<feature-name>/         # Vitest tests
├── fixtures/                    # Test data (YAML)
└── test_experience.md           # Locator knowledge base
```

Key testing patterns:
- Playwright config uses `webServer` with `npm run preview`
- Stores exposed on `window` for E2E access in dev/test mode (see `App.vue`)
- `data-testid` attributes preferred for stable selectors
- i18n-aware locators using regex: `/文本|Text/i`

### E2E Test beforeEach Requirements

E2E 测试的 `beforeEach` 必须包含以下内容：

1. **加载 fixture**: 读取 `tests/fixtures/db.json`（除 vsn 字段外）到 `localStorage`
2. **reload**: 重新加载页面以初始化 store
3. **设置语言**: 通过 UI 选择器设置当前语言（不能直接操作 localStorage/Cookie）

示例：

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/')

  // 1. 加载 fixture 到 localStorage（排除 vsn 字段）
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  // 移除 vsn 字段
  delete dbData.vsn
  // 根据需要修改 dbData（如设置 activeId）

  await page.evaluate((data) => {
    // 逐个设置 localStorage key
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)

  // 2. reload
  await page.reload()

  // 3. 通过 UI 设置语言（必须通过 UI 触发翻译更新）
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
})
```

**注意**：
- 禁止使用 `localStorage.clear()`，会清除语言设置
- 语言存储使用 Cookie (`user_locale`)，但翻译更新必须通过 UI 触发
- fixture 路径应使用相对于测试文件的路径

### Skills & Workflow

The `.trae/skills/` directory contains markdown skill definitions for the Trae IDE:
- `x4-test` - Test execution workflow
- `x4-ff` / `x4-new` / `x4-bug` - Feature workflows
- `x4-verify` - Verification pipeline

These define the development workflow patterns used in this codebase.

### Skill Resolution Priority

- When both project-local and global skills exist with the same name, check the project-local skill first.
- In this repository, project-local skills live under `.trae/skills/` and are also exposed via `.agents/skills/`.
- Only fall back to global skills after confirming there is no applicable project-local skill.

## Working Guidelines

### When User Asks for Understanding/Analysis
- Provide explanation first, do not modify code without confirmation
- Wait for user to confirm understanding is correct before proceeding
- Never jump straight to code changes

### Handling TypeScript Errors
- **Never delete code to fix compilation errors**
- If TypeScript reports "is declared but its value is never read", investigate whether the code is actually used before removing
- The error might indicate the code path is conditional or behind a feature flag
- Correct approaches:
  - Keep the code and investigate usage
  - Add `// @ts-ignore` if truly unused but kept for future use
  - Add comment explaining why it's kept as备用代码
  - Or actually verify the code is truly unused before removing

### Code Modification Principles
- Get explicit confirmation before making changes
- When asked to explain/understand, provide explanation first
- Don't modify code without approval, even if the changes seem obvious

### Git Worktree Merge
When merging a worktree branch into develop:
- Run `git merge <branch-name>` directly in the develop working directory
- Do NOT push to remote unless explicitly requested
- Example workflow: commit on branch → switch to develop → merge branch
