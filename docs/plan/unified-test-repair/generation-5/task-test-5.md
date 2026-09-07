# task-test-5：Logic Flow 拖放、隔离与紧凑视图

- Plan: plan.md
- Context: context.md
- Lane: integrate
- Worktree path: /home/slepher/project/x4-station-calculator/.worktree/integrate
- Target branch: develop
- Target base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Evidence target: da05d84514c90428fd4e51907df9b6424fa5ccff
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-5-fix-1
- Covers: none
- Conditional fix: task-test-5-fix-1.md；Returns to: task-test-5
- Route: coding -> target -> integrate -> target
- Resume barrier: task-test-5.1 正式执行/验收暂停至 fix 到达 target；仅允许先完成下述 test-owned 纠错前置，不推进后续子任务。
- Execution strategy: split-def
- Worker role: def_coding_worker
- Goal: 将Logic Flow 拖放、隔离与紧凑视图的现存测试任务、fixture 使用、locator 与断言迁移至当前接受行为，保留可复现的失败归属。
- Owned paths: `tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts`, `tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts`, `tests/e2e/logic-flow/helpers/dragLogicFlow.ts`, `tests/e2e/logic-flow/helpers/setupLogicFlow.ts`, `tests/e2e/logic-flow/migration-task-test-5.1.md`, `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts`, `tests/e2e/logic-flow/logic-flow-interaction.spec.ts`, `tests/e2e/logic-flow/logic-flow-new-feat.spec.ts`, `tests/e2e/logic-flow/migration-task-test-5.2.md`, `tests/e2e/compact-drag-view.spec.ts`, `tests/e2e/vue-drag-test.spec.ts`, `tests/e2e/migration-task-test-5.3.md`
- Capability disposition: reuse 现有 runner、静态 fixture 与 UI 锚点；extend 本合同明确拥有的测试/测试文档及必要 helper；new 仅限列出的迁移映射文档；replace 仅限有旧→新映射的陈旧断言，不移除有效覆盖。

## 拓扑与边界

Mouse API helper 的 source/target/hover/status 是可冻结接口；先由真实反馈用例验证，再供其余行为消费。共享 helper 不需要 single-sup。

Base 是不可变证据起点；执行前由 dispatcher 冻结含 Depends on 已接受合并结果的 develop 完整 SHA 作为 Execution base。该提交必须以 Target base 为祖先；integrate 只从 target 同步，不能从 coding 或未接受的兄弟 checkpoint 取前置。各子任务独立 browser context，禁止跨 spec 依赖测试执行顺序。按依赖执行，无依赖兄弟可在 lane 隔离 checkpoint 后独立推进。

## 当前代有界修正与恢复顺序

本修正绑定 `b2060a45d41697593e09ac405a9064f436cc5fd1` 与保留的 `task-test-5.1-review-1.md`、`task-test-5-report-1.md`。原 review/report 原文保留；本节明确后续执行顺序，不把旧 count 断言升级成产品事实。

1. task-test-5.1 保持暂停验收。先由其原 test owner 仅在既有五个 Owned paths 做 reviewer 指定的 oracle/setup/证据纠错，冻结新的 lane checkpoint 并接受有界测试审查；这项前置纠错不需要 fix 作为代码输入，不代表正式恢复或通过，不合 target。
2. [task-test-5-fix-1.md](task-test-5-fix-1.md) 在 coding 完成两条已确认产品签名的修复、自测与独立 review；dispatcher 按既有规则合入 develop。coding 不写本父合同的 E2E/helper；test worker 不写修复 source 或 Unit。
3. `Covers: none` 是正常 task-coding 关系的合法字段值；条件 fix 不填入 Covers。`Depends on: task-test-5-fix-1` 与 Returns to 共同落实相同强度的 target-visibility barrier：保存 fix candidate、target merge、integrate Execution base 的完整 SHA，并以 `git merge-base --is-ancestor` 分别证明 fix 在 target、target 在 integrate。
4. 只有第 3 步满足才正式恢复 task-test-5.1：核对前置纠错与新 target 一致，再执行 focused、collection、build、diff 和 cross-consumer。reviewer 关闭 LF-T0-SORTABLE、LF-ENERGY-SELECTABLE 后按原依赖推进 5.2/5.3；完整父级 review 后才 integrate -> target。父 6/11 仍等待父 5 的 target 合并。

前置纠错与 target 后复验的测试合同固定如下：

