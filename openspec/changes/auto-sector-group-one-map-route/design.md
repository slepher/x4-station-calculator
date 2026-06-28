# auto-sector-group-one-map-route Design

## 背景

`sector-hub-transport` 已经实现 transit hub 到 linked hub station 的 route candidate 算法，并在 transit transport presenter 中用于 `Sector Group` 路径展示。`auto-sector-group-one-map` 已经定义地图 binding-sector 使用 shared draft 的数据切换规则；普通地图模式不显示 binding 专用的 hub route overlay。

本变更把 hub link route candidates 前移到 `useLiveProductionStore` 预计算，并把同一份结果提供给：

- 地图 hub link route overlay。
- transit hub 运输栏中的 `Sector Group` link 路径。

## 已知代码入口

- `src/store/useLiveProductionStore.ts`：维护 active binding、shared draft `autoGroupResult`、virtual station draft、active transit context。本变更的 route cache 应放在这里。
- `src/store/logic/transitRouteBuilder.ts`：已有 route candidate 算法，输出 `TransitRouteResult`、segments、summary、terminal 与 problems。
- `src/components/empire/presenters/useTransitTransportPresenter.ts`：当前 `Sector Group` link 路径在 presenter 中计算。本变更应让它读取 store 预计算结果。
- `src/components/map/MapWorkbenchView.vue`：地图页面状态与 `sectorGroupColorMap` 数据源切换入口。
- `src/components/map/MapSvgCanvas.vue`：地图 SVG canvas，适合接收 hub link route overlay props。
- `src/components/map/layers/MapLinkLayer.vue`：现有 gate、superhighway、highway、cross-cluster gate line 渲染层，可新增或旁路一个 route layer。
- `src/composables/useMapSvgLinks.ts`：现有 gate/superhighway/highway 点位转换逻辑，可参考 endpoint 到 screen coordinate 的转换。

## 架构

继续遵守 `store -> presenter -> vue`：

- store：
  - 保存全局单份 hub link route cache。
  - 基于当前 binding/draft 中出现过的 link、map data 与 station positions 预计算缺失的 route candidates。
  - binding/draft 当前 link 集合只用于过滤全局 cache 的显示视图，不拥有独立 route 数据。
  - 输出领域语义结构，不输出面向组件排版的 view model。
- presenter：
  - transit transport presenter 读取 store 中的预计算 hub link route。
  - 对 `Sector Group` row 做 UI 所需排序、travel estimate、文案前数据拼装。
  - `Station` 分类路径暂不迁移，继续沿用现有计算。
- vue/map：
  - 地图只接收已经计算好的 route overlay 数据。
  - 地图负责 screen coordinate 转换与 SVG 绘制，不负责 route builder 调用。
  - route overlay 只由 binding-sector 界面状态决定是否渲染，不改变 store route cache。

## 数据模型

建议新增 store 侧 route cache 结构：

```ts
type HubLinkRouteEndpoint = {
  groupId: string
  sectorMacro: string
  stationLabel: string
  position: { x: number; y: number; z: number }
}

type HubLinkRouteEntry = {
  id: string
  fromGroupId: string
  toGroupId: string
  from: HubLinkRouteEndpoint
  to: HubLinkRouteEndpoint
  colorGroupId: string
  color?: string
  candidates: TransitRouteResult[]
  problems: string[]
}

type HubLinkRouteCache = {
  entries: HubLinkRouteEntry[]
  binding: HubLinkRouteEntry[]
  draft: HubLinkRouteEntry[]
}
```

`id` 使用稳定路径 key，不使用 `binding` / `draft` scope，也不只使用 group id。路径 key 由两端实际 endpoint 生成：

```text
<minEndpointToken>:<maxEndpointToken>
endpointToken = <sectorMacro>@<roundedX>,<roundedY>,<roundedZ>
```

