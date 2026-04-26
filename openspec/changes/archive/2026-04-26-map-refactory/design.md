# map-refactory Design

## Architecture

### 目标结构

```text
src/components/map/
├── MapSvgCanvas.vue
├── layers/
│   ├── MapSectorLayer.vue
│   ├── MapLinkLayer.vue
│   └── MapOverlayLayer.vue
└── utils/
    ├── geometry.ts
    ├── coordinates.ts
    ├── style.ts
    └── mapSectorMacro.ts

src/composables/
├── useMapSvgLayout.ts
├── useMapSvgSectors.ts
├── useMapSvgLinks.ts
└── useMapSvgOverlays.ts
```

### 分层原则

- `utils/` 只放纯函数、纯映射、纯常量。
- `useMapSvg*.ts` 只放 computed/派生数据与组合逻辑，不渲染 DOM。
- `layers/*.vue` 只负责 SVG 渲染，不负责布局推导。
- `MapSvgCanvas.vue` 只做顶层编排与事件出口。

---

## Decisions

### D1: 地图域从 `empire` 中独立

**决策**：地图 SVG 相关实现从 `src/components/empire/` 迁到 `src/components/map/`。

**理由**：
- 当前地图能力已经不只服务 empire 语义，本质上是独立地图域。
- 继续在 `empire` 下细分，会把领域边界和视觉容器边界混在一起。
- 后续 `MapSectorTooltip`、`MapSavePoiTooltip`、`MapResourceFilter*` 等地图相关组件也有统一归位空间。

**影响**：
- 需要统一调整 import 路径。
- 旧路径不应长期保留兼容 re-export。

---

### D2: 先拆工具，再拆 composables，再拆模板

**决策**：迁移采用低风险优先顺序，而不是一次性按文件大搬家。

**顺序**：
1. 先拆 `utils/geometry.ts`、`utils/coordinates.ts`、`utils/style.ts`
2. 再拆 `useMapSvgLinks.ts`
3. 再拆 `useMapSvgOverlays.ts`
4. 再拆 `useMapSvgLayout.ts` 与 `useMapSvgSectors.ts`
5. 最后拆 `layers/` 与迁移 `MapSvgCanvas.vue`

**理由**：
- 工具函数最接近纯搬运，行为回归最容易验证。
- links 是 bug 高发区，越早隔离，后续收益越高。
- 模板拆分最容易引入 `clipPath`、SVG id、事件绑定回归，应放到最后。

---

### D3: links 单独作为重构主轴

**决策**：`useMapSvgLinks.ts` 作为首个核心 composable 拆分对象。

**包含职责**：
- `sectorLinkLines`
- `highwaySegments`
- `gateCircles`
- `crossClusterGateLines`

**理由**：
- highway clip / smoothing 问题定位代价最高。
- links 几何逻辑与 sector visual state、overlay 层基本正交。
- 该区域天然适合单测隔离，是最值钱的稳定性投资。

---

### D4: sector visual state 与 sector 渲染数据同属一层

**决策**：sector 的 selected/search/resource 状态判断与 polygon/pie/badge 数据生成一起归入 `useMapSvgSectors.ts`。

**理由**：
- 这些规则虽然带有“样式”性质，但本质依赖响应式输入，而非纯映射。
- 若直接塞进 `utils/style.ts`，容易形成依赖 props/computed 的伪纯函数。
- 将 visual state 与 sector layer 数据放在同一 composable，可以让 layer 组件保持纯渲染。

---

### D5: style.ts 只保留真正纯的样式映射

**决策**：`style.ts` 只容纳不依赖组件闭包的纯内容。

**适合进入 `style.ts` 的内容**：
- `SAVE_POI_COLORS`
- icon url 选择规则
- icon size 规则
- hex/rgb 与 feColorMatrix 生成

**不直接进入 `style.ts` 的内容**：
- `sectorFillOpacity`
- `sectorStrokeWidth`
- `sectorStrokeOpacity`
- `sectorLabelFill`
- `sectorLabelWeight`
- `sectorFilter`
- `sectorFillColor`
- `sectorStrokeColor`

**原因**：
- 上述 sector 样式函数当前依赖 `props` 与高亮集合，应先在 composable 内参数化，再决定是否可进一步下沉。

---

### D6: layer 组件显式 props 化

**决策**：三个图层组件只接收渲染所需最小 props，不直接共享顶层上下文对象。

**示例**：
- `MapSectorLayer.vue` 接收 `clusterPolygons`、sector 样式 helper、resource pie/badge 结果、hover handler
- `MapLinkLayer.vue` 接收 `sectorLinkLines`、`highwaySegments`、`gateCircles`、`crossClusterGateLines`
- `MapOverlayLayer.vue` 接收 `overlayScreenItems`、`savePoiScreenItems`、`previewScreenItem` 与 icon/filter helper

**理由**：
- 避免 layer 组件反向耦合到整个地图状态树。
- 让 layer 更接近可替换渲染单元。

---

### D7: 文档目标是行为等价，不借机重做地图

**决策**：本次 refactory 以结构重组和可维护性提升为主，默认保持行为等价。

**明确不做**：
- 不重做地图主题和视觉风格
- 不重定义 overlay 交互
- 不修改业务数据来源
- 不顺手改动地图产品流程

**理由**：
- 否则会把“结构重构”和“行为变更”耦合，导致回归面不可控。

---

## Component Dependencies

```text
MapSvgCanvas.vue
├── useMapSvgLayout.ts
├── useMapSvgSectors.ts
├── useMapSvgLinks.ts
├── useMapSvgOverlays.ts
├── MapSectorLayer.vue
├── MapLinkLayer.vue
└── MapOverlayLayer.vue

useMapSvgLinks.ts
├── utils/geometry.ts
└── utils/coordinates.ts

useMapSvgOverlays.ts
├── utils/coordinates.ts
├── utils/style.ts
└── utils/mapSectorMacro.ts

useMapSvgSectors.ts
├── utils/geometry.ts
└── sector visual-state helpers

useMapSvgLayout.ts
├── utils/geometry.ts
└── utils/coordinates.ts
```

---

## Verification Strategy

### 文档阶段验证重点

- 目录边界清晰，没有把 `empire` 继续当作地图域承载目录。
- links 拆分优先级高于模板拆分。
- 纯函数与响应式逻辑边界清晰。

### 实施阶段验证重点

- 先跑纯工具迁移后的现有 unit tests。
- links 拆分后优先补 geometry / links unit tests。
- layer 拆分后重点回归：
  - `clipPath` id
  - faction filter id
  - hover target 事件
  - overlay `mousedown.stop`
  - sector / gate / highway / save poi 是否仍正常渲染
