# T007-A6 failure input and correction basis

- Task: T007
- Contract revision: 1
- Prior attempt: T007-A5
- Prior exact result: 46 total, 45 passed, 1 failed.
- Prior failure: `ship-equipment-selector.spec.ts` race layout case switched to localized Odachi, but `slot(page, type)` still hardcoded `ship_ter_l_destroyer_01_a`; `open(page, 'weapon')` timed out because Odachi’s slot testids use a different ship id.
- Prior runtime trace is retained under `evidence/T007-A4/playwright-results/` and the A5 runtime artifacts under `evidence/T007-A5/playwright-results/`.

Current source facts used:

- `ShipBuildPanelFit.vue:1073` renders slot testids as `slot-${target.key}` and each key contains the current selected ship id followed by `::${slotType}::`.
- The Fit panel is the stable owner of the currently rendered ship’s slots, so scoping the selector to `ship-build-panel-fit` and matching the slot-type segment follows the active ship without store injection or fallback regex.

