- Task: T015
- Contract revision: 4
- Result: T015-A2.md (`sha256:e9d99a597150af545c1e270c267e1f3ac76cd443490cc2ad9548fc8e66d99afa`)
- Candidate snapshot: HEAD `d0614371558b2f6b30e8fd6b148347868228c413`; `evidence/T015-A2/candidate.sha256` (`sha256:56ec938c020876b7e5760203153dc8b1a0e6ea463f659bf82efd2ce5a14a437d`)
- Verdict: changes-required

## Findings

### F1 — High — 唯一失败是共享 `dist` 在 preview 运行中被改写的环境失败；97/97 验收仍未成立

- Evidence: authoritative command fresh build 成功并由该 preview 启动 97 项。失败 trace 的首次 `GET /x4-station-calculator/` 为 200，主 JS/CSS 为 `index-TVEiQNPr.js` / `index-DaNuuE8q.css`，`Last-Modified` 均为 `08:05:10 GMT`；`saveReload()` 已完成 Save、dialog 关闭、localStorage 读取及 station 数量检查。随后 `08:07:24.596Z` 的 `page.reload()` 请求完全相同的 `/x4-station-calculator/`，preview 直接返回 404、空 body，页面未启动，所以 `sidebar-station` 不可能出现并在 `ware-flow.spec.ts:47` timeout。紧随其后的 4.1 用例于 `08:07:38Z` 又从同一路径获得 200，但同名 content-hash 资产的 `Last-Modified` 已变为 `08:07:25 GMT`；后续 transport save/reload 也为 200 并通过。这一时间线证明测试运行期间 `dist` 被另一 build 重写，404 正好落在入口暂时不存在的窗口；不是 fixture、`sidebar-station` locator、SPA route 或 T015 sector/product source 的行为。精确外部写进程未被现有日志绑定，故只裁决共享产物环境，不虚构具体进程身份。
- Owner: dispatcher 负责真正串行占用 `shared-dist-build`、`chromium-runtime`、`preview-port-23115`；T015 verification owner 负责新 attempt 的候选绑定与证据。当前不分配 T015 产品或 ware-flow 测试修改。
- Allowed correction: 保留 A2 的 exit `1`、404 和 timeout 为负证据，不重标 pass，不修改 `tests/e2e/production/ware-flow.spec.ts`、fixture、locator、T015 owned source、`playwright.config.ts` 或 `vite.config.ts` 来迎合这次环境失败。dispatcher 在没有其他进程写仓库 `dist/` 的独占窗口，对同一冻结候选做一次 fresh build → preview → 合同三-spec 重跑，写入下一空闲 attempt（预期 A3）而不覆盖 A1/A2。
- Verification: 运行合同原命令，要求 exit `0`，station-resource-group `16/16`、dashboard `33/33`、ware-flow `48/48`，总计 `97/97`，0 failed/skipped/flaky/retried；保留 97 traces、完整日志、候选/config/fixture 指纹，并确认浏览器运行期间无第二次 `dist` 改写。若独占窗口仍复现相同入口/asset 404，返回 runner/asset-serving owner 检查 build-preview 生命周期（`playwright.config.ts`、`vite.config.ts` 与共享 `dist/` 调度）；只有 reload 返回 200 后出现新的 DOM/持久化断言失败，才按新失败身份分别交 ware-flow test owner 或对应 persistence product owner。

## Acceptance

- A1 已接受的 T015 实现语义没有出现反证：本轮 station-resource-group 16/16 全部真实执行并通过。3.2 trace 使用 08:05:10 fresh-build 资产并断言固定 `sector-1`/`sector-2` id/name；3.3 点击 `sector-1` 后断言仅一个 station group 及精确资源 `hydrogen/methane/ore/silicon`；3.9 断言仅两个非空 sector 且 `sector-empty` 不存在；3.12 断言 active 从 `sector-1` 转移到 `sector-2`。四项分别在 #39/#40/#46/#49 完成，均早于共享产物改写。
- `playwright-run-escalated.log` 的 97 个执行条目、97 个 trace archive 和 `.last-run.json` 的唯一 failed id 相互一致，因此“96 passed / 1 failed”是实际观察，不是 collection 冒充执行，也没有测试被 skip、retry 或删除。dashboard 33/33、station-resource-group 16/16 与 ware-flow 47/48 的通过记录可保留为有限证据。
- 但这不是候选绑定的连续 97/97：明确的 404 仍是 failed，且共享 build 在单次运行中途重写违反 coherent snapshot 要求。4.1 与 transport persistence 后续通过支持“locator/fixture/product persistence 非本次根因”，却不能替代或重标显式失败的 `2.2 Priority state persistence`。Revision 4 要求的 ware-flow 48/48 和总计 97/97 仍未满足。

