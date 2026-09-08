- Task: T017
- Contract revision: 4
- Result: T017-A1.md
- Candidate snapshot: `candidate.patch` SHA-256 `d807c1c52d63b3da03a4d05bded6166e2e96d0d2b63e81fb67c4a0ac24ca861b`; 8 个 owned-file 当前 SHA-256 与 `evidence/T017-A1/candidate.sha256` 全部一致
- Verdict: changes-required

## Findings

### F1 — High — 三项几何证据未在合同规定的 1920×1080 viewport 上执行

- Evidence: T017 Acceptance 3 明确冻结 1920×1080。两份 owned E2E 均未调用 `test.use({ viewport: { width: 1920, height: 1080 } })`。虽然 `playwright.config.ts:30` 的顶层 `use.viewport` 是 1920×1080，chromium project 在 `:38` 展开 `devices['Desktop Chrome']`；当前 Playwright descriptor 的该设备 viewport 是 1280×720，因此 project-level 值覆盖顶层值。A1 的 46/46 和 3/3 均由该 chromium project 运行，不能证明合同固定 viewport 下的几何。
- Owner: T017 implementation owner。
- Allowed correction: 仅在两份 owned geometry specs 中显式设置 1920×1080 viewport；不改共享 Playwright config，也不调整 oracle 去迎合新观察值。
- Verification: 冻结修正候选后，独占执行合同六-spec fresh-build 命令，要求 46/46；另保留三项布局拆分计数，并在输出/测试内确认实际 viewport 1920×1080、root font 16px。

### F2 — Medium — 新 active picker 路径建立后仍保留无消费者的旧 picker 实现与旧 `>5` 几何

- Evidence: candidate 将 picker 渲染迁入 `ShipBuildPanelFit.vue`，并新增 `useShipBuildPickerPresenter()`；全仓只读搜索显示 `ShipBuildPanelEquipment` 当前唯一运行消费者是 `ShipBuildWorkspaceView.vue` 的 `panel-mode="equipment"`。但 `ShipBuildPanelEquipment.vue:20-288` 仍保留默认 `panelMode: 'picker'`、整套候选提取/过滤/分页/按钮模板与 CSS，且 `:197` 仍按 `raceTags.length > 5` 切两行。它与新 presenter/PanelFit 的 `>3` 逻辑重复，无实际消费者，并保留本任务明确拒绝的旧阈值。按 implementation-simplicity 的 capability ownership、compatibility residue、duplication 要求，该保留没有现行消费或兼容义务。
- Owner: T017 implementation owner。
- Allowed correction: 在 owned paths 内删除 `ShipBuildPanelEquipment` 的死 picker 分支及仅为该分支存在的 store/filter/page/import/style/interface，保留 comparison/details 单一职责；Workspace 继续通过 presenter 驱动 Fit 与 Equipment。若移除窄接口会要求修改非 owned 测试路径，先由 planner 扩充精确 ownership，不越权。
- Verification: 静态搜索应只剩一套 picker candidate/filter/race-row owner，且不再出现旧 `>5` 分支；运行 `ship-equipment-canonical-details` focused Unit 与 F1 的完整六-spec 独占命令。

## Acceptance

除 findings 外，候选语义与现行规范一致：正常态三列等宽且 32px gaps；展开态 Fit 跨 8/12、右侧跨 4/12，Equipment 在 Stats 上方、Materials 隐藏；active picker 使用 `minmax(0, calc(50% - 4rem))`、8px gap、前两行 25.6px；Osaka 的 `>3` tags 两行，Ray 的 2 tags 一行。几何 oracle 没有接受历史 0.31623、none、26 或 56。最终日志保留了 46/46，其中三项布局 3/3，其他 FIT/DETAILS、确认/取消、assignment/count、canonical summary/details 43/43；候选 patch/hash、46 traces 与 passed marker 相互一致。

这些运行事实只绑定 1280×720，且实现还含 F2 的重复旧路径，因此当前不能通过独立审查。

## Explanation

核心布局和 FIT/DETAILS 行为已经恢复，失败点是证据环境与实现残留，不是要求改回旧几何。完成 F1/F2 后必须用新候选独占 fresh build 重跑六 spec；旧 46/46 可保留为局部回归证据，但不能替代修正后的 1920×1080 结果。T025 最终全量仍另行执行。