这样可以避免 A->B 与 B-A 在地图上重复绘制，也保证相同路径端点在 binding 与 draft 中引用同一份路径数据。sector hub 切换导致 sector 或 position 变化时，会自然生成新的路径 key；旧 key 对应的路径继续保留在全局 cache，但只要当前 link 集合不再引用它，就不会显示。

## route 生成

store 生成 link route 时：

1. 遍历 groups。
2. 对每个 group 的 `connectedGroupIds` 找到 linked group。
4. 解析两端 hub station：
   - persisted binding 使用 `BindingSectorGroup.tradeStation`。
   - draft 使用 draft group 的 trade station 信息；若 virtual trade station position 存在，应作为 draft 端点位置来源。
5. 根据两端 hub station 的 `sectorMacro + position` 生成稳定无向路径 key。
6. 通过稳定路径 key 去重。
7. 如果全局 cache 中已经存在该路径 key，则不重复计算。
8. 如果全局 cache 中不存在该路径 key，则调用 `buildTransitRouteCandidates`。
9. 过滤掉 `problems.length > 0` 的候选后写入 `candidates`。
10. 若端点缺失或全部候选不完整，写入 `problems`，但地图 overlay 不绘制该 entry。

route algorithm 的口径不在本变更中修改：simple path、gate jump 上限、gate/superhighway/highway/ring 候选与 `sector-hub-transport` 保持一致。

## 全局 route cache 生命周期

全局 cache 的生命周期独立于 link 当前是否存在：

- active binding 初始化或切换时，系统扫描 persisted binding links；缺失的路径 key 才计算并插入 cache。
- binding-sector shared draft 初始化或变化时，系统扫描 draft links；缺失的路径 key 才计算并插入 cache。
- 删除 link 时，只影响当前 link 集合过滤结果，不删除全局 cache entry。
- 重新添加 link 时，若全局 cache 已有对应路径 key 的 entry，则直接复用。
- sector hub 切换时，若两端 sector/position 变化，则生成新的路径 key；旧路径不删除。
- group 顺序变化本身不应改变 route；若仅顺序变化，不需要重算 route。

显示层从全局 cache 派生两个过滤视图：

- `binding`：当前 persisted binding link key 集合对应的 entries。
- `draft`：当前 binding-sector shared draft link key 集合对应的 entries。

普通地图模式不使用 persisted binding route 视图渲染地图 overlay；persisted binding route cache 仍可服务 transit hub 展示或后续 binding 初始化。

## 染色规则

每条 hub link 的颜色由两端 group 决定，而不是从两端中选择一个代表色。hub link 表达的是两个区域对象之间的无向连接，不是 source/target 流量，因此两端颜色在视觉上平等。

旧单色视觉是两层叠加：

```text
底层：更宽的半透明原色 stroke
上层：较窄的实色原色 stroke
横截面：半透明 A | 实色 A | 半透明 A
```

新视觉改为三层复合线，让 route 仍像“一条地图连接”，同时表达两端 group：

```text
A group color 细边 | gate 风格中线 | B group color 细边
```

中线使用原生 gate 连接线的颜色和宽度，负责表达连接通道本身；两侧细边使用两端 endpoint colors，负责表达 link 属于哪两个 sector group。三层线不使用渐变，不把两端颜色混合为中间色，也不通过透明度表达候选优先级。

实现上 map route view model 应保留：

- lane 偏移后的 center path。
- 沿 center path 两侧偏移的 from/to side paths。
- 两端 endpoint colors。

route layer 先绘制两侧 group color 细边，再绘制 gate 风格中线。若任一端 group 无颜色，只替换该侧细边为 fallback stroke，不影响中线或另一侧细边。

SVG 图层顺序需要把 hub link route 放在原生 link 线条之上，但放在 gate / superhighway endpoint 图标之下。这样单条原生通道 route 可以覆盖原生连接线，而不会遮挡 gate 图标本身。

同一 link 的所有 candidates 使用同一对端点颜色。候选不使用透明度降级，也不通过样式表达最优/次优。

## Route lane 偏移

地图 route overlay 需要对重叠线路做稳定 lane 偏移，解决两类覆盖：

