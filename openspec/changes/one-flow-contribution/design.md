# One Flow Contribution - Design

## 类型结构

### 原始层 `FlowContribution`

```typescript
// src/types/production-flow.ts
export interface FlowContribution {
  id: string
  class: 'module' | 'workforce' | 'station' | 'sector'
  type: 'production' | 'consumption'
  count: number
  amount: number
  bonusPercent: number
}
```

### 派生层 `DerivedFlowContribution`

```typescript
// src/types/production-flow.ts
export interface DerivedFlowContribution extends FlowContribution {
  name: string
  netValue: number
  sortOrder?: number
  storageVolume?: number
  transportVolume?: number
}
```

`name` 在派生阶段填充，按 class 从对应数据源查询。Vue 层直接读 `detail.name`。

### 引用类型变更

| 类型 | 字段 | 改动 |
|---|---|---|
| `WareProductionFlow` | `contributions: FlowContribution[]` | class: 'module'/'workforce' |
| `EmpireWareFlow` | `contributions: FlowContribution[]` | class: 'station'/'sector' |
| `WareFlow` | `contributions: FlowContribution[]` | 沿用 |
| `SupplyStorageFlow` | `details: SupplyStorageFlowDetail[]` | 改为 `details: DerivedFlowContribution[]` |
| `DerivedStationFlowAtom` | extends FlowContribution | 删除，由 `DerivedFlowContribution` 替代 |

## 替换关系

| 旧 | 新 |
|---|---|
| `DerivedStationFlowAtom` | `DerivedFlowContribution`（name 回填） |
| `SupplyStorageFlowDetail` | `DerivedFlowContribution` |
| `FlowContribution.volumeFlow?` | 运行时 `amount * unitVolume` |
| `FlowContribution.valueFlow?` | `DerivedFlowContribution.netValue` |
| `FlowContribution.transportFlow?` | `DerivedFlowContribution.transportVolume` |
| gap 中 `id: 'sector:<id>', class: 'station'` | `id: sectorId, class: 'sector'` |
| solver 中 `class: 'external-station'` | `class: 'sector'` |

## 涉及文件

| 文件 | 变更 |
|---|---|
| `src/types/production-flow.ts` | 新 `FlowContribution`，新 `DerivedFlowContribution`（含 name），删 `DerivedStationFlowAtom` |
| `src/types/x4.ts` | `SupplyStorageFlow.details` 改 `DerivedFlowContribution[]`，删 `SupplyStorageFlowDetail` |
| `src/store/logic/calculateWareFlowDerived.ts` | 贡献产出改为 `DerivedFlowContribution[]`，填 name/netValue/transportVolume |
| `src/store/state/StationDerivedMap.ts` | `convertProductionFlowToWareFlow` 删 volumeFlow/valueFlow/transportFlow；`buildExternalCache` 用 `class: 'sector'`，name 留空由 facade 回填 |
| `src/store/logic/stationGapViewModel.ts` | 贡献使用 `DerivedFlowContribution`，`id: sectorId, class: 'sector'`，填 name |
| `src/store/logic/empireFlowFacade.ts` | `buildSupplyStorageFlows` 产 `DerivedFlowContribution[]`，填 name；`getSectorFinalProductionFlows` 填 name |
| `src/components/empire/StationWareFlow.vue` | `detail.volumeFlow` → 实时计算 |
| `src/components/empire/transit-hub/TransitHubStorageFlow.vue` | `stationId` → `id`，`kind` → `type`，`stationName` → `name`，`startsWith('external:')` → `class === 'sector'` |
| `src/components/empire/transit-hub/TransitHubTransportFlow.vue` | 同上 |
| `src/components/empire/EmpireWareFlowsDashboard.vue` | 同上 |
