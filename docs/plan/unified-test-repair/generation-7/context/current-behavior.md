# Current behavior evidence packet

## Evidence target

- Repository: `/home/slepher/project/x4-station-calculator`.
- Evidence target: baseline product `HEAD` `8b5894bc85a7de3d608efa8db74357d942764519` (confirmed with `git rev-parse HEAD`); the product baseline was clean at collection start (`git status --short` was empty). During collection, root added new untracked generation-7 planning files, so the current worktree is not claimed clean.
- This packet records static source, test, and plan/spec locations. No test, build, dev server, or runtime/UI verification was run. Only this owned packet file was added by this agent.

## Questions and scope

The generation-6 contracts were scanned first, then only the current entry paths needed for T011, T014/T015, T017, T023, and T018–T022 were read. The bounded question is which old assertions still describe the public entry and which should be rewritten around the current behavior. Generation 7 uses the current code behavior as its test-repair baseline; “conflict” below identifies a historical contract that differs from that baseline.

## Findings and locations

### T011: auto-sector-group workbench switching

The current public route is:

`LiveProductionWorkbenchView.vue` → `useProductionSidebarPresenter(liveStore)` → `ProductionSidebar.vue` → `useLiveProductionStore` actions.

- `src/components/empire/LiveProductionWorkbenchView.vue:70-82,188-228,306-324` creates the sidebar presenter, wires `select-auto-sector-group`, `select-transit`, and `select-station`, and renders `AutoSectorGroupPanel` when the toolbar mode is `auto-sector-group`. Its close action at `:161-172` returns the workbench to `overview` or opens the map.
- `src/components/empire/ProductionSidebar.vue:241-263,461-478` emits the auto-group event from the fixed sidebar item (`data-testid="sidebar-auto-sector-group"`); the event is disabled when the presenter says `autoGroupResult == null`.
- `src/components/empire/presenters/useProductionSidebarPresenter.ts:181-218,223-245` exposes the mode, active tab, disabled state, and the three selection emits. `showAutoSectorGroup` is based on `store.capabilities.hasSectors`.
- `src/store/useLiveProductionStore.ts:1921-1946,1973-1976,2613-2619` shows the action semantics: station and transit selection clear `isAutoSectorGroupMode` and update the active station/transit id; auto-group selection sets auto mode and clears `activeStationId`.
- `src/store/useActiveViewStore.ts:112-132,180-193,275-281` has a separate active-binding setter. `activeBindingStation` protects fixed modes, including `auto-sector-group`, only when that setter is used; `activeStationId` writes the state directly. This is not evidence of a public UI event that automatically changes a station.

Historical conflict: generation-6 `T011.md` retained an assertion that selecting a station from the auto-sector-group workbench leaves the workbench in auto-sector-group. The current explicit sidebar station/transit actions clear that mode. Therefore that assertion does not match the current public entry and should be rewritten or retired unless a different, real automatic station-change event is identified. The stable current witness is selecting `sidebar-auto-sector-group`, observing the auto-group panel, then using its back/map/confirmed callbacks; do not infer runtime persistence from the setter code alone.

### T014/T015: AutoSupply and sector/resource sources

The current production-planning UI exposes one infrastructure collection:

- `src/components/empire/StationPlanningPanel.vue:11-21,358-398` accepts and renders `autoInfrastructureModules` alongside industry and habitation. There is no `autoSupply` prop or separate AutoSupply tier.
- `src/components/empire/presenters/useProductionPlanningPresenter.ts:34-50,87-100,164-187,189-191` reads station state’s `autoInfrastructureModules`, filters the display collection, and emits planned-module updates.
- `src/store/state/StationDerivedMap.ts:263-281,533-600,603-678,861-875` is the current compute/cache path. Its compute settings hard-code `internalSupply: true` for full computation, and the derived cache exposes auto-industry/auto-habitation/production-flow results; no independent autoSupply result is exposed.
- `src/store/logic/calculateInfrastructureModules.ts:22-140` calculates storage and pier infrastructure from the production-flow/module inputs as one calculation. `src/store/state/stationSettings.ts:4-23` still contains an `internalSupply` setting, but no corresponding public planning control was found.

