# user-save-map Design

## Architecture

### 组件结构

```
src/components/empire/
├── MapWorkbenchView.vue          # 修改：添加存档按钮、集成侧边栏状态
├── MapSavePanel.vue              # 新增：存档侧边栏主组件
├── MapSaveArchiveList.vue        # 新增：L1层 - 存档列表
├── MapSaveCategoryMenu.vue       # 新增：L2层 - 分类子菜单
├── MapSaveCoordList.vue          # 新增：L3层 - 坐标列表
├── MapSaveBreadcrumb.vue         # 新增：面包屑导航组件
├── MapSavePoiTooltip.vue         # 新增：兴趣点tooltip
└── MapSvgCanvas.vue              # 修改：支持兴趣点叠加层渲染
```

### 状态管理

在 `MapWorkbenchView.vue` 中新增状态：

```typescript
// 存档侧边栏状态
const isSavePanelOpen = ref(false)
const savePanelLayer = ref<'list' | 'category' | 'coord'>('list')
const savePanelBreadcrumb = ref<{ archiveName: string; categoryName: string }>({ archiveName: '', categoryName: '' })

// 选中的存档
const selectedSaveArchive = ref<SaveArchive | null>(null)

// 分类显示状态（checkbox）
const savePoiVisibility = ref<Record<string, boolean>>({
  playerStations: false,
  npcStations: false,
  abandonedShips: false,
  datavaults: false,
  erlkingVaults: false
})

// 聚焦的兴趣点key
const focusedSavePoiKey = ref<string | null>(null)
```

---

## Decisions

### D1: 层叠导航实现方式

**决策**：使用单一侧边栏组件 `MapSavePanel.vue`，内部根据 `savePanelLayer` 状态切换子组件。

**理由**：
- 避免多个侧边栏 DOM 同时存在
- 状态管理简单，便于面包屑导航
- 与现有 `MapStationPanel` 的 `open` prop 模式一致

**实现**：
```vue
<template>
  <aside v-show="open" class="map-save-panel">
    <MapSaveBreadcrumb :items="breadcrumbItems" @navigate="onBreadcrumbNavigate" />
    <MapSaveArchiveList v-if="layer === 'list'" ... />
    <MapSaveCategoryMenu v-if="layer === 'category'" ... />
    <MapSaveCoordList v-if="layer === 'coord'" ... />
  </aside>
</template>
```

---

### D2: 坐标转换算法

**决策**：复用现有 `MapSvgCanvas.vue` 的坐标转换逻辑，反向计算游戏坐标到屏幕坐标。

**输入**：
- 存档实体坐标：`{ x: number, z: number }`（游戏内坐标）
- 星区 macro：用于确定所属 cluster 和 scale_per_radius

**转换步骤**：
1. 根据星区 macro 找到对应的 `MapSectorDataset`，获取 `scalePerRadius`
2. 游戏坐标 → 星区内部比例：`ratioX = x * scalePerRadius`, `ratioY = -z * scalePerRadius`
3. 星区比例 → cluster 比例：调用 `sectorRatioToClusterRatio`
4. cluster 比例 → 屏幕坐标：调用 `clusterRatioToScreen`

**注意**：存档数据需包含星区 macro 信息，需扩展 `SectorData` 类型或新增映射表。

---

### D3: 兴趣点叠加层数据结构

**决策**：新增 `SavePoiOverlay` 类型，与现有 `PlacementOverlay` 共存但独立管理。

```typescript
type SavePoiCategory = 'playerStation' | 'npcStation' | 'abandonedShip' | 'datavault' | 'erlkingVault'

interface SavePoiOverlay {
  key: string              // `${category}:${code}`
  code: string             // 实体 code，显示在标记上方
  category: SavePoiCategory
  owner?: string
  sectorMacro: string      // 星区 macro，用于坐标转换
  pos: { x: number; z: number }
}
```

**渲染**：在 `MapSvgCanvas.vue` 中新增 `<g class="save-poi-overlays">` 层，与 `<g class="station-overlays">` 分离。

---

### D4: 分类颜色方案

