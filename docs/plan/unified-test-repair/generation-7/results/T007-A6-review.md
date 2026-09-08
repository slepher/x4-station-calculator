- Task: T007
- Contract revision: 1
- Result: T007-A6.md
- Candidate snapshot: HEAD `8b5894bc85a7de3d608efa8db74357d942764519` plus generation-7 planning tree and corrected T007 candidate; reviewed candidate delta is limited to `tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts` and `tests/e2e/ship/ship-equipment-selector.spec.ts`
- Verdict: passed

## Findings

None.

## Acceptance

The corrected cases exercise the current behavior through UI controls: ship filters and confirmation, Fit slot-type/group/slot controls, candidate selection, picker cancellation, and ship replacement. Store access remains observation-only for blueprint comparisons; it is not used to manufacture the reviewed UI states.

At the retained 1280×720 viewport, both layout cases select a real candidate before checking the expanded workspace. The traces show Fit, external Equipment Picker, Equipment details, and Stats visible, Materials hidden, and successful geometry assertions placing Fit before Picker, Picker before Details, and Stats below Details. Fit retains `lg:col-span-4`, matching the current three-column allocation. The retained ship-replacement trace then shows the picker hidden, Materials visible, Standard mode restored, and Katana selected.

The Odachi witness uses the real UI path `M / Terran / Corvette / 大太刀`, then opens Weapon through the Fit panel. Its trace resolves the scoped locator to `slot-ship_ter_m_corvette_02_a::weapon::3::0`, reports exactly seven race tags, receives `filter-items-race filter-items-race-two-rows`, and records two rendered row positions, `162` and `194`. The helper is scoped to `ship-build-panel-fit` and the requested `::type::` segment, so it no longer depends on Osaka's ship id.

The compact-control trace records browser-received CSS heights of `26px` for `.mode-tabs` and `56px` for `.group-tabs`; these are rendered values rather than source constants or values sampled from MetricsPanel. Existing fixed-data candidate identity/count, details, empty-state, confirm/cancel, slider, group-mode, and ship preset checks remain in the two owned specs or the four read-only ship specs and are represented in the 46 retained traces.

Evidence is bound to the reviewed candidate: the embedded trace source for each owned spec is byte-identical to the current file, `.last-run.json` is `passed`, all 46 expected trace archives are present, and `git diff --check` succeeds. The T007 candidate changes only its two owned specs; concurrent non-owned workspace changes are outside this acceptance, and no source, Unit, helper, fixture, config, locale, or style change is accepted here.

## Explanation

T007-A6 replaces the obsolete two-column and 25.6px expectations with current UI behavior while retaining the valid equipment interaction coverage. `validation.md` still contains the worker's earlier “browser/build rerun not run” note, but the later result record, passing `.last-run.json`, 46 per-test traces, and trace-embedded current source establish the completed dispatcher rerun. Final canonical E2E remains T010 scope.
