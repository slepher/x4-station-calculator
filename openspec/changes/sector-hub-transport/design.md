# sector-hub-transport Design

## 背景

live transit hub 页面当前右侧使用 `StationDashboard` 展示建设成本、体积、时间等 station dashboard 信息。新需求要求该区域转为运输栏，用于评估当前 transit hub 到 linked sector group hub 和当前 group 内 stations 的运输路径。

现有数据已经具备主要输入：

- `BindingSectorGroup.connectedGroupIds` 表示 linked sector groups。
- `BindingSectorGroup.coverageSectorMacros` 与 `sectorMacro` 表示当前 group 覆盖范围。
- `BindingSectorGroup.tradeStation` 表示 transit hub station。
- station plan/save station 上有 `sectorMacro`、`position`、`saveStationCode/code`。
- map 数据中：
  - `sector.cluster_gates` 提供跨 cluster gate 端点。
  - `cluster.sector_links` 提供跨 sector superhighway 端点 link。
  - `sector.zones[link.from_zone_id/to_zone_id].raw_sector_pos` 可作为 superhighway 端点坐标。

## 已知代码入口

实现时可从以下文件进入现有结构：

- `src/components/empire/LiveProductionWorkbenchView.vue`：live transit 页面布局入口。当前 transit 模式右栏渲染 `StationDashboard`，本变更应在这里替换为运输栏组件。
- `src/components/empire/transit-hub/TransitHubBuildPanel.vue`：transit 页面左栏 build/module 列表。该组件不属于本次替换范围。
- `src/store/useLiveProductionStore.ts`：live binding workbench 的主要 store，提供 active transit group、active binding、station state、flow facade 等上下文。
- `src/components/empire/presenters/useProductionToolbarPresenter.ts`：现有 presenter 示例，展示 live transit/station toolbar 如何从 store 组装 Vue props。
- `src/store/logic/saveBindingUtils.ts`：已有 coverage/path 工具，包括 `buildSectorPath()`、`getCoverageSectors()` 和 map graph 包装，可参考但需要扩展为带端点和距离的 route builder。
- `src/store/logic/mapSectorGraph.ts`：现有 sector graph 构建逻辑，包含 gate 与 `sector_links` 的基础连通处理。
- `src/types/x4.ts`：`BindingSectorGroup`、`TradeStationBinding`、`BindingStationPlan`、`X4MapSector`、`X4MapCluster` 等核心类型定义。
- `src/types/saveArchive.ts`：save station、archive station position、`SaveSectorSuperhighwayGateEntry` 等 save 侧类型定义。
- `src/composables/useMapSvgLinks.ts`：当前地图渲染如何从 `cluster.sector_links` 与 zone 坐标绘制 superhighway，可作为 endpoint 解析参考。

## 架构

本变更采用 `store -> presenter -> vue`：

- store：继续提供 active binding、active transit group、station state、flow cache、game map data，不新增面向 UI 的拼装结构。
- presenter：新增 transit transport presenter，负责从 store 输入组装分类、路径摘要、路径明细、问题组和格式化前数据。
- vue：新增运输栏组件，只接收 presenter 输出并处理展开/折叠状态、动作式路线描述、0 值隐藏和空问题组隐藏。

建议新增纯逻辑 route builder，供 presenter 调用。route builder 不依赖 Vue/Pinia，用于单独验证路径选择和距离分段。

## 数据模型

建议 presenter 输出使用以下结构表达核心语义：

```ts
type TransitDistanceSummary = {
  gateCount: number
  normalDistanceKm: number
  superhighwayDistanceKm: number
}

type TransitPathSegment = {
  kind:
    | 'station-to-gate'
    | 'gate-to-gate'
    | 'gate-transit'
    | 'superhighway'
    | 'gate-to-station'
  fromLabel: string
  toLabel: string
  distanceKm: number
  countsInSummaryDistance: boolean
}

type RouteTerminal = {
  kind: 'gate' | 'superhighway-exit'
  label: string
  sectorMacro: string
  position: { x: number; y: number; z: number }
}
```

`normalDistanceKm` 不包含 superhighway 距离。`superhighwayDistanceKm` 用于明细或补充展示，不参与摘要普通距离，也不参与路径排序第二关键字。

## 路径图构建

route builder 从 map data 建立 sector edge 图：

- gate edge：
  - 来源：`sector.cluster_gates`
  - 连接跨 cluster sectors
  - edge cost：`gateCount +1`，`normalDistance +0`
  - 段明细包含 gate transit
