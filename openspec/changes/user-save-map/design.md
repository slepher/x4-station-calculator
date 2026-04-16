# user-save-map Design

## Architecture

### 组件结构

```
src/components/map/
├── MapWorkbenchView.vue          # 修改：添加存档按钮、集成侧边栏状态、右上角控件
├── MapSavePanel.vue              # 新增：存档侧边栏主组件
├── MapSaveArchiveList.vue        # 新增：L1层 - 存档列表
├── MapSaveCategoryMenu.vue       # 新增：L2层 - 分类子菜单（仅导航）
├── MapSaveCoordList.vue          # 新增：L3层 - 坐标列表
├── MapSaveBreadcrumb.vue         # 新增：面包屑导航组件
├── MapSavePoiTooltip.vue         # 新增：兴趣点tooltip
├── MapSavePoiVisibilityControl.vue # 新增：右上角POI显示控制
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
  playerStation: false,
  npcStation: false,
  xenonStation: false,
  khaakStation: false,
  abandonedShip: false,
  datavault: false,
  erlkingVault: false
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
type SavePoiCategory = 'playerStation' | 'npcStation' | 'xenonStation' | 'khaakStation' | 'abandonedShip' | 'datavault' | 'erlkingVault'

interface SavePoiOverlayItem {
  key: string              // `${category}:${code}`
  code: string             // 实体 code，显示在标记上方
  category: SavePoiCategory
  owner?: string
  sectorMacro: string      // 星区 macro，用于坐标转换
  sectorName: string
  pos: { x: number; z: number }
  tag?: string             // 空间站类型标签，用于图标选择
  productionProfile?: string
  profileName?: string
  is_headquarter?: boolean // 是否为总部，影响图标选择
}
```

**渲染**：在 `MapSvgCanvas.vue` 中新增 `<g class="save-poi-overlays">` 层，与 `<g class="station-overlays">` 分离。

**图标选择逻辑**：
- 空间站类别根据 `tag` 和 `is_headquarter` 选择 SVG 图标
- `playerStation` + `is_headquarter=true` → `playerhq.svg`
- 其他空间站 + `is_headquarter=true` → `<tag>_headquarter.svg`
- 空间站 + `is_headquarter=false` → `<tag>.svg`
- 非空间站类别保持小圆点渲染

---

### D4: 分类颜色方案

**决策**：使用 Tailwind CSS 颜色变量，便于后续调整。

