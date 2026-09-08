# T007-A1 validation record

## Static checks

- `git diff --check -- tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts tests/e2e/ship/ship-equipment-selector.spec.ts` — cwd `/home/slepher/project/x4-station-calculator` — exit 0.
- `npm exec playwright test -- tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts tests/e2e/ship/ship-equipment-selector.spec.ts tests/e2e/ship/bugfix-ship-equipment-selector.spec.ts tests/e2e/ship/build-ship-equipment-panel.spec.ts tests/e2e/ship/ship-build-equipment.spec.ts tests/e2e/ship/osaka-default-preset.spec.ts --list` — exit 0; exact six-spec collection: 46 tests in 6 files.

## Browser/build validation

- Required command was not run because dispatcher confirmation that exclusive `e2e-build-browser` is free was unavailable.
- Required command:

  `PORT=23207 npm exec playwright test -- tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts tests/e2e/ship/ship-equipment-selector.spec.ts tests/e2e/ship/bugfix-ship-equipment-selector.spec.ts tests/e2e/ship/build-ship-equipment-panel.spec.ts tests/e2e/ship/ship-build-equipment.spec.ts tests/e2e/ship/osaka-default-preset.spec.ts --workers=1 --retries=0 --trace=on --output=docs/plan/unified-test-repair/generation-7/evidence/T007-A1/playwright-results`
- Browser/build result: unavailable; no browser, build, preview, trace, or test-result artifact was produced by this attempt.

