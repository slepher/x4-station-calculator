# One Flow Contribution

## 目标

将现有所有 contribution 相关类型（`FlowContribution`、`DerivedStationFlowAtom`、`SupplyStorageFlowDetail`）统一为单一类型族，用 `class` 字段区分归属，消除类型重复和字段冗余。同时将 `workforceConsumption` 并入 `consumption`。

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

各 `class` 填充规则：

| class | id | count | amount |
|---|---|---|---|
| `module` | moduleId | module.count | 模块贡献量 |
| `workforce` | race（实际种族名） | workforce.amount | 负向消耗值 |
| `station` | stationId | station.count | 站级聚合 netRate |
| `sector` | sectorId | 1 | 跨星区物流 / gap 其他星区供给 |

不含可派生字段（`volumeFlow`/`valueFlow`/`transportFlow`），避免冗余。

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

| 字段 | 来源 |
|---|---|
| `name` | 派生阶段按 class 填充：StationPlan.name / binding group name / module name / race |
| `netValue` | `amount * unitPrice` |
| `sortOrder` | 排序用 |
| `storageVolume` | `\|amount\| * unitVolume * bufferHours` |
| `transportVolume` | `\|amount\| * unitVolume` |

`name` 在派生阶段填充，来源：

| class | name 来源 |
|---|---|
| `'station'` | `StationPlan.name` |
| `'sector'` | `SaveBindingPlan.group.name`（非 map sector name） |
| `'module'` | `modulesMap[id].name` |
| `'workforce'` | id 本身即是 race 名 |

### gap 分析使用 `DerivedFlowContribution`

`buildStationComponentGapFlows` 使用 `DerivedFlowContribution`，但只填充必要字段（`id`/`class`/`type`/`count`/`amount`/`bonusPercent`/`name`），不涉及价格/体积派生字段。

### 替换关系

| 旧类型 / 格式 | 新类型 / 格式 |
|---|---|
| `FlowContribution`（含 volumeFlow/valueFlow/transportFlow） | `FlowContribution`（不含派生字段） |
| `DerivedStationFlowAtom extends FlowContribution + stationName` | `DerivedFlowContribution extends FlowContribution`（无 name） |
| `SupplyStorageFlowDetail` | `DerivedFlowContribution` |
| gap 分析中 `id: 'sector:<id>', class: 'station'` | `id: sectorId, class: 'sector'` |
| solver 物流 `class: 'external-station'` | `class: 'sector'` |
| `stationId.startsWith('external:')` | `class === 'sector'` |

## 数据流

```
生成侧:
  calculateProductionFlows()
    → FlowContribution[]（class: 'module' | 'workforce'）

聚合侧:
  updateAggregation() / buildExternalCache()
    → FlowContribution[]（class: 'station' | 'sector'）

派生侧:
  deriveProductionFlows() / buildSupplyStorageFlows()
    → FlowContribution[] → DerivedFlowContribution[]（加 name / netValue 等）

gap 分析:
  buildStationComponentGapFlows()
    → DerivedFlowContribution[]（只填 id/class/type/count/amount/name）

消费侧:
  TransitHub → DerivedFlowContribution（name 已填充）
  StationToolbar（gap） → DerivedFlowContribution（name 已填充）
```

## 边界

### In Scope

- `FlowContribution` 类型定义（不含派生字段，class 含 `'sector'`）
- `DerivedFlowContribution` 类型定义（不含 name）
- 替换所有旧 contribution 类型的引用
- Gap 分析贡献格式规范化
- `workforceConsumption` 字段消除与迁移
- `SupplyStorageFlowDetail` → `DerivedFlowContribution` 的替换
- filter/group 中 workforce 判定改为 `class='workforce'`
- UI 组件中 `stationId.startsWith('external:')` 改为 `class === 'sector'`

### Out of Scope

- 测试代码编写与执行
- `station-name` helper 的实现（由后续 UI change 负责）

## 验收标准（DoD）

1. `FlowContribution` 只含原始字段，不含 `volumeFlow/valueFlow/transportFlow`
2. `DerivedFlowContribution` 含 `name`/`netValue`/`sortOrder`/`storageVolume`/`transportVolume`
3. `DerivedStationFlowAtom` / `SupplyStorageFlowDetail` 已删除
4. `class` 值正确区分 `module` / `workforce` / `station` / `sector`
5. gap 分析贡献使用 `DerivedFlowContribution` + `class: 'sector'`，不再用 `id: 'sector:<id>'` 格式
6. solver 物流使用 `class: 'sector'`，不再用 `class: 'external-station'`
7. `workforceConsumption` 字段移除，消耗量并入 `consumption`
8. UI 检测外部贡献不再使用 `stationId.startsWith('external:')`
9. `name` 在派生阶段填充，Vue 层直接读 `detail.name`
10. `npm run build` 通过
