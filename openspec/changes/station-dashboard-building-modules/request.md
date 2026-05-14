# Station Dashboard Building Modules

## 目标

在实况产能（Live Production）空间站视图的 ContextToolbar 上，为实时模式添加「建造视图」三态切换按钮，使 StationDashboard 的成本/时间/运输视图可根据不同模块集计算，而工人视图始终使用已建设模块。同时在成本视图中增加建筑仓库材料、在途材料、材料缺口三个条目，帮助用户了解建设进度。

## 已确认方案（审核重点）

### 入口与交互

1. **按钮位置**：`LiveStationToolbar` 中「单次停泊吞吐量」右侧，前置分隔线。
2. **显示条件**：`mode === 'live' && buildingModules.length > 0`。按钮隐藏时分隔线也隐藏。
3. **按钮样式**：单按钮循环三态，风格同现有 `toggle-chip`（如 workforce toggle），group-label 为「建造视图」。
4. **三态循环**：`built → building → all → built`
5. **三态样式**：
   - `built`（已建设）→ `active-green`（emerald），图标 🏗️
   - `building`（建设中）→ `active-amber`（amber），图标 🚧
   - `all`（所有模块）→ `active-sky`（sky），图标 📦

### 影响范围

6. **仅影响 StationDashboard 的成本视图、时间视图、运输视图**。
7. **工人视图始终使用 `modules`（已建设）计算**，不受切换影响。
8. 三态对应 modules 来源：
   - `built` → `stationState.modules`
   - `building` → `stationState.buildingModules`
   - `all` → `[...stationState.modules, ...stationState.buildingModules]`

### 不影响

9. Transit view / Overview view 的 StationDashboard 不受影响。
10. BlueprintProductionWorkbenchView 不受影响。
11. Planning mode 下按钮不显示，行为不变。

### 状态管理

12. Store 层：`useLiveProductionStore` 新增 `moduleScope: Ref<'built' | 'building' | 'all'>`。
13. 有 buildingModules 时默认为 `'building'`，无则为 `'built'`。
14. 切换空间站或 mode 时 reset 为默认值。
15. `hasBuildingModules` 变化时：从无到有且当前为 `built` → 切换到 `building`；从有到无且当前非 `built` → 切换到 `built`。

### StationDashboard 变更

16. 新增可选 prop `effectiveModules?: SavedModule[]`。
17. 内部双分析：
    - `costAnalysis` = `analyzeStation(effectiveModules ?? modules, ...)` → 供成本/时间/运输视图 + stats-bar 中成本/体积/时间/运输
    - `workersAnalysis` = `analyzeStation(modules, ...)` → 供工人视图 + stats-bar 中工人/效率

### 成本视图新增条目

18. **数据源**：`archiveStation.building.cargo: WareAmount[]`（建材仓库中已到达的材料）和 `archiveStation.building.reservation: WareAmount[]`（已预留/在途的材料）。`ware` 字段与 `AnalysisItem.id` 使用同一 ware ID 命名空间，可直接匹配。
19. **数据透传**：`ProductionStationState` 新增 `buildingCargo: WareAmount[]` 和 `buildingReservation: WareAmount[]`，live 模式下从 `archiveStation.building.cargo/reservation` 透传。
20. **建筑仓库材料**：使用 `StationModuleDetail variant="summary"` 展示，数据来自 `buildingCargo`。仅在 `buildingCargo` 非空时显示。
21. **在途材料**：同上，数据来自 `buildingReservation`。仅在 `buildingReservation` 非空时显示。
22. **材料缺口**：仅 `moduleScope === 'building'` 时计算和显示。对每个 ware：`缺口 = costAnalysis.summaryItems 中该 ware 的 count - cargo[ware] - reservation[ware]`。仅显示缺口 > 0 的 ware。
23. 三条目仅在成本视图（`materials`）下显示，时间/运输/工人视图不显示。

## 边界

### In Scope

- LiveStationToolbar 新增建造视图按钮
- Store 新增 moduleScope 状态
- Toolbar Presenter / Dashboard Presenter 透传 moduleScope
- StationDashboard 支持 effectiveModules 双分析
- ProductionStationState 新增 buildingCargo / buildingReservation
- Dashboard Presenter 透传 buildingCargo / buildingReservation
- StationDashboard 成本视图新增三个条目
- i18n keys（zh-CN / en）

### Out of Scope

- Transit / Overview / Blueprint 视图变更
- `analyzeStation()` 函数修改
- 测试编写与执行

## 验收标准（DoD）

1. 实时模式下，archive 空间站有 buildingModules 时，toolbar 显示「建造视图」按钮及前置分隔线；无 buildingModules 时不显示按钮和分隔线。
2. 规划模式下，按钮不显示。
3. 点击按钮循环三态：已建设→建设中→所有→已建设，按钮样式和图标随状态变化。
4. 有 buildingModules 时默认为 `building` 态，无则为 `built` 态。
5. `built` 态：Dashboard 成本/时间/运输视图使用 modules 计算；工人视图使用 modules 计算。
6. `building` 态：Dashboard 成本/时间/运输视图使用 buildingModules 计算；工人视图仍使用 modules 计算。
7. `all` 态：Dashboard 成本/时间/运输视图使用 modules+buildingModules 计算；工人视图仍使用 modules 计算。
8. 切换空间站或 mode 切换时，moduleScope 重置为默认值。
9. 成本视图下，有 buildingCargo 时显示「建筑仓库材料」条目；有 buildingReservation 时显示「在途材料」条目。
10. `building` 态下成本视图显示「材料缺口」条目，缺口 = 建设总材料 - 仓库材料 - 在途材料，仅显示缺口 > 0 的 ware。
11. 非 `building` 态下成本视图不显示「材料缺口」条目。
12. 时间/运输/工人视图不显示这三个条目。
13. `npm run build` 无编译错误。

## 未决项

无
