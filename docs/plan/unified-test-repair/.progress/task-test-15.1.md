# task-test-15.1

Status: cannot_resolve

## Assignment

- Role: `generation-5 unified-test-repair` `def_coding_worker`
- Subtask: `task-test-15.1`
- Worktree: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
- Owned paths: `tests/e2e/toolbar-action2one/toolbar-action2one.spec.ts`, `tests/e2e/toolbar-action2one/migration-task-test-15.1.md`
- Target SHA verified: `761310260d1188d836326fadbdd7bdc7616de05c`

## Attempted actions

1. Read the required role protocol at `/home/slepher/.codex/skills/codex-workflow/references/roles/def-coding-worker.md`.
2. Confirmed the integrate worktree HEAD against the accepted target. No code or test-owned file was modified.
3. Ran the original spec from the accepted target:

   ```text
   npm exec playwright test -- tests/e2e/toolbar-action2one/toolbar-action2one.spec.ts --project=chromium --workers=1 --retries=0
   ```

4. Began inspecting current test IDs and UI sources after the original run. The user then requested immediate closure, so no migration edit, focused rerun, collection listing, build, or diff check was started.

## Original-run evidence

- Command exit: `1`
- SHA: `761310260d1188d836326fadbdd7bdc7616de05c`
- Runner: Playwright, Chromium project, `--workers=1`, `--retries=0`
- Collection: `46 tests`
- Result: `37 failed`, `9 passed`, duration `4.5m`
- Runner availability: available; web server production build started successfully and Chromium executed all cases.

Passed cases:

- `3.3 Case: station-NEW-non-dirty-new`
- `3.4 Case: station-NEW-non-dirty-non-new`
- `3.8 Case: station-SAVE-non-dirty-non-new`
- `3.15 Case: logicFlow-NEW-non-dirty-new`
- `3.16 Case: logicFlow-NEW-non-dirty-non-new`
- `3.17 Case: logicFlow-SAVE-dirty-new`
- `3.21 Case: logicFlow-SAVE_AS-dirty-new`
- `3.22 Case: logicFlow-SAVE_AS-dirty-non-new`
- `3.20 Case: logicFlow-SAVE-non-dirty-non-new`

Failed cases:

- `2.1 状态: import-view-modal-open-on-empire`
- `2.2 状态: empire-import-smartsave-open`
- `2.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save`
- `2.4 切换: empire-import-smartsave-open -> empire-import-finished-after-discard`
- `3.1 Case: station-NEW-dirty-new`
- `3.2 Case: station-NEW-dirty-non-new`
- `3.27 Case: ship-build-NEW-non-dirty-new`
- `3.28 Case: ship-build-NEW-non-dirty-non-new`
- `3.25 Case: ship-build-NEW-dirty-new`
- `3.26 Case: ship-build-NEW-dirty-non-new`
- `3.29 Case: ship-build-SAVE-dirty-new`
- `3.30 Case: ship-build-SAVE-dirty-non-new`
- `3.31 Case: ship-build-SAVE-non-dirty-new`
- `3.32 Case: ship-build-SAVE-non-dirty-non-new`
- `3.33 Case: ship-build-SAVE_AS-dirty-new`
- `3.34 Case: ship-build-SAVE_AS-dirty-non-new`
- `3.35 Case: ship-build-SAVE_AS-non-dirty-new`
- `3.36 Case: ship-build-SAVE_AS-non-dirty-non-new`
- `3.37 Case: import-open-empire-entry`
- `3.38 Case: import-save-path-close-modal`
- `3.39 Case: import-discard-path-close-modal`
- `3.40 Case: import-open-and-close-without-submit`
- `3.41 Case: import-save-path-hide-actions`
- `3.42 Case: import-discard-path-hide-actions`
- `3.5 Case: station-SAVE-dirty-new`
- `3.6 Case: station-SAVE-dirty-non-new`
- `3.7 Case: station-SAVE-non-dirty-new`
- `3.9 Case: station-SAVE_AS-dirty-new`
- `3.10 Case: station-SAVE_AS-dirty-non-new`
- `3.11 Case: station-SAVE_AS-non-dirty-new`
- `3.12 Case: station-SAVE_AS-non-dirty-non-new`
- `3.13 Case: logicFlow-NEW-dirty-new`
- `3.14 Case: logicFlow-NEW-dirty-non-new`
- `3.18 Case: logicFlow-SAVE-dirty-non-new`
- `3.19 Case: logicFlow-SAVE-non-dirty-new`
- `3.23 Case: logicFlow-SAVE_AS-non-dirty-new`
- `3.24 Case: logicFlow-SAVE_AS-non-dirty-non-new`

Observed failure sources from the complete runner output:

- Import setup expected `[data-testid="logicflow-import-plan-list"]`, but the element was absent after the modal opened.
- Empire dirty setup used the obsolete `.results-popover .result-item`; current UI exposes `data-testid="candidate-search-input"` and grouped candidate items.
- Ship setup used an old direct UUID/store path and expected a missing `ship-build-fit-panel`; current toolbar actions were disabled or the panel never appeared.
- Several save/new assertions expected old `.fixed.z-[100]` or `.dialog-input` behavior. Current accepted toolbar behavior differs for clean/saved and dirty/non-new cases.
- One logic-flow saved dirty case asserted `isDirty` through the store and observed `true` after save; this is not a suitable black-box UI oracle for this migration.

## Not completed

- `migration-task-test-15.1.md` scenario-to-current-spec/fixture/UI/oracle mapping was not written.
- `toolbar-action2one.spec.ts` was not migrated.
- Focused command was not run:

  ```text
  npm exec playwright test -- tests/e2e/toolbar-action2one/toolbar-action2one.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
  ```

- Collection command with `--list --reporter=list` was not run.
- `npm run build` was not run as a standalone acceptance check.
- `git diff --check` was not run.
- No commit was created.

## Blocker and recovery condition

The user explicitly stopped further work before the owned test and migration document could be changed. Acceptance therefore cannot be established from the original failing checkpoint. Resume by updating only the two owned paths, writing the required scenario mapping first, then running the required focused command, collection listing, standalone build, and `git diff --check`; mark done only if every retained valid scenario passes.
