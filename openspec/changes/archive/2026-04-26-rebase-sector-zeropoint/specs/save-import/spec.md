# Save Import Specification

## Purpose

使存档兴趣点与存档站点坐标在导入后直接对齐当前 sector 局部坐标语义，避免地图渲染阶段重复推导和错位。

## MODIFIED Requirements

### Requirement: Save Archive Position Normalization

系统 MUST 在存档后处理阶段统一生成 `position`，并与当前 sector center 语义对齐。

#### Scenario: position 按 zone 与 sector center 计算

- **前提** 某个存档实体位于指定 sector，且可能带有 `zone_id` 与相对坐标
- **当** `saveParser.post.ts` 后处理该实体
- **那么** 系统 SHALL 先根据 `zone_id` 解析 zone 基准坐标
- **并且** SHALL 叠加实体自身相对坐标
- **并且** SHALL 减去该 sector 的 `raw_center_pos`
- **并且** SHALL 将结果写入统一的 `position.x/y/z`

#### Scenario: 无 zone 数据时按 sector center 回退

- **前提** 某个实体没有可解析的 `zone_id`
- **当** 系统计算其 `position`
- **那么** 系统 SHALL 使用实体自身相对坐标减去 sector center 作为最终位置

### Requirement: Save Archive Transform Coordinates

系统 MUST 在后处理阶段为地图消费预生成 `position.tx/ty`。

#### Scenario: 预写入 tx/ty

- **前提** 某个实体已经得到 `position.x/y/z`
- **当** 后处理完成该实体
- **那么** 系统 SHALL 使用该 sector 的 `scale_per_radius` 生成 `position.tx`
- **并且** `position.tx` SHALL 等于 `position.x * scale_per_radius`
- **并且** `position.ty` SHALL 等于 `-position.z * scale_per_radius`

### Requirement: Save POI Map Consumption

地图 MUST 直接消费存档实体的 `position.tx/ty`，而不是再次从 `x/z` 临时计算。

#### Scenario: save POI 直接使用 position.tx/ty

- **前提** 地图渲染 save POI overlay
- **当** 系统将存档实体转换为屏幕坐标
- **那么** 系统 SHALL 直接读取 `position.tx/ty`
- **并且** SHALL NOT 在渲染层直接执行 `x * scale_per_radius` / `-z * scale_per_radius`

### Requirement: Placement and Preview Consistency

站点放置与拖拽预览 MUST 使用与存档 POI 相同的 sector center 投影规则。

#### Scenario: 非零原点 sector 中无错位

- **前提** 当前 sector 的 `raw_center_pos` 不为 `0,0,0`
- **当** 用户查看站点放置 overlay 或拖拽预览
- **那么** 这些覆盖物 SHALL 与 zone / gate / save POI 保持同一局部坐标语义
- **并且** SHALL NOT 因继续使用旧原点公式而产生偏移
