# Test Tasks: ship-level-blueprint

## 1 单元测试

- [✓] 1.1 ship blueprint v1 flat 输入迁移为 v2 ship-level 并回写激活态
  - [✓] 1.1.1 在 `tests/unit/vsn2one/vsn2one.spec.ts` 对 `migrateShipBlueprintStateToCurrent` 注入 `version=1 + list[]` 输入并执行迁移
  - [✓] 1.1.2 在迁移结果读取 `version`、`activeShipId`、`activeBlueprintId`、`ships[].blueprints[]`
  - [✓] 1.1.3 断言输出结构为 `version=2 + ships[]` 且激活 id 落在有效 bucket 中 #期望: [2, 'active ids mapped to ship bucket']

- [✓] 1.2 useShipBuildStore 启动时统一走 migration 并落盘当前版本
  - [✓] 1.2.1 在 `localStorage.x4_ship_blueprints` 写入 `version=1` 历史结构后创建 `useShipBuildStore`
  - [✓] 1.2.2 在 store 读取 `savedBlueprints.version` 与 `savedBlueprints.ships`，并读取回写后的 `localStorage.x4_ship_blueprints`
  - [✓] 1.2.3 断言内存与落盘均为 `version=2` 且不存在顶层 `list` 字段 #期望: [2, 'list absent in persisted state']

- [✓] 1.3 buildExportPayload 对 ship blueprint 仅输出当前版本结构
  - [✓] 1.3.1 在 `tests/unit/import-export/import-export.spec.ts` 调用 `buildExportPayload` 并传入历史 ship blueprint 输入
  - [✓] 1.3.2 在导出结果读取 `data.x4_ship_blueprints.version` 与 ship blueprint 顶层键
  - [✓] 1.3.3 断言导出 ship blueprint 为 `version=2` 且包含 `ships` 不包含 `list` #期望: [2, 'ships', 'list absent']

- [✓] 1.4 applyImportPayload 导入历史 ship blueprint 时复用统一迁移入口
  - [✓] 1.4.1 在 `tests/unit/import-export/import-export.spec.ts` 以 `overwrite` 模式输入 `x4_ship_blueprints.version=1 + list[]`
  - [✓] 1.4.2 在导入后读取 `localStorage.x4_ship_blueprints` 与 `shipBuildStore.loadBlueprintsFromStorage` 调用次数
  - [✓] 1.4.3 断言导入落盘为 `version=2 + ships[]` 且 store 重新加载入口被调用一次 #期望: [2, 'loadBlueprintsFromStorage called once']

- [✓] 1.5 ship-level bucket CRUD 在 store 内保持 ship 归属
  - [✓] 1.5.1 在 `useShipBuildStore` 选择 `ship_ter_m_corvette_02_a` 后执行 `saveBlueprint` 与 `saveAsBlueprint('Odachi Copy')`
  - [✓] 1.5.2 在 `savedBlueprints.ships` 中读取 `ship_ter_m_corvette_02_a` 对应 bucket 的 `blueprints` 列表
  - [✓] 1.5.3 断言新增蓝图仅写入当前 ship bucket 且 `activeShipId` 等于当前 ship id #期望: ['bucket ship_ter_m_corvette_02_a only', 'activeShipId=ship_ter_m_corvette_02_a']

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: ship-toolbar-no-selected-ship
  - [✓] 2.1.1 在 `/` 页面完成 fixture/reload/语言前置后，点击 `[data-testid="top-view-btn-ship-build"]` 进入 Ship Build 视图
  - [✓] 2.1.2 在 `[data-testid="ship-build-filters"]` 中对 `[data-testid="ship-build-cancel-ship-change"]` 执行 `click({ force: true })`，并等待 `[data-testid="ship-build-panels"]` 不可见
  - [✓] 2.1.3 在 `.toolbar-panel` 作用域内使用 `getByRole('button', { name: /New|新建/i })`、`/Save|保存/i`、`/Save As|另存为/i`、`/Load|载入/i` 定位四按钮并读取 `disabled` 属性
  - [✓] 2.1.4 断言四按钮均为禁用态且页面不存在 `Load Ship Blueprint|载入蓝图` 弹窗标题 #期望: ['new disabled', 'save disabled', 'save-as disabled', 'load disabled', 'load modal title hidden']

