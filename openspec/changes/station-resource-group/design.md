# station-resource-group Design

## Architecture

### Component Structure

```
MapResourceFilterAdvancedPanel.vue
├── advanced-add-btn (新增组按钮)
├── resource-group-loader (载入组件)
│   ├── loader-trigger (按钮)
│   └── loader-menu (下拉菜单，fixed定位)
└── advanced-group-list (组列表)
```

### Data Flow

**星区分组**：
```
useEmpireStore()
├── sectors (星区列表)
└── activeEmpire.stations (空间站列表)
    └── stationStateMap.getGroupedFlows(station.id)
        └── rateGroups.resources (资源列表)
```

**逻辑组网分组**：
```
useLogicFlowStore()
└── savedPlans.list (存档列表)
    └── LogicFlowPlan.groups (SavedFlowGroup[])
        └── SavedFlowNode (isolated | module)
            └── computeExpandUpstream(ctx, groupSnapshot, wareId)
                └── result.newNodes (展开后的节点)
                    └── tier0 资源过滤
```

## Decisions

### 1. 组件复用策略

参考 `ShipBuildPanelFit.vue` 中的蓝图选择器实现：
- 使用相同的 fixed 定位计算逻辑
- 相同的菜单显示/隐藏逻辑
- 相似的样式风格（调整为 amber 主题）

### 2. 菜单定位

使用 `getBoundingClientRect()` 计算面板位置：
- `top`: 按钮的 top 值
- `left`: 面板右侧 + 8px

### 3. 状态管理

- `loadedSourceId`: 当前载入的来源 ID（星区 ID 或存档 ID），null 表示"自定义"
- `loadedSourceType`: 当前载入的来源类型（'sector' | 'logicflow'）
- `menuOpen`: 控制下拉菜单显示
- `menuStyle`: 菜单的 inline style（position）

### 4. 数据获取时机

- 载入列表：computed，从各 Store 获取
- 空间站资源：载入时实时从 stationStateMap 获取
- tier0 资源：载入时通过 `computeExpandUpstream` 计算

### 5. tier0 资源获取算法

使用 `computeExpandUpstream` 展开 SavedFlowGroup：

```typescript
function getTier0ResourcesForGroup(
  savedGroup: SavedFlowGroup,
  gameData: GameDataStore
): string[] {
  // 1. 获取初始 wareIds
  const wareIds: string[] = []
  for (const node of savedGroup.nodes) {
    if (node.isolated) {
      wareIds.push(node.isolated)
    } else if (node.module) {
      const module = gameData.modulesMap[node.module]
      const outputWareId = Object.keys(module.outputs)[0]
      if (outputWareId) wareIds.push(outputWareId)
    }
  }
  
  // 2. 构建 ExpandContext
  const ctx: ExpandContext = {
    waresMap: gameData.waresMap,
    modulesMap: gameData.modulesMap,
    modulesByOutputMap: gameData.modulesByOutputMap
  }
  
  // 3. 构建 GroupSnapshot
  const groupSnapshot: GroupSnapshot = {
    id: savedGroup.id,
    nodes: [],
    isLocked: savedGroup.isLocked,
    lockedLineage: savedGroup.lockedLineage,
    subCategory: savedGroup.subCategory
  }
  
  // 4. 展开并收集 tier0 资源
  const allNodes: FlowNode[] = []
  for (const wareId of wareIds) {
    const result = computeExpandUpstream(ctx, groupSnapshot, wareId, 'manual')
    allNodes.push(...result.newNodes)
    groupSnapshot.nodes.push(...result.newNodes)
  }
  
  // 5. 过滤 tier0
  const tier0WareIds = allNodes
    .filter(n => {
      const ware = gameData.waresMap[n.wareId]
      return ware && ware.tier === 0 && n.wareId !== 'energycells'
    })
    .map(n => n.wareId)
  
  return [...new Set(tier0WareIds)]
}
```

## UI Design

### 按钮样式

- 类似 `ship-blueprint-trigger`，使用 amber 主题
- 显示当前状态 + 下拉箭头图标

### 下拉菜单样式

- 两个分组标题："星区"和"逻辑组网"
- 菜单项：`loader-menu-item`
- 当前选中项高亮

### 样式参考

```css
.resource-group-loader-trigger {
  @apply inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-400/50 text-amber-200 hover:bg-amber-500/10 transition-colors;
}

.resource-group-loader-menu {
  @apply fixed z-[120] w-max min-w-40 max-h-64 overflow-y-auto rounded-md border border-amber-400/40 bg-slate-900/95 p-1 shadow-2xl;
}

.loader-menu-group-title {
  @apply px-2 py-1 text-xs font-semibold text-amber-200/70 uppercase tracking-wide;
}

.loader-menu-item {
  @apply w-full text-left px-3 py-1.5 text-sm text-amber-50 rounded hover:bg-amber-500/15 transition-colors;
}

.loader-menu-item.active {
  @apply bg-amber-500/20 text-amber-200;
}
```