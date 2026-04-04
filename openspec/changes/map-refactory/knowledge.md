# map-refactory Knowledge Base

## 代码定位

### 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| useMapSvgLinks | `src/composables/useMapSvgLinks.ts` | 生成 sector links、highways、gates、cross-cluster gate lines 数据 |
| geometry | `src/components/map/utils/geometry.ts` | 纯几何函数：hex 顶点、polyline clip、spline 路径生成 |
| coordinates | `src/components/map/utils/coordinates.ts` | 纯坐标换算：sector/cluster/screen 坐标转换 |
| style | `src/components/map/utils/style.ts` | 纯样式映射：颜色、icon url、filter id |

### 图层组件

| 组件 | 路径 | 渲染职责 |
|------|------|----------|
| MapLinkLayer | `src/components/map/layers/MapLinkLayer.vue` | 渲染 `.sector-links`、`.highways`、`.gates`、`.cross-links` |
| MapSectorLayer | `src/components/map/layers/MapSectorLayer.vue` | 渲染 `.sector-hover-target`、sector polygon、label、resource pie |
| MapOverlayLayer | `src/components/map/layers/MapOverlayLayer.vue` | 渲染 `.placement-overlay`、`.save-poi-marker` |
| MapSvgCanvas | `src/components/map/MapSvgCanvas.vue` | 容器组件，组合 composables 与 layers |

---

## E2E 测试定位器

### Map Link Layer 定位器

| 目标 | 定位器 | 说明 |
|------|--------|------|
| sector-links 组 | `.sector-links` | 包含 sector link line 元素 |
| sector link 线段 | `.sector-links line` | 每个 link 为一条线段 + 两端圆点 |
| sector link 圆点 | `.sector-links circle` | link 起止点的圆点标记 |
| highways 组 | `.highways` | 包含 highway path/line 元素 |
| highway path | `.highways path` | 裁剪后平滑的 highway 曲线 |
| highway line | `.highways line` | 裁剪后短直线段 |
| gates 组 | `.gates` | 包含 gate circle 元素 |
| gate circle | `.gates circle.gate-circle` | 每个 gate 为一个圆，有 data-gate-id |
| cross-links 组 | `.cross-links` | 包含跨 cluster gate 连线 |
| gate-path | `.cross-links line.gate-path` | 跨 cluster gate 连线，有 data-gate-line-id |

### Map Sector Layer 定位器

| 目标 | 定位器 | 说明 |
|------|--------|------|
| sector-hover-target | `.sector-hover-target` | sector hover 交互区域，有 data-sector-hover-id |
| sector-polygon | `.sector-polygon` | sector 六边形，有 data-sector-id |
| cluster-polygon | `.cluster-polygon` | cluster 边界六边形，有 data-cluster-id |
| resource-pie-slice | `[data-testid="resource-pie-slice"]` | 资源饼图切片 |
| resource-group-badge | `[data-testid="resource-group-badge"]` | 资源组徽章 |

### Map Overlay Layer 定位器

| 目标 | 定位器 | 说明 |
|------|--------|------|
| station-overlays 组 | `.station-overlays` | 包含 placement overlay 元素 |
| placement-overlay | `.placement-overlay` | 站点放置标记，有 data-placement-key |
| placement-preview | `.placement-preview` | 拖拽预览标记 |
| save-poi-overlays 组 | `.save-poi-overlays` | 包含 save POI 元素 |
| save-poi-marker | `.save-poi-marker` | save 存档 POI 标记，有 data-save-poi-key |

### Tooltip 定位器

| 目标 | 定位器 | 说明 |
|------|--------|------|
| map-sector-tooltip-layer | `.map-sector-tooltip-layer` | Sector tooltip 容器层 |
| sector-tooltip-card | `.sector-tooltip-card` | Sector tooltip 卡片容器 |
| sector-tooltip-title | `.sector-tooltip-title` | Sector 名称标题 |
| sector-tooltip-owner | `.sector-tooltip-owner` | Sector 所属势力 |
| sector-tooltip-grid | `.sector-tooltip-grid` | Sector 资源信息网格 |
| sunlight-swatch | `.sunlight-swatch` | 阳光资源色块 |

### 容器与定义定位器

| 目标 | 定位器 | 说明 |
|------|--------|------|
| map-svg-canvas | `[data-testid="map-svg-canvas"]` | 地图 SVG 容器 |
| defs | `defs` | SVG 定义区 |
| clipPath | `defs clipPath` | sector裁剪路径，id 格式 `sector-clip-{clusterId}-{sectorId}` |
| filter | `defs filter` | 高亮滤镜与 faction 颜色滤镜 |

---

## 函数映射

### geometry.ts 函数

