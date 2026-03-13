# Advanced Resource Filter Visuals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 advanced-resource-filter 增加资源色摘要 tag、候选卡片的 `资源 / 中转` 等宽类型胶囊、资源星区 group badge，以及地图资源六边形 group badge。

**Architecture:** 先在单元测试中锁定 advanced 面板结构与地图 badge 渲染行为，再最小修改 `MapResourceFilterAdvancedPanel`、`MapResourceFilterPanel` 和 `MapSvgCanvas` 的视图模型与样式。地图 badge 语义沿用当前高级过滤计算得到的命中 group 集合，避免引入第二套推导逻辑。

**Tech Stack:** Vue 3 SFC, Pinia/Vitest, scoped CSS, existing map resource filter logic

---

### Task 1: Lock Advanced Panel Behavior With Failing Tests

**Files:**
- Modify: `tests/unit/map-resource-filter/map-resource-filter-panel.spec.ts`

**Step 1: Write the failing test**

- Add a test that switches to advanced mode, creates multiple groups, refreshes candidates, and asserts:
  - summary tags use inline resource fill colors
  - candidate rows render `资源` and `中转` pills
  - both pills use the same width contract via shared class/attribute
  - resource-sector chips render group badges

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/map-resource-filter/map-resource-filter-panel.spec.ts`

**Step 3: Write minimal implementation**

- Extend advanced panel view models and template to render the new structure and badge data.

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/map-resource-filter/map-resource-filter-panel.spec.ts`

### Task 2: Lock Map Badge Rendering With Failing Tests

**Files:**
- Modify: `tests/unit/map-resource-filter/map-svg-canvas.spec.ts`

**Step 1: Write the failing test**

- Add tests asserting:
  - resource-highlighted sectors can render bottom-center group badges
  - non-resource hub-only sectors do not render those badges

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/map-resource-filter/map-svg-canvas.spec.ts`

**Step 3: Write minimal implementation**

- Add map props for resource group badges and render them in the SVG overlay layer.

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/map-resource-filter/map-svg-canvas.spec.ts`

### Task 3: Wire Advanced Result Data Into Map Overlay

**Files:**
- Modify: `src/components/empire/MapResourceFilterAdvancedPanel.vue`
- Modify: `src/components/empire/MapResourceFilterPanel.vue`
- Modify: `src/components/empire/MapWorkbenchView.vue`
- Modify: `src/components/empire/MapSvgCanvas.vue`

**Step 1: Write the failing test**

- Reuse the panel and canvas tests above as the red phase.

**Step 2: Run test to verify it fails**

Run the targeted Vitest files from Tasks 1-2.

**Step 3: Write minimal implementation**

- Pass group-hit metadata from advanced panel to workbench and canvas.
- Keep chip focus and whole-candidate fit behavior unchanged except for new visuals.

**Step 4: Run test to verify it passes**

Run the targeted Vitest files from Tasks 1-2.

### Task 4: Final Verification

**Files:**
- Verify only

**Step 1: Run targeted unit tests**

Run:
- `npm run test:unit -- tests/unit/map-resource-filter/map-resource-filter-panel.spec.ts`
- `npm run test:unit -- tests/unit/map-resource-filter/map-svg-canvas.spec.ts`

**Step 2: Run build**

Run: `npm run build`

