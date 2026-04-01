# Test Tasks: Game Version Switch

## 1 单元测试

- [✓] 1.1 版本管理逻辑测试
  - [✓] 1.1.1 对 `useGameDataStore.getStorageKey('empire')` 执行调用，在 8.0 stable 版本下断言返回值等于 `'x4_empire_data'` #期望: ['x4_empire_data']
  - [✓] 1.1.2 对 `useGameDataStore.getStorageKey('logic_flow')` 执行调用，在 9.0 beta 版本下断言返回值等于 `'x4_logic_flow_plans_v9_beta'` #期望: ['x4_logic_flow_plans_v9_beta']
  - [✓] 1.1.3 对 `useGameDataStore.getStorageKey('ship_blueprints')` 执行调用，在 8.0 stable 版本下断言返回值等于 `'x4_ship_blueprints'` #期望: ['x4_ship_blueprints']
  - [✓] 1.1.4 对 localStorage 预写入非法版本 `{ version: '9.0', beta: false }`，执行 `initialize()` 后断言 `currentVersion` 回退到 `'8.0'` #期望: ['8.0']

- [✓] 1.2 版本显示格式测试
  - [✓] 1.2.1 对 `displayVersion('9.0', true, 'Empire')` 执行调用，断言返回值等于 `'9.0-Empire-beta'` #期望: ['9.0-Empire-beta']
  - [✓] 1.2.2 对 `displayFullVersion('9.0', true)` 执行调用，断言返回值等于 `'9.0-beta'` #期望: ['9.0-beta']
  - [✓] 1.2.3 对 `displayFullVersion('8.0', false)` 执行调用，断言返回值等于 `'8.0'` #期望: ['8.0']
  - [✓] 1.2.4 对 `versionOptions` 数组的 `label` 字段执行遍历，断言等于 `['8.0-Diplomacy', '9.0-Empire-beta']` #期望: ['8.0-Diplomacy', '9.0-Empire-beta']

- [✓] 1.3 VersionSettingsModal 未保存模块流程测试（已实现）
  - [✓] 1.3.1 对弹窗组件在存在 dirty 模块但未勾选的场景，执行渲染并断言显示 '取消' 和 'Switch' 按钮 #期望: ['Unsaved modules', 'Flow', 'Ship', 'Switch']
  - [✓] 1.3.2 对弹窗组件在勾选模块后，断言显示 'Save and Switch' 按钮 #期望: ['Save and Switch']
  - [✓] 1.3.3 对勾选且 isNew 状态的模块，断言显示独立名称输入框且预填默认名称 #期望: ['Flow Draft', 'Falx Blueprint']
  - [✓] 1.3.4 对点击 'Save and Switch' 按钮，断言调用正确的 save 方法和 `setVersion` #期望: [saveEmpireMock.calls=1, saveCurrentPlanAsMock.calledWith='Flow Draft', saveAsBlueprintMock.calledWith='Falx Blueprint', setVersionMock.calledWith='9.0', true]

- [✓] 1.4 VersionSettingsModal 同版本确认与禁用测试（已实现）
  - [✓] 1.4.1 对同版本且 `hasStoredVersion=false` 场景，执行打开弹窗并点击 'Save' 按钮，断言仅调用 `persistVersionSelection` 且不调用 `setVersion` #期望: [persistVersionSelectionMock.calledWith='8.0', false, setVersionMock.calls=0]
  - [✓] 1.4.2 对同版本且 `hasStoredVersion=true` 场景，断言 'Switch' 按钮处于 disabled 状态 #期望: [button.disabled=true]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: 版本弹窗已打开
  - [✓] 2.1.1 对 toolbar 版本切换按钮执行点击，打开版本设置弹窗
  - [✓] 2.1.2 等待弹窗 backdrop 渲染完成
  - [✓] 2.1.3 等待版本下拉框渲染完成
  - [✓] 2.1.4 对弹窗标题执行文本检查，断言显示 '游戏版本' / 'Game Version' #期望: ['游戏版本|Game Version']

- [✓] 2.2 切换: 打开版本弹窗 -> 选择目标版本
  - [✓] 2.2.1 状态: 版本弹窗已打开
  - [✓] 2.2.2 对版本下拉框执行选择 `'9.0::beta'` 选项
  - [✓] 2.2.3 对下拉框选中值执行检查，断言更新为 `'9.0::beta'` #期望: [version-select.value='9.0::beta']

- [ ] 2.3 切换: 确认版本切换 -> 页面刷新
  - [ ] 2.3.1 状态: 版本弹窗已打开
  - [ ] 2.3.2 对 '切换' / 'Switch' 按钮执行点击
  - [ ] 2.3.3 对页面执行 reload 监听，断言触发刷新（通过 `location.reload()` 模式） #期望: [page.reload.called=true]

