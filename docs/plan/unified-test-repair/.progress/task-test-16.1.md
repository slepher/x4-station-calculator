# task-test-16.1

Status: cannot_resolve

## Assignment

执行 generation-5 unified-test-repair 的 `task-test-16.1`，迁移
`tests/e2e/game-version-switch/game-version-switch.spec.ts`，并同步
`tests/e2e/game-version-switch/migration-task-test-16.1.md`。

工作区：`/home/slepher/project/x4-station-calculator/.worktree/integrate`

确认 HEAD：`761310260d1188d836326fadbdd7bdc7616de05c`

## Baseline

命令：

```text
npm exec playwright test -- tests/e2e/game-version-switch/game-version-switch.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
```

- runner: Playwright
- browser/project: `[chromium]`
- collection: `Running 6 tests using 1 worker`
- exit: `1`
- duration: `58.8s`
- results: 3 passed, 3 failed

逐用例结果：

1. `2.1 状态: 版本弹窗已打开` — passed
2. `2.2 切换: 打开版本弹窗 -> 选择目标版本` — failed
   - `selectOption('9.0::beta')` 在 `[data-testid="version-select"]` 中找不到目标 option，15s timeout。
3. `3.1 Case: 首次访问显示红点` — passed
4. `3.2 Case: 切换版本后数据隔离` — failed
   - 同样因旧目标 `9.0::beta` 不存在而 timeout。
5. `3.5 Case: 同版本确认写入` — failed
   - 旧 oracle 期待 `"version":"8.0"`，实际 localStorage 为 `{"version":"9.0","beta":false}`。
6. `3.6 Case: 同版本已写库按钮禁用` — passed

基线 trace 失败产物：

- `test-results/game-version-switch-game-v-45644-状态迁移-2-2-切换-打开版本弹窗---选择目标版本-chromium/trace.zip`
- `test-results/game-version-switch-game-v-bf6a2-E2E-测试场景-3-2-Case-切换版本后数据隔离-chromium/trace.zip`

## Attempts

- 已读取并确认 role protocol。
- 已确认 HEAD 与任务要求一致。
- 已执行原 spec 基线并记录完整 runner/browser/collection/逐用例结果。
- 已读取当前 `openspec/specs/game-version-switch/spec.md`、原 spec、VersionSettingsModal 的现有 testid 与版本配置。
- 未修改 owned paths。
- 未执行迁移实现、focused rerun、`--list`、`npm run build` 或 `git diff --check`，因为用户随后要求立即收束。

## Blockers

当前任务未完成，原因是用户中断并要求立即收束，禁止继续分析或修改。

## Unmet acceptance

- 未用真实 UI 产生三个 dirty 模块。
- 未验证 dirty 模块默认不勾选、选择性保存及 `requiresSaveAs` 名称输入。
- 未验证目标版本数据隔离。
- 未区分同版本未持久选择、已持久同版本禁用与真实版本切换。
- 未创建或更新 `migration-task-test-16.1.md`。
- 未完成 focused 用例通过门槛，也未完成 build、list、diff-check 验证。

## Recovery conditions

恢复时在同一 worktree 且不回退他人改动的前提下：

1. 仅修改两个 owned paths，并继续使用当前 accepted spec。
2. 普通 `beforeEach` 按要求注入深拷贝 `tests/fixtures/db.json`、删除 `vsn`、逐 key 写入 localStorage、设置 `isTestEnv=true`、reload、等待 debug-ready，再通过 `[data-testid="language-select"]` 设置 `zh-CN`。
3. 通过真实 UI 完成三个 dirty 模块与版本切换 oracle。
4. 执行用户指定 focused 命令、`--list --reporter=list`、`npm run build`、`git diff --check`。
5. 全部有效用例通过后才可将状态改为 `done`；否则继续保持 `cannot_resolve` 并补充新证据。

