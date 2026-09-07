# FIX-M10.4-HULL — Unit complete; build/E2E pending

Resolved change: fix-ship-build-analysis-contract, BUG-HULL only. Followed x4-bug-fix/apply; explicit parent contract owns later build/browser/fullUnit. OpenSpec status/instructions ready, HULL task now checked; BUG-HULL Fixed at Unit boundary, notVerified.

Changed only analyzeShipBlueprintBuild.ts shipEntry material input: clone selected production cost, explicitly add blueprint.hull.materials once perware, reuse existing material pricing/cards/summary/total. Same-ware adds, newware retained; no extraentry/time, noinputmutation, nofallbackchain added. Existing unused resolveBlueprintMaterialCost and normalization untouched. AllgetBuildAnalysis callers read: storecurrentanalysis, MaterialsPresenter, BuildPlanStore fleetrates, BuildPlanPresenter fleetcards; sharedchange reachesall.

Independent Unit uses small literal production/hull/engine/nestedshield/deployable/counter/drone/missile costs: totalenergy101=10+3+2*5+7+2*11+13+17+19; hull-exclusivefieldcoils4, productionhullparts2. Price min/mid/max totals234/454/674, shipcard58/102/146. Exactentryquantities,totalcard/summary consistency, inputdeep-equality, methodterran111energy andtime101, absent/empty/zerohull unchanged98energy/time71.

Commands/evidence `/tmp/x4-migration-FIX-M10.4-HULL/`:
- `npm run test:unit -- tests/unit/ship/ship-build-hull-materials.spec.ts` RED exit1,4failed/3passed, red.log (missing3energy+4fieldcoils; methodsameomission).
- Samecommand GREEN exit0,7passed, green.log.
- `npm run test:unit -- tests/unit/ship/ship-build-material.spec.ts tests/unit/current/build-plan/shipBlueprintBuildAnalysisBuildPlanConsumption.spec.ts tests/unit/current/build-flow-plan/buildPlanProductionLine.spec.ts` exit0,3files/18passed, consumers.log.
- Ownedsource/Unit diff-check exit0, diff-check.log.

Historical consumers include legacycomparison; they are limited compatibilityevidence, notsubstitute for7independent directanalysis cases. No build/browser/fullUnit/git operations. Source/Unit+HULLtask/bug+thisresult only. Parentfreshbuild thenoriginalhull2297 E2E/fullM10.4 remainrequired. HULLdoesnotwaitforSTATS tobe handedoff.