- 不同 hub link 的路线经过同一基础线路时互相覆盖。
- hub link route 压在地图原生 gate、superhighway、highway 连接线上。

偏移只属于 map presenter / render view model，不改变 store 中的 route candidates，也不改变 `sector-hub-transport` 路径算法。

### lane 分配

基础线路用渲染层可识别的 `baseLinkKey` 分组，例如：

- `gate:`：跨 sector gate transit，以两端 gate / sector 的无向 key 分组。
- `superhighway:`：superhighway segment，以 link id / zone id / 两端 sector 的无向 key 分组。
- `sector-internal:`：同一 sector 内部 A-B 通道，以两端位置几何 key 分组；普通 gate-to-gate、station-to-gate、gate-to-station、非环形 highway 相关内部段都归入该类。
- `ring-highway:`：仅当聚合后的 A-B visual segment 两端 gate 与 `highwayRingChains` 的 prev/next gate pair 重合时使用。它表示最终绘制通道与原生环形高速 gate-to-gate 通道重合。

lane 分配规则：

- 渲染层先按 `laneGroupKey` 分组；普通 `sector-internal` 与同几何端点的 `ring-highway` SHALL 归入同一个 lane group。
- 同一 lane group 下，不同 hub link 分配不同 lane。
- 同一 hub link 的多条 candidate 经过同一 lane group 时共用同一 lane。
- 同一 hub link 在同一 A-B 通道同时存在普通内部段与环形高速段时，渲染层 SHALL 只保留一条可视 route，并优先保留 `ring-highway` 语义。
- lane side 与 lane order 应稳定，避免重新渲染时左右跳动。
- `gate:`、`superhighway:`、`ring-highway:` 属于原生 map link 通道；只有一条 binding route 经过时，该 route 可使用中心 lane 并以三层复合线替代原生连接视觉。
- `gate:`、`superhighway:`、`ring-highway:` 上有多条不同 hub link 经过时，中心线保留给原生连接，多条 route 按两侧 lane 分开。
- 普通 `sector-internal:` 不属于原生 map link 通道；只有一条 route 时可走中心线，多条不同 hub link 共用该通道时按“中心线 + 两侧 lane”展开。
- 如果某个 `sector-internal` lane group 中存在 `ring-highway`，整个 group 视为原生环形高速通道，中心线空出，普通内部 route 也不得占用中心线。

### gate / endpoint 收束

经过 gate、superhighway endpoint 或 highway endpoint 的 route SHOULD 在端点收束到真实连接点。主体线路保持 lane 偏移，靠近端点时通过短 taper 从 lane 收束到 endpoint，再从 endpoint 展开到下一段 lane。

因此连续路径不强制跨端点保持完全相同的偏移量。端点是拓扑锚点，允许“汇合再分叉”；segment 主体应尽量保持稳定 lane，避免无意义的 2px / 3px 逐段跳变。

### candidate 星区内聚合

地图 overlay 的候选保留粒度是 candidate 的星区序列，而不是 route builder 的 segment 序列。每条 candidate 先转换成按 sector visit 聚合的 visual segments：

- 起点 sector：hub station -> 离开该 sector 的出口点。
- 中间 sector：进入点 -> 离开点。
- 终点 sector：进入点 -> hub station。
- 若 candidate 在同一 sector 内部经过多个 route builder segments，例如 gate-to-gate、highway、ring highway、station-to-gate、gate-to-station，渲染层只输出该 sector visit 的一条 `sector-internal` 直线。
- 跨 sector 的 `gate-transit` 与 `superhighway` 仍作为跨 sector visual segment 保留，用于体现 candidate 的星区序列。

去重发生在 visual segment 层：

- 去重 key 使用 `linkId + sectorId + unordered(start,end)`。
- 同一 hub link 的多条 candidate 在同一 sector 内具有相同进入点与离开点时，只保留一条可视段。
- 不同 hub link 即使拥有相同 sector、相同进入点与离开点，也保留多条可视段，再进入 lane 分配。

