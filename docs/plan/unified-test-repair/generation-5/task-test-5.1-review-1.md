# task-test-5.1 审查 1

## Subtask

`task-test-5.1`：Logic Flow 拖放反馈与不兼容拒绝。

## Reviewed commit

实际审阅对象为 `b2060a45d41697593e09ac405a9064f436cc5fd1`，父提交为 `365ef5cc6102c086830b27cee14faaca6dd92cfe`，后者父提交为冻结 base `da05d84514c90428fd4e51907df9b6424fa5ccff`。候选工作树干净，累计差异仅含 4 个 task-test-5.1 owned paths；`setupLogicFlow.ts` 未变。

派发中给出的 full SHA `b2060a45d560d03b05e04275166123381fb96f59` 不存在；短 SHA `b2060a45` 在该仓库唯一解析为上述 `...d416...`。本审查绑定实际可解析的不可变对象；dispatcher 下一轮必须修正 full SHA，不能沿用 `...d560...`。

## Contract conformance

路径、base 链和无 `skip/fixme/only` 边界合规；未修改 `src/**`、fixture、配置、其他测试或治理文件。将 4.7 两个排序方向拆成独立 browser context、用 group identity 代替 helper 的目标序号，以及修正 Auto/Replace 标签锚点，均符合当前合同。

Done when 未满足：4.6 的失败仍是未修复的 test-owned oracle；当前测试还依赖 Energy Cells 可拖拽这一产品违约；4.16/4.17 仍通过 `groups[0]` 取得目标，迁移文档“无默认 target index 0”的陈述不准确；cross-consumer 仅给出聚合数字，没有足以复核 42 项归属的分组失败签名。

## Observable coverage

4.1、4.2、4.5、4.7 双方向、4.16、4.17 都使用 Playwright Mouse API，并有 hover/status、ghost、释放后节点或顺序结果。4.7 拆分后 collection 从 7 变为 8 是两个相反顺序的独立输入，不是重复造数。

4.6 的鼠标 witness 有效：trace 记录了 Ore 卡片 bounding box、`mouse.down` 和 100px 移动。但独立 oracle 无效。`compact-view` 在 `LogicFlowPlanningZone.vue` 由 `v-show` 常驻 DOM，`attemptWareDrag` 却断言 `toHaveCount(0)`；失败后的 trace 明确仍是 `style="display: none"`。因此该失败不能证明 compact view 出现，也不能按当前文档归为 product。

同一 trace 还显示 Ore 从初始 `draggable="false"` 进入 `sortable-chosen sortable-ghost`，且 Sortable 临时改为 `draggable="true"`。这证明真实 pointer 已启动底层拖拽生命周期，虽然 app compact view 保持隐藏。当前 4.6 没有断言该可观察违约，也没有断言 `logicFlowStore.isDragging === false` 或释放后 groups/nodes 不变。

## Duplicate/weak coverage

没有新增语义重复：4.1 证明新建区预览，4.5 证明释放后的现有组/新组结果，4.7 两例证明相反依赖顺序，4.16/4.17 分别证明 unlocked normal 与 locked rejected。

弱覆盖有三处：

1. 4.6 用 DOM 数量代替可见性，并遗漏 Sortable ghost、store drag state 和释放后不变 oracle。
2. 4.7、4.16、4.17 以真实拖拽 Energy Cells 建组或进入 compact mode；当前规范明确禁止该动作，所以这些通过结果依赖产品违约。
3. helper 先调用被测 `getWareGroupStatus` 决定要断言哪种视觉分支。4.16/4.17 通过显式 `expectedStatus` 提供独立预期，其余 task-owned existing-group 调用没有，仍可能随错误产品状态自洽通过。

## Failure ownership

