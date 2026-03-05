# Ship Build Panel Ship Specification

## Purpose
在选船阶段引入独立状态面板 `ShipBuildPanelShip`，以船级独立字段展示飞船状态；候选区采用 pending+confirm 交互，确保仅在用户确认时提交选船，并支持同船级下的 current/target 对比。

## ADDED Requirements

### Requirement: Three-Column Selector Layout

#### Scenario: Render 1:1:1 Layout In Selector View
- **前提**：用户处于选船阶段。
- **当**：页面渲染选船界面。
- **那么**：页面 SHALL 渲染左过滤、中候选、右状态三栏布局。
- **并且**：三栏宽度比例 SHALL 为 `1:1:1`。
- **并且**：三栏高度 SHALL 为内容自适应，不使用固定高度或联动等高。

### Requirement: Pending Selection And Confirm Commit

#### Scenario: Click Candidate Only Updates Pending
- **前提**：候选区存在可选飞船。
- **当**：用户点击任一候选卡。
- **那么**：系统 SHALL 仅更新 `pendingShipId`。
- **并且**：系统 SHALL NOT 立即更新 `selectedShipId`。

#### Scenario: Confirm Button Commits Selected Ship
- **前提**：存在 `pendingShipId`。
- **当**：用户点击候选区确认按钮。
- **那么**：系统 SHALL 提交 `selectedShipId = pendingShipId`。

#### Scenario: Pending Highlight Style Uses Picker Style
- **前提**：候选卡处于 pending 高亮状态。
- **当**：候选区渲染。
- **那么**：候选高亮边框样式 SHALL 与 picker 选中高亮样式一致。

### Requirement: Auto Highlight Blueprint Ship In Candidate List

#### Scenario: Auto Highlight Blueprint Ship When Present
- **前提**：当前存在 `blueprint.shipId`。
- **当**：候选列表首次可用或筛选条件变化后重建。
- **那么**：若 `blueprint.shipId` 存在于当前候选列表，系统 SHALL 自动将其设为 pending 高亮。

#### Scenario: No Highlight When Blueprint Ship Is Absent
- **前提**：当前存在 `blueprint.shipId`。
- **当**：该 ship 不在当前候选列表中。
- **那么**：系统 SHALL 不设置 pending 高亮。

### Requirement: Ship Panel Field Partition

#### Scenario: Left Column Shows Fixed Base And All Class Slots
- **前提**：`ShipBuildPanelShip` 已获取目标飞船与船级。
- **当**：面板渲染。
- **那么**：左侧 SHALL 显示 `hull`、`radar_range`、`crew`。
- **并且**：左侧 SHALL 显示该船级在 `ship_slots.json` 中定义的全部 slot 项。

#### Scenario: Right Column Shows Remaining Class Properties
- **前提**：`ShipBuildPanelShip` 已获取目标飞船与船级。
- **当**：面板渲染。
- **那么**：右侧 SHALL 显示该船级剩余属性项（不含左侧已占用项）。

### Requirement: Data Sources And Filtering

#### Scenario: Use default_maxes For Property Max
- **前提**：需计算属性项进度条 max。
- **当**：面板构建属性 schema。
- **那么**：属性 max SHALL 来自 `default_maxes.json` 对应船级字段。

#### Scenario: Use ship_slots For Slot Max
- **前提**：需计算槽位项进度条 max。
- **当**：面板构建 slots schema。
- **那么**：槽位 max SHALL 来自 `ship_slots.json` 对应船级 `slot+size` 项。

#### Scenario: Exclude Zero-Max Properties
- **前提**：面板构建某船级属性列表。
- **当**：某属性在 `default_maxes.json` 中 max 为 `0`。
- **那么**：该属性 SHALL 被排除，不进入可选显示。

#### Scenario: Exclude Mounted Shield Sub-Slots
- **前提**：面板构建槽位列表。
- **当**：统计槽位项。
- **那么**：系统 SHALL NOT 统计挂载护盾子槽位（`connection.shield`）。

### Requirement: Pending Compare Rules

#### Scenario: Compare Uses target=pending And current=blueprint ship
- **前提**：存在 pending 飞船。
- **当**：面板渲染右侧对比。
- **那么**：`target` SHALL 使用 pending 飞船数据。
- **并且**：`current` SHALL 使用 `blueprint?.ship` 数据。

#### Scenario: Disable Cross-Class Compare
- **前提**：同时存在 current 与 target。
- **当**：两者船级不同。
- **那么**：面板 SHALL 仅显示 target。
- **并且**：面板 SHALL NOT 显示 current-vs-target 对比差异。
