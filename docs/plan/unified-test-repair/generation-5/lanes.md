# unified-test-repair：第 5 代 lane 清单

- Plan: plan.md
- Context: context.md
- Generation: generation-5

## Control worktree

- Name: x4-station-calculator
- Path: /home/slepher/project/x4-station-calculator
- Target branch: develop
- Target base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Evidence target: da05d84514c90428fd4e51907df9b6424fa5ccff
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff

## Lane coding

- Worktree name: coding
- Worktree path: /home/slepher/project/x4-station-calculator/.worktree/coding
- Branch: workflow/unified-test-repair-coding
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Mode: 条件性 task-test-5-fix-1；单一 writer，自测与完整 coding review 后才可合 target。
- Ownership: 仅 task-test-5-fix-1.md 声明的两个 src 路径与一份 Unit 自测；本代 E2E worker 无产品所有权。

## Lane integrate

- Worktree name: integrate
- Worktree path: /home/slepher/project/x4-station-calculator/.worktree/integrate
- Branch: workflow/unified-test-repair-integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Mode: 串行写入执行单元；每个父级独立审查与 target 合并。
- Ownership: 各 task-test 合同的精确 test/helper/fixture/doc 路径；task-test-5.1 先完成测试纠错前置，保持暂停至 fix 到达 target 后正式复验。

## Lane full-test

- Worktree name: full-test
- Worktree path: /home/slepher/project/x4-station-calculator/.worktree/full-test
- Branch: workflow/unified-test-repair-full-test
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Mode: read-only / on-demand
- Worker role: full_tester
- Ownership: 无 phase、无版本化文件写入权；只在明确启用时运行指定 target 的验证并返回日志。
- Route: 不进入产品合并路线；测试运行生成的非版本化输出仅为证据，不提交。

## 路由与冻结规则

文档所有权仅以各子任务 Owned paths 的精确路径为准。规范 spec.md 及未声明的 OpenSpec/e2e_test_tasks.md/test_tasks.md 只读；测试 worker 将场景映射和执行证据写入已声明的 migration 文档。父 2、3、11–14 的显式测试任务文件权限仅覆盖各自文件的必要 E2E 迁移，不延伸至规范或其他路径。

本清单只定义稳定路径，不 provision 或推进状态。所有 Execution base 必须在 dispatch 前解析为以 Target base 为祖先的 develop 完整 SHA，并包含 Depends on 的已接受 target merge。原 target-base reproduction 与累计 candidate 验证分开留证。subtask 不出现在 manifest，不拥有 target merge；同 lane 只有一个 writer，切换受阻任务时隔离其未接受 candidate。

普通迁移路线为 integrate -> target；本轮加入已确认产品签名的条件 route task-test-5-fix-1，严格 coding -> target -> integrate -> target，Returns to: task-test-5，不加入顶层 plan phase。Covers 仅引用正常 task-coding parent，因此当前仍为 none；task-test-5 的 Depends on 指向 fix，用 fix candidate 已在 target、integrate 已含该 target 的提交祖先证明落实等价 target-visibility barrier。禁止直接 coding -> integrate。task-test-5.1 仅先获既有 owned paths 的纠错前置权限，不能提前恢复验收、启动 5.2/5.3 或合 target；fix 的 Depends on 不反指尚未通过的父测试。

失败保留原任务/报告/checkpoint，只阻断 Depends on 闭包及 owning parent 完成；没有依赖的父/子任务保持可执行。共享 helper 只能由父 1 或父 5 中明确 owner 修正，其消费者在新的 target checkpoint 后复测。runner/toolchain unavailable 作为证据缺口留存，不增加图依赖或用户阻塞。

## Phase task-test-1

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-1.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-1.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-1 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-2

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-1
- Covers: none
- Contract: task-test-2.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-2.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-2 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-3

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-2
- Covers: none
- Contract: task-test-3.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-3.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-3 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-4

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-1
- Covers: none
- Contract: task-test-4.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-4.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-4 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-5

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-5-fix-1
- Covers: none
- Contract: task-test-5.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-5.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-5 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md、task-test-5.1-review-1.md、task-test-5-report-1.md；测试候选 b2060a45d41697593e09ac405a9064f436cc5fd1；新增纠错 checkpoint、fix target 到达证明与复验结果。
- Route: coding -> target -> integrate -> target
- Resume barrier: task-test-5.1 先纠正 test-owned oracle/setup/分组归属，验收保持暂停；fix 已在 develop 且 integrate 同步该 target 后才正式恢复，随后按原子任务依赖推进。
- Handoff: 关闭两条 product signature、完成父级累计验证与完整 review 后才可 integrate -> target；Covers 为 none 不免除条件 fix 的 target-visibility barrier。

## Phase task-test-5-fix-1

- Kind: coding
- Lane: coding
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-5-fix-1.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Worker profile: /home/slepher/.codex/workflow-agents/def-coding-worker.toml（gpt-5.6-luna / medium）
- Reviewer: reviewer（/home/slepher/.codex/workflow-agents/reviewer.toml，gpt-5.6-sol / high）
- Owned paths: `src/components/logic-flow/presenters/useLogicFlowCandidatePresenter.ts`, `src/components/logic-flow/LogicFlowCandidateZone.vue`, `tests/unit/logic-flow/logic-flow-candidate.spec.ts`
- Activation gate: 父合同 task-test-5.1 的 test-owned 纠错证据先经 reviewer 确认；不将其未接受 checkpoint 合入 coding 或 target。
- Blocking validation: 合同的 Unit、build、diff 与真实 pointer 自测全部通过；独立 coding review。
- Evidence: b2060a45d41697593e09ac405a9064f436cc5fd1 的 LF-T0-SORTABLE、LF-ENERGY-SELECTABLE；修复后不可变 candidate 与 target 包含证明。
- Route: coding -> target -> integrate -> target
- Returns to: task-test-5
- Handoff: coding 自测/review 后由 dispatcher 按既有规则合入 develop；integrate 只从该 target 同步，task-test-5.1 首先复验原 pointer 输入及测试纠错；不新增顶层 phase 或 full-test 所有权。

## Phase task-test-6

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-5
- Covers: none
- Contract: task-test-6.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-6.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-6 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-7

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-7.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-7.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-7 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-8

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-8.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-8.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-8 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-9

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-1
- Covers: none
- Contract: task-test-9.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-9.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-9 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-10

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-10.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-10.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-10 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-11

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-5
- Covers: none
- Contract: task-test-11.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-11.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-11 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-12

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-12.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-12.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-12 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-13

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-13.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-13.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-13 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-14

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-14.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-14.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-14 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-15

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-15.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-15.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-15 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。

## Phase task-test-16

- Kind: test
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Contract: task-test-16.md
- Execution strategy: split-def
- Worker role: def_coding_worker
- Owned paths: task-test-16.md 的精确白名单；无 src、配置、Unit 或 legacy。
- Blocking validation: 合同的 focused/cumulative run、npm run build、git diff --check。
- Deferred closure owner: task-test-16 持有行为闭环；reviewer 分类；dispatcher 负责最终 target 广泛验证。
- Evidence: context.md，加新 Target base/Execution base/candidate 的逐用例结果。
- Handoff: 父级完整 review 后才可 integrate -> target；失败项按 plan.md 保留。
