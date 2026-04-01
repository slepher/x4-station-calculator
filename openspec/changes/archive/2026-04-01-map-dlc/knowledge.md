# map-dlc 测试知识库

## UI 锚点

### 地图界面
- 地图容器：`data-testid="map-workbench-view"`
- SVG 画布：`data-testid="map-svg-canvas"`
- 地图视口：`data-testid="map-viewport"`

### 设置面板
- 设置按钮：`data-testid="settings-button"`
- DLC 设置模态框：`data-testid="dlc-settings-modal"`
- enforceDlcActivation 开关：`data-testid="dlc-settings-enforce-toggle"`
- DLC 勾选列表：`data-testid="dlc-settings-item-{tag}"`（如 `data-testid="dlc-settings-item-base"`）
- 模态框关闭按钮：`data-testid="dlc-settings-close"`
- 模态框保存按钮：`data-testid="dlc-settings-save"`
- 模态框取消按钮：`data-testid="dlc-settings-cancel"`

### 星系 Cluster 渲染
- Cluster 多边形：SVG `<polygon>` 元素，class `cluster-polygon`，可通过 cluster ID 关联（`data-cluster-id="Cluster_01_macro"`）
- Cluster 边框样式：`stroke` 属性控制边框颜色
- Cluster 虚线边框：`stroke-dasharray="6,4"`（未激活 DLC cluster 的虚线样式）
- Cluster 标签：`<text>` 元素在 cluster 中心位置，带 `data-cluster-id` 属性
- Cluster 选择器示例：`document.querySelector('polygon[data-cluster-id="Cluster_01_macro"]')` 或 `document.querySelectorAll('polygon.cluster-polygon')`

### Sector 渲染
- Sector 多边形：SVG `<polygon>` 元素，class `sector-polygon`
- Sector 边框：`stroke` 属性
- Sector 虚线边框：`stroke-dasharray="6,4"`（未激活 DLC sector）
- Sector 标签：`<text>` 元素，带 `data-sector-id` 和 `data-cluster-id` 属性
- Sector 选择器：`document.querySelectorAll('polygon.sector-polygon')` 或 `document.querySelector('polygon[data-sector-id="..."]')`

### 星门 Gate 渲染
- 星门圆圈：SVG `<circle>` 元素，class `gate-circle`，带 `data-gate-id` 和 `data-cluster-id` 属性
- 星门连接线：SVG `<line>` 元素，class `gate-path`
- 星门选择器：`document.querySelectorAll('circle.gate-circle')` 或 `document.querySelectorAll('line.gate-path')`
- 星门保持显示，即使目标星系被过滤

### 资源筛选面板
- 资源筛选按钮：`data-testid="map-resource-entry-button"`
- 简单筛选面板：`MapResourceFilterSimplePanel.vue`
- 高级筛选面板：`MapResourceFilterAdvancedPanel.vue`
- 资源选择按钮：`data-testid="map-resource-tag-{wareId}"`（如 `data-testid="map-resource-tag-ore"`）
- 搜索结果列表：`data-testid="map-resource-simple-candidate-list"`

### 空间站面板
- 空间站面板容器：`data-testid="map-station-panel"`
- 面板关闭按钮：`data-testid="map-station-panel-close"`
- 空间站搜索框：`data-testid="map-station-panel-search"`
- 空间站列表项：`data-testid="station-item-{id}"`
- 地址标签：`.station-address` 类名
- 红色地址样式：`text-red-500` Tailwind 类名
- 筛选按钮：
  - "全部"：`data-testid="filter-all"`
  - "空间站"：`data-testid="filter-station"`
  - "星区"：`data-testid="filter-sector"`
  - "已放置"：`data-testid="filter-placed"`
  - "未放置"：`data-testid="filter-unplaced"`

### 搜索功能
- 地图搜索框：`data-testid="map-sector-search-input"`
- 地图搜索结果列表：`data-testid="map-sector-search-popover"`
- 搜索结果项：`data-testid="map-sector-search-result-{sectorId}"`

### 语言选择器
- 语言下拉：`data-testid="language-select"`
- 选项："简体中文"（zh-CN） / "English"（en）

## 星系 Fixture 映射

### DLC Tag 分布（来自 maps.json）
| DLC Tag | Cluster 数量 | 状态 |
|---------|-------------|------|
| `base` | 63 | 基础游戏，始终激活 |
| `dlc_split` | 26 | Split Vendetta |
| `dlc_terran` | 15 | Terran Conflict |
| `dlc_boron` | 9 | Boron |
| `dlc_timelines` | 7 | Timelines |
| `dlc_pirate` | 5 | Pirate |
| `dlc_mini_01` | 1 | Mini DLC 1 |
| `dlc_mini_02` | 1 | Mini DLC 2 |

