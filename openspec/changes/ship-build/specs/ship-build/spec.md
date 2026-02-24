# Ship Build View Specification

## Purpose
新增“船只建造”视图，提供基础筛选与列表展示入口，并完成布局占位，确保与现有“量化生产”风格一致。

## ADDED Requirements

### Requirement: View Entry And Header Buttons

#### Scenario: Enter Ship Build View
- **前提**：用户处于应用主界面，存在与“量化生产”“逻辑组网”同级的视图切换入口。
- **当**：用户切换到“船只建造”。
- **那么**：页面显示“船只建造”视图内容。
- **并且**：顶部“新建/保存/载入”按钮组位置与结构保持一致。
- **并且**：按钮组主题为绿色系。

### Requirement: Layout Structure

#### Scenario: Render Top And Bottom Sections
- **前提**：用户进入“船只建造”视图。
- **当**：页面渲染完成。
- **那么**：页面按上下分区显示。
- **并且**：上部为“选择船只”区域。
- **并且**：下部为三列布局（配装 / 配装后船体属性 / 建造材料）。
- **并且**：三列均为占位结构，不显示计算内容。

### Requirement: Filter Controls And List Visibility

#### Scenario: Hide List Without Required Filters
- **前提**：用户进入“船只建造”视图。
- **当**：`class` 未选择。
- **那么**：飞船列表不显示。

#### Scenario: Hide List Without Race Or Type
- **前提**：`class` 已选择。
- **当**：`race` 与 `type` 均未选择。
- **那么**：飞船列表不显示。

#### Scenario: Show List With Class And Race Or Type
- **前提**：`class` 已选择。
- **当**：`race` 或 `type` 至少选择一个。
- **那么**：飞船列表显示，并根据筛选条件过滤。

### Requirement: Type And Class Linkage

#### Scenario: Filter Type Options By Class
- **前提**：`type` 选项包含 `class: []` 字段。
- **当**：用户选择某个 `class`。
- **那么**：仅显示与该 `class` 匹配的 `type` 选项。

#### Scenario: Filter Result Intersection
- **前提**：`class` 已选择，且 `race` 与 `type` 同时选择。
- **当**：系统计算筛选结果。
- **那么**：飞船列表仅展示满足 `class` + `race` + `type` 的交集结果。

### Requirement: Ship Name Localization

#### Scenario: Render Localized Ship Name
- **前提**：飞船列表包含来自数据源的名称字段。
- **当**：列表渲染飞船名称。
- **那么**：名称应通过 `x4i18n` 翻译逻辑进行本地化展示。

#### Scenario: Support New Ship Types In I18n
- **前提**：存在新增飞船类型。
- **当**：`x4i18n` 处理飞船名称翻译。
- **那么**：新增类型应被翻译逻辑覆盖，确保名称可被本地化。

### Requirement: Filter Label Counts

#### Scenario: Race Label Shows Count Under Current Type Selection
- **前提**：`class` 已选择，且存在 `type` 选择状态（可能为空）。
- **当**：渲染 `race` 选择标签。
- **那么**：标签应显示 `名称 (count)`。
- **并且**：`count` 表示在当前 `type` 选择条件下可用的飞船数量。

#### Scenario: Type Label Shows Count Under Current Race Selection
- **前提**：`class` 已选择，且存在 `race` 选择状态（可能为空）。
- **当**：渲染 `type` 选择标签。
- **那么**：标签应显示 `名称 (count)`。
- **并且**：`count` 表示在当前 `race` 选择条件下可用的飞船数量。
