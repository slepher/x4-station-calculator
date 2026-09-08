- Task: T006
- Contract revision: 1
- Result: T006-A1.md
- Candidate snapshot: same input; owned spec unchanged
- Verdict: passed

## Findings

No blocking or actionable findings.

## Acceptance

The no-gap conclusion is accepted. The current owned spec has eight active tests: the six retained import cases plus distinct station and sector placement cases. Its SHA-256 is `5801942d54635e573a1e0d2a19e46f12559b74287b39af3241484c99767d1cb2`, matching HEAD, T006-A1, and the embedded spec in all eight retained traces. The owned-file diff is empty, so no test change was needed.

Both placement cases use real mouse move/down/move/up input from the exact station or business-sector panel item to the `cluster_01_sector001_macro` polygon. The station case captures the newly created station business ID and reuses that exact ID for the panel item, empire record, overlay, reload record, and visible placed row. The sector case uses business ID `empire-1-sector-placement` while separately asserting map sector macro `cluster_01_sector001_macro`; it does not confuse those identities. Both read the target from active empire `empire-1`, assert exact `cluster_id` and `sector_id`, and verify that the contrasting station/sector remains unplaced.

The coordinate and map-data oracles are accepted. Fixed 8.0 data independently confirms cluster `cluster_01_macro`, sector `cluster_01_sector001_macro`, raw center `{x: 192000, z: -128000}`, scale-per-radius `1.4073989167353207e-6`, sunlight `123`, and resources `['hydrogen', 'ice', 'nividium', 'ore', 'silicon']`. Before the pointer action, the test derives expected raw X/Z from those fixed values, the polygon bounds, and the integer client pointer; it does not invoke the production conversion or reuse observed location output. The `6000` tolerance is in raw game-coordinate units and covers rendering/rounding residual while exact cluster/sector assertions prevent it from masking a wrong map identity.

Save/reload coverage is sufficient. Each case proves dirty `true`, performs the visible Save action, proves dirty `false`, asserts the 8.0 empire storage identity `x4_empire_data` and active empire/object identity `empire-1`, reloads, and then finds the same target business ID with the same exact map metadata and bounded X/Z while the contrasting object remains untouched. It also reopens the map station panel and verifies the same row remains visibly placed, so the evidence is not limited to pre-reload memory.

The focused evidence is coherent: port `23206`, Chromium, one worker, zero retries, exit `0`, eight passed, zero failed/skipped, eight trace archives, and a passed `.last-run.json`. The traces contain the real pointer actions, Save, reload, post-reload assertions, and no error/failure record. The scoped `git diff --check` also exits `0`.

## Explanation

T006-A1 correctly retained the existing station/sector placement and persistence coverage without rewriting an already complete spec. The candidate satisfies the current generation-7 contract and can return to dispatcher/T010. Canonical full-suite validation remains T010 scope; this review accepts only the bounded T006 candidate and its focused evidence.
