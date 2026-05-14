# Building Module Scope Specification

## Purpose

为实况产能空间站视图的 StationDashboard 提供建造模块范围切换能力，使用户可查看已建设、建设中或所有模块的成本/时间/运输分析数据，同时保持工人视图始终基于已建设模块。并在成本视图中提供建筑仓库材料、在途材料和材料缺口信息。

## ADDED Requirements

### Requirement: ModuleScope State

- Store SHALL 新增 `moduleScope: Ref<'built' | 'building' | 'all'>`。
- 有 buildingModules 时默认值为 `'building'`，无则为 `'built'`。
- 切换活跃空间站时 SHALL 将 `moduleScope` 重置为默认值。
- mode 切换时 SHALL 将 `moduleScope` 重置为默认值。
- `hasBuildingModules` 从 false→true 且当前为 `built` 时 SHALL 切换到 `building`；从 true→false 且当前非 `built` 时 SHALL 切换到 `built`。

### Requirement: ModuleScope Toolbar Button

- LiveStationToolbar 在**实时模式**下 SHALL 显示「建造视图」三态切换按钮。
- 按钮 SHALL 仅在 `mode === 'live' && buildingModules.length > 0` 时可见。
- 按钮 SHALL 使用 `toggle-chip` 样式，group-label 为 i18n key `toolbar.module_scope`。
- 点击按钮 SHALL 循环切换状态：`built → building → all → built`。
- 三态样式：
  - `built` → `active-green`，图标 `🏗️`，文本 i18n key `toolbar.module_scope_built`
  - `building` → `active-amber`，图标 `🚧`，文本 i18n key `toolbar.module_scope_building`
  - `all` → `active-sky`，图标 `📦`，文本 i18n key `toolbar.module_scope_all`
- 按钮 SHALL 位于「单次停泊吞吐量」右侧。
- 按钮 SHALL 前置分隔线；按钮隐藏时分隔线 SHALL 同步隐藏。

#### Scenario: 无 buildingModules 时按钮隐藏

- **前提** mode 为 live，archive 空间站的 buildingModules 为空数组
- **当** 用户查看 LiveStationToolbar
- **那么** 建造视图按钮不显示，前置分隔线不显示

#### Scenario: 有 buildingModules 时按钮显示

- **前提** mode 为 live，archive 空间站的 buildingModules 不为空
- **当** 用户查看 LiveStationToolbar
- **那么** 建造视图按钮显示，前置分隔线显示，默认状态为 building

#### Scenario: 点击循环三态

- **前提** 建造视图按钮当前状态为 built
- **当** 用户点击按钮
- **那么** 状态变为 building，按钮样式变为 active-amber，图标变为 🚧
- **并且** 再次点击变为 all，样式 active-sky，图标 📦
- **并且** 再次点击回到 built

### Requirement: Dashboard Effective Modules

- StationDashboard SHALL 新增可选 prop `effectiveModules?: SavedModule[]`。
- 当 `effectiveModules` 未提供时，SHALL 回退使用 `modules`（兼容现有调用方）。
- StationDashboard SHALL 执行双分析：
  - `costAnalysis` = `analyzeStation(effectiveModules ?? modules, ...)` → 供成本/时间/运输视图及 stats-bar 中成本/体积/时间/运输字段
  - `workersAnalysis` = `analyzeStation(modules, ...)` → 供工人视图及 stats-bar 中工人/效率字段

#### Scenario: built 态下成本视图使用 modules

- **前提** moduleScope 为 built，modules 有 3 个模块，buildingModules 有 2 个模块
- **当** 用户查看成本视图
- **那么** 成本数据基于 modules（3 个模块）计算

#### Scenario: building 态下成本视图使用 buildingModules

- **前提** moduleScope 为 building
- **当** 用户查看成本视图
- **那么** 成本数据基于 buildingModules（2 个模块）计算

#### Scenario: all 态下成本视图使用合并模块

- **前提** moduleScope 为 all
- **当** 用户查看成本视图
- **那么** 成本数据基于 modules+buildingModules（5 个模块）计算

#### Scenario: 工人视图始终使用 modules

