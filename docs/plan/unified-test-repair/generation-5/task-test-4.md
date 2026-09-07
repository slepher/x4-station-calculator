# task-test-4：Live 生产展示与工具栏

- Plan: plan.md
- Context: context.md
- Lane: integrate
- Worktree path: /home/slepher/project/x4-station-calculator/.worktree/integrate
- Target branch: develop
- Target base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Evidence target: da05d84514c90428fd4e51907df9b6424fa5ccff
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-1
- Covers: none
- Execution strategy: split-def
- Worker role: def_coding_worker
- Goal: 将Live 生产展示与工具栏的现存测试任务、fixture 使用、locator 与断言迁移至当前接受行为，保留可复现的失败归属。
- Owned paths: `tests/e2e/live/live-overview.spec.ts`, `tests/e2e/live/live-station-dashboard.spec.ts`, `tests/e2e/live/migration-task-test-4.1.md`, `tests/e2e/live/contribution-name.spec.ts`, `tests/e2e/live/gap-button-response.spec.ts`, `tests/e2e/live/live-flow-map.spec.ts`, `tests/e2e/live/migration-task-test-4.2.md`, `tests/e2e/live/live-station-toolbar.spec.ts`, `tests/e2e/live/live-transit-toolbar.spec.ts`, `tests/e2e/live/migration-task-test-4.3.md`
- Capability disposition: reuse 现有 runner、静态 fixture 与 UI 锚点；extend 本合同明确拥有的测试/测试文档及必要 helper；new 仅限列出的迁移映射文档；replace 仅限有旧→新映射的陈旧断言，不移除有效覆盖。

## 拓扑与边界

三个展示行为组共享只读 fixture 接口，但不共享测试写入文件；其输入均可从独立 browser context 恢复。

Base 是不可变证据起点；执行前由 dispatcher 冻结含 Depends on 已接受合并结果的 develop 完整 SHA 作为 Execution base。该提交必须以 Target base 为祖先；integrate 只从 target 同步，不能从 coding 或未接受的兄弟 checkpoint 取前置。各子任务独立 browser context，禁止跨 spec 依赖测试执行顺序。按依赖执行，无依赖兄弟可在 lane 隔离 checkpoint 后独立推进。

## 共同执行约束

本合同与 [plan.md](plan.md) 的验收、失败归属、证据、恢复和合并规则共同构成执行授权。仅在计划接受后执行。先在冻结 target base 复现原用例，再在含全部依赖的实际 target 提交复现；两者相同只需一份运行。每次记录完整 SHA，依赖已合入 target 才能成为 integrate 的输入。collection、旧报告和静态扫描都不能替代本轮行为证据。

每个子任务先把原 test task/scenario → 当前 accepted 规则 → fixture/locator → 用户动作 → 精确 oracle → 新用例映射写入其 Owned paths 的迁移文档；保留原编号和失败来源。必要 patch 只在自己 spec 的 fixture 副本或声明的 patch 文件内，不能改共享 db/save 原件。普通 beforeEach 必须注入 db.json（排除 vsn）、reload、通过 language-select UI 设语言；版本 key 由明确版本场景决定。凡涉及 Live/save-binding/archive，只能调用 loadLiveBindingFixture；其 IndexedDB 初始化是 fixture 边界的特例，不是业务动作 witness。

