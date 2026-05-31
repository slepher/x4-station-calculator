# 设计：Tab Bar 重构为 Sidebar

## 架构概览

### 改造前

```
BlueprintProductionWorkbenchView    LiveProductionWorkbenchView
    │                                     │
    ├── StationTabBar                     ├── SectorStationTabBar
    ├── BlueprintContextToolbar            ├── Mode-specific Toolbars
    └── Content (overview/station)        └── Content (4 modes)
    
        share useProductionTabbarPresenter
```

### 改造后

```
BlueprintProductionWorkbenchView    LiveProductionWorkbenchView
    │                                     │
    ├── LiveProductionSidebar ◄─── 共享 ──► LiveProductionSidebar
    │    (showTerraforming=false)         │    (showTerraforming=true)
    │    (showTechTree=false)             │    (showTechTree=true)
    │    (hasSectors=false)               │    (hasSectors=true)
    ├── BlueprintContextToolbar            ├── Mode-specific Toolbars
    └── Content (overview/station)        └── Content (5 modes, +tech-tree)
    
        share useProductionSidebarPresenter (refactored from tabbar presenter)
```

## 组件设计

### LiveProductionSidebar.vue（新建 · 共享组件）

```
┌──────────────────┐
│ ☰ 收起            │  ← 折叠按钮（顶部固定）
├──────────────────┤
│                   │
│  📋 概览          │  ← 固定区
│  🌍 地球化        │     (live 独有)
│  🌳 科技树        │     (live 独有)
│                   │
│  ───── 分隔 ───── │
│                   │
│  📁 星区 A  ▾     │  ← 动态区
│    🚉 Transit     │     (live 独有)
│    🏭 Station 1   │
│    🏭 Station 2   │
│  📁 星区 B  ▸     │
│                   │
│  (blueprint 模式: │
│   直接列出 station,│
│   无星区分组)      │
│                   │
└──────────────────┘
```

**Props:**
| Prop | 类型 | 说明 |
|---|---|---|
| `tabs` | `ProductionTabItem[]` | 所有 tab 项（由 presenter 提供） |
| `activeTabId` | `string \| null` | 当前选中 tab |
| `expandedSectorId` | `string \| null` | 当前展开的星区 ID |
| `hasSectors` | `boolean` | 是否有星区分组（控制动态区展示模式） |
| `showTerraforming` | `boolean` | 是否显示地球化入口 |
| `showTechTree` | `boolean` | 是否显示科技树入口 |

**Emits:**
| Emit | 参数 | 说明 |
|---|---|---|
| `selectOverview` | - | 点击概览 |
| `selectTerraforming` | - | 点击地球化 |
| `selectTechTree` | - | 点击科技树 |
| `selectStation` | `tabId: string` | 点击 station tab |
| `selectTransit` | `sectorId: string` | 点击 transit tab |
| `expandSector` | `sectorId: string` | 展开/折叠星区 |
| `renameStation` | `tabId: string, name: string` | 重命名右键操作 |
| `deleteStation` | `tabId: string` | 删除右键操作 |
| `duplicateStation` | `tabId: string` | 复制右键操作（blueprint） |
| `jumpToBinding` | `tabId: string, tabType: string` | 跳转到地图（live） |

**内部状态:**
- `collapsed: Ref<boolean>` — 折叠状态（默认 `false`）
- `menuTabId / menuTabType / menuPosition` — 右键菜单状态

**布局:**
- 展开宽度：240px（固定）
- 折叠宽度：6px（竖线 handle）
- 全高度（从 toolbar 下方到视窗底部）
- 内容溢出时内部滚动

### 折叠状态样式

**展开:**
```
┌─────────────────────────────────────────────────────────┐
│ Toolbar                                                 │
├─────────┬───────────────────────────────────────────────┤
│ Sidebar │  Content                                      │
│ (240px) │  (flex: 1)                                    │
│         │                                               │
└─────────┴───────────────────────────────────────────────┘
```

**折叠:**
```
┌─────────────────────────────────────────────────────────┐
│ Toolbar                                                 │
├──┬──────────────────────────────────────────────────────┤
│▌▌│  Content                                              │
│  │  (full width)                                         │
│  │                                                       │
└──┴──────────────────────────────────────────────────────┘
  ↑ 
  6px handle
  hover 时显示展开箭头
```

CSS 过渡：`width` transition ~200ms，内容区同时用 `flex` 自适应。

## 数据流

### Presenter 重构

`useProductionTabbarPresenter.ts` → `useProductionSidebarPresenter.ts`：

| 变更 | 说明 |
|---|---|
| 函数签名 | 接受 store，返回 props 和 emits |
| `props.tabs` | 保留现有 tab 构建逻辑（flat vs sector-grouped） |
| `props.activeTabId` | 保留 |
| 新增 `props.hasSectors` | 从 `store.capabilities.hasSectors` 派生 |
| 新增 `props.showTerraforming` | 从 `store.capabilities.hasBindings`（或等价条件）派生 |
| 新增 `props.showTechTree` | 同 `showTerraforming`（live 模式特有） |
| emits | 保留所有现有 emit 逻辑，包装为 sidebar emits |

