# task-test-8.2 progress

Status: `cannot_resolve`

Subtask：在 workflow/unified-test-repair-integrate 上迁移 map resource filter、bugfix advanced resource filter、resource pie。

HEAD/base/candidate：`761310260d1188d836326fadbdd7bdc7616de05c` / `761310260d1188d836326fadbdd7bdc7616de05c` / `761310260d1188d836326fadbdd7bdc7616de05c`

已完成的 test-owned 变更：

- 三份 spec 的 beforeEach 遵循 db fixture → 删除 vsn → 逐 key localStorage → isTestEnv → reload → `data-testid=language-select` 选择 zh-CN；无 `localStorage.clear`。
- 地图通过 `星区地图/Sector Map` UI 进入；资源面板入口迁移到 `map-resource-panel-tab`；移除 store-direct 用户动作。
- 高级模式新增组后直接操作自动展开组。

验证：

1. frozen/current baseline 指定 focused 命令：exit `130`，8 failed、1 interrupted、23 did not run；重复入口隐藏失败后按合同停止。
2. focused current 指定命令：exit `1`，11 passed、21 failed。
3. `git diff --check`：pass。

最终 21 个失败：15 个因 runner 在同一轮报 `ERR_CONNECTION_REFUSED`，未到测试路径，分类 `unavailable`；advanced 3.17 一个 stale test action；resource-pie 3.1–3.4 为旧大写 sector identity；resource-pie 3.5 为旧隐藏入口，均 `test-owned stale`。trace 保存在 `test-results/`，逐项记录见 [migration-task-test-8.2.md](../../../../tests/e2e/map/migration-task-test-8.2.md)。

未修改 src、unit、legacy、配置、fixture 或其它任务文件；未提交 Git。按用户指示不再重跑或扩展其它 spec。
