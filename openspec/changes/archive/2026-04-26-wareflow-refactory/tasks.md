# WareFlow Refactory - 实现任务

## Task 1: 定义 WareProductionFlow 类型

**文件**：`src/types/production-flow.ts`

**内容**：
- 创建 `WareProductionFlow` interface
- 包含核心标识：wareId, orderIndex, tier, transportType, unitVolume
- 包含价格数据：minPrice, price, maxPrice（来自 X4Ware，供二阶段资金计算）
- 包含产量字段：production, consumption, workforceConsumption, netRate
- 包含明细字段：contributions（ModuleFlowAtom 基础字段）
- 不包含体积流字段（二阶段基于产量 + unitVolume 计算）

**状态**：✅ 完成

## Task 1.1: 定义 ModuleFlowAtom 基础字段

**说明**：ModuleFlowAtom 类型保持不变，但一阶段仅填充基础字段。

**一阶段填充**：
- moduleId, count, type, amount, bonusPercent

**二阶段填充**：
- volumeFlow, valueFlow, transportFlow

## Task 2: 创建一阶段计算函数

**文件**：`src/store/logic/calculateProductionFlows.ts`

**内容**：
- 从 `moduleDiffCalculator.ts` 提取工业模块补完逻辑（不含仓储/泊位）
- 从 `analyzeWareFlow.ts` 提取产量计算逻辑
- 从 `waresMap` 预取静态数据到 `WareProductionFlow`：
  - unitVolume, tier, transportType
  - minPrice, price, maxPrice
- contributions 仅填充基础字段（moduleId, count, type, amount, bonusPercent）
- 输出 `{ autoIndustryModules, productionFlows }`
- autoIndustryModules 仅包含生产模块 + 居住舱

**依赖**：Task 1, Task 1.1

**状态**：✅ 完成

## Task 3: 创建二阶段计算函数

**文件**：`src/store/logic/calculateWareFlowDerived.ts`

**内容**：
- 输入：productionFlows + bufferHours + priceMultiplier + transport 参数
- **无需查询 waresMap**（所有静态数据已在 productionFlows 中）
- 基于产量 + unitVolume 计算体积流（productionVolume, consumptionVolume, netVolume）
- 基于价格数据 + multiplier 计算动态价格（unitPrice）和资金流（netValue）
- 基于 contributions 基础字段计算衍生字段（volumeFlow, valueFlow, transportFlow）
- 计算仓储需求 → 生成仓储模块（需查询 modulesMap）
- 计算泊位需求 → 生成泊位模块（需查询 modulesMap）
- 计算分组逻辑（rateGroups, volumeGroups）
- 计算仓储规划（totalOccupiedCount, totalOccupiedVolume）
- 计算运输（transportDemand）
- 输出 `{ groupedFlows, autoInfrastructureModules }`

**注意**：仓储/泊位模块生成仍需查询 modulesMap，但不依赖 waresMap。

**依赖**：Task 1, Task 2

**状态**：✅ 完成

## Task 4: 更新 StationState 接口

**文件**：`src/types/x4.ts`（实际在 `src/store/state/StationStateMap.ts`）

**内容**：
- StationState 新增 `productionFlows: WareProductionFlow[] | null`
- StationState 新增 `autoInfrastructureModules: SavedModule[]`
- StationState 移除 `groupedFlows: GroupedFlows | null`
- 新增 `warePriorityLevels: Record<string, number> | null`

**依赖**：Task 1

**状态**：✅ 完成

## Task 5: 更新 StationStateMap.recompute()

**文件**：`src/store/state/StationStateMap.ts`

**内容**：
- 导入 `calculateProductionFlows`
- recompute() 调用 calculateProductionFlows()
- state.autoIndustryModules 赋值（不含仓储/泊位）
- state.productionFlows 赋值
- state.warePriorityLevels 赋值
- state.autoInfrastructureModules 初始化为空数组
- 移除 state.groupedFlows 赋值
- 新增 `getProductionFlows()` 和 `getFilteredProductionFlows()` 方法
- `getFilteredGroupedFlows()` 改为基于 productionFlows + warePriorityLevels 动态计算（用于 Empire 聚合过渡）