| 分类 | 颜色类 | SVG颜色值 |
|------|--------|-----------|
| 用户空间站 | amber-400 | #fbbf24 |
| NPC空间站 | amber-200/60 | rgba(252, 211, 77, 0.6) |
| XEN空间站 | red-400 | #f87171 |
| KHA空间站 | purple-500 | #a855f7 |
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
      playerStation: false,
      npcStation: false,
      xenonStation: false,
      khaakStation: false,
      abandonedShip: false,
      datavault: false,
      erlkingVault: false
    }
  }
})
```

---

### D5.1: 移除“小条件站点过滤”用户选项

**决策**：移除 save 面板中的“剔除小条件站点”开关，分类菜单、坐标列表、POI 列表统计始终显示完整数据。

**说明**：
- 该选项最初用于用户侧性能开关，但当前不再暴露给用户
- `SaveArchiveSettings` 中仅保留 `visibility`
- 地图覆盖层内部如仍需按视口做小图标动态隐藏，属于渲染层优化，不再由用户设置驱动

---

### D5.2: 空间站生产画像与 i18n 命名

**决策**：在 post-process 阶段为玩家/NPC 空间站生成 `productionProfile`，并在 save POI 列表与 tooltip 统一使用同一命名解析函数。

**范围**：
- `playerStations`：计算 `productionProfile` / `profileName`
- `npcStations`：计算 `productionProfile` / `profileName`
- `xenonStations` / `khaakStations`：不计算 `productionProfile`

**productionProfile 规则**：
- 单一生产模块：写 `module_id`
- 同组多模块：写单个 `group id`
- 同簇多组：不保留整条优先级链，直接按优先级落单个 `group id`
  - 技术簇：`shiptech > hightech > refined`
  - 生活簇：`pharmaceutical > agricultural > food > water`
- 跨簇混合：写 `mixed`
- `energy` 从分组判断中剔除；若仅有 `energycells` 生产，则仍按单模块处理

**显示规则**：
- `tag="factory"`:
  - `module_id` → 使用游戏 module i18n
  - `group id` → 使用游戏 module_group i18n
  - `mixed` → 使用界面 i18n “综合体”
- `tag!="factory"`：使用 tag 对应的界面 i18n
- `khaakStation` 的 `tag="weaponplatform"` → 使用“武器平台”

**总部特例**：
- `playerStation && is_headquarter=true`：主名称直接显示“总部”
- 所有空间站（player/npc/xenon/khaak）若 `is_headquarter=true`：
  - 列表显示绿色药丸“总部”标签
  - tooltip 额外显示一行“总部”

---

### D6: POI 显示控制控件位置与样式

**决策**：将 POI 显示控制 checkbox 从侧边栏分类层移至地图右上角折叠菜单。

**位置**：
- `right-6 top-5`，与左上角搜索框对称
- 与左下角按钮组、右下角缩放控件形成四角对称布局

**样式**：
- 折叠态：触发按钮，样式与左下角按钮一致（bg-black/75 + border-amber-300/40 + backdrop-blur）
- 展开态：checkbox 列表容器，样式与左上角搜索框一致

**显示条件**：
- 仅当 `activeMapArchive` 存在时显示
- 切换存档或取消选择时保持显示（如果有存档）

**理由**：
- 将显示控制从侧边栏分离，避免侧边栏层级导航与显示控制混杂
- 右上角位置与现有四角控件对称，视觉平衡
- 折叠设计避免遮挡地图内容

---

### D7: 分类层导航职责简化

**决策**：分类层仅保留导航功能，移除 checkbox。

**规则**：
- 分类项显示：分类名称 + 数量统计 + 右侧箭头按钮
- 分类整行和空白区域不触发任何交互
- 只有右侧箭头按钮负责进入 L3 坐标列表
- checkbox 功能转移到右上角折叠控件

**理由**：
- 职责分离：导航在侧边栏，显示控制在地图控件
- 避免 checkbox 与导航入口混在一起导致用户困惑

---

### D8: 详情层临时可见类别

**决策**：地图上的存档兴趣点可见类别，不再只由 checkbox 状态决定，而是取“checkbox 勾选类别 + 当前详情层激活类别”的并集。

**实现要点**：
- `MapSavePanel.vue` 维护当前 `selectedCategory`
- 当 layer 进入 `coord` 时，将该类别通过事件上抛给 `MapWorkbenchView.vue`
- `MapWorkbenchView.vue` 计算 `effectiveVisibleCategories`
- 返回分类层、关闭面板、切换存档时，清空该临时类别

**效果**：
- 未勾选类别也可在 L3 中显示 marker，支持列表 focus
- 返回 L2 后若 checkbox 仍未勾选，marker 自动消失
- 不得自动修改 checkbox 本身

---

### D9: 星区 macro 映射

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

### D10: Focus 定位行为

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
| `MapWorkbenchView.vue` | 修改 | 添加存档按钮、状态管理、事件处理、右上角控件 |
| `MapSavePanel.vue` | 新增 | 存档侧边栏主组件 |
| `MapSaveArchiveList.vue` | 新增 | L1层存档列表 |
| `MapSaveCategoryMenu.vue` | 新增 | L2层分类子菜单（仅导航，无checkbox） |
| `MapSaveCoordList.vue` | 新增 | L3层坐标列表 |
| `MapSaveBreadcrumb.vue` | 新增 | 面包屑导航 |
| `MapSavePoiVisibilityControl.vue` | 新增 | 右上角POI显示控制折叠菜单 |
| `MapSvgCanvas.vue` | 修改 | 支持兴趣点叠加层 |
| `MapSavePoiTooltip.vue` | 新增 | 兴趣点tooltip |
| `useSaveStore.ts` | 可能修改 | 添加分类数据计算方法 |
| `savePoiVisibility.ts` | 新增 | 合并 checkbox 显示状态与详情层临时类别 |
| `zh-CN.json` / `en.json` | 修改 | 添加新文案 |

---

### D11: 阵营颜色染色

**决策**：使用 SVG `feColorMatrix` filter 对图标进行阵营颜色染色。

**数据来源**：
- `factionColorMap` 从 `factions.json` 提取：`{ [factionId]: color }`
- 如 `player` → `#4DFF4D`，`argon` → `#0069B3`

**颜色转换算法**：
```typescript
function colorToFeColorMatrix(hex: string): string {
  const rgb = hexToRgb(hex)
  return `${rgb.r} 0 0 0 0  ${rgb.g} 0 0 0 0  ${rgb.b} 0 0 0 0  0 0 0 1 0`
}
```

**渲染方式**：
- 为每个阵营颜色生成一个 SVG filter
- 图标通过 `filter="url(#faction-color-xxx)"` 应用颜色

---

### D12: 星区/Cluster Owner Override

**决策**：从存档提取 owner 映射，覆盖地图默认颜色。

**实现**：
```typescript
// sectorOwnerOverride: sectorId -> owner
const sectorOwnerOverride = computed(() => {
  // 从存档 sectors 提取 owner
})

// clusterOwnerOverride: clusterId -> owner
const clusterOwnerOverride = computed(() => {
  // 若所有 sector owner 相同，使用该 owner
  // 否则使用 'ownerless'
})
```

**resolveOwnerColor 优先级**：
1. sector owner override
2. cluster owner override
3. 默认 owner_color

---

### D13: 高亮状态保持阵营颜色

**问题**：CSS `.focused` 的 `filter` 会覆盖 SVG 内联 filter。

**决策**：创建两套 SVG filter：
- `faction-color-xxx` - 只有阵营颜色
- `faction-color-xxx-focused` - 阵营颜色 + drop-shadow 高亮

