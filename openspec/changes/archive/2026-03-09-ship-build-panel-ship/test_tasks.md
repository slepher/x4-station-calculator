# Test Tasks: ship-build-panel-ship

## 1 单元测试

- [✓] 1.1 viewMode 驱动模块显示
  - [✓] 1.1.1 在 store 中设置 `viewMode='selector'`，对 `ShipBuildView` 执行渲染
  - [✓] 1.1.2 在渲染结果中读取 `ShipBuildSelectorView` 与 `ShipBuildWorkspaceView` 组件可见性
  - [✓] 1.1.3 断言仅显示 `ShipBuildSelectorView` #期望: ['ShipBuildSelectorView visible', 'ShipBuildWorkspaceView hidden']

- [✓] 1.2 setSelectedShipId 同船确认不重建 blueprint
  - [✓] 1.2.1 在 store 中准备 `viewMode='selector'` 与 `selectedShipId='ship_ter_m_corvette_02_a'`，并保留已有 blueprint connections
  - [✓] 1.2.2 对 store 执行 `setSelectedShipId('ship_ter_m_corvette_02_a')`
  - [✓] 1.2.3 断言 `viewMode='workspace'` 且 blueprint connections 未被清空 #期望: ['workspace', 'connections preserved']

- [✓] 1.3 setSelectedShipId 不同船确认重建 blueprint
  - [✓] 1.3.1 在 store 中准备 `selectedShipId='ship_ter_m_corvette_02_a'` 与非空 blueprint connections
  - [✓] 1.3.2 对 store 执行 `setSelectedShipId('ship_tel_m_freighter_01_a')`
  - [✓] 1.3.3 断言 blueprint 被重建为空 connections 且 `viewMode='workspace'` #期望: ['connections=[]', 'workspace']

- [✓] 1.4 cancelShipSelector 船级回填规则
  - [✓] 1.4.1 在 store 中准备 `selectedShip.class='ship_m'`，先设置筛选 class 为 `ship_l`
  - [✓] 1.4.2 对 store 执行 `cancelShipSelector()`
  - [✓] 1.4.3 断言筛选被回填为 selectedShip 的 class/race/type 且 `viewMode='workspace'` #期望: ['class/race/type restored', 'workspace']

- [✓] 1.5 飞船列表分页器显示阈值
  - [✓] 1.5.1 在 `ShipBuildSelector` 注入 11 条符合当前筛选的候选飞船并执行渲染
  - [✓] 1.5.2 在渲染结果中读取 `data-testid="ship-build-list-pager"`
  - [✓] 1.5.3 断言分页器显示且每页渲染 10 条候选卡 #期望: ['pager visible', '10 items per page']

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: selector-open-with-current-ship
  - [✓] 2.1.1 在 `/` 页面写入固定前置（fixture activeId 指向 ship build 蓝图、语言切换为 `zh-CN`）后进入 ship build workspace
  - [✓] 2.1.2 在 workspace 头部对 `data-testid="ship-build-change-ship-fit-header"` 执行点击，断言 `data-testid="ship-build-selector-grid"` 可见
  - [✓] 2.1.3 在 selector 列表中对当前飞船名称对应的候选卡执行定位并读取样式类
  - [✓] 2.1.4 断言该候选卡包含 pending 高亮样式 `list-item-pending` #期望: ['list-item-pending', 'current ship card located by visible name']

- [✓] 2.2 状态: selector-open-with-pending-ship
  - [✓] 2.2.1 在 `selector-open-with-current-ship` 前置下保持语言与筛选条件不变
  - [✓] 2.2.2 在 `selector-open-with-current-ship` 状态下对包含 `data-testid=\"ship-build-ship-name\"` 且文本为 `大太刀` 的候选卡执行点击
  - [✓] 2.2.3 在候选列表中读取被点击飞船卡片的 class 列表
  - [✓] 2.2.4 在右侧 `metrics-panel-ship-build-panel-ship` 中读取 `data-testid=\"metric-value-hull\"` 文本
  - [✓] 2.2.5 断言候选卡包含 pending 高亮样式且 `metric-value-hull` 精确等于 `16,100(+5,100)` #期望: ['list-item-pending', 'metric-value-hull==16,100(+5,100)']

