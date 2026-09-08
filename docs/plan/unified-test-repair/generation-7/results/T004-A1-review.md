- Task: T004
- Contract revision: 1
- Result: T004-A1.md
- Candidate snapshot: same HEAD plus the owned `module-management.spec.ts` patch; `settings.spec.ts` unchanged
- Verdict: passed

## Findings

No blocking or actionable findings.

## Acceptance

The candidate matches D03 and T004. The obsolete skipped independent AutoSupply case is replaced by an active unified-infrastructure case; it neither expects nor introduces an `autoSupply` tier, `internalSupply` control, prop, or field. The public UI adds one fixed 9.0 energy-cell module and then one fixed Argon L container module. Read-only observations assert the exact unified `autoInfrastructureModules` identities and counts, while visible auto-tier row counts confirm the same transitions in the rendered panel: storage plus pier initially, then pier only after manual capacity covers the storage deficit.

The expected capacity is independent of the observed collection. Game data fixes energy-cell output at 10,500/h and volume at 1 m³; the new station defaults fix the primary buffer at 12 h and transport capacity at 62,000. Thus storage demand is 126,000 m³, requiring one 1,000,000 m³ Argon L container, and one-berth throughput is 930,000 m³/h, requiring one pier module. The current infrastructure rule admits E-large `harbor_03` piers; 9.0 data identifies the Argon candidate as `module_arg_pier_l_03` with three docks. Adding one manual Argon L container removes the storage deficit without removing the transport requirement.

The base comparison shows no active assertion was removed or weakened: Cases 1–4 and all scale/module assertions are unchanged, and `settings.spec.ts` has no diff. Existing UI-driven Save/reload coverage remains for race preference, buffer changes, module count/removal, and ware priority, including persisted values and reloaded UI/domain state. Workforce-specific tests were not present in either owned file at the base and were not removed by this candidate; existing workforce coverage remains outside this patch for final-suite validation.

Evidence and counts are coherent. Independent collection lists 25 tests in the two files (12 module-management and 13 settings) with no skip/fixme declaration. The final output has 25 trace archives, no trace error record, and `.last-run.json` reports `passed`; embedded spec sources have SHA-1 `b69144ba82a2cc64e4032eb3e20ed9250720925b` and `a72080fa2e1ef52fac59e3c28cf7972ff2571dac`, matching the reviewed files. The initial elevated run remains failed with exactly one error for the stale `module_arg_pier_l_01` expectation, and the sandbox-startup attempt remains recorded as exit 1 with zero browser tests. The final focused run is retained as 25 passed, 0 failed, 0 skipped/flaky on port 23204, and the scoped `git diff --check` passes.

## Explanation

T004-A1 retires the unavailable AutoSupply behavior without losing the storage purpose of the skipped case, and adds exact coverage for the current combined storage/pier result and manual-capacity interaction. The final focused evidence is bound to the reviewed candidate and supports acceptance. Canonical full E2E remains T010 scope; this review does not convert either earlier failed command into a pass.