Historical conflict: `openspec/specs/storage-auto-fill/spec.md:6-22` and generation-6 `T014.md` describe an independent AutoSupply list and dual storage behavior. The current Vue/presenter/store entry exposes unified infrastructure instead, and the independent AutoSupply product target is retired for this generation. Tests must stop looking for an unavailable AutoSupply prop/control and assert the visible unified infrastructure behavior.

For sector/resource selection, the current map panel is a separate saved-source route:

- `src/components/map/MapResourceFilterAdvancedPanel.vue:146-156,222-223,317-318,372-406` tracks `loadedSourceId`/`loadedSourceType`; the loader resolves saved empires or saved logic-flow plans and computes sector data from the map store’s resource data.
- `tests/e2e/production/station-resource-group.spec.ts:122-131,223-256` uses the current loader’s sector testids and checks item count/highlight. `tests/e2e/production/migration-task-test-7.3.md:141-...` records that the panel iterates saved empires and has no production-source-view sector testid.
- `src/store/logic/empireSourceView.ts:1-160`, `src/store/useBlueprintProductionStore.ts:118-137`, and `src/store/useLiveProductionStore.ts:792-814` provide the active empire source-view sectors/stations for production workbenches. No current `useMapResourceFilterPresenter.ts` was found; the attempted generation-6 presenter path is absent at this HEAD.

Historical conflict: generation-6 `T015.md` expects map resource sectors to come from the active Blueprint empire/source view and station flows. The current map entry loads saved empire/logic-flow sources and derives resource-sector data separately. Tests should follow the current loader if the current entry is the target; changing the map source requires an explicit product/spec decision. Map spatial identity and independent drag entry points were only located, not investigated.

### T017: equipment Fit/details layout

The current ship path is `ShipBuildWorkspaceView.vue` → `ShipBuildPanelFit.vue` / `ShipBuildPanelEquipment.vue` (the workspace directly owns picker state and still directly uses `useShipBuildStore`).

- `src/components/ship-build/ShipBuildWorkspaceView.vue:1-18,106-161` always renders Fit with `wide="false"`; when the picker is open it renders an external `ShipBuildPanelEquipment panel-mode="picker"`, then `ShipBuildPanelEquipment panel-mode="equipment"` and `ShipBuildPanelStats`; when closed it renders Stats and Materials.
- `src/components/ship-build/ShipBuildPanelFit.vue:795-806,878-1101` owns Fit slot rows and opens the picker via emits. The root testid is `ship-build-panel-fit`; its `wide` class is only wide when the caller passes `wide`.
- `src/components/ship-build/ShipBuildPanelEquipment.vue:20-35,61-129,180-300` contains both picker candidate extraction and equipment-details `MetricsPanel`. Its race filter uses `raceTags.length > 5` for the two-row class (`:197`), and its active picker testids include `ship-build-panel-equipment`, `picker-cancel`, and `picker-confirm`.
- Current tests using this entry include `tests/e2e/ship/build-ship-equipment-panel.spec.ts`, `tests/e2e/ship/ship-equipment-selector.spec.ts`, and `tests/e2e/ship/ship-build-storage.spec.ts`. `tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts:45-56` still asserts the historical two-thirds Fit geometry.

Historical conflict: generation-6 `T017.md`/migration notes describe Fit as two-thirds wide with an equipment/details right column and the picker as a particular grid, while the current workspace uses a three-column picker/details arrangement and hides Materials during picker mode; Fit is passed `wide=false`, and the current race threshold is `>5`. The historical geometry assertion should be rewritten to the actual current DOM/layout entry. Retain details/picker actions that remain publicly reachable. This packet records the current code behavior as the test-repair baseline.

