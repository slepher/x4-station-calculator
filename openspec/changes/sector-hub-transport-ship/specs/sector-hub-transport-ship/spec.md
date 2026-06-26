# Sector Hub Transport Ship Specification

## Purpose

本规格定义 live transit hub 页面在现有运输路线距离展示基础上，基于用户选择的收藏运输船蓝图计算并展示路线耗时与单程吞吐量的行为。该能力用于让用户用指定配装评估 transit hub 到 linked sector group hub 与当前 group 内 stations 的运输效率。

## ADDED Requirements

### Requirement: Transit Hub SHALL provide favorite transport blueprint selection

live transit hub 页面 SHALL 在建筑区下方提供运输船蓝图选择区，候选来自 ship-build 收藏蓝图。

#### Scenario: Show empty favorite prompt

- **前提** 用户处于 live transit hub 页面
- **并且** ship-build 中不存在可用的收藏运输船蓝图
- **当** 页面渲染运输船选择区
- **那么** 系统 SHALL 显示提示用户前往 ship-build 收藏运输船蓝图
- **并且** 系统 SHALL 提供前往 ship-build 的操作入口

#### Scenario: Show grouped favorite transport blueprints

- **前提** ship-build 中存在收藏蓝图
- **并且** 收藏蓝图对应飞船的 `type` 是 `freighter` 或 `transporter`
- **并且** 收藏蓝图具备有效引擎配装
- **当** 页面渲染运输船选择区
- **那么** 系统 SHALL 按飞船分组展示候选蓝图
- **并且** 分组标题 SHALL 显示飞船名与 container cargo
- **并且** 蓝图行 SHALL 显示引擎配装列表（名称 × 数量）与计算参数 chips

#### Scenario: Filter unavailable blueprints

- **前提** 收藏蓝图对应飞船不是 `freighter` 或 `transporter`
- **或** 收藏蓝图缺少有效引擎配装
- **或** 收藏蓝图引用的 ship/equipment 不可用
- **当** 系统组装运输船候选
- **那么** 该蓝图 SHALL 不出现在候选列表中

#### Scenario: Clear selected blueprint when it becomes unavailable

- **前提** 用户已选择某个运输船蓝图
- **当** presenter 判定该蓝图不再是可用候选
- **那么** 系统 SHALL 清空当前选择
- **并且** 选择区 SHALL 回到请选择或收藏提示状态

### Requirement: Transport blueprint candidates SHALL be sorted by transport relevance

运输船候选 SHALL 按 cargo 与指定配装巡航速度排序。

#### Scenario: Sort ship groups by container cargo

- **前提** 存在多个飞船分组
- **当** 系统展示候选列表
- **那么** 分组 SHALL 按飞船 container cargo 从大到小排序

#### Scenario: Sort blueprints by travel speed

- **前提** 同一飞船分组下存在多个收藏蓝图
- **当** 系统展示组内蓝图
- **那么** 蓝图 SHALL 按配装巡航速度 `V_travel` 从高到低排序
- **并且** 巡航速度相同时 SHALL 按蓝图名排序

### Requirement: Selected transport blueprint SHALL estimate travel parameters

系统 SHALL 从指定收藏蓝图的配装与船体数据计算运输耗时所需参数。

#### Scenario: Aggregate engine parameters from blueprint

- **前提** 收藏蓝图包含 engine connections
- **当** 系统计算运输船 travel profile
- **那么** `V_base` SHALL 使用有效引擎 `thrust.forward * count` 总和除以 `ship.physics.drag.forward`
- **并且** `V_travel` SHALL 使用有效引擎 `thrust.forward * travel.thrust * count` 总和除以 `ship.physics.drag.forward`
- **并且** `t_charge` SHALL 使用有效引擎 `travel.charge` 最大值
- **并且** `t_attack` SHALL 使用有效引擎 `travel.attack` 最大值
- **并且** `t_release` SHALL 使用有效引擎 `travel.release` 最大值

