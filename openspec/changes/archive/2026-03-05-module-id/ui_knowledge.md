# module-id UI 知识

## 状态标识定义（对应 test_tasks Chapter 2）
- `empire-v2-macro`: 导入文件中的 `x4_empire_data.version=2`，且站点 `modules[].id` 使用旧 macro id。
- `empire-v3-module`: 导入完成后 `x4_empire_data.version=3`，且站点 `modules[].id` 使用 module id。
- `flow-v1-macro`: 导入文件中的 `x4_logic_flow_plans.version=1`，且节点 `moduleId` 使用旧 macro id。
- `flow-v2-module`: 导入完成后 `x4_logic_flow_plans.version=2`，且节点 `moduleId` 使用 module id。

## 导入导出相关定位器

### Storage Import Wizard
- 容器：`storage-import-wizard`
- 文件输入：`storage-import-file-input`
- 解析错误：`storage-import-parse-error`
- 配置区：`storage-import-config`
- 覆盖模式：`storage-import-mode-overwrite`
- 增量模式：`storage-import-mode-incremental`
- 执行导入：`storage-import-apply-btn`
- 模块复选：`storage-import-module-x4_empire_data` / `storage-import-module-x4_logic_flow_plans` / `storage-import-module-x4_ship_blueprints`

### Storage Export Wizard
- 容器：`storage-export-wizard`
- 文件名输入：`storage-export-filename-input`
- 配置区：`storage-export-config`
- 下载按钮：`storage-export-download-btn`
- 模块统计：`storage-export-module-x4_empire_data` / `storage-export-module-x4_logic_flow_plans` / `storage-export-module-x4_ship_blueprints`

### Blueprint/x4-game Import
- 统一导入容器：`import-view-modal`
- XML 上传区：`import-blueprint-file-upload`
- 模块统计：`import-blueprint-module-count`
- x4-game 输入框：`import-x4-station-input`
- 导入按钮：`import-view-action-import`

## 可观测数据与断言位点
- 导入样例文件（state precondition）：
  - `tests/fixtures/import-export/import-full.json -> x4_empire_data.version`
  - `tests/fixtures/import-export/import-incremental.json -> x4_logic_flow_plans.version`
- Empire 存储键：`localStorage['x4_empire_data']`
  - 核心断言：`version`、`list[].stations[].modules[].id`
- Flow 存储键：`localStorage['x4_logic_flow_plans']`
  - 核心断言：`version`、`list[].groups[].nodes[].moduleId`
- 导出文件断言：解析下载 JSON 后检查
  - `data.x4_empire_data.version === 3`
  - `data.x4_logic_flow_plans.version === 2`

## 任务到定位器映射
- `2.1/2.2`：`storage-import-wizard` + `storage-import-file-input` + `storage-import-module-x4_empire_data` + `storage-import-mode-overwrite` + `storage-import-apply-btn`
  - `2.1.3` 版本前置断言来源：`tests/fixtures/import-export/import-full.json:x4_empire_data.version`
- `2.3/2.4`：`storage-import-module-x4_logic_flow_plans` + `storage-import-apply-btn`
  - `2.3.3` 版本前置断言来源：`tests/fixtures/import-export/import-incremental.json:x4_logic_flow_plans.version`
- `3.1/3.2`：导入后通过 `page.evaluate` 读取 `localStorage` 中 Empire/Flow 结构
- `3.3`：`storage-export-wizard` + `storage-export-download-btn`，然后解析导出 JSON
- `3.4`：`import-view-modal` + `import-blueprint-file-upload` + `import-x4-station-input` + `import-view-action-import`
- `4.1`：复用 `2.2` 导入执行路径并固定为覆盖模式
  - `storage-import-file-input` + `storage-import-module-x4_empire_data` + `storage-import-mode-overwrite` + `storage-import-apply-btn`
  - 断言位点：`localStorage['x4_empire_data'].version`

## 稳定性建议
- E2E `beforeEach` 按项目约定注入 `tests/fixtures/db.json`（排除 `vsn`）并通过 UI 设置语言。
- 关于版本升级断言，优先读 localStorage，避免只做 UI 文案级断言。

# 测试运行

- [✓] 2.3 状态: flow-v1-macro
  - 首次失败：`toolbar-import-btn` 点击后偶发未出现 `storage-import-wizard`。
  - 收敛方式：导入入口 helper 增加标题编辑态收敛（`Enter/Escape` + `toolbar-panel input + button`）、DOM click fallback 与重试。
  - 最新结果：`pnpm exec playwright test tests/e2e/module-id/... --workers=1` 通过。

- [✓] 2.4 切换: flow-v1-macro -> flow-v2-module
  - 首次失败：复用同一导入入口时偶发未打开 `storage-import-wizard`。
  - 收敛方式：与 2.3 同步使用稳态导入 helper。
  - 最新结果：最新回归通过。

- [✓] 3.4 Case: XML 与 x4-game 输入统一归一 module id
  - 首次失败：基于“新增站点切片”断言存在脆弱性，导致 `allNormalized` 误判。
  - 收敛方式：改为验证 active empire 下模块 ID 全量“无 `_macro` 后缀”。
  - 最新结果：最新回归通过。

- [✓] 4.1 BUG-001: 导入旧版本 JSON 后 Empire 版本未升级
  - 首次失败：`bugfix` 路由用例中偶发拿不到 `storage-import-file-input`（导入弹窗未稳定打开）。
  - 收敛方式：`bug/bugfix` 统一接入稳态导入 helper。
  - 最新结果：`bug` 与 `bugfix` 双文件回归通过。
