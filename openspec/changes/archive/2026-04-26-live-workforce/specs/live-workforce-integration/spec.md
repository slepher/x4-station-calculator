# Live Workforce Integration Specification

## Purpose

将存档解析所得的实际 workforce 数据集成到 live production flow 计算中，使系统能准确展示真实空间站的人口分布和医疗物资消耗。

## ADDED Requirements

### Requirement: Workforce Override 数据结构

`StationProductionFlowMap` 的 `ProductionFlowInput` 接口 SHALL 支持传入外部 workforce 数据。

#### Scenario: 输入接口定义

**前提** 调用方需要传入存档中的实际 workforce 数据

**当** 构建 `ProductionFlowInput` 对象时

**那么** 该对象 SHALL 包含以下可选字段：

- `workforceOverride?: WorkforceEntry[]` - 种族分布数组
- `actualWorkforceOverride?: number` - 实际 workforce 总量
- `saturationOverride?: number` - 预计算的效率饱和度

**并且** 所有字段 SHALL 为可选，允许 undefined 或空数组

---

### Requirement: Workforce Override 计算分支

`calculateProductionFlowsInternal` SHALL 根据是否存在 workforceOverride 选择不同的计算路径。

#### Scenario: 使用 override 数据计算医疗消耗

**前提** `workforceOverride` 存在且非空数组

**当** 计算 workforce consumption 时

**那么** 系统 SHALL 遍历 `workforceOverride` 数组

**并且** 对每个 `WorkforceEntry`：

1. 根据 `race` 字段查找对应的 `medicalConsumptionMap[race]`
2. 若 race 不存在于 map，使用 `'default'` 作为 fallback
3. 对该 race 的每种医疗物资，计算：`amount * perPersonPerSecond * 3600`（每小时消耗）
4. 将消耗量累加到 `flowMap[wareId].workforceConsumption`
5. 记录 contribution：`{ moduleId: 'workforce:${race}', count: entry.amount, type: 'consumption', amount: -hourlyAmount, bonusPercent: 0 }`

**并且** SHALL 不执行 `calculateWorkforceCensus` 逻辑

#### Scenario: 无 override 时使用原有逻辑

**前提** `workforceOverride` 为 undefined 或空数组

**当** 计算 workforce consumption 时

**那么** 系统 SHALL 执行原有的 `calculateWorkforceCensus` 逻辑

**并且** 行为与当前版本完全一致

---

### Requirement: 效率饱和度 Override

当存在 `actualWorkforceOverride` 时，效率计算 SHALL 使用 override 值。

#### Scenario: 使用 override 计算饱和度

**前提** 存在 `actualWorkforceOverride` 参数

**当** 计算 `saturation` 时

**那么** 系统 SHALL 使用 `calculateEfficiencySaturation(neededWorkforce, actualWorkforceOverride)`

**并且** 结果 SHALL 限制在 `[0.0, 1.0]` 范围

#### Scenario: 无 override 时使用 settings 计算

**前提** 不存在 `actualWorkforceOverride` 参数

**当** 计算 `saturation` 时

**那么** 系统 SHALL 使用原有的 `calculateActualWorkforce` + `calculateEfficiencySaturation` 逻辑

---

### Requirement: Store 层 Workforce 数据传递

`useLiveProductionStore` SHALL 在同步 live flow 时传递 workforce override。

#### Scenario: 解析并传递 workforce 数据

**前提** 当前 station 有对应的 `PlayerStationEntry`

**当** 执行 `syncLiveFlowMapForStation(stationId)` 时

**那么** 系统 SHALL：

1. 从 `stationEntry.workforces` 获取 workforce 数组
2. 计算 `actualWorkforceOverride = workforces.reduce((sum, w) => sum + w.amount, 0)`
3. 将两者传入 `liveFlowMap.compute()` 的 `ProductionFlowInput`

#### Scenario: 无 workforce 数据时 fallback

**前提** `stationEntry.workforces` 为 undefined 或空数组

**当** 执行 `syncLiveFlowMapForStation(stationId)` 时

**那么** 系统 SHALL 不传递 workforceOverride 参数

**并且** 触发原有的居住舱容量计算逻辑

---

### Requirement: Presenter 强制 Workforce Auto

`useProductionDashboardPresenter` SHALL 在 live 模式下强制 workforceAuto = true。

#### Scenario: Live 模式强制设置

**前提** `store.session.visualMode === 'live'`

**当** 构建 `settings` computed 时

**那么** 返回值 SHALL 包含 `workforceAuto: true`

**并且** 该值 SHALL 覆盖 station settings 中的 `workforceAuto` 字段

#### Scenario: Planning 模式保持原值

**前提** `store.session.visualMode !== 'live'`

**当** 构建 `settings` computed 时

**那么** 返回值 SHALL 使用 `station.settings.workforceAuto` 的实际值

---

### Requirement: Dashboard UI 强制 Checkbox 状态

`StationDashboard.vue` SHALL 支持 `forceWorkforceAuto` prop 控制 checkbox 状态。

#### Scenario: Checkbox 固定 checked

**前提** 传入 `forceWorkforceAuto = true`

**当** 渲染 workforce auto checkbox 时

**那么** checkbox SHALL 显示为 checked 状态

**并且** checkbox SHALL 禁用用户交互（disabled）

**并且** 文本颜色 SHALL 显示为激活状态（sky-400）

#### Scenario: Checkbox 正常交互

**前提** 未传入 `forceWorkforceAuto` 或值为 false

**当** 渲染 workforce auto checkbox 时

**那么** checkbox SHALL 根据 `props.settings.workforceAuto` 显示状态

**并且** 用户 SHALL 可点击切换

---

### Requirement: Contribution Traceability

workforce override 的 consumption contributions SHALL 使用可识别的 moduleId。

#### Scenario: Contribution moduleId 格式

**前提** 使用 workforceOverride 计算医疗消耗

**当** 创建 contribution 对象时

**那么** `moduleId` SHALL 使用格式 `workforce:${race}`

**例如** `workforce:argon`、`workforce:terran`

**并且** `count` SHALL 为该 race 的实际人口数（`entry.amount`）