#### Scenario: Show engine list and travel input chips

- **前提** 蓝图存在有效 travel profile
- **当** 系统渲染蓝图候选行
- **那么** 蓝图行 SHALL 显示引擎配装列表（各引擎的 i18n 名称 × 数量）
- **并且** 蓝图行 SHALL 显示速度、巡航速度、充能时间、加速时间、加速距离、减速时间、减速距离 chips
- **并且** 飞船名与引擎名 SHALL 通过 `useX4I18n` 模块进行 i18n

### Requirement: Route travel time SHALL use segment-level QSNA-style model

系统 SHALL 使用真实 route segment 距离计算普通空间段耗时，并跳过 gate transit 与 superhighway 耗时。

#### Scenario: Selected ship route candidate uses fastest travel time

- **前提** 当前 hub 到目标存在多条 route 候选
- **并且** 用户选择了可用运输船蓝图
- **当** 系统组装最终展示路线
- **那么** 系统 SHALL 先按选中运输船 class 构造候选池
- **并且** L/XL 船 SHALL 只保留在 `gateCount` 与 `normalDistanceKm` 中至少一项不劣于其它候选的路线
- **并且** S/M 船 SHALL 以 `gateCount`、`normalDistanceKm`、`engineDistanceKm`、`engineGateCount` 构造候选池
- **并且** 系统 SHALL 对候选池内路线分别计算真实耗时
- **并且** 系统 SHALL 选择总耗时最短的候选
- **并且** 当总耗时相同时 SHALL 选择普通距离最短的候选
- **并且** 当仍无法区分时 SHALL 选择枚举顺序最靠前的候选

#### Scenario: Estimate long normal segment

- **前提** 路径段是普通空间段
- **并且** 距离大于加速距离与减速距离之和
- **当** 系统计算该段耗时
- **那么** 系统 SHALL 使用 `charge + attack + cruise + release` 模型
- **并且** `charge` SHALL 对该段完整计入

#### Scenario: Estimate short normal segment by peak speed

- **前提** 路径段是普通空间段
- **并且** 距离不足以达到最高巡航速度
- **当** 系统计算该段耗时
- **那么** 系统 SHALL 使用峰值速度模型计算加速与减速耗时
- **并且** `charge` SHALL 对该段完整计入

#### Scenario: Ignore gate and superhighway time

- **前提** 路径段是 `gate-transit` 或 `superhighway`
- **当** 系统计算路线耗时
- **那么** 该段 SHALL 不增加耗时
- **并且** 该段 SHALL 不显示段耗时

#### Scenario: Zero distance normal segment has zero time

- **前提** 普通空间距离小于或等于 0
- **当** 系统计算该段耗时
- **那么** 该段耗时 SHALL 为 0
- **并且** 该段 SHALL 不计入 `charge`

### Requirement: Highway segment SHALL use fixed speed timing

Highway 段 SHALL 使用固定速度 12,000 m/s 计算耗时，不依赖引擎参数。

#### Scenario: Highway segment time uses fixed speed

- **前提** 路线包含 highway 段
- **并且** highway 段有 spline 弧长距离
- **当** 系统计算 highway 段耗时
- **那么** highway 段耗时 SHALL 等于 `highwayDistanceKm / 12`
- **并且** highway 段 SHALL NOT 使用引擎 charge/attack/release 参数

#### Scenario: S/M ships may use highway

- **前提** 选中的运输船 class 为 `ship_s` 或 `ship_m`
- **并且** sector 内存在可用 highway 候选
- **当** 系统比较 highway 与非 highway 方案
- **那么** highway 方案 SHALL 被纳入时间比较

#### Scenario: L/XL ships SHALL NOT use highway

- **前提** 选中的运输船 class 为 `ship_l` 或 `ship_xl`
- **当** 系统计算路线耗时
- **那么** highway 方案 SHALL NOT 被使用
- **并且** 总耗时 SHALL 仅使用非 highway 方案

