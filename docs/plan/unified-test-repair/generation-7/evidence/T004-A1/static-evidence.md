# T004-A1 static evidence

- Contract: Generation-7 T004, revision 1.
- Candidate base: `8b5894bc85a7de3d608efa8db74357d942764519` plus the T004 test patch.
- Product files were read-only inputs; no `src`, Unit, helper, fixture, config, dependency, status, or planning path was changed.

The current public production panel exposes `autoInfrastructureModules` as one tier in `StationPlanningPanel.vue:386-398`. The presenter passes that collection from station state at `useProductionPlanningPresenter.ts:89,178`. `calculateInfrastructureModules.ts` calculates storage by transport type and pier deficit in the same result, so the replacement case checks one unified collection.

The fixed 9.0 module data gives the independent expected values used in the test:

- `module_gen_prod_energycells_01`: 10,500 energy cells per hour, unit volume 1 m³.
- Default primary buffer: 12 hours, so `10,500 × 12 = 126,000 m³`.
- `module_arg_stor_container_l_01`: 1,000,000 m³ container capacity, so one storage module is sufficient.
- Default transport ship capacity: 62,000; one berth throughput is `62,000 × 15 = 930,000 m³/hour`, so 10,500 m³/hour requires one berth.
- Current selected Argon large pier identity observed by the focused run: `module_arg_pier_l_03`.

The obsolete independent AutoSupply path is removed from Case 5. The new UI actions add energy production, assert storage and pier in the unified infrastructure collection, add manual Argon storage, and assert that only the pier remains auto-filled. Existing Cases 1–4 retain their storage quantity, race, incremental capacity, buffer, and Save/reload coverage. `settings.spec.ts` remains unchanged and retains priority, buffer, language, and persistence coverage.
