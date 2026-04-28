# One Flow Contribution - Design

## 消除项

| 消除 | 原因 |
|---|---|
| `SupplyStorageFlow` 类型 | TransitHub 不应有独立存储类型，直接读 DerivedProductionFlow |
| `buildStorageFlowsFromProductionFlows` | 存储体积从 DerivedProductionFlow.storageVolume 取 |
| `SupplyStorageFlowDetail` | 被 DerivedFlowContribution 替代 |
| `DerivedStationFlowAtom` | 被 DerivedFlowContribution 替代 |
| `buildSupplyStorageFlows`（sectorInternalDataMap） | `SectorInternalData.supplyStorageFlows` 无消费者 |
| `groupDerivedProductionFlows` 独立函数 | 改为 useWareFlowGrouping composable |
| `StationComponentGapFlows` 中的 `EmpireWareFlow[]` | 改为 `DerivedProductionFlow[]` |
| `getSectorFinalProductionFlows` 中自填 name | 统一到 deriveProductionFlows |

## 数据流

```
raw FlowContribution[]
  ↓
deriveProductionFlows() ← 唯一派生入口
  ├── modulesMap → 解析 module name
  ├── stationNameMap → 解析 station name
  ├── sectorNameMap → 解析 sector name
  ├── waresMap → 计算 netValue
  └── settings → 计算 transportVolume / storageVolume
  ↓
DerivedProductionFlow[]（含 DerivedFlowContribution[]）
  ↓
useWareFlowGrouping() ← 唯一分组 composable
  ├── rateGroups: { positive, operations, supply, resources }
  ├── volumeGroups: { container, solid, liquid }
  └── 直接读 flow.transportDemand（transport 视图）
  ↓
Vue 组件（StationWareFlowsDashboard / TransitHubCenterDashboard / EmpireWareFlowsDashboard）
```

## 涉及文件

| 文件 | 变更 |
|---|---|
| `src/types/production-flow.ts` | `DerivedProductionFlow.contributions` 改为 `DerivedFlowContribution[]` |
| `src/types/x4.ts` | 删 `SupplyStorageFlow` / `SupplyStorageFlowDetail`；`SectorInternalData` 删 `supplyStorageFlows`；`StationComponentGapFlows` 改 `DerivedProductionFlow[]` |
| `src/store/logic/calculateWareFlowDerived.ts` | `deriveProductionFlows` 收 station/sector name maps，统一 name 解析；产 `DerivedFlowContribution[]` |
| `src/store/logic/empireFlowFacade.ts` | 删 `buildSupplyStorageFlows`；`sectorInternalDataMap` 删 `supplyStorageFlows`；`getSectorFinalProductionFlows` 不自填 name；`getStationComponentGapFlows` 返回 `DerivedProductionFlow[]` |
| `src/store/logic/stationGapViewModel.ts` | 产出 `DerivedProductionFlow[]`（替代 `EmpireWareFlow[]`） |
| `src/store/logic/deriveEmpireWareFlowView.ts` | `deriveEmpireWareFlows` 统一到 `deriveProductionFlows` |
| `src/components/empire/composables/useWareFlowGrouping.ts` | 从独立 `groupDerivedProductionFlows` 改为 composable，供三个 dashboard 共用 |
| `src/components/empire/StationWareFlowsDashboard.vue` | 移除本地 `volumeGroups`/`transportGroups`/`wrapFlow`，调 composable |
| `src/components/empire/transit-hub/TransitHubCenterDashboard.vue` | 移除 `buildStorageFlowsFromProductionFlows` / `transportItems` / 自定义 `groupedFlows`，调 composable |
| `src/components/empire/transit-hub/TransitHubStorageFlow.vue` | prop 从 `SupplyStorageFlowDetail[]` 改为 `DerivedFlowContribution[]`（已完成） |
| `src/components/empire/transit-hub/TransitHubTransportFlow.vue` | prop 从 `TransportDetail` 改为 `DerivedFlowContribution[]`（已完成） |
| `src/components/empire/EmpireWareFlowsDashboard.vue` | 移除本地 `transportFlows`/`storageFlows`，调 composable |
