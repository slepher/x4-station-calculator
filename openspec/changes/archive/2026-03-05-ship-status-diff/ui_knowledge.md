# UI Knowledge: ship-status-diff

本文档记录 ship status 预演差异能力的 UI 结构、定位器和测试观察点。

## 1 页面与面板结构

- 视图入口组件：`src/components/ShipBuildView.vue`
- 配装面板：`src/components/ship-build/ShipBuildPanelFit.vue`
- 候选详情面板：`src/components/ship-build/ShipBuildPanelEquipment.vue`
- 状态面板：`src/components/ship-build/ShipBuildPanelStats.vue`
- 指标通用组件：`src/components/common/MetricsPanel.vue`

## 2 关键状态变量与数据通路

- picker 高亮来源：`highlightedEquipmentId`
- picker 目标槽位集合：`pickerTarget.connectionKeys`
- 当前正式蓝图：`blueprint`
- 预演蓝图（新增）：`targetBlueprint`（名称可按实现微调）
- 状态面板输入：
  - current: `shipBlueprint`
  - target: `targetBlueprint` -> `objTarget`

## 3 关键定位器（现有）

- 配装区域容器：`data-testid=ship-build-panel-fit`
- 状态面板容器：`data-testid=ship-build-panel-stats`
- 候选列表容器：`data-testid=equipment-picker`
- 候选项：`data-testid=candidate-<equipmentId>`
- 取消按钮（显式清理预演）：`data-testid=picker-cancel`
- 确认按钮（正式提交）：`data-testid=picker-confirm`
- 切换飞船按钮：`data-testid=ship-build-change-ship`（位于 `ship-build-selection`）
- 飞船列表名称项：`data-testid=ship-build-ship-name`（用于按固定名称选择目标飞船，如 `Osaka`）
- group 模式按钮（测试约定）：`data-testid=fit-mode-group`
- 槽位类型标签：`data-testid=slot-type-<slotType>`
- 槽位行：`data-testid=slot-<shipId>::<slotType>::<slotIndex>::<groupIndex>`
- 槽位名称（测试约定）：`data-testid=slot-row-name-<targetKey>`
- 槽位数量（测试约定）：`data-testid=slot-row-count-<targetKey>`
- group 目标数量（测试约定）：`data-testid=group-target-count`
- 指标面板容器：`data-testid=metrics-panel-ship-build-stats-panel`
- 指标项：`data-testid=metric-item-<key>`
- 指标值：`data-testid=metric-value-<key>`

## 4 新增断言建议（预演差异）

1. 高亮候选后：
   - 固定读取 `data-testid=metric-value-speed`，断言文本包含差值括号（示例：`205(+25)`）。
2. 关闭 picker 后：
   - 点击 `data-testid=picker-cancel`，再读取 `metric-value-speed`，断言文本不含括号。
3. group 模式按数量替换：
   - 点击 `data-testid=fit-mode-group` 进入 group。
   - 读取 `slot-row-count-<targetKey>`，并与 `group-target-count` 校验分配总数。
   - 对 count=0 的 key，读取 `slot-row-name-<targetKey>`，断言为 `--`。

## 5 模式语义

- connection 模式：预演只作用于当前单个 `connectionKey`。
- group 模式：预演作用于同类 `connectionKeys`，并按目标数量分摊。
- 预演阶段不提交蓝图：只有 confirm 操作才进入正式赋值流程。

## 6 相关测试文件建议

- `tests/e2e/ship-build-stat/ship-build-stat.spec.ts`：状态面板差异展示与清理。
- `tests/e2e/build-ship-equipment-panel/build-ship-equipment-panel.spec.ts`：picker 与模式切换链路。
- `tests/unit/ship-build-stat/`：target/current 指标生成单元回归。

## 7 差异断言约束

- 预演显示断言优先使用可见文本格式（`metric-value-speed` 的括号差值），不使用内部对象字段名（如 `objTarget`）。
- 关闭动作统一使用 `picker-cancel`，避免“点击空白关闭”导致路径不确定。
- 飞船切换动作统一使用 `ship-build-change-ship`，不使用页面自由点击路径。

## 8 固定前置（E2E）

- fixture：`tests/fixtures/db.json`（写入 localStorage 时移除 `vsn`）。
- 语言：通过 UI 选择 `zh-CN`。
- 默认目标飞船：`ship_ter_m_corvette_02_a`（Odachi）；切换场景固定切到 `Osaka`。
