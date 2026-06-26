# sector-hub-transport-ship Design

## 背景

`sector-hub-transport` 已经在 live transit hub 右侧展示路径、普通距离、星门数、superhighway 明细和问题组。本变更在此基础上增加一个非持久的“指定运输船配装”参数，用于把已有 route segment 距离转换为耗时与单程吞吐量。

现有可复用能力：

- `src/store/logic/transitRouteBuilder.ts` 已输出 `segments`、`summary`、`terminal` 与问题信息。
- `src/components/empire/presenters/useTransitTransportPresenter.ts` 已组装 Sector Group 与 Station 分类。
- `src/store/useShipBuildStore.ts` 已保存 ship-build 蓝图、收藏状态、ship/equipment map。
- `src/components/ship-build/ShipBuildPanelStats.vue` 与 `src/composables/useEquipmentStats.ts` 已验证船体 physics 与 engine travel 参数的计算口径。

## 架构

继续遵守 `store -> presenter -> vue`：

- store：
  - `useLiveProductionStore` 增加非持久 `selectedTransitTransportBlueprintId` 与 setter。
  - ship-build store 继续作为蓝图、ship、equipment 数据源，不感知 transit hub。
- presenter：
  - transit transport presenter 负责组装运输船候选、选择有效性、路线耗时与吞吐量。
  - presenter 输出 Vue 可直接渲染的分组、chips 和 `travel` 估算对象。
- vue：
  - 左侧 transit hub 建筑区下方渲染运输船选择区。
  - 右侧 transport panel 渲染 presenter 输出的 metric chips 与段耗时。
  - Vue 不直接拼装 ship-build store 数据。

建议新增纯逻辑模块承载 travel profile 与 segment time 计算，避免把公式写在 Vue 或 presenter 内。

## 数据流

```text
ship-build saved blueprints
  -> favorite freighter/transporter filter
  -> valid travel profile builder
  -> grouped candidate view model
  -> selected blueprint id in useLiveProductionStore

transit route builder output
  -> route candidates with gate/normal/engine/highway metrics
  -> ship-class candidate pool
  -> selected route segments
  -> selected travel profile
  -> segment travel estimates
  -> row-level travel summaries
  -> transport panel view model
```

## 运输船候选模型

候选来源为收藏蓝图，并通过以下条件过滤：

1. `blueprint.favorite === true`
2. `ship.type === 'freighter' || ship.type === 'transporter'`
3. ship 存在 container cargo
4. blueprint 中有可用 engine equipment
5. travel profile 有效：
   - `V_base > 0`
   - `V_travel > V_base`
   - `t_attack > 0`
   - `t_release > 0`
   - `t_charge >= 0`

分组按 ship，标题显示 `ship display name + container cargo`。组排序按 container cargo 降序，组内蓝图按 `V_travel` 降序。

## Travel Profile

基于指定配装聚合：

```ts
type TransportShipTravelProfile = {
  blueprintId: string
  shipId: string
  containerCapacityM3: number
  baseSpeedMps: number
  travelSpeedMps: number
  chargeSec: number
  attackSec: number
  releaseSec: number
  attackDistanceKm: number
  decelDistanceKm: number
  cargoDroneCount: number
  engines: Array<{ equipmentId: string; count: number; name: string }>
}
```

聚合口径：

```text
baseThrust = sum(engine.thrust.forward * count)
travelThrust = sum(engine.thrust.forward * engine.travel.thrust * count)

V_base = baseThrust / ship.physics.drag.forward
V_travel = travelThrust / ship.physics.drag.forward

t_charge = max(engine.travel.charge)
t_attack = max(engine.travel.attack)
t_release = max(engine.travel.release)

d_attack_km = ((V_base + V_travel) / 2) * t_attack / 1000
d_decel_km = ((V_travel + V_base) / 2) * t_release / 1000
```

`cargoDroneCount` 从蓝图 `storage.drones` 中统计 `purposePrimary === 'trade'` 的货运无人机数量，并按单船最多 10 架并行装卸封顶。

## Segment Time Formula

只对普通空间段和 `highway` 段计算耗时。`gate-transit` 与 `superhighway` 不增加耗时。

## Route Candidate Selection With Ship

`sector-hub-transport` 的 route builder 输出 simple path 候选及候选摘要。选择运输船后，presenter 先按船型构造候选池，再对池内每条候选独立展开 highway 替代并计算真实总耗时，然后按以下顺序选择最终展示路径：

1. `travelTimeSec` 升序
2. `normalDistanceKm` 升序
3. 枚举顺序

候选池规则：