### workbenchMode 扩展

| 文件 | 变更 |
|---|---|
| `src/types/production-workbench-contract.ts` | `workbenchMode` 联合类型新增 `'tech-tree'` |
| `src/store/useLiveProductionStore.ts` | `workbenchMode` computed 中新增 `'tech-tree'` 分支 |
| `src/store/useBlueprintProductionStore.ts` | 无需变更（仅 `overview` / `station`） |

### Live store workbenchMode 逻辑

```ts
const workbenchMode = computed(() => {
  if (isTerraformingMode.value) return 'terraforming'
  if (isTechTreeMode.value) return 'tech-tree'
  return activeTransitSectorId.value ? 'transit' : (activeStationId.value ? 'station' : 'overview')
})
```

## 视图集成

### BlueprintProductionWorkbenchView 改动

```diff
- <StationTabBar :tabs="..." :activeTabId="..." @... />
+ <LiveProductionSidebar
+   :tabs="tabbarPresenter.props.tabs.value"
+   :activeTabId="tabbarPresenter.props.activeTabId.value"
+   :hasSectors="false"
+   :showTerraforming="false"
+   :showTechTree="false"
+   @select-overview="..."
+   @select-station="..."
+   @rename-station="..."
+   @delete-station="..."
+   @duplicate-station="..."
+ />

  <BlueprintContextToolbar ... />

  <div class="content-area"> <!-- 新增包裹层 -->
    <!-- 现有内容渲染不变 -->
  </div>
```

布局从上下结构改为左右结构：
```diff
- <div class="flex flex-col">  <!-- 纵向 -->
-   <StationTabBar />
-   <BlueprintContextToolbar />
-   <div> content </div>
- </div>

+ <div class="flex">            <!-- 横向 -->
+   <LiveProductionSidebar />
+   <div class="flex-1 flex flex-col">
+     <BlueprintContextToolbar />
+     <div> content </div>
+   </div>
+ </div>
```

### LiveProductionWorkbenchView 改动

与 blueprint 同理，将 `SectorStationTabBar` 替换为 `LiveProductionSidebar`，新增左右布局包裹层。emit 处理从 tab bar 事件迁移到 sidebar 事件。

## Tech Tree 占位组件

新建 `src/components/empire/TechTreePlaceholder.vue`：

```vue
<template>
  <div class="flex items-center justify-center h-full text-slate-500">
    <div class="text-center">
      <svg>icon</svg>
      <p>{{ t('techTree.placeholder') }}</p>
    </div>
  </div>
</template>
```

在 `LiveProductionWorkbenchView.vue` 中按 `workbenchMode === 'tech-tree'` 条件渲染。

## 星区展开/折叠设计

### 状态管理

```ts
// ProductionSidebar.vue 内部状态
const collapsedSectors = ref(new Set<string>())
```

### 初始化

```ts
const collapsedSectors = ref(new Set(
  (() => {
    if (!props.hasSectors) return [] as string[]
    const allIds = groupSectors.value.map(s => s.id)
    const activeSectorId = findSectorForTabId(props.activeTabId)
    if (activeSectorId) {
      return allIds.filter(id => id !== activeSectorId)
    }
    return allIds
  })()
))
```

- 初始所有星区折叠，展开当前活跃 tab 对应的星区
- 通过 `findTabById` 匹配 `id` 或 `name`（兼容 V1 站名 ID）

### 运行时更新

```ts
watch([() => props.activeTabId, () => props.tabs.length], ([tabId]) => {
  if (!tabId || !props.hasSectors) return
  const activeSectorId = findSectorForTabId(tabId)
  if (activeSectorId) {
    const next = new Set(collapsedSectors.value)
    next.delete(activeSectorId)
    collapsedSectors.value = next
  }
})
```

- 监听 `activeTabId` 变化（选中站/transit）自动展开对应星区
- 额外监听 `tabs.length`（stores 延迟加载完成后重新评估）
- **只展开不收起**：切换总览/地球化/科技树不动 `collapsedSectors`

### 手动交互

```ts
const toggleSectorCollapse = (sectorId: string) => {
  const next = new Set(collapsedSectors.value)
  if (next.has(sectorId)) next.delete(sectorId)
  else next.add(sectorId)
  collapsedSectors.value = next
}
```

- 箭头按钮（24x24 独立点击区域）调用 `toggleSectorCollapse`
- 使用 `@click.stop` 防止冒泡触发 sector 选中

### 点击区域分离

| 元素 | 行为 |
|---|---|
| 箭头 `<button>` (24x24) | 展开/折叠 |
| 图标+名称 `<span>` | 选中 transit/station |
| 整行 | 右键上下文菜单 |

## 样式约定

- 使用 Tailwind CSS 实现 sidebar 布局
- 折叠过渡使用 `transition-all duration-200`
- 选中态：`bg-slate-800` + 左侧彩色边条指示
- 固定区 tab 和动态区 tab 用分隔线（`border-b border-slate-700`）隔开
- 星区展开箭头用 `transform rotate-90` 控制方向
- 折叠 handle 在 hover 时显示展开箭头提示
