- Task: T003
- Contract revision: 1
- Result: T003-A2.md
- Candidate snapshot: HEAD `8b5894bc85a7de3d608efa8db74357d942764519`; `tests/e2e/vue-drag-test.spec.ts` blob `c790803706232cca980c9e6baaa82c47469ec471`; read-only regression `tests/e2e/compact-drag-view.spec.ts` blob `b0dcada7cb2fb62057706d5d5cfdc839ef5cde2e`
- Verdict: changes-required

## Findings

1. **Medium — Reset does not verify drag-state cleanup.** T003 acceptance requires both cancellation and Reset to verify drag-state cleanup. `tests/e2e/vue-drag-test.spec.ts:171`–`179` adds two placeholders and clicks Reset while idle, then checks only the item lists and `events`. The retained Reset trace confirms zero mouse down/move/up actions, so no active drag, dragged item, hover, or Sortable artifact existed for Reset to clear; `events` was also empty before Reset. Owner: T003 implementation owner. Allowed correction: change only `tests/e2e/vue-drag-test.spec.ts` so a real pointer drag reaches an asserted active/hover state, invoke the visible Reset control through UI input, and verify `active/item/hover`, Sortable artifacts, item ownership, and event history are reset without any `page.evaluate` write or direct store action. Verification: rerun the exact two-spec focused command with `--workers=1 --retries=0 --trace=on` into a fresh attempt directory, rerun the scoped `git diff --check`, and independently inspect the new Reset trace and assertions.

## Acceptance

The other retained scenarios align with the contract. Both specs drive drag behavior through Playwright mouse down/move/up; post-fixture `page.evaluate` calls only observe state. Auto, Isolate, lock, and Reset setup use visible controls. Normal and compact drops assert exact destination identity, uniqueness, and idle state; cancellation and rejection assert unchanged ownership and absence of a drop; accepted locked movement asserts the exact item/group and event ordering. No skip, synthetic drag event, direct store mutation, swallowed failure, or weakened business assertion was found.

The focused evidence is valid for the assertions that ran: `.last-run.json` reports `passed`, ten trace archives exist with no recorded errors, and their embedded copies of both specs match the reviewed files byte-for-byte. The traces show real pointer sequences for all drag cases and three UI clicks but no pointer sequence for Reset. Thus `10 passed, 0 failed, 0 skipped` is correctly interpreted as a focused run passing as written, but it does not satisfy the missing Reset contract assertion. The directory does not retain the claimed full reporter/build output; it retains the pass marker and traces.

## Explanation

The candidate preserves the real-pointer fixes and strong positive/negative outcomes without synthetic business actions. It needs one focused test correction because the current Reset pass proves list restoration only, not cleanup of an in-progress drag. T003 remains open pending that correction and fresh focused evidence. Final canonical E2E remains T010/T025 scope.
