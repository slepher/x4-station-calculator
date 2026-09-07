# task-test-10.3

Status: cannot_resolve

Subtask: generation-5 unified-test-repair / task-test-10.3

Workspace: `/home/slepher/project/x4-station-calculator/.worktree/integrate`

## Preconditions

- HEAD confirmed: `761310260d1188d836326fadbdd7bdc7616de05c`
- Runner: Playwright via `npm exec playwright test`
- Browser/project: `chromium`
- Collection target: four owned original specs
- Worktree initially contained an existing untracked `docs/plan/unified-test-repair/.progress/` directory; it was preserved.

## Attempt

Command:

```text
npm exec playwright test -- tests/e2e/ship/ship-level-blueprint.spec.ts tests/e2e/ship/bugfix-ship-level-blueprint.spec.ts tests/e2e/ship/ship-build-storage.spec.ts tests/e2e/ship/ship-items.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
```

Observed before interruption:

- Playwright collected `46 tests using 1 worker`.
- `bugfix-ship-level-blueprint.spec.ts:59:1` failed: `4.1 BUG-001...`.
- `ship-build-storage.spec.ts:69:5` failed: `2.1 ...初始状态`.
- `ship-build-storage.spec.ts:88:5` failed: `2.2 ...已选飞船`.
- `ship-build-storage.spec.ts:96:5` failed: `2.3 ...已配置装备`.
- `ship-build-storage.spec.ts:108:5` failed: `2.4 ...已保存 Blueprint`.
- The run was intentionally interrupted before completion, so no complete per-test result set exists.
- The Playwright web server build completed, but preview startup reported: `Error: Port 21556 is already in use`.

## Blocker and attribution

The baseline could not reach a complete immutable result because the configured preview port was already occupied, and the user then required immediate stop. The observed failures cannot be reliably classified as test-owned or product-owned from this incomplete run; the incomplete run also prevents the required full baseline record and migration validation.

## Unmet acceptance

- Complete four-spec baseline with full SHA, runner/browser, collection, and every test result.
- Migration of the five owned specs/doc under the current accepted `import-export`, `title-as-plan-title`, `ship-level-blueprint`, `ship-blueprint-storage`, and `ship-items` contracts.
- Focused rerun with trace enabled and all valid cases passing.
- `--list --reporter=list`, `npm run build`, and `git diff --check` after migration.
- Final evidence of blueprint hierarchy, equipment counts, storage identity, reload behavior, and supported legacy import boundary.

## Recovery conditions

Resume in the same workspace after the process using port `21556` is stopped or the configured preview port is made available. Rerun the exact baseline command to completion, classify all failures, then perform only the requested owned-path migration and the specified focused validations. No commit was made.
