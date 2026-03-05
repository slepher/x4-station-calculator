# Ship Build Material Specification

## Purpose
为“船只建造”右侧“建造材料”面板接入真实材料分析能力，支持 method 选择、fallback 计算、总览与装备分项展开，以及独立价格滑条联动估值。

## ADDED Requirements

### Requirement: Data Source Migration to ShipBlueprint

#### Scenario: Use ShipBlueprint as Equipment Data Source
- **前提**：用户已保存或加载 ShipBlueprint。
- **当**：材料面板计算装备材料。
- **那么**：系统 SHALL 从 `blueprint.connections` 中获取装备配置信息，而非从 `selectedByConnection` computed 获取。

### Requirement: Ship Hull Material Calculation

#### Scenario: Include Ship Hull Materials in Total
- **前提**：用户已选择飞船并存在 ShipBlueprint。
- **当**：系统计算总材料。
- **那么**：总材料 SHALL 包含飞船船体材料（从 ShipBlueprint 的 `hull` 配置获取）。
- **并且**：船体材料独立于飞船 production cost 计算。

### Requirement: Build Material Method Selector

#### Scenario: Aggregate And Render Method Options
- **前提**：用户已进入“船只建造”并选中飞船。
- **当**：材料面板渲染 method 下拉。
- **那么**：下拉选项 SHALL 来自飞船 `production.method` 与装备 `cost.method` 的去重聚合集合。
- **并且**：method 名称 SHALL 使用数据源原始键名（例如 `closedloop`，不是 `closed_loop`）。

#### Scenario: Change Method Recomputes Material Values
- **前提**：材料面板已显示总览与分项数据。
- **当**：用户切换 method 下拉选项。
- **那么**：材料金额相关结果 SHALL 实时重算并更新显示。

### Requirement: Method Fallback To Default

#### Scenario: Ship Method Fallback
- **前提**：当前飞船成本不存在用户选中的 method。
- **当**：系统计算飞船建造材料。
- **那么**：系统 MUST 回退到 `default` method 进行计算。

#### Scenario: Equipment Method Fallback
- **前提**：某装备成本不存在用户选中的 method。
- **当**：系统计算该装备材料。
- **那么**：系统 MUST 回退到 `default` method 进行计算。

### Requirement: Material Summary And Equipment Breakdown

#### Scenario: Show Total Material Overview
- **前提**：用户已选择飞船。
- **当**：材料面板渲染。
- **那么**：显示“总材料 xxxCr”汇总行。
- **并且**：汇总行可展开，展开后显示按材料汇总的 `数量 + 名称 + 金额` 明细。

#### Scenario: Show Equipment Breakdown Grouped By Equipment ID
- **前提**：存在已选装备。
- **当**：材料面板渲染装备分项。
- **那么**：系统 SHALL 按装备 ID 聚合展示分项。
- **并且**：每个分项显示 `装备名 x 数量 + 分项金额`。
- **并且**：分项可展开显示该装备组内材料明细。

#### Scenario: Total Material Includes Ship Hull, Production And Equipment
- **前提**：用户已选飞船，且存在装备选择，且 ShipBlueprint 包含 hull 配置。
- **当**：系统计算总材料。
- **那么**：总材料 SHALL 同时包含：
  1. 飞船船体材料（ShipBlueprint hull 配置）
  2. 飞船基础建造成本（production cost）
  3. 已选装备成本

### Requirement: Price Slider Affects Value Only

#### Scenario: Update CR Values Via Price Slider
- **前提**：材料面板已显示金额。
- **当**：用户拖动材料价格滑条。
- **那么**：所有 CR 金额 SHALL 随价格倍率变化实时更新。
- **并且**：材料数量 SHALL 保持不变。

### Requirement: UI Consistency And Reuse

#### Scenario: Reuse Collapsible Detail Interaction
- **前提**：材料面板渲染总览与分项。
- **当**：用户点击折叠行。
- **那么**：总览与分项 SHALL 复用 `CollapsibleDetailList` 折叠交互。

#### Scenario: Match Station Dashboard Visual Style
- **前提**：材料面板处于正常显示状态。
- **当**：用户查看版式与样式。
- **那么**：面板视觉层级与 `StationDashboard` 风格 SHALL 保持一致。

### Requirement: Localization And Test Baseline

#### Scenario: Use Dedicated I18n Keys
- **前提**：应用切换中英文。
- **当**：渲染材料面板标题、method、总览与滑条文案。
- **那么**：文本 SHALL 来自 ship-build 独立 i18n 键。

#### Scenario: Reuse Stable Ship-Build-Equipment State Baseline
- **前提**：需要执行 ship-build-material 相关回归测试。
- **当**：测试准备状态。
- **那么**：可复用 `ship-build-equipment` 中定义的标准状态路径与样本船语义。