- superhighway edge：
  - 来源：`cluster.sector_links`
  - 连接同 cluster 的 sector A/B
  - edge cost：`gateCount +0`
  - superhighway distance 使用 from/to zone 坐标直线距离
  - 不计入 normal distance

同一对 sector 按唯一连接处理，不实现多 edge 竞争。

route builder 输出的 gate/superhighway endpoint label SHALL 只使用面向用户的 sector 显示名，不拼接 gate id 或 superhighway link id。

## 路径候选与选择

算法应生成不重复 sector 的 simple path 候选。最终最优路径排序为：

1. `gateCount` 升序
2. `normalDistanceKm` 升序

`normalDistanceKm` 只包含 station/gate/endpoints 之间的普通空间段，不包含 superhighway 段距离。

实现上可采用 DFS/BFS 混合限制：

- 以当前 hub 所在 sector 为起点。
- 枚举 simple paths 到目标 sector。
- 保留当前最优与少量候选，避免全图爆炸。
- 若发现路径 gateCount 已超过当前最佳，可剪枝。

## 分段生成

对 sector path 生成具体端点路径：

- 起点为当前 hub station 坐标。
- 对每个 sector pair，根据唯一连接确定 gate transit 或 superhighway。
- 若当前 sector 内需要从上一入口点到下一出口点，生成普通空间段。
- gate 跨 sector 生成 `gate-transit` 段，距离不计。
- superhighway 生成 `superhighway` 段，距离为两端点坐标直线距离。
- 目标为 sector-level route 时，末端停在目标 sector 的 gate 或 superhighway exit。
- 目标为 station route 时，在末端追加 `gate-to-station` 或 equivalent station segment。

当最后一跳是 superhighway，目标 sector 的末端点是 superhighway exit；当最后一跳是 gate，末端点是目标 sector gate。

## UI 设计

### Sector Group

折叠摘要显示普通总距离、星门数和目标说明。目标说明优先表达 linked hub station；当 target station 与 target sector 同名时只显示一次，避免重复文本；二者不同名时显示 `station · sector`。

展开后显示动作式路线明细：

- 按 sector 分块，sector 名称只作为块标题出现。
- 普通空间段显示为 `离港至出口星门`、`星区内转场` 或 `入口星门至目标空间站`，并显示距离。
- gate transit 显示为 `星门跃迁至 <sector>`，不显示 `0.0 km`。
- superhighway 显示为 `超级高速至 <sector>`，显示 superhighway 距离。
- 不显示 gate/superhighway 内部 ID。

排序为星门数少、普通总距离短、group order。

### Station

按 sector 分组，两级展开：

1. sector 行：显示到目标 sector 末端点的普通总距离、星门数、sector。
2. station 行：显示 station name、code、坐标、末端点到 station 距离、普通总距离加末端点到 station 距离。

sector 行展开显示到末端点的动作式路径明细，末端不是 station。若目标 station 与当前 hub 在同一 sector，sector 行不提供展开路径，station 行直接显示 `空间站到空间站` 距离。

sector 行摘要隐藏无信息量的 0 值：普通距离为 0 时不显示距离字段，星门数为 0 时不显示星门数字段。

station 排序按 production 产线数量从高到低。production 产线数量优先使用 station 正向产出 production flows distinct ware count；无法取得时使用生产模块输出 ware distinct count。

Station 分类目标来源同时覆盖两类 station：

- save station records：当前 group anchor/coverage sector 中的真实存档空间站，排除所有 group 的 transit hub station。
- binding station plans：没有 save record 的规划/虚拟 station，按 `groupId` 与 `sectorMacro` 纳入当前 group。

### 问题组

任何无法完整计算路径或距离的目标进入问题组。问题组只需要列出目标类型、目标名称、所属 sector 和问题节点列表。若没有问题，整个问题组区块不渲染。

## 数据缺失策略

本功能不为每种缺失状态设计独立 UI。route builder 或 presenter 在遇到以下情况时生成 problem row：

- 无 route。
- 缺 station 坐标。
- 缺 gate 坐标。
- 缺 superhighway endpoint 坐标。
- 缺 linked group hub station。

## i18n

需要新增运输栏相关文案，至少包含：

- 分类标题：Sector Group/星区组、Station/空间站、问题组。
- 距离字段：普通距离、星门数、superhighway、路径明细、station 坐标、station code。
- 动作式路线字段：离港至出口星门、星区内转场、星门跃迁至、超级高速至、入口星门至目标空间站、空间站到空间站。
- 问题组字段。

## 验证

实现阶段需要运行 `npm run build`。测试代码与测试执行不属于 `/x4:apply` 阶段，由测试 workflow 另行处理。
