- Task: T014
- Contract revision: 5
- Result: T014-A2.md (`sha256:5f0ee4f5d45f31d15e925482e5554c99e6541df955cb56a98a40be04b5524f96`)
- Candidate snapshot: `evidence/T014-A2/candidate.sha256` (`sha256:28677e700782b9c1373eee41474da9b3b82feae2b692392bfe07de99322a8215`); current 19/19 candidate files match the manifest
- Verdict: changes-required

## Findings

### F1 — High — Case 5 尚不能产生 A1-review 要求的 Main/AutoSupply 与 resolved 浏览器证据

- Owner: T014 implementation owner
- Evidence: Revision 5 明确保留 T014-A1-review F3。该 F3 要求 Case 5 证据覆盖 Main/AutoSupply 仓储隔离及 resolved 无重复。当前 `tests/e2e/production/module-management.spec.ts:130` 的 Case 5 在开启 `internalSupply` 后只读取 `autoSupplyModules`，断言 AutoSupply 的 Argon L Container ×1、Solid ×1、独立 UI 分组以及 Save/localStorage/reload；文件已有的 `autoStorage()` helper 在 Case 5 中未调用，`resolvedModules` 也未读取。`tests/unit/production/auto-supply-storage.spec.ts:150` 已在领域入口覆盖 Main 仓储保留和按 ID 合并，但不能替代 F3 明确要求的浏览器路径证据。因此即使直接运行当前 25 项，Case 5 仍不能证明该项浏览器验收。
- Allowed correction: 仅修改 `tests/e2e/production/module-management.spec.ts`。保留 Case 5 全部现有动作和断言；在同一用例中增加 Main `autoInfrastructureModules` 的独立固定仓储 expected，并断言 `resolvedModules` 的 module ID 唯一且同 ID 仓储数量等于 Main 与 AutoSupply 的合并数量。expected 应由固定 9.0 fixture/独立算式确定，不从被测结果反推；无需新 helper、fixture、产品代码或抽象。
- Verification: 修正后冻结新候选，由 dispatcher 使用独占 `shared-dist-build`、`chromium-runtime` 和端口 23114 运行合同中的精确两文件 Chromium 命令；要求 25/25 passed、0 failed/skipped/flaky/retry，并保留候选绑定的 report/trace，Case 5 完成 UI 开关、两类独立仓储、resolved 去重、Save、localStorage 和 reload 恢复。

### F2 — High — 候选绑定的 25 项独占 Chromium 复验仍未执行

- Owner: dispatcher/evidence runner；若运行暴露产品或测试失败则返回 T014 implementation owner
- Evidence: `evidence/T014-A2/run-summary.md` 与 `T014-A2.md` 均明确记录 browser validation 未运行。A1 的最后完整运行仍是受共享 `dist` 并发污染的 exit 130（8 passed / 2 failed / 1 interrupted / 14 not run），且发生在最终 locator 与 A2 领域修复之前；不能复用为当前候选证据。
- Allowed correction: F1 最小测试补强后冻结新 candidate manifest，安排一次干净的独占运行；不修改源码来代替验证，不复用 A1 污染的 `dist` 或结果目录。
- Verification: 同 F1 的精确 25-test 命令和结果要求。完整 E2E/build 仍不属于本次 review，也不能用 collection 或 focused Unit 替代这项验证。

## Acceptance

- A1 F1 已闭合。`src/store/logic/productionStationShared.ts:110` 不再按 AutoSupply 输出 ware 删除整条 Main flow，而只对这些 ware 剥离 `workforce`/`workforce_idle` contribution 并重算 production、consumption、netRate；planned/AutoIndustry 的同 ware 模块产出或消耗保持。该 helper 同时用于 active 与 canonical planning 路径。真实入口 Unit 的重叠场景会在旧整项过滤下失败，当前断言 Main 与 AutoSupply 各有仓储、resolved 同 ID 合并为 count 2。
- A1 F2 已闭合。`src/store/logic/calculateProductionFlows.ts:388` 只在 `considerWorkforceForAutoFill` 开启时把供应模块 workforce 加入闭包，`:402` 只在开启时追加供应 habitat；关闭时 producer 使用基础效率。成对 Unit 证明开启时有供应 habitat/能量模块 ×1，关闭时无供应 habitat且基础产能需要能量模块 ×2。
- 独立归属与层次保持：`StationDerivedMap.deriveAutoSupplyModules()` 独立计算 AutoSupply flow 和 Container/Solid/Liquid storage 并合入 `autoSupplyModules`；Main 仍由 `autoInfrastructureModules` 持有，`mergeSavedModules` 负责 resolved 去重。两个 production store 只传递该领域结果，planning presenter 组装独立组，Vue 只通过 presenter props/actions 消费新增业务路径；未新增持久化派生列表、适配层、fallback 链或依赖。`internalSupply` 继续沿既有 `StationSettings`、setting action、empire/save-binding 保存路径持久化。
- Revision 5 current Unit 修复符合边界。相对 HEAD 的 `StationPlanningPanel.spec.ts` diff 只有三个 mount 各增加一行 `autoSupplyModules: []`；三个原 fixture 的其他输入和全部原断言逐字保留，无 optional/default、skip 或断言弱化。
- A1→A2 manifest 的 T014 相关变化只涉及 `productionStationShared.ts`、`calculateProductionFlows.ts`、`auto-supply-storage.spec.ts` 及新增 `StationPlanningPanel.spec.ts`，均在 Revision 5 Owned paths。`useBlueprintProductionStore.ts` 的额外哈希变化与 T015 留存的 T014 handoff `ee9a9432...` → T015 candidate `e02d8f65...` 一致，且仍是 T014 Owned 的共享路径；未识别到 T014 越界改动。
- Focused 证据真实：A2 日志及其声明哈希匹配；本 reviewer 在同一 19/19 manifest 候选上独立重跑精确命令，exit 0，3 files / 8 tests passed，0 failed/skipped。A2 的精确 owned-path `git diff --check` 也独立重跑为 exit 0、空输出。新增 `auto-supply-storage.spec.ts` 当前仍是 untracked，Git 的 diff-check 不检查其内容；独立尾随空白扫描无命中，且该文件内容已由 candidate manifest 绑定。
- Implementation-simplicity 检查未发现新的语义重复或中间层：贡献过滤 helper 由两条领域路径复用，workforce 开关留在拥有该闭包的计算函数。该标准未套用于测试审查。

