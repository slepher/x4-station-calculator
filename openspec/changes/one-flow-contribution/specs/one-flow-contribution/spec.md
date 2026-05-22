# One Flow Contribution Specification

## Purpose

Establish `store → presenter → vue` layered architecture:
- Store/facade produces only raw `DerivedProductionFlow[]`
- All views consume same data via a shared `useWareFlowGrouping` composable
- Eliminate `SupplyStorageFlow`, `buildStorageFlowsFromProductionFlows`, `groupDerivedProductionFlows`
- Gap analysis uses `DerivedProductionFlow[]` instead of `EmpireWareFlow[]`

## REMOVED Requirements

| 删除项 | 替代 |
|---|---|
| `SupplyStorageFlow` 类型 | `DerivedProductionFlow` |
| `SupplyStorageFlowDetail` 类型 | `DerivedFlowContribution` |
| `DerivedStationFlowAtom` | `DerivedFlowContribution` |
| `groupDerivedProductionFlows` 函数 | `useWareFlowGrouping` composable |
| `buildStorageFlowsFromProductionFlows` 函数 | 直接读 `DerivedProductionFlow` 字段 |
| `buildSupplyStorageFlows` 函数 | 不再需要（`sectorInternalDataMap` 无消费者） |
| `SectorInternalData.supplyStorageFlows` | 删除 |
| `StationComponentGapFlows` 中 `EmpireWareFlow[]` | `DerivedProductionFlow[]` |

## ADDED Requirements

### Requirement: deriveProductionFlows 是唯一派生入口

#### Scenario: name 统一解析

**Given** `deriveProductionFlows` 入参扩展 `stationNameMap`/`sectorNameMap`
**When** 处理贡献
**Then** `class: 'station'` → name 从 `stationNameMap` 获取
**And** `class: 'sector'` → name 从 `sectorNameMap` 获取
**And** `class: 'module'` → name 从 `modulesMap` 获取
**And** `class: 'workforce'` → name = id（race 名）

#### Scenario: getSectorFinalProductionFlows 不自填 name

**Given** `getSectorFinalProductionFlows` 返回 `WareProductionFlow[]`
**When** TransitHub 收到后调用 `deriveProductionFlows`
**Then** name 由 `deriveProductionFlows` 统一填入

### Requirement: useWareFlowGrouping composable

#### Scenario: 统一分组入口

**Given** `DerivedProductionFlow[]` 数据
**When** 调用 `useWareFlowGrouping(flows)`
**Then** 返回 `{ rateGroups, volumeGroups }`
**And** `StationWareFlowsDashboard` 使用此 composable
**And** `TransitHubCenterDashboard` 使用此 composable
**And** `EmpireWareFlowsDashboard` 使用此 composable

### Requirement: 视图直接读字段

#### Scenario: 仓储视图

**Given** 仓储视图需要存储体积
**When** 从 `DerivedFlowContribution.storageVolume` 读取
**Then** 不再需要 `SupplyStorageFlow` 中间类型

#### Scenario: 运输视图

**Given** 运输视图需要运输量
**When** 从 `DerivedProductionFlow.transportDemand` 读取
**Then** 不再需要 `buildStorageFlowsFromProductionFlows`

### Requirement: Gap 分析统一

#### Scenario: buildStationComponentGapFlows 产出 DerivedProductionFlow[]

**Given** `buildStationComponentGapFlows` 执行
**When** 产出 gap 数据
**Then** `operations` 和 `supply` 为 `DerivedProductionFlow[]`
**And** flow 级 `minPrice/avgPrice/maxPrice` 不再需要（从 waresMap 取）
