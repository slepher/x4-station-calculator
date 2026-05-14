# Station Dashboard Building Modules - Design

## Architecture

### 层级变更总览

```
Store (useLiveProductionStore)
  ├─ moduleScope: Ref<'built'|'building'|'all'>  ← 已实现
  ├─ hasBuildingModules                           ← 已实现
  └─ archiveStation.building.cargo/reservation    ← 数据源（已存在，需透传）
       │
       ├─→ useProductionToolbarPresenter          ← 已实现
       │     └─→ LiveStationToolbar.vue           ← 已实现
       │
       └─→ useProductionDashboardPresenter
             ├─ effectiveModules                   ← 已实现
             ├─ buildingCargo: WareAmount[]        ← 新增
             └─ buildingReservation: WareAmount[]  ← 新增
                  └─→ LiveProductionWorkbenchView.vue
                        └─→ StationDashboard.vue
                              ├─ costAnalysis / workersAnalysis  ← 已实现
                              └─ 成本视图三条目                    ← 新增
                                   ├─ 建筑仓库材料 (buildingCargo)
                                   ├─ 在途材料 (buildingReservation)
                                   └─ 材料缺口 (building 态专属)
```

### 数据流：buildingCargo / buildingReservation

```
BuildStorageEntry (save parser)
  .cargo: WareAmount[]     → archiveStation.building.cargo
  .reservation: WareAmount[] → archiveStation.building.reservation
                              ↓ (当前断裂点)
ProductionStationState (新增)
  .buildingCargo: WareAmount[]
  .buildingReservation: WareAmount[]
                              ↓
DashboardPresenter (新增)
  .buildingCargo: ComputedRef<WareAmount[]>
  .buildingReservation: ComputedRef<WareAmount[]>
                              ↓
LiveProductionWorkbenchView (新增)
  :building-cargo / :building-reservation
                              ↓
StationDashboard (新增)
  props.buildingCargo?: WareAmount[]
  props.buildingReservation?: WareAmount[]
```

### Store 层（已实现 + 新增透传）

**已实现**：`moduleScope`, `hasBuildingModules`, `cycleModuleScope`, `defaultModuleScope`, watch 逻辑

**新增**：`activeStationState` live 模式下透传 `buildingCargo` 和 `buildingReservation`

```typescript
// activeStationState (live 模式)
buildingCargo: archiveStation.value?.building?.cargo || [],
buildingReservation: archiveStation.value?.building?.reservation || [],
```

### ProductionStationState 新增

**文件**: `src/types/production-workbench-contract.ts`

```typescript
export interface ProductionStationState {
  // ...existing fields...
  buildingCargo: WareAmount[]          // 新增
  buildingReservation: WareAmount[]    // 新增
}
```

### Dashboard Presenter 层（已实现 + 新增）

**新增** `DashboardPresenterProps`：

```typescript
buildingCargo: ComputedRef<WareAmount[]>
buildingReservation: ComputedRef<WareAmount[]>
```

**新增** `DashboardPresenterStore`：

```typescript
buildingCargo?: WareAmount[]
buildingReservation?: WareAmount[]
```

**新增** computed 填充：

```typescript
buildingCargo: computed(() => store.buildingCargo || []),
buildingReservation: computed(() => store.buildingReservation || []),
```

### LiveProductionWorkbenchView.vue（已实现 + 新增）

StationDashboard station view 调用处新增 props：

```html
:building-cargo="dashboardPresenter.props.buildingCargo.value"
:building-reservation="dashboardPresenter.props.buildingReservation.value"
```

### StationDashboard.vue（已实现 + 新增）

**新增** Props：

```typescript
buildingCargo?: WareAmount[]
buildingReservation?: WareAmount[]
```

**成本视图新增三条目**（在 `data` computed 的 `materials` 分支中，或在模板中独立渲染）：

方案选择：在模板中独立渲染（而非混入 `data`），因为三条目是补充信息而非 costAnalysis 的一部分。

```html
<!-- 成本视图补充条目 -->
<template v-if="viewMode === 'materials'">
  <StationModuleDetail
    v-if="buildingCargoItems.length > 0"
    variant="summary"
    :title="t('station.build_storage_materials')"
    :value="buildingCargoTotal"
    :items="buildingCargoItems"
    unit="Cr"
  />
  <StationModuleDetail
    v-if="buildingReservationItems.length > 0"
    variant="summary"
    :title="t('station.in_transit_materials')"
    :value="buildingReservationTotal"
    :items="buildingReservationItems"
    unit="Cr"
  />
  <StationModuleDetail
    v-if="showMaterialGap && materialGapItems.length > 0"
    variant="summary"
    :title="t('station.material_gap')"
    :value="materialGapTotal"
    :items="materialGapItems"
    unit="Cr"
  />
</template>
```

