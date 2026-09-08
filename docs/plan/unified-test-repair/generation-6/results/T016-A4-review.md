- Task: T016
- Contract revision: 4
- Result: T016-A4.md
- Candidate snapshot: `tests/e2e/map/x4-import-move.spec.ts` SHA-256 `466e2d2f5540c8a37d3e6c678295bca1456fcd0b0304cc84f12cac8a277e9258`; current file and all 8 retained trace-embedded copies match
- Verdict: changes-required

## Findings

### F1 — Medium — Owned spec 缺少合同要求的旧七项到八项映射说明

- Owner: T016 implementation owner。
- Evidence: Revision 4 Acceptance 4 要求“测试补丁内给出旧七项 → 加强/新增场景映射”；planner `T016-A3-owner/1` 又明确要求在映射/注释中写明“6 import 保留；station 加强、sector 新增；pointer 为 polygon 中心附近的确定整数屏幕像素；独立 raw expected 使用固定 8.0 数据和动作前 DOM 几何”。当前 Owned spec 只有 `test.describe('x4-import-move e2e mapping')` 及六个 `3.1`–`3.6`、两个 placement 标题，没有上述旧 7 → 新 8 的显式映射/注释；相关说明只出现在 `T016-A4.md`，不能替代合同指定的测试补丁内说明。
- Affected path: `tests/e2e/map/x4-import-move.spec.ts`。
- Allowed correction: 仅在该 Owned spec 增加一段最小静态注释，逐项说明原六项 import 保留、原 station placement 加强、新增 sector placement，并注明两项共用动作前 polygon geometry、整数 pointer、固定 8.0 raw center/scale 的独立 expected。不得改测试逻辑、容差、fixture/helper/config/source。
- Verification: 独立复核修正 diff 仅为该注释，并执行 scoped `git diff --check -- tests/e2e/map/x4-import-move.spec.ts`。若仅增加注释，A4 的 8/8 行为证据仍有效，无需重跑 full/focused E2E；若任何可执行测试内容变化，则必须绑定新候选并重跑原 8-test 独占 fresh-build 命令。

## Acceptance

- Oracle 修正成立。`dragPanelItemToSector()` 先读取目标 `.sector-polygon` geometry，计算 center、`Math.floor` 整数 pointer、`screenRadius`、固定 8.0 `scale_per_radius = 1.4073989167353207e-6` 及 expected `{x,z}`，之后才执行 mouse move/down/move/up。固定 raw center `{x:192000,z:-128000}` 与 8.0 `maps.json` 一致；expected 路径没有导入或调用被测 coordinates、presenter、store 转换，也没有写入 A3 实际观测值 `{130965,-91980}`。
- `POSITION_TOLERANCE` 保持 `6000`。station 与 sector 两项都在动作后和 reload 后复用同一个动作前 expected，并断言目标实体 identity、另一实体未误改、`cluster_01_macro`、`cluster_01_sector001_macro`、sunlight `123`、完整五项 resources 及 raw `{x,z}`。两项都执行 dirty `true` → UI Save → `false`、8.0 storage key、active empire identity、reload 后 dirty/identity/location/environment 与 placed UI 断言。
- 8/8 证据真实且绑定当前候选。最终目录有八个不同测试标题的 Chromium trace；八份 trace 都嵌入 SHA-256 `466e2d...` 的同一 spec。两份 placement trace实际到达整数 mouse `(719,645)`、Save、reload、重新打开 map station panel，以及 reload 后 identity/environment/6000-position 断言；`.last-run.json` 为 passed，运行记录为 exit 0、8 passed、0 failed/skipped/flaky/retried。
- fresh build/运行边界成立。命令使用端口 `23116`、Chromium、`--workers=1 --retries=0 --trace=on`；仓库配置的 webServer 是 `npm run build && vite preview --strictPort` 且 `reuseExistingServer: false`。A4 build/run 记录 909 modules 的 fresh build、独占 preview/Chromium；八条 trace 时间连续且都指向同一端口和候选，没有并发污染反证。
- diff-check 与 ownership 边界成立。A4 的 scoped `git diff --check -- tests/e2e/map/x4-import-move.spec.ts` exit 0。A3 与 A4 trace-embedded spec 的差异仅在该 Owned path，内容为 planner 指定 oracle 修正及为完成 Save/reload 所需的既有 UI 路由动作；result/evidence 位于另授的 A4 输出路径。未发现 source/helper/config/fixture/status/planner/Git metadata 的 T016 候选改动。

