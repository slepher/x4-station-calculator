# FIX-M10.4-STATS — focused verification complete

Resolved change fix-ship-build-analysis-contract, BUG-STATS only. Current verification is bound to HEAD `6d14c05dfbfea5042745c781342c5c12e0d152ac`; the source fix is followed by finite consumers and the complete M10.4 browser scope.

Source changes only ShipBuildPanelStats.vue: remove extra directional divisor6 from existing weighted turret average; convert raw engine boostRecharge/100 in existing detail assembly and unit to%/s. Relevant formula comment corrected. No added Vue-store path, new layer, presenter migration or shared useEquipmentStats edit. Existing one-decimal display remains.

New actualmounted ShipBuildPanelStats with real MetricsPanel/MetricItem/Pinia/game data/useEquipmentStats tests: two real8.0 compatible M turrets beam24DPS andpulse72DPS withcounts1/2→weighted56, zero/empty→0, DLC exclusion removes pulse from numerator/denominator→24 andreactive reenabling→56, targetpreview24(-32) preservescurrentblueprint, rawsharedengine100 retained whilepanel1%/s (zeroenginepreview0(-1)%/s), unrelatedhull/crew/weapon/speed/travel/boost values checked. No mocked business result or same-source expectation.

Current finite consumer command passed 4 files / 32 tests, exit 0; complete M10.4 E2E passed 23 / 23 with no skip, exit 0. The Osaka raw `301.105 MW` snapshot is asserted at the renderer's existing one-decimal precision as `301.1 MW`; hull `2297` and boost recharge `1%/s` also pass. Commands and logs are recorded in `results/M10.4.md` and `/tmp/x4-test-repair-M10.4/`.

Historical focused red/green evidence `/tmp/x4-migration-FIX-M10.4-STATS/`:
- `npm run test:unit -- tests/unit/ship/ship-stats-average-recharge.spec.ts` red.log exit1,4failed/2passed:9.3 vs56,4 vs24,preview9.3 vs56,recharge100s vs1%/s.
- Samecommand green.log exit0,6passed,1.68s.
- Staticraw8.0 equipment/bulletledger static-data.log.
- Owned source/newUnit diff-check exit0 (tool output).

BUG-STATS is verified at the focused Unit, finite-consumer, and complete M10.4 E2E boundary. This does not claim unrelated Ship suites or full E2E coverage.