**依赖**：Task 2, Task 4

**状态**：✅ 完成

## Task 6: 更新 useBlueprintProductionStore

**文件**：`src/store/useBlueprintProductionStore.ts`

**内容**：
- 新增 `autoInfrastructureModules` computed getter
- 新增 `productionFlows` computed getter
- 新增 `warePriorityLevels` computed getter
- 新增 `setAutoInfrastructureModules` action（接收二阶段 emit）
- 移除 `groupedFlows` computed（改为 Vue 层）- 暂保留用于过渡
- 调整导入添加新 getter

**依赖**：Task 4, Task 5

**状态**：✅ 完成

## Task 7: 创建 Vue composable

**文件**：`src/components/empire/composables/useWareFlowDerived.ts`

**内容**：
- 导入 `calculateWareFlowDerived`
- props：productionFlows, autoIndustryModules, settings（bufferHours, priceMultiplier, transport）
- **无需传入 waresMap**（productionFlows 已包含所有静态数据）
- 需传入 modulesMap（用于仓储/泊位模块生成）
- watch：bufferHours, priceMultiplier, transportMinutes, transportShipCapacity
- computed：groupedFlows, autoInfrastructureModules
- emit：updateAutoInfrastructureModules

**依赖**：Task 3

**状态**：✅ 完成

## Task 8: TransitHub 视图集成

**文件**：TransitHub 相关组件

**内容**：
- TransitHub 使用现有 StationState.settings 的滑动条参数：
  - buyMultiplier, sellMultiplier（价格）
  - primaryProductBufferHours, secondaryProductBufferHours（缓冲时间）
- 调用 `calculateWareFlowDerived` 计算完整 WareFlow
- 滑动条修改直接更新 StationState.settings（已持久化）

**依赖**：Task 6, Task 7

## Task 9: Empire 视图集成

**文件**：EmpireWareFlowsDashboard 相关组件

**内容**：
- Empire 视图滑动条状态（priceMultiplier）仅在组件内部管理（不持久化）
- 使用 `ref` 管理临时状态
- 聚合逻辑：
  1. 遍历各 station 的 productionFlows
  2. 对每个 station 调用 `calculateWareFlowDerived`（使用 Empire 全局 priceMultiplier）
  3. 调用 `analyzeEmpireWareFlow` 聚合完整的 WareFlow（含 netValue）

**依赖**：Task 5, Task 7

## Task 10: StationPlanningPanel 显示

**文件**：`src/components/empire/StationPlanningPanel.vue`

**内容**：
- props 新增 `autoInfrastructureModules`
- 合并显示：autoIndustryModules + autoInfrastructureModules

**依赖**：Task 6

## Task 11: 构建验证

**命令**：`npm run build`

**验证**：无编译错误

**状态**：✅ 完成（核心架构）

## 执行顺序

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7
  ↓
Task 8 (TransitHub) / Task 9 (Empire) → Task 10 → Task 11
```

## 当前进度

**核心架构 (Task 1-7)**：✅ 完成

**UI 集成 (Task 8-10)**：✅ 完成

**构建验证**：✅ 通过

### 完成的功能

1. **一阶段计算**：`calculateProductionFlows` → productionFlows + autoIndustryModules（不含仓储/泊位）
2. **二阶段计算**：`calculateWareFlowDerived` → groupedFlows + autoInfrastructureModules
3. **StationStateMap**：保存 productionFlows + warePriorityLevels
4. **stationComputeService**：新增 getDerivedGroupedFlows, getAutoInfrastructureModules
5. **useBlueprintProductionStore**：新增 productionFlows, autoInfrastructureModules computed
6. **useLiveProductionStore**：新增 autoInfrastructureModules computed
7. **useWareFlowDerived composable**：watch 二阶段参数，计算完整 WareFlow
8. **useEmpireWareFlowDerived composable**：管理 priceMultiplier，聚合 Empire WareFlow
9. **EmpireWareFlowsDashboard**：新增 priceMultiplier prop，在 economy 视图显示滑动条
10. **StationPlanningPanel**：合并显示 autoIndustryModules + autoInfrastructureModules
11. **LiveProductionWorkbenchView**：集成 Empire composable，使用 derived WareFlow