### T023: favorite tooltip

The current implementation and tests already contain the generation-6 tooltip behavior:

- `src/components/common/FavoriteButton.vue:39-109,112-183,212-261` builds translated priority/consumption rows, uses an interactive left-placement Tippy, and lays out rows with four grid columns. `.label-cell` has `min-width:80px`, `.hours-cell` has `min-width:70px`, and cells are nowrap.
- `src/locales/en.json:1011` and `src/locales/zh-CN.json:1012` define the No Demand label.
- `tests/e2e/button-tooltip-integration.spec.ts:5-27,29-99` checks persistence, widths/no-wrap, and pure-consumption No Demand output. `tests/e2e/button-tooltip-side/button-tooltip-side.spec.ts:5-20,30-75` checks left/right placement, rows, labels, toggle, and disabled state. `tests/unit/production/FavoriteButton.spec.ts` covers translated tooltip labels.

The old T023 contract’s width/no-wrap and No Demand requirements therefore match the current source. Any repair should first adjust stale fixture/locator assumptions around these existing tests; static inspection provides no basis for changing source.

### T018–T020: build-flow interactions and persistence

The current route is `LogicFlowWorkbenchView.vue` → `BuildFlowZone.vue` → `useBuildFlowPresenter` → `useLogicFlowStore`.

- `src/components/logic-flow/LogicFlowWorkbenchView.vue` renders the build-flow zone; `src/components/logic-flow/BuildFlowZone.vue:1-25` is the Vue wrapper and imports the presenter/store route.
- `src/components/logic-flow/presenters/useBuildFlowPresenter.ts:12-26,52-78,80-183,185-304` supplies groups/cards/edges/menu targets and the bind, unbind, drag, archive, and restore callbacks.
- `src/store/useLogicFlowStore.ts:37-39,82-133,1128-1129,1188-1189` owns build-flow assignments, drag state, archive persistence, and restoration. `src/store/logic/buildFlowDerivation.ts` is the derived-card/edge source.
- `tests/e2e/build-flow/build-flow.spec.ts:9-77,110-208` has stable selectors and real menu/bind/unbind/archive/restore helpers. Its later chapter (`:264` onward) contains conditional branches, `count >= 0` checks, and optional output assertions; these are weak evidence for the fixed fixture rather than proof that every flow is covered.

The current observable actions are source/target tag menus, bind/unbind, drag state, and archive/restore. The build-flow test should make fixture preconditions deterministic and assert the resulting cards/edges/persistence directly; no source change follows from the static mismatch.

### T021/T022: build-plan goals, Fleet, preview, explicit compute, and steps

The current route is `BlueprintProductionWorkbenchView.vue` → `useBuildPlanPresenter` → `BuildPlanConstraintsPanel`/`BuildPlanPanel` → `useBuildPlanStore`.

