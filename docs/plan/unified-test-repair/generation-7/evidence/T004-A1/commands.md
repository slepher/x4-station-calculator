# T004-A1 command evidence

Working directory: `/home/slepher/project/x4-station-calculator`

1. Contract command, sandbox binding:

```text
PORT=23204 npm exec playwright test -- tests/e2e/production/module-management.spec.ts tests/e2e/production/settings.spec.ts --workers=1 --retries=0 --trace=on --output=docs/plan/unified-test-repair/generation-7/evidence/T004-A1/playwright-results
```

Exit: 1. Browser count: 0. The configured `npm run build && vite preview` web server exited before startup; no browser test ran.

2. Same focused command with elevated local binding, initial candidate:

```text
PORT=23204 npm exec playwright test -- tests/e2e/production/module-management.spec.ts tests/e2e/production/settings.spec.ts --workers=1 --retries=0 --trace=on --output=docs/plan/unified-test-repair/generation-7/evidence/T004-A1/playwright-results-elevated
```

Exit: 1. Fresh build: passed (`vite v7.3.6`, 908 modules transformed, built in 20.74s). Browser count: 25 total, 24 passed, 1 failed, 0 skipped/flaky. Failure: Case 5 expected `module_arg_pier_l_01`, while current behavior returned `module_arg_pier_l_03`. Trace and error context are retained under `playwright-results-elevated/`.

3. Contract command with elevated local binding after correcting the observed pier identity:

```text
PORT=23204 npm exec playwright test -- tests/e2e/production/module-management.spec.ts tests/e2e/production/settings.spec.ts --workers=1 --retries=0 --trace=on --output=docs/plan/unified-test-repair/generation-7/evidence/T004-A1/playwright-results
```

Exit: 0. Fresh build: passed (`vite v7.3.6`, 908 modules transformed, built in 15.03s). Browser count: 25 total, 25 passed, 0 failed, 0 skipped/flaky. The final run used port 23204 and the same frozen candidate as this result.

4. Required diff check:

```text
git diff --check -- tests/e2e/production/module-management.spec.ts tests/e2e/production/settings.spec.ts
```

Exit: 0.
