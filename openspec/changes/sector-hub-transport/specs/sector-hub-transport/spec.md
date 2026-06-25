# Sector Hub Transport Specification

## Purpose

本规格定义 live sector transit hub 页面右侧运输栏的展示、路径计算、距离口径、分类和异常归组行为。该能力用于让用户查看当前 transit hub station 到 linked sector group hub 与当前 group 内 stations 的运输路径成本。

## ADDED Requirements

### Requirement: Transit Hub SHALL replace right construction dashboard with transport panel

live transit hub 页面 SHALL 将右侧建设成本 `StationDashboard` 替换为运输栏。

#### Scenario: Transit page shows transport panel

- **前提** 用户处于 live production 的 transit hub 页面
- **当** 当前 workbench mode 为 `transit`
- **那么** 右侧栏 SHALL 显示 sector hub transport panel
- **并且** 右侧栏 SHALL NOT 显示建设成本 `StationDashboard`
- **并且** 左侧 transit hub build/module 列表 SHALL 保持现状

### Requirement: Transport panel SHALL group routes by Sector Group, Station, and Problems

运输栏 SHALL 按 `Sector Group`、`Station`、`问题组` 分类展示目标。

#### Scenario: Sector Group category lists linked hub stations

- **前提** 当前 active transit group 存在 `connectedGroupIds`
- **当** linked group 存在 transit hub station
- **那么** `Sector Group` 分类 SHALL 为该 linked group 创建一条 hub-to-hub route row
- **并且** 目标 station SHALL 是 linked group 的 transit hub station

#### Scenario: Station category lists local non-hub stations

- **前提** 当前 active transit group 有 anchor sector 与 coverage sectors
- **当** 当前 group 内存在非 transit hub station
- **那么** `Station` 分类 SHALL 按 sector 分组显示这些 station
- **并且** 当前 hub station SHALL NOT 作为目标显示
- **并且** linked group 的 transit hub station SHALL NOT 出现在 `Station` 分类

#### Scenario: Problem category receives incomplete routes

- **前提** 某个目标无法得到完整路径或完整距离数据
- **当** presenter 组装运输栏数据
- **那么** 该目标 SHALL 进入 `问题组`
- **并且** `问题组` SHALL 显示目标类型、目标名称、所属 sector 与问题节点列表

### Requirement: Route selection SHALL keep route candidates and select by distance without ship

路径算法 SHALL 允许内部生成 simple path 候选，不默认固定截断为 3 条，并在未选择运输船时选择普通距离最短的路径。

#### Scenario: Candidate route keeps enumerated paths

- **前提** 当前 hub 到目标存在多条不重复 sector 的候选路径
- **当** route builder 枚举候选路径
- **那么** 系统 SHALL 返回搜索上限内枚举到的候选路径
- **并且** 系统 SHALL 为每条候选输出普通距离、星门数、superhighway 距离与 engine/highway 摘要指标

#### Scenario: Candidate route uses normal distance first without selected ship

- **前提** 当前 hub 到目标存在多条候选路径
- **并且** 用户未选择运输船蓝图
- **当** 候选路径普通距离不同
- **那么** 系统 SHALL 选择普通距离最短的路径
- **并且** 普通距离 SHALL NOT 包含 superhighway 距离

#### Scenario: Candidate route uses gate count second without selected ship

- **前提** 当前 hub 到目标存在多条普通距离相同的候选路径
- **并且** 用户未选择运输船蓝图
- **当** 候选路径星门数不同
- **那么** 系统 SHALL 选择星门数最少的路径

#### Scenario: Candidate route tie keeps enumeration order

- **前提** 当前 hub 到目标存在多条普通距离与星门数均相同的候选路径
- **当** 系统选择最终路径
- **那么** 系统 SHALL 选择枚举顺序最靠前的候选

#### Scenario: Route does not repeat sectors

- **前提** route builder 枚举候选路径
- **当** 某条候选会重复经过同一 sector
- **那么** 该候选 SHALL 被排除

#### Scenario: Route beyond five gate jumps is discarded

- **前提** 当前 hub 到目标的唯一 simple path 需要超过 5 次 gate jump
- **当** route builder 枚举候选路径
- **那么** 系统 SHALL 不返回该路径作为有效候选
- **并且** 目标 SHALL 进入 route problem 状态

