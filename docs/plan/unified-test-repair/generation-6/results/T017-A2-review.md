- Task: T017
- Contract revision: 4
- Result: T017-A2.md
- Candidate snapshot: `candidate.patch` SHA-256 `3c9c7f1f4ab0489cbb6b9f7c377e4a47c07f7e3203b67c89391095c745187e82`; 当前八个 owned-file SHA-256 与 `evidence/T017-A2/candidate.sha256` 全部一致
- Verdict: changes-required

## Findings

### F1 — closed — 两份 geometry spec 已显式固定并实际验证 1920×1080

- Evidence: `tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts:4` 与 `tests/e2e/ship/ship-equipment-selector.spec.ts:3` 均有 `test.use({ viewport: { width: 1920, height: 1080 } })`；4.1 在 `:48`、3.1/3.6 在 `:166` 直接断言 `page.viewportSize()`。同一测试继续断言 root font 16px、展开前 1:1:1 和 32px gaps、展开后 2:1 和 32px gap，以及 picker 两列、8px gap、前两行 25.6px；3.5 还分别验证 Osaka `>3` 为两行和 Ray 2 tags 为一行。最终候选日志中对应 #1、#45、#46 均通过，故这些通过包含实际 viewport/几何断言，不只是配置声明。
- Disposition: A1 F1 已闭合；不修改 viewport、oracle 或共享 Playwright config。后续只需在修正候选的合同六-spec 运行中重证。

### F2 — Medium — 旧 picker 主体已删除，但 Equipment 仍保留两个仅为旧 Unit 暴露的死 summary 绑定

- Evidence: `ShipBuildPanelEquipment.vue` 已无 `panelMode`、picker template/filter/page/events、旧 `raceTags.length > 5`、旧 picker imports/interfaces/CSS；active UI 的唯一 candidate/facet 提取位于 `useShipBuildPickerPresenter`，唯一行数分支是 `ShipBuildPanelFit.vue:1088` 的 `raceTags.length > 3`。但 `ShipBuildPanelEquipment.vue:18-22` 仍解构 `getEquipmentSummary1/2` 后以 `void` 假使用；`playwright-final.log` 精确证明这两项原本触发 TS6133。它们在 Equipment template 中没有消费者，真实 active picker 消费者位于 `ShipBuildPanelFit.vue:777,1205-1212`。非 owned `tests/unit/ship/ship-equipment-canonical-details.spec.ts:23-25` 仍传入已删除的 `panelMode/isPickerOpen/slotType/isShield` 等旧 props，并在 `:54,75-76` 通过组件 setup state 读取这两个 summary 函数；这只是历史测试耦合，不构成运行时接口兼容义务。当前 `legacy-picker-search.log` 的空结果没有覆盖这组 `void` 绑定及旧 Unit 调用，因此不能证明 F2 完整清理。
- Owner: planner 先为 `tests/unit/ship/ship-equipment-canonical-details.spec.ts` 扩充精确 ownership；随后 T017 implementation owner 修正源码与该 Unit。reviewer 不越权修改。
- Allowed correction: 从 `ShipBuildPanelEquipment.vue` 的解构及两条 `void` 语句移除 `getEquipmentSummary1/2`；保留 presenter 中的函数和 Fit 的 active picker 消费。Unit 删除旧 props，并把 engine/thruster summary 断言指向 active presenter/picker owner；canonical Equipment details 断言保持不弱化。不引入新 wrapper、adapter 或兼容 props。
- Verification: 新候选上静态搜索确认 Equipment 无旧 picker/旧 props/`void getEquipmentSummary*`，active picker 仍仅一套；运行 canonical-details focused Unit、owned `git diff --check`，并执行下述独占六-spec fresh-build 验证。

### F3 — High — 最终候选六-spec 仍为 44/46；两个 404 属环境/产物服务失败，但不能记作全绿

