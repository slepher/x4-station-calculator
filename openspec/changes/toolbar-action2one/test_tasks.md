# Test Tasks: toolbar-action2one

## 1 单元测试

- [ ] 1.1 station 模组三按钮语义矩阵
  - [ ] 1.1.1 在 `storeType='station'` 且 `isEmptyForSave()=true` 前置下执行 `runAction(action='SAVE')`
  - [ ] 1.1.2 在 `storeType='station'` 且 `isEmptyForSave()=false` 前置下执行 `runAction(action='SAVE_AS')`
  - [ ] 1.1.3 在 `storeType='station'` 且 `isEmptyForSave()=false,isDirty()=true` 前置下执行 `runAction(action='NEW')` 并断言 SmartSave 意图 #期望: ['SAVE blocked on empty', 'SAVE_AS opens smart-save', 'NEW returns open-smart-save']

- [ ] 1.2 logicFlow 模组三按钮语义矩阵
  - [ ] 1.2.1 在 `storeType='logicFlow'` 且 `isEmptyForSave()=true` 前置下执行 `runAction(action='SAVE')`
  - [ ] 1.2.2 在 `storeType='logicFlow'` 且 `isEmptyForSave()=false` 前置下执行 `runAction(action='SAVE_AS')`
  - [ ] 1.2.3 在 `storeType='logicFlow'` 且 `isEmptyForSave()=false,isDirty()=true` 前置下执行 `runAction(action='NEW')` 并断言 SmartSave 意图 #期望: ['SAVE blocked on empty', 'SAVE_AS opens smart-save', 'NEW returns open-smart-save']

- [ ] 1.3 ship-build 模组三按钮语义矩阵
  - [ ] 1.3.1 在 `storeType='ship-build'` 且 `isEmptyForSave()=true` 前置下执行 `runAction(action='SAVE')`
  - [ ] 1.3.2 在 `storeType='ship-build'` 且 `isEmptyForSave()=false` 前置下执行 `runAction(action='SAVE_AS')`
  - [ ] 1.3.3 在 `storeType='ship-build'` 且 `isEmptyForSave()=false,isDirty()=true` 前置下执行 `runAction(action='NEW')` 并断言 SmartSave 意图 #期望: ['SAVE blocked on empty', 'SAVE_AS opens smart-save', 'NEW returns open-smart-save']

- [ ] 1.4 三模组未保存对象 SAVE 分流到 SAVE_AS
  - [ ] 1.4.1 在 `storeType='station'` 且 `requiresSaveAsOnSave()=true` 前置下执行 `runAction(action='SAVE')`
  - [ ] 1.4.2 在 `storeType='logicFlow'` 且 `requiresSaveAsOnSave()=true` 前置下执行 `runAction(action='SAVE')`
  - [ ] 1.4.3 在 `storeType='ship-build'` 且 `requiresSaveAsOnSave()=true` 前置下执行 `runAction(action='SAVE')` 并断言意图一致 #期望: ['station intent=SAVE_AS', 'logicFlow intent=SAVE_AS', 'ship-build intent=SAVE_AS']

- [ ] 1.5 SmartSave 组合动作序列覆盖
  - [ ] 1.5.1 在 `storeType='station'` 前置下执行 `runSmartSaveSteps([SAVE,NEW])`
  - [ ] 1.5.2 在 `storeType='logicFlow'` 前置下执行 `runSmartSaveSteps([SAVE_AS(name),NEW])`
  - [ ] 1.5.3 在 `storeType='ship-build'` 前置下执行 `runSmartSaveSteps([NEW])` 并断言序列 #期望: ['SAVE->NEW', 'SAVE_AS->NEW', 'NEW only']

- [ ] 1.6 默认命名与消息统一策略
  - [ ] 1.6.1 对三模组执行 `getDefaultName` 并读取返回值
  - [ ] 1.6.2 在三模组 `runSmartSaveSteps` 成功保存路径执行后读取 success 消息计数
  - [ ] 1.6.3 在三模组空方案拦截或空名称拦截路径执行后读取 warning 消息计数 #期望: ['default names resolved', 'save success once', 'blocked warning once']

