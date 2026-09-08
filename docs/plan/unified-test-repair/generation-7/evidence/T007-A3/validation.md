# T007-A3 validation

- `git diff --check -- tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts tests/e2e/ship/ship-equipment-selector.spec.ts` — cwd `/home/slepher/project/x4-station-calculator` — exit 0.
- `npm exec playwright test -- tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts tests/e2e/ship/ship-equipment-selector.spec.ts tests/e2e/ship/bugfix-ship-equipment-selector.spec.ts tests/e2e/ship/build-ship-equipment-panel.spec.ts tests/e2e/ship/ship-build-equipment.spec.ts tests/e2e/ship/osaka-default-preset.spec.ts --list` — cwd `/home/slepher/project/x4-station-calculator` — exit 0; exact collection is 46 tests in 6 files.
- Browser/build rerun — not run by this worker; dispatcher may run it after this patch. No new runtime result or acceptance claim is recorded here.

