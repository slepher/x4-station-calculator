# E2E Test Reorganization Plan

> **For Claude:** REORGANIZATION task — execute systematically.

**Goal:** Reorganize blueprint (production) and live e2e tests by functional point, filling missing coverage.

**Approach:**
1. Phase 1: Consolidate `production/` (46 files → ~10 functional files)
2. Phase 2: Create `live/` with migrated + new tests
3. Phase 3: Keep `binding/`, move `metric-panel-ui` to `ship/`
4. Phase 4: Clean up old `tests/e2e/` files

---

## Execution Plan

### Phase 1: Production Consolidation

#### Task 1.1: Merge station-management.spec.ts
**From:** `station-tabs.spec.ts`, `station-tab-drag.spec.ts`, `station-state-isolation.spec.ts`, `title_editing.spec.ts`
**Content:** Tab creation/switching/drag reorder, state isolation, title editing
**Action:** Create merged file, delete source files

#### Task 1.2: Merge empire-crud.spec.ts
**From:** `empire-crud.spec.ts`, `bug-verification.spec.ts`
**Content:** Empire CRUD (create/rename/save/delete), bug fixes (New/Save As/Save & New)
**Action:** Create merged file, delete source files

#### Task 1.3: Merge station-dashboard.spec.ts
**From:** `station-dashboard-ui.spec.ts`, `station-dashboard-views.spec.ts`, `station-analysis-logic.spec.ts`, `settings-panel.spec.ts`, `buffer-logic.spec.ts`, `buffer-calculation.spec.ts`, `task5-volume-controls.spec.ts`, `task5-workforce-options.spec.ts`, `task6-storage-planning.spec.ts`
**Content:** Dashboard cost/volume/time/workers views, buffer sliders, storage planning, workforce options
**Action:** Create merged file, delete source files

#### Task 1.4: Merge ware-flow.spec.ts
**From:** `wareflow-dashboard.spec.ts`, `supply-group.spec.ts`, `favorite-button-component.spec.ts`, `visibility.spec.ts`, `priority-logic.spec.ts`, `integration.spec.ts`, `tooltip-i18n.spec.ts`, `volume_view.spec.ts`, `volume-compression.spec.ts`, `task3-resource-dashboard.spec.ts`, `task4-volume-analysis-final.spec.ts`, `task8-economy-view-changes.spec.ts`, `task9-resource-view-changes.spec.ts`
**Content:** Flow view modes, favorite/lock buttons, priority, supply group, volume, economy, i18n
**Action:** Create merged file, delete source files

#### Task 1.5: Merge empire-overview.spec.ts
**From:** `empire-overview.spec.ts`, `empire-full-flow.spec.ts`, `empire-gap-display.spec.ts`, `sector-link-calc.spec.ts`, `ui-change.spec.ts`
**Content:** Multi-station aggregation, gap display, sector links/transit hub, UI changes
**Action:** Create merged file, delete source files

#### Task 1.6: Merge import-export.spec.ts
**From:** `import-export.spec.ts`, `bug-import-export.spec.ts`, `bugfix-import-export.spec.ts`, `module-id.spec.ts`, `bug-module-id.spec.ts`, `bugfix-module-id.spec.ts`, `simplify-flow.spec.ts`, `bugfix-simplify-flow.spec.ts`
**Content:** Import/export, module ID migration, flow simplify, bug fix verification
**Action:** Create merged file, delete source files

#### Task 1.7: Merge module-management.spec.ts
**From:** `storage-auto-fill.spec.ts`, `task3-scale-buttons.spec.ts`
**Content:** Storage auto-fill, scale buttons
**Note:** This area has gaps — will add module search/filter tests
**Action:** Create merged file with existing + NEW tests, delete source files

#### Task 1.8: Keep standalone files
- `station-resource-group.spec.ts` — already comprehensive, keep as-is
- `state-management.spec.ts` — merge into settings.spec.ts (see Task 1.9)
- `metric-panel-ui.spec.ts` — move to `ship/`

#### Task 1.9: Create settings.spec.ts
**From:** `state-management.spec.ts` + extracted from dashboard files
**Content:** Station settings persistence, sliders, workforce options

#### Task 1.10: Add missing production tests
**NEW content in existing files:**
- `module-management.spec.ts`: module search/filter interaction
- `station-dashboard.spec.ts`: sunlight slider effect, transport view
- `ware-flow.spec.ts`: transport view details, flow expand/collapse
- `empire-overview.spec.ts`: transit hub multi-ware solver

---

### Phase 2: Live Test Suite Creation

#### Task 2.1: Create live/ directory structure
```
tests/unified-e2e/live/
├── helpers/
│   └── loadLiveBindingFixture.ts
├── live-station-toolbar.spec.ts
├── live-flow-map.spec.ts
├── live-station-dashboard.spec.ts (NEW)
├── live-ware-flow.spec.ts (NEW)
└── live-overview.spec.ts (NEW)
```

#### Task 2.2: Migrate helper
**From:** `tests/e2e/helpers/loadLiveBindingFixture.ts`
**To:** `tests/unified-e2e/live/helpers/loadLiveBindingFixture.ts`
**Action:** Copy file, update imports

#### Task 2.3: Create live-station-toolbar.spec.ts
**From:** `tests/e2e/live-station-toolbar/live-station-toolbar.spec.ts` + `tests/e2e/live-station-toolbar/live-station-fixture-load.spec.ts`
**Action:** Merge both files, update import paths

#### Task 2.4: Create live-flow-map.spec.ts
**From:** `tests/e2e/live-flow-map/live-flow-map.spec.ts`
**Action:** Copy and upgrade fixture loading to use loadLiveBindingFixture helper

#### Task 2.5: Create live-station-dashboard.spec.ts (NEW)
**Content:** Live dashboard analysis — cost/volume/time/workers with archive data source
**Requires:** Understanding live store data flow

#### Task 2.6: Create live-ware-flow.spec.ts (NEW)
**Content:** Live ware flow views — real modules (from archive) vs planning modules
**Requires:** Understanding live production flows

#### Task 2.7: Create live-overview.spec.ts (NEW)
**Content:** Live empire overview — aggregated flows across binding stations, gaps with save data

---

### Phase 3: Binding & Ship Cleanup

#### Task 3.1: Rename binding file
**File:** `tests/unified-e2e/binding/user-save-binding-station.spec.ts`
**To:** `tests/unified-e2e/binding/save-binding-crud.spec.ts`
**Action:** Rename file

#### Task 3.2: Move metric-panel-ui.spec.ts
**From:** `tests/unified-e2e/production/metric-panel-ui.spec.ts`
**To:** `tests/unified-e2e/ship/metric-panel-ui.spec.ts`
**Action:** Move file

---

### Phase 4: Cleanup Old Files

#### Task 4.1: Delete old production files
**Delete:** all files in `tests/unified-e2e/production/` that were merged into new files

#### Task 4.2: Delete old e2e/ live files
**Delete:** `tests/e2e/live-station-toolbar/`, `tests/e2e/live-flow-map/`, `tests/e2e/helpers/loadLiveBindingFixture.ts`

#### Task 4.3: Verify no broken imports
**Check:** All spec files reference correct paths after moves

---

## Risk Mitigation
- Each merged file preserves all original test cases (no deletion, only reorganization)
- New tests added separately from merges to avoid confusion
- Old files deleted only after verification
