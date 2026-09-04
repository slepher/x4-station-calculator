## Bug: Locked rejected target keeps rejected styling after pointer leaves
- **ID**: BUG-001
- **Description**: A locked production group keeps the transient rejected presentation after the drag pointer leaves the group, even though the group is no longer the active hover target.
- **Steps to Reproduce**: Load the current Logic Flow E2E fixture; create a group with `energycells`; select the Agricultural category and Teladi race through the UI; start a real mouse drag of visible `spaceweed`; move over the locked group until the current status is `rejected`; move the pointer to `(50, 50)` before releasing.
- **Expected Behavior**: After the pointer leaves, `hoveredGroupId` is `null`, the transient `Rejected` label and red border disappear, and the locked group returns to its base `border-amber-500/50` presentation. Releasing outside must not mutate the group.
- **Actual Behavior**: `hoveredGroupId` becomes `null`, but the group remains `border-red-600 bg-red-900/10` instead of returning to the locked amber base style.
- **Status**: Verified
- **Related Verification**: `docs/plan/unified-test-repair/task-test-4.md`; `docs/plan/unified-test-repair/task-test-4-review-eaa14ffb.md`; `docs/plan/unified-test-repair/task-test-4-review-5d6ee09c.md`; browser reproduction in `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts`

## Bug: Empire import creates an extra default station
- **ID**: BUG-002
- **Description**: Importing a Logic Flow plan into an empire creates the default station during import reset, then creates another station for the imported non-empty group.
- **Steps to Reproduce**: Start from a saved empire; import `ilf_mixed_groups`, which has one non-empty group and one empty group; choose Save and Import or Discard and Import.
- **Expected Behavior**: The resulting empire contains exactly one station for the single non-empty group; empty groups are skipped.
- **Actual Behavior**: The resulting empire contains two stations, including an extra default station created during import reset.
- **Status**: Verified
- **Related Verification**: `docs/plan/unified-test-repair/task-test-4-review-1a61734f.md`; `docs/plan/unified-test-repair/task-test-4-review-365fa75c.md`; `tests/e2e/logic-flow/import-logic-flow.spec.ts`; focused commit `fcfea6c4`

## Bug: Import warnings are cleared before they can be observed
- **ID**: BUG-003
- **Description**: Logic Flow import generates warning state, then the import modal close lifecycle immediately clears that state before the warning modal is rendered.
- **Steps to Reproduce**: Import `ilf_mixed_groups` with an empty group, or import `ilf_non_container_isolated` into a station and complete the current strategy flow.
- **Expected Behavior**: The warning modal remains visible after import and reports skipped empty groups or ignored non-container isolated wares.
- **Actual Behavior**: Warning state is cleared by the subsequent import modal close callback, so `logicflow-import-warning-modal` is not visible.
- **Status**: Verified
- **Related Verification**: `docs/plan/unified-test-repair/task-test-4-review-1a61734f.md`; `docs/plan/unified-test-repair/task-test-4-review-365fa75c.md`; `docs/plan/unified-test-repair/task-test-4-review-0c52a3be.md`; `tests/e2e/logic-flow/import-logic-flow.spec.ts`; focused commit `fcfea6c4`