- [✓] 2.3 切换: selector-open-with-pending-ship -> workspace-with-confirmed-ship
  - [✓] 2.3.1 在 `selector-open-with-pending-ship` 前置下保持 pending 候选为目标飞船
  - [✓] 2.3.2 在 `selector-open-with-pending-ship` 状态下对 `data-testid="ship-build-confirm-ship"` 执行点击
  - [✓] 2.3.3 在页面中读取 `data-testid=\"ship-build-panels\"` 与 `data-testid=\"ship-build-current-ship-title\"` 文本
  - [✓] 2.3.4 断言页面回到 workspace 且 `ship-build-current-ship-title` 等于 pending 候选 #期望: ['ship-build-panels visible', 'ship-build-current-ship-title==pending ship']

- [✓] 2.4 切换: selector-open-with-current-ship -> workspace-with-current-ship
  - [✓] 2.4.1 在 `selector-open-with-current-ship` 前置下保持 pending 为当前飞船
  - [✓] 2.4.2 在 `selector-open-with-current-ship` 状态下对 `data-testid="ship-build-cancel-ship-change"` 执行点击
  - [✓] 2.4.3 在页面中读取 `data-testid=\"ship-build-panels\"` 与 `data-testid=\"ship-build-current-ship-title\"` 文本
  - [✓] 2.4.4 断言页面回到 workspace 且 `ship-build-current-ship-title` 保持为切换前飞船 #期望: ['ship-build-panels visible', 'ship-build-current-ship-title unchanged']

## 3 E2E 测试场景

- [✓] 3.1 Case: 更换飞船入口切到 selector 且保留当前 ship 基准
  - [✓] 3.1.1 状态: selector-open-with-current-ship
  - [✓] 3.1.2 在 selector 顶部对 `data-testid="ship-build-confirm-ship"` 执行点击
  - [✓] 3.1.3 切换: selector-open-with-current-ship -> workspace-with-current-ship
  - [✓] 3.1.4 断言 `data-testid=\"ship-build-current-ship-title\"` 文本未变化 #期望: ['ship-build-current-ship-title unchanged']

- [✓] 3.2 Case: 选择同船确认可返回 workspace
  - [✓] 3.2.1 状态: selector-open-with-current-ship
  - [✓] 3.2.2 在 selector 中保持当前 pending 不变并点击 `data-testid="ship-build-confirm-ship"`
  - [✓] 3.2.3 切换: selector-open-with-current-ship -> workspace-with-current-ship
  - [✓] 3.2.4 断言页面回到 workspace #期望: ['ship-build-panels visible']

- [✓] 3.3 Case: 选择不同船确认后切换 ship
  - [✓] 3.3.1 状态: selector-open-with-pending-ship
  - [✓] 3.3.2 在 selector 顶部对 `data-testid="ship-build-confirm-ship"` 执行点击
  - [✓] 3.3.3 切换: selector-open-with-pending-ship -> workspace-with-confirmed-ship
  - [✓] 3.3.4 断言 `data-testid=\"ship-build-current-ship-title\"` 文本等于 pending 候选 #期望: ['ship-build-current-ship-title==pending ship']

- [✓] 3.4 Case: 取消更换在同船级筛选下不改筛选标签
  - [✓] 3.4.1 状态: selector-open-with-current-ship
  - [✓] 3.4.2 在 selector 内仅修改 race/type 筛选后点击 `data-testid="ship-build-cancel-ship-change"`
  - [✓] 3.4.3 切换: selector-open-with-current-ship -> workspace-with-current-ship
  - [✓] 3.4.4 断言 `data-testid=\"ship-build-current-ship-title\"` 未变化且未强制回填新标签 #期望: ['ship-build-current-ship-title unchanged', 'no forced tag reset']