## Explanation

A4 已经证明六项 import 与 station/sector 两项 placement 全部通过，整数落点 oracle、固定 8.0 独立 expected、6000 容差、完整身份/环境及 Save/reload 都闭合。唯一未满足项是显式要求写进 Owned spec 的旧 7 → 新 8 映射说明；补一段注释并做静态复核即可返回复审。本 review 未重跑 E2E/build，未修改源码、测试、配置、status、planner 或 Git。

## A5 Re-review

- Candidate snapshot: `tests/e2e/map/x4-import-move.spec.ts` SHA-256 `b79a460862b52c4b03f8787aec77f76748bbc86a72b5ea03f31b699233e16a14`。
- A5 diff against the A4 trace-embedded candidate is comment-only: three lines immediately before `test.describe`; executable test content is unchanged.
- Verdict: changes-required

### Closure check

- Closed: the comment explicitly maps old 7 items to new 8 items; `3.1`–`3.6` retain the six import cases, old item 7 is the strengthened station placement, and item 8 is the new sector placement. It also names retained real pointer, entity identity, and Save/reload assertions.
- A4 evidence remains behaviorally bound because the A5 delta is comment-only. The retained A4 evidence still has 8 Chromium traces, all embedding the A4 candidate SHA-256 `466e2d2f...`; A4 recorded exit 0, 8 passed, 0 failed/skipped/flaky/retried, fresh 909-module build, exclusive port `23116`/Chromium/one worker/zero retries, clean scoped diff-check, and `passed` `.last-run.json`. The A4 static oracle review, `6000` tolerance, identity/cluster-sector/sunlight/resources, dirty Save/reload and reload assertions are all in unchanged executable content.

### Remaining blocker

- F1 remains partially open: the A5 comment does not explicitly record the required oracle details from the allowed correction—both placement cases compute an independent expected before the action from polygon geometry and an integer pointer, using fixed 8.0 raw center/scale. `real pointer` is not precise enough to state integer quantization, polygon geometry, fixed 8.0 inputs, or independence of the expected.
- Owner: T016 implementation owner.
- Allowed correction: extend only the existing comment in `tests/e2e/map/x4-import-move.spec.ts` with that oracle statement. Do not change executable test content or any other path.
- Verification: confirm the next diff remains comment-only and run the scoped `git diff --check -- tests/e2e/map/x4-import-move.spec.ts`. The A4 runtime evidence remains reusable if no executable content changes; otherwise bind a new candidate and rerun the original 8-test exclusive fresh-build command.

The A5 review did not rerun E2E/build and did not modify source, test logic, config, status, planner, or Git metadata.

## A6 Final Re-review

- Candidate snapshot: `tests/e2e/map/x4-import-move.spec.ts` SHA-256 `5801942d54635e573a1e0d2a19e46f12559b74287b39af3241484c99767d1cb2`.
- A6 changes only the existing mapping comment. The diff from the A4 trace-embedded candidate contains no executable test change; the added seven comment lines are immediately before `test.describe`.
- Verdict: passed

### Acceptance

- F1 is closed. The comment explicitly maps old 7 → new 8: `3.1`–`3.6` retain the six import scenarios, old item 7 is the strengthened station placement, and item 8 is the sector placement.
- The same comment explicitly records the oracle boundary: both placement pointers come from the `.sector-polygon` polygon-geometry center and are quantized to integer client coordinates; expected is computed before the action from the fixed 8.0 raw center `{x: 192000, z: -128000}`, fixed scale `1.4073989167353207e-6`, and that integer pointer; it does not call the tested conversion function or use observed raw coordinates as the oracle.
- A4 runtime evidence remains reusable because executable content is unchanged. The retained A4 evidence records exit 0, 8 passed, 0 failed/skipped/flaky/retried, fresh 909-module build, exclusive port `23116`/Chromium/one worker/zero retries, clean scoped diff-check, and passed `.last-run.json`. Its eight trace directories all embed the A4 executable candidate, and the placement traces cover the unchanged integer-pointer action, `6000` tolerance, identity/cluster-sector/sunlight/resources, dirty → Save → reload, and post-reload assertions.
- A6 evidence records scoped `git diff --check` exit 0. No executable test, assertion, oracle, tolerance, source, helper, config, fixture, status, planner, or Git metadata changed; no E2E rerun was required for this comment-only correction.

Final A6 review passes. Historical A4/A5 findings and verdicts remain above unchanged; this section records the final closure only.