- [ ] 1.7 import 编排与 unsupported 分支
  - [ ] 1.7.1 在 `storeType='station'` 前置下执行 `runImportAction(choice='SAVE_AND_IMPORT')` 并记录调用顺序
  - [ ] 1.7.2 在 `storeType='station'` 前置下执行 `runImportAction(choice='DISCARD_AND_IMPORT')` 并记录调用顺序
  - [ ] 1.7.3 在 `storeType='logicFlow'` 与 `storeType='ship-build'` 前置下执行 `runImportAction` 并读取返回值与 warning #期望: ['station SAVE->NEW->IMPORT_DATA', 'station NEW->IMPORT_DATA', 'unsupported returns ok=false with warning']

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: import-view-modal-open-on-empire
  - [ ] 2.1.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后将 `x4_empire_data.activeStationId` 设为 `null` 并执行 `page.reload`
  - [ ] 2.1.2 在页面右上角通过 UI 语言选择器执行 `zh-CN` 切换
  - [ ] 2.1.3 在总览工具栏对 `data-testid="logicflow-import-entry-empire"` 执行点击
  - [ ] 2.1.4 断言 `data-testid="import-view-modal"` 与 `data-testid="logicflow-import-plan-list"` 同时可见 #期望: ['import-view-modal visible', 'logicflow-import-plan-list visible']

- [ ] 2.2 状态: empire-import-smartsave-open
  - [ ] 2.2.1 在 `import-view-modal-open-on-empire` 前置下通过 `page.evaluate` 对帝国名称追加后缀以构造 dirty
  - [ ] 2.2.2 在 `data-testid="logicflow-import-plan-list"` 内对 `data-testid="logicflow-import-plan-direct-logic-flow-1"` 执行点击
  - [ ] 2.2.3 在 SmartSaveDialog 内定位 `.dialog-input` 与按钮文本 `保存并导入|放弃并导入`
  - [ ] 2.2.4 断言导入确认弹窗显示且两类导入动作按钮可操作 #期望: ['.dialog-input visible', 'save-import button enabled', 'discard-import button enabled']

- [ ] 2.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save
  - [ ] 2.3.1 在 `empire-import-smartsave-open` 前置下定位 SmartSaveDialog 主按钮文本 `保存并导入`
  - [ ] 2.3.2 在 SmartSaveDialog 对主按钮执行点击
  - [ ] 2.3.3 断言 `data-testid="import-view-modal"` 关闭且页面不再出现 SmartSaveDialog #期望: ['import-view-modal hidden', 'smart-save dialog hidden']

- [ ] 2.4 切换: empire-import-smartsave-open -> empire-import-finished-after-discard
  - [ ] 2.4.1 在 `empire-import-smartsave-open` 前置下定位 SmartSaveDialog 次按钮文本 `放弃并导入`
  - [ ] 2.4.2 在 SmartSaveDialog 对次按钮执行点击
  - [ ] 2.4.3 断言 `data-testid="import-view-modal"` 关闭且页面不再出现 SmartSaveDialog #期望: ['import-view-modal hidden', 'smart-save dialog hidden']

## 3 E2E 测试场景

- [ ] 3.1 Case: station-NEW-dirty-new
  - [ ] 3.1.1 在 station 视图构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.1.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.1.3 断言 station/NEW/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [ ] 3.2 Case: station-NEW-dirty-non-new
  - [ ] 3.2.1 在 station 视图构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.2.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.2.3 断言 station/NEW/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [ ] 3.3 Case: station-NEW-non-dirty-new
  - [ ] 3.3.1 在 station 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.3.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.3.3 断言 station/NEW/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [ ] 3.4 Case: station-NEW-non-dirty-non-new
  - [ ] 3.4.1 在 station 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.4.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.4.3 断言 station/NEW/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [ ] 3.5 Case: station-SAVE-dirty-new
  - [ ] 3.5.1 在 station 视图构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.5.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.5.3 断言 station/SAVE/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.6 Case: station-SAVE-dirty-non-new
  - [ ] 3.6.1 在 station 视图构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.6.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.6.3 断言 station/SAVE/dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count +1', '.dialog-input hidden']

- [ ] 3.7 Case: station-SAVE-non-dirty-new
  - [ ] 3.7.1 在 station 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.7.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.7.3 断言 station/SAVE/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.8 Case: station-SAVE-non-dirty-non-new
  - [ ] 3.8.1 在 station 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.8.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.8.3 断言 station/SAVE/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count unchanged', '.dialog-input hidden']