## 3 E2E 测试场景

- [✓] 3.1 Case: 首次访问显示红点
  - [✓] 3.1.1 状态: 版本弹窗已打开
  - [✓] 3.1.2 在 localStorage 未写入 `x4_game_version` 的状态下访问页面
  - [✓] 3.1.3 对版本切换按钮上的红点指示器执行可见性检查，断言显示红点 #期望: [toolbar-version-indicator.visible=true]
  - [✓] 3.1.4 选择当前版本（8.0 stable）并点击 '保存' / 'Save' 按钮
  - [✓] 3.1.5 对红点指示器执行可见性检查，断言红点消失 #期望: [toolbar-version-indicator.visible=false]

- [✓] 3.2 Case: 切换版本后数据隔离
  - [✓] 3.2.1 状态: 版本弹窗已打开
  - [✓] 3.2.2 切换: 打开版本弹窗 -> 选择目标版本
  - [✓] 3.2.3 在 8.0 stable 版本下创建 empire 数据并保存
  - [✓] 3.2.4 切换: 确认版本切换 -> 页面刷新
  - [✓] 3.2.5 页面刷新后对 localStorage 的 `x4_game_version` 执行检查，断言版本已更新 #期望: [x4_game_version.version='9.0', beta=true]
  - [✓] 3.2.6 对旧版本 empire 数据执行检查，断言旧数据仍存在但不再使用 #期望: [x4_empire_data.exists=true]

- [ ] 3.3 Case: dirty 模块勾选保存流程
  - [ ] 3.3.1 状态: 版本弹窗已打开
  - [ ] 3.3.2 切换: 打开版本弹窗 -> 选择目标版本
  - [ ] 3.3.3 在 empire store 创建未保存的修改（`isDirty=true`）
  - [ ] 3.3.4 对未保存模块区域执行可见性检查，断言显示未保存模块区域 #期望: [unsaved-modules-panel.visible=true]
  - [ ] 3.3.5 勾选 empire 模块
  - [ ] 3.3.6 对按钮文本执行检查，断言切换为 '保存并切换' / 'Save and Switch' #期望: ['保存并切换|Save and Switch']
  - [ ] 3.3.7 点击 '保存并切换' 按钮，页面刷新后对 localStorage 的 `x4_empire_data` 执行检查，断言包含修改后的 empire 名称字段 #期望: [localStorage.x4_empire_data.activeEmpire.name='修改后的名称']

- [ ] 3.4 Case: isNew 模块名称输入
  - [ ] 3.4.1 状态: 版本弹窗已打开
  - [ ] 3.4.2 切换: 打开版本弹窗 -> 选择目标版本
  - [ ] 3.4.3 在 logic flow store 创建新的未保存计划（`isNew=true`）
  - [ ] 3.4.4 勾选 logic_flow 模块
  - [ ] 3.4.5 对名称输入框执行可见性检查，断言显示名称输入框 #期望: [module-name-logic_flow.visible=true]
  - [ ] 3.4.6 对输入框预填值执行检查，断言预填默认名称 #期望: ['新建流程|Flow Draft']
  - [ ] 3.4.7 清空名称输入框
  - [ ] 3.4.8 对 '保存并切换' 按钮 disabled 状态执行检查，断言 disabled #期望: [version-save-switch.disabled=true]
  - [ ] 3.4.9 输入有效名称后对按钮 disabled 状态执行检查，断言可点击 #期望: [version-save-switch.disabled=false]

- [✓] 3.5 Case: 同版本确认写入
  - [✓] 3.5.1 状态: 版本弹窗已打开
  - [✓] 3.5.2 在 localStorage 未写入 `x4_game_version` 的状态下访问页面
  - [✓] 3.5.3 对按钮文本执行检查，断言显示 '保存' / 'Save' #期望: ['保存|Save']
  - [✓] 3.5.4 点击按钮
  - [✓] 3.5.5 对 localStorage 的 `x4_game_version` 执行检查，断言已写入 #期望: [x4_game_version.contains='{"version":"8.0","beta":false}']
  - [✓] 3.5.6 对页面 URL 执行检查，断言未刷新（URL 不变） #期望: [url.unchanged=true]

- [✓] 3.6 Case: 同版本已写库按钮禁用
  - [✓] 3.6.1 状态: 版本弹窗已打开
  - [✓] 3.6.2 切换: 确认版本切换 -> 页面刷新
  - [✓] 3.6.3 在 `x4_game_version` 已写入的状态下访问页面
  - [✓] 3.6.4 对 '切换' / 'Switch' 按钮 disabled 状态执行检查，断言 disabled #期望: [version-switch.disabled=true]

## 4 Bug 测试