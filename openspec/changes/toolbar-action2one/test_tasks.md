# Test Tasks: toolbar-action2one

## 1 单元测试

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: import-view-modal-open-on-empire
  - [✓] 2.1.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后将 `x4_empire_data.activeStationId` 设为 `null` 并执行 `page.reload`
  - [✓] 2.1.2 在页面右上角通过 UI 语言选择器执行 `zh-CN` 切换
  - [✓] 2.1.3 在总览工具栏对 `data-testid="logicflow-import-entry-empire"` 执行点击
  - [✓] 2.1.4 断言 `data-testid="import-view-modal"` 与 `data-testid="logicflow-import-plan-list"` 同时可见 #期望: ['import-view-modal visible', 'logicflow-import-plan-list visible']

- [✓] 2.2 状态: empire-import-smartsave-open
  - [✓] 2.2.1 在 `import-view-modal-open-on-empire` 前置下通过 `page.evaluate` 对帝国名称追加后缀以构造 dirty
  - [✓] 2.2.2 在 `data-testid="logicflow-import-plan-list"` 内对 `data-testid="logicflow-import-plan-direct-logic-flow-1"` 执行点击
  - [✓] 2.2.3 在 `data-testid="import-view-modal"` 内定位 `h3` 标题与按钮文本 `保存并导入|Save and Import`、`放弃并导入|Discard and Import`
  - [✓] 2.2.4 断言导入确认弹窗显示且两类导入动作按钮可操作 #期望: ['import smart-save title visible', 'save-and-import button enabled', 'discard-and-import button enabled']

- [✗] 2.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save
  - [✓] 2.3.1 在 `empire-import-smartsave-open` 前置下定位 `data-testid="import-view-modal"` 内按钮文本 `保存并导入|Save and Import`
  - [✓] 2.3.2 在当前弹窗作用域先断言 `h3` 标题可见，再对按钮文本 `保存并导入|Save and Import` 执行点击
  - [✗] 2.3.3 断言 `data-testid="import-view-modal"` 关闭且页面不再出现 `保存并导入|放弃并导入` 动作按钮 #期望: ['import-view-modal hidden', 'save-and-import button hidden', 'discard-and-import button hidden']

- [✗] 2.4 切换: empire-import-smartsave-open -> empire-import-finished-after-discard
  - [✓] 2.4.1 在 `empire-import-smartsave-open` 前置下定位 `data-testid="import-view-modal"` 内按钮文本 `放弃并导入|Discard and Import`
  - [✓] 2.4.2 在当前弹窗作用域先断言 `h3` 标题可见，再对按钮文本 `放弃并导入|Discard and Import` 执行点击
  - [✗] 2.4.3 断言 `data-testid="import-view-modal"` 关闭且页面不再出现 `保存并导入|放弃并导入` 动作按钮 #期望: ['import-view-modal hidden', 'save-and-import button hidden', 'discard-and-import button hidden']

## 3 E2E 测试场景

- [✓] 3.1 Case: station-NEW-dirty-new
  - [✓] 3.1.1 在 station 视图添加模块到用户规划区使 dirty，点击 NEW 按钮
  - [✓] 3.1.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.1.3 断言 station/NEW/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [✓] 3.2 Case: station-NEW-dirty-non-new
  - [✓] 3.2.1 在 station 视图添加模块到用户规划区使 dirty，点击 NEW 按钮
  - [✓] 3.2.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.2.3 断言 station/NEW/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [✓] 3.3 Case: station-NEW-non-dirty-new
  - [✓] 3.3.1 在 station 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.3.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.3.3 断言 station/NEW/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [✓] 3.4 Case: station-NEW-non-dirty-non-new
  - [✓] 3.4.1 在 station 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.4.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.4.3 断言 station/NEW/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [✗] 3.5 Case: station-SAVE-dirty-new
  - [✓] 3.5.1 在 station 视图添加模块到用户规划区使 dirty，点击 SAVE 按钮
  - [✓] 3.5.2 在当前保存确认弹窗内读取标题 `h3[/保存更改|保存新方案|Save/i]` 与按钮文本 `保存|Save`、`丢弃并新建|Discard & New`
  - [✗] 3.5.3 断言 station/SAVE/dirty-new 路径的可观察结果与预设一致 #期望: ['smart-save title visible', 'save button visible', 'discard-and-new button visible']

- [✗] 3.6 Case: station-SAVE-dirty-non-new
  - [✓] 3.6.1 在 station 视图添加模块到用户规划区使 dirty，点击 SAVE 按钮
  - [✓] 3.6.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.6.3 断言 station/SAVE/dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count +1', '.dialog-input hidden']

- [✗] 3.7 Case: station-SAVE-non-dirty-new
  - [✓] 3.7.1 在 station 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.7.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.7.3 断言 station/SAVE/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✗] 3.8 Case: station-SAVE-non-dirty-non-new
  - [✓] 3.8.1 在 station 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.8.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.8.3 断言 station/SAVE/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count unchanged', '.dialog-input hidden']