- `src/components/empire/BlueprintProductionWorkbenchView.vue:1-24,31,96-99,241-283` wires presenter props and goal/material/compute/plan/flow/Fleet emits into the two panels.
- `src/components/empire/presenters/useBuildPlanPresenter.ts:35-78,137-145,161-280,368-439` is the UI assembly point. `fleetGoalView` resolves saved blueprint ids, calls `shipBuildStore.getBuildAnalysis`, groups XL/L/wharf capacity, and reports missing-blueprint/ungrouped warnings.
- `src/store/useBuildPlanStore.ts:36-250,464-621,631-666` owns goal persistence/source resolution, preview recomputation, explicit `computePlan`, and the exposed plan/flow actions.
- Current goal/Fleet coverage is in `tests/e2e/build-plan-goal/build-plan-goal.spec.ts:4-105,107-...`; it uses fixed energy-cell/hullpart goals, `logic-flow-1`, a Katana blueprint, UI actions, and exact persisted goal shapes. The relevant panel testids are in `BuildPlanConstraintsPanel.vue` (plan menu, flow trigger, goal selectors) and `FleetGoalCard.vue`/`BuildGoalSearchBox.vue`.
- Current preview coverage is in `tests/e2e/build-plan-preview/build-plan-preview.spec.ts:1-104,112-267`. UI actions add goals/select flow/toggle material planning; the oracle reads `previewResult` after those actions. `useBuildPlanStore.ts:464-547` calls `createBuildFlowPlanPreview`, while `useBuildPlanPresenter.ts:47-49,327-338` maps preview lines to the panel sections.
- Current explicit-compute coverage is in `tests/e2e/build-plan-compute/build-plan-compute.spec.ts:3-28,36-106`. It computes fixed energy-cell/hullpart goals and checks scheme cards, rates, time, recomputation, overlap, and unplanned behavior. Its old 3.3 test opens the last card and toggles summary/steps.
- `src/components/empire/BuildPlanStepsModal.vue` imports `buildStepsScheme` and `canBuildStepsScheme` from `src/components/empire/presenters/buildPlanStepsLogic.ts`; `BuildPlanPanel.vue` owns the modal opening path. The steps modal is therefore gated by the current scheme conditions, not by a generic “any computed card” rule.

Current test-alignment facts: goals/Fleet and preview tests mostly exercise the public presenter path and have stable fixture identities. The explicit-compute 3.3 assertion is the least portable historical case: its energycells-plus-last-card assumption depends on which scheme qualifies for the three `canBuildStepsScheme` conditions. Keep the steps capability in scope; the executor should use the current public entry to locate a bounded qualifying build-material example, then assert the actual modal/summary transition. Do not infer that a source change is required from a stale card-order assumption.

## Recommended close reading

Planner should read these source segments before freezing generation-7 test contracts:

1. `src/store/useLiveProductionStore.ts:949-970,1921-1976` and `src/components/empire/LiveProductionWorkbenchView.vue:306-370` for mode transitions.
2. `src/components/map/MapResourceFilterAdvancedPanel.vue:146-156,222-223,317-318,372-406` plus `src/store/logic/empireSourceView.ts:1-160` for the two source models.
3. `src/components/ship-build/ShipBuildWorkspaceView.vue:106-161`, `ShipBuildPanelFit.vue:878-1101`, and `ShipBuildPanelEquipment.vue:180-300` for current layout and picker/details witnesses.
4. `src/components/common/FavoriteButton.vue:39-109,212-261` and the two tooltip E2E files for already-present T023 behavior.
5. `src/components/logic-flow/presenters/useBuildFlowPresenter.ts:52-304`, `useLogicFlowStore.ts:82-133`, and `tests/e2e/build-flow/build-flow.spec.ts:110-208,264-...` for deterministic build-flow assertions.
6. `useBuildPlanPresenter.ts:161-280,327-439`, `useBuildPlanStore.ts:464-621`, `buildPlanStepsLogic.ts`, and the three current build-plan E2E files for goal/Fleet/preview/compute contracts.
7. Historical comparison only: `docs/plan/unified-test-repair/generation-6/tasks/T011.md`, `T014.md`, `T015.md`, `T017.md`, `T018.md`–`T023.md`, `openspec/specs/storage-auto-fill/spec.md`, and `tests/e2e/production/migration-task-test-7.3.md` / `tests/e2e/ship/migration-task-test-10.2.md`.

## Unknowns and coverage limits

- No browser/runtime behavior was observed, so “current behavior” here means the statically reachable Vue/presenter/store path and existing test witness.
- The generation-7 test-repair baseline is the current code behavior; the independent AutoSupply target is retired for this generation.
- The packet does not investigate map coordinate identity, independent drag mechanics, or compute internals beyond locating their entry points.
- Existing generation-7 plan/task files were not rewritten; their contract decisions remain for the planner. No source, test, old status, or Git metadata was changed.