- [✓] 3.5 Case: 跨船级 pending 仅显示 target 不显示 diff
  - [✓] 3.5.1 状态: selector-open-with-pending-ship
  - [✓] 3.5.2 在 selector 中将筛选固定为 `class=L`、`race=terran`、`type=destroyer`，并对包含 `data-testid=\"ship-build-ship-name\"` 且文本为 `大阪` 的候选卡执行点击
  - [✓] 3.5.3 断言右侧 `data-testid=\"metric-value-hull\"` 文本精确等于 `95,000` 且不包含差值括号 `(+` 或 `(-` #期望: ['metric-value-hull==95,000', 'metric-value-hull has no diff text']

- [✓] 3.6 Case: 同船级 pending 显示 current/target 差值
  - [✓] 3.6.1 状态: selector-open-with-pending-ship
  - [✓] 3.6.2 在 selector 中选择与 current 相同 class 的 pending 候选
  - [✓] 3.6.3 切换: selector-open-with-pending-ship -> workspace-with-confirmed-ship
  - [✓] 3.6.4 断言右侧 `data-testid=\"metric-value-hull\"` 文本包含差值括号 `(+` 或 `(-` #期望: ['metric-value-hull diff text visible']

- [✓] 3.7 Case: 候选超过 10 条时分页器位于列表上方右侧
  - [✓] 3.7.1 状态: selector-open-with-current-ship
  - [✓] 3.7.2 在筛选区设置条件使候选总数 > 10，读取 `data-testid="ship-build-list-pager"`
  - [✓] 3.7.3 断言分页器与确认按钮同处列表头部右侧，且显示 `< 1 2 >` 按钮结构 #期望: ['pager in header-right', '< 1 2 > visible']

- [✓] 3.8 Case: 分页器页码按钮高亮样式与 picker 分页器一致
  - [✓] 3.8.1 状态: selector-open-with-current-ship
  - [✓] 3.8.2 在分页器点击 `data-testid="ship-build-page-2"` 后读取页码按钮 class
  - [✓] 3.8.3 断言当前页按钮包含 `pager-btn-active` #期望: ['pager-btn-active']

## 4 Bug 测试

- [✓] 4.1 BUG-001: 更换飞船后点击同船确认无法返回 workspace
  - [✓] 4.1.1 在 workspace 点击 `data-testid="ship-build-change-ship-fit-header"` 进入 selector，并保持 pending 为当前 ship
  - [✓] 4.1.2 状态: selector-open-with-current-ship
  - [✓] 4.1.3 在 selector 顶部对 `data-testid="ship-build-confirm-ship"` 执行点击
  - [✓] 4.1.4 修复前：断言页面仍停留 selector，`data-testid="ship-build-selector-grid"` 可见 #期望: ['selector stays visible']
  - [✓] 4.1.4 修复后：断言 `data-testid="ship-build-panels"` 可见 #期望: ['workspace visible']
  - [✓] 4.1.5 切换: selector-open-with-current-ship -> workspace-with-current-ship
  - [✓] 4.1.6 断言 `data-testid=\"ship-build-current-ship-title\"` 保持不变 #期望: ['ship-build-current-ship-title unchanged']

- [✓] 4.2 BUG-002: 飞船候选过多时无分页器或分页结构错误
  - [✓] 4.2.1 在 selector 设置筛选条件使候选总数 > 10
  - [✓] 4.2.2 状态: selector-open-with-pending-ship
  - [✓] 4.2.3 在列表头读取分页器容器与按钮节点
  - [✓] 4.2.4 修复前：断言分页器不存在或仅显示 `1/2` 文本 #期望: ['pager missing or ratio-text only']
  - [✓] 4.2.4 修复后：断言分页器显示 `< 1 2 >` 且当前页按钮具备 `pager-btn-active` #期望: ['< 1 2 >', 'pager-btn-active']