- [✓] 2.2 状态: ship-toolbar-selected-ship-and-dirty
  - [✓] 2.2.1 在 `[data-testid="ship-build-filters"]` 内先点击 `[data-testid="ship-build-filter-class-btn-ship_m"]` 与 `[data-testid="ship-build-filter-race-btn-terran"]`，再在 `[data-testid="ship-build-list-column"]` 内定位唯一 `getByTestId('ship-build-ship-name').filter({ hasText: /Odachi|大太刀/i }).first()` 并点击，最后点击 `[data-testid="ship-build-confirm-ship"]`
  - [✓] 2.2.2 在 `[data-testid="ship-build-panel-fit"]` 中点击 `[data-testid="slot-type-engine"]`，再点击首个 `[data-testid^="slot-"]` 槽位行，定位 `[data-testid="equipment-picker"]` 后点击首个 `[data-testid^="candidate-"]` 候选并点击 `[data-testid="picker-confirm"]`
  - [✓] 2.2.3 在 `.toolbar-panel` 对 `New|新建` 执行点击并定位 SmartSaveDialog 的 `.dialog-input` 与 `Discard & New|丢弃并新建` 动作按钮，然后点击 `Discard & New|丢弃并新建` 关闭弹窗
  - [✓] 2.2.4 断言 SmartSaveDialog 在点击 `New|新建` 后可见且执行 `Discard & New|丢弃并新建` 后回到 Ship Build 页面 #期望: ['.dialog-input visible after New click', 'discard action visible', 'dialog closed']

- [✓] 2.3 切换: ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean
  - [✓] 2.3.1 在 `ship-toolbar-selected-ship-and-dirty` 前置下，对 `.toolbar-panel` 内 `Save|保存` 按钮执行首次点击
  - [✓] 2.3.2 在右下通知区域定位新增 `save|保存` 成功消息并记录其出现次数
  - [✓] 2.3.3 在同一页面对 `Save|保存` 按钮立即执行第二次点击，等待短超时后再次统计 `save|保存` 成功消息出现次数
  - [✓] 2.3.4 断言第二次点击未新增 `save|保存` 成功消息，且 `Load|载入` 按钮保持可点击 #期望: ['save success toast count unchanged on second click', 'load enabled']

## 3 E2E 测试场景

- [✓] 3.1 Case: 未选 ship 时四按钮保持禁用
  - [✓] 3.1.1 状态: ship-toolbar-no-selected-ship
  - [✓] 3.1.2 在 toolbar 对 `New|新建`、`Save|保存`、`Save As|另存为`、`Load|载入` 逐个执行点击尝试并记录按钮 disabled 状态
  - [✓] 3.1.3 在当前页面断言四个按钮点击后仍不可触发对应流程 #期望: ['all four buttons remain disabled']

- [✓] 3.2 Case: 选中 ship 后保存会清理 dirty 并写入当前 ship 激活态
  - [✓] 3.2.1 状态: ship-toolbar-selected-ship-and-dirty
  - [✓] 3.2.2 切换: ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean
  - [✓] 3.2.3 在 `.toolbar-panel` 断言 `Load|载入` 为可点击，且 `[data-testid="ship-build-panels"]` 仍可见 #期望: ['load enabled', 'ship-build panels visible']

- [✓] 3.3 Case: dirty 场景点击新建会弹 SmartSaveDialog
  - [✓] 3.3.1 状态: ship-toolbar-selected-ship-and-dirty
  - [✓] 3.3.2 在 `.toolbar-panel` 对 `New|新建` 执行点击并定位 `.dialog-input`、`Discard & New|丢弃并新建`、`Save|保存` 三个弹窗元素
  - [✓] 3.3.3 在弹窗断言命名输入框与主次动作入口可见，然后点击 `Discard & New|丢弃并新建` 使弹窗关闭 #期望: ['.dialog-input visible', 'discard-and-new action visible', 'save action visible', 'dialog closed']

- [✓] 3.4 Case: 载入弹窗仅展示当前 ship 的 blueprint 列表
  - [✓] 3.4.1 切换: ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean
  - [✓] 3.4.2 在 `.toolbar-panel` 对 `Load|载入` 执行点击并在 `Load Ship Blueprint|载入蓝图` 弹窗读取 `.blueprint-item` 文本集合
  - [✓] 3.4.3 在弹窗断言列表仅包含 `/Odachi|大太刀/i`，且不包含 `/Katana|武士刀/i` 与 `/Osaka|大阪/i` #期望: ['contains Odachi|大太刀', 'not contains Katana|武士刀', 'not contains Osaka|大阪']

## 4 Bug 测试

- [✓] 4.1 BUG-001: 未选 ship 时强制点击载入按钮仍可能出现载入弹窗
  - [✓] 4.1.1 状态: ship-toolbar-no-selected-ship
  - [✓] 4.1.2 在 `.toolbar-panel` 对 `Load|载入` 执行 `click({ force: true })` 并统计 `Load Ship Blueprint|载入蓝图` 标题与 `.blueprint-item` 数量
  - [✓] 4.1.3 修复前：在当前页面断言可见 `Load Ship Blueprint|载入蓝图` 弹窗标题 #期望: ['load modal title visible unexpectedly']
  - [✓] 4.1.3 修复后：在当前页面断言不可见载入弹窗标题且 `.blueprint-item` 数量保持 `0` #期望: ['load modal hidden', 0]
  - [✓] 4.1.4 在 `.toolbar-panel` 断言 `Load|载入` 按钮仍为 disabled #期望: [true]