## Explanation

结论是环境重证，不是测试或产品修复。最小下一步由 dispatcher 锁住共享 `dist`、Chromium 与 23115，只重跑 T015 合同中的 97 项 focused command；无需自行扩大到 full E2E。A2 的 96/97 是真实运行结果，其中 T015 四项目标覆盖真实且已通过，但 404 不能被改写成 pass，所以本次独立 verdict 为 `changes-required`。本审查未运行测试/build，未修改源码、测试、fixture、config、status、planner 或 Git；唯一写入为本 review。

---

## Final review after T015-A3

- Re-review basis: `results/T015-A3.md`, `evidence/T015-A3/run-summary.md`, `build-readiness.log`, `playwright-run.log`, `reload-2.2.txt`, `playwright-results/.last-run.json`, `candidate.sha256`, `input.sha256`, `trace-files.txt`, and `diff-check.log`; contract generation-6 Revision 4 and `results/T015-A1.md`.
- Candidate identity is stable: HEAD `d0614371558b2f6b30e8fd6b148347868228c413`; candidate manifest SHA-256 `8e873d1f7383974ec19a5b69917c72c43f7635c7259f9774487ffb5f0c20bc4f`; input manifest SHA-256 `924dd41c13f4c0b50f0fcc64d109794c559b5029ad0ef93e0105968ce6dd071a`.
- Final verdict: passed

### Findings

No findings. A2 F1 is closed by the independently retained A3 evidence.

### Acceptance

- Exclusive execution was recorded for `shared-dist-build`, `chromium-runtime`, and port `23115`. The default webServer fresh build transformed `909` modules and preview readiness announced `http://127.0.0.1:23115/x4-station-calculator/` before the authoritative browser run. A3's initial sandbox-only webServer boundary produced no test collection and remains separate negative evidence.
- The exact Revision 4 three-spec command exited `0` with `station-resource-group 16/16`, `station-dashboard 33/33`, `ware-flow 48/48`, total `97/97`, and `0 failed / 0 skipped / 0 flaky / 0 retried`. `.last-run.json` is `passed` with no failed tests; `find` and `trace-files.txt` each account for `97` traces, with `0` error-context files.
- `reload-2.2.txt` records `Favorite Button & Priority › 2.2 Priority state persistence` passing after reload. This directly closes the A2 timeout/404 failure identity; no locator, fixture, test, or product correction was introduced.
- A3 `git diff --check` over the T015 owned paths exited `0`. The recorded candidate hashes match the candidate and input files used by the run, including the owned source/test paths and runner/fixture inputs.
- A1's implementation and contract semantics remain consistent: the real active Blueprint sector/station/flow source, presenter ownership, empty filtering, loaded identity, and highlight behavior are covered by the passing 16-test spec; dashboard and ware-flow consumer regressions are now runtime-covered in the same 97/97 run.
- A2's shared-`dist` 404 and `96/97` result remain preserved as historical negative evidence. They are not combined with A3, erased, or relabeled as pass. A3 is the separate exclusive fresh-build result that satisfies the explicit browser acceptance.

### Explanation

T015-A3 closes the only unmet A2 acceptance item. The candidate is independently verified with a coherent exclusive build/preview/browser window, all 97 contracted tests pass, and the reload persistence case passes. Final review verdict is `passed`; dispatcher may record acceptance. T025's later canonical full-suite scope remains unchanged. This review did not run tests/build or modify source, tests, config, status, planner, or Git; it only appended this final review section.
