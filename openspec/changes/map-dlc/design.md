# map-dlc 设计说明

## 设计目标
为地图界面建立一套与 `ship-dlc`、`station-dlc-tag` 一致的 DLC 消费语义，覆盖星系渲染过滤、星区资源统计排除、星门保持显示，以及未激活 DLC 空间站地址标红。设计重点是复用 `useGameDataStore` 已有的 DLC 状态与 helper，而不是在地图组件中重新实现判断逻辑。

## 1. 整体结构

### 1.1 状态来源分层
- `useGameDataStore` 继续作为 DLC 激活状态中心
- 地图组件只消费以下能力：
  - `enforceDlcActivation`
  - `isDlcActive(dlcTag)`
  - `filterActiveDlcItems(items)`
- 地图层、资源筛选层、空间站面板层都不直接读取 `localStorage`

### 1.2 星系过滤分层
- 星系（cluster）过滤在数据消费层完成，而非渲染层
- `MapSvgCanvas.vue` 中的 `clusters` computed 属性执行过滤
- 这样确保下游的星区遍历、星门渲染都基于过滤后的星系集合

### 1.3 星区过滤分层
- `MapWorkbenchView.vue` 中的 `sectorsById` computed 属性执行过滤
- 搜索、资源统计、空间站地址解析都基于该过滤后的星区集合

### 1.4 星门渲染策略
- 星门渲染在 `MapSvgCanvas.vue` 中完成
- 星门保持显示，即使目标星系被过滤
- 不添加额外的视觉处理（置灰、虚线等）

### 1.5 空间站地址标红分层
- 在 `MapStationPanel.vue` 或 `MapWorkbenchView.vue` 的 `stationPanelItems` computed 中
- 为每个空间站项添加 `isAddressInactive` 标记
- 模板层根据该标记应用红色样式

## 2. 组件修改设计

### 2.1 MapSvgCanvas.vue

#### Cluster 过滤
```typescript
const clusters = computed<Record<string, Cluster>>(() => {
  const allClusters = (gameData.maps as unknown as { clusters: Record<string, Cluster> })?.clusters || {}
  if (!gameData.enforceDlcActivation) return allClusters

  return Object.fromEntries(
    Object.entries(allClusters).filter(([, cluster]) =>
      gameData.isDlcActive(cluster.dlc_tag)
    )
  )
})
```

#### 影响范围
- 星系多边形渲染
- 星区标签渲染
- 星门渲染（源星系被过滤时星门不显示，但目标星系过滤不影响星门）
- 空间站 overlay 位置计算

### 2.2 MapWorkbenchView.vue

#### SectorsById 过滤
```typescript
const sectorsById = computed<Record<string, MapSectorDataset>>(() => {
  const out: Record<string, MapSectorDataset> = {}
  const clusters = gameDataStore.maps?.clusters || {}

  Object.entries(clusters).forEach(([clusterId, cluster]) => {
    // 添加 DLC 过滤
    if (gameDataStore.enforceDlcActivation && !gameDataStore.isDlcActive(cluster.dlc_tag)) {
      return
    }

    Object.values(cluster.sectors || {}).forEach((sector: any) => {
      // ... existing logic
    })
  })
  return out
})
```

#### StationPanelItems 添加标红标记
```typescript
const stationPanelItems = computed<MapStationPanelItem[]>(() => {
  // ... existing logic

  sortedSectors.forEach((sector) => {
    const sectorData = sectorsById.value[sector.location?.sector_id || '']
    const isAddressInactive = gameDataStore.enforceDlcActivation &&
      !gameDataStore.isDlcActive(/* sector's cluster dlc_tag */)

    items.push({
      // ... existing fields
      isAddressInactive
    })
    // ... stations
  })
})
```

### 2.3 MapResourceFilterSimplePanel.vue & MapResourceFilterAdvancedPanel.vue

#### Sector 遍历时过滤
```typescript
const clusters = gameData.maps?.clusters || {}
Object.values(clusters).forEach((cluster) => {
  // 添加 DLC 过滤
  if (gameData.enforceDlcActivation && !gameData.isDlcActive(cluster.dlc_tag)) {
    return
  }
  // ... existing sector processing
})
```

## 3. 类型扩展

### MapStationPanelItem 类型扩展
```typescript
type MapStationPanelItem = {
  // ... existing fields
  isAddressInactive?: boolean  // 新增：地址是否位于未激活 DLC 星区
}
```

## 4. 多 Sector Cluster 边距设计

### 4.1 设计目标
为多 sector cluster 添加内层虚拟边框，使 sector 与外层 cluster 边界之间产生均匀的视觉边距。

### 4.2 方案参数

| Cluster 类型 | 内层虚拟边框 | Sector 缩放 | 最终效果 |
|-------------|-------------|------------|---------|
| 1-sector | 无 | 1.0 (填满) | Sector 填满整个 cluster |
| 2-sector | 0.96 | 0.96 (紧贴内层) | Sector 紧贴内层边框，与外层边框有 4% 边距 |
| 3-sector | 0.98 | 0.97 (相对于内层) | Sector 相对于内层边框有 3% 边距，与外层边框有 5% 边距 |

### 4.3 计算逻辑
```typescript
// 根据 sector 数量确定参数
if (sectorCount === 2) {
  innerPadding = 0.96  // 内层边框为外层 96%
  sectorScale = 0.96   // sector 紧贴内层边框
} else if (sectorCount === 3) {
  innerPadding = 0.98  // 内层边框为外层 98%
  sectorScale = 0.97   // sector 相对于内层 97%
}

// 位置计算（相对于内层边框）
const sx = center.x + ratio.x * clusterRadius * innerPadding
const sy = center.y + ratio.y * clusterRadius * innerPadding

// 大小计算
const radius = sectorRadiusRatio * clusterRadius * sectorScale
```

### 4.4 影响范围
- `clusterPolygons` - sector 位置和大小计算
- `clipDefs` - resource overlay 剪裁路径
- `highwayPaths` - highway 路径计算

## 5. 样式设计

### 空间站地址标红样式
```css
/* 在 MapStationPanel.vue 或 MapWorkbenchView.vue 的 style 中 */
.station-address-inactive {
  color: #ef4444; /* red-500 */
}
```

## 5. 状态刷新与一致性

### 5.1 DLC 设置变化后的刷新
- 当 `enforceDlcActivation` 或 `activeDlcs` 变化时，以下 computed 属性自动重新计算：
  - `MapSvgCanvas.vue` 中的 `clusters`
  - `MapWorkbenchView.vue` 中的 `sectorsById`、`stationPanelItems`
  - 资源筛选面板中的统计结果

### 5.2 单一语义来源
- 所有 DLC 相关判断都通过 `useGameDataStore` helper 完成
- 不允许在地图各组件分别复制一套 `dlc_tag === 'base'` 或 `activeDlcs.includes(...)` 的判断

## 6. 风险与对策

- **风险**：星门连接到被过滤的星系时出现悬空连接
  - **对策**：星门渲染基于源星系，只要源星系存在就显示；不额外处理目标星系不存在的情况
- **风险**：空间站已放置在未激活 DLC 星区，过滤后无法显示位置
  - **对策**：空间站地址标红提示用户，但不自动移除或阻止交互
- **风险**：页面分散实现 DLC 判断，后续行为漂移
  - **对策**：强制复用 `useGameDataStore` 暴露的统一 helper
