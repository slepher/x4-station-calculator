# task-test-5.1 产品失败报告

Task: task-test-5
Subtask: task-test-5.1
Generation: generation-5
Target branch: develop
Target base: da05d84514c90428fd4e51907df9b6424fa5ccff
Execution base: da05d84514c90428fd4e51907df9b6424fa5ccff
Candidate: b2060a45d41697593e09ac405a9064f436cc5fd1
Classification: product
Availability: available

Command: `npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`，cwd 为 `/home/slepher/project/x4-station-calculator/.worktree/integrate`，Playwright/Chromium 使用合同环境；最终有效结果包含 4.6 失败，其他迁移场景分段通过。

Expected behavior: 在 clean、game version 8.0、当前 accepted `logic-flow-operation` 规则下，raw T0 Ore 与 Energy Cells 不得启动拖拽或快速添加；真实 pointer 尝试后应保持禁止状态、无可见 preview、groups/nodes 不变。合法产物的 hover、ghost、release 和 normal/duplicated/rejected 状态仍应由独立 oracle 证明。

Observed behavior: Ore 的真实 Mouse API 按下和移动后进入 Sortable `sortable-chosen sortable-ghost`，说明底层拖拽生命周期已启动，违反 raw T0 禁止拖拽；Energy Cells 卡片显示 `draggable=true` 与 quick-add button，并可启动真实拖放，违反 Energy Cells drag restriction/quick-add hidden。旧 4.6 的 `compact-view` count 断言已被 reviewer 判定为 test-owned 错误，不能作为产品结论；reviewer 要求先改为可见性、Sortable 状态、store drag state 和释放后领域不变 oracle。

Fixture identity: `setupLogicFlow(page, 'clean')`，删除 `vsn`，game version `8.0`，通过 UI 设置 `zh-CN`；Ore/Energy Cells 为当前游戏静态数据中的 T0 候选。

Witness: `.ware-card-wrapper[data-ware-id="ore"]` 的真实 pointer down/move/release；Energy Cells 卡片的 `draggable`、quick-add UI 与真实 pointer 路径；trace 保留 Sortable chosen/ghost 和 Energy Cells 可拖拽证据。

Artifacts: `test-results/logic-flow-logic-flow-drag-a5b00-on-draggable-and-No-Preview-chromium/trace.zip`；候选 checkpoint `b2060a45d41697593e09ac405a9064f436cc5fd1`；review artifact `task-test-5.1-review-1.md`。

Attempts:

1. Target-base focused：7 tests，3 passed、4 failed（4.6、4.7、4.16、4.17）；保存原始 traces。
2. Test-owned migration：移除 target index `0`、修正标签 locator、拆分 4.7 browser context；候选 collection 8 tests exit `0`，build exit `0`，diff check exit `0`。
3. Candidate focused 分段：4.1、4.2、4.5、4.7 双方向、4.16、4.17 通过；4.6 在真实 Ore pointer 后失败。helper cross-consumer exit `1`，164 tests 中 122 passed、42 failed；其余失败均需由对应消费者 task-test-5.2、5.3、6、11 归属与复验。
4. Reviewer：确认 4.6 的 compact-view count 是 test-owned；确认 Ore Sortable lifecycle 与 Energy Cells draggable/quick-add 是 product candidate；确认 4.7、4.16、4.17 仍需合法 setup/独立 expected 修正。

Owner: planner 插入 `task-test-5-fix-1`；coding worker 修复产品根因；coding reviewer 审查；dispatcher 按 `coding -> target -> integrate -> target` 路由；随后 task-test-5.1 worker 修正并复验测试 oracle。
Blocked closure: task-test-5.1、task-test-5.2、task-test-5.3、task-test-5，以及显式依赖 task-test-5 的 task-test-6、task-test-11；本报告不阻塞 task-test-1、2、3、4、7、8、9、10、12、13、14、15、16 的无依赖执行，但 task-test-2/3 仍受 task-test-1.1 报告阻塞。
Independent runnable: task-test-7、task-test-8、task-test-10、task-test-12、task-test-13、task-test-14、task-test-15、task-test-16；task-test-1 的恢复条件和 task-test-5 的 product fix 分别闭环后再恢复其依赖任务。
Recovery condition: 完成 test-owned oracle/setup 修正；planner 插入并接受 `task-test-5-fix-1`；coding candidate 通过 self-test/review 并合入 develop；integrate 同步该 target 后，重跑 Ore/Energy Cells 原始 pointer 输入、合法产物 focused、collection、build、diff 和 helper cross-consumer，且 reviewer 关闭两条 product signature。
Recovery commands: `npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --list --reporter=list`; `npm run build`; `git diff --check`。
Acceptance effect: 4.6、task-test-5.1 及其依赖闭包不能计通过或合并；产品签名不能由测试 skip、弱化 assertion 或兼容路径关闭；本报告保留测试侧未完成项与产品修复前置。
Returns to: task-test-5