### 星区内部与环形高速

用户确认后的简化方案是：地图 route overlay 不再绘制普通 highway spline，也不区分“过高速/不过高速”的同端点重复方案。对于每个 sector 内部聚合后的 A-B visual segment：

- 渲染几何统一使用 A 点到 B 点的直连 polyline。
- 非环形 highway、station-to-gate、gate-to-station、gate-to-gate 等同 sector 段都只影响聚合段的起点/终点，不单独绘制。
- 若聚合段最终进入/离开的两个 gate 与 `highwayRingChains` 中某个 hop 的 prev/next gate pair 重合，则该聚合段使用 `ring-highway` lane 语义；不要求该 candidate 实际走 ring highway，也不要求原始 segment 携带 `highwayId`。
- 若聚合段最终 gate pair 不匹配 `highwayRingChains`，即使其中某个原始 segment 携带 ring highway 的 `highwayId`，也 SHALL NOT 使用 `ring-highway` lane 语义。
- `ring-highway` 的作用只在 lane 语义上：表示该最终 A-B gate-to-gate 通道中线已有原生环形高速，需要空出中心 lane。
- 环形高速规则只适用于命中 `highwayRingChains` gate pair 的最终 A-B 通道，不包括这些星区中的其它非环形高速。

这样可避免第二次接触 II 闪点（Flashpoint）或 Hatikvah's Choice I 这类场景中，把 candidate 在星区内部的中途 gate / ring highway 绕行画成额外折线，导致视觉上看起来路线拐向了不属于该 candidate 星区序列表达的目标。

## 地图 overlay

地图需要新增 hub link route overlay 输入，来源规则：

```text
if current map page is binding-sector:
  routeEntries = liveStore.hubLinkRoutes.draft // filtered global cache
else:
  routeEntries = []
```

可见性规则：

```text
visible = current map page is binding-sector
```

渲染时只绘制 `entry.candidates` 非空的 routes。每个 candidate 先按 sector visit 聚合，再把 visual segments 转为 SVG path，并在 map route view model 中补充 lane 偏移：

- sector-internal visual segment：使用聚合后的进入点与离开点，结合 segment 所在 sector 转屏幕坐标后画直线。
- gate transit：使用两端 gate endpoint 画跨 cluster gate 线。
- superhighway：按端点位置生成 route segment，并按原生 map link 通道避让中心线。
- highway / gate-to-gate / station-to-gate / gate-to-station 等原始 sector 内部段：不直接生成 SVG route；它们只参与所在 sector visit 的进入点、离开点与 ring-highway lane 语义计算。

为避免地图层引入业务组装，segment 到 screen coordinate 的转换应是 map composable 或 layer 的纯渲染转换，不调用 store 或 route builder。

## 图层控制

地图图层控制不提供 `sectorRoutes` 开关，也不显示 `Sector Group Links` / `星区组连接` 项。hub link route overlay 是 binding-sector 编辑界面的专用视觉，普通地图模式不激活。

## transit hub 运输栏接入

`useTransitTransportPresenter` 的 `Sector Group` rows 应改为从 store 读取 link route cache：

- 根据当前 active transit group id 与 linked group id 找 route entry。
- 默认仍按当前 ship selection 决定面板展示使用的 route：
  - 无 ship 时使用 candidate order 中 `sector-hub-transport` 已选出的默认候选。
  - 有 ship 时可沿用现有 travel time 选择逻辑，在预计算 candidates 上选择。
- 问题组继续展示端点缺失或 route entry problems。

`Station` 分类暂不迁移，避免把本次地图 link overlay 范围扩大到所有 station routes。

## i18n

如果地图 route overlay 增加 tooltip 或 legend，再补充对应中英文文案；本变更不要求新增候选路径 legend。

## 验证

实现阶段需要运行 `npm run build`。测试代码与测试执行不属于 `/x4:apply` 阶段，由测试 workflow 另行处理。
