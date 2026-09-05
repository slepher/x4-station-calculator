# task-test-7.1 迁移记录

## 范围与基线

- 目标：帝国/站点 CRUD、sidebar 导航、站点名称和 reload 恢复。
- 规范只读来源：`openspec/specs/empire-management/spec.md`、`openspec/specs/station-tabs/spec.md`、`openspec/specs/station-tab-bar/spec.md`。
- 旧测试目录 → 当前 canonical：`tests/unified-unit/` → `tests/unit/`；`tests/unified-e2e/` → `tests/e2e/`。本次 runner 使用当前路径 `tests/e2e/production/`。
- Base SHA：`da05d84514c90428fd4e51907df9b6424fa5ccff`。
- Candidate SHA：`833e2d5b0eb1228425c5f15f68bf89355d31b396`。
- Runner：Playwright `1.57.0`，Chromium，1 worker，retries 0，trace on。
- Fixture：`tests/fixtures/db.json` 副本；逐 key 注入 localStorage，删除 `vsn`，设置 `isTestEnv=true`，reload 后通过 `[data-testid="language-select"]` 选择 `zh-CN`。未使用 `localStorage.clear`。

## 旧 → 当前映射

| 旧场景 | 当前规则/锚点 | 用户动作与精确 oracle |
|---|---|---|
| Empire CRUD toolbar load/new | `empire-management`；`toolbar-load-btn`、`toolbar-new-btn` | 点击 toolbar load/new；断言 `dialog-backdrop`，新建后 `[data-testid="sidebar-station"][data-station-id]` 数量为 1 |
| 默认/新增站点 | `empire-management` 创建工业站；`sidebar-add-station`、`sidebar-station[data-station-id]` | 点击新建站点；断言数量增加、末项 active、主工作区可见 |
| 站点切换与隔离 | `station-tabs` Station navigation | 点击不同站点；断言对应 `.active`，旧站点失活，站点 ID 保持独立 |
| 站点菜单删除 | `station-tab-bar`/`station-tabs` Station menu | 右键站点，点击 `sidebar-menu-delete`；先断言 `sidebar-delete-dialog`，不直接伪造确认 |
| 站点名称编辑 | `empire-management` CRUD update；`.ghost-input.w-32` | 用户 fill + Tab；断言输入值和站点 tab 文案变化 |
| reload 恢复 | `empire-management` runtime persistence boundary | 创建站点后点击 `toolbar-save-btn` 再 reload；断言站点身份和名称恢复（当前 candidate 未决，见失败分类） |
| 旧拖拽场景 | `station-tabs` Blueprint reorder | 旧的两个 skipped describe 已接入同一 fixture/语言前置并执行；使用 `sidebar-station[data-station-id]` 读取顺序，拖拽后断言 ID 顺序/取消拖拽结果 |

## 修改内容

- `empire-crud.spec.ts`：补齐 db fixture 注入、reload、UI 语言设置；通过 `sidebar-add-station` 建立明确站点前置；默认数量 oracle 固定为 1。
- `station-management.spec.ts`：共享同一 fixture 前置；替换陈旧 `.add-btn`、`.context-menu`、`.modal-backdrop` 为当前 sidebar testid；移除重复 `page.goto`；补充保存后 reload；恢复旧 skipped reorder 场景执行。
- 只读领域结果使用页面上的站点 ID、active class、名称和对话框；没有用完整 store 快照作为 oracle。

## 执行证据

### Frozen base baseline

命令：

```text
npm exec playwright test -- tests/e2e/production/empire-crud.spec.ts tests/e2e/production/station-management.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
```

退出码：1。27 collected：4 passed，15 failed，8 skipped。主要失败是旧前置未注入 fixture/未创建站点，仍寻找 `.add-btn`、`sidebar-station`、`.ghost-input`。Trace 根目录：`test-results/`；示例失败 trace：`production-empire-crud-Emp-ae3c3-ire-exists-with-one-station-chromium/trace.zip`、`production-station-managem-3f3d5-ion-Tab-Interactions-标签切换测试-chromium/trace.zip`。

