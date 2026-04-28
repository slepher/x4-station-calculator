# One Flow Contribution

## 目标

统一所有 contribution 相关类型，建立 `store → presenter → vue` 的规范分层：
- Store/facade 只产出原始 `DerivedProductionFlow[]`，不做分组
- Vue 层通过统一 composable 完成分组和展示
- 消除 `SupplyStorageFlow`、`buildStorageFlowsFromProductionFlows`、`groupDerivedProductionFlows`（改为 composable）
- gap 分析产出 `DerivedProductionFlow[]`，不再使用 `EmpireWareFlow[]`
- 所有 `FlowContribution` → `DerivedFlowContribution` 的转换统一在 `deriveProductionFlows` 中完成

## 类型设计

### 原始层 `FlowContribution`（cache / gap 层使用）

```typescript
interface FlowContribution {
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
interface DerivedFlowContribution extends FlowContribution {
  name: string
  netValue: number
  sortOrder?: number
  storageVolume?: number
  transportVolume?: number
}
```

### 统一的流类型 `DerivedProductionFlow`

```typescript
interface DerivedProductionFlow extends WareFlow {
  // WareFlow 已有: productionVolume / consumptionVolume / netVolume
  // WareFlow 已有: transportDemand
  // WareFlow 已有: unitPrice / netValue
  // contributions: DerivedFlowContribution[]（统一为派生类型）
}
```

所有视图从同一数据源派生：

```
Store / Facade
  └── DerivedProductionFlow[]（含 DerivedFlowContribution[]）

Vue composable（useWareFlowGrouping）
  ├── rateGroups: { positive, operations, supply, resources }
  ├── volumeGroups: { container, solid, liquid }
  └── 直接消费 flow.transportDemand

各组件调用同一 composable
  ├── StationWareFlowsDashboard
  ├── TransitHubCenterDashboard
  └── EmpireWareFlowsDashboard
```

## 消除项

| 消除项 | 替代 |
|---|---|
| `SupplyStorageFlow` 类型 | 直接使用 `DerivedProductionFlow` |
| `SupplyStorageFlowDetail` 类型 | 使用 `DerivedFlowContribution` |
| `buildStorageFlowsFromProductionFlows` | 直接读 `DerivedProductionFlow` 字段 |
| `groupDerivedProductionFlows` 独立函数 | 改为 `useWareFlowGrouping` composable |
| `StationComponentGapFlows` 中的 `EmpireWareFlow[]` | 改为 `DerivedProductionFlow[]` |
| `getSectorFinalProductionFlows` 中回填 name | name 在 `deriveProductionFlows` 中统一处理 |

## 数据流

```
生成侧:
  calculateProductionFlows()
    → FlowContribution[]（class: 'module' | 'workforce'）

聚合侧:
  updateAggregation() / buildExternalCache()
    → FlowContribution[]（class: 'station' | 'sector'）

统一派生入口:
  deriveProductionFlows()
    → FlowContribution[] → DerivedFlowContribution[]（name / netValue / transportVolume）
    → DerivedProductionFlow[]（统一下发）

消费侧（Vue composable）:
  useWareFlowGrouping(derivedFlows)
    → rateGroups / volumeGroups（无 SupplyStorageFlow）

Vue 组件:
  StationWareFlowsDashboard    ← 调同一 composable
  TransitHubCenterDashboard    ← 调同一 composable
  EmpireWareFlowsDashboard     ← 调同一 composable
  gap 分析                      ← 统一为 DerivedProductionFlow[]
```

## 验收标准（DoD）

1. `FlowContribution` 只含原始字段
2. `DerivedFlowContribution` 含 name / netValue / sortOrder / storageVolume / transportVolume
3. `DerivedStationFlowAtom` / `SupplyStorageFlow` / `SupplyStorageFlowDetail` 删除
4. `groupDerivedProductionFlows` 改为 composable
5. `buildStorageFlowsFromProductionFlows` 删除
6. `StationComponentGapFlows` 使用 `DerivedProductionFlow[]`
7. `getSectorFinalProductionFlows` 不自填 name
8. `deriveProductionFlows` 是唯一 name 解析入口
9. 全部（StationWareFlowsDashboard、TransitHubCenterDashboard、EmpireWareFlowsDashboard）调同一 grouping composable
10. `npm run build` 通过
