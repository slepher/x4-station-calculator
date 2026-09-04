# task-test-4 review — candidate f8c5b5cf

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer。

Reviewed commit:
`f8c5b5cf97bece6f3fb1c8dd244b8b21b5169cbd`，single parent `64f4769b8a8b89bfd6f1317abdade9c2cd0615ef`；审查开始时 `HEAD` 精确匹配且 worktree clean。candidate 仅修改 4 个 `tests/e2e/logic-flow/**` 文件，无产品代码、fixture、配置或 Git index 改动。

Evidence:

- `git diff --check f8c5b5cf^ f8c5b5cf` exit `0`。
- `npm exec playwright test -- tests/e2e/logic-flow --list` exit `0`，collection 为 `115 tests in 8 files`；未运行完整 suite。
- 定向命令覆盖 Auto/Replace、双 lineage/SVG、isolation、四处 module-name、default-lock、i18n 与旧 release guardrail；fresh `npm run build` 成功，Chromium 正常启动，结果 `7 passed / 2 failed`。因此本轮没有浏览器环境阻塞，也不能把两个失败分类为 driver/environment。
- 定向通过：default hullparts Auto promotion、同一节点中英切换、真实 lock-on/off 投放、existing compact node/preview、新组 header/ghost、isolation 用例当前表达、5.1b exact leave + no-mutation。
- 当前 `x4-drag-test` guardrail 静态核对：`tests/e2e/logic-flow/**` 的 `page.mouse.move` 均带 `steps`；候选删除了旧 5.1 和旧 locked-leave 假断言，保留的 5.1b 在 release 前确认 `hoveredGroupId === null`、release 后确认完整 groups/nodes 不变。

Findings:

## F1 — blocking：Replace 场景先把 auto 节点转成了 manual

- Classification: `test-owned setup failure`；不是产品 bug。
- Evidence: `logic-flow-bug-regression.spec.ts:108-111` 先以 `expectedStatus: 'auto'` 投放 default hullparts，shared helper随即验证并完成 `source='manual'`；再切 Teladi期待 `replace`。current `getWareGroupStatus()` 对“已有不同 lineage 的 manual 节点”允许新增，实际 status 为 `normal`。定向运行精确失败为 `Expected "replace", Received "normal"`，发生在 release 前 status gate。
- Contract/history: current Auto 是 auto→manual；Replace 是“仍为 auto 的节点以另一 lineage 替换”。上一份 `task-test-4-review-8ef9412d.md` 已要求两个 fresh truthful scenario。
- Minimum correction: Replace case中保留 `weaponcomponents` 生成 default auto hullparts，直接切 Teladi后投放；删除中间的 default Auto promotion。保留独立 Auto case及 post-up exact `source/lineage/moduleId`。
- Closure: 只跑两个 Auto/Replace case；只有 truthful setup、active drag、exact `replace` hover和 exact postcondition 后仍相反，才可升级 product bug。

## F2 — blocking：SVG 关联断言混用了相对与绝对坐标

- Classification: `test-owned selector/measurement failure`；不是产品 bug。
- Evidence: 双 lineage case已通过 exact moduleId/lineage、两个模块名和共同下游 setup，最后才失败：`Expected 2, Received 0`。`ProductionLineGroup.vue` 的 path `d` 使用 `nodeRect - svgRect` 的 SVG 相对坐标；test `logic-flow-bug-regression.spec.ts:83-91` 却直接与 viewport absolute `getBoundingClientRect()` 比较。
- Contract/history: current module-name contract与历史 7b/21要求 default/Teladi hullparts分别连到同一 weaponcomponents；不能用全页 path 总数代替 source→target 关联。
- Minimum correction: 仅在该 test取得所属 SVG rect，把两个 source 的 right/centerY及 target 的 left/centerY都转换到同一 SVG坐标系，再逐 source精确匹配 path起止点；无需产品 selector或 `src/**` 改动。
- Closure: 只跑该双 lineage/SVG case，得到两个不同 hullparts source各一条指向同一 weaponcomponents target的 path。

## F3 — blocking：isolation/T0 case虽通过，但断言与依赖链无因果关系

- Classification: `test-owned weak assertion`。
- Evidence: `logic-flow-bug-regression.spec.ts:20-30` 隔离 hullparts后拖 `microchips`，只断言 `advancedcomposites` 不出现。8.0数据中 Microchip Production仅依赖 `energycells`、`siliconwafers`，本来就不会生成 `advancedcomposites`；后者也不是 T0。该通过不能证明 isolated hullparts阻止其 `graphene/refinedmetals` 上游或 T0预览。
- Contract/history: current OpenSpec要求 isolated节点保持且停止上游推导；上一轮明确要求 compact T0 preview在 isolated中间节点停止。
- Minimum correction: 保留真实 UI创建/隔离 hullparts及 isolation前后精确断言；在 active drag期间同时断言相关正向预览存在，并断言 hullparts独有的 upstream/T0分支（例如 `refinedmetals`/`ore`，按当前可观察链选最小稳定项）不出现。release后继续断言同一 hullparts仍 isolated且新增 ware的精确 mutation成立，避免只因 `drop:false` 而自然不变。
- Closure: 单跑该 isolation/T0 case，证明 active drag、exact target hover、相关正向 preview、被截断分支缺失、post-up isolation保持与新增节点结果。

Verdict:
`changes_required`

Changes:

1. Replace case删除中间 Auto promotion，直接以 fresh default auto hullparts切 Teladi并替换。
2. SVG断言统一到 SVG相对坐标并逐 source→同一 target匹配。
3. isolation/T0改为与 hullparts真实依赖链相关的正反断言，并在 release后验证精确 mutation与 isolation保持。
4. 下一轮只重跑上述 4 个 focused case、Logic Flow collection和 `git diff --check`；无需完整 suite，不得修改 `src/**`，不得创建 BUG artifact。

Caveats:

- `product bug`: 本轮为零。两个运行失败均在测试 setup/measurement处被完整解释；isolation项是弱覆盖，不是相反产品行为。
- `stale`: 旧 `.isolated` CSS、旧 5.1 drag-flag-only、旧 locked leave base-style反向断言已由 candidate删除/替代，本轮不再阻塞。
- `driver/environment`: 本轮为零；Chromium与preview均成功。未运行完整 suite，也未据此声称全套通过。
- 除本 reviewer artifact外，未修改代码、测试、fixture、Git index、commit、branch或 workflow state。