### Requirement: Route segments SHALL distinguish gates, superhighways, and normal distance

路径明细 SHALL 区分普通空间段、gate transit 与 superhighway 段。

#### Scenario: Gate transit counts gate but no distance

- **前提** 路径通过 gate 从 sector A 到 sector B
- **当** 系统生成路径段
- **那么** gate transit 段 SHALL 使星门数增加 1
- **并且** gate transit 段 SHALL NOT 增加普通距离
- **并且** 明细 SHALL 显示 gate transit 段

#### Scenario: Same-sector endpoint segment counts normal distance

- **前提** 路径在同一 sector 内从 gate A 到 gate B
- **当** 系统生成路径段
- **那么** 该段 SHALL 按端点坐标直线距离计入普通距离

#### Scenario: Superhighway counts displayed distance but no gate

- **前提** 路径通过 superhighway 从 sector A 到 sector B
- **当** 系统生成路径段
- **那么** superhighway 段 SHALL NOT 增加星门数
- **并且** superhighway 段 SHALL 使用两端点坐标直线距离
- **并且** superhighway 段距离 SHALL 在明细显示
- **并且** superhighway 段距离 SHALL NOT 计入摘要普通距离
- **并且** superhighway 段距离 SHALL NOT 作为路径排序第二关键字

### Requirement: Sector Group rows SHALL summarize hub-to-hub transport

`Sector Group` 分类 SHALL 以折叠摘要与展开明细展示当前 hub 到 linked hub station 的运输路径。

#### Scenario: Sector Group collapsed row shows summary

- **前提** linked group route 可完整计算
- **当** route row 处于折叠状态
- **那么** row SHALL 显示普通总距离
- **并且** 普通总距离 SHALL NOT 包含 superhighway 距离
- **并且** row SHALL 显示星门数、target sector 与 target station

#### Scenario: Sector Group expanded row shows segment details

- **前提** linked group route row 被展开
- **当** 用户查看明细
- **那么** 明细 SHALL 显示每段路径端点
- **并且** 明细 SHALL 显示每段距离
- **并且** 明细 SHALL 显示 gate transit 段
- **并且** 明细 SHALL 显示 superhighway 段及其距离
- **并且** 明细 SHALL 显示末端点到 target hub station 的距离

#### Scenario: Sector Group rows sort by transport summary

- **前提** `Sector Group` 分类存在多条 route rows
- **当** 系统展示 rows
- **那么** rows SHALL 按星门数少、普通总距离短、group order 排序

### Requirement: Station category SHALL use sector-level route then station distance

`Station` 分类 SHALL 先展示到目标 sector 末端点的 sector-level route，再展示末端点到 station 的距离。

#### Scenario: Station sector group uses gate terminal

- **前提** 到目标 sector 的最后连接是 gate
- **当** 系统生成 station sector group
- **那么** sector 层末端点 SHALL 是目标 sector 的 gate
- **并且** sector 层普通距离 SHALL 计算到该 gate

#### Scenario: Station sector group uses superhighway exit terminal

- **前提** 到目标 sector 的最后连接是 superhighway
- **当** 系统生成 station sector group
- **那么** sector 层末端点 SHALL 是目标 sector 的 superhighway exit
- **并且** 明细 SHALL 包含 superhighway 段距离
- **并且** sector 层摘要普通距离 SHALL NOT 包含 superhighway 段距离

#### Scenario: Station sector group expands to route details

- **前提** Station 分类中的 sector group 被展开
- **当** 用户查看路径明细
- **那么** 明细 SHALL 显示从当前 hub 到目标 sector 末端点的路径段
- **并且** 该明细末端 SHALL NOT 是 station

#### Scenario: Station row shows station-specific transport distance

- **前提** 当前 sector group 下存在 station
- **当** 系统展示 station row
- **那么** row SHALL 显示 station name、station code 与 station 坐标
- **并且** row SHALL 显示末端点到 station 的距离
- **并且** row SHALL 显示 sector 层普通距离加末端点到 station 距离

#### Scenario: Station rows sort by production line count