**模板选择**：
```vue
:filter="poi.factionFilterId ? 
  `url(#${poi.factionFilterId}${isFocused ? '-focused' : ''})` : 
  undefined"
```

---

### D14: Tooltip Owner i18n

**决策**：使用 faction 的 `nameId` 进行本地化翻译。

**实现**：
```typescript
const ownerName = computed(() => {
  const owner = overrideOwner || sectorInfo.value?.owner || 'ownerless'
  if (owner === 'ownerless') return t('map.owner_ownerless')
  
  const faction = gameDataStore.factions?.find(f => f.id === owner)
  if (faction?.nameId && te(faction.nameId)) {
    return t(faction.nameId)
  }
  return faction?.name || owner
})
```

---

### D15: Abandoned Ship Icon Mapping

**决策**：弃船使用飞船类型图标替代圆点，根据 `class` + `purpose` 选择对应 SVG。

**图标命名规范**：
```
ship_{size}_{purpose}_01.svg
```
- size: `l`, `m`, `s`, `xl`, `xs`
- purpose: `fight`, `mine`, `trade`, `build`, `dismantling`, `salvage`, `auxiliary`

**映射表**：
```typescript
SHIP_CLASS_PURPOSE_ICON_MAP = {
  'ship_l': {
    fight: ship_l_fight_01.svg,
    mine: ship_l_mine_01.svg,
    trade: ship_l_trade_01.svg,
    dismantling: ship_l_dismantling_01.svg
  },
  'ship_m': {
    fight: ship_m_fight_01.svg,
    mine: ship_m_mine_01.svg,
    trade: ship_m_trade_01.svg,
    salvage: ship_m_salvage_01.svg
  },
  'ship_s': {
    fight: ship_s_fight_01.svg,
    mine: ship_s_mine_01.svg,
    trade: ship_s_trade_01.svg
  },
  'ship_xl': {
    build: ship_xl_build_01.svg,
    fight: ship_xl_fight_01.svg,
    auxiliary: ship_xl_auxiliary_01.svg
  }
}
```

**过滤规则**：
- 仅处理在 `ships.json` 中能找到对应 macro 的弃船
- 找不到 ship 数据的弃船在 postProcessor 中过滤掉

---

### D16: Abandoned Ship Data Enhancement

**决策**：在 saveParser.post.ts 中为弃船添加 `shipId` 和 `purpose` 字段。

**数据来源**：
- `ships.json` 中的 `macro` 字段用于匹配存档中的 `ship.macro`
- 从匹配的 ship 数据中提取 `id` 作为 `shipId`，`purposePrimary` 作为 `purpose`

**类型定义**：
```typescript
interface AbandonedShipEntry {
  code: string
  macro: string
  class: string
  shipId?: string    // 新增：飞船 ID，用于 i18n
  purpose?: string   // 新增：用途，用于图标选择
  relative_position: { x: number; y: number; z: number }
  zone_id?: string
  position: SaveSectorStaticPosition
}
```

---

### D17: Abandoned Ship Tooltip Enhancement

**决策**：弃船 tooltip 显示 i18n 化的飞船名称。

**实现**：
```typescript
const shipName = computed(() => {
  if (poi.category !== 'abandonedShip' || !poi.shipId) return null
  const ship = shipBuildStore.shipMap.get(poi.shipId)
  if (!ship) return poi.shipId
  if (ship.nameId && te(ship.nameId)) {
    return t(ship.nameId)
  }
  return ship.name || poi.shipId
})
```

---

### D18: Unified Overlay Item Creation

**决策**：使用统一的 `createOverlayItem` 函数构建 `SavePoiOverlayItem`。

**理由**：
- 确保 MapSaveCoordList 和 MapSvgCanvas 使用相同的数据结构
- 避免 tooltip 内容不一致

**实现**：
```typescript
export function createOverlayItem(
  category: SavePoiCategory,
  sectorMacro: string,
  sectorName: string,
  item: StationEntry | DatavaultEntry | AbandonedShipEntry
): SavePoiOverlayItem
```

---

### D19: POI Rendering Order

**决策**：高亮的 POI 必须在 z-index 上位于最上方，不被其他 POI 遮挡。

**实现**：
- 在 `MapOverlayLayer.vue` 中将 POI 分为两组：
  - `normalPoiItems`：非高亮的 POI
  - `focusedPoiItem`：高亮的 POI
- 渲染顺序：先渲染非高亮，再渲染高亮
- SVG 中后渲染的元素位于上层，确保高亮 POI 不被遮挡

---

### D20: POI Text Display

**决策**：移除所有 POI 上方的文字显示。

**理由**：
- 简化地图视图，避免文字重叠
- 用户可通过点击 POI 查看 tooltip 获取详细信息

---

### D21: POI Category i18n

**决策**：统一 POI 分类名称的 i18n。

**中文名称**：
- 用户空间站 → 玩家空间站
- NPC据点 → 势力空间站
- XEN空间站 → Xenon空间站
- KHA空间站 → Khaak空间站
- 保险箱 → 日志数据仓库
- 妖王保险箱 → 妖王配件数据仓库

**英文名称**：
- NPC Stations → Faction Stations
- XEN Stations → Xenon Stations
- KHA Stations → Khaak Stations

**注意**：Khaak 不带撇号（不是 Kha'ak）
```