- `attemptWareDrag` 的 `toHaveCount(0)`：`task-test-5.1` test-owned。应改为真实拖拽期间的可见性、Sortable 状态、store 状态和释放后领域不变断言。
- Ore 的 Sortable ghost/chosen：product-owned。接受的 `logic-flow-operation` 要求 T0 资源禁止拖拽；真实 pointer trace 已满足前提并显示底层拖拽启动。
- Energy Cells：product-owned。接受规范单列 “Energy Cells drag restriction/quick add hidden”；当前 presenter 只排除 raw material，trace 显示该 Tier 0 卡片为 `draggable="true"` 且有 `ware-card-add-btn`。候选 4.7/4.16/4.17 掩盖并消费了此违约。
- cross-consumer `164 total / 122 passed / 42 failed`：失败文件位于 owned paths 外并不自动决定 owner。现有 diff 保留 number target 兼容路径，且多个消费者通过，当前证据没有证明 helper 回归。按消费者归属，其他 drag interaction/regression/new-feat 返回 `task-test-5.2`，compact/vue-drag 返回 `task-test-5.3`，plans/import/ui-adjust 返回 `task-test-6`，build-flow 返回 `task-test-11`；任何首个失败点若落在本次修改的 helper status/locator/postcondition，仍由 `task-test-5.1` 负责。迁移文档需按重复签名列出文件、数量、首个失败点和 owner，不能只写“均在本任务之外”。

## Evidence

- `git rev-parse b2060a45^{commit}` → `b2060a45d41697593e09ac405a9064f436cc5fd1`；`git cat-file` 无法解析派发的 `...d560...`。
- `git diff da05d84514c90428fd4e51907df9b6424fa5ccff..b2060a45d41697593e09ac405a9064f436cc5fd1`：4 个 owned paths，155 insertions / 43 deletions；`git diff --check` exit `0`。
- base focused：7 tests，3 passed / 4 failed（4.6、4.7、4.16、4.17）。candidate collection：8 tests / 2 files，exit `0`。build exit `0`。
- candidate 分段行为证据：4.1、4.2、4.5、4.7 双方向、4.16、4.17 passed；4.6 failed。故 collection/build 不能提升为行为通过。
- `test-results/logic-flow-logic-flow-drag-a5b00-on-draggable-and-No-Preview-chromium/trace.zip`：失败断言收到 count 1；同一 after snapshot 的 compact view 为 `display: none`，Ore 出现 Sortable chosen/ghost。
- 当前 accepted source：`openspec/specs/logic-flow-operation/spec.md` 的 Candidate Zone T0 Restriction 同时禁止 raw T0 和 Energy Cells 拖拽/快速添加。

## Verdict

`changes_required`

## Correction

测试侧仅修改 task-test-5.1 owned paths：

1. 修正 `attemptWareDrag`：在真实按下和移动期间采集 `compact-view` 是否隐藏、`logicFlowStore.isDragging`、source 的 Sortable chosen/ghost/drag 状态及 `draggable` 属性，随后释放鼠标并断言 groups/nodes 精确不变；不得再用 `toHaveCount(0)`。4.6 对 Ore 和 Energy Cells 使用同一独立 oracle，并验证两者无快速添加按钮。
2. 4.7 改用已存在的可选择产物作为 compact/hover witness，例如对目标组中的既有产物执行显式 `expectedStatus: 'duplicated'` 的不释放检查；4.16/4.17 用 Hull Parts 等合法产物建组。所有现有组调用传入明确的独立 `expectedStatus`。
3. 4.16/4.17 用 `getGroupIdForWare` 或等价的明确身份读取替代 `groups[0]`；同步迁移文档，删除“compact-view 出现”的错误产品结论，并补充 cross-consumer 分组签名。
4. 完成测试修正后保留 Ore Sortable lifecycle 与 Energy Cells draggable/quick-add 的精确 product failure。产品修复不得由测试 worker 实现；planner 必须插入 generation-5 有界产品 fix（建议 `task-test-5-fix-1`，`Returns to: task-test-5`），修复到达 target 后由 task-test-5.1 重跑。

阻断验证：原 focused 命令、8-test collection、`npm run build`、`git diff --check`；helper 改动后重跑父合同完整 cross-consumer 命令。

## Deferred acceptance

本轮不接受 task-test-5.1。精确保留两条产品签名：

- clean / game version 8.0 / Ore：真实 pointer 后 source 进入 `sortable-chosen sortable-ghost`，违反 raw T0 禁止拖拽；compact view 仍隐藏，不能沿用旧失败描述。
- clean / game version 8.0 / Energy Cells：候选卡 `draggable=true` 且显示快速添加按钮，并可启动真实拖放，违反 Energy Cells drag restriction 与 quick-add hidden。

关闭门为：测试侧 oracle 与合法 setup 修正通过审查；planner 插入的产品 fix 经 coding review 合入 target；integrate 同步该不可变 target 后，task-test-5.1 focused、collection、build、diff 和 helper cross-consumer 按上述归属重跑。任何 product failure 未关闭前不得将本候选标记 passed。
