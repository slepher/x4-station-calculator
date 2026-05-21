# Live Cargo Volume Enhanced - 设计文档

## 架构概览

本次变更在 `live-cargo-volume` 基础上扩展 `LiveStationAllocationView` 的覆盖范围，不引入新的 presenter/view-model 层，继续遵循 `store -> presenter -> vue`。

```
store: useLiveProductionStore
  ├─ useAllocationVolumeView      (放宽条件)
  ├─ liveVolumeAllocationGroups   (station + transit 共用)
  └─ liveCargoOnlyItems           (无 archive → [])
       │
       └─→ useProductionWareflowPresenter (透传，合约不变)
             │
             ├─→ StationWareFlowsDashboard
             │     └─→ LiveStationAllocationView (hideActions: false)
             │
             └─→ TransitHubCenterDashboard (新增)
                   └─→ LiveStationAllocationView (hideActions: true)
```

## 设计原则

1. 不新增 presenter 层：继续使用 `liveVolumeAllocationGroups` / `liveCargoOnlyItems` 合约。
2. 数据降级在 store 完成：`hasArchiveData` 标记决定 currentCount / targetCount / detailSections 的值。
3. transit-hub 复用同一份 allocation view 组件，通过 `hideActions` 控制操作按钮。
4. planning mode 不受影响：transit-hub planning + volume 继续走旧 `TransitHubStorageView`。

## Store Design

### useAllocationVolumeView

```ts
const useAllocationVolumeView = computed(() => {
  return workbenchMode.value === 'station' || workbenchMode.value === 'transit'
})
```

放弃原有的 `archiveStation !== null` 条件检查。

### liveVolumeAllocationGroups

station 与 transit 共用同一套逻辑：

```ts
const hasArchive = archiveStation.value !== null
const currentCount = cargoMap.get(wareId) || 0
const targetCount = hasArchive
  ? (targetMap.get(wareId) || 0)
  : recommendedCount
const detailSections = buildAllocationDetailSections(
  flow, currentCount, targetCount, recommendedCount, hasArchive
)
```

transit 模式下 `derivedProductionFlows` 来自 `activeTransitState`（已就绪）。

### liveCargoOnlyItems

```ts
const liveCargoOnlyItems = computed(() => {
  if (!archiveStation.value) return []
  // ... 原有 cargo-only 判定逻辑
})
```

### buildAllocationDetailSections

新增 `hasArchiveData: boolean` 参数。

`hasArchiveData === false` 时：

- Fill From Current 整段不产出
- 所有 section 中 `includeTargetColumn = false`
- 所有行的 `targetMinutes` 设为 `undefined`

新增 **Station Breakdown** section：

- 仅在 `contributions` 包含 `class === 'station'` 的条目时产出
- 生产站（`type === 'production'`）：rate / target fill / recommended fill（从空库存）
- 消费站（`type === 'consumption'`）：rate / current drain / target drain / recommended drain
- `includeCurrentColumn = true`（消费站需要），生产站行的 `currentMinutes = undefined`
- 默认折叠（与 Downstream 同机制）
- 与其他 section 一致：有 archive 时 `includeTargetColumn = true`，无 archive 时 `includeTargetColumn = false`

### buildAllocationDetailSection

新增 `includeTargetColumn: boolean` 参数，写入 `LiveVolumeAllocationDetailSection`。

## Type Design

### LiveVolumeAllocationDetailSection

```ts
export interface LiveVolumeAllocationDetailSection {
  key: string
  title: string
  includeCurrentColumn: boolean
  includeTargetColumn: boolean   // 新增
  rows: LiveVolumeAllocationDetailRow[]
}
```

## Vue Design

### LiveStationAllocationRow

新增 props：

```ts
hideActions?: boolean             // 默认 false
```

- `v-if="!hideActions"` 包裹 `flow-action-rail`
- 使用 `section.includeTargetColumn` 条件渲染 target 列头和单元格
- CSS grid 按 `includeCurrentColumn × includeTargetColumn` 四种组合计算 class

### LiveStationAllocationView

新增 props：

```ts
hideActions?: boolean             // 默认 false
```

- 透传给每一行 `LiveStationAllocationRow`
- 组头 spacer（`group-header-spacer`）按 `hideActions` 条件渲染
- cargo-only row 的 spacer 同样

### TransitHubCenterDashboard

新增 props：

```ts
useAllocationVolumeView?: boolean
liveVolumeAllocationGroups?: LiveVolumeAllocationGroup[]
liveCargoOnlyItems?: LiveCargoOnlyItem[]
```

`live + volume` 分支：

```html
<LiveStationAllocationView
  v-if="useAllocationVolumeView && viewMode === 'volume'"
  :groups="liveVolumeAllocationGroups"
  :cargoOnlyItems="liveCargoOnlyItems"
  :hideActions="true"
/>
<TransitHubStorageView
  v-else-if="viewMode === 'volume'"
  ...
/>
```

### 父组件透传

呼起 `TransitHubCenterDashboard` 的视图（`LiveProductionWorkbenchView.vue`），从 presenter 取 `liveVolumeAllocationGroups` / `liveCargoOnlyItems` / `useAllocationVolumeView` 并透传。

## 不采用的方案

### 1. 为 transit-hub 新建独立 allocation 组件

不采用。原因：
- 与 station 的展示结构完全一致，差异仅在 `hideActions` 一个 flag
- 新建组件会导致 progress bar、detail 展开逻辑的双维护

### 2. station 无 archive 时降级回旧 volume 视图

不采用。原因：
- 无 archive 时 progress bar `0 / recommendedCount` 仍有信息价值（告知推荐分配量）
- 展开时间明细（Fill From Empty / Drain / Downstream）即使在无 archive 时仍然可计算

### 3. presenter 新增 transit-specific 字段

不采用。原因：
- `liveVolumeAllocationGroups` 合约已满足两种数据模式
- 无 archive 的降级是 store 行为，presenter 只透传结果