**决策**：使用 Tailwind CSS 颜色变量，便于后续调整。

| 分类 | 颜色类 | SVG颜色值 |
|------|--------|-----------|
| 用户空间站 | amber-400 | #fbbf24 |
| NPC据点 | amber-200/60 | rgba(252, 211, 77, 0.6) |
| 弃船 | purple-400 | #c084fc |
| 保险箱 | cyan-400 | #22d3ee |
| 妖王保险箱 | emerald-400 | #34d399 |

---

### D5: Checkbox状态不持久化

**决策**：每次打开存档（进入L2层）时重置所有 checkbox 为未勾选状态。

**实现**：
```typescript
watch([isSavePanelOpen, selectedSaveArchive], () => {
  if (isSavePanelOpen.value && selectedSaveArchive.value) {
    // 进入分类层时重置
    savePoiVisibility.value = {
      playerStations: false,
      npcStations: false,
      abandonedShips: false,
      datavaults: false,
      erlkingVaults: false
    }
  }
})
```

---

### D6: 星区 macro 映射

**问题**：存档 `SectorData` 的 key 是星区 macro（如 `sector_macro_01`），需要映射到地图的 `sectorId`。

**决策**：在 `useGameDataStore` 中构建 `sectorMacroToIdMap`，或在解析存档时直接存储 `sectorId`。

**方案**：优先使用 `gameDataStore` 中的 `maps.sectors` 反向查找：
```typescript
function getSectorIdFromMacro(macro: string): string | null {
  const clusters = gameDataStore.maps?.clusters || {}
  for (const cluster of Object.values(clusters)) {
    for (const [sectorId, sector] of Object.entries(cluster.sectors || {})) {
      if (sector.macro === macro || sectorId === macro) {
        return sectorId
      }
    }
  }
  return null
}
```

---

### D7: Focus 定位行为

**决策**：点击坐标项时，调用类似 `focusPlacementOverlay` 的逻辑，但使用固定缩放比例（如 scale=1）。

**实现**：
```typescript
const focusSavePoi = async (poi: SavePoiOverlay) => {
  const targetScale = scale.value < 1 ? clampScale(1) : scale.value
  if (targetScale !== scale.value) {
    scale.value = targetScale
    syncSliderFromScale()
    await nextTick()
  }
  // 计算屏幕坐标并居中
  const screenPos = computeSavePoiScreenPosition(poi)
  clampPan(
    panX.value + viewportRect.width / 2 - screenPos.x,
    panY.value + viewportRect.height / 2 - screenPos.y
  )
  focusedSavePoiKey.value = poi.key
}
```

---

## Component Dependencies

```
MapWorkbenchView.vue
├── MapSavePanel.vue (新增)
│   ├── MapSaveBreadcrumb.vue (新增)
│   ├── MapSaveArchiveList.vue (新增)
│   │   └── SaveUploadPanel.vue (复用)
│   ├── MapSaveCategoryMenu.vue (新增)
│   └── MapSaveCoordList.vue (新增)
├── MapSvgCanvas.vue (修改)
│   └── MapSavePoiTooltip.vue (新增)
└── MapSectorTooltip.vue (复用，可能需要扩展)
```

---

## File Changes Summary

| 文件 | 操作 | 说明 |
|------|------|------|
| `MapWorkbenchView.vue` | 修改 | 添加存档按钮、状态管理、事件处理 |
| `MapSavePanel.vue` | 新增 | 存档侧边栏主组件 |
| `MapSaveArchiveList.vue` | 新增 | L1层存档列表 |
| `MapSaveCategoryMenu.vue` | 新增 | L2层分类子菜单 |
| `MapSaveCoordList.vue` | 新增 | L3层坐标列表 |
| `MapSaveBreadcrumb.vue` | 新增 | 面包屑导航 |
| `MapSvgCanvas.vue` | 修改 | 支持兴趣点叠加层 |
| `MapSavePoiTooltip.vue` | 新增 | 兴趣点tooltip |
| `useSaveStore.ts` | 可能修改 | 添加分类数据计算方法 |
| `zh-CN.json` / `en.json` | 修改 | 添加新文案 |