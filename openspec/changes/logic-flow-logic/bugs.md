## Bug: Locked rejected target keeps rejected styling after pointer leaves
- **ID**: BUG-001
- **Description**: A locked production group keeps the transient rejected presentation after the drag pointer leaves the group, even though the group is no longer the active hover target.
- **Steps to Reproduce**: Load the current Logic Flow E2E fixture; create a group with `energycells`; select the Agricultural category and Teladi race through the UI; start a real mouse drag of visible `spaceweed`; move over the locked group until the current status is `rejected`; move the pointer to `(50, 50)` before releasing.
- **Expected Behavior**: After the pointer leaves, `hoveredGroupId` is `null`, the transient `Rejected` label and red border disappear, and the locked group returns to its base `border-amber-500/50` presentation. Releasing outside must not mutate the group.
- **Actual Behavior**: `hoveredGroupId` becomes `null`, but the group remains `border-red-600 bg-red-900/10` instead of returning to the locked amber base style.
- **Status**: Confirmed
- **Related Verification**: `docs/plan/unified-test-repair/task-test-4.md`; `docs/plan/unified-test-repair/task-test-4-review-eaa14ffb.md`; browser reproduction in `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts`
