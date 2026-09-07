# task-test-8.3 progress

Status: cannot_resolve

Subtask: migrate `tests/e2e/map/map-dlc.spec.ts` to accepted map-DLC black-box behavior.

Required SHA: `761310260d1188d836326fadbdd7bdc7616de05c`.
Branch: `workflow/unified-test-repair-integrate`.

Baseline command completed with exit `1`: `2 passed`, `18 failed`. The failures exposed stale fixed polygon totals (`173`/`88` expected versus `325`/`164` received).

Candidate command completed with exit `1` after the owned test edits:

```text
npm exec playwright test -- tests/e2e/map/map-dlc.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
```

Candidate result: `2 passed` (`3.13`, `3.14`), `18 failed`. `13` failures were `net::ERR_CONNECTION_REFUSED` from the preview runner and are classified `unavailable`. Four failures (`2.5`, `3.1`, `3.11`, `3.15`) still observed zero `Cluster_408_macro`; one (`3.12`) timed out on `map-station-entry-button`. Those remaining accepted-oracle questions are `unknown` within test-only authority. No product failure was established.

Applied owned changes are retained in `tests/e2e/map/map-dlc.spec.ts`: fixture deep-copy/key injection, `vsn` removal, `isTestEnv=true`, reload, UI `language-select` → `zh-CN`, localized map navigation, and semantic cluster/sector assertions. No tests were skipped and no product paths were changed.

Not run: any test after the completed candidate, `git diff --check` after final edits, and any list/build beyond the Playwright startup build. No Git commit was made.

Recovery: start a fresh stable preview runner, obtain the accepted current map-DLC visible cluster/sector and station-search selectors/oracles, then rerun the exact focused command and `git diff --check` within the three owned paths.
