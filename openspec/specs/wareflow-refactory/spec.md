# wareflow-refactory Specification

## Purpose
TBD - created by archiving change wareflow-refactory. Update Purpose after archive.
## Requirements
### Requirement: WareProductionFlow 数据类型

一阶段输出的新数据类型 SHALL 仅包含产量相关字段。

#### Scenario: 一阶段输出结构验证

**前提** (Given) 一阶段计算完成
**当** (When) 获取 `productionFlows` 数据
**那么** (Then) 每个元素包含以下字段：
- `wareId`: 物资ID
- `orderIndex`: 排序索引
- `tier`: 等级
- `transportType`: 运输类型
- `unitVolume`: 单体体积
- `minPrice`, `price`, `maxPrice`: 价格数据（来自 X4Ware）
- `production`: 总产出/h
- `consumption`: 总消耗/h
- `workforceConsumption`: 工人消耗/h
- `netRate`: 净产出
- `contributions`: 模块贡献明细

**并且** (And) 不包含以下字段（二阶段计算）：
- `productionVolume`, `consumptionVolume`, `netVolume`
- `unitPrice`, `netValue`
- `totalOccupiedCount`, `totalOccupiedConsumptionCount`, `totalOccupiedVolume`
- `transportDemand`

#### Scenario: 一阶段包含二阶段所需静态数据

**前提** (Given) 一阶段计算完成
**当** (When) 二阶段开始计算
**那么** (Then) 无需查询 `waresMap`
**并且** (And) 所有价格数据已在一阶段预取（minPrice, price, maxPrice）
**并且** (And) 所有体积数据已在一阶段预取（unitVolume）
**并且** (And) 所有分组数据已在一阶段预取（transportType, tier）

#### Scenario: ModuleFlowAtom 一阶段字段

**前提** (Given) 一阶段计算 contributions
**当** (When) 检查每个 ModuleFlowAtom
**那么** (Then) 包含以下字段：
- `moduleId`: 模块ID
- `count`: 模块数量
- `type`: 'production' | 'consumption'
- `amount`: 贡献数量
- `bonusPercent`: 效率加成

**并且** (And) 不包含以下字段（二阶段计算）：
- `volumeFlow`, `valueFlow`, `transportFlow`

### Requirement: 一阶段计算函数

Store 层调用的产量计算函数 SHALL 位于 `src/store/logic/`。

#### Scenario: calculateProductionFlows 函数签名

**前提** (Given) 函数定义在 `src/store/logic/calculateProductionFlows.ts`
**当** (When) 调用函数
**那么** (Then) 输入参数为：
- `plannedModules: SavedModule[]`
- `settings: StationSettings`（部分字段）
- `modulesMap: Record<string, X4Module>`
- `waresMap: Record<string, X4Ware>`
- `medicalConsumptionMap: RaceMedicalConsumption`
- `lockedWares: string[]`
- `warePriority: Record<string, number>`

**并且** (And) 输出为 `{ autoIndustryModules: SavedModule[], productionFlows: WareProductionFlow[] }`

#### Scenario: autoIndustryModules 不含仓储泊位

**前提** (Given) 一阶段计算完成
**当** (When) 检查 `autoIndustryModules`
**那么** (Then) 仅包含：
- 生产模块（工厂）
- 居住舱模块
**并且** (And) 不包含：
- 仓储模块（type === 'storage'）
- 泊位模块（type === 'pier'）

### Requirement: 二阶段计算函数

Vue composable 调用的衍生数据计算函数 SHALL 位于 `src/store/logic/`。

#### Scenario: calculateWareFlowDerived 函数签名

**前提** (Given) 函数定义在 `src/store/logic/calculateWareFlowDerived.ts`
**当** (When) 调用函数
**那么** (Then) 输入参数为：
- `productionFlows: WareProductionFlow[]`
- `autoIndustryModules: SavedModule[]`
- `settings`：bufferHours, priceMultiplier, transportMinutes, transportShipCapacity
- `waresMap: Record<string, X4Ware>`
- `modulesMap: Record<string, X4Module>`
- `medicalConsumptionMap: RaceMedicalConsumption`

**并且** (And) 输出为 `{ groupedFlows: GroupedFlows, autoInfrastructureModules: SavedModule[] }`

#### Scenario: autoInfrastructureModules 包含仓储泊位

**前提** (Given) 二阶段计算完成
**当** (When) 检查 `autoInfrastructureModules`
**那么** (Then) 包含：
- 仓储模块（根据 `totalOccupiedVolume` 计算）
- 泊位模块（根据 `transportDemand` 计算）

### Requirement: StationState 字段变更

StationState SHALL 新增字段并移除冗余字段。

#### Scenario: 新增字段

**前提** (Given) StationState 接口定义
**当** (When) 检查字段列表
**那么** (Then) 新增以下字段：
- `productionFlows: WareProductionFlow[] | null`
- `autoInfrastructureModules: SavedModule[]`

#### Scenario: 移除字段

**前提** (Given) StationState 接口定义
**当** (When) 检查字段列表
**那么** (Then) 移除以下字段：
- `groupedFlows: GroupedFlows | null`（改为 Vue 计算）
**并且** (And) `groupedFlowsForEmpire` 保留（用于 Empire 聚合）

### Requirement: 一阶段触发机制

一阶段计算 SHALL 在 plannedModules 更新时直接调用，不是 watch。

#### Scenario: plannedModules 更新触发

**前提** (Given) 用户修改 plannedModules（添加/删除/修改数量）
**当** (When) `writeAndRecomputeActive()` 执行
**那么** (Then) 调用 `StationStateMap.recompute()` 执行一阶段计算

#### Scenario: 切换 tab 触发

**前提** (Given) 用户切换 station tab
**当** (When) activeStationId 变化
**那么** (Then) 同步新 station 的 plannedModules 并触发一阶段计算

### Requirement: 二阶段触发机制

二阶段计算 SHALL 通过 watch 参数变化触发。

#### Scenario: bufferHours 变化触发

**前提** (Given) 用户调整 bufferHours 滑块
**当** (When) `resourceBufferHours`, `primaryProductBufferHours`, `secondaryProductBufferHours` 变化
**那么** (Then) 触发二阶段重新计算

#### Scenario: priceMultiplier 变化触发

**前提** (Given) 用户调整价格倍率滑块
**当** (When) `buyMultiplier`, `sellMultiplier` 变化
**那么** (Then) 触发二阶段重新计算

#### Scenario: transport 参数变化触发

**前提** (Given) 用户修改 transport 参数
**当** (When) `transportMinutes`, `transportShipCapacity` 变化
**那么** (Then) 触发二阶段重新计算

### Requirement: 二阶段更新 store

二阶段 SHALL 通过 emit 更新 store 的 autoInfrastructureModules。

#### Scenario: emit 更新事件

**前提** (Given) 二阶段计算完成
**当** (When) 得到新的 `autoInfrastructureModules`
**那么** (Then) emit `updateAutoInfrastructureModules` 事件
**并且** (And) store 接收并更新 `state.autoInfrastructureModules`

### Requirement: StationPlanningPanel 显示合并

面板 SHALL 显示合并后的 auto modules 列表。

#### Scenario: props 接收分离数据

**前提** (Given) StationPlanningPanel 组件
**当** (When) 检查 props
**那么** (Then) 接收：
- `autoIndustryModules: SavedModule[]`
- `autoInfrastructureModules: SavedModule[]`

#### Scenario: 合并显示

**前提** (Given) 面板渲染
**当** (When) 显示 "tier_industry" 分组
**那么** (Then) 显示合并列表：`autoIndustryModules + autoInfrastructureModules`

