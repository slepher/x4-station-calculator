# task-test-1.1 保留失败报告

Task: task-test-1
Subtask: task-test-1.1
Generation: generation-5
Target branch: develop
Target base: da05d84514c90428fd4e51907df9b6424fa5ccff
Execution base: 97194f1a4ef2c8f971545a3f2e32a921ebd3a0d4
Candidate: e5951858e470d275b9969aa213be2006e3ae2b2a
Classification: infeasible
Availability: unavailable

Command: `npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`，cwd 为 `/home/slepher/project/x4-station-calculator/.worktree/integrate`，Playwright `1.57.0`，Chromium `143.0.7499.4`。

Expected behavior: 在当前 accepted archive 规则下，真实 UI 能在同一 GUID 的 `GAME_ARCHIVE_TIME=667632.933` 与 `700000` 之间切换，并保持 GUID、filename、`isValid`、`isCompatible` 及 reload 后的选中身份；不同 GUID 的无效 `save_009` 应显示 disabled/invalid，站点记录应来自选中的有效归档。

Observed behavior: reviewer 复现旧候选时 focused exit `0`、2 passed，但 trace 证明点击前 `save_008_later` 已是 active，不能证明选择事务。修正第一次 focused exit `1`，用例 1 的 `save_008` locator count 为 0，已在 owned spec 内修正。修正后再次 focused 在两个用例进入 `page.goto('/')` 前均 exit `1`，出现 `ERR_CONNECTION_REFUSED` 与 localStorage `SecurityError`，未到达行为断言，因此没有最终 UI 通过证据。

Fixture identity: `save.json` 变换为无效 GUID `B41B8D56-C58D-4F66-8EAA-6F85BC614214` / `save_009`；`save_old.json` GUID `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`，新增同 GUID `save_008_later` / time `700000`；`loadLiveBindingFixture` 负责 IndexedDB/archive 初始化。

Witness: 修正后的场景要求初始 active `save_008_later` → UI 点击 `save_008` → UI 点击 `save_008_later` → reload；最终 unavailable run 在 `page.goto('/')` 前停止。

Artifacts: `test-results/live-live-archive-valid-se-ad59c-hive-valid-one-is-clickable-chromium/trace.zip`、`test-results/live-live-archive-valid-se-000b1-e-when-newer-one-is-invalid-chromium/trace.zip`；reviewer artifact `task-test-1.1-review-1.md`；候选 checkpoint `e5951858e470d275b9969aa213be2006e3ae2b2a`。

Attempts:

1. reviewed candidate `97194f1a4ef2c8f971545a3f2e32a921ebd3a0d4`：exit `0`，2 passed；发现目标 archive 在 click 前已 active，review verdict 为 `changes_required`。
2. correction focused：exit `1`，用例 1 locator 失败、用例 2 passed；修正 locator、补充双向时间选择、`isCompatible`、invalid/disabled 和 `KXN-018` 断言。
3. correction focused 重跑：exit `1`，两个用例均在 `page.goto('/')` 前 `ERR_CONNECTION_REFUSED` / localStorage `SecurityError`；collection 仍 exit `0`，列出 2 tests；`git diff --check` exit `0`。

Owner: dispatcher 负责恢复可用 webServer/runner；task-test-1 reviewer 负责恢复后的行为审查。
Blocked closure: task-test-1.1、task-test-1.2、task-test-1，以及显式依赖 task-test-1 的 task-test-2、task-test-3、task-test-4、task-test-9；不扩展到无依赖父任务。
Independent runnable: task-test-5、task-test-7、task-test-8、task-test-10、task-test-12、task-test-13、task-test-14、task-test-15、task-test-16；其依赖 task-test-5 的 task-test-6、task-test-11 在 task-test-5 完成后继续。
Recovery condition: 在同一 integrate lane 用可启动且可访问的 webServer 重跑精确 focused command，使两个用例实际进入 UI 并取得最终通过或新的可分类失败；随后重跑 collection、task-test-1 父级 focused validation 和受 helper 影响的 cross-consumer command，并由 reviewer 复核 candidate `e5951858e470d275b9969aa213be2006e3ae2b2a`。
Recovery commands: `npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`; `npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --list --reporter=list`; `git diff --check`。
Acceptance effect: task-test-1.1、task-test-1.2、task-test-1 及上述依赖闭包不能计通过或合并；本报告不把环境失败改写为产品失败，也不关闭其他独立任务。
Returns to: task-test-1
