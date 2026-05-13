# map-refactory Tasks

## Phase 1: 地图域目录建立

### T1.1 建立地图组件目录

- [x] 创建 `src/components/map/`
- [x] 创建 `src/components/map/layers/`
- [x] 创建 `src/components/map/utils/`

### T1.2 建立地图 composables 目录

- [x] 创建 `src/composables/`
- [x] 约定地图相关组合式文件命名为 `useMapSvg*.ts`

---

## Phase 2: 纯工具模块拆分

### T2.1 拆分 `geometry.ts`

- [x] 从 `MapSvgCanvas.vue` 提取 hex 顶点、fit、cluster 半径、polyline clip、bezier path 相关纯函数
- [x] 收敛 highway path 构建与去重辅助纯函数
- [x] 保证提取后的函数不依赖组件实例、props 或 emit

### T2.2 拆分 `coordinates.ts`

- [x] 提取 sector ratio、cluster ratio、screen point、gate raw position 相关换算函数
- [x] 收敛 sector viewport transform 逻辑
- [x] 保证换算函数不依赖响应式上下文

### T2.3 拆分 `style.ts`

- [x] 提取 save poi 颜色常量
- [x] 提取 icon url / icon size 纯映射逻辑
- [x] 提取 faction color filter 所需纯颜色转换函数
- [x] 避免将直接依赖 props 的 sector visual state 函数放入 utils

---

## Phase 3: links 与 overlays composable 拆分

### T3.1 创建 `useMapSvgLinks.ts`

- [x] 提取 `sectorLinkLines`
- [x] 提取 `highwaySegments`
- [x] 提取 `gateCircles`
- [x] 提取 `crossClusterGateLines`
- [x] 明确 links 输出类型，避免继续依赖匿名对象结构

### T3.2 创建 `useMapSvgOverlays.ts`

- [x] 提取 `overlayScreenItems`
- [x] 提取 `savePoiScreenItems`
- [x] 提取 `previewScreenItem`
- [x] 提取 `factionColorFilters`
- [x] 保持 overlay composable 不负责 DOM 事件与模板渲染

---

## Phase 4: layout 与 sectors composable 拆分

### T4.1 创建 `useMapSvgLayout.ts`

- [x] 提取 `clusters`
- [x] 提取 `allClusters`
- [x] 提取 `regionIds`
- [x] 提取 `layoutState`
- [x] 提取 `clipDefs`
- [x] 提取 `canvasWidth`、`canvasHeight`
- [x] 提取 `sectorLayouts`

### T4.2 创建 `useMapSvgSectors.ts`

- [x] 提取 sector visual state 判断
- [x] 提取 `clusterPolygons`
- [x] 提取 resource pie geometry
- [x] 提取 resource group badge geometry
- [x] 保证 sector 样式 helper 与 sector layer 数据边界清晰

---

## Phase 5: 图层组件与容器迁移

### T5.1 创建 `MapSectorLayer.vue`

- [x] 承载 cluster polygon、sector polygon、label、resource pie、group badge 模板
- [x] 保留 hover 相关 SVG 事件出口

### T5.2 创建 `MapLinkLayer.vue`

- [x] 承载 sector links、highways、gates、cross-links 模板
- [x] 保持与 sector / overlay 图层解耦

### T5.3 创建 `MapOverlayLayer.vue`

- [x] 承载 placement overlays、save poi overlays、preview overlay 模板
- [x] 保留 overlay pointerdown 事件出口

### T5.4 迁移 `MapSvgCanvas.vue`

- [x] 将容器组件移动到 `src/components/map/MapSvgCanvas.vue`
- [x] 改为只组合 composables 与 layers
- [x] 清理旧路径引用，避免长期保留兼容壳

---

## Phase 6: 稳定性补强

### T6.1 links 单测规划落地

- [ ] 为 `useMapSvgLinks.ts` 或相关 geometry helper 增加单测入口
- [ ] 覆盖 sector highway 入口/出口映射
- [ ] 覆盖 clip 后可见链生成
- [ ] 覆盖 clipped chain smoothing
- [ ] 覆盖 superhighway sector link from/to zone 对齐

### T6.2 回归验证

- [ ] 确认 sector、highway、gate、placement overlay、save poi overlay 渲染行为等价
- [ ] 确认 `clipPath` / filter id 没有冲突
- [ ] 确认 hover 与 pointerdown 事件绑定未回归
- [x] 完成构建验证

---

## Task Dependencies

```text
T1.1 ─┬─> T2.1 ─┬─> T3.1 ─┬─> T4.1 ─┬─> T5.4
      │         │         │         └─> T5.1
      │         │         └─> T4.2 ────> T5.1
      │         └─> T2.2 ─┘
      └─> T1.2 ─────> T3.2 ───────────> T5.3

T2.3 ─────────────────────────────────> T3.2
T3.1 ─────────────────────────────────> T5.2
T5.1 ─┬─> T6.2
T5.2 ─┤
T5.3 ─┤
T5.4 ─┤
T6.1 ─┘
```

---

## Estimated Effort

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1 | T1.1 - T1.2 | 0.5d |
| Phase 2 | T2.1 - T2.3 | 0.5d |
| Phase 3 | T3.1 - T3.2 | 0.5d |
| Phase 4 | T4.1 - T4.2 | 0.5d |
| Phase 5 | T5.1 - T5.4 | 0.5d |
| Phase 6 | T6.1 - T6.2 | 0.5d |
| **Total** | 12 tasks | **~3d** |
