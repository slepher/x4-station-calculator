## Bug: Virtual Station map drag does not create a placement preview or update the draft
- **ID**: BUG-001
- **Description**: An existing virtual production station draft enters the real mouse-drag state, but dragging it to a valid current group coverage sector does not create the binding placement preview or update its sector, position, or group assignment.
- **Steps to Reproduce**: Load the current Live binding fixture; open auto-sector-group; open the Map view and Virtual Station tab; drag the existing “新建空间站” draft from `cluster_100_sector001_macro` to the visible `cluster_26_sector001_macro` sector polygon using the mouse.
- **Expected Behavior**: After the source drag threshold is crossed and the pointer enters a valid group anchor/coverage sector, a binding placement preview is shown; releasing updates the virtual station draft to the target sector and recomputes its group assignment.
- **Actual Behavior**: The source enters `virtual-row--dragging` and the target polygon is hit, but `.placement-preview--binding` never appears and the draft remains at `cluster_100_sector001_macro` after release.
- **Status**: Confirmed
- **Related Verification**: `docs/plan/unified-test-repair/task-test-4-review-6a772220.md`; `tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts` test `5.3 station plan 归属重分配`
