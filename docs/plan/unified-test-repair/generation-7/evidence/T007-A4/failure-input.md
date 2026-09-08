# T007-A4 failure input and correction basis

- Task: T007
- Contract revision: 1
- Prior attempt: T007-A3
- Prior exact result: 46 total, 44 passed, 2 failed.
- Prior failures:
  - `tests/e2e/ship/ship-equipment-selector.spec.ts:168`: the Osaka empty large weapon path did not open `equipment-picker`; the current Fit presenter auto-assigns when only one compatible candidate exists.
  - `tests/e2e/ship/ship-equipment-selector.spec.ts:178`: computed `.mode-tabs` height was `26px`, while the test expected `25.6px`; the same rendered rounding applies to `.group-tabs`.
- Prior runtime artifacts are retained under `evidence/T007-A3/playwright-results/`, including the failure `error-context.md` and traces.

Current source facts used:

- `useShipBuildFitPresenter.ts:22-32` opens the picker only when a target has more than one compatible candidate; a single candidate is applied directly.
- The A3 trace showed the test’s Osaka large weapon slot had a single compatible candidate.
- The existing selector helper uses the Osaka fixture in `zh-CN`; the visible ship selector can move to Odachi using the existing `ship-build-change-ship-fit-header`, M/Terran filters, and `大太刀` label.
- Fixed 9.0 Odachi medium weapon data exposes seven race identities: `argon`, `boron`, `gen`, `paranid`, `split`, `teladi`, `terran`.
- `ShipBuildPanelFit.vue:1250-1253` defines the controls with `h-[25.6px]`/matching compact styles; the browser’s stable computed value is `26px`.

