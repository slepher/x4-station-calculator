# One Flow Contribution

## 目标

将现有的三种 contribution 类型（`BaseModuleFlowAtom`、`ModuleFlowAtom`、`StationFlowAtom`）统一为单一 `FlowContribution` 类型，用 `class` 字段区分归属，消除类型重复。同时将 `workforceConsumption` 并入 `consumption`，因为 `class` 已能区分 workforce 消耗的来源。

## 已确认方案（审核重点）

### 1. 统一 Contribution 类型

现有三套贡献类型合并为一套：

```typescript
interface FlowContribution {
  id: string           // stationId | moduleId | race
  class: string        // 'station' | 'module' | 'workforce'
  count: number        // stationCount | moduleCount | workforceAmount
  amount: number
  bonusPercent: number
  production: number
  consumption: number
  workforceConsumption: number
  netRate: number
}
```

各 `class` 填充规则：

| class | id | count | amount | bonusPercent | production/consumption/netRate |
|---|---|---|---|---|---|
| `'station'` | stationId | station.count | 0 | 0 | 站级聚合值 |
| `'module'` | moduleId | module.count | 模块贡献量 | 效率加成 | 0 |
| `'workforce'` | race（实际种族名） | workforce.amount | 0 | 0 | 0 |

### 2. `type` 改为 `class`

原 `BaseModuleFlowAtom.type`（`'production' | 'consumption'`）与贡献归属语义混淆。改为 `class` 表示归属类别。

### 3. workforce contribution 规则

- race 使用实际种族名：`'argon'`、`'teladi'`、`'paranid'` 等，不使用 `<race>` 占位符。
- 自动计算的 workforce 不再使用居住舱模块作为 contribution。改为直接使用 workforce 数量作为一条 `class='workforce'` 的贡献条目。
- `amount` 为 0（workforce 的消耗量已体现在 flow 顶层的 `consumption` 字段）。

### 4. `workforceConsumption` 字段消除

- `WareProductionFlow.workforceConsumption` 和 `EmpireWareFlow.workforceConsumption` 不再独立存在。
- workforce 产生的消耗量并入 `consumption` 字段。
- 由于 `FlowContribution.class` 已经可以区分 `'workforce'` 来源，不需要独立字段。

### 5. 消费方适配

- `WareProductionFlow.contributions`：只包含 `class='module'` + `class='workforce'`
- `EmpireWareFlow.contributions`：只包含 `class='station'`
- `WareFlow.contributions`：仍包含 `class='module'`（二阶段衍生数据附加到 `FlowContribution`）
- 所有 filter/group 逻辑中依赖 `workforceConsumption` 的地方改为检查 contributions 中 `class='workforce'` 的存在性

### 6. `StationFlowAtom` 消除

`StationFlowAtom` 不再独立存在。站级聚合贡献直接使用 `FlowContribution` + `class='station'` 表示。

### 7. `ModuleFlowAtom` 消除

`ModuleFlowAtom` 不再独立存在。模块级贡献直接使用 `FlowContribution` + `class='module'` 表示。二阶段衍生字段（`volumeFlow`/`valueFlow`/`transportFlow`）附加到 `FlowContribution` 上。

## 边界

### In Scope

- `FlowContribution` 类型定义
- 替换 `BaseModuleFlowAtom`、`ModuleFlowAtom`、`StationFlowAtom` 的所有引用
- `workforceConsumption` 字段消除与迁移
- filter/group 逻辑中 workforce 判定方式的更新
- `calculateProductionFlows` 中 workforce contribution 的生成方式改为直接用工数量

### Out of Scope

- `StationDerivedMap` 的缓存结构变更
- `getEmpireGroupedFlows()` 签名变更
- `updateAggregation()` 的 empire 级聚合重构
- 测试代码编写与执行

## 验收标准（DoD）

1. `FlowContribution` 类型定义完成，替代现有的三种 contribution 类型
2. 所有引用旧 contribution 类型的地方已改为使用 `FlowContribution`
3. `class` 值正确区分三个归属类别
4. 自动 workforce 以 `class='workforce'` + 实际种族名作为贡献条目，不使用居住舱模块
5. `workforceConsumption` 字段从 `WareProductionFlow` 和 `EmpireWareFlow` 中移除，消耗量并入 `consumption`
6. 依赖 `workforceConsumption` 的 filter/group 判定改为检查 `class='workforce'`
7. `npm run build` 通过

## 未决项

无