- [✓] 3.9 Case: station-SAVE_AS-dirty-new
  - [✓] 3.9.1 在 station 视图添加模块到用户规划区使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.9.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.9.3 断言 station/SAVE_AS/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.10 Case: station-SAVE_AS-dirty-non-new
  - [✓] 3.10.1 在 station 视图添加模块到用户规划区使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.10.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.10.3 断言 station/SAVE_AS/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.11 Case: station-SAVE_AS-non-dirty-new
  - [✓] 3.11.1 在 station 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.11.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.11.3 断言 station/SAVE_AS/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.12 Case: station-SAVE_AS-non-dirty-non-new
  - [✓] 3.12.1 在 station 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.12.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.12.3 断言 station/SAVE_AS/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.13 Case: logicFlow-NEW-dirty-new
  - [✓] 3.13.1 在 logicFlow 视图添加产线使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.13.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.13.3 断言 logicFlow/NEW/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [✓] 3.14 Case: logicFlow-NEW-dirty-non-new
  - [✓] 3.14.1 在 logicFlow 视图添加产线使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.14.2 在当前保存确认弹窗内读取标题 `h3[/保存更改|保存新方案|Save/i]` 与按钮文本 `丢弃并新建|Discard & New`、`保存|Save`
  - [✓] 3.14.3 断言 logicFlow/NEW/dirty-non-new 路径的可观察结果与预设一致 #期望: ['smart-save title visible', 'discard-and-new button visible', 'save button visible']

- [✓] 3.15 Case: logicFlow-NEW-non-dirty-new
  - [✓] 3.15.1 在 logicFlow 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.15.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.15.3 断言 logicFlow/NEW/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [✓] 3.16 Case: logicFlow-NEW-non-dirty-non-new
  - [✓] 3.16.1 在 logicFlow 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.16.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.16.3 断言 logicFlow/NEW/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [✓] 3.17 Case: logicFlow-SAVE-dirty-new
  - [✓] 3.17.1 在 logicFlow 视图添加产线使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.17.2 在当前保存确认弹窗内读取标题 `h3[/保存更改|保存新方案|Save/i]` 与按钮文本 `保存|Save`
  - [✓] 3.17.3 断言 logicFlow/SAVE/dirty-new 路径的可观察结果与预设一致 #期望: ['smart-save title visible', 'save button visible']

- [✓] 3.18 Case: logicFlow-SAVE-dirty-non-new
  - [✓] 3.18.1 在 logicFlow 视图添加产线使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.18.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.18.3 断言 logicFlow/SAVE/dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count +1', '.dialog-input hidden']

- [✓] 3.19 Case: logicFlow-SAVE-non-dirty-new
  - [✓] 3.19.1 在 logicFlow 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.19.2 在当前保存确认弹窗内读取标题 `h3[/保存更改|保存新方案|Save/i]` 与按钮文本 `保存|Save`
  - [✓] 3.19.3 断言 logicFlow/SAVE/non-dirty-new 路径的可观察结果与预设一致 #期望: ['smart-save title visible', 'save button visible']

- [✓] 3.20 Case: logicFlow-SAVE-non-dirty-non-new
  - [✓] 3.20.1 在 logicFlow 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.20.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.20.3 断言 logicFlow/SAVE/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count unchanged', '.dialog-input hidden']

- [✓] 3.21 Case: logicFlow-SAVE_AS-dirty-new
  - [✓] 3.21.1 在 logicFlow 视图添加产线使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.21.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.21.3 断言 logicFlow/SAVE_AS/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.22 Case: logicFlow-SAVE_AS-dirty-non-new
  - [✓] 3.22.1 在 logicFlow 视图添加产线使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.22.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.22.3 断言 logicFlow/SAVE_AS/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.23 Case: logicFlow-SAVE_AS-non-dirty-new
  - [✓] 3.23.1 在 logicFlow 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.23.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.23.3 断言 logicFlow/SAVE_AS/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.24 Case: logicFlow-SAVE_AS-non-dirty-non-new
  - [✓] 3.24.1 在 logicFlow 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.24.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.24.3 断言 logicFlow/SAVE_AS/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✗] 3.25 Case: ship-build-NEW-dirty-new
  - [✓] 3.25.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，修改蓝图使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.25.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.25.3 断言 ship-build/NEW/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [✗] 3.26 Case: ship-build-NEW-dirty-non-new
  - [✓] 3.26.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，修改蓝图使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.26.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.26.3 断言 ship-build/NEW/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [✓] 3.27 Case: ship-build-NEW-non-dirty-new
  - [✓] 3.27.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.27.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.27.3 断言 ship-build/NEW/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [✓] 3.28 Case: ship-build-NEW-non-dirty-non-new
  - [✓] 3.28.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-new-btn"` 执行点击
  - [✓] 3.28.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.28.3 断言 ship-build/NEW/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [✗] 3.29 Case: ship-build-SAVE-dirty-new
  - [✓] 3.29.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，修改蓝图使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.29.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.29.3 断言 ship-build/SAVE/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✗] 3.30 Case: ship-build-SAVE-dirty-non-new
  - [✓] 3.30.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，修改蓝图使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.30.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.30.3 断言 ship-build/SAVE/dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count +1', '.dialog-input hidden']

