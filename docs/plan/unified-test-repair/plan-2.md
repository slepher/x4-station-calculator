# unified-test-repair 实施计划（第 2 代）

- Plan status: `ready`
- Context: `context-2.md`
- Supersedes: `plan-1.md`
- Execution note: 本文件只定义后续合同，不启动 codex-workflow

## Preflight state

- 当前工作区已准备 `task-coding-3` 的 active skill、routing 和 agent-gate 候选；正式 workflow 应验证并接管该候选，不必重复设计。
- 第 1 代 `status*.md` 已迁入 `history/generation-1/`，避免后续启动时错误恢复旧 blocked task。
- 尚未移动任何产品测试，也未翻转 Vitest/Playwright；这些仍属于 `task-test-3`、`task-test-4` 的正式执行内容。
- 正式启动 workflow 时再创建第 2 代 runtime status；本次前置整理不伪造执行状态。

## 目标

把产品测试权威收敛到 `tests/unit/**` 和 `tests/e2e/**`，把所有旧测试原件迁到 `tests/legacy/**`；同时让 Unit 随代码实现交付、E2E 只走新链路，并取消与任务 ownership 无关的 skill 自测强制阻塞。

## 决策

1. Unit 是 implementation concern：`x4-doc` 把 focused Unit coverage 写入 `tasks.md`，`x4-apply` 同时修改产品代码和 `tests/unit/**`。
2. E2E 是独立工作流：只使用 `e2e_tests.md`、`e2e_test_tasks.md` 和 `x4-e2e-test-*`。
3. 旧 mixed `test_tasks.md` 及 `x4-test-*` 不再作为 verify/bug/archive gate。
4. `tests/legacy/**` 只保存历史，不默认收集、不要求通过。
5. skill suite 与产品 suite 分离；失败按 owned path 路由，不跨任务强制修复。

## 任务拓扑

1. `task-coding-3`：收口 active skill discovery、命令路由、agent gate 与 bug/verify/archive 契约。
2. `task-test-3`：迁移 Unit 与旧 mixed skill tests，翻转 Vitest/default scripts；其 checkpoint 发现的 `BUG-001` 先走 `task-coding-4` correction。
3. `task-coding-4`：在 coding lane 修复 unmatched synthetic `groupId` 错用 lineage 的产品缺陷，并经 reviewer 接受后先进入 target。
4. `task-test-3`：integrate 从已含修复的 target 刷新，复跑 focused 与完整 Unit 后再进入 target。
5. `task-test-4`：迁移 E2E，翻转 Playwright，并完成 Live helper 与文档路径。

全部串行执行，避免目录移动与配置切换期间出现双 owner。详细合同见同名文件和 `lanes-2.md`。

## task-coding-3

收口 active skill discovery、命令路由、agent gate 与 bug/verify/archive 契约；冻结合同见 `task-coding-3.md`。

## task-test-3

迁移 Unit 与旧 mixed skill tests，翻转 Vitest/default scripts；冻结合同见 `task-test-3.md`。

## task-coding-4

修复 `BUG-001`，只拥有 `src/store/logic/buildPlanProductionLine.ts`；复用既有 Terran regression，不新增平行测试或选择器。冻结合同见 `task-coding-4.md`。

## task-test-4

迁移 E2E，翻转 Playwright，并完成 Live helper 与文档路径；冻结合同见 `task-test-4.md`。

## 总体验收

1. `npm run test:unit` 只收集 `tests/unit/**/*.spec.ts` 并通过。
2. `npm run test:skills` 只收集 active `tests/e2e-skills/**/*.spec.ts` 并通过；失败路由给 workflow/skill owner，不回压产品测试任务。
3. `npm run test:e2e` 只收集 `tests/e2e/**`，使用 fresh build，并在可启动浏览器的环境通过。
4. `tests/unified-unit/`、`tests/unified-e2e/` 不再存在；旧原件位于 `tests/legacy/**`。
5. `.trae/skills/` 与 `.codex/multiagent.config.yaml` 无旧 `x4-test-*` active route。
6. `/x4:apply` 的行为变更有 focused Unit evidence；E2E 仍由独立文档任务防漂移。
7. `git diff --check` 通过。

## 非阻塞与停止条件

- legacy failure、未改动的外部 skill failure、当前任务无权修复的既有 failure：记录 owner 后延期，不阻塞 task acceptance。
- 当前任务 owned path 的失败、测试原件丢失、canonical 配置仍双收集、active route 仍调用旧 skill：阻塞。
- 需要改变产品语义、删除无法分类的旧测试或新增测试框架时停止并返回用户；不得用兼容层掩盖迁移未完成。

## BUG-001 correction 验收

1. `__preview_unmatched__:<index>` 继续仅作为稳定身份；unmatched module 选择使用 `settings.racePreference`，真实 logic-flow line 继续使用自身 lineage。
2. `task-coding-4` 的 immutable candidate 通过 focused Unit、`npm run build`、`git diff --check` 与独立 `reviewer` gate。
3. 路由严格为 `coding -> target -> integrate -> target`；禁止 coding candidate 直接进入 integrate。
4. integrate 刷新后，`tests/unit/current/build-flow-plan/buildPlanProductionLine.spec.ts` 的 Terran regression 与 `npm run test:unit` 均通过，`task-test-3` reviewer 才可接受候选。
5. target owner 以已接受的 source candidate、focused/full Unit 和 build evidence 将 `BUG-001` 标记为 closed，并同步 Phase 9 `T34`-`T37`；该 closure 不授权 planner 或 coding worker 改写 OpenSpec。
