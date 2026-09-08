- Task: T010
- Contract revision: 3
- Result: T010-A5.md
- Candidate snapshot: Base `d0614371558b2f6b30e8fd6b148347868228c413` plus the pre-run status, complete tracked binary diff, and 4,508 SHA-256-identified regular non-ignored tracked/untracked files retained by `evidence/T010-A5/input-fingerprints.txt`; post-run consistency and this review's independent manifest recheck both exited `0`
- Verdict: passed

## Findings

No acceptance-blocking findings.

## Acceptance

| Contract item | Independent judgment |
|---|---|
| Candidate binding | Accepted. A5 closes A4 F1: `input-fingerprints.txt` records the base, capture time/date, complete dirty status, complete tracked binary patch, and a 4,508-entry manifest covering the regular non-ignored tracked/untracked candidate. `snapshot-consistency.exit` is `0`, and an independent review-time `sha256sum --quiet -c` recheck of all 4,508 entries also exited `0`. The retained paths therefore still reconstruct and identify the exact candidate that ran; any later manifest-input change invalidates reuse and requires refreshed evidence. |
| Canonical Unit | Accepted: exact `npm run test:unit`, `VITEST_SUITE=<unset>`, exit `0`, `180/180` files and `1,024/1,024` tests passed. The warning about stale Browserslist data is non-failing and does not alter the result. |
| Full E2E collection | Accepted as collection only: exact repository-config `--list --reporter=list` command exited `0`; the retained list contains 843 cases across 74 unique spec files and reports `Total: 843 tests in 74 files`. It is not browser execution or an E2E pass. |
| Restricted sandbox attempt | Correctly retained as a failed first attempt: the canonical smoke command exited `1` because the configured webServer could not start, before Chromium or any of the six cases ran. A4's accepted diagnosis identifies the same restricted-environment listener boundary as `listen EPERM`; A5 keeps this exit/log separate and does not relabel it as a product/test failure. |
| Approved permission retry and build/readiness | Accepted: the unchanged canonical smoke command was retried under approved permission and exited `0`. Its built-in `npm run build` transformed 909 modules and completed in 8.30s; preview then emitted `Local: http://127.0.0.1:23110/x4-station-calculator/`. Preflight showed port 23110 free, and postflight showed no listener or retained browser/preview process. |
| Chromium six-case smoke | Accepted: project `chromium`, one worker, zero retries, trace on; Chromium executed all six cases and reported `6 passed`, with no failed, skipped, flaky, or retried cases. `.last-run.json` is `passed`; six valid trace archives are retained. Their captured spec contains the fixed independent assertions for `18,172 m³`, `00:12:36` (756 seconds), and `90` workers. Trace context also records Playwright 1.57.0 and Chrome 143.0.7499.4 user agent. |
| Diff and exit records | Accepted: `git diff --check` has an empty diagnostic body plus explicit exit `0`. Separate exit records exist for Unit `0`, collection `0`, sandbox smoke `1`, approved smoke `0`, diff-check `0`, and snapshot consistency `0`; the failed sandbox observation remains failed. |
| Scope boundary | Preserved. T010 ran full collection and one fixed six-case Chromium smoke, not the canonical full E2E suite. Neither `843/74` collection nor `6/6` smoke can satisfy or replace T025 full E2E. |

A4 remains unchanged as historical negative evidence. Its F1 candidate-binding gap and F2 unavailable browser smoke are closed only by this A5 candidate and evidence set.

## Exact follow-up

1. Dispatcher may accept and bind T010 to `T010-A5.md` for the recorded candidate snapshot; preserve A4 and its review unchanged.
2. Do not reuse A5 build/runtime results after any candidate manifest input changes; produce new affected evidence instead.
3. Keep T025 open. Its owner must still run and report the canonical full E2E suite; T010 collection and smoke are prerequisites/evidence only, not T025 completion.

## Explanation

The complete dirty-candidate fingerprint now binds all four canonical checks without observed input drift. Canonical Unit is fully green, complete E2E discovery is retained without being overstated, and the permission boundary is accurately represented by a failed restricted attempt followed by a successful approved retry. The approved retry supplies the missing fresh build, preview readiness, Chromium execution, six expected-value cases, traces, port lifecycle, and successful exit. This independent review did not implement or rerun the candidate tests and made no source, test, config, status, planner, or Git change.
