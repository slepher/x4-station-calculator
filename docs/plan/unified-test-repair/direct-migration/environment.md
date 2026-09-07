# Direct test migration environment evidence

Date: 2026-09-07. Starting HEAD: `d590ede41d41913ab18f5c5a18247bf956a4685a`.
Owner: ENV validation agent. Source/tests unchanged by this agent. Repository edit: one `playwright.config.ts` readiness field; this report. No git writes, dependency installation, or Rust build.

## Baseline

| Command | Exit | Result | Log |
| --- | ---: | --- | --- |
| `npm run build` | 0 | Production compatibility check, TypeScript build, Vite build passed; bundle-size warning only | `/tmp/x4-test-migration-env/build.log` |
| `npm run test:unit` | 0 | 163 files, 926 tests passed; canonical `tests/unit/**/*.spec.ts` suite | `/tmp/x4-test-migration-env/unit.log` |
| Chromium `launch({ chromiumSandbox: true })` inside tool sandbox | 1 | `sandbox_host_linux.cc:41` / `Operation not permitted` | `/tmp/x4-test-migration-env/chromium.log` |
| Same Chromium launch with narrowly approved execution outside tool sandbox | 0 | `CHROMIUM_SANDBOX_LAUNCH_OK`; browser sandbox still enabled | `/tmp/x4-test-migration-env/chromium-escalated.log` |

Chromium is already installed at `/home/slepher/.cache/ms-playwright/`; no installation needed. Ordinary sandbox `ss -ltn` was denied netlink access. No other preview process appeared in the later narrowly approved process inspection. Do not disable Chromium sandbox to overcome the tool restriction.

## Readiness finding and final change

Original `webServer` had neither `url`, `port`, nor `wait`. Installed Playwright `node_modules/playwright/lib/plugins/webServerPlugin.js` sets `_isAvailableCallback` only for a URL and `_waitForProcess()` immediately returns without a callback or stdout promise. Thus `timeout: 30000` alone did not wait for build/preview startup.

The valid before run used the original webServer command and cwd, `PORT=22101`, one Chromium worker, zero retries, and `tests/e2e/live/live-archive-valid-select.spec.ts`. Both cases passed (19.8s), but `Running 2 tests` appears before Vite building and the preview `Local:` line. This proves the missing startup gate; **historical `ERR_CONNECTION_REFUSED` failures were not reproduced or conclusively attributed to it**.

An attempted URL gate exposed a separate environment issue: a connection to the unbound localhost port timed out instead of refusing (`curl --noproxy '*' --max-time 3 -I http://127.0.0.1:22101/x4-station-calculator/`, exit 28). Playwright probes availability before spawning the webServer and its HTTP probe has no explicit timeout; that run produced no output and was stopped by SIGINT (exit 130). Increasing webServer timeout would not address this initial probe.

Final repository change is a single field:

```ts
wait: { stdout: /Local:/ },
```

This uses Playwright's built-in stdout readiness support and Vite's listening message. The original build command, strict port, timeout, and reuse policy remain intact. The wrapper used for sandbox-on validation imports the repository config and supplies absolute testDir/webServer cwd plus `launchOptions.chromiumSandbox: true`.

## Runs

| Run | Exit | Count / timing | Log |
| --- | ---: | --- | --- |
| Initial wrapper attempt | 1 | 2 failed; invalid comparison because /tmp config inherited /tmp webServer cwd, producing npm ENOENT | `/tmp/x4-test-migration-env/archive-original.log` |
| Corrected before comparison | 0 | 2 passed, 19.8s; tests begin before preview readiness | `/tmp/x4-test-migration-env/archive-before.log` |
| Attempted URL readiness | 130 | 0 started; stopped stuck availability probe | `/tmp/x4-test-migration-env/archive-after.log` |
| Preview-only stdout readiness | 0 | 2 passed, 9.1s; preview ready before tests | `/tmp/x4-test-migration-env/archive-preview.log` |
| Final repository stdout readiness, original build chain, run 1 | 0 | 2 passed, 20.7s; preview ready before tests | `/tmp/x4-test-migration-env/archive-fixed-1.log` |
| Final repository stdout readiness, original build chain, run 2 | 0 | 2 passed, 23.3s; preview ready before tests | `/tmp/x4-test-migration-env/archive-fixed-2.log` |

The initial wrapper error is excluded from application failure and readiness regression counts.

Both final runs used this command, changing only the output/log suffix from 1 to 2:

```bash
PORT=22101 npm exec playwright test -- -c /tmp/x4-test-migration-env/original-sandbox.config.ts tests/e2e/live/live-archive-valid-select.spec.ts --workers=1 --retries=0 --output=/tmp/x4-test-migration-env/archive-fixed-1-results > /tmp/x4-test-migration-env/archive-fixed-1.log 2>&1
```

Final HEAD remained `d590ede41d41913ab18f5c5a18247bf956a4685a`. All ENV-owned test processes completed; no persistent preview was left running. The timeout stays at 30000ms because both final build-and-start sequences met it. The localhost probe observation is transcribed separately in `/tmp/x4-test-migration-env/url-probe-evidence.txt`.

## Safe parallel feature execution

Validated temporary config: `/tmp/x4-test-migration-env/preview-only.config.ts`. It imports repository defaults, uses absolute testDir/cwd, inherits stdout readiness, retains Chromium sandbox, and starts only `vite preview` against the already-built shared `dist`. PORT is mandatory; output defaults to `/tmp/x4-test-migration-env/results-${PORT}`.

```bash
PORT=22102 npm exec playwright test -- -c /tmp/x4-test-migration-env/preview-only.config.ts tests/e2e/<feature>/<file>.spec.ts --workers=1 --retries=0 --output=/tmp/<worker>/results
```

Assign a different port and output directory per worker. Use narrowly approved outside-tool-sandbox execution when Chromium receives the documented permission error. Do not run concurrent builds against the shared dist; rebuild once after production source changes before new previews. This temporary config is local validation tooling, not a new repository runner.