- **前提** moduleScope 为 building 或 all
- **当** 用户查看工人视图
- **那么** 工人数据基于 modules（3 个模块）计算，不受 moduleScope 影响

### Requirement: Presenter 透传

- `useProductionToolbarPresenter` SHALL 透传 `moduleScope` 和 `hasBuildingModules`。
- `useProductionDashboardPresenter` SHALL 根据 `moduleScope` 计算 `effectiveModules`：
  - `'built'` → `stationState.modules`
  - `'building'` → `stationState.buildingModules`
  - `'all'` → `[...stationState.modules, ...stationState.buildingModules]`
- LiveProductionWorkbenchView station view SHALL 将 `effectiveModules` 传递给 StationDashboard。

### Requirement: Building Cargo/Reservation Data Pipeline

- `ProductionStationState` SHALL 新增 `buildingCargo: WareAmount[]` 和 `buildingReservation: WareAmount[]`。
- Store 层 live 模式下 SHALL 从 `archiveStation.building.cargo/reservation` 透传这两个字段。
- `useProductionDashboardPresenter` SHALL 透传 `buildingCargo` 和 `buildingReservation`。
- LiveProductionWorkbenchView station view SHALL 将 `buildingCargo` 和 `buildingReservation` 传递给 StationDashboard。
- `WareAmount.ware` 与 `AnalysisItem.id` 使用同一 ware ID 命名空间，可直接匹配。

#### Scenario: live 模式下 buildingCargo 透传

- **前提** mode 为 live，archiveStation.building.cargo 含 3 种 ware
- **当** StationDashboard 接收 buildingCargo prop
- **那么** buildingCargo 包含这 3 种 ware 的 WareAmount 数据

### Requirement: Cost View Build Storage Entries

- StationDashboard 成本视图 SHALL 在 `buildingCargo` 非空时显示「建筑仓库材料」条目。
- StationDashboard 成本视图 SHALL 在 `buildingReservation` 非空时显示「在途材料」条目。
- 两个条目 SHALL 使用 `StationModuleDetail variant="summary"` 展示，显示每种 ware 的数量/价格/体积。
- 三条目 SHALL 仅在成本视图（`viewMode === 'materials'`）下显示。

#### Scenario: 建筑仓库材料显示

- **前提** viewMode 为 materials，buildingCargo 含 hullparts:10 和 claytronics:5
- **当** 用户查看成本视图
- **那么** 显示「建筑仓库材料」summary 条目，包含 hullparts 和 claytronics

#### Scenario: 在途材料显示

- **前提** viewMode 为 materials，buildingReservation 含 energycells:200
- **当** 用户查看成本视图
- **那么** 显示「在途材料」summary 条目，包含 energycells

### Requirement: Material Gap Entry

- StationDashboard 成本视图 SHALL 仅在 `moduleScope === 'building'`（通过 effectiveModules 推断）时计算和显示「材料缺口」条目。
- 材料 SHALL 计算：对每个 ware，`缺口 = costAnalysis.summaryItems 中该 ware 的 count - buildingCargo 中该 ware 的 amount - buildingReservation 中该 ware 的 amount`。
- 仅 SHALL 显示缺口 > 0 的 ware。
- 条目 SHALL 使用 `StationModuleDetail variant="summary"` 展示。

#### Scenario: building 态下材料缺口计算

- **前提** moduleScope 为 building，costAnalysis 建设总材料需 hullparts:20，buildingCargo 有 hullparts:10，buildingReservation 有 hullparts:5
- **当** 用户查看成本视图
- **那么** 显示「材料缺口」条目，hullparts 缺口为 5

#### Scenario: 非 building 态下不显示材料缺口

- **前提** moduleScope 为 built 或 all
- **当** 用户查看成本视图
- **那么** 不显示「材料缺口」条目

#### Scenario: 缺口为零时该 ware 不显示

- **前提** moduleScope 为 building，某 ware 总需求 10，cargo 8，reservation 2
- **当** 用户查看成本视图
- **那么** 「材料缺口」条目中不包含该 ware（缺口 = 0）
