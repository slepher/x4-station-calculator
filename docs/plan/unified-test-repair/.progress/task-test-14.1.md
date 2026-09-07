Status: cannot_resolve
Subtask: unified-test-repair generation-5 task-test-14.1

Result: 完成 owned E2E 迁移；未提交 Git。测试覆盖显式计算、固定可手算目标、目标修改重算、模块/数量/耗时、Energy Cells 建材与成本相关材料展示、重叠产线材料去重、详情 summary/steps 入口以及无规划计算。

Evidence:

- HEAD: `761310260d1188d836326fadbdd7bdc7616de05c`
- Baseline command: `npm exec playwright test -- tests/e2e/build-plan-compute/build-plan-compute.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`
- Baseline: exit 0, 5/5 passed。
- Focused corrected run: same command；exit 1, 5/6 passed。
  - 2.1 passed：Energy Cell Production ×1、Energy Cells ×520、12m。
  - 2.2 passed：数量修改后方案文本变化。
  - 3.1 passed：按钮、方案卡片、耗时。
  - 3.2 passed：模块数量、Energy Cells 建材、材料行仅一次。
  - 3.3 failed：当前可公开选择的 unplanned 方案详情没有 `role=switch`；trace：`test-results/build-plan-compute-build-p-bf135-3-Case-详情默认模块汇总与-steps-切换可逆-chromium/trace.zip`。
  - 3.4 passed：unplanned 后仍有方案卡片。
- Separate `-g 3.3` reproduction: exit 1；fixture flow menu 只有 `unplanned`，不存在 `flow-plan-menu-item-logic-flow-1`，无法通过公开 UI 到达 build-material scheme；未修产品代码。
- Final requested full command rerun: exit 1，6/6 setup failures with `page.goto: net::ERR_CONNECTION_REFUSED` against preview webServer；属于 runner/server 环境证据，不能声称通过。

Changes:

- `tests/e2e/build-plan-compute/build-plan-compute.spec.ts`: replaced stale conditional assertions with six deterministic UI tests and required fixture setup。
- `openspec/changes/build-plan-compute/test_tasks.md`: only updated E2E chapters 2–4；Unit chapter 1 unchanged。
- `tests/e2e/build-plan-compute/migration-task-test-14.1.md`: added mapping, oracle, fixture/UI actions, SCC boundary and classification。
- `docs/plan/unified-test-repair/.progress/task-test-14.1.md`: added this report。

Validation:

Self-run: focused command above；baseline 5/5；corrected stable run 5/6；3.3 product/fixture reachability failure；final rerun environment failure。Trace recording enabled。`npm exec playwright test -- tests/e2e/build-plan-compute/build-plan-compute.spec.ts --list` exit 0，列出 6 tests；`npm run build` exit 0；`git diff --check` exit 0。

Caveats: 未运行或声称通过全量测试。Build warnings 仅为 Browserslist 过期数据和大 chunk 提示。SCC 全局最小性未断言，符合任务约束。
