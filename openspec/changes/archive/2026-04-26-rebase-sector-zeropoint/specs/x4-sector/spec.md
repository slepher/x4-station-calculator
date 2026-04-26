# X4 Sector Specification

## Purpose

修正 sector 内部坐标原点与局部缩放语义，使星区内部点位、连线、tooltip 与存档投影使用一致的中心点定义。

## MODIFIED Requirements

### Requirement: Sector Local Coordinate Normalization

系统 MUST 以 sector 的 `raw_center_pos` 作为星区内部坐标原点，而不是固定 `0,0,0`。

#### Scenario: sector center 由 zone 包围盒决定

- **前提** 某个 sector 存在一个或多个 zone 坐标
- **当** 地图处理链生成 sector 数据
- **那么** 系统 SHALL 收集该 sector 所有 zone 的三维坐标
- **并且** SHALL 以这些点的包围盒中心作为原始 center 基础
- **并且** SHALL 将 center 的 `x/z` 吸附到最近的 `64000` 倍数
- **并且** SHALL 将结果写入 `raw_center_pos`

#### Scenario: 缺少 zone 点时回退旧原点

- **前提** 某个 sector 没有可用的 zone 坐标
- **当** 系统生成或消费该 sector 的内部坐标
- **那么** 系统 SHALL 回退使用 `0,0,0` 作为 center

### Requirement: Sector Internal Scale Uses Full Zone Range

系统 MUST 使用包含全部 zone 坐标的点集参与 sector 内部缩放计算，而不是仅依赖星门或 `shcon`。

#### Scenario: 全部 zone 参与 scale_per_radius 计算

- **前提** 某个 sector 同时存在多个非 `shcon` zone
- **当** 系统计算 `scale_per_radius`
- **那么** 这些 zone 坐标 SHALL 参与最大半径计算
- **并且** 半径 SHALL 相对 `raw_center_pos` 计算

### Requirement: Sector Local Screen Ratio Projection

系统 MUST 将 sector 内部点位统一投影为“相对 center 偏移后再缩放”的 `sx/sy`。

#### Scenario: zone 点位投影

- **前提** zone 拥有 `raw_sector_pos.x/y/z`
- **当** 系统写入 `raw_sector_pos.sx/sy`
- **那么** `sx` SHALL 等于 `(x - center_x) * scale_per_radius`
- **并且** `sy` SHALL 等于 `-(z - center_z) * scale_per_radius`

#### Scenario: gate 与 highway 投影

- **前提** cluster gate 或 highway 点位位于某个 sector 内
- **当** 系统生成其 sector 局部比例坐标
- **那么** 系统 SHALL 使用与 zone 相同的 center 与 scale 语义

### Requirement: Sector Dataset Structure

系统 MUST 显式暴露新的 sector center 与 zone 局部坐标结构。

#### Scenario: sector 输出 raw_center_pos

- **前提** 系统序列化 sector 数据
- **当** 结果写入地图数据集
- **那么** sector SHALL 包含 `raw_center_pos: { x, y, z }`

#### Scenario: zone 使用 raw_sector_pos 取代 position

- **前提** 系统序列化 `zones[*]`
- **当** 结果写入地图数据集
- **那么** `zones[*]` SHALL NOT 输出旧 `position`
- **并且** `zones[*].raw_sector_pos` SHALL 包含 `x/y/z/sx/sy`

### Requirement: Sector Tooltip Center Display

系统 MUST 在 sector tooltip 中显示星区中心坐标摘要。

#### Scenario: tooltip 以 km 显示 center

- **前提** 用户打开某个 sector 的 tooltip
- **当** tooltip 渲染中心坐标
- **那么** 系统 SHALL 使用 `(xxkm, xxkm)` 格式显示 `raw_center_pos.x/z`
- **并且** 数值 SHALL 取整
