# T007-A5 failure input and correction basis

- Task: T007
- Contract revision: 1
- Prior attempt: T007-A4
- Prior exact result: 46 total, 44 passed, 2 failed.
- Prior failures:
  - `ship-equipment-selector.spec.ts` race case: the visible ship selector timed out looking for `^大太刀$`; the M/Terran route retained no compatible selected type, leaving the list unavailable.
  - `ship-equipment-selector.spec.ts` expanded turret case: `.mode-tabs` rendered at `26px` and `.group-tabs` rendered at `56px`; the test expected both to be `26px`.
- Prior runtime trace/error context is retained under `evidence/T007-A4/playwright-results/`.

Current source facts used:

- `ShipBuildSelectorView.vue:101-119` shows the list only when a class and at least one race/type are selected.
- `ShipBuildSelectorView.vue:128-131` removes selected types that are invalid for the newly selected class.
- The current Osaka beforeEach starts with `ship_l`, Terran, and destroyer; switching to `ship_m` removes destroyer. Selecting `ship-build-filter-type-btn-corvette` makes the localized `大太刀` result reachable.
- `useShipBuildFitPresenter.ts:22-32` opens a picker only for multiple compatible candidates; the Osaka large weapon path has one and auto-assigns.
- Current rendered geometry records mode-tabs at `26px` and group-tabs at `56px` in the expanded turret state.