**计算属性**：

```typescript
const showMaterialGap = computed(() => {
  return props.effectiveModules !== undefined
    && props.effectiveModules !== props.modules
})

const buildingCargoItems = computed(() => {
  if (!props.buildingCargo?.length) return []
  return props.buildingCargo.map(c => {
    const ware = gameDataStore.waresMap[c.ware]
    const price = ware ? getPriceByMultiplier(ware, buildPriceMultiplier.value) : 0
    const volume = (ware?.volume || 0) * c.amount
    return { id: c.ware, count: c.amount, price: c.amount * price, volume }
  })
})

const buildingReservationItems = computed(() => {
  if (!props.buildingReservation?.length) return []
  return props.buildingReservation.map(r => {
    const ware = gameDataStore.waresMap[r.ware]
    const price = ware ? getPriceByMultiplier(ware, buildPriceMultiplier.value) : 0
    const volume = (ware?.volume || 0) * r.amount
    return { id: r.ware, count: r.amount, price: r.amount * price, volume }
  })
})

const materialGapItems = computed(() => {
  if (!showMaterialGap.value) return []
  const cargoMap = Object.fromEntries((props.buildingCargo || []).map(c => [c.ware, c.amount]))
  const reservationMap = Object.fromEntries((props.buildingReservation || []).map(r => [r.ware, r.amount]))
  return costAnalysis.value.summaryItems
    .map(item => {
      const cargo = cargoMap[item.id] || 0
      const reservation = reservationMap[item.id] || 0
      const gap = item.count - cargo - reservation
      if (gap <= 0) return null
      const ware = gameDataStore.waresMap[item.id]
      const price = ware ? getPriceByMultiplier(ware, buildPriceMultiplier.value) : 0
      return { id: item.id, count: gap, price: gap * price, volume: gap * (ware?.volume || 0) }
    })
    .filter(Boolean)
})
```

`showMaterialGap` 的判断逻辑：`effectiveModules` 被传入且与 `modules` 不同时，说明处于 building 或 all 态。但需求明确材料缺口仅 building 态显示，所以需要更精确判断。通过 presenter 传入 `moduleScope` 值或使用一个单独的 boolean prop `isBuildingScope`：

**决策**：给 StationDashboard 新增可选 prop `isBuildingScope?: boolean`，由 presenter 根据 `moduleScope === 'building'` 计算。这样 StationDashboard 不需要知道 moduleScope 的完整语义。

```typescript
// DashboardPresenter 新增
isBuildingScope: ComputedRef<boolean>
// computed
isBuildingScope: computed(() => store.moduleScope === 'building')
```

```html
<!-- LiveProductionWorkbenchView -->
:is-building-scope="dashboardPresenter.props.isBuildingScope.value"
```

```typescript
// StationDashboard
const showMaterialGap = computed(() => props.isBuildingScope === true)
```

### i18n（已实现 + 新增）

**已实现**：`toolbar.module_scope`, `toolbar.module_scope_built`, `toolbar.module_scope_building`, `toolbar.module_scope_all`

**新增**：

zh-CN.json：
```json
"station.build_storage_materials": "建筑仓库材料",
"station.in_transit_materials": "在途材料",
"station.material_gap": "材料缺口"
```

en.json：
```json
"station.build_storage_materials": "Build Storage Materials",
"station.in_transit_materials": "In-Transit Materials",
"station.material_gap": "Material Gap"
```

## Decisions

1. **双分析而非单分析 + 后过滤**：`analyzeStation` 对模块列表做聚合，后过滤无法正确拆分已合并的 summaryItems。双分析虽多一次计算，但模块列表通常 <50，开销可忽略。
2. **`effectiveModules` 为可选 prop**：不破坏现有调用方（transit view、overview、blueprint 仍传 `modules` 即可）。
3. **Store 持有 moduleScope**：toolbar 和 dashboard 都需要此状态，放在 store 是最自然的共享点。
4. **三态循环而非下拉选择**：与现有 toggle-chip 交互模式一致（workforce ON/OFF 也是单击切换），三态循环更轻量。
5. **有 buildingModules 时默认 building**：用户进入实时模式最关心的通常是建设进度，默认 building 更符合使用场景。
6. **三条目在模板中独立渲染**：不混入 `data` computed，因为三条目是补充信息，来源不同于 costAnalysis，独立渲染更清晰。
7. **`isBuildingScope` prop 而非传完整 moduleScope**：StationDashboard 不需要了解 moduleScope 的完整语义，一个 boolean 足够，减少耦合。
8. **buildingCargo/buildingReservation 为可选 prop**：非 live 模式下不传，保持现有调用方不受影响。