- [ ] 3.9 Case: station-SAVE_AS-dirty-new
  - [ ] 3.9.1 在 station 视图构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.9.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.9.3 断言 station/SAVE_AS/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.10 Case: station-SAVE_AS-dirty-non-new
  - [ ] 3.10.1 在 station 视图构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.10.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.10.3 断言 station/SAVE_AS/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.11 Case: station-SAVE_AS-non-dirty-new
  - [ ] 3.11.1 在 station 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.11.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.11.3 断言 station/SAVE_AS/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.12 Case: station-SAVE_AS-non-dirty-non-new
  - [ ] 3.12.1 在 station 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.12.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.12.3 断言 station/SAVE_AS/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.13 Case: logicFlow-NEW-dirty-new
  - [ ] 3.13.1 在 logicFlow 视图构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.13.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.13.3 断言 logicFlow/NEW/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [ ] 3.14 Case: logicFlow-NEW-dirty-non-new
  - [ ] 3.14.1 在 logicFlow 视图构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.14.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.14.3 断言 logicFlow/NEW/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [ ] 3.15 Case: logicFlow-NEW-non-dirty-new
  - [ ] 3.15.1 在 logicFlow 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.15.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.15.3 断言 logicFlow/NEW/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [ ] 3.16 Case: logicFlow-NEW-non-dirty-non-new
  - [ ] 3.16.1 在 logicFlow 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.16.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.16.3 断言 logicFlow/NEW/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [ ] 3.17 Case: logicFlow-SAVE-dirty-new
  - [ ] 3.17.1 在 logicFlow 视图构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.17.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.17.3 断言 logicFlow/SAVE/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.18 Case: logicFlow-SAVE-dirty-non-new
  - [ ] 3.18.1 在 logicFlow 视图构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.18.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.18.3 断言 logicFlow/SAVE/dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count +1', '.dialog-input hidden']

- [ ] 3.19 Case: logicFlow-SAVE-non-dirty-new
  - [ ] 3.19.1 在 logicFlow 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.19.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.19.3 断言 logicFlow/SAVE/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.20 Case: logicFlow-SAVE-non-dirty-non-new
  - [ ] 3.20.1 在 logicFlow 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.20.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.20.3 断言 logicFlow/SAVE/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count unchanged', '.dialog-input hidden']

- [ ] 3.21 Case: logicFlow-SAVE_AS-dirty-new
  - [ ] 3.21.1 在 logicFlow 视图构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.21.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.21.3 断言 logicFlow/SAVE_AS/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.22 Case: logicFlow-SAVE_AS-dirty-non-new
  - [ ] 3.22.1 在 logicFlow 视图构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.22.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.22.3 断言 logicFlow/SAVE_AS/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.23 Case: logicFlow-SAVE_AS-non-dirty-new
  - [ ] 3.23.1 在 logicFlow 视图构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.23.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.23.3 断言 logicFlow/SAVE_AS/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.24 Case: logicFlow-SAVE_AS-non-dirty-non-new
  - [ ] 3.24.1 在 logicFlow 视图构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.24.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.24.3 断言 logicFlow/SAVE_AS/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.25 Case: ship-build-NEW-dirty-new
  - [ ] 3.25.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.25.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.25.3 断言 ship-build/NEW/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [ ] 3.26 Case: ship-build-NEW-dirty-non-new
  - [ ] 3.26.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.26.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.26.3 断言 ship-build/NEW/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Discard & New|丢弃并新建/) visible']

- [ ] 3.27 Case: ship-build-NEW-non-dirty-new
  - [ ] 3.27.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.27.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.27.3 断言 ship-build/NEW/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [ ] 3.28 Case: ship-build-NEW-non-dirty-non-new
  - [ ] 3.28.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `New|新建` 定位并执行点击
  - [ ] 3.28.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.28.3 断言 ship-build/NEW/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input hidden', 'smart-save dialog hidden']

- [ ] 3.29 Case: ship-build-SAVE-dirty-new
  - [ ] 3.29.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.29.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.29.3 断言 ship-build/SAVE/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.30 Case: ship-build-SAVE-dirty-non-new
  - [ ] 3.30.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.30.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.30.3 断言 ship-build/SAVE/dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count +1', '.dialog-input hidden']

