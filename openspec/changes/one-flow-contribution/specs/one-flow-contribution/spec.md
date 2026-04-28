# One Flow Contribution Specification

## Purpose

Unify all contribution-related types (`FlowContribution`, `DerivedStationFlowAtom`, `SupplyStorageFlowDetail`) into a single typed family with `class` field for source differentiation.

## Type Design

### Base: `FlowContribution`

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

No derived fields (`volumeFlow`/`valueFlow`/`transportFlow`).

### Derived: `DerivedFlowContribution extends FlowContribution`

```typescript
interface DerivedFlowContribution extends FlowContribution {
  name: string
  netValue: number
  sortOrder?: number
  storageVolume?: number
  transportVolume?: number
}
```

`name` filled at derive stage from StationPlan / binding group / modulesMap / race.

## ADDED Requirements

### Requirement: FlowContribution 不含派生字段

#### Scenario: volumeFlow/valueFlow/transportFlow 不在 FlowContribution

**Given** `FlowContribution` 类型定义
**When** 不包含 `volumeFlow`、`valueFlow`、`transportFlow`
**Then** 这些字段不是 `FlowContribution` 的一部分
**And** `DerivedFlowContribution.netValue` 替代 `valueFlow`
**And** `DerivedFlowContribution.transportVolume` 替代 `transportFlow`

#### Scenario: volumeFlow 实时计算

**Given** `StationWareFlow.vue` 需要 volume
**When** `detail.volumeFlow` 不再可用
**Then** 使用 `detail.amount * (props.unitVolume || 0)` 实时计算

### Requirement: class 值 'sector'

#### Scenario: gap 分析

**Given** `buildStationComponentGapFlows` 中其他星区供给
**When** 构建贡献
**Then** `class: 'sector'`，`id: sectorId`
**And** 不再使用 `id: 'sector:<id>'` 前缀格式

#### Scenario: solver 物流

**Given** `buildExternalCache` 中跨星区物流
**When** 构建贡献
**Then** `class: 'sector'` 替代 `'external-station'`

### Requirement: DerivedFlowContribution 替代 SupplyStorageFlowDetail

#### Scenario: details 类型变更

**Given** `SupplyStorageFlow.details`
**When** 类型从 `SupplyStorageFlowDetail[]` 改为 `DerivedFlowContribution[]`
**Then** UI 通过 `detail.name` 获取可读名称
**And** 通过 `detail.class === 'sector'` 检测外部贡献

#### Scenario: class 替代 stationId 前缀

**Given** TransitHub 组件
**When** `detail.stationId.startsWith('external:')` 不再可用
**Then** 使用 `detail.class === 'sector'` 检测外部贡献

### Requirement: name 在派生阶段填充

#### Scenario: name 来源

**Given** `DerivedFlowContribution` 构建时
**When** `class === 'station'`
**Then** `name` 从 `StationPlan.name` 获取
**When** `class === 'sector'`
**Then** `name` 从 `SaveBindingPlan.group.name` 获取
**When** `class === 'module'`
**Then** `name` 从 `modulesMap[id].name` 获取
**When** `class === 'workforce'`
**Then** `name` 从 id（race 名）获取

### Requirement: gap 分析使用 DerivedFlowContribution

#### Scenario: gap 只填必要字段

**Given** `buildStationComponentGapFlows`
**When** 构建贡献
**Then** 使用 `DerivedFlowContribution`
**And** 只填充 `id`/`class`/`type`/`count`/`amount`/`bonusPercent`/`name`
**And** `netValue`/`storageVolume`/`transportVolume` 为 0

## REMOVED Requirements

| 删除项 | 替代 |
|---|---|
| `DerivedStationFlowAtom` | `DerivedFlowContribution` |
| `SupplyStorageFlowDetail` | `DerivedFlowContribution` |
| `FlowContribution.volumeFlow?` | 运行时计算 `amount * unitVolume` |
| `FlowContribution.valueFlow?` | `DerivedFlowContribution.netValue` |
| `FlowContribution.transportFlow?` | `DerivedFlowContribution.transportVolume` |
| gap 中 `id: 'sector:<id>'` | `id: sectorId, class: 'sector'` |
| `class: 'external-station'` | `class: 'sector'` |