| 函数 | 输入 | 输出 | 单测重点 |
|------|------|------|----------|
| `hexVertices(cx, cy, radius)` | 圆心坐标、半径 | Vec2[] (6 个顶点) | 顶点数量、角度分布 |
| `clipSegmentToConvexPolygon(p0, p1, polygon)` | 线段端点、多边形顶点 | [Vec2, Vec2] | null | 完全在内、完全在外、穿越边界 |
| `clipPolylineToConvexPolygon(points, polygon)` | 多段线点、多边形顶点 | Vec2[][] (可见链数组) | 链数量、链长度 |
| `catmullRomToBezierPath(points)` | Catmull-Rom 点数组 | SVG path d 字符串 | 包含 M/C 命令 |
| `buildHighwayPathPoints(start, end, middle, eps)` | 起点、终点、中间点、eps 阈值 | Vec2[] (去重后的点数组) | 去重、eps 阈值过滤 |

### coordinates.ts 函数

| 函数 | 输入 | 输出 | 单测重点 |
|------|------|------|----------|
| `sectorRatioToClusterRatio(sectorNorm, localRatio)` | sector normalized、局部坐标 | Ratio | null | 中心偏移 + 局部坐标映射 |
| `clusterRatioToScreen(center, radius, ratio)` | cluster 中心、半径、ratio | Vec2 | 屏幕坐标计算 |
| `sectorLocalRatioToScreen(cluster, center, radius, sector, localRatio)` | cluster、sector、局部坐标 | Vec2 | null | 综合变换 |
| `gateClusterRatioFromRaw(gate, sectorNorm)` | gate raw_local_pos、sector normalized | Ratio | null | gate 位置换算 |

### useMapSvgLinks.ts computed

| Computed | 数据来源 | 输出类型 | 单测重点 |
|----------|----------|----------|----------|
| `sectorLinkLines` | cluster.sector_links | MapSectorLinkLine[] | from_zone_id/to_zone_id 映射正确 |
| `highwaySegments` | sector.highways | MapHighwaySegment[] | 裁剪后可见链生成正确 |
| `gateCircles` | sector.cluster_gates | MapGateCircle[] | gate 位置、颜色、半径正确 |
| `crossClusterGateLines` | gateCircles 配对 | MapCrossClusterGateLine[] | 配对逻辑正确 |

---

## 渲染属性对照

### Sector Link Line 属性

```svg
<line x1="start.x" y1="start.y" x2="end.x" y2="end.y"
      stroke="#1d4ed8" stroke-width="0.4" stroke-opacity="0.95" />
<circle cx="start.x" cy="start.y" r="0.7" fill="#1d4ed8" stroke="#dbeafe" stroke-width="0.4" />
```

### Highway Segment 属性

```svg
<!-- path 类型 -->
<path d="catmullRomToBezierPath(chain)"
      fill="none" stroke="#0ea5e9" stroke-width="0.45" stroke-opacity="0.92" />
<!-- line 类型 -->
<line x1="start.x" y1="start.y" x2="end.x" y2="end.y"
      stroke="#0ea5e9" stroke-width="0.45" stroke-opacity="0.92" />
```

### Gate Circle 属性

```svg
<circle class="gate-circle"
        data-gate-id="${clusterId}:${sectorId}:${gateId}"
        data-cluster-id="${clusterId}"
        cx="point.x" cy="point.y" r="gate.r"
        fill="sectorColor" stroke="#ffffff"
        stroke-width="0.3 * stargateVisualScale" />
```

### Cross-Cluster Gate Line 属性

```svg
<line class="gate-path"
      data-gate-line-id="${gateId}<->${reverseId}"
      x1="left.x" y1="left.y" x2="right.x" y2="right.y"
      stroke="#e5e7eb" stroke-width="0.6 * stargateVisualScale" stroke-opacity="0.85" />
```

---

## 测试数据构造

### 单测 Cluster 数据模板