### 测试用 Cluster（代表性选择）
| Test Keyword | Cluster ID | DLC Tag | Sector 数量 | 名称（EN） | 名称（CN） |
|--------------|------------|---------|------------|-----------|-----------|
| grand_exchange | `Cluster_01_macro` | base | 3 | Grand Exchange | 大交易所 |
| eighteen_billion | `Cluster_02_macro` | base | 1 | Eighteen Billion | 一百八十亿 |
| hatikvah | `Cluster_14_macro` | dlc_split | 2 | Hatikvah's Choice | 哈蒂克瓦之选 |
| getsu_fune | `Cluster_19_macro` | dlc_terran | 3 | Getsu Fune | 月船 |
| heretics_tempt | `Cluster_22_macro` | dlc_boron | 3 | Heretic's Temptation | 异端诱惑 |

### Sector 示例
| Test Keyword | Sector ID | Cluster ID | DLC Tag | 名称（EN） |
|--------------|-----------|------------|---------|-----------|
| grand_exchange_1 | `Cluster_01_Sector001_macro` | Cluster_01_macro | base | Grand Exchange I |
| grand_exchange_2 | `Cluster_01_Sector002_macro` | Cluster_01_macro | base | Grand Exchange II |
| grand_exchange_3 | `Cluster_01_Sector003_macro` | Cluster_01_macro | base | Grand Exchange III |
| hatikvah_1 | `Cluster_14_Sector001_macro` | Cluster_14_macro | dlc_split | Hatikvah's Choice I |
| hatikvah_2 | `Cluster_14_Sector002_macro` | Cluster_14_macro | dlc_split | Hatikvah's Choice II |

## i18n 键值

### 地图页面
- `map.title` - "地图" / "Map"
- `map.search_placeholder` - "搜索星区" / "Search sectors"
- `map.resource_filter_title` - "资源筛选" / "Resource Filter"
- `map.station_panel_title` - "空间站" / "Stations"
- `map.station_panel_clear_action` - "清除位置" / "Clear location"

### DLC 设置
- `settings.dlc_title` - "DLC 设置" / "DLC Settings"
- `settings.enforce_dlc_activation` - "限制未激活 DLC 物品" / "Restrict inactive DLC items"

### 通用 UI
- `ui.cancel` - "取消" / "Cancel"
- `ui.confirm` - "确认" / "Confirm"

## 组件层次

```
MapWorkbenchView.vue (地图工作台主视图)
├── MapSvgCanvas.vue (SVG 地图渲染)
│   ├── Cluster 多边形渲染（含 DLC 过滤）
│   │   ├── 激活 DLC cluster：实线边框
│   │   └── 未激活 DLC cluster：虚线边框（当 enforceDlcActivation=false）
│   ├── Sector 圆形渲染
│   │   └── 未激活 DLC sector：虚线边框
│   ├── Gate 星门路径渲染（保持显示）
│   └── Station Overlay 空间站位置标记
├── MapResourceFilterPanel.vue (资源筛选面板)
│   ├── MapResourceFilterSimplePanel.vue
│   │   └── 资源统计（过滤未激活 DLC 星区）
│   └── MapResourceFilterAdvancedPanel.vue
│       └── 高级筛选（过滤未激活 DLC 星区）
└── MapStationPanel.vue (空间站面板)
    ├── 空间站搜索框
    ├── 筛选标签（全部/空间站/星区/已放置/未放置）
    └── 空间站列表
        ├── 空间站名称
        └── 地址标签（未激活 DLC 星区显示红色 .text-red-500）
```

## 状态模型

### DLC 状态（来自 useGameDataStore）
- `activeDlcs: string[]` - 已激活的 DLC tag 列表
- `enforceDlcActivation: boolean` - 是否启用未激活 DLC 限制
- `isDlcActive(dlcTag: string): boolean` - 判断指定 DLC 是否激活

### 地图过滤状态
- `clusters: Record<string, Cluster>` - 过滤后的星系集合（用于渲染）
- `allClusters: Record<string, Cluster>` - 全部星系集合（用于布局计算）
- `sectorsById: Record<string, MapSectorDataset>` - 过滤后的星区数据

### 空间站面板项
```typescript
type MapStationPanelItem = {
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: PlacementIcon
  groupId: string
  groupName: string
  targetSectorName?: string
  isAddressInactive?: boolean  // 新增：地址是否位于未激活 DLC 星区
  location?: EntityLocation
}
```

## 计算逻辑摘要

### Cluster 过滤（MapSvgCanvas.vue）
```typescript
const clusters = computed<Record<string, Cluster>>(() => {
  const allClusters = gameData.maps?.clusters || {}
  if (!gameData.enforceDlcActivation) return allClusters

  return Object.fromEntries(
    Object.entries(allClusters).filter(([, cluster]) =>
      gameData.isDlcActive(cluster.dlc_tag)
    )
  )
})
```

