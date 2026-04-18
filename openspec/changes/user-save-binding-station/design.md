# user-save-binding-station Design

## D1: Production source 路由架构

`useEmpireStore` 持有 `productionSource` ref，控制数据源切换：

```ts
productionSource: 'empire' | 'save-binding'
```

**核心属性路由**：

- `sectors`：empire 模式返回 `activeEmpire.sectors`，binding 模式返回 `binding.groups`（映射为 SectorLike）
- `orderedStationsBySector`：binding 模式使用 `deriveBindingStations` 派生空间站列表
- `activeStationId`：computed 双向绑定，binding 模式路由到 `saveBindingStore.activeStationId`
- `activeStation`：binding 模式从派生列表查找

**切换方法**：

```ts
switchToBinding(gameGuid): { needsConfirm: boolean }
confirmSwitchToBinding(gameGuid): void
switchToEmpire(): void
```

## D2: 派生空间站名称与星区归属

空间站名称：
- 若 covered save station 有对应 `BindingStationPlan`，使用 `plan.name`
- 若无 plan，使用 save station 的 `code`

空间站所属星区 (`sectorId`)：
- 若 covered save station 有对应 `BindingStationPlan`，使用 `plan.groupId`
- 若无 plan，通过 save station 的 `sectorMacro` 找到 `coverageSectorMacros` 包含该 `sectorMacro` 的 group，使用该 `group.id`
- virtual station（无 `saveStationCode`）使用 `plan.groupId`

此逻辑在 `deriveBindingStations` 中实现，确保 `station.sectorId` 正确指向所属 binding group。

## D3: 空间站编辑路由

`useStationStore` 通过 `useEmpireStore` 获取当前数据源，执行编辑操作：

```ts
function updateModules(stationId: string, modules: SavedModule[]) {
  if (empireStore.productionSource === 'save-binding') {
    const binding = saveBindingStore.activeBinding
    if (binding) {
      saveBindingStore.updateStationPlan(binding.gameGuid, stationId, { modules })
    }
  } else {
    // empire 模式：直接更新 empire station
    empireStore.updateStationModules(stationId, modules)
  }
}
```

**关键点**：
- binding 模式编辑不自动保存，只更新 draft
- empire 模式编辑立即持久化

## D4: Dirty 状态合并

`useEmpireStore.isDirty` 需合并两种 dirty：

```ts
const isDirty = computed(() => {
  if (productionSource.value === 'save-binding') {
    return saveBindingStore.isDirty
  }
  return empireIsDirty.value
})
```

保存操作：
- `saveEmpire()` 只保存 empire 数据
- binding 模式下需调用 `saveBindingStore.saveBinding()`

## D5: UI 组件适配

### StationPlanningPanel

- 添加"保存绑定"按钮（仅在 binding 模式显示）
- 显示 binding dirty 状态指示器
- 编辑操作触发 draft 更新

### StationTabBar

- binding 模式下 `sectors` 显示 binding groups
- 创建空间站按钮创建虚拟空间站
- 右键菜单适配 binding 操作

### StationDashboard

- 显示正确的 dirty 状态（合并 empire + binding）
- 保存按钮根据 source 调用正确方法

### ProductionWorkbenchView

- 总览界面直接使用 `empireStore.empireGroupedFlows`，数据自动根据 `productionSource` 分发
- binding 模式禁用 empire 专属功能（如星区链接）

## D7: 数据源自动分发

`empireGroupedFlows` computed 根据 `productionSource` 自动选择数据源：

```ts
const empireGroupedFlows = computed(() => {
  if (productionSource.value === 'save-binding') {
    const binding = saveBindingStore.activeBinding
    return buildSaveBindingProductionFlows(binding, deps).groupedFlows
  }
  return analyzeEmpireWareFlow(activeEmpire.stations, ...)
})
```

**核心原则**：
- 组件只访问 `empireStore.empireGroupedFlows`
- 数据源切换逻辑集中在 store 内
- 无需组件层手动判断 `productionSource`

## D8: 空间站创建流程

### 创建虚拟空间站

```ts
function createStation(name: string, type: StationType) {
  if (productionSource.value === 'save-binding') {
    const binding = saveBindingStore.activeBinding
    if (!binding) return null
    const plan = saveBindingStore.createStationPlanInGroup(
      binding.gameGuid,
      null, // groupId 可通过 UI 选择
      name,
      type
    )
    return plan
  }
  // empire 模式...
}
```

### 从蓝图导入

用户选择 blueprint empire station，导入 modules 到目标 `BindingStationPlan`：

```ts
function importBlueprintModules(
  targetPlanId: string,
  blueprintStation: StationPlan
) {
  const binding = saveBindingStore.activeBinding
  if (!binding) return
  saveBindingStore.updateStationPlan(binding.gameGuid, targetPlanId, {
    modules: blueprintStation.modules,
    settings: blueprintStation.settings
  })
}
```

## D8: 数据层分离

`useEmpireDataStore` 负责纯数据持久化，`useEmpireStore` 调用其方法处理 localStorage。

