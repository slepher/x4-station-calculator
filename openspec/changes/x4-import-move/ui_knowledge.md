# x4-import-move UI 知识

## 导入入口结构

### StationToolbar（存档导入导出）
- 导入入口按钮：`toolbar-import-btn`
- 导入向导根节点：`storage-import-wizard`
- 导入文件输入：`storage-import-file-input`
- 解析配置区：`storage-import-config`
- 模块项：
  - `storage-import-module-x4_empire_data`
  - `storage-import-module-x4_logic_flow_plans`
  - `storage-import-module-x4_ship_blueprints`
- 导出向导根节点：`storage-export-wizard`

### ContextToolbar（业务导入）
- 统一导入 modal 根节点：`import-view-modal`
- 3-tab 切换容器：`top-view-switch-import-view`
- 3-tab 按钮：
  - `top-view-btn-import-view-logic-flow`
  - `top-view-btn-import-view-game-blueprint`
  - `top-view-btn-import-view-x4-station`

## logic-flow 导入定位

- ContextToolbar 入口：
  - 站点页：`logicflow-import-entry-station`
  - 帝国总览：`logicflow-import-entry-empire`
- 内嵌主体：`logicflow-import-body`
- 站点模式组列表：`logicflow-import-group-list`
- 帝国模式方案列表：`logicflow-import-plan-list`
- 兼容壳层旧弹窗 testid（本变更不应显示）：`logicflow-import-modal`

## 游戏蓝图导入定位

- 上传触发区域：`import-blueprint-file-upload`
- 解析摘要区域：`import-blueprint-summary`
- 模块总数字段：`import-blueprint-module-count`
- 非空站点导入策略弹窗：`blueprint-import-strategy-modal`
- 策略按钮：
  - 覆盖：`blueprint-strategy-overwrite`
  - 添加：`blueprint-strategy-add`
  - 新空间站：`blueprint-strategy-new`

## x4-station 导入定位

- 输入框：`import-x4-station-input`
- 导入按钮：`import-view-action-import`
- 错误提示（失败时）：`importView.x4_station_failed` 文案节点
- 仅接受 x4-game 分享串（示例：`l=@$module-prod_gen_energycells_macro,count:1`）

## 顶部视图切换定位

- 通用切换容器：`top-view-switch`
- 视图按钮：
  - `top-view-btn-production`
  - `top-view-btn-flow`
  - `top-view-btn-ship-build`

## 任务到定位器映射

- `1.1` -> `top-view-switch` / `top-view-btn-flow` / `top-view-btn-ship-build`
- `1.2` -> `top-view-switch-import-view` + 三个 `top-view-btn-import-view-*`
- `1.3` -> `logicflow-import-body`（检查 `data-mode` 透传）
- `1.4` -> `import-x4-station-input` + `import-view-action-import`
- `3.1` -> `toolbar-import-btn` + `storage-import-wizard` + `storage-import-file-input` + `storage-import-module-*` + `storage-import-mode-overwrite` + `storage-import-mode-incremental`
- `3.2` -> `logicflow-import-entry-station` / `logicflow-import-entry-empire`
- `3.3` -> `logicflow-import-entry-station` + `top-view-btn-import-view-game-blueprint` + `import-blueprint-file-upload` / `import-blueprint-module-count` / `blueprint-import-strategy-modal`
- `3.4` -> `import-x4-station-input` + `import-view-action-import`
  - 导入后状态校验读取 `window.empireStore.activeEmpire.stations` 最后一项：`modules.length` / `type` / `count` / `name`


# 测试运行

- [✓] 3.1 Case: StationToolbar Import 打开 storage-import 向导
  - 最新结果：`npm run build && pnpm exec playwright test tests/e2e/x4-import-move/x4-import-move.spec.ts`（2026-03-04）通过。
  - 结论更新：`storage-import-module-*` 与 `storage-import-mode-*` 在上传并解析合法 JSON 后才渲染，不能在仅打开向导时直接断言。

- [✓] 3.3 Case: 游戏蓝图上传后展示模块数且在非空站点弹策略弹窗
  - 最新结果：`npm run build && pnpm exec playwright test tests/e2e/x4-import-move/x4-import-move.spec.ts`（2026-03-04）通过。
  - 结论更新：业务导入入口归属 `ContextToolbar`；站点页应通过 `logicflow-import-entry-station` 进入 `import-view-modal`，再切换到 `game-blueprint` tab。

- [✓] 3.4 Case: x4-station 在帝国总览导入时新建默认命名空间站
  - 最新结果：`npm run build && pnpm exec playwright test tests/e2e/x4-import-move/x4-import-move.spec.ts`（2026-03-04）通过。
  - 结论更新：`.overview-tab` 点击在并发下存在偶发未切换问题；测试需在点击后确认 `window.empireStore.activeStationId === null` 再定位 `logicflow-import-entry-empire`。
