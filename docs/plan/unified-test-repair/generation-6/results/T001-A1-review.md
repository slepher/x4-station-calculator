- Task: T001
- Contract revision: 1
- Result: T001-A1.md
- Candidate snapshot: revised result SHA-256 `0af258175847c7a9af79408d7315fbade486ec092c7a93c6c8d772bd042df8c5`; reported Base `d0614371558b2f6b30e8fd6b148347868228c413`
- Verdict: passed

## Findings

### F1 — High — T010 handoff contradicted the frozen executable contract

- Status: closed in the revised result.
- Owner: T001 result author. Planner owns any future semantic amendment to T010.
- Original evidence: the prior candidate requested a standalone build, used `runner-sandbox.config.ts`, and required another executable revision despite the frozen T010 contract.
- Closure evidence: revised `T001-A1.md:75-78` now states that T010 is already executable, uses `evidence/T010-A1/runner.config.ts`, follows the exact Unit/list/smoke/diff sequence, and obtains the fresh build from the smoke webServer without a standalone duplicate. This matches retained Revision 1 `tasks/T010.md:18-20,25,31-52`; current T010 Revision 2 explicitly preserves those semantics.
- Verification: direct comparison with both the retained Revision 1 T010 contract and current Revision 2 found no remaining runner-path, build-order or planning-gate conflict.

### F2 — Medium — Browser cache evidence checked the headed binary instead of the configured headless executable

- Status: closed in the revised result.
- Owner: T001 result author.
- Original evidence: the prior candidate recorded only `chromium-1200/chrome-linux64/chrome`, while `headless: true` resolves to `chromium-headless-shell`.
- Closure evidence: revised `T001-A1.md:47,65` records Playwright's headless resolution, the Linux executable path, both headless-shell completion markers, mode `755`, and successful read/execute checks. Independent inspection reproduced those observations for `/home/slepher/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell`.
- Verification: `chromium.js:326-330`, `registry/index.js:88-95`, the cache markers, and `test -r`/`test -x` agree. Browser launch correctly remains unverified.

### F3 — Medium — Input hashes initially named the wrong retained paths

- Status: closed in the final revised result.
- Owner: T001 result author; dispatcher binds the accepted result identity.
- Original evidence: the intermediate candidate recorded Revision 1 hashes against the mutable current T010/plan/decisions paths after Revision 2 publication.
- Closure evidence: final `T001-A1.md:27,29-30` now names `revisions/revision-1/tasks/T010.md`, `revisions/revision-1/plan.md`, and `revisions/revision-1/decisions.md`. Independent `sha256sum` reproduced the recorded values `ef39622a...`, `1c720e49...`, and `c79e45a8...` at those exact retained paths.
- Allowed correction: none remains.
- Verification: every corrected path-to-hash mapping matches. D12/current T010 Revision 2 preserves the T010 behavior, dependency, resources and validation commands, so accepting this retained Revision 1 T001 evidence does not require rerun.

## Acceptance

The final revised result closes all three historical findings. Its runner configuration, dependency versions, tracked and untracked input identities, counts, stale/unbound `dist`, permission and limited port observations are independently supported. It continues to distinguish historical evidence and local file presence from unverified build, launch, Unit, collection and E2E outcomes.

T001-A1 is accepted for its bounded read-only investigation. This acceptance does not claim that build, browser launch, port availability, Unit, collection or E2E passed; those remain T010/T025 runtime evidence.

## Explanation

The T001 investigation and evidence identity are complete. T010 may consume the accepted facts under its current Revision 2 contract, with runtime validation and real exits/counts/logs still required.
