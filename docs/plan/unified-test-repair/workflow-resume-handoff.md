# codex-workflow 恢复交接

用户要求：以 `direct-migration` 进度为基础，在 `docs/plan/unified-test-repair` 新建 generation，继续未完成任务。此次明确启用 codex-workflow，旧交接中“不启用”不再适用。

## 入口事实（2026-09-08）

- 工作目录：`/home/slepher/project/x4-station-calculator`
- 分支：`develop`
- HEAD：`d0614371558b2f6b30e8fd6b148347868228c413`
- 开始检查时 `git status --short` 为空。
- 当前运行身份：dispatcher，`gpt-6-astra / medium`。
- `match_session_profile.py --bootstrap` 返回 2：模型/推理强度不匹配配置。
- 配置要求 dispatcher 为 `gpt-5.6-luna / high`，planner 为 `gpt-6-astra / high`。
- 本会话没有切换根会话配置的工具；未启动执行、测试、提交或修改产品代码。

## 恢复输入

1. `direct-migration/handoff.md`：原执行收尾、已通过项、待验证修复、未决验收。
2. `direct-migration/generation-1/summary.md`、`plan.md`、`tasks.md`、`decisions.md`：已有 Revision 1 规划，T001–T009 为只读调查，T010–T025 为 draft。该 summary 明确未新增执行结果或接受记录；恢复时还需核对实际文件，不能仅凭摘要推定当前状态。
3. `direct-migration/tasks/` 及其结果证据：逐项保留旧验收和未完成事项，不把历史通过当成本次候选通过。

## 下一会话行动

使用匹配配置的 dispatcher 根会话重新进行入口校验，委派 planner 根据实际现状在 `/home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair/generation-6` 建立新代。该目录在本次检查时不存在，创建前重新确认。旧目录保留为证据，不覆盖历史，不直接把旧代运行状态接入新代。

planner 应复用已有 Revision 1 的有效内容并核对后续证据，明确可执行合同和 draft；发布且完成结构校验后由 dispatcher 继续派发。用户授权工作树交付，未授权提交；不可因旧手工记录自动认定功能完成。

此文件仅为入口不匹配时的交接，不是 generation、计划发布、任务验收或运行状态。
