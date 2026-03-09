# Test Tasks: abandon-selected-ship

## 1 单元测试

- [ ] 1.1 Store：New 后保持蓝图上下文与脏状态基线
  - [ ] 1.1.1 在 `useShipBuildStore` 中对 `shipId='ship_ter_m_corvette_02_a'` 依次执行 `setSelectedShipId`、`setEquipment`、`saveBlueprint`，再执行一次 `setEquipment` 构造脏状态
  - [ ] 1.1.2 在脏状态下对 store 执行 `clearLoadoutForCurrentShip`，并读取 `blueprint`、`blueprint.shipId`、`blueprint.connections`、`isDirty`
  - [ ] 1.1.3 断言 New 后 `blueprint` 非空、`shipId` 保留且 `isDirty=false` #期望: [true, 'ship_ter_m_corvette_02_a', [], false]

- [ ] 1.2 Toolbar 可达性：未选 ship 不可达，已选 ship 可达
  - [ ] 1.2.1 在 `ship-build` 视图下将 `selectedShipId` 置空后渲染 `StationToolbar`，读取 `New|Save|Save As|Load` 四个按钮的 `disabled`
  - [ ] 1.2.2 在 `ship-build` 视图下设置 `selectedShipId='ship_ter_m_corvette_02_a'` 并保证 `isEditableFor('ship-build')=false` 后渲染 `StationToolbar`，读取同一组按钮的 `disabled`
  - [ ] 1.2.3 断言未选 ship 时四个按钮均不可达，已选 ship 时四个按钮均可达 #期望: ['no-ship:all-disabled', 'has-ship:all-enabled']

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: ship-build-selected-ship-dirty
  - [ ] 2.1.1 在 `/` 页面按顺序执行：写入 `tests/fixtures/db.json`（去除 `vsn`）到 `localStorage`、`page.reload()`、通过 UI 语言选择器切换 `zh-CN`
  - [ ] 2.1.2 在 ship selector 按顺序执行：点击 `data-testid="ship-build-filter-class-btn-ship_m"`、点击 `data-testid="ship-build-filter-race-btn-terran"`、点击包含 `Odachi|大太刀` 的 `.list-item`、点击 `data-testid="ship-build-confirm-ship"`
  - [ ] 2.1.3 在 `data-testid="ship-build-panel-fit"` 内执行一次配装修改：点击 `data-testid="slot-type-engine"` 后点击首个 `data-testid^="slot-ship_ter_m_corvette_02_a::engine::"` 槽位，在 `data-testid="equipment-picker"` 内选择非空候选并点击 `data-testid="picker-confirm"`，构造 dirty 状态
  - [ ] 2.1.4 点击工具栏 `New|新建`，断言出现 SmartSaveDialog 且可见按钮 `丢弃并新建|Discard & New` #期望: ['smart-save-dialog visible', 'discard-and-new visible']

- [ ] 2.2 切换: ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship
  - [ ] 2.2.1 在 `ship-build-selected-ship-dirty` 状态下对 SmartSaveDialog 的 `丢弃并新建|Discard & New` 执行点击
  - [ ] 2.2.2 在 ship-build workspace 读取 `data-testid="ship-build-panel-fit"`、`data-testid="ship-build-panel-materials"` 与 `data-testid="ship-build-material-ship-group"`
  - [ ] 2.2.3 断言切换后返回 workspace、对话框关闭且船体材料分组可见 #期望: ['workspace-visible', 'dialog-hidden', 'ship-build-material-ship-group visible']

## 3 E2E 测试场景

- [ ] 3.1 Case: 选船后修改并执行 New-Discard&New 后同 ship 且船体材料分组可见
  - [ ] 3.1.1 状态: ship-build-selected-ship-dirty
  - [ ] 3.1.2 在 `ship-build-selected-ship-dirty` 状态下读取 SmartSaveDialog 次按钮文案，断言包含 `丢弃并新建|Discard & New` #期望: ['discard-and-new text matched']
  - [ ] 3.1.3 在 SmartSaveDialog 对 `丢弃并新建|Discard & New` 执行点击，等待对话框关闭 #期望: ['dialog-hidden']
  - [ ] 3.1.4 切换: ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship
  - [ ] 3.1.5 在 `data-testid="ship-build-material-ship-group"` 读取主行文本，断言包含 `Odachi|大太刀` 且该主行可见 #期望: ['ship-group contains Odachi', 'ship-group visible']

## 4 Bug 测试

- [ ] 4.1 BUG-001: New 后材料船体分组未展示
  - [ ] 4.1.1 在 `ship-build-selected-ship-dirty` 前置下执行 `New -> 丢弃并新建` 操作链，复现船体材料分组缺失路径
  - [ ] 4.1.2 状态: ship-build-selected-ship-dirty
  - [ ] 4.1.3 在 SmartSaveDialog 对 `丢弃并新建|Discard & New` 执行点击并返回 ship-build workspace
  - [ ] 4.1.4 修复前断言 `data-testid="ship-build-material-ship-group"` 不可见 #期望: [false]
  - [ ] 4.1.5 修复后断言 `data-testid="ship-build-material-ship-group"` 可见且文本包含 `Odachi|大太刀` #期望: [true, 'Odachi-or-大太刀']
  - [ ] 4.1.6 切换: ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship
  - [ ] 4.1.7 在 workspace 读取 `data-testid="ship-build-panel-fit"` 与 `data-testid="ship-build-panel-materials"`，断言两个面板均可见 #期望: ['fit-visible', 'materials-visible']