此分离为后续支持多数据源切换奠定基础，确保：
- empire 数据使用 `x4_empire_data`
- binding 数据使用 `x4_save_bindings`
- 两套数据独立管理，互不干扰

## D9: Auto Modules 分三组显示（UI层）

### 背景

原 `StationPlanningPanel` 将所有 auto 模块显示在一个"自动模块"区域，用户无法区分模块类型。

### UI 改动

分三组显示：

```
StationPlanningPanel
  ├── 用户规划区（用户手动添加的模块）
  │
  ├── 自动工业区（tier-auto-industry 样式）
  │     └── production 类型自动模块
  │
  ├── 自动居住区（tier-auto-habitation 样式）
  │     └── habitation 类型自动模块
  │
  └── 自动基础设施（tier-auto-infrastructure 样式）
        └── storage/dock 类型自动模块
```

### 分组逻辑

**数据来源**：`StationProductionFlowMap.getCache(stationId)` 返回：
- `autoIndustryModules` - production 类型（生产模块）
- `autoHabitationModules` - habitation 类型（居住模块）
- `autoInfrastructureModules` - storage/dock 类型（仓储/泊位）

**UI 组件**：
- `StationPlanningPanel.vue` 接收三个 props
- 各组独立展开/折叠
- 使用不同边框颜色区分：
  - industry: amber（生产）
  - habitation: emerald（居住）
  - infrastructure: slate（基础设施）

### 样式类

```css
.tier-auto-industry {
  @apply border-l-2 border-amber-500/40 pl-2;
}
.tier-auto-habitation {
  @apply border-l-2 border-emerald-500/40 pl-2;
}
.tier-auto-infrastructure {
  @apply border-l-2 border-slate-500/40 pl-2;
}
```

## D10: Station Tab 图标与文本显示逻辑

### 类型定义变更

`ProductionTabItem` 移除 `icon` 字段，新增 `tag` 字段：

```typescript
interface ProductionTabItem {
  id: string
  type: 'overview' | 'station' | 'transit'
  name: string
  sectorId?: string
  tag?: string  // POI 类型标识，供 tab 组件决定图标显示
}
```

### Store 层：getTabs 函数简化

`useLiveProductionStore.getTabs()` 只计算 `tag`，不计算 icon URL：

```typescript
function getTabs(): ProductionTabItem[] {
  return [
    { id: 'overview', type: 'overview', name: '星区总览', tag: 'playerhq' },
    { id: `transit-${sectorId}`, type: 'transit', name: sectorName, sectorId, tag: 'tradestation' },
    ...stations.map(s => {
      const matchingPlan = findMatchingPlan(s)
      return {
        id: s.id,
        type: 'station',
        name: matchingPlan?.name || s.name || s.id,
        sectorId: s.sectorId,
        tag: matchingPlan
          ? classifyPlayerStationPoi(matchingPlan.modules)
          : s.poiLike?.tag || 'constructionsite'
      }
    })
  ]
}
```

### Tab 组件：图标显示与染色

`SectorStationTabBar.vue` 根据 `tag` 获取图标 URL 并应用染色：

```typescript
import { SAVE_POI_ICON_MAP } from '@/components/map/utils/style'

function getTabIcon(tab: ProductionTabItem): string | null {
  if (tab.type === 'overview') {
    return SAVE_POI_ICON_MAP['playerhq']
  }
  if (tab.type === 'transit') {
    return SAVE_POI_ICON_MAP['tradestation']
  }
  if (tab.type === 'station' && tab.tag) {
    return SAVE_POI_ICON_MAP[tab.tag] || null
  }
  return null
}

function getTabIconClass(tab: ProductionTabItem): string {
  if (tab.type === 'overview') return 'icon-green'
  if (tab.type === 'transit') return 'icon-orange'
  return ''
}
```

### CSS 滤镜染色

使用 CSS filter 实现 SVG 图标染色：

```css
.icon-green {
  filter: hue-rotate(84deg) saturate(1.5);
}
.icon-orange {
  filter: hue-rotate(7deg) saturate(1.2);
}
```

### SAVE_POI_ICON_MAP 导出

`src/components/map/utils/style.ts` 导出图标映射：

```typescript
export const SAVE_POI_ICON_MAP: Record<string, string> = {
  playerhq: '/images/poi/playerhq.svg',
  tradestation: '/images/poi/tradestation.svg',
  constructionsite: '/images/poi/constructionsite.svg',
  factory: '/images/poi/factory.svg',
  wharehouse: '/images/poi/wharehouse.svg',
  dock: '/images/poi/dock.svg',
  // ... 其他 POI 类型
}
```

### tag 计算函数

`classifyPlayerStationPoi(modules)` 统一处理 tag 分类：

```typescript
function classifyPlayerStationPoi(modules: SavedModule[]): string {
  if (!modules || modules.length === 0) {
    return 'constructionsite'
  }
  // 根据 modules 的产品类型判定
  // factory / wharehouse / dock 等
  return computePoiTagFromModules(modules)
}
```

**关键点**：
- modules=[] 优先返回 'constructionsite'
- Store 层不关心 icon URL，只传递语义化的 tag
- Tab 组件负责视觉呈现（图标选择、染色）
```