# 需求说明：ship-build-panel-ship

## 目标
将 ship-build 选船流程改为“viewMode 驱动 + pending 确认提交”，并在选船界面引入独立飞船状态面板 `ShipBuildPanelShip`。

## 已确认方案（最终）
1. 视图切换与状态控制
- 页面显示不再由 `selectedShipId` 控制，改为 `viewMode` 控制（`selector` / `workspace`）。
- 点击“更换飞船”只切换到 `viewMode='selector'`，不清空当前 `selected`、不清空 blueprint。
- 取消“进入 selector 时回填”的额外逻辑；active blueprint 的初始回填由加载阶段负责。

2. 选船交互（pending + confirm/cancel）
- 候选卡点击只更新 `pendingShipId`，仅做边框高亮，不立即提交。
- 高亮样式与 picker 的选中高亮保持一致。
- 候选区头部右侧放置 `取消` / `确认` 按钮，`取消` 紧邻 `确认`。
- `确认`后：
  - 若 pending 与当前飞船相同：允许确认并返回 workspace，不清空 blueprint。
  - 若 pending 与当前飞船不同：确认时才执行“清空并切换 shipId”。
- `取消`后：
  - 返回 workspace。
  - 若本次选择未造成船级变化，不做 tag 回填。
  - 若相对 selectedShip 发生船级变化，回填为 selectedShip 的筛选属性。

3. Selector 布局与分页
- 选船区为三栏 `1:1:1`：左过滤、中候选、右状态。
- 面板高度不固定，不做等高联动。
- 候选数 `>10` 时显示分页器。
- 分页器位于候选列表上方右侧（位置固定不变）。
- 分页器样式与 picker 展开态分页器一致（含页码按钮 active 样式）。

4. 飞船状态面板 `ShipBuildPanelShip`
- 组件独立，直接使用 `MetricPanel` 渲染。
- 展示“飞船本体状态”，排除所有需要装备参与的属性。
- 左列固定：`hull`、`radar_range`、`crew`、该船级全部 slots。
- 右列：该船级剩余属性。
- 属性候选按船级独立，过滤 `max==0` 项。
- 槽位统计按 `size + slotType` 聚合，且不计“挂载护盾槽位”。

5. 数据源与对比规则
- max 来源：
  - 属性：`default_maxes.json`
  - 槽位：`ship_slots.json`
- target：`pending`
- current：`blueprint?.ship`
- 仅当 current 与 target 同船级时显示对比；不同船级仅显示 target（不做 diff）。

## In Scope
- `viewMode` 驱动的 selector/workspace 切换。
- pending + confirm/cancel 完整交互。
- selector 三栏布局、分页与样式对齐。
- `ShipBuildPanelShip` 数据接入与渲染规则。

## Out of Scope
- workspace 内部配装逻辑重构。
- 重新定义 ships 原始数据结构。

## 验收标准（DoD）
1. 点击“更换飞船”仅切换 `viewMode='selector'`，不清空当前 blueprint。
2. 候选点击仅高亮 pending，确认前不更新 selected。
3. `取消`/`确认`均位于候选区头部右侧，且相邻。
4. 同船确认可返回 workspace。
5. 异船确认才触发“清空并切换 shipId”。
6. selector 三栏比例 `1:1:1`，且无固定高度联动。
7. 候选 `>10` 时显示分页器，位置在列表上方右侧。
8. 分页器样式与 picker 分页器一致。
9. `ShipBuildPanelShip` 采用 `MetricPanel`，按左右列规则渲染。
10. 属性/槽位 max 来源分别正确，且 `max==0` 项不显示。
11. 跨船级时仅显示 target，不显示 diff。