## Explanation

A2 已正确修复主仓储同 ware 误删和 workforce-off 两个领域缺陷，Revision 5 的三个 Unit fixture 适配及 8/8/diff-check 证据也成立。当前不能接受的原因不是已知产品代码错误，而是保留的 F3 浏览器合同尚未被现有 Case 5 完整表达，且候选绑定的 25 项运行尚未发生。先在单一 E2E 文件补两组最小断言，再做一次独占 25/25，即可进入复审；本次未运行 E2E/build，未修改源码、测试、planner、status 或 Git metadata。

---

## A4 Re-review

- Task: T014
- Contract revision: 5
- Result: `T014-A4.md` (`sha256:d4cb94d08303182a3a3d01a17ef452e3d5a5e7ddf0828f6f24c1b7258cf54c6`)
- Candidate snapshot: `evidence/T014-A4/candidate.sha256` (`sha256:89fcd596a0db17c9cf80d915b8af27dc1ffda7d8fb97166b9692d9cc78aa7dc8`)
- Candidate relation: A2 product candidate plus the A3 correction in `tests/e2e/production/module-management.spec.ts`; A2→A4 manifest comparison shows no other file changed.
- Verdict: passed

### Findings

None. A2 F1/F2 were already closed, A2 F1/F2 verification gaps are closed by A3 and the decisive A4 run, and no new defect was observed.

### Acceptance

- Fresh build/preview was established: `npm run build` exit 0, 909 modules transformed, fresh `dist`; the Playwright config uses `npm run build && vite preview --port 23114 --host 127.0.0.1 --strictPort` with `reuseExistingServer: false`. Preview readiness was `http://127.0.0.1:23114/x4-station-calculator/`.
- The exact contract command ran with `--project=chromium --workers=1 --retries=0 --trace=on`. Decisive Run 2 exited 0 with 25 collected/executed, 25 passed, 0 failed, 0 skipped, 0 flaky, and 0 retried. The decisive output has `.last-run.json` status `passed` and 25 trace archives.
- Case 5 now exercises the A2-review F1 correction through the browser: Main storage is Argon Container ×6 and Solid ×1; AutoSupply storage is Container ×1 and Solid ×1; `resolvedModules` has unique IDs and merged storage Container ×7 and Solid ×2. The same run passed the UI internal-supply toggle/grouping, Save, saved `settings.internalSupply === true`, localStorage-backed reload, and restored Main/AutoSupply assertions. These expectations are fixed constants in the Owned E2E file, not derived from the observed result.
- The A3 correction remained within the single Owned E2E path and preserved the existing Case 5 actions/assertions. A4 candidate manifest has 19 files; the Revision 5 contract has 19 Owned paths; normalized set comparison is exact, and `sha256sum -c` passes for every candidate file.
- T014-owned `git diff --check` exited 0 with empty output. The separately recorded untracked-test supplement had expected `git diff --no-index` exit 1 against `/dev/null` and no diagnostics; the untracked Unit file is nevertheless included and hash-bound by the candidate manifest.
- Run 1 remains preserved as negative evidence: 24/25 with one Case 4 reload failure caused by the dynamic-import 404 for `assets/versions-D9enPG8M.js`. It is not combined with Run 2 to manufacture a pass. Run 2 was the separately recorded clean exclusive run after fresh build/preview, so the historical 404 does not contaminate the decisive result.
- Review independence and scope hold. This review did not implement A3, did not change source/test/config/status/planner/Git metadata, and only appends this A4 judgment to the existing review artifact.

### Explanation

A4 closes the remaining T014-A2 review findings. The candidate now has the required browser-level Main/AutoSupply/resolved assertions and a clean candidate-bound 25/25 exclusive Chromium result. The earlier 404 is retained as failed historical evidence, while the clean fresh Run 2 independently satisfies the Revision 5 acceptance. Verdict for A4: passed.
