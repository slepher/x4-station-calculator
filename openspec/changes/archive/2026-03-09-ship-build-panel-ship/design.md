## Context

本变更将 ship-build 的选船流程从“选中即提交”改为“pending 预览 + confirm 提交”，并引入 `ShipBuildPanelShip` 作为 selector 右侧独立状态面板。
核心目标是：减少误触、支持同级对比、跨级禁比、并统一分页视觉与 picker。

## Architecture

1. 视图层
- `ShipBuildView` 使用 `viewMode` 控制显示：
  - `selector` -> `ShipBuildSelectorView`
  - `workspace` -> `ShipBuildWorkspaceView`
- 不再以 `selectedShipId` 是否为空决定展示模块。

2. Selector 层（`ShipBuildSelectorView` / `ShipBuildSelector`）
- 三栏布局：过滤列 / 候选列 / 状态列，桌面端比例 `1:1:1`。
- 候选列维护本地 `pendingShipId`。
- 顶部操作区放置：分页器 + `取消` + `确认`。
- 候选卡高亮采用 picker 一致风格（pending 高亮）。

3. Store 层（`useShipBuildStore`）
- 新增 `viewMode` 状态。
- `enterShipSelector()`：仅切换到 `selector`。
- `setSelectedShipId()`：仅在确认阶段被调用；同船与异船走不同分支。
- `cancelShipSelector()`：返回 workspace，并按“是否船级变化”决定是否做筛选回填。

4. 状态面板层（`ShipBuildPanelShip`）
- 直接复用 `MetricPanel`，不再自建展示组件。
- 输入：`targetShip`（pending）、`currentShip`（blueprint ship）。
- 输出：
  - 左列：`hull`、`radar_range`、`crew` + 全部 slot 指标
  - 右列：其余属性指标

## Key Decisions

1. 提交时机后移
- 候选点击不提交，确认才提交。
- 同船确认允许执行（用于显式退出 selector）。

2. blueprint 清空策略
- 点击“更换飞船”不清空 blueprint。
- 仅在“确认且异船”时清空并替换 `shipId`。

3. 回填策略收敛
- 取消 selector 过程中的额外回填功能。
- active blueprint 的回填仅在初始加载阶段执行。
- 取消时仅对“船级变化”场景进行筛选回填。

4. 分页规范统一
- 候选数大于 10 启用分页。
- 分页控件位置固定在候选头部右侧。
- 分页按钮视觉与 picker 分页保持一致（含 active 样式）。

5. 对比规则
- `target=pending`，`current=blueprint?.ship`。
- 同船级：展示 current/target 与 diff。
- 跨船级：禁比，仅展示 target。

## Data Flow

1. 进入 selector
- workspace 点击“更换飞船” -> `enterShipSelector()` -> `viewMode='selector'`。

2. 选择候选
- 点击候选卡 -> 更新 `pendingShipId`。
- `ShipBuildPanelShip` 实时显示 pending（target）状态。

3. 确认
- 点击确认 -> `setSelectedShipId(pending)`。
- 同船：直接回 workspace，不清 blueprint。
- 异船：清空 blueprint connections，写入新 shipId，回 workspace。

4. 取消
- 点击取消 -> `cancelShipSelector()`。
- 若发生船级变化，回填筛选为 selectedShip 的 class/race/type；否则不回填。

## Data Source

- 属性 max：`default_maxes.json`
- 槽位 max：`ship_slots.json`
- current/target 值：`ships.json` 实体
- 槽位统计口径：`slotType + size` 聚合，排除挂载护盾槽位
- 过滤规则：`max==0` 的属性/槽位不进入面板

## Risks

1. selector 与 workspace 共享状态下，误用 `selectedShipId` 做显示判断会导致回归。
- 通过 `viewMode` 单一控制避免该问题。

2. 分页 + 筛选联动可能造成页码越界。
- 需在筛选变化后重算分页并校正当前页。

3. 跨级禁比若漏判，会出现误导 diff。
- 以 ship class 一致性作为唯一 compare 开关。

## Validation Strategy

1. 交互验证
- 同船确认可回 workspace。
- 异船确认才清空并切换 ship。
- 取消逻辑满足“同级不回填、跨级回填”。

2. 布局验证
- 三栏比例 `1:1:1`。
- 无固定高度联动。
- 分页器位置和样式符合 picker。

3. 数据验证
- `ShipBuildPanelShip` 左右列字段分配正确。
- `max` 来源正确，`max==0` 被过滤。
- 跨级不显示 diff，同级显示 diff。