优先现有 data-testid/稳定 ID；中文/英文文本用于确实验证文案的行为。page.evaluate 仅作基础 fixture 注入、平台存档初始化或最终领域结果只读；不得 store-direct mutation 伪造用户行为、使用同源算法生成 oracle。禁止 skip/fixme/only、弱化断言、条件通过、fallback 链、旧 UUID 和已废弃 UI 语义。旧 skip 场景必须执行或保留为未决证据，不能计通过。不修改 src/**、tests/unit/**、tests/legacy/**、rust-parser/**、配置、基础 fixture 或其他任务文件。

子任务失败由本子任务 worker 收集，父任务 reviewer 裁决 stale/test-owned/product/unknown/infeasible。worker 仅修复其 Owned paths 内 stale/test-owned 原因。共享 helper 问题退回唯一 owner，消费者不得复制入口或越权修复。保留失败 checkpoint/报告；无依赖的兄弟子任务和父任务继续可调度。产品候选必须沿 plan.md 的条件性 target-mediated route 返回本任务。

## 证据与交接

- Evidence: context.md 的 E5–E15 加本子任务列出的现行规范；历史 58/56/2 和 1019/640 等数字仅作线索。
- Required evidence: 原始 base 与依赖 target 的完整 SHA、candidate SHA、runner/browser/version、命令/退出码、collection 清单、逐用例结果、旧→新映射、fixture 身份、关键 UI 前置/动作/后置、trace/截图/日志路径和分类理由。
- Handoff: 子任务提供有界 diff、focused 结果和迁移文档；dispatcher 冻结不可变 lane checkpoint。全部子任务完成后运行父级累计验证，交同一 reviewer 做完整父级审查。只有父任务可成为 target merge 边界，子任务不合 target。
- Report ownership: 执行后父任务按 task-test-4-report-M.md / task-test-4-review-M.md 配对序号留证；worker 提交证据给 control，dispatcher/reviewer 在本代落盘。测试 worker 不写治理状态、合同、review 或其他代。
- Deferred closure owner: task-test-4保留每一项未决行为；dispatcher 负责可用 runner 和最终 target 复测调度，reviewer 负责争议分类。无预先接受的功能失败豁免。
- Stop conditions: 产品改动需求、超出 Owned paths 的修复或规范真实冲突时停止该证据项并交 reviewer；runner/toolchain 不可用记 unavailable，不要求用户解锁，也不阻断独立项。报告不等于测试通过。

## Blocking self-validation

- Commands: `npm exec playwright test -- tests/e2e/live/live-overview.spec.ts tests/e2e/live/live-station-dashboard.spec.ts tests/e2e/live/contribution-name.spec.ts tests/e2e/live/gap-button-response.spec.ts tests/e2e/live/live-flow-map.spec.ts tests/e2e/live/live-station-toolbar.spec.ts tests/e2e/live/live-transit-toolbar.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `npm run build`; `git diff --check`
- Collection: `npm exec playwright test -- tests/e2e/live/live-overview.spec.ts tests/e2e/live/live-station-dashboard.spec.ts tests/e2e/live/contribution-name.spec.ts tests/e2e/live/gap-button-response.spec.ts tests/e2e/live/live-flow-map.spec.ts tests/e2e/live/live-station-toolbar.spec.ts tests/e2e/live/live-transit-toolbar.spec.ts --list --reporter=list`
- Gate: 全部有效用例执行且满足冻结断言；修改对应 stale/test-owned 原因后 focused 必须重跑；编译/差异校验失败按归属处理。环境无法执行时记录 unavailable 与恢复条件，允许继续独立任务但不得写 pass。
- Cross-consumer validation: 复用共享资源只读；若 later helper/product fix 改变本边界输入，恢复时重跑本父任务 Commands。

## 验收与后续闭环

每个子任务 Done when 都满足、全部拥有的 spec/scenario 有旧→新映射，当前有效要求没有 skip 或弱断言，父任务累计 diff 未越界，reviewer 明确区分迁移修正与产品缺陷后，才可提交父任务合并判定。实际失败不能伪装完成；unknown/infeasible 可留证交接，但行为通过结论保持未决。跨消费者观察不是已批准的 deferred self-run；本父级可操作的验证不可推迟。

最终 `npm run test:e2e`、`npm run build`、`git diff --check` 由 dispatcher 在全部独立父任务进入 target 后组织；失败按本合同 owner 回流。本任务的未决项必须在相同语义输入的可用环境重跑并经 reviewer 关闭，或明确保留范围及限制，不能静默丢弃。

## Subtask task-test-4.1

- Goal: Live 总览与站点仪表盘展示正确归档和规划结果
- Worker role: def_coding_worker
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Owned paths: `tests/e2e/live/live-overview.spec.ts`, `tests/e2e/live/live-station-dashboard.spec.ts`, `tests/e2e/live/migration-task-test-4.1.md`
- Depends on: task-test-1
- Focused validation: `npm exec playwright test -- tests/e2e/live/live-overview.spec.ts tests/e2e/live/live-station-dashboard.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `git diff --check`
- Done when: Live 总览与站点仪表盘展示正确归档和规划结果已由当前 base/candidate 的真实 UI 运行证明；有效原任务全部映射，所有测试自有失败修复并重跑，无越界修改，失败和 unavailable 另行保留，不计为通过。
- Normative sources: `openspec/specs/production-ui/spec.md`, `openspec/specs/station-dashboard/spec.md`, `openspec/specs/live-workforce-integration/spec.md`
- Required work: 从权威 helper 进入 Live；通过 UI 选择站点与维度，固定可区分 archive/planned 数据，断言行身份、模块范围、数量/体积/价值与切换结果，reload 后核对持久化，不能只检查面板存在。
- Documentation: 场景映射、明确 fixture 副本字段、稳定锚点、独立 expected 与执行证据仅写入已声明的 `tests/e2e/live/migration-task-test-4.1.md`。规范文件（含 spec.md）及未列入本子任务 Owned paths 的 OpenSpec 文档（含 e2e_test_tasks.md / test_tasks.md）一律只读。
- Failure owner: task-test-4.1 收集和修复 test-owned；task-test-4 的 reviewer 裁决；产品修复返回 task-test-4 后首先重跑本子任务。
- Handoff: 当前 base/candidate 完整 SHA、owned diff、focused 命令/退出/逐用例结果与映射交 dispatcher；后续消费者只读已稳定输入，不重开本实现。
- Stop conditions: 超出本 Owned paths、产品候选或不可裁决规范冲突时保留该项并交 reviewer；无关项继续。

## Subtask task-test-4.2

- Goal: 贡献名称、缺口按钮与流向地图联动选中正确对象
- Worker role: def_coding_worker
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Owned paths: `tests/e2e/live/contribution-name.spec.ts`, `tests/e2e/live/gap-button-response.spec.ts`, `tests/e2e/live/live-flow-map.spec.ts`, `tests/e2e/live/migration-task-test-4.2.md`
- Depends on: task-test-1
- Focused validation: `npm exec playwright test -- tests/e2e/live/contribution-name.spec.ts tests/e2e/live/gap-button-response.spec.ts tests/e2e/live/live-flow-map.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `git diff --check`
- Done when: 贡献名称、缺口按钮与流向地图联动选中正确对象已由当前 base/candidate 的真实 UI 运行证明；有效原任务全部映射，所有测试自有失败修复并重跑，无越界修改，失败和 unavailable 另行保留，不计为通过。
- Normative sources: `openspec/specs/ware-flow-display/spec.md`, `openspec/specs/empire-gap-display/spec.md`, `openspec/changes/one-flow-contribution/specs/one-flow-contribution/spec.md`
- Required work: 用固定 ware/station 身份核对贡献名称；点击缺口入口和地图入口，断言被选择对象、导航及对应流量明细，避免把最终 store 读取当成点击行为替代。
- Documentation: 场景映射、明确 fixture 副本字段、稳定锚点、独立 expected 与执行证据仅写入已声明的 `tests/e2e/live/migration-task-test-4.2.md`。规范文件（含 spec.md）及未列入本子任务 Owned paths 的 OpenSpec 文档（含 e2e_test_tasks.md / test_tasks.md）一律只读。
- Failure owner: task-test-4.2 收集和修复 test-owned；task-test-4 的 reviewer 裁决；产品修复返回 task-test-4 后首先重跑本子任务。
- Handoff: 当前 base/candidate 完整 SHA、owned diff、focused 命令/退出/逐用例结果与映射交 dispatcher；后续消费者只读已稳定输入，不重开本实现。
- Stop conditions: 超出本 Owned paths、产品候选或不可裁决规范冲突时保留该项并交 reviewer；无关项继续。

## Subtask task-test-4.3

- Goal: 站点及中转工具栏操作正确保存当前绑定
- Worker role: def_coding_worker
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Owned paths: `tests/e2e/live/live-station-toolbar.spec.ts`, `tests/e2e/live/live-transit-toolbar.spec.ts`, `tests/e2e/live/migration-task-test-4.3.md`
- Depends on: task-test-1
- Focused validation: `npm exec playwright test -- tests/e2e/live/live-station-toolbar.spec.ts tests/e2e/live/live-transit-toolbar.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `git diff --check`
- Done when: 站点及中转工具栏操作正确保存当前绑定已由当前 base/candidate 的真实 UI 运行证明；有效原任务全部映射，所有测试自有失败修复并重跑，无越界修改，失败和 unavailable 另行保留，不计为通过。
- Normative sources: `openspec/specs/live-station-toolbar/spec.md`, `openspec/specs/context-toolbar/spec.md`
- Required work: 建立明确 dirty/clean、站点/中转状态，通过 UI 执行动作，验证按钮状态、保存/放弃结果与 reload；每个取消、确认分支固定前提，不使用 if-visible 可选断言。
- Documentation: 场景映射、明确 fixture 副本字段、稳定锚点、独立 expected 与执行证据仅写入已声明的 `tests/e2e/live/migration-task-test-4.3.md`。规范文件（含 spec.md）及未列入本子任务 Owned paths 的 OpenSpec 文档（含 e2e_test_tasks.md / test_tasks.md）一律只读。
- Failure owner: task-test-4.3 收集和修复 test-owned；task-test-4 的 reviewer 裁决；产品修复返回 task-test-4 后首先重跑本子任务。
- Handoff: 当前 base/candidate 完整 SHA、owned diff、focused 命令/退出/逐用例结果与映射交 dispatcher；后续消费者只读已稳定输入，不重开本实现。
- Stop conditions: 超出本 Owned paths、产品候选或不可裁决规范冲突时保留该项并交 reviewer；无关项继续。