- 4.6 的 `attemptWareDrag` 对 Ore/Energy Cells 共用独立 oracle：真实 down/move 期间断言 compact-view 隐藏（不得 `toHaveCount(0)`）、source 无 Sortable chosen/ghost/drag、draggable=false、无快速添加按钮、store isDragging=false；finally 释放鼠标后检查 drag/hover/preview 清理和 groups/nodes 精确不变。Ore 原 trace 中 compact view 隐藏，修正迁移文档对应结论；真实 Sortable 启动与 Energy Cells 可选性分别保留为产品签名。
- 4.7 两个方向保留独立 browser context；用已由合法产物建成的组中既有手动产物作 compact/hover witness，显式 `expectedStatus: 'duplicated'`，观察后移出取消，不以 Energy Cells 启动拖拽。依赖顺序的原领域 oracle 保留。
- 4.16/4.17 用 Hull Parts 等合法产物建组；通过 `getGroupIdForWare` 或同等精确身份读取唯一目标 group id，禁止 `groups[0]`。分别独立指定 normal/rejected 的 expectedStatus，不能从被测 getWareGroupStatus 计算 expected。所有 task-test-5.1 existing-group 调用都传明确 expectedStatus 和 group identity。
- 同步 `migration-task-test-5.1.md`，保持原场景编号与映射；8 个 collection 项是当前候选基线，4.6 可在一个测试中分别检查两张卡。如参数化拆分，必须说明准确新增输入/计数，不删其他覆盖来维持数字。

cross-consumer 必须按重复签名分组留证：每行列出 signature、实际文件与用例编号、数量、首个失败阶段、expected/actual、trace、owner、关闭命令。历史 164/122/42 仅为候选结果，不预先分类新结果；各行数量与本次总数相符，无法归属写 unknown 交 reviewer。首个失败在本次 helper 的 status/locator/postcondition 时归 task-test-5.1；已证实的 interaction/regression/new-feat 旧假设归 5.2，compact/vue-drag 归 5.3，plans/import/ui-adjust 归 6，build-flow 归 11。禁止仅因文件在本任务外就排除 helper 回归；两条产品签名归 fix owner，额外产品签名另交 reviewer。

本父级无已接受的功能失败豁免。纠错后修复前的失败 checkpoint 仍不通过；coding 自测不替代本父任务的可操作验证。保留旧报告、新运行用新证据序号；不更新粗粒度 status，不扩展独立任务的阻塞闭包。

## 共同执行约束

本合同与 [plan.md](plan.md) 的验收、失败归属、证据、恢复和合并规则共同构成执行授权。仅在计划接受后执行。先在冻结 target base 复现原用例，再在含全部依赖的实际 target 提交复现；两者相同只需一份运行。每次记录完整 SHA，依赖已合入 target 才能成为 integrate 的输入。collection、旧报告和静态扫描都不能替代本轮行为证据。

每个子任务先把原 test task/scenario → 当前 accepted 规则 → fixture/locator → 用户动作 → 精确 oracle → 新用例映射写入其 Owned paths 的迁移文档；保留原编号和失败来源。必要 patch 只在自己 spec 的 fixture 副本或声明的 patch 文件内，不能改共享 db/save 原件。普通 beforeEach 必须注入 db.json（排除 vsn）、reload、通过 language-select UI 设语言；版本 key 由明确版本场景决定。凡涉及 Live/save-binding/archive，只能调用 loadLiveBindingFixture；其 IndexedDB 初始化是 fixture 边界的特例，不是业务动作 witness。