- 未选船时不使用 highway，仍按 `normalDistanceKm asc -> gateCount asc -> 枚举顺序` 取最终路线。
- L/XL 船不可使用 highway/ring 优势，候选池只比较 `gateCount` 与 `normalDistanceKm`；若某候选两项均劣于另一候选，则丢弃。
- S/M 船可使用 highway/ring 优势，候选池比较 `gateCount`、`normalDistanceKm`、`engineDistanceKm`、`engineGateCount`；若某候选四项均劣于另一候选，则丢弃。
- `engineDistanceKm` 与 `engineGateCount` 表示去除 highway 行进部分后仍需普通引擎处理的路程与星门数。非 highway 候选中它们分别等于 `normalDistanceKm` 与 `gateCount`。

不同候选即使经过同一个 sector，也必须使用该候选具体 segment 的 `fromPosition` 与 `toPosition` 独立计算 highway 替代；不得按 sector 复用 highway 方案。

### 普通空间段耗时

长距离段：

```text
if D_km > d_attack_km + d_decel_km:
  timeSec =
    t_charge
    + t_attack
    + (D_km - d_attack_km - d_decel_km) / (V_travel / 1000)
    + t_release
```

短距离段：

```text
a_up = (V_travel - V_base) / t_attack
a_down = (V_travel - V_base) / t_release

V_peak = sqrt(
  V_base^2 + 2 * (D_km * 1000) / (1 / a_up + 1 / a_down)
)

timeSec =
  t_charge
  + (V_peak - V_base) / a_up
  + (V_peak - V_base) / a_down
```

`D_km <= 0` 时返回 0，不加 `charge`。

### Highway 段耗时

Highway 段使用 **固定速度 12,000 m/s**，非引擎相关：

```text
highwayTimeSec = highwayDistanceKm / 12
```

Highway 段不涉及 charge/attack/release 引擎参数。

### Highway approach 段耗时

上高速无需减速。飞船直接以巡航速度进入高速，速度瞬间切换为 12,000 m/s。使用 `skipRelease` 模式：

```text
approachTimeSec = estimateSegmentTravelTimeSec(D_km, profile, { skipRelease: true })
```

- 长距离：`charge + attack + cruise`（无 release）
- 短距离：`charge + attack`（仅加速到可达速度，无 decel 段）

### Highway exit 段耗时

下高速后飞船断崖式降速至 V_base，需重新蓄能加速。无额外固定时间惩罚，使用标准普通空间段耗时：

```text
exitTimeSec = estimateSegmentTravelTimeSec(D_km, profile)
```

即完整的 `charge + attack + cruise + release` 模型。

### Gate 紧贴 Highway 的捷径

当 origin 或 destination 到 highway P_entry/P_exit 距离 < 1km（gate 紧贴）时：
- 该 approach/exit 段从路径展示中移除，不渲染

### 船型限制

- **S/M 船**（`ship.class === 'ship_s' || ship.class === 'ship_m'`）：highway 可用
- **L/XL 船**（`ship.class === 'ship_l' || ship.class === 'ship_xl'`）：highway 不可用，仅非 highway 方案
- 未选船时，view 层默认使用非 highway 方案

### 方案选择（S/M 船）

S/M 船不是只比较单条路线内的“方案A vs 方案B”，而是在候选池内对每条候选使用自身 segment 端点生成 highway 替代，再按总耗时选择最终路线。

方案A 的耗时 = 所有普通空间段的 engine travel time 之和。
方案B 的耗时 = approach/exit 的 engine travel time + highway 段固定时间。

## Row Travel Estimates

使用嵌套 `travel` 对象，不污染 row 顶层字段。

```ts
type TransportTravelEstimate = {
  timeSec: number
  flightTimeSec: number
  loadingTimeSec: number
  unloadingTimeSec: number
  formattedTime: string
  throughputM3PerHour?: number
  formattedThroughput?: string
}

type TransportSegmentTravel = {
  timeSec: number
  formattedTime: string
}

type StationTravelEstimate = {
  localTimeSec: number
  totalTimeSec: number
  loadingTimeSec: number
  unloadingTimeSec: number
  formattedLocalTime: string
  formattedTotalTime: string
  throughputM3PerHour?: number
  formattedThroughput?: string
}
```

装卸时间：

```text
cargoTransferTimeSec = containerCapacityM3 / (min(cargoDroneCount, 10) * (4000 / 60))
```

其中：
- `4000` — 每架货运无人机单趟搬运量（m³/trip），来自游戏内实测经验数据
- `60` — 每架货运无人机单趟搬运耗时（s/trip），来自游戏内实测经验数据
- `4000 / 60` — 每架无人机的搬运速率（m³/s）

- 上货和卸货各计算一次。
- `timeSec` / `totalTimeSec` 包含飞行、上货、卸货。
- `flightTimeSec` 仅保存 route segment 飞行耗时。
- `cargoDroneCount <= 0` 时装卸时间为 0，不显示装卸明细行。

Sector Group:

- row `summary.normalDistanceKm` 从最终展示 segments 重新汇总；当选中路线把普通空间段替换为 highway-approach / highway / highway-exit 时，总路程使用替换后的 segments，不沿用原 route summary。
- row `travel.timeSec` 为最终展示 segments 的耗时之和加上上货/卸货时间。
- row `travel.throughputM3PerHour` 使用 row 总耗时。
- segment 仅普通空间段带 `travel`。

