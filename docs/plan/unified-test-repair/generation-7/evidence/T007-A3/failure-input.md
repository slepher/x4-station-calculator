# T007-A3 correction input

- Task: T007
- Contract revision: 1
- Prior attempt: T007-A2
- Prior exact result: 46 total, 43 passed, 3 failed.
- Prior failures supplied by dispatcher:
  - `tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts:59`: `getByTestId('metrics-panel-ship-build-equipment')` was not found.
  - `tests/e2e/ship/ship-equipment-selector.spec.ts:168`: race tag count was `5`, so the `>5` witness was false.
  - `tests/e2e/ship/ship-equipment-selector.spec.ts:178`: `metrics-panel-ship-build-equipment` was not found.
- Prior runner marker: `evidence/T007-A2/playwright-results/.last-run.json` reports three failed test identities.

Current source facts:

- `MetricsPanel.vue:95-96` renders the equipment metrics testid only when the equipment panel is rendered.
- `ShipBuildPanelEquipment.vue:289-300` hides the equipment metrics panel when picker mode has neither a current nor a highlighted candidate (`shouldHide` is true for the empty state).
- `ShipBuildPanelEquipment.vue:197` uses the two-row class only when `raceTags.length > 5`.
- Fixed 9.0 data gives Odachi’s medium weapon connection seven race identities: `argon`, `boron`, `gen`, `paranid`, `split`, `teladi`, `terran`. Its engine witness produced five in T007-A2.

