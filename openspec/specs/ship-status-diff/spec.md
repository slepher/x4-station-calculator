# Ship Status Diff Specification

## Purpose
在 Ship Build 配装阶段提供“候选模块高亮即预演”的属性差异展示能力，使用户在确认提交前即可看到整船状态变化。预演应严格区分 connection/group 两种模式，并保证不污染正式蓝图状态。

## ADDED Requirements

### Requirement: Hover-Preview Target Diff

#### Scenario: Build Target Object On Candidate Highlight
- **前提**：用户已选择飞船，且配装 picker 处于展开状态。
- **当**：用户高亮一个候选模块。
- **那么**：系统 SHALL 基于当前蓝图构造一次预演替换结果。
- **并且**：`PanelStatus` SHALL 接收该预演结果作为 `targetObject`（或等价 `targetBlueprint` 计算产物）。

#### Scenario: Clear Target Object When Highlight Ends
- **前提**：当前存在高亮触发的预演结果。
- **当**：用户取消高亮、关闭 picker 或切换飞船。
- **那么**：`PanelStatus` SHALL 清空 `targetObject`。

### Requirement: Connection Mode Replacement Scope

#### Scenario: Replace Only Current Connection In Connection Mode
- **前提**：当前处于 connection 模式，且已定位单个 `connectionKey`。
- **当**：用户高亮候选模块。
- **那么**：系统 SHALL 仅在该 `connectionKey` 上执行预演替换。
- **并且**：其余连接配置保持不变。

### Requirement: Group Mode Quantity-Based Replacement

#### Scenario: Replace All Same-Type Slots By Quantity In Group Mode
- **前提**：当前处于 group 模式，目标包含同类槽位聚合 `connectionKeys` 与总数量。
- **当**：用户高亮候选模块。
- **那么**：系统 SHALL 按聚合数量在同类槽位上执行替换预演。
- **并且**：分配 SHALL 按连接容量分摊到每个 `connectionKey`。
- **并且**：分配后 `count > 0` 的连接使用候选模块，`count = 0` 的连接清空。

### Requirement: Preview Purity And Isolation

#### Scenario: Preview Must Not Mutate Active Blueprint
- **前提**：用户仅执行高亮预览，未点击确认。
- **当**：系统完成预演计算。
- **那么**：活动 `blueprint` SHALL 保持不变。
- **并且**：预演结果仅用于 UI 对比显示。

#### Scenario: Persist Only On Confirm Action
- **前提**：用户已完成预演并准备提交。
- **当**：用户执行确认动作。
- **那么**：系统 SHALL 走现有正式赋值流程更新 `blueprint`。
- **并且**：预演路径不直接写入持久化。

### Requirement: Shield Key Compatibility In Preview Path

#### Scenario: Apply Shield Mapping Rules Consistently
- **前提**：目标连接包含 shield 相关 key（4 段或 5 段形式）。
- **当**：执行预演替换。
- **那么**：系统 SHALL 与正式赋值路径使用一致的 shield key 解析与映射规则。

### Requirement: Stats Panel Diff Rendering

#### Scenario: Render Current Vs Target In Metrics Panel
- **前提**：`PanelStatus` 同时拿到 current 与 target 两组值。
- **当**：指标面板渲染。
- **那么**：`MetricsPanel` SHALL 以差异模式展示值与差值。
- **并且**：summary/detail 视图过滤行为保持现状一致。
