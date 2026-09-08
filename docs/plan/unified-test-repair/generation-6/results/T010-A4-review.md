- Task: T010
- Contract revision: 3
- Result: T010-A4.md
- Candidate snapshot: Base `d0614371558b2f6b30e8fd6b148347868228c413` (`develop`) plus an unretained dirty working tree; all seven hashes in `evidence/T010-A4/input-fingerprints.txt` match the currently readable files, but the complete candidate is not reconstructible
- Verdict: changes-required

## Findings

### F1 — High — A4 does not retain a reconstructible identity for the dirty candidate

- Owner: dispatcher assigns a new T010 evidence runner attempt.
- Evidence: `candidate-identity.txt` identifies HEAD `d0614371558b2f6b30e8fd6b148347868228c413` plus a pre-existing dirty working tree, but A4 retains no complete status, tracked patch, untracked-input manifest/content, tree hash, or equivalent immutable snapshot. `input-fingerprints.txt` covers only `playwright.config.ts`, `vitest.config.ts`, `package.json`, `package-lock.json`, `tests/test-setup.ts`, the six-case spec, and `tests/fixtures/db.json`; independent SHA-256 checks match all seven current files. Those seven hashes do not bind the remaining source, Unit tests, E2E files, assets, scripts, or other dirty inputs consumed by Unit, collection, and build. A3's retained snapshot cannot identify A4: A3 recorded 1,016 Unit tests with three failures, while A4 records 1,024 passing tests, and A4 does not define a reconstructible delta from A3.
- Affected evidence: all A4 command results as acceptance evidence for one frozen candidate. The raw observations remain valid historical evidence.
- Allowed correction: do not amend or overwrite A4. Freeze a fresh candidate in a new T010 attempt using an immutable commit/tree or Base plus complete tracked patch and relevant untracked inputs, then bind every command and input fingerprint to that snapshot.
- Verification: an independent reviewer can reconstruct the exact candidate and confirm that Unit, collection, smoke/build, and diff-check all ran without candidate-input drift.

### F2 — High — The required six-case browser smoke did not execute; an approved listener-permission retry is required

- Owner: dispatcher/evidence runner; dispatcher serializes `shared-dist-build`, `chromium-runtime`, and `preview-port-23110` and supplies the approved permission boundary.
- Evidence: the canonical smoke command exited `1` because Playwright's configured webServer could not start. `readiness-diagnostic.log` records `listen EPERM: operation not permitted 127.0.0.1:23110`; `browser-launch-boundary.txt` records `NoNewPrivs=1`, seccomp filtering, zero capabilities, and that Chromium never launched. `.last-run.json` is `failed` with an empty `failedTests` list. Therefore the accurate result is command failure caused by sandbox listener permission, with `0/6` browser cases executed—not six product/test failures and not a browser-sandbox failure. Contract Revision 3 requires permission failures to follow the tool permission rules, so the exact canonical smoke command needs an approved-permission retry. No alternate port, temporary runner, config change, `--no-sandbox`, or assertion change is authorized.
- Affected acceptance: the fixed six-case smoke, preview readiness, and browser runtime evidence remain unavailable. The supplementary build does not replace browser execution.
- Allowed correction: in the new frozen attempt, preserve A4's restricted `EPERM` as negative evidence and run the unchanged canonical smoke command with approved local-listener permission. Retain complete built-in build/preview stdout and stderr, exit status, readiness line, browser launch boundary, case counts, and traces.
- Verification: exit `0`; exact `Local:` readiness; Chromium launched; `6/6` passed with `0` failed, skipped, flaky, and retried; retained traces cover the fixed `18,172 m³`, `00:12:36` / 756 seconds, and `90` workers expectations.

## Acceptance

| Contract item | Independent judgment |
|---|---|
| Canonical Unit | Raw log accepted as an observed run: exit `0`, `180/180` files and `1,024/1,024` tests passed; `VITEST_SUITE=<unset>`. Not accepted as final candidate-bound evidence because F1 remains open. |
| Full E2E collection | Raw log accepted as collection only: exit `0`, `843` tests in `74` files. It is not E2E execution or a full-suite pass. Candidate binding remains open under F1. |
| Six-case smoke | Not executed: canonical command exit `1`, Chromium not launched, `0/6` executed. Correct class is sandbox local-listener `EPERM`, not product/test failure. |
| Build | Supplementary `npm run build` shows `909 modules transformed` and `built in 11.27s`; this is a build pass observation, while preview readiness failed. It cannot close smoke and remains subject to F1 identity binding. |
| `git diff --check` | Command record reports exit `0`; empty `diff-check.log` is consistent with no whitespace errors. It remains subject to F1 identity binding. |
| Candidate identity/hash | Base hash is recorded and all seven selected fingerprints currently match, but the dirty candidate is not retained or reconstructible; not accepted. |
| Full canonical E2E | Not run and not claimed. `843/74` collection and focused `0/6` smoke cannot substitute for it. Full E2E remains the later T025 scope, not an added T010 requirement. |

The requested `T010-A3-review.md` is absent from `generation-6` and from the broader initiative tree. No A3 review finding is treated as closed. The existing `T010-A3.md` and its successful approved-permission `6/6` smoke remain historical evidence for the A3 candidate only and cannot replace A4/current-candidate browser evidence.

## Dispatcher next step

Allocate `T010-A5` under unchanged T010 Revision 3 and preserve A4 unchanged. Before execution, retain a reconstructible snapshot of the complete dirty candidate. Reserve the three contract resources, then run the four canonical checks in order on that snapshot: canonical Unit, full `tests/e2e` collection, the exact six-case smoke with approved local-listener permission, and `git diff --check`. The smoke must retain its built-in fresh build and preview readiness output. Do not run or claim full E2E for T010, and do not use collection or smoke as its substitute. Send A5 to a different independent reviewer; only after that review passes may dispatcher bind the accepted T010 attempt for downstream consumers.

## Explanation

A4 establishes useful facts: canonical Unit is fully green at 180 files / 1,024 tests, complete collection is 843 / 74, supplementary build passes, and diff-check passes. Its smoke failure is purely the sandbox's inability to listen on `127.0.0.1:23110`; no Chromium test began. T010 nevertheless cannot pass because the required smoke remains unavailable and the dirty candidate identity is not reproducible. No product, test, config, fixture, status, planner, or Git change is indicated by this review.
