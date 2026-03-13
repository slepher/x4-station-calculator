# x4-map-tooltip 测试知识库

## UI 锚点

### 地图视图入口
- **路由参数**: `?router=maps`
- **Store 切换**: `shipBuildStore.activeView = 'maps'`
- **容器选择器**: `.maps-slot`
- **地图容器**: `.map-viewport`
- **地图画布**: `MapSvgCanvas` 组件 (SVG)

### Sector 图元
- **Sector 六边形**: `.sector-hover-target` (g 元素)
- **多 sector cluster**: 每个 sector 是独立的 `.sector-hover-target`
- **单 sector cluster**: 整个 cluster 是一个 `.sector-hover-target`

### Tooltip 组件
- **容器**: `.map-sector-tooltip-layer`
- **卡片**: `.sector-tooltip-card`
- **标题**: `.sector-tooltip-title`
- **所属势力**: `.sector-tooltip-owner`
- **资源网格**: `.sector-tooltip-grid`
- **资源名称**: `.resource-name`
- **资源丰度**: `.resource-value`
- **资源颜色块**: `.resource-color`
- **Sunlight 行**: 在资源网格第一行，`.sunlight-swatch` 为颜色标识

### 地图控件
- **搜索输入框**: `[data-testid="map-sector-search-input"]`
- **搜索结果**: `[data-testid="map-sector-search-popover"]`
- **缩放滑块**: `.zoom-slider`
- **资源筛选面板**: `MapResourceFilterPanel`

## 数据映射

### 测试用 Sector 数据
来源: `src/assets/x4_game_data/8.0-Diplomacy/data/maps.json`

| Sector ID | 名称 (EN) | 所属势力 | Sunlight | 资源 |
|-----------|----------|----------|----------|------|
| `Cluster_01_Sector001_macro` | Grand Exchange I | teladi | 1.23 | hydrogen(medhigh), ice(medium), nividium(medium), ore(veryhigh), silicon(medium) |

### 势力名称本地化
来源: `src/assets/x4_game_data/8.0-Diplomacy/data/factions.json`

| Faction ID | nameId | EN 名称 | CN 名称 |
|------------|--------|---------|---------|
| `teladi` | `{20203,501}` | Teladi Company | 特拉迪公司 |

### 资源颜色
来源: `src/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json`

| Ware | 默认颜色 |
|------|---------|
| ore | #fbbf24 |
| silicon | #fbbf24 |
| ice | #fbbf24 |
| hydrogen | #fbbf24 |
| helium | #fbbf24 |
| methane | #fbbf24 |
| nividium | #fbbf24 |
| rawscrap | #fbbf24 |

### 资源顺序常量
代码位置: `src/components/empire/MapWorkbenchView.vue:63`
```typescript
const RESOURCE_ORDER = ['ore', 'silicon', 'ice', 'hydrogen', 'helium', 'methane', 'nividium', 'rawscrap']
```

### 丰度文案映射
来源: `src/locales/zh-CN.json` -> `map.yield_names`

| yield 值 | CN 文案 |
|----------|---------|
| veryhigh | 很高 |
| medhigh | 中高 |
| medium | 中等 |
| low | 偏低 |

## 交互行为

### Hover 触发
- `mouseenter` on `.sector-hover-target` 触发 tooltip 显示
- tooltip 显示前测量尺寸，计算最佳位置
- 位置计算优先级: 下 → 上/下/左/右 → 斜角方向

### Tooltip 闪烁防护
- `mouseleave` 启动 90ms 关闭定时器
- 鼠标移入 tooltip (`mouseenter` on `.map-sector-tooltip-layer`) 取消定时器
- `isTooltipHovered` 状态保持 tooltip 显示

### 拖拽/缩放行为
- `mousedown` on `.map-viewport` 调用 `closeTooltip()`
- `wheel` on `.map-viewport` 先调用 `closeTooltip()`
- 缩放结束后通过防抖定时器和最后鼠标位置重判 sector hover
- 若鼠标仍停留在原 sector 上，tooltip 会重新显示

## 语言切换
- 语言选择器: 页面顶部 `select` 元素
- 可选值: `en`, `zh-CN`
- 切换后 tooltip 内容实时更新
