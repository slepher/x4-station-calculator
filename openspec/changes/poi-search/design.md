# POI Search - Design

## Architecture

### 组件结构

```
MapSaveCoordList.vue (现有)
├── MapSavePoiSearchControl.vue (新建)
│   ├── 输入框 + 类别下拉框
│   └── 药丸tag区域
└── 空间站列表（现有，增强过滤逻辑）
```

### 文件新增/修改

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `src/components/map/MapSavePoiSearchControl.vue` | 新建 | 搜索控件组件 |
| `src/components/map/MapSaveCoordList.vue` | 修改 | 引入搜索控件，增强过滤逻辑 |
| `src/components/map/savePoiSearchFilter.ts` | 新建 | 搜索过滤逻辑函数 |

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
  category: 'product' | 'module' | 'faction'
  id: string        // wareId / moduleId / factionId
  label: string     // 显示名称（本地化）
}

interface SearchState {
  productModuleTags: SearchTag[]  // 组1：产品+模块（OR）
  factionTags: SearchTag[]        // 组2：势力（OR）
}
```

**理由**：
- 分离两组便于实现组间AND逻辑
- 组1合并产品+模块便于统一OR逻辑

### Decision 4: 自动完成数据源

| 类别 | 数据源 | 访问路径 |
|-----|--------|---------|
| 产品 | `localizedWaresMap` | `gameDataStore.localizedWaresMap` |
| 模块 | `localizedModulesMap`（过滤后） | `gameDataStore.localizedModulesMap`（过滤生产模块） |
| 势力 | `factions` | `gameDataStore.factions` |

**本地化显示**：使用 `localizedWaresMap` / `localizedModulesMap` 提供本地化名称。

### Decision 5: 过滤触发时机

**已定方案**：添加/删除tag时立即触发过滤。

**实现**：
- 使用 Vue computed 监听 `searchState` 变化
- 在 `filteredGroups` computed 中应用搜索条件
- 无需手动点击搜索按钮

### Decision 6: 药丸样式

**已定方案**：简单文本药丸 + 删除按钮。

**样式参考**：类似 `MapSaveCategoryMenu.vue` 的 checkbox item 样式。

**结构**：
```html
<div class="search-tag">
  <span class="tag-label">产品:能源电池</span>
  <button class="tag-remove">×</button>
</div>
```

**样式**：
- 圆角边框 + 半透明背景
- 悬浮时边框亮度增加
- 删除按钮右侧对齐

## Data Flow

### 搜索流程

```
用户选择类别
  ↓
输入搜索内容
  ↓
触发自动完成搜索（只搜索选定类别数据源）
  ↓
显示建议列表
  ↓
用户选择建议项
  ↓
添加到 searchState（productModuleTags 或 factionTags）
  ↓
触发 filteredGroups recomputed
  ↓
空间站列表更新
```

### 过滤流程

```
filteredGroups computed
  ↓
检查 searchState.productModuleTags（组1）
  ↓
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
  - 最终匹配 = 组1匹配 AND 组2匹配
  ↓
返回匹配的空间站列表
```

## Edge Cases

### Case 1: 无搜索条件时显示全部

**条件**：`productModuleTags.length === 0 && factionTags.length === 0`

**处理**：返回原始 `poiGroups`（不做过滤）

### Case 2: 空间站无modules数据

**条件**：`station.modules === undefined || station.modules.length === 0`

**处理**：
- 产品tag匹配 → false
- 模块tag匹配 → false
- 势力tag匹配 → 检查 `owner` 字段

### Case 3: 自动完成输入为空

**条件**：`input.value.trim() === ''`

**处理**：不显示建议列表

### Case 4: 势力为ownerless

**条件**：`station.owner === 'ownerless'`

**处理**：搜索 `势力:ownerless` 时匹配成功

## Performance Considerations

### 优化点

1. **自动完成延迟**：使用 debounce（300ms）避免频繁搜索
2. **建议列表限制**：最多显示10条结果
3. **模块预过滤**：在组件初始化时预计算生产模块列表（避免每次输入都过滤）

### 性能目标

- 100个空间站过滤响应时间 < 500ms
- 自动完成建议显示 < 300ms