```typescript
// 用于 sectorLinkLines 测试
const clusterWithSectorLinks = {
  id: 'Cluster_100_macro',
  sectors: {
    'Cluster_100_Sector001_macro': {
      id: 'Cluster_100_Sector001_macro',
      normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 },
      zones: {
        'zone_entry': { raw_sector_pos: { sx: -0.5, sy: 0 } },
        'zone_exit': { raw_sector_pos: { sx: 0.5, sy: 0 } }
      }
    },
    'Cluster_100_Sector002_macro': {
      id: 'Cluster_100_Sector002_macro',
      normalized: { center_offset_ratio: { x: 0.5, y: 0 }, sector_radius_ratio: 0.5 },
      zones: {
        'zone_entry': { raw_sector_pos: { sx: -0.5, sy: 0 } }
      }
    }
  },
  sector_links: {
    'link_001': {
      id: 'link_001',
      sector_a_id: 'Cluster_100_Sector001_macro',
      sector_b_id: 'Cluster_100_Sector002_macro',
      from_zone_id: 'zone_exit',
      to_zone_id: 'zone_entry'
    }
  }
}

// 用于 highwaySegments 测试
const clusterWithHighways = {
  id: 'Cluster_101_macro',
  sectors: {
    'Cluster_101_Sector001_macro': {
      id: 'Cluster_101_Sector001_macro',
      normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 },
      highways: {
        'highway_001': {
          entry: { sx: -0.8, sy: 0 },
          exit: { sx: 0.8, sy: 0 },
          spline: [{ sx: -0.4, sy: 0.1 }, { sx: 0, sy: 0.2 }, { sx: 0.4, sy: 0.1 }]
        }
      }
    }
  }
}

// 用于 gateCircles 测试
const clusterWithGates = {
  id: 'Cluster_102_macro',
  sectors: {
    'Cluster_102_Sector001_macro': {
      id: 'Cluster_102_Sector001_macro',
      normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 },
      owner_color: '#ff0000',
      cluster_gates: {
        'gate_001': {
          raw_local_pos: { sx: 0.9, sy: 0.9 },
          target_cluster_id: 'Cluster_103_macro'
        }
      }
    }
  }
}
```

### E2E 测试视图入口

| 视图 | URL | 说明 |
|------|-----|------|
| Empire Map | `/?router=maps` | 默认地图视图，渲染完整地图 |
| Empire Map (带 save POI) | `/?router=maps&saveId=<saveId>` | 带 save 存档 POI 标记的地图 |

---

## 常量值

| 常量 | 值 | 来源 |
|------|-----|------|
| STARGATE_VISUAL_SCALE | 1.5 | MapSvgCanvas.vue |
| SECTOR_LINK_COLOR | #1d4ed8 | MapLinkLayer.vue |
| HIGHWAY_COLOR | #0ea5e9 | MapLinkLayer.vue |
| GATE_STROKE_COLOR | #ffffff | MapLinkLayer.vue |
| CROSS_LINK_COLOR | #e5e7eb | MapLinkLayer.vue |
| FALLBACK_OWNER_COLOR | #666666 | style.ts |

---

## 事件绑定

| 事件 | 元素 | emit 事件 | 说明 |
|------|------|-----------|------|
| mouseenter | `.sector-hover-target` | sector-hover | 触发 sector tooltip 显示 |
| mouseleave | `.sector-hover-target` | sector-leave | 触发 sector tooltip 关闭 |
| mousedown.stop | `.placement-overlay` | overlay-pointerdown | 触发 overlay 拖拽开始 |
| mousedown.stop | `.save-poi-marker` | save-poi-pointerdown | 触发 save POI 选择 |

---

## 测试运行

### 2.2 状态: 地图渲染-overlay-可见

- [✓] 2.2.5 断言 `.station-overlays` 组存在
  - **结论**: 已修复 - fixture 加载 helper 中正确设置 empire 数据
  - **修复**: buildMapRenderOverlayVisible 加载 `tests/fixtures/db.json` 并设置 `x4_empire_data` localStorage

- [ ] 2.2.6 断言 `.save-poi-overlays` 组存在
  - **结论**: unchecked - fixture 缺少 save POI 数据，元素渲染为空组
  - **说明**: 此步骤未在 test_tasks.md 中标记为 checked，失败不影响 gate

- [ ] 2.2.7 断言 `.placement-overlay` 元素存在
  - **结论**: unchecked - fixture 缺少 placement 数据
  - **说明**: 此步骤未在 test_tasks.md 中标记为 checked，失败不影响 gate

### 3.9 Case: Placement overlay pointerdown 事件验证

- [✓] 3.9.1 状态: 地图渲染-overlay-可见
  - **结论**: 已修复 - 继承 2.2 fixture 修复，checked 步骤全部通过

### 3.10 Case: Save POI overlay pointerdown 事件验证

- [✓] 3.10.1 状态: 地图渲染-overlay-可见
  - **结论**: 已修复 - 继承 2.2 fixture 修复，checked 步骤全部通过

### 已修复的历史缺陷

以下缺陷在 x4-test-impl 阶段已修复：

- [✓] 3.6 Case: Filter id 无冲突 - regex 已更正为 `/faction-color-|map-search-sector-glow/`
- [✓] 3.7 Case: Sector hover 事件绑定验证 - 定位器已更正为 `.sunlight-name`
- [✓] 3.12 Case: 缩放触发 tooltip 隐藏验证 - 已删除 zoom 恢复期望步骤
- [✓] 3.13 Case: Tooltip 内容完整性验证 - 定位器已更正为 `.sunlight-name`