### Candidate focused

最终使用备用端口避免固定 preview 端口冲突：

```text
PORT=21558 npm exec playwright test -- tests/e2e/production/empire-crud.spec.ts tests/e2e/production/station-management.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
```

退出码：1。27 collected：21 passed，6 failed，0 skipped。

逐用例结果：

| 用例 | 结果 |
|---|---|
| Empire CRUD / opens load modal from toolbar | passed |
| Empire CRUD / default empire exists with one station | passed |
| Empire CRUD / new button creates fresh empire | passed |
| Empire CRUD / load modal opens and shows saved empires | passed |
| Station Tab Interactions / 标签切换测试 | passed |
| Station Tab Interactions / 新建分站测试 | passed |
| Station Tab Interactions / 分站菜单测试 | passed |
| Station Tab Interactions / 工具栏内容切换测试 | passed |
| Station Tab Interactions / 工人运算开关测试 | passed |
| Station Tab Interactions / 星区矿物选择测试 | passed |
| Station Tab Interactions / 切换分站不串站 | passed |
| Station Tab Interactions / 分站数据隔离测试 | passed |
| 多空间站帝国规划 / 标签拖拽重排成功 | failed |
| 多空间站帝国规划 / 标签拖拽后第一个标签是空间站 | passed |
| 多空间站帝国规划 / 保存并刷新后顺序保持 | failed |
| 多空间站帝国规划 / 取消拖拽不改变顺序 | failed |
| station-tab-drag / W1: 标签拖拽重排成功 | passed |
| station-tab-drag / W2: 空间站标签首位 | passed |
| station-tab-drag / W3: 保存并刷新后顺序保持 | failed |
| station-tab-drag / W4: 取消拖拽不改变顺序 | failed |
| 帝国数据持久化 / 保存的帝国数据在刷新后保留 | failed |
| Station Name Editing / Test 1: Default Name Display | passed |
| Station Name Editing / Test 2: Edit Station Name | passed |
| Station Name Editing / Test 3: Name Input Is Editable | passed |
| Station Name Editing / Test 4: Save Button Exists | passed |
| Station Name Editing / Test 5: Station Name Persists | passed |
| Station Name Editing / Test 6: Default name is not empty | passed |

失败分类：前三项和 W4 的实际顺序与期望不一致，属于拖拽/取消拖拽行为未决，交 `task-test-7` reviewer 裁决；W3 在 `.results-popover .result-item` 找不到结果，属于旧 locator/test-owned 未决；reload 恢复在保存后仍找不到站点，属于产品候选或保存时序争议，交 reviewer，不修改 src。对应 trace：

- `test-results/production-station-management-多空间站帝国规划---标签拖拽重排-标签拖拽重排成功-chromium/trace.zip`
- `test-results/production-station-management-多空间站帝国规划---标签拖拽重排-保存并刷新后顺序保持-chromium/trace.zip`
- `test-results/production-station-management-多空间站帝国规划---标签拖拽重排-取消拖拽不改变顺序-chromium/trace.zip`
- `test-results/production-station-managem-6e2f4-b-integration-W3-保存并刷新后顺序保持-chromium/trace.zip`
- `test-results/production-station-managem-82815-eb-integration-W4-取消拖拽不改变顺序-chromium/trace.zip`
- `test-results/production-station-management-帝国数据持久化-保存的帝国数据在刷新后保留-chromium/trace.zip`

### Runner/environment evidence

- 一次无权限 runner 尝试：build 成功，但 `vite preview --port 21556 --host 127.0.0.1 --strictPort` 报 `listen EPERM`；固定端口随后出现 `Port 21556 is already in use`，系统进程表无残留进程。
- 使用提升权限和备用 `PORT=21558` 后 runner 正常，最终 candidate 结果以上述为准。
- `git diff --check`：退出码 0。

## 交接限制

本 lane 未提交 Git commit，未修改 src、unit、legacy、配置、基础 fixture、规范或其它任务文件。6 个失败保持未决，不计为通过；后续仅在 reviewer 分类或产品修复返回后按相同语义输入重跑。
