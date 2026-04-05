# POI Search - Design

## Architecture

### 组件结构

```
MapSaveCoordList.vue (现有)
├── MapSavePoiSearchControl.vue (新建)
│   ├── 输入框 + 自定义下拉框
│   ├── 跳数控件（星区模式）
│   └── 药丸tag区域
└── 空间站列表（现有，增强过滤逻辑）
```

### 文件新增/修改

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `src/components/map/MapSavePoiSearchControl.vue` | 新建 | 搜索控件组件 |
| `src/components/map/MapSaveCoordList.vue` | 修改 | 引入搜索控件，增强过滤逻辑 |
| `src/components/map/savePoiSearchFilter.ts` | 新建 | 搜索过滤逻辑函数 |
| `src/composables/useLocalizedNameMatch.ts` | 新建 | i18n名称匹配通用composable |

## Decisions

### Decision 1: 数据方案选择

**已定方案**：使用原始 `StationEntry` 数据过滤，不修改 `SavePoiOverlayItem` 接口。

**理由**：
- `SavePoiCategoryData.groups[].items` 已包含完整 `StationEntry` 数据（含 `modules` 数组）
- 避免 interface 变更带来的兼容性问题
- 搜索过滤时可直接访问原始数据

**实现**：在 `poiGroups` computed 中，从 `group.items`（原始 `StationEntry`）获取 modules 数据进行匹配。

### Decision 2: 模块列表过滤

**已定方案**：只显示有输出的生产模块。

**过滤条件**：
```typescript
const productionModules = Object.values(modulesMap)
  .filter(m => m.type === 'production' && Object.keys(m.outputs).length > 0)
```

**理由**：
- 避免显示dock、storage、connection等非生产模块
- 减少自动完成列表噪音

### Decision 3: 搜索条件分组结构

**数据结构**：
```typescript
interface SearchTag {
  category: 'product' | 'module' | 'faction' | 'sector'
  id: string        // wareId / moduleId / factionId / sectorMacro
  label: string     // 显示名称（本地化）
}

interface SearchState {
  productModuleTags: SearchTag[]  // 组1：产品+模块（OR）
  factionTags: SearchTag[]        // 组2：势力（OR）
  sectorTags: SearchTag[]         // 组3：星区（OR）
  sectorJumpLimit?: number        // 星区跳数限制（0-8）
}
```

**理由**：
- 分离三组便于实现组间AND逻辑
- 组1合并产品+模块便于统一OR逻辑
- 组3独立处理星区可达性计算

### Decision 4: 星区过滤策略

**已定方案**：先计算可达星区集合，再过滤POI。

**实现流程**：
1. 从选中的星区tag计算可达星区ID集合（使用 BFS）
2. 使用 `Set` 存储可达星区ID（小写）
3. 先过滤星区组（只保留可达范围内的星区）
4. 再过滤POI（应用产品/模块/势力条件）

**理由**：
- 星区数量少（几十个），计算一次可达集合效率高
- 避免每个POI都检查一次星区距离
- 减少需要处理的POI数量

### Decision 5: 自动完成数据源

| 类别 | 数据源 | 访问路径 |
|-----|--------|---------|
| 产品 | `waresMap`, `localizedWaresMap` | `gameData.waresMap`, `gameData.localizedWaresMap` |
| 模块 | `modulesMap`, `localizedModulesMap`（过滤后） | 过滤生产模块 |
| 势力 | `factions` | `gameData.factions` |
| 星区 | `maps.clusters` | `gameData.maps.clusters` |

**本地化显示**：使用 `useLocalizedNameMatch` composable 处理英文名和本地化名匹配。

### Decision 6: i18n 名称匹配

**已定方案**：使用通用 composable `useLocalizedNameMatch`。

**匹配规则**：
- 同时匹配英文名（`name`）和本地化名（`localeName`）
- 非英文环境 + 匹配英文名 + 未匹配本地化名 → 显示 `本地化名 (英文名)`

**实现**：
```typescript
const { match, formatLabel } = useLocalizedNameMatch()

const result = match({ englishName, localizedName, query })
// result.matched, result.matchedEnglish, result.matchedLocal, result.shouldShowEnglish

const label = formatLabel(englishName, localizedName, query)
// '能源电池' 或 '能源电池
```

### Decision 7: 过滤触发时机

**已定方案**：添加/删除tag时立即触发过滤。

**实现**：
- 使用 Vue computed 监听 `searchState` 变化
- 在 `filteredGroups` computed 中应用搜索条件
- 跳数变化时，如果存在星区tag则立即重新过滤
- 无需手动点击搜索按钮

