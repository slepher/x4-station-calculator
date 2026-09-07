# FIX-M10.4-STATS — incomplete, paused by user

Resolved change fix-ship-build-analysis-contract, BUG-STATS only. User requested immediate wrap-up; existing atomic GREEN completed, source frozen, no new consumer/build/browser/fullUnit run. STATS task remains unchecked because finite consumers and later integration verification are unfinished.

Source changes only ShipBuildPanelStats.vue: remove extra directional divisor6 from existing weighted turret average; convert raw engine boostRecharge/100 in existing detail assembly and unit to%/s. Relevant formula comment corrected. No added Vue-store path, new layer, presenter migration or shared useEquipmentStats edit. Existing one-decimal display remains.

New actualmounted ShipBuildPanelStats with real MetricsPanel/MetricItem/Pinia/game data/useEquipmentStats tests: two real8.0 compatible M turrets beam24DPS andpulse72DPS withcounts1/2→weighted56, zero/empty→0, DLC exclusion removes pulse from numerator/denominator→24 andreactive reenabling→56, targetpreview24(-32) preservescurrentblueprint, rawsharedengine100 retained whilepanel1%/s (zeroenginepreview0(-1)%/s), unrelatedhull/crew/weapon/speed/travel/boost values checked. No mocked business result or same-source expectation.

Actual evidence /tmp/x4-migration-FIX-M10.4-STATS/:
- `npm run test:unit -- tests/unit/ship/ship-stats-average-recharge.spec.ts` red.log exit1,4failed/2passed:9.3 vs56,4 vs24,preview9.3 vs56,recharge100s vs1%/s.
- Samecommand green.log exit0,6passed,1.68s.
- Staticraw8.0 equipment/bulletledger static-data.log.
- Owned source/newUnit diff-check exit0 (tool output).

Unfinished: finite consumers (existing ship-build-stat/status-diff and shared equipment canonical-details as applicable), coordinatedbuild, independentoriginalM10.4/complete23E2E. Parent explicitly permits Osaka oldrawsnapshot301.105→display301.1 formatting migration; E2E file stillretains oldexpectation until verification ownerupdatesit, neveraccept50.2. BUG-STATS Fixed onlyatfocusedUnit boundary, notVerified; wholechange incomplete. No new work queued afteruserstop. Changedsource+newUnit+STATSbugsection+thisresult only; no taskcheckboxclaim.
