# task-test-1.1 审查 1

## Subtask

`task-test-1.1`：有效归档选择准确绑定 GUID、时间与兼容性。

## Reviewed commit

`97194f1a4ef2c8f971545a3f2e32a921ebd3a0d4`；唯一父提交为冻结 base `da05d84514c90428fd4e51907df9b6424fa5ccff`。差异仅含三个 owned paths，candidate worktree 干净。

## Contract conformance

路径和测试边界合规；无 `skip/fixme/only`。helper 将 filename 与对应 save 在一次目录枚举中配对，消除了 `transformSave` 依赖两次枚举顺序的问题，并保持无 options 消费者的输入不变。新增同 GUID 的两个时间项及不同 GUID 的无效项，未修改基础 fixture。

尚未满足 Done when：主要 UI 选择动作没有建立变化前提，且迁移文档没有把运行证据绑定到不可变 candidate。`migration-task-test-1.1.md` 仍写“同一 HEAD 的未提交候选工作树；当前 SHA 为 base”，与本次 reviewed commit 冲突。

## Observable coverage

用例收集为 2；worker 报告 base 与 candidate focused 各 `exit 0 / 2 passed`。候选新增了两个有效时间项计数、选择后 GUID/time/filename/isValid 及 reload 保持断言，并保留无效 badge 与归档站点路径。

但 `save_008_later` 是 GUID-level binding 初始化时自动选择的最新有效项。候选 trace 在第 58 行 click 的 `before` snapshot 已显示该目标为 `class="save-item save-item-active"`；因此点击即使不触发选择事务，后续全部断言仍可通过。当前断言也未检查独立的 `isCompatible === true`，不能完整证明“兼容性”。

## Duplicate/weak coverage

没有新增重复用例；两个用例分别面向归档选择和归档站点恢复。第一项的核心 click 是对既有 active 项的无状态变化操作，属于弱覆盖；第二项只以 station/dashboard 可见作间接 witness，未在该独立 browser context 中固定 selected archive 身份或 archive-derived record。

## Failure ownership

- `auto-sector-group-one-binding.spec.ts:394`：不归 task-test-1.1/helper。失败是 reset 后完整 `autoGroupResult` deep equality；generation-5 context 已将该签名冻结为 test-owned。归 `task-test-2.1`，应改为当前 reset 领域不变量并 focused 重跑。
- `auto-sector-group-one-core.spec.ts:903`：不归 task-test-1.1/helper。source 属于 `cluster_100_sector001_macro`，目标 `cluster_26_sector001_macro` 属于 `cluster_24_sector001_macro` 的 coverage；当前规则要求跨 group 拒绝，旧用例却期待 binding preview，属于 `task-test-3.1` 的 test-owned target/witness。若改用同 group 合法目标后仍无 preview，再沿 `task-test-3.1 -> reviewer -> conditional product fix -> task-test-3.1` 保留 product/unknown 路线。

两项消费者都以无 options 调用 helper；本次 helper 的默认 save 集合和排序语义未变。其签名也与冻结 context 一致，不能据此判定 helper 回归。cross-consumer 命令整体仍是失败，不能记为通过。

## Evidence

- `git diff da05d84514c90428fd4e51907df9b6424fa5ccff..97194f1a4ef2c8f971545a3f2e32a921ebd3a0d4`：3 个 owned paths，81 insertions / 8 deletions；`git diff --check` exit `0`。
- Base focused：合同命令，exit `0`，2 passed / 0 failed。
- Candidate focused：合同命令，exit `0`，2 passed / 0 failed；traces 为 `test-results/live-live-archive-valid-se-ad59c-hive-valid-one-is-clickable-chromium/trace.zip`、`test-results/live-live-archive-valid-se-000b1-e-when-newer-one-is-invalid-chromium/trace.zip`。
- Candidate collection：合同 list 命令，exit `0`，2 tests。
- Cross-consumer：合同命令，exit `1`，140 tests / 138 passed / 2 failed；失败和 traces 精确为 migration 文档所列两项。
- Candidate trace 的 click 前 snapshot 明确显示 `save_008_later` 已为 `save-item-active`，故“2 passed”不等于选择转换已被证明。

## Verdict

`changes_required`

## Correction

仅修改本子任务三个 owned paths：

1. 在 `live-archive-valid-select.spec.ts` 先固定初始 `save_008_later` active，再通过 UI 点击 `save_008`，断言 selected archive 为 GUID `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`、time `667632.933`、filename `save_008`、`isValid/isCompatible === true`；随后点击 `save_008_later`，断言 time `700000` 与 filename，并以该身份 reload。这样一次用例同时证明双向 time 映射和持久化。
2. 将无效不同 GUID 项精确限定为 `save_009`，断言 invalid/disabled；在第二用例中至少断言本 context 的 selected archive 身份和 `playerStationRecords` 含 `KXN-018`，避免仅用 dashboard 存在代替 archive 恢复。
3. 同步迁移映射；删除“未提交候选/current SHA=base”文字，记录实际执行的完整 base 与新冻结 checkpoint SHA、cwd、Playwright/Chromium 版本、命令、exit、逐用例结果和 trace 路径。

Focused validation：

`npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`

`npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --list --reporter=list`

`git diff --check`

## Deferred acceptance

本轮不接受 task-test-1.1。两项 cross-consumer 失败按上述精确签名留给 `task-test-2.1` 与 `task-test-3.1`，不计通过，也不要求 task-test-1.1 越权修复。helper 若在 correction 中不再变化，保留本轮 140/138/2 作为命名 deferred evidence；若 helper 再变，按父合同重跑完整 cross-consumer 命令。
