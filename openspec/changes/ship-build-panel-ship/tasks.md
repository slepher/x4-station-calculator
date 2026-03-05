# Tasks: ship-build-panel-ship

## 1. 视图控制重构（viewMode）

- [x] 1.1 `ShipBuildView` 改为使用 `viewMode` 控制 selector/workspace 显示。
- [x] 1.2 点击“更换飞船”仅切换 `viewMode='selector'`，不清空 selected/blueprint。
- [x] 1.3 移除 selector 过程中的额外回填入口，仅保留初始化加载回填。

## 2. 候选交互改造（pending + confirm/cancel）

- [x] 2.1 候选卡点击仅更新 `pendingShipId`，不直接更新 `selectedShipId`。
- [x] 2.2 候选高亮样式改为与 picker 选中样式一致。
- [x] 2.3 在候选头部右侧新增并对齐 `取消` / `确认` 按钮。
- [x] 2.4 同船确认可返回 workspace，不清 blueprint。
- [x] 2.5 异船确认时才执行“清空并切换 shipId”。
- [x] 2.6 取消逻辑实现：同级不回填、跨级回填 selectedShip 的筛选属性。

## 3. Selector 布局与分页

- [x] 3.1 selector 调整为三栏布局（过滤/候选/状态）并设置 `1:1:1`。
- [x] 3.2 移除固定高度与等高联动。
- [x] 3.3 候选数 `>10` 时显示分页器。
- [x] 3.4 分页器固定在候选列表上方右侧。
- [x] 3.5 分页器样式与 picker 分页器统一（含 active 样式）。

## 4. ShipBuildPanelShip 组件实现

- [x] 4.1 新建 `ShipBuildPanelShip` 并接入 selector 右栏。
- [x] 4.2 `ShipBuildPanelShip` 直接使用 `MetricPanel` 渲染。
- [x] 4.3 左列渲染 `hull/radar_range/crew + slots`。
- [x] 4.4 右列渲染该船级剩余属性。

## 5. 数据口径与过滤

- [x] 5.1 属性 max 接入 `default_maxes.json`。
- [x] 5.2 槽位 max 接入 `ship_slots.json`。
- [x] 5.3 槽位按 `slotType + size` 聚合，排除挂载护盾槽位。
- [x] 5.4 各船级可选项独立，过滤 `max==0` 项。

## 6. 对比规则

- [x] 6.1 `target=pending`、`current=blueprint?.ship`。
- [x] 6.2 同船级显示 diff。
- [x] 6.3 跨船级禁比，仅显示 target。

## 7. 测试与回归

- [x] 7.1 更新 `test_tasks.md` 与 `knowledge.md`（含固定候选与指标断言口径）。
- [x] 7.2 新增并通过 change 作用域 unit/e2e/bug/bugfix 测试。
- [x] 7.3 通过 `validate_test_tasks_refs.py` 与 `validate_test_case_refs.py`。
