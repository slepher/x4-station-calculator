# T006-A1 evidence

- Contract: T006, revision 1
- cwd: `/home/slepher/project/x4-station-calculator`
- Input snapshot: HEAD `8b5894bc85a7de3d608efa8db74357d942764519` plus the pre-existing generation-7 planning tree and unrelated user changes
- Candidate snapshot: same input; `tests/e2e/map/x4-import-move.spec.ts` was unchanged
- Owned spec SHA-256: `5801942d54635e573a1e0d2a19e46f12559b74287b39af3241484c99767d1cb2`
- Read-only fixture SHA-256: `tests/fixtures/import-export/import-full.json` `4bbc7add0ee31575d2707c6fe5a2d78d4be363bb715e4c75bf3f07d4bc0804d4`; `tests/fixtures/x4-export.json` `c91d9a5d43e15b4d0168771a78e59bcaea4f74d5533076295cf91cc1bd8e656f`

## Existing coverage verification

The current spec contains 8 tests: six current import cases, one station placement case, and one sector placement case. Both placement cases use the real `.sector-polygon` pointer geometry, independently calculate expected X/Z from fixed 8.0 map center `{x: 192000, z: -128000}`, scale `1.4073989167353207e-6`, and integer pointer coordinates, with `6000` game-unit tolerance. They assert `empire-1`, the station or business-sector ID, `cluster_01_macro`, `cluster_01_sector001_macro`, sunlight `123`, and the fixed resource list. Each Save/reload path checks storage key `x4_empire_data`, active empire/object identity `empire-1`, the same target record, untouched contrasting record, `isDirty === false`, and visible placed state.

## Validation

```text
PORT=23206 npm exec playwright test -- tests/e2e/map/x4-import-move.spec.ts --workers=1 --retries=0 --trace=on --output=docs/plan/unified-test-repair/generation-7/evidence/T006-A1/playwright-results
```

- Actual runner: Playwright Chromium, one worker, retries 0
- Web server: build succeeded; preview bound at `http://127.0.0.1:23206/x4-station-calculator/`
- Exit status: `0`
- Result: `8 passed`, `0 failed`, `0 skipped`, 55.5 seconds
- Retained runner marker: `playwright-results/.last-run.json` reports `{"status":"passed","failedTests":[]}`
- Generated artifact inventory after the run: `.last-run.json` plus 8 Chromium `trace.zip` archives, one for each passed test.

```text
git diff --check -- tests/e2e/map/x4-import-move.spec.ts
```

- Exit status: `0`

The unrelated pre-existing changes were preserved: three modified E2E specs and the generation-7 planning tree remain in `git status`; no source, Unit, helper, fixture, config, dependency, status, planning, commit, or merge change was made by T006.