Station:

- sector group `travel.timeSec` 为到目标 sector terminal 的耗时。
- 同星区 station group 输出 `hideSectorHeader: true`。
- station row 输出自身 `summary` 与 `segments`，Vue 直接用它渲染可展开的本地路径。
- station row `summary.normalDistanceKm` 为 sector group 最终总路程 + 本地最后一段最终总路程。
- station row `segments` 只包含 terminal/origin 到 station 的本地最后一段，不包含跨星区 sector route。
- station row `travel.localTimeSec` 为 terminal/origin 到 station 的本地最后一段耗时；如果本地最后一段使用 highway 替代，则按 highway-approach / highway / highway-exit 之和计算。
- station row `travel.totalTimeSec` 为 sector 耗时加 local 耗时，再加上上货/卸货时间；同星区时 local 等于飞行段 local。
- station row `travel.throughputM3PerHour` 使用 station 总耗时。

## Formatting

- 耗时：
  - `< 60min` 显示 `Xm Ys`
  - `>= 60min` 显示 `Xh Ym`
- 吞吐量：
  - `Math.round(value)` + `m3/h`
- 距离与坐标继续沿用 `sector-hub-transport` 已有 0.1 km 口径。

## UI Notes

左侧选择区：

- 无候选：提示收藏运输船蓝图，并提供前往 ship-build 按钮。
- 有候选未选择：显示“选择运输船以计算耗时与单程吞吐量”。
- 分组标题显示飞船名和 cargo。
- 蓝图行显示引擎配装列表（各引擎 `name × count`）与 chips：速度、巡航、充能、加速、加速距、减速、减速距。
- 飞船名与引擎名通过 `useX4I18n` (`translateShip` / `translateEquipment`) 进行 i18n。

右侧运输路线：

- 摘要层新增耗时和单程吞吐量 metric chip。
- Sector Group row、Station sector row、Station row 使用统一摘要结构：标题、可选副标题、两列指标网格。左列为总路程/耗时，右列为星门数或数量/单程吞吐量。
- Sector Group row 的副标题由目标 station/sector 组成；当副标题与标题相同时隐藏，且不保留副标题空白。
- 未选择运输船时，耗时与单程吞吐量不渲染，也不预留空行；station row 只显示总路程与产线数。
- 明细层每个普通空间段显示耗时列。
- 明细层在 `station-to-gate` 前插入“上货时间”行，在 `gate-to-station` 后插入“卸货时间”行；station 本地最后一段使用 highway 时，允许在最后一个 `highway-exit` 后插入“卸货时间”行。装卸行不显示距离。
- `gate-transit` 和 `superhighway` 不显示耗时。
- 未选择运输船时不渲染新增耗时/吞吐量 UI。
- Station row 的摘要排版对齐 Sector Group row：直接显示总路程、总耗时、单程吞吐量的值，不显示“总路程/耗时/单程吞吐”等 label。
- Station row 的副信息只显示非重复 station code；不显示星区名，且当 code 为空或与 station 名称相同时隐藏副信息。
- Station row 使用产物摘要替代产线数，产物摘要单独占一行，不参与距离/耗时/吞吐指标网格。产物从 `StationDerivedMap.getCache(stationId)` 的 `productionFlows` 与 `warePriorityLevels` 读取，过滤 `flow.netRate > 0 && priority > 0`，不再用静态 module outputs 推断。
- Station 产物排序为 priority 降序、tier 降序、名称升序。摘要最多显示前两个产物，超出显示 `+N`；无产物时摘要显示“无产物”。展开内容只在有产物时用 li 显示完整产物列表，无产物时不渲染产物标题和列表。
- Station row 可展开；展开内容只渲染本地最后一段 `segments`。若最后一段未使用 highway，展示 terminal/origin 到 station 一段；若最后一段使用 highway，展示 highway-approach / highway / highway-exit 路径。连续 highway 段按 highway 起点星区归组，避免 `highway-exit` 使用 station code 单独开标题。
- Sector Group 展开内容不因 Station row 调整而改变。

## 引擎配装 Stat

本变更同步修改 `ShipBuildPanelEquipment.vue` 引擎装备详情展示：

- `travel.release` 作为引擎 stat 字段加入展示，i18n 标签为 `"巡航脱离时间"` / `"Travel Release Time"`。
- 原有 `equipment_travel_attack` i18n 标签从 `"渐进加速期"` / `"Travel Ramp-Up"` 更新为 `"巡航加速时间"` / `"Travel Attack Time"`。

## 风险与约束

- 本模型是宏观估算，不模拟 pilot、AI、IS/OOS、align、靠站、真实过门等待。
- superhighway 仍可出现在现有路径里，但本变更不计算其耗时。
- 选择状态不持久化，刷新后会丢失，这是已确认行为。