### Decision 8: 自定义下拉组件

**已定方案**：使用自定义下拉组件替代原生 `<select>`。

**理由**：
- 原生 select 下拉框样式受浏览器限制，无法完全自定义
- 自定义下拉组件可以完全匹配整体UI风格

**实现**：
- 触发按钮显示当前选中类别
- 点击展开下拉选项列表
- 选项列表样式与自动完成建议列表一致
- 选中项显示 `✓` 标记

### Decision 9: 药丸样式

**已定方案**：简单文本药丸 + 删除按钮，颜色区分类别。

**结构**：
```html
<div class="search-tag sector">
  <span class="tag-label">星区5跳:大交易所</span>
  <button class="tag-remove">×</button>
</div>
```

**样式**：
- 圆角边框 + 半透明背景
- 颜色区分：
  - 产品/模块：amber
  - 势力：蓝色（border-blue-300/15, bg-blue-900/20）
  - 星区：绿色（border-emerald-300/15, bg-emerald-900/20）
- 删除按钮右侧对齐

### Decision 10: 跳数控件设计

**已定方案**：整合在搜索输入框内，参考 resource filter 样式。

**组成**：
- 数字输入框（0-8）
- 后缀"跳"
- 上下步进按钮

**布局**：`[输入框] [跳数输入][跳][▲▼] | [类别下拉]`

## Data Flow

### 搜索流程

```
用户选择类别
  ↓
输入搜索内容
  ↓
触发自动完成搜索（使用 useLocalizedNameMatch 匹配英文名和本地化名）
  ↓
显示建议列表
  ↓
用户选择建议项
  ↓
添加到 searchState（对应分组）
  ↓
触发 filteredGroups recomputed
  ↓
空间站列表更新
```

### 过滤流程

```
filteredGroups computed
  ↓
检查 searchState.sectorTags（组3）
  ↓
如果有星区tag，计算可达星区集合（buildReachableSectorMacros）
  ↓
过滤星区组（只保留可达范围内的星区）
  ↓
检查 searchState.productModuleTags（组1）
检查 searchState.factionTags（组2）
  ↓
遍历每个空间站 group.items（原始 StationEntry）
  ↓
应用匹配规则：
  - 产品：检查 modules[].outputs
  - 模块：检查 modules[].ref / module_id
  - 势力：检查 owner
  ↓
计算匹配结果：
  - 组1匹配 = productModuleTags.length === 0 || 任意tag匹配
  - 组2匹配 = factionTags.length === 0 || 任意tag匹配
  - 组3匹配 = sectorTags.length === 0 || 星区可达
  - 最终匹配 = 组1匹配 AND 组2匹配 AND 组3匹配
  ↓
返回匹配的空间站列表
```

## Edge Cases

### Case 1: 无搜索条件时显示全部

**条件**：所有tag数组为空

**处理**：返回原始 `poiGroups`（不做过滤）

### Case 2: 空间站无modules数据

**条件**：`station.modules === undefined || station.modules.length === 0`

**处理**：
- 产品tag匹配 → false
- 模块tag匹配 → false
- 势力tag匹配 → 检查 `owner` 字段
- 星区tag匹配 → 检查空间站所在星区是否可达

### Case 3: 自动完成输入为空

**条件**：`input.value.trim() === ''`

**处理**：不显示建议列表

### Case 4: 势力为ownerless

**条件**：`station.owner === 'ownerless'`

**处理**：搜索 `势力:ownerless` 时匹配成功

### Case 5: 星区macro大小写不一致

**条件**：存档中星区macro为小写，maps中为大写

**处理**：使用 `toLowerCase()` 进行不区分大小写的匹配

### Case 6: 跳数边界

**条件**：跳数输入超出范围

**处理**：
- 输入 < 0 → 强制为 0
- 输入 > 8 → 强制为 8
- 步进按钮在边界时禁用（不增加/减少）

## Performance Considerations

### 优化点

1. **自动完成延迟**：使用 debounce（300ms）避免频繁搜索
2. **建议列表限制**：最多显示10条结果
3. **模块预过滤**：在组件初始化时预计算生产模块列表（避免每次输入都过滤）
4. **星区可达性缓存**：使用 computed 缓存可达星区集合，只在tag或跳数变化时重新计算
5. **星区ID集合**：使用 `Set` 存储可达星区ID，O(1) 查找

### 性能目标

- 100个空间站过滤响应时间 < 500ms
- 自动完成建议显示 < 300ms
- 星区可达性计算 < 100ms