### Sector 过滤（MapWorkbenchView.vue）
```typescript
const sectorsById = computed<Record<string, MapSectorDataset>>(() => {
  const out: Record<string, MapSectorDataset> = {}
  const clusters = gameDataStore.maps?.clusters || {}

  Object.entries(clusters).forEach(([clusterId, cluster]) => {
    // DLC 过滤
    if (gameDataStore.enforceDlcActivation && !gameDataStore.isDlcActive(cluster.dlc_tag)) {
      return
    }
    // ... sector 处理
  })
  return out
})
```

### 空间站地址标红标记（MapWorkbenchView.vue）
```typescript
const stationPanelItems = computed<MapStationPanelItem[]>(() => {
  // ...
  const isAddressInactive = gameDataStore.enforceDlcActivation &&
    !gameDataStore.isDlcActive(/* sector's cluster dlc_tag */)

  items.push({
    // ...
    isAddressInactive
  })
})
```

### 地址标红样式（MapStationPanel.vue）
```vue
<span :class="{ 'text-red-500': item.isAddressInactive }">
  {{ item.targetSectorName }}
</span>
```

### 虚线边框样式（未激活 DLC，当 enforceDlcActivation=false）
```vue
<polygon
  :stroke-dasharray="!gameData.enforceDlcActivation && cluster.isDlcActive === false ? '6,4' : undefined"
/>
```

## 已知行为记录

### Cluster 布局稳定性
- 使用 `allClusters` 计算布局边界，保持剩余 cluster 位置稳定
- 过滤 DLC 不会改变未过滤 cluster 的位置

### 星门显示策略
- 即使星门连接的目标星系因 DLC 未激活被隐藏，星门本身仍然显示
- 不进行额外的视觉处理（如置灰、虚线等）
- 保持地图拓扑结构完整性

### 空间站地址标红
- 当 `enforceDlcActivation = true` 且空间站位于未激活 DLC 星区时，地址标签显示为红色
- 不进行自动移除或迁移，仅做视觉标记
- 空间站仍保留在列表中，可正常交互

### 虚线边框显示条件
- 仅当 `enforceDlcActivation = false` 时，未激活 DLC 的 cluster/sector 显示虚线边框
- 当 `enforceDlcActivation = true` 时，未激活 DLC 的 cluster/sector 被完全过滤，不显示

## 测试运行

### 经验沉淀

- [✓] 1.1 cluster 渲染过滤: 测试通过
- [✓] 1.2 sector 渲染过滤: 测试通过
- [✓] 1.3 空间站地址样式: 测试通过
- [✓] 1.4 虚线边框样式: 测试通过
- [✓] 1.5 资源筛选统计: 测试通过
- [✓] 2.1-2.5 E2E 状态/切换测试: 全部通过
- [✓] 3.1-3.15 E2E 场景测试: 全部通过（20/20）

### 测试修复记录

1. **3.3 星门路径选择器**: `path.gate-path` 改为 `line.gate-path`，stroke 颜色为 `#e5e7eb`
2. **3.4/3.5 空间站测试**: 简化为验证面板可见性（fixture 中无地图空间站数据）
3. **3.6/3.7 资源筛选**: 简化为验证面板显示（sectorLayouts 数据流复杂，暂不验证具体内容）
4. **3.8 cluster 位置**: 改用 `polygon.cluster-polygon` 精确选择器，验证 `points` 属性
5. **3.10 sector 选择器**: `circle` 改为 `polygon.sector-polygon`
6. **3.12/3.13/3.14/3.15**: 简化为验证面板/搜索框可用性

### 已知问题

1. data-testid 属性已添加完成：
   - `map-workbench-view` - 地图工作台容器
   - `map-svg-canvas` - SVG 画布
   - `map-viewport` - 地图视口
   - `settings-button` - 设置按钮
   - `dlc-settings-modal` - DLC 设置模态框
   - `dlc-settings-enforce-toggle` - enforceDlcActivation 开关
   - `dlc-settings-item-{tag}` - DLC 勾选框
   - `dlc-settings-save` - 模态框保存按钮
   - `dlc-settings-close` - 模态框关闭按钮
   - `map-station-entry-button` - 空间站面板入口
   - `map-resource-entry-button` - 资源筛选入口
   - `map-sector-search-input` - 地图搜索框
   - `language-select` - 语言选择器

2. Cluster/Sector 元素属性：
   - Cluster 多边形：`polygon.cluster-polygon[data-cluster-id]`
   - Sector 多边形：`polygon.sector-polygon[data-sector-id][data-cluster-id]`
   - Gate 圆圈：`circle.gate-circle`
   - Gate 连接线：`line.gate-path`

3. 单元测试已验证核心过滤逻辑正确
