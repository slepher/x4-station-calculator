- Task: T005
- Contract revision: 1
- Result: T005-A3.md
- Candidate snapshot: corrected `tests/e2e/production/station-resource-group.spec.ts`; no source/Unit/helper/fixture/config changes
- Verdict: passed

## Findings

No open findings. The two T005-A2 review findings are closed:

1. `tests/e2e/production/station-resource-group.spec.ts:1-2` now imports `test` from `../../test-setup` while retaining `expect` and `Page` from Playwright. A retained A3 resource-group trace embeds the corrected spec, shared test setup and logic-flow setup helper byte-for-byte; their SHA-1 values match the current files (`4fea7784eda1d89c293b533e2af52bdeaf206235`, `522671d3b2f962bdf01885c53b2d35f407da69ec`, and `9fd78d471b328c16fe7c747800cdb8689da13aad`). No correction remains.
2. `tests/e2e/production/station-resource-group.spec.ts:175-177` now asserts all three Logic Flow 1 groups exactly as sorted wareId arrays: `['hydrogen', 'methane', 'ore', 'silicon']`, `['helium', 'methane']`, and `['ice']`. This closes the incomplete per-group oracle without changing a helper, fixture or product source. No correction remains.

## Acceptance

The corrected candidate aligns with Revision 1. It uses the shared browser-error-checking fixture and preserves the accepted current loader mapping: cases 3.2 and 3.3 select fixed saved-empire button identities, reject the empty empire and obsolete sector testids, verify menu closure and the loaded label, and assert Empire 1's three groups exactly. Case 3.9 proves Empire 2's resource-free first station produces no group while its second station produces one exact five-ware group. Case 3.12 fixes the selected identity to `logic-flow-1`, verifies its active class, and does not require an empire active class.

The existing logic-flow load, group edit/refresh, empty-plan filtering, candidate refresh, outside-close, panel-close and map-panel interaction scenarios remain in the owned spec. The A3 evidence contains 97 trace archives: 16 station-resource-group, 33 station-dashboard and 48 ware-flow, with no other traces. `.last-run.json` reports `passed` and an empty `failedTests` list; the three focused specs contain no `skip`, `fixme` or `only` marker. This accepts both read-only consumer regressions without changing `station-dashboard.spec.ts` or `ware-flow.spec.ts`.

The task-scoped candidate boundary is intact. Against base `8b5894bc85a7de3d608efa8db74357d942764519`, only `station-resource-group.spec.ts` differs among the three focused specs; current status likewise shows both consumer specs unchanged. The A3 trace binds the run to the current corrected spec and shared setup, and the scoped `git diff --check` exits 0.

## Explanation

T005-A3 closes both required corrections from A2 and retains the already accepted saved-empire, filtering, loader-state and candidate behavior. The focused run passed all 97 resource-group and consumer scenarios on the corrected shared fixture. T005 is accepted; final canonical E2E remains T010 scope.