优先现有 data-testid/稳定 ID；中文/英文文本用于确实验证文案的行为。page.evaluate 仅作基础 fixture 注入、平台存档初始化或最终领域结果只读；不得 store-direct mutation 伪造用户行为、使用同源算法生成 oracle。禁止 skip/fixme/only、弱化断言、条件通过、fallback 链、旧 UUID 和已废弃 UI 语义。旧 skip 场景必须执行或保留为未决证据，不能计通过。不修改 src/**、tests/unit/**、tests/legacy/**、rust-parser/**、配置、基础 fixture 或其他任务文件。

子任务失败由本子任务 worker 收集，父任务 reviewer 裁决 stale/test-owned/product/unknown/infeasible。worker 仅修复其 Owned paths 内 stale/test-owned 原因。共享 helper 问题退回唯一 owner，消费者不得复制入口或越权修复。保留失败 checkpoint/报告；无依赖的兄弟子任务和父任务继续可调度。产品候选必须沿 plan.md 的条件性 target-mediated route 返回本任务。

## 证据与交接

- Evidence: context.md 的 E5–E15 加本子任务列出的现行规范；历史 58/56/2 和 1019/640 等数字仅作线索。
- Required evidence: 原始 base 与依赖 target 的完整 SHA、candidate SHA、runner/browser/version、命令/退出码、collection 清单、逐用例结果、旧→新映射、fixture 身份、关键 UI 前置/动作/后置、trace/截图/日志路径和分类理由。
- Handoff: 子任务提供有界 diff、focused 结果和迁移文档；dispatcher 冻结不可变 lane checkpoint。全部子任务完成后运行父级累计验证，交同一 reviewer 做完整父级审查。只有父任务可成为 target merge 边界，子任务不合 target。
- Report ownership: 执行后父任务按 task-test-5-report-M.md / task-test-5-review-M.md 配对序号留证；worker 提交证据给 control，dispatcher/reviewer 在本代落盘。测试 worker 不写治理状态、合同、review 或其他代。
- Deferred closure owner: task-test-5保留每一项未决行为；dispatcher 负责可用 runner 和最终 target 复测调度，reviewer 负责争议分类。无预先接受的功能失败豁免。
- Stop conditions: 产品改动需求、超出 Owned paths 的修复或规范真实冲突时停止该证据项并交 reviewer；runner/toolchain 不可用记 unavailable，不要求用户解锁，也不阻断独立项。报告不等于测试通过。

## Blocking self-validation

- Commands: `npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts tests/e2e/logic-flow/logic-flow-interaction.spec.ts tests/e2e/logic-flow/logic-flow-new-feat.spec.ts tests/e2e/compact-drag-view.spec.ts tests/e2e/vue-drag-test.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `npm run build`; `git diff --check`
- Collection: `npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts tests/e2e/logic-flow/logic-flow-interaction.spec.ts tests/e2e/logic-flow/logic-flow-new-feat.spec.ts tests/e2e/compact-drag-view.spec.ts tests/e2e/vue-drag-test.spec.ts --list --reporter=list`
- Gate: 全部有效用例执行且满足冻结断言；修改对应 stale/test-owned 原因后 focused 必须重跑；编译/差异校验失败按归属处理。环境无法执行时记录 unavailable 与恢复条件，允许继续独立任务但不得写 pass。
- Cross-consumer validation: helper 变动后运行 `npm exec playwright test -- tests/e2e/logic-flow tests/e2e/compact-drag-view.spec.ts tests/e2e/vue-drag-test.spec.ts tests/e2e/build-flow --project=chromium --workers=1 --retries=0 --trace=on`；helper 回归本任务负责；消费者旧假设按其父任务留证。

## 验收与后续闭环

每个子任务 Done when 都满足、全部拥有的 spec/scenario 有旧→新映射，当前有效要求没有 skip 或弱断言，父任务累计 diff 未越界，reviewer 明确区分迁移修正与产品缺陷后，才可提交父任务合并判定。实际失败不能伪装完成；unknown/infeasible 可留证交接，但行为通过结论保持未决。跨消费者观察不是已批准的 deferred self-run；本父级可操作的验证不可推迟。

最终 `npm run test:e2e`、`npm run build`、`git diff --check` 由 dispatcher 在全部独立父任务进入 target 后组织；失败按本合同 owner 回流。本任务的未决项必须在相同语义输入的可用环境重跑并经 reviewer 关闭，或明确保留范围及限制，不能静默丢弃。

## Subtask task-test-5.1

- Goal: 拖放反馈与不兼容拒绝产生可观察且准确的结果
- Worker role: def_coding_worker
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Owned paths: `tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts`, `tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts`, `tests/e2e/logic-flow/helpers/dragLogicFlow.ts`, `tests/e2e/logic-flow/helpers/setupLogicFlow.ts`, `tests/e2e/logic-flow/migration-task-test-5.1.md`
- Depends on: none
- Focused validation: `npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `git diff --check`
- Done when: 拖放反馈与不兼容拒绝产生可观察且准确的结果已由当前 base/candidate 的真实 UI 运行证明；有效原任务全部映射，所有测试自有失败修复并重跑，无越界修改，失败和 unavailable 另行保留，不计为通过。
- Normative sources: `openspec/specs/logical-flow-planner/spec.md`, `openspec/specs/logic-flow-operation/spec.md`
- Required work: extend 现有 dragLogicFlow/setupLogicFlow；显式 clean/seeded、game version 8.0 和目标 group identity，验证合法 hover/status、ghost、release 后 normal/duplicated/auto/isolated/replace/locked/rejected 结果。禁止默认 target index 0、直接写 isDragging/节点或可选 hover。
- Documentation: 场景映射、明确 fixture 副本字段、稳定锚点、独立 expected 与执行证据仅写入已声明的 `tests/e2e/logic-flow/migration-task-test-5.1.md`。规范文件（含 spec.md）及未列入本子任务 Owned paths 的 OpenSpec 文档（含 e2e_test_tasks.md / test_tasks.md）一律只读。
- Failure owner: task-test-5.1 收集和修复 test-owned；task-test-5 的 reviewer 裁决；产品修复返回 task-test-5 后首先重跑本子任务。
- Correction gate: 执行本合同“当前代有界修正与恢复顺序”的前置纠错后保持暂停；fix target-visibility barrier 满足后才正式复验，不以 Energy Cells 作为合法操作前提。
- Handoff: 当前 base/candidate 完整 SHA、owned diff、focused 命令/退出/逐用例结果与映射交 dispatcher；后续消费者只读已稳定输入，不重开本实现。
- Stop conditions: 超出本 Owned paths、产品候选或不可裁决规范冲突时保留该项并交 reviewer；无关项继续。

## Subtask task-test-5.2

- Goal: 产线交互、隔离和新增行为遵循当前 lineage 与 T0 规则
- Worker role: def_coding_worker
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Owned paths: `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts`, `tests/e2e/logic-flow/logic-flow-interaction.spec.ts`, `tests/e2e/logic-flow/logic-flow-new-feat.spec.ts`, `tests/e2e/logic-flow/migration-task-test-5.2.md`
- Depends on: task-test-5.1
- Focused validation: `npm exec playwright test -- tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts tests/e2e/logic-flow/logic-flow-interaction.spec.ts tests/e2e/logic-flow/logic-flow-new-feat.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `git diff --check`
- Done when: 产线交互、隔离和新增行为遵循当前 lineage 与 T0 规则已由当前 base/candidate 的真实 UI 运行证明；有效原任务全部映射，所有测试自有失败修复并重跑，无越界修改，失败和 unavailable 另行保留，不计为通过。
- Normative sources: `openspec/specs/logical-flow-planner/spec.md`, `openspec/specs/logic-flow-operation/spec.md`, `openspec/specs/module-id/spec.md`
- Required work: 移除 store-direct 业务 setup，固定 clean/seeded 数据；用卡片 module 名、group identity、T0 不锁定、auto/manual 及隔离后独立连接验证原回归目的；失败发生在 hover 前时归到 setup/helper 候选，不能据此判产线算法错误。
- Documentation: 场景映射、明确 fixture 副本字段、稳定锚点、独立 expected 与执行证据仅写入已声明的 `tests/e2e/logic-flow/migration-task-test-5.2.md`。规范文件（含 spec.md）及未列入本子任务 Owned paths 的 OpenSpec 文档（含 e2e_test_tasks.md / test_tasks.md）一律只读。
- Failure owner: task-test-5.2 收集和修复 test-owned；task-test-5 的 reviewer 裁决；产品修复返回 task-test-5 后首先重跑本子任务。
- Handoff: 当前 base/candidate 完整 SHA、owned diff、focused 命令/退出/逐用例结果与映射交 dispatcher；后续消费者只读已稳定输入，不重开本实现。
- Stop conditions: 超出本 Owned paths、产品候选或不可裁决规范冲突时保留该项并交 reviewer；无关项继续。

## Subtask task-test-5.3

- Goal: 紧凑视图和拖放演示以真实鼠标验证开始、取消和完成
- Worker role: def_coding_worker
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Owned paths: `tests/e2e/compact-drag-view.spec.ts`, `tests/e2e/vue-drag-test.spec.ts`, `tests/e2e/migration-task-test-5.3.md`
- Depends on: task-test-5.1
- Focused validation: `npm exec playwright test -- tests/e2e/compact-drag-view.spec.ts tests/e2e/vue-drag-test.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `git diff --check`
- Done when: 紧凑视图和拖放演示以真实鼠标验证开始、取消和完成已由当前 base/candidate 的真实 UI 运行证明；有效原任务全部映射，所有测试自有失败修复并重跑，无越界修改，失败和 unavailable 另行保留，不计为通过。
- Normative sources: `openspec/specs/logical-flow-planner/spec.md`
- Required work: 把 canonical 演示中的 direct store manipulation、伪造拖拽状态与 dispatchEvent 方法比较迁移为有映射记录的真实用户用例；验证 compact 开始/结束、hover leave/cancel 不变和 drop 后精确身份。不得将该文件排出 collection，也不得把演示输出视为覆盖。
- Documentation: 场景映射、明确 fixture 副本字段、稳定锚点、独立 expected 与执行证据仅写入已声明的 `tests/e2e/migration-task-test-5.3.md`。规范文件（含 spec.md）及未列入本子任务 Owned paths 的 OpenSpec 文档（含 e2e_test_tasks.md / test_tasks.md）一律只读。
- Failure owner: task-test-5.3 收集和修复 test-owned；task-test-5 的 reviewer 裁决；产品修复返回 task-test-5 后首先重跑本子任务。
- Handoff: 当前 base/candidate 完整 SHA、owned diff、focused 命令/退出/逐用例结果与映射交 dispatcher；后续消费者只读已稳定输入，不重开本实现。
- Stop conditions: 超出本 Owned paths、产品候选或不可裁决规范冲突时保留该项并交 reviewer；无关项继续。