- Evidence: `playwright-final-candidate.log` 的 fresh build 成功，但命令 exit 1、44 passed / 2 failed。失败 #13 请求 `zh-CN-BdcT1LMQ.js`：同一 build 输出明确列出该文件，trace 又显示同一页面先从该 build 的 `index-TVEiQNPr.js` 与 CSS 获得 200，随后 locale chunk 返回 404。失败 #22 的 trace 更直接显示 `/` 返回 302 后，`/x4-station-calculator/` 连续返回 404；这不是产品断言失败，而是 preview 运行期间 `dist`/入口短暂不可用。两组事实与同轮前后其他用例正常加载、pre-final 46/46 一致，支持共享 `dist` 被并发改写或产物服务不稳定这一环境分类；现有证据不支持修改产品、测试或 oracle。精确外部改写者未被日志绑定，因此这里只接受失败类别，不声称已定位具体进程。
- Owner: dispatcher 串行占用 `shared-dist-build`、`chromium-runtime`、`preview-port-23117`；T017 verification owner 对修正后的冻结候选重证。
- Allowed correction: 不把 404 重标为 pass，不复用 pre-final 46/46，不因 404 修改产品/测试。完成 F2 后，在无其他 build 写同一 `dist` 的独占窗口执行默认 fresh build → preview 六-spec 命令；若同类 404 在独占窗口复现，保留 trace/网络请求并返回 runner/asset-serving owner，仍不得关闭 T017。
- Verification: `PORT=23117 npm exec playwright test -- tests/e2e/ship/ship-build-equipment.spec.ts tests/e2e/ship/ship-equipment-selector.spec.ts tests/e2e/ship/bugfix-ship-equipment-selector.spec.ts tests/e2e/ship/build-ship-equipment-panel.spec.ts tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts tests/e2e/ship/osaka-default-preset.spec.ts --project=chromium --workers=1 --retries=0 --trace=on --output=<new-attempt-evidence-path>`；要求 exit 0、布局 3/3、其余 43/43、总计 46/46、0 failed/skipped/flaky。

## Acceptance

F1 的 viewport 与全部冻结几何子约束已由最终候选的通过断言闭合。F2 的运行实现主体也已收敛：旧 Equipment picker、旧 `>5`、旧 imports/interfaces/CSS 已移除，workspace 状态/动作仍由 workspace presenter 承接，candidate/filter/page 组装由 picker presenter 承接，未新增中间层；A2 未出现新的 active-picker Vue→store 直连。A1 已接受的正常/展开布局和 FIT/DETAILS 语义没有观察到回退。

行为验证仍不完整：最终候选中布局 3/3、其余 41/43 通过，canonical-details Unit 4/4（含 thruster）通过；thruster E2E 与 Osaka 低配在进入目标断言前因环境 404 失败。`playwright-rerun.log` 的 46/46 绑定 pre-final 候选，不能替代最终候选结果。加上 F2 的死绑定/旧 Unit seam，当前不满足 Acceptance 4–5，不能通过独立审查或描述为全绿。

## Explanation

准确下一步只有两段：planner 扩充 canonical-details Unit ownership，T017 owner 删除 Equipment 的两个死 summary 绑定并把旧 Unit 调用迁到 active owner；然后 dispatcher 锁住共享 `dist`/Chromium/23117，对新冻结候选执行一次 fresh-build 六-spec，必须取得 46/46。无需重开已确定的布局语义，也不应为这两个 404 改产品或放宽测试。T025 的最终全量验证仍是后续独立范围，本次未运行 full E2E 或额外 build。

## Final re-review — T017-A4 / Revision 6

- Candidate: T017-A3 F2-fixed candidate; A4 `candidate.sha256` matches A3 for all nine Revision 6 owned paths, and the current nine file hashes match the same manifest.
- Verdict: passed

### Finding closure

- F2 is closed. `ShipBuildPanelEquipment.vue` no longer contains the two summary bindings/`void` uses, legacy picker props, picker imports, picker template/CSS, or the old `>5` branch. The canonical-details Unit now supplies only live Equipment props; its summary assertions use the setup-mounted presenter witness. The active summary/picker owner remains `useShipBuildEquipmentPresenter.ts` consumed by `ShipBuildPanelFit.vue`; no old Unit seam remains in the candidate.
- F1 remains closed. The two geometry specs explicitly set viewport `1920x1080`, assert the viewport, and assert root font `16px` plus their geometry oracles. A4's successful layout 3/3 run confirms those assertions on the final candidate.

### Acceptance

- A4's exact Revision 6 six-spec command ran from `/home/slepher/project/x4-station-calculator` with exclusive `shared-dist-build`, `chromium-runtime`, and port `23117`; fresh build and preview both succeeded.
- Browser result: `46/46` passed, layout `3/3`, remaining `43/43`; failed `0`, skipped `0`, flaky `0`, retried `0`. Chromium viewport was `1920x1080`; root font was `16px` and was asserted by both layout specs.
- Focused canonical-details Unit: `4/4` passed. Revision 6 scoped `git diff --check` over all nine owned paths: exit `0`, empty output.
- The A2 `44/46` result and its two 404s remain retained historical negative evidence. They do not contaminate the decisive A4 result: A4 used the F2-fixed A3 candidate identity, a fresh build, an exclusive preview/runtime window, and a separate passed `.last-run.json` with no failed tests.

## Final explanation

The A2 findings are closed by A3 and independently verified by A4. T017-A4 passes independent review for Revision 6; no correction or decision remains for T017. T025's later full-suite acceptance remains separate scope.
