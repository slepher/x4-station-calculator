# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development server (hot reload)
npm run dev

# Build Rust WASM parser (output to src/wasm/)
# FORBIDDEN to run this unless rust-parser/src/*.rs files are modified
npm run build-rust
# Or manually:
# cd rust-parser && ./build.sh

# Production build
npm run build

# Preview production build
npm run preview

# Unit tests (Vitest)
npm run test:unit
# Run single test file
npm run test:unit -- tests/unit/<path>/<file>.spec.ts

# E2E tests (Playwright)
npm exec playwright test
# Run single test file (use -- to pass args to playwright)
npm exec playwright test -- tests/e2e/<path>/<file>.spec.ts
# Or shorthand for running all tests
npm run test:e2e

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
- `data-testid` attributes preferred for stable selectors (avoid text/i18n matching for non-text elements)
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

### Live Binding E2E Fixture Rule

涉及 Live Production / save-binding / archive 联动的 E2E，不要再手写：
- 从 `db.json` 删除 `x4_save_archives`
- 手动 `saveStore.importFromJson(...)`
- 手动向 `liveStore.playerStationRecords` 回填 records

统一使用：
- `tests/e2e/helpers/loadLiveBindingFixture.ts`
- 入口函数：`loadLiveBindingFixture(page)`

原因：
- `tests/fixtures/db.json` 现在只保留基础 localStorage 状态
- `tests/fixtures/save.json` 承载 save 明细
- `loadLiveBindingFixture(page)` 会负责：
  1. 注入 `db.json` 到 localStorage
  2. 基于 `save.json` 构造 `x4_save_archives` state
  3. 把 `save.json` 写入 IndexedDB
  4. reload 后切到 `live-production`
  5. 通过 UI 设置语言

示例：

```typescript
import { test } from '../../test-setup'
import { loadLiveBindingFixture } from '../helpers/loadLiveBindingFixture'

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)
})
```

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

### UI Layering Principle
- **新方案必须严格采用 `store -> presenter -> vue` 三层结构**
- **不得再添加中间层**。`store` 和 `presenter` 之间、`presenter` 和 `vue` 之间都不允许再引入新的适配层、view model 层、facade UI 层或其他等价中间层
- `store` **不面向 UI 直接输出数据**。`store` 只负责领域状态、持久化状态、计算过程、基础派生和可复用业务能力，不负责为了某个 Vue 组件定制返回结构
- `presenter` **负责面向 UI 组装数据**。所有供界面直接消费的展示结构、组件输入、显示模式切换、分组和 UI 专用字段，都应在 `presenter` 层完成
- `vue` **不得直接调用 `store`**，除读取静态 JSON 数据这类例外情况外，Vue 组件必须通过 `presenter` 取数和触发行为
- `vue` **不得直接调用 `presenter` 以外的业务组装逻辑**。凡是组件内直接拼装 store 数据、直接做 UI 导向的数据变形，均视为违反新方案
- 当前代码中凡是 **没有通过 `presenter` 而直接访问 `store` 的写法，都属于历史遗留问题**。可以识别、记录、渐进清理，但**新方案不得继续采用**
- 设计评审和实现时，默认检查标准是：
  - 这段逻辑是否应留在 `store`
  - 这段面向界面的组装是否应移动到 `presenter`
  - 该 Vue 组件是否仍然直接依赖 `store`

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

### Git Operations Safety
- **当用户说"提交"时，必须先检查本地变动**（`git status`、`git diff`），不得从对话记录里假设没有变动
- **我不是仓库的唯一编辑人**，用户可能在其他终端、编辑器或工具中修改了文件
- 任何 git 操作前，必须先确认当前状态，不得假设状态与对话记录一致
- Do NOT push to remote unless explicitly requested
- Example workflow: commit on branch → switch to develop → merge branch

### Git Command Concurrency
- **禁止并行执行会写入 git index 的 git 命令**，例如 `git add`、`git commit`、`git merge`
- 这类命令必须串行执行：前一个完成后才能执行下一个
- 原因：并行执行容易触发 `.git/index.lock` 冲突

## Analysis Scripts

分析脚本目录：`analysis/`

- `analysis/scripts/` - 正式分析脚本
- `analysis/tmp_scripts/` - 临时分析脚本

**强制规则：**
- **禁止**使用 `python3 -c "..."` 执行临时分析代码
- 必须先创建脚本文件到对应目录，然后执行
- 临时脚本 → `analysis/tmp_scripts/xxx.py` → `python3 analysis/tmp_scripts/xxx.py`
- 正式脚本 → `analysis/scripts/xxx.py` → `python3 analysis/scripts/xxx.py`

**原因：** 使用 `python3 -c "..."` 会触发沙盒确认弹窗，每次执行都需要用户确认，严重妨碍效率。创建脚本文件执行则不会触发确认。

**违反后果：** 每次违反都需要向用户说明原因并道歉。没有例外，无论代码多简单。

## Refactoring Rules

- **禁止在重构中使用 fallback 链**（如 `a || b || c`、`?.modules?.length ?? 0 > 0` 等兜底逻辑）
- 分支条件必须精确映射业务状态，每个分支只做一件事，不依赖 sequential fallback 掩盖逻辑缺失