- [✗] 3.31 Case: ship-build-SAVE-non-dirty-new
  - [✓] 3.31.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.31.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.31.3 断言 ship-build/SAVE/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.32 Case: ship-build-SAVE-non-dirty-non-new
  - [✓] 3.32.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-btn"` 执行点击
  - [✓] 3.32.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.32.3 断言 ship-build/SAVE/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count unchanged', '.dialog-input hidden']

- [✗] 3.33 Case: ship-build-SAVE_AS-dirty-new
  - [✓] 3.33.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，修改蓝图使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.33.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.33.3 断言 ship-build/SAVE_AS/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✗] 3.34 Case: ship-build-SAVE_AS-dirty-non-new
  - [✓] 3.34.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，修改蓝图使 dirty，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.34.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✗] 3.34.3 断言 ship-build/SAVE_AS/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.35 Case: ship-build-SAVE_AS-non-dirty-new
  - [✓] 3.35.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.35.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.35.3 断言 ship-build/SAVE_AS/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✓] 3.36 Case: ship-build-SAVE_AS-non-dirty-non-new
  - [✓] 3.36.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内对 `data-testid="toolbar-save-as-btn"` 执行点击
  - [✓] 3.36.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [✓] 3.36.3 断言 ship-build/SAVE_AS/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [✗] 3.37 Case: import-open-empire-entry
  - [✓] 3.37.1 状态: import-view-modal-open-on-empire
  - [✓] 3.37.2 在 `data-testid="logicflow-import-plan-list"` 内对 `data-testid="logicflow-import-plan-direct-logic-flow-1"` 执行点击
  - [✗] 3.37.3 断言导入确认弹窗已打开且动作按钮可见 #期望: ['import smart-save title visible', 'button:has-text(/保存并导入|Save and Import/) visible', 'button:has-text(/放弃并导入|Discard and Import/) visible']

- [✗] 3.38 Case: import-save-path-close-modal
  - [✓] 3.38.1 状态: empire-import-smartsave-open
  - [✓] 3.38.2 在 `data-testid="import-view-modal"` 内对按钮文本 `保存并导入|Save and Import` 执行点击
  - [✓] 3.38.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save
  - [✗] 3.38.4 断言导入弹窗关闭且计划列表不可见 #期望: ['import-view-modal hidden', 'logicflow-import-plan-list hidden']

- [✗] 3.39 Case: import-discard-path-close-modal
  - [✓] 3.39.1 状态: empire-import-smartsave-open
  - [✓] 3.39.2 在 `data-testid="import-view-modal"` 内对按钮文本 `放弃并导入|Discard and Import` 执行点击
  - [✓] 3.39.3 切换: empire-import-smartsave-open -> empire-import-finished-after-discard
  - [✗] 3.39.4 断言导入弹窗关闭且计划列表不可见 #期望: ['import-view-modal hidden', 'logicflow-import-plan-list hidden']

- [✓] 3.40 Case: import-open-and-close-without-submit
  - [✓] 3.40.1 状态: import-view-modal-open-on-empire
  - [✓] 3.40.2 在 `data-testid="import-view-modal"` 内对 `data-testid="import-view-close"` 执行点击
  - [✓] 3.40.3 断言导入主弹窗关闭且 `data-testid="toolbar-import-btn"` 可见且可点击 #期望: ['import-view-modal hidden', 'toolbar-import-btn visible and enabled']

- [✗] 3.41 Case: import-save-path-hide-actions
  - [✓] 3.41.1 状态: empire-import-smartsave-open
  - [✓] 3.41.2 在当前弹窗作用域先断言 `h3` 标题可见，再对按钮文本 `保存并导入|Save and Import` 执行点击
  - [✓] 3.41.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save
  - [✗] 3.41.4 断言页面中不再存在 `保存并导入|放弃并导入|Save and Import|Discard and Import` 按钮文本 #期望: ['save-import button hidden', 'discard-import button hidden']

- [✗] 3.42 Case: import-discard-path-hide-actions
  - [✓] 3.42.1 状态: empire-import-smartsave-open
  - [✓] 3.42.2 在当前弹窗作用域先断言 `h3` 标题可见，再对按钮文本 `放弃并导入|Discard and Import` 执行点击
  - [✓] 3.42.3 切换: empire-import-smartsave-open -> empire-import-finished-after-discard
  - [✗] 3.42.4 断言页面中不再存在 `保存并导入|放弃并导入|Save and Import|Discard and Import` 按钮文本 #期望: ['save-import button hidden', 'discard-import button hidden']

## 4 Bug 测试
