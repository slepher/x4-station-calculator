# x4-import-move UI 知识

## 导入视图结构

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
- `3.1` -> `import-view-modal` + `logicflow-import-body` + `logicflow-import-modal`
- `3.2` -> `logicflow-import-entry-station` / `logicflow-import-entry-empire`
- `3.3` -> `import-blueprint-file-upload` / `import-blueprint-module-count` / `blueprint-import-strategy-modal`
- `3.4` -> `import-x4-station-input` + `import-view-action-import`
  - 导入后状态校验读取 `window.empireStore.activeEmpire.stations` 最后一项：`modules.length` / `type` / `count` / `name`


# 测试运行

- [✓] 3.4 Case: x4-station 在帝国总览导入时新建默认命名空间站
  - 最新结果：`pnpm exec playwright test tests/e2e/x4-import-move/x4-import-move.spec.ts --grep "3.4 Case"`（2026-03-04）通过。
  - 结论更新：此前 `SyntaxError: 10` 与预览产物未重建相关，先执行 `npm run build` 后可稳定通过。
