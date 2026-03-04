# Metric Panel UI Specification

## Purpose
将 Ship Build 装备对比中的指标展示抽取为通用组件 `MetricItem` 与 `MetricsPanel`，并支持 schema 驱动布局与可选视图切换过滤。

## ADDED Requirements

### Requirement: Two-Level Metric Component Extraction

#### Scenario: Extract MetricItem For Single Metric Rendering
- **前提**：系统需要渲染一条指标数据。
- **当**：`MetricItem` 接收到标签、值、差值、单位和进度条所需数据。
- **那么**：系统 SHALL 渲染单条指标行（label + value/diff + unit + progress bar）。
- **并且**：系统 SHALL 保持原有 single/diff 展示行为和颜色语义。

#### Scenario: Extract MetricsPanel For Multi-Metric Composition
- **前提**：系统需要展示一组指标。
- **当**：`MetricsPanel` 接收到 `schema` 与数据对象。
- **那么**：系统 SHALL 通过 `MetricsPanel` 组织并渲染多个 `MetricItem`。

### Requirement: Schema-Driven Grid Dimension

#### Scenario: Grid Size Is Determined By Schema
- **前提**：`MetricsPanel` 接收到二维数组 `schema`。
- **当**：系统执行渲染。
- **那么**：系统 SHALL 以 `schema` 决定面板行列数量。
- **并且**：系统 SHALL NOT 依赖固定 2 列或固定行数。

### Requirement: Schema Expansion Order

#### Scenario: Render In Row-Major Order
- **前提**：`order='row'`。
- **当**：系统展开 `schema`。
- **那么**：系统 SHALL 以行优先顺序渲染指标。

#### Scenario: Render In Column-Major Order
- **前提**：`order='column'`。
- **当**：系统展开 `schema`。
- **那么**：系统 SHALL 以列优先顺序渲染指标。

### Requirement: Optional ViewTab Filtering

#### Scenario: Show ViewTabUI In Header When viewTab Is Provided
- **前提**：`MetricsPanel` 的 `viewTab` 参数不为 `null`。
- **当**：系统渲染标题栏。
- **那么**：系统 SHALL 在标题栏显示 `ViewTabUI`。

#### Scenario: Hide ViewTabUI When viewTab Is Null
- **前提**：`viewTab` 为 `null`。
- **当**：系统渲染标题栏。
- **那么**：系统 SHALL 不显示 `ViewTabUI`。

#### Scenario: Filter Metrics By Active Mode Keys
- **前提**：`viewTab.views` 中存在当前激活 `mode` 且其 `keys` 为数组。
- **当**：用户切换 mode。
- **那么**：系统 SHALL 仅显示 `keys` 中列出的指标。

#### Scenario: Do Not Filter When Keys Is all
- **前提**：当前 mode 的 `keys` 为字符串 `all`。
- **当**：系统执行指标过滤。
- **那么**：系统 SHALL 不隐藏任何指标项。

### Requirement: Backward-Compatible Migration Strategy

#### Scenario: Copy-Then-Refine Extraction
- **前提**：系统从 `ShipBuildPanelEquipment` 抽取展示层代码。
- **当**：执行组件抽取。
- **那么**：系统 SHALL 先复制现有模板元素与展示逻辑，再进行细化改造。
- **并且**：系统 SHALL 保持原有展示结果一致，避免首次抽取引入行为回归。