#### Scenario: Gate adjacent highway skips approach time

- **前提** gate 到 highway entry/exit 距离 < 1km
- **当** 系统计算 highway 方案的 approach/exit 段耗时
- **那么** 该段耗时 SHALL 为 0
- **并且** 该段 SHALL 从路径展示中移除

#### Scenario: No ship selected defaults to non-highway

- **前提** 用户未选择运输船蓝图
- **当** 系统展示运输路线
- **那么** 路径 SHALL 使用非 highway 方案

### Requirement: Transport route rows SHALL show selected-ship estimates

选择运输船后，右侧运输路线 SHALL 在现有距离展示基础上增加耗时与单程吞吐量。

#### Scenario: Keep existing route display without selection

- **前提** 用户未选择运输船蓝图
- **当** 系统展示运输路线
- **那么** 现有距离、星门数、路径明细 SHALL 保持可见
- **并且** 耗时与单程吞吐量字段 SHALL 不显示

#### Scenario: Sector group route shows time and throughput

- **前提** 用户选择了可用运输船蓝图
- **并且** Sector Group route 可完整计算
- **当** 系统展示 Sector Group row
- **那么** row 摘要 SHALL 以 metric chip 显示总耗时
- **并且** row 摘要 SHALL 以 metric chip 显示单程吞吐量
- **并且** 展开明细 SHALL 为每个普通空间段显示段耗时

#### Scenario: Same-sector station hides sector header and shows station estimates

- **前提** Station 分类中的目标 station 与当前 hub 在同一星区
- **并且** 用户选择了可用运输船蓝图
- **当** 系统展示 Station 分类
- **那么** 系统 SHALL 隐藏该 station 所在的 sector header
- **并且** station row SHALL 显示耗时与单程吞吐量

#### Scenario: Cross-sector station shows sector and station estimates

- **前提** Station 分类中的目标 station 与当前 hub 不在同一星区
- **并且** 用户选择了可用运输船蓝图
- **当** 系统展示 Station 分类
- **那么** sector row SHALL 显示到目标 sector terminal 的耗时
- **并且** sector 展开明细 SHALL 为每个普通空间段显示段耗时
- **并且** station row SHALL 显示星区内耗时、总耗时与单程吞吐量

### Requirement: Throughput SHALL use one-way container cargo per hour

单程吞吐量 SHALL 固定使用 container cargo 和包含装卸时间的单程总耗时计算。

#### Scenario: Calculate one-way throughput

- **前提** 运输船存在 container cargo
- **并且** 路线总耗时大于 0
- **当** 系统计算单程吞吐量
- **那么** 单程吞吐量 SHALL 等于 `containerCapacityM3 / oneWayTimeSec * 3600`
- **并且** 单位 SHALL 为 `m3/h`
- **并且** 显示值 SHALL 为整数

#### Scenario: Include loading and unloading time

- **前提** 用户选择了可用运输船蓝图
- **当** 系统计算单程总耗时
- **那么** 上货时间 SHALL 等于 `containerCapacityM3 / (10 * (4000 / 60))`，其中 `4000` 为每架货运无人机单趟搬运量（m³/trip），`60` 为单趟耗时（s/trip），`10` 为运输船与空间站共同参与后的并发上限
- **并且** 卸货时间 SHALL 使用同一公式
- **并且** 若运输船自身货运无人机不足，系统 SHALL 按空间站补足到并发上限处理
- **并且** 单程总耗时 SHALL 包含飞行耗时、上货时间和卸货时间
- **并且** 路线明细 SHALL 在“离港至出口星门”之前显示上货时间
- **并且** 路线明细 SHALL 在“入口星门至目标空间站”之后显示卸货时间

#### Scenario: Do not calculate throughput for zero time

- **前提** 路线总耗时为 0
- **当** 系统计算单程吞吐量
- **那么** 系统 SHALL 不显示有效吞吐量数值
