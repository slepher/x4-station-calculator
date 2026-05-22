# building-material-progress 设计文档

## 架构概览

本 change 不新增独立组件，而是在现有 `StationDashboard` 内部新增模板区块和计算逻辑，通过 `store -> presenter -> vue` 三层链路提供建筑物资进度数据。

```
Presenter                                    StationDashboard
─────────                                    ────────────────
buildingScopeModules  ──────── NEW ───────► buildingScopeModules prop
buildingCargo         ──── existing ──────► buildingCargo prop
buildingReservation   ──── existing ──────► buildingReservation prop
                                                  │
                                                  ▼
                                           buildingProgressItems (NEW computed)
                                           每 ware: required, cargo, reservation
                                                  │
                                                  ▼
                                           BuildingProgressPanel (NEW template)
                                           堆叠进度条，所有 view 固定显示
```

## 核心决策

### 1. 在 StationDashboard 内部计算而非 presenter

`buildingProgressItems` 在 `StationDashboard.vue` 内部通过 `analyzeStation(buildingScopeModules)` 计算，而不是在 presenter 层。

原因：
- `analyzeStation()` 是 dashboard 侧的纯计算函数，依赖 `gameDataStore.waresMap/modulesMap`、`buildPriceMultiplier`、`useHQ` 等已传入 dashboard 的数据
- presenter 只负责从 store 组装业务状态的传递形态（如 `builtScopeModules`/`buildingScopeModules`），不做具体的建材分析
- 将分析计算放在 vue 层保持 presenter 职责单一

### 2. 复用 StationAllocationRow 的进度条 CSS 风格

进度条复用 `StationAllocationRow.vue` 的 `bar-shell`/`bar-text` 样式模式：
- `bar-shell`：相对定位容器，深色背景，圆角，overflow hidden
- 填充段：绝对定位，从 0 或 cargoWidth 处开始
- `bar-text`：绝对定位全覆盖，flex 居中，数字显示

### 3. 面板在所有 view 中固定显示

当前建筑仓库/在途/缺口条目仅显示在 `materials`/`volume` view（`StationDashboard.vue:539`）。新面板不受此限制，渲染在 stats-bar 和 dashboard-content 之间，始终可见。

### 4. 复用 buildingScopeModules 的双模式差异

presenter 中的 `buildingScopeModules` 已处理 live/planning 双模式口径差异：
- live：`buildingModules - buildingInProgress`
- planning + archive：`effectiveTargetModules - archiveBuiltModules - buildingInProgress`

`StationDashboard` 直接使用传入的 `buildingScopeModules`，无需感知当前模式。

## 数据流

### 输入

```
LiveProductionWorkbenchView
  ├─ dashboardPresenter.props.buildingScopeModules.value  ← NEW
  ├─ dashboardPresenter.props.buildingCargo.value
  └─ dashboardPresenter.props.buildingReservation.value
           │
           ▼
StationDashboard props
  ├─ buildingScopeModules: SavedModule[]
  ├─ buildingCargo: WareAmount[]
  └─ buildingReservation: WareAmount[]
```

### 计算：buildingProgressItems

```
buildingScopeModules
      │
      ▼ analyzeStation(modules, modulesMap, waresMap, priceMultiplier, useHQ)
      │
buildingAnalysis.summaryItems[]       <- per-ware required
      │
      ├─ JOIN with buildingCargo[]     <- per-ware cargo
      └─ JOIN with buildingReservation[] <- per-ware reservation
      │
      ▼ filter: required>0 || cargo>0 || reservation>0
      │
buildingProgressItems[]
  { id, displayName, required, cargo, reservation, hasReservation }
```

### 进度条宽度计算

```ts
scale = required > 0 ? required : (cargo + reservation)
cargoWidth = min(cargo / scale * 100, 100)
transitWidth = min(reservation / scale * 100, 100 - cargoWidth)
```

### 模板渲染

```html
<div class="building-progress-panel">
  <div v-for="item in buildingProgressItems" class="progress-row">
    <span class="ware-name">{{ item.displayName }}</span>
    <div class="bar-shell">
      <div class="bar-fill-cargo" :style="{ width: cargoWidth + '%' }" />
      <div class="bar-fill-transit" :style="{ left: cargoWidth + '%', width: transitWidth + '%' }" />
      <div class="bar-text">
        {{ item.hasReservation ? `${cargo}+${reservation} / ${required}` : `${cargo}` }}
      </div>
    </div>
  </div>
</div>
```

## 分层落点

### Presenter

无修改。`buildingScopeModules`、`buildingCargo`、`buildingReservation` 已存在于 `DashboardPresenterProps` 中。

### Vue（StationDashboard）

- 新增 prop：`buildingScopeModules?: SavedModule[]`
- 新增 computed：`buildingProgressItems`
- 新增模板区块：`<div class="building-progress-panel">`
- 新增样式：进度行、bar-shell 适配、颜色定义

### Vue（LiveProductionWorkbenchView）

- station 模式下新增 `:building-scope-modules="dashboardPresenter.props.buildingScopeModules.value"` prop 绑定

## 与现有建筑材料条目的关系

本 change 在进度条面板之外**不修改**现有 `StationModuleDetail` 建筑仓库/在途/缺口三条目：

- 建筑仓库材料（`StationModuleDetail variant="summary"`）→ 保留
- 在途材料 → 保留
- 材料缺口 → 保留

这些条目继续仅在 `materials`/`volume` view 中显示，与新的进度条面板并行存在。后续 change 可考虑合并或替换。

## 非目标

本 change 不重新定义：
- `analyzeStation()` 函数逻辑
- `useProductionDashboardPresenter` 的 scope 计算逻辑
- `buildingCargo` / `buildingReservation` 的数据来源
- 现有 `StationModuleDetail` summary 条目行为
