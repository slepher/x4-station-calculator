# task-test-1 Report 1

## Routing

- Task: `task-test-1.md`
- Report: `task-test-1-report-1.md`
- Scope: `task-test-1.1`
- Checkpoint: `bd3c3c52` (target-synchronized; original test checkpoint `29a55e80`)
- Target: `0adc908e48d36d186c3a35278935b72d635266d1`
- Command: `npm run test:unit -- tests/unified-unit`; `npm run test:unit -- tests/skills/unit tests/e2e-skills/unit`
- Result: `failed` / `cannot_resolve`

- Status: `cannot_resolve`
- Candidate: `29a55e80` on `codex/unified-test-repair-g1-integrate`
- Target: `0adc908e48d36d186c3a35278935b72d635266d1`
- Target ancestor check: passed

## Blocker

The mandatory skills suite depends on missing out-of-scope assets:

- `validate-test-impl-assets.spec.ts`: corresponding `e2eSpec` asset is missing.
- `validate-test-results-run.spec.ts`: required `scriptPath`/data directory is missing; subprocess exits `2`.

The task owns only `tests/unified-unit/` and `tests/unit/`; `tests/skills/**`, `tests/e2e-skills/**`, and skill assets are read-only. No legal repair is available in this task.

The integrate lane was subsequently synchronized with the current develop target, producing `bd3c3c52`. This synchronization changed no test evidence and does not turn the checkpoint into an accepted candidate.

## Changes preserved

- Moved all 85 legacy specs from `tests/unit/<path>` to `tests/unified-unit/current/<path>`.
- Repaired only migration-relative imports and fixture/script paths.
- `tests/unit/` contains no `*.spec.ts` files.
- No product, config, fixture/seed, E2E, skills, OpenSpec, guide, or workflow files changed.
- Dispatcher checkpoint commit: `29a55e80`.

## Evidence

- Initial unified run: 108 files; 36 passed / 71 failed / 1 skipped; 400 tests; 240 passed / 157 failed / 3 skipped; 16 errors.
- Canonical run: 193 files; 105 passed / 87 failed / 1 skipped; 897 tests; 706 passed / 188 failed / 3 skipped; 16 unhandled errors.
- Migrated legacy group: 85 files; 61 passed / 24 failed; 422 tests; 391 passed / 31 failed.
- Skills suite: 8 files; 6 passed / 2 failed; 73 tests; 66 passed / 7 failed.
- NPC Trade migrated group: 5 files / 13 tests passed.
- `git diff --check`: passed.

## Remaining classification

The remaining canonical failures include retired-import collection failures, current mock/setup gaps, and stale assertions in build-plan, terraforming, map, game-version, and save-import groups. They cannot be accepted as product defects or deleted as obsolete until the skills gate is repairable and the public-contract review continues.

## Next action

Route the missing skills assets/scripts to their owning workflow scope. Keep `task-test-2` blocked until `task-test-1` can produce an accepted immutable candidate.
