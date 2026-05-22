# map-refactory Change Request

## 目标

对地图 SVG 渲染相关实现做职责分层重构，将当前集中在 `MapSvgCanvas.vue` 中的布局、几何、连线、覆盖物、样式映射与 SVG 模板拆分为可维护的模块结构。

本次变更的重点不是调整地图行为，而是在保持现有渲染结果与交互行为不变的前提下，建立清晰的地图域目录与可测试边界，降低后续修改 highway clip/smoothing、overlay、sector 图层时的误伤风险。

## 已确认方案（审核重点）

### 1. 地图域目录重组

- 不再继续放在 `src/components/empire/` 下扩展地图拆分结果。
- 地图组件迁移到 `src/components/map/`。
- 组合式逻辑迁移到 `src/composables/`。
- 纯工具与地图私有常量放到 `src/components/map/utils/`。
- 图层组件放到 `src/components/map/layers/`。

### 2. 顶层容器职责

- `MapSvgCanvas.vue` 作为顶层容器保留。
- 顶层容器只负责：
  - 接收 props
  - 组合 `useMapSvgLayout` / `useMapSvgSectors` / `useMapSvgLinks` / `useMapSvgOverlays`
  - 发出 `content-size`、`sector-layout`、hover、overlay pointer 相关事件
  - 组装 `MapSectorLayer`、`MapLinkLayer`、`MapOverlayLayer`
- 顶层容器不再承载大段纯几何与大段渲染数据生成实现。

### 3. 纯工具模块拆分

- `src/components/map/utils/geometry.ts` 承载纯几何函数：
  - `hexPoints`
  - `hexVertices`
  - `fitWorldToScreen`
  - `minCenterDistance`
  - `computeClusterRadius`
  - `catmullRomToBezierPath`
  - `clipSegmentToConvexPolygon`
  - `clipPolylineToConvexPolygon`
  - 以及 highway path 去重/辅助纯函数
- `src/components/map/utils/coordinates.ts` 承载坐标换算函数：
  - `sectorRatioToClusterRatio`
  - `clusterRatioToScreen`
  - `getSectorViewportTransform`
  - `sectorLocalRatioToScreen`
  - `gateClusterRatioFromRaw`
- `src/components/map/utils/style.ts` 承载纯样式映射与常量：
  - 存档 POI 分类颜色
  - icon url / icon size 相关纯函数
  - faction color filter 相关纯函数
- 只有纯数学、纯映射、纯常量可以进入 utils。

### 4. composables 拆分边界

- `src/composables/useMapSvgLayout.ts`
  - `clusters`
  - `allClusters`
  - `regionIds`
  - `layoutState`
  - `clipDefs`
  - `canvasWidth`
  - `canvasHeight`
  - `sectorLayouts`
- `src/composables/useMapSvgSectors.ts`
  - sector visual state 判断
  - `clusterPolygons`
  - resource pie / badge geometry
- `src/composables/useMapSvgLinks.ts`
  - `sectorLinkLines`
  - `highwaySegments`
  - `gateCircles`
  - `crossClusterGateLines`
- `src/composables/useMapSvgOverlays.ts`
  - `overlayScreenItems`
  - `savePoiScreenItems`
  - `previewScreenItem`
  - `factionColorFilters`

### 5. 子图层组件边界

- `src/components/map/layers/MapSectorLayer.vue`
  - cluster polygon
  - sector polygon
  - label
  - resource pie
  - group badge
- `src/components/map/layers/MapLinkLayer.vue`
  - sector links
  - highways
  - gates
  - cross-cluster gate lines
- `src/components/map/layers/MapOverlayLayer.vue`
  - placement overlays
  - save poi overlays
  - preview overlay
- 子图层组件只接 props 渲染 SVG，不直接读取顶层业务 props，不负责布局推导。

### 6. 迁移顺序

- 第一阶段先拆纯工具模块，尽量不改行为。
- 第二阶段优先拆 `useMapSvgLinks.ts`，因为 highway clip/smoothing 属于高风险高价值区域。
- 第三阶段拆 `useMapSvgOverlays.ts`，与 links 正交，风险较低。
- 第四阶段补齐 `useMapSvgLayout.ts` 与 `useMapSvgSectors.ts`。
- 第五阶段再拆 layer 组件并迁移 `MapSvgCanvas.vue` 到 `src/components/map/`。

### 7. 稳定性投资

- `useMapSvgLinks.ts` 需要补独立单测，至少覆盖：
  - sector highway 入口/出口映射
  - clip 后可见链生成
  - clipped chain smoothing
  - superhighway sector link from/to zone 对齐
- 文档层面明确：本次重构以行为等价为目标，不引入地图视觉重设计。

## 边界

### In Scope

- 地图 SVG 相关模块按职责拆分。
- 地图相关目录迁移到 `src/components/map/`、`src/composables/`。
- 将纯几何、纯坐标、纯样式映射从容器组件中剥离。
- 将 links、overlays、sectors、layout 渲染数据生成逻辑拆为独立 composable。
- 将 sectors / links / overlays SVG 模板拆为图层组件。
- 为 links 几何核心补单测规划。

### Out of Scope

- 修改地图功能范围、地图视觉主题或交互语义。
- 修改 `MapWorkbenchView` 的产品流程。
- 修改 sector / cluster / overlay 的业务数据来源。
- 借重构顺手调整地图算法、变更高亮策略、重做 tooltip。
- 在本次文档阶段直接进行源码实现或测试代码实现。

## 验收标准（DoD）

1. 地图相关组件主目录调整为 `src/components/map/`，组合式逻辑调整为 `src/composables/`。
2. `MapSvgCanvas.vue` 仅保留容器职责，不再内联大段纯几何、坐标换算、链接数据生成实现。
3. `geometry.ts`、`coordinates.ts`、`style.ts` 明确成为地图私有纯工具模块。
4. `useMapSvgLayout.ts`、`useMapSvgSectors.ts`、`useMapSvgLinks.ts`、`useMapSvgOverlays.ts` 边界清晰，互不混入 DOM 渲染职责。
5. `MapSectorLayer.vue`、`MapLinkLayer.vue`、`MapOverlayLayer.vue` 仅负责 SVG 渲染，不承担顶层状态推导。
6. links 相关几何逻辑从容器中隔离，能够独立补充单元测试。
7. 重构后现有 sector、highway、gate、overlay、save poi 渲染行为保持等价。
8. 文档中明确分阶段迁移顺序，优先低风险、可验证收益高的拆分步骤。

## 未决项

无。
