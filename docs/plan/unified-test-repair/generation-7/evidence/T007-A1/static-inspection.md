# T007-A1 static inspection

- Contract revision: 1
- Input: HEAD `8b5894bc85a7de3d608efa8db74357d942764519` plus the pre-existing generation-7 planning tree and unrelated working-tree edits
- Owned writes: `tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts`, `tests/e2e/ship/ship-equipment-selector.spec.ts`

Current source facts used by the patch:

- `ShipBuildWorkspaceView.vue:107-161` always passes `wide=false` to Fit. Picker mode renders Fit, the picker panel, equipment details, and Stats; Materials is rendered only after picker mode closes.
- `ShipBuildPanelFit.vue:879-882` maps `wide=false` to `lg:col-span-4`.
- `ShipBuildPanelEquipment.vue:181-300` exposes the picker panel, equipment metrics panel, existing picker action testids, and candidate testids.
- `ShipBuildPanelEquipment.vue:197` applies `filter-items-race-two-rows` when `raceTags.length > 5`.

Changed coverage:

- Replaced the historical Fit `>60%` width oracle with visible panel identities and fixed-viewport bounding-box order/non-overlap checks for Fit → picker → equipment details, with details above Stats and Materials hidden.
- Replaced the historical `>3` race-tag threshold with `>5` and an explicit current two-row class check.
- Replaced the historical internal two-column shell assertion with the current three-column workspace checks while retaining the valid 25.6px controls checks.
- Existing candidate set, exact equipment IDs, fixed details values, empty candidate/current, confirmation, cancellation, and blueprint invariance cases remain in the owned specs.