- [ ] 3.31 Case: ship-build-SAVE-non-dirty-new
  - [ ] 3.31.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.31.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.31.3 断言 ship-build/SAVE/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.32 Case: ship-build-SAVE-non-dirty-non-new
  - [ ] 3.32.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save|保存` 定位并执行点击
  - [ ] 3.32.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.32.3 断言 ship-build/SAVE/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['div.fixed.bottom-6.right-6 getByText(/save|保存/i) count unchanged', '.dialog-input hidden']

- [ ] 3.33 Case: ship-build-SAVE_AS-dirty-new
  - [ ] 3.33.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.33.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.33.3 断言 ship-build/SAVE_AS/dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.34 Case: ship-build-SAVE_AS-dirty-non-new
  - [ ] 3.34.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.34.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.34.3 断言 ship-build/SAVE_AS/dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.35 Case: ship-build-SAVE_AS-non-dirty-new
  - [ ] 3.35.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.35.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.35.3 断言 ship-build/SAVE_AS/non-dirty-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.36 Case: ship-build-SAVE_AS-non-dirty-non-new
  - [ ] 3.36.1 在 `/` 页面写入 `tests/fixtures/db.json`（去除 `vsn`）后执行 `page.reload`，通过 UI 设语言为 `zh-CN`，切换到 ship-build 视图并固定目标 ship 为 `武士刀`，构造 non-dirty-non-new 前置，在 `.toolbar-panel` 内按按钮文本 `Save As|另存为` 定位并执行点击
  - [ ] 3.36.2 读取 `.dialog-input`、`button:has-text(/Save|保存|Discard & New|丢弃并新建|Overwrite & New|覆盖并新建|Save As|另存为/)` 与 `div.fixed.bottom-6.right-6 getByText(/save|保存/i)`
  - [ ] 3.36.3 断言 ship-build/SAVE_AS/non-dirty-non-new 路径的可观察结果与预设一致 #期望: ['.dialog-input visible', 'button:has-text(/Save|保存/) visible']

- [ ] 3.37 Case: import-open-empire-entry
  - [ ] 3.37.1 状态: import-view-modal-open-on-empire
  - [ ] 3.37.2 在 `data-testid="logicflow-import-plan-list"` 内对 `data-testid="logicflow-import-plan-direct-logic-flow-1"` 执行点击
  - [ ] 3.37.3 断言导入确认弹窗已打开且动作按钮可见 #期望: ['.dialog-input visible', 'button:has-text(/保存并导入|Save & Import/) visible', 'button:has-text(/放弃并导入|Discard & Import/) visible']

- [ ] 3.38 Case: import-save-path-close-modal
  - [ ] 3.38.1 状态: empire-import-smartsave-open
  - [ ] 3.38.2 在 SmartSaveDialog 对按钮文本 `保存并导入|Save & Import` 执行点击
  - [ ] 3.38.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save
  - [ ] 3.38.4 断言导入弹窗关闭且计划列表不可见 #期望: ['import-view-modal hidden', 'logicflow-import-plan-list hidden']

- [ ] 3.39 Case: import-discard-path-close-modal
  - [ ] 3.39.1 状态: empire-import-smartsave-open
  - [ ] 3.39.2 在 SmartSaveDialog 对按钮文本 `放弃并导入|Discard & Import` 执行点击
  - [ ] 3.39.3 切换: empire-import-smartsave-open -> empire-import-finished-after-discard
  - [ ] 3.39.4 断言导入弹窗关闭且计划列表不可见 #期望: ['import-view-modal hidden', 'logicflow-import-plan-list hidden']

- [ ] 3.40 Case: import-open-and-close-without-submit
  - [ ] 3.40.1 状态: import-view-modal-open-on-empire
  - [ ] 3.40.2 在 `data-testid="import-view-modal"` 内对 `data-testid="import-view-close"` 执行点击
  - [ ] 3.40.3 断言导入主弹窗关闭且 `data-testid="toolbar-import-btn"` 可见且可点击 #期望: ['import-view-modal hidden', 'toolbar-import-btn visible and enabled']

- [ ] 3.41 Case: import-save-path-hide-actions
  - [ ] 3.41.1 状态: empire-import-smartsave-open
  - [ ] 3.41.2 在 SmartSaveDialog 对按钮文本 `保存并导入|Save & Import` 执行点击
  - [ ] 3.41.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save
  - [ ] 3.41.4 断言页面中不再存在 `保存并导入|放弃并导入|Save & Import|Discard & Import` 按钮文本 #期望: ['save-import button hidden', 'discard-import button hidden']

- [ ] 3.42 Case: import-discard-path-hide-actions
  - [ ] 3.42.1 状态: empire-import-smartsave-open
  - [ ] 3.42.2 在 SmartSaveDialog 对按钮文本 `放弃并导入|Discard & Import` 执行点击
  - [ ] 3.42.3 切换: empire-import-smartsave-open -> empire-import-finished-after-discard
  - [ ] 3.42.4 断言页面中不再存在 `保存并导入|放弃并导入|Save & Import|Discard & Import` 按钮文本 #期望: ['save-import button hidden', 'discard-import button hidden']

## 4 Bug 测试