- **前提** 同一 sector 下存在多个 station rows
- **当** 系统展示 station rows
- **那么** station rows SHALL 按 production 产线数量从高到低排序
- **并且** production 产线数量 SHOULD 使用正向产出 production flows 的 distinct ware 数量

### Requirement: Highway SHALL provide route alternative within sectors

当 sector 内存在 highway 数据时，系统 SHALL 为 sector 内普通空间段生成 highway 路径替代。

#### Scenario: Highway alternative generated for in-sector segment

- **前提** sector 内有 `sector.highways` 数据
- **并且** 该 sector 内存在普通空间段（hub→gate、gate→gate 或 gate→station）
- **当** segment 展开阶段计算路径
- **那么** 系统 SHALL 为符合条件的 highway 生成替代 segment 方案
- **并且** highway 替代 SHALL NOT 参与 route builder 的 sector 级图搜索
- **并且** 每条路径候选 SHALL 使用自身 segment 的 `fromPosition` 与 `toPosition` 独立计算 highway 替代
- **并且** 不同候选即使经过同一 sector，也 SHALL NOT 复用按 sector 缓存的 highway 方案

#### Scenario: Highway direction check

- **前提** 某 highway 的 P_entry spline 参数 >= P_exit spline 参数
- **当** 系统检查 highway 候选
- **那么** 该 highway SHALL 被剔除（方向不吻合）

#### Scenario: Highway filtered by ramp distance

- **前提** 直达距离 < highway approach + exit 距离
- **当** 系统评估 highway 候选
- **那么** 该 highway 候选 SHALL 被剔除

#### Scenario: Gate adjacent highway removes approach segment

- **前提** gate 到 highway entry/exit 距离 < 1km
- **当** 系统生成 highway 替代路径
- **那么** 该 approach/exit 段 SHALL 从路径展示中移除
- **并且** 移除的段 SHALL NOT 渲染距离

### Requirement: Highway ring chain SHALL provide route candidates

route builder SHALL consume `maps.highwayRingChains` and merge highway ring candidates with ordinary BFS route candidates.

#### Scenario: Highway ring candidate is merged into route candidates

- **前提** `maps.highwayRingChains` 存在跨 sector 环形高速 chain
- **并且** 当前 hub 到目标可以通过该 chain 形成路线
- **当** route builder 枚举候选路径
- **那么** 系统 SHALL 返回至少一条包含 `highway` segment 的 ring candidate
- **并且** 该候选 SHALL 设置 `highwayDistanceKm > 0`
- **并且** 该候选 SHALL 设置 `highwayGateCount > 0`
- **并且** 该候选 SHALL 满足 `engineDistanceKm < normalDistanceKm`

### Requirement: Map SHALL highlight gate links that are part of highway rings

地图界面 SHALL 对高速环路中属于普通星门连接的部分使用高亮样式。

#### Scenario: Highway ring gate link is highlighted once

- **前提** `maps.highwayRings` 中某条跨 cluster 普通星门连接的两个端点 gate 都属于高速环路 gate
- **当** 地图界面渲染跨 cluster gate line
- **那么** 系统 SHALL 将该 gate line 视为高速环路的一部分
- **并且** 系统 SHALL 只绘制一次该 gate line
- **并且** 该 gate line SHALL 使用高亮黄色
- **并且** 该 gate line SHALL 使用普通 gate line 的 1.5 倍线宽

#### Scenario: One-sided highway ring gate is not highlighted

- **前提** 某条跨 cluster 普通星门连接只有一个端点 gate 属于 `maps.highwayRings`
- **当** 地图界面渲染跨 cluster gate line
- **那么** 系统 SHALL NOT 将该 gate line 视为高速环路的一部分
- **并且** 该 gate line SHALL 保持普通 gate line 样式

### Requirement: Transport distances SHALL use km display precision

运输栏距离与坐标 SHALL 使用 km 单位和稳定精度。

#### Scenario: Segment distances display in km

- **前提** 路径段有可计算距离
- **当** 系统展示该段
- **那么** 距离 SHALL 以 km 显示
- **并且** 精度 SHALL 为 0.1 km

#### Scenario: Station coordinates display in km

- **前提** station 有 meter 坐标
- **当** 系统展示 station row
- **那么** station 坐标 SHALL 转换为 km 显示
- **并且** 精度 SHALL 为 0.1 km
