- Task: T012
- Contract revision: 2
- Result: T012-A1.md
- Candidate snapshot: `DragTestPage.vue` `78d5448cc88e36fe34bbe887c7298eaec3e70ecf0eedb281168a5c04edf8b430`; presenter `ec566b6e7a1db19a54e2f926ab491200b2a099af45341ef306b1a0bacc9f4a3d`; store `91c6694fe468111a0a830767f2a8f840526aad64de68b2a059d05d93a417db78`; Unit `55671c241a1445a14ec1a92354baa3d2051bbf64f18e90741547451f10a7bef8`; T013-A3 E2E `78313ec7a29821b4c31068c8fdc2c710419566718785afa0e145bf24b67c9f91`
- Verdict: changes-required

## Findings

### F1 — high — locked Terran 的真实 pointer 成功事务缺少规范要求的 `dragover`

- Evidence: archived `vue-drag-test` specification requires successful order `dragstart → dragenter → dragover → drop → dragend`; T012 acceptance 2 and T013 acceptance 2 retain locked hover/events semantics. In the retained T013-A3 Terran trace (`evidence/T013-A3/playwright-results/vue-drag-test-S-5-locked-lineage-permits-Terran-chromium/trace.zip`), the final store observation is `dragstart`, A `dragenter`/`dragleave`, B `dragenter`, `drop`, `dragend`, with no `dragover`. The Argon trace likewise reaches B hover and rejects without any `dragover`. `hoverB()` passes because `enterZone()` also sets `hoveredZoneId`; the locked tests at `tests/e2e/vue-drag-test.spec.ts:127` and `:139` assert hover/final lists but never events, so A3's 8/8 does not detect this loss.
- Affected paths: `src/components/test/DragTestPage.vue:98`, `src/store/useDragTestStore.ts:105`, `tests/unit/common/drag-demo-list-ownership.spec.ts:37`, `tests/e2e/vue-drag-test.spec.ts:127`.
- Owner: T012 for the product event boundary and focused Unit; T013 for locked real-pointer event assertions.
- Allowed correction: keep visual pointer containment at the existing Vue boundary, but ensure a genuine locked-zone pointer traversal records the real B `dragover`; do not synthesize the sequence, relax expected events, or move ownership into another layer.
- Verification: mounted-component red/green covering the locked nested pointer path and full event result; fresh-build real-pointer assertions that Terran has B `dragover` then `drop`, Argon has B hover/`dragover` and no `drop`, and both end cleanly.

### F2 — high — current candidate still force-removes Sortable DOM outside Vue ownership

- Evidence: `DragTestPage.vue:121-124` calls `parentNode.removeChild(evt.item)` after a rejected add. This is present in the reviewed candidate even though T012 acceptance 4 forbids force-deleting DOM and requires the store to remain the single list/transaction owner. The 8/8 run proves the observed Argon outcome, but not compliant lifecycle ownership; the focused Unit does not exercise the component's rejected `@add` handler or DOM reconciliation.
- Affected paths: `src/components/test/DragTestPage.vue:115`, `tests/unit/common/drag-demo-list-ownership.spec.ts`.
- Owner: T012.
- Allowed correction: reject or reconcile through the existing controlled `modelValue`/Vue/store path, without a copied list, adapter, timer, framework rewrite, or direct DOM deletion.
- Verification: mounted rejection path and fresh real pointer show one Argon node in A, none in B, unchanged authoritative items, no orphan Sortable nodes, and normal/Terran/Auto/Isolate behavior remains intact.

### F3 — high — T013-A3 is 8/8, not the contract's required single 10/10

- Evidence: T013 revision 4 requires compact two plus the eight `vue-drag-test` transactions in one complete ten-item, zero-skip result. `evidence/T013-A3/run-summary.md` and `evidence/T013-A3/playwright-run-escalated.log` record exactly eight collected/eight passed from only `tests/e2e/vue-drag-test.spec.ts`; no current compact result is included. Historical compact passes are preserved evidence, but the contract explicitly disallows composing different candidate/runs into 10/10.
- Affected paths: T013 evidence/result only; no product correction follows from this count alone.
- Owner: T013 evidence runner/dispatcher; planner only if eight items were intentionally meant to replace the published ten-item acceptance.
- Allowed correction: after F1/F2 close, retain one latest run containing `tests/e2e/compact-drag-view.spec.ts` and `tests/e2e/vue-drag-test.spec.ts`, or obtain an explicit contract revision. Do not relabel 8/8 as 10/10.
- Verification: one candidate-bound 10 collected/10 passed/0 skipped/0 flaky result.

## Acceptance

- Accepted diagnosis: the first missing-hover defect was correctly owned by `overZone`; T013-A1 then contradicted the nested DOM counter and showed B leave/source-A bubbling under Sortable reparenting. Replacing ancestry counts with pointer-in-rectangle checks at the Vue event boundary is the smallest coherent owner change and preserves `store → presenter → vue`; the presenter is unchanged and all current fingerprints match the retained candidate.
- Accepted observable outcomes: T013-A2 and A3 show the corrected pointer candidate clears outside hover, rejects locked Argon without moving it, permits locked Terran into B, and keeps normal/cancel/Auto/Isolate/duplicate/Reset green. Auto/Isolate flags and unique authoritative items remain asserted. This does not override F1's event loss or F2's lifecycle violation.
- Accepted setup correction: the T013-A3 `#debug-ready-marker` attached wait is an existing repository readiness pattern, sits after fixture reload and before UI language selection, and changed A2's setup-only timeout into an executed 8/8 run without weakening drag assertions.
- Not accepted: T012 may not be recorded accepted by dispatcher while F1 and F2 remain. T013 also may not be recorded complete from A3 because F3 remains.

## Explanation

The hover root cause and pointer-coordinate direction are sound, and the corrected source is demonstrably better than A1. The current green count nevertheless hides one required event-semantic failure, retains a contract-forbidden direct DOM deletion, and covers only eight of the published ten transactions. Return F1/F2 to T012, then close F3 in T013 before T025.

Remaining non-blocking scope: the archived `add` versus current `drop` naming conflict remains unchanged; no persistence or formal Logic Flow path changed. The lock button currently renders `Locked ([object Object])`, so T013's prefix locator is adequate only to operate the existing toggle, not evidence that its label is correct; label repair is outside this T012 acceptance unless separately contracted. This review was read-only apart from this assigned result and did not rerun tests.
