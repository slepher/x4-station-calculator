# Cargo Volume — Design

## Architecture

```
LiveProductionStore                    BlueprintProductionStore
  │ archiveStation = non-null           │ archiveStation = null
  │ hasArchiveStation = true            │ hasArchiveStation = false
  │                                     │
  ├── allocationVolumeGroups            ├── allocationVolumeGroups
  └── allocationCargoOnlyItems          └── allocationCargoOnlyItems ([])
         │                                         │
         └── useProductionWareflowPresenter ───────┘
                        │
               StationWareFlowsDashboard
               isAllocationVolumeMode
                        │
                StationAllocationView
                        │
                StationAllocationRow
                StationCargoOnlyRow
```

## 设计原则

1. allocation volume 视图是通用的数量对比面板，不绑定特定 visualMode。
2. `hasArchiveStation` 是决定 UI 差异的唯一标记：控制进度条、组头、明细列。
3. blueprint store 的 allocation 数据完全复用现有计算链（`DerivedProductionFlow`），不新增计算路径。
4. 明细表格放弃动态 grid-template-columns 方案，改用固定列占位，消除列偏移问题。
5. 重命名一律从 `Live*` → 去掉前缀，`live*` 属性前缀 → `allocation*`。

## Store Design

### 共享 Computation Logic

将 allocation volume groups 构建逻辑抽取为共享函数（`src/store/logic/buildAllocationVolumeGroups.ts`）：

```typescript
function buildAllocationVolumeGroups(params: {
  derivedProductionFlows: DerivedProductionFlow[]
  cargoMap: Map<string, number>
  targetMap: Map<string, number>
  hasArchiveStation: boolean
  gameData: GameDataStore
}): AllocationVolumeGroup[]

function buildAllocationDetailSections(params: {
  flow: DerivedProductionFlow
  currentCount: number
  targetCount: number
  recommendedCount: number
  hasArchiveData: boolean
}): AllocationVolumeDetailSection[]

function buildAllocationCargoOnlyItems(params: {
  cargo: WareAmount[]
  targetCounts: WareAmount[]
  derivedProductionFlows: DerivedProductionFlow[]
  gameData: GameDataStore
}): AllocationCargoOnlyItem[]
```

`useLiveProductionStore` 和 `useBlueprintProductionStore` 都调用这些共享函数，仅传入参数不同。

### Blueprint Store 新增

```typescript
const allocationVolumeGroups = computed<AllocationVolumeGroup[]>(() => {
  if (workbenchMode.value !== 'station') return []
  if (wareflowViewMode.value !== 'volume') return []
  const state = stationState.value
  if (!state) return []
  return buildAllocationVolumeGroups({
    derivedProductionFlows: state.derivedProductionFlows,
    cargoMap: new Map(),
    targetMap: new Map(),
    hasArchiveStation: false,
    gameData: gameDataStore
  })
})

const allocationCargoOnlyItems = computed<AllocationCargoOnlyItem[]>(() => [])
```

### Live Store 修改

- 重命名 `liveVolumeAllocationGroups` → `allocationVolumeGroups`
- 重命名 `liveCargoOnlyItems` → `allocationCargoOnlyItems`
- 调用共享函数替代内联逻辑
- 每个 `AllocationVolumeItem` 设 `hasArchiveStation = (archive !== null)`
- detail sections 的 `includeCurrentColumn` 修正

## Detail Section Column Fix

### 当前问题

4 种 grid-template-columns 变体：
```css
.detail-head-with-current { /* 5 col */ }
.detail-head-current-only { /* 4 col */ }
.detail-head-target-only { /* 4 col */ }
.detail-head-no-current   { /* 3 col */ }
```

当"当前"或"设定"列隐藏时，grid track 数量变化，"每小时量"列（第 2 列）的像素位置随之偏移。

### 修复方案

```css
.detail-head { grid-template-columns: minmax(0, 1fr) 5.5rem 5.5rem 5.5rem 5.5rem; }
.detail-row { grid-template-columns: minmax(0, 1fr) 5.5rem 5.5rem 5.5rem 5.5rem; }
```

模板层面，隐藏列渲染空 `<span>` 占位：
```html
<span v-if="section.includeCurrentColumn" class="detail-head-col">当前</span>
<span v-else class="detail-head-col"><!-- 占位 --></span>
```

所有 4 种 grid-template-columns 变体 CSS 类删除，统一为单一固定 grid。

## Component Design

### StationAllocationView

```
props:
  groups: AllocationVolumeGroup[]
  cargoOnlyItems: AllocationCargoOnlyItem[]
  hideActions?: boolean
  hasArchiveStation?: boolean  // 新增
  isWareLocked, getResolvedLevel, isWareOperable, isPlannedWare, ...
```

组头渲染：
```
<!-- 有 archive -->
<span>Cur {{ currentTotalVolume }} m³</span>
<span>Tar {{ targetTotalVolume }} m³</span>
<span>Rec {{ recommendedTotalVolume }} m³</span>

<!-- 无 archive -->
<span>Rec {{ recommendedTotalVolume }} m³</span>
```

### StationAllocationRow

新增 `hasArchiveStation: boolean` prop。

进度条条件渲染：
```html
<div v-if="hasArchiveStation" class="bar-shell">
  ...
</div>
<div v-else class="bar-spacer">
  <!-- 空白占位，保持 grid 对齐 -->
</div>
```

### StationCargoOnlyRow

无行为变更。当没有 archiveStation 时 `allocationCargoOnlyItems` 为空，该组件不渲染。

## Type Changes

```typescript
// AllocationVolumeGroup
interface AllocationVolumeGroup {
  key: 'container' | 'solid' | 'liquid'
  items: AllocationVolumeItem[]
  currentTotalVolume: number
  targetTotalVolume: number
  recommendedTotalVolume: number
  hasArchiveStation: boolean  // 新增
}

// AllocationVolumeItem
interface AllocationVolumeItem {
  wareId: string
  name: string
  transportType: 'container' | 'solid' | 'liquid'
  orderIndex: number
  tier: number
  currentCount: number
  targetCount: number
  recommendedCount: number
  scaleMaxCount: number
  hasArchiveStation: boolean  // 新增
  detailSections: AllocationVolumeDetailSection[]
}

// AllocationCargoOnlyItem (renamed from LiveCargoOnlyItem)
interface AllocationCargoOnlyItem {
  wareId: string
  name: string
  tier: number
  currentCount: number
  targetCount: number
}
```

## File Changes

| File | Change |
|---|---|
| `src/types/production-workbench-contract.ts` | 重命名 5 个类型 + 新增 `hasArchiveStation` |
| `src/store/logic/buildAllocationVolumeGroups.ts` | **新增** 共享 allocation 构建逻辑 |
| `src/store/useLiveProductionStore.ts` | 重命名 + 调用共享函数 + 修复 `includeCurrentColumn` |
| `src/store/useBlueprintProductionStore.ts` | 新增 `allocationVolumeGroups` / `allocationCargoOnlyItems` |
| `src/components/empire/presenters/useProductionWareflowPresenter.ts` | 接口/p props 字段重命名 |
| `src/components/empire/StationWareFlowsDashboard.vue` | props/computed 重命名 + import 路径更新 |
| `src/components/empire/LiveStationAllocationView.vue` | → `StationAllocationView.vue` |
| `src/components/empire/LiveStationAllocationRow.vue` | → `StationAllocationRow.vue` |
| `src/components/empire/LiveStationCargoOnlyRow.vue` | → `StationCargoOnlyRow.vue` |
| 所有引用 `Live*` 类型/组件的文件 | import 路径 + 引用名更新 |
