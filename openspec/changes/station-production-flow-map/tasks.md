# Station Production Flow Map - 实现任务

## Tasks

- [x] Task 1: 创建 StationProductionFlowMap 类
- [x] Task 2: 实现 compute 方法
- [x] Task 3: 实现 computeAll 方法
- [x] Task 4: 实现 getter 方法
- [x] Task 5: 迁移 helper 函数
- [x] Task 6: 移除 StationStateMap flow 相关字段
- [x] Task 7: 更新 stationComputeService
- [x] Task 8: 更新 useBlueprintProductionStore 和 useLiveProductionStore
- [x] Task 9: 更新 UI 组件
- [x] Task 10: 构建验证

---

## Task 1: 创建 StationProductionFlowMap 类

**文件**：`src/store/state/StationProductionFlowMap.ts`

**内容**：
- 创建 `StationProductionFlowMap` 类
- 内部状态：
  - `flowsMap = reactive(new Map<string, WareProductionFlow[]>())`
  - `empireFlowsCache: WareProductionFlow[] = []`
  - `sectorFlowsCache: Map<string, WareProductionFlow[]> = new Map()`
- 方法签名：
  - `compute(stationId: string, deps: ComputeDeps): void`
  - `computeAll(empire: EmpirePlan, deps: ComputeDeps): void`
  - `getStationFlows(stationId: string): WareProductionFlow[]`
  - `getSectorFlows(sectorId: string): WareProductionFlow[]`
  - `getEmpireFlows(): WareProductionFlow[]`
  - `getGrouped(stationId: string): GroupedFlows`
  - `remove(stationId: string): void`

**依赖**：无

## Task 2: 实现 compute 方法

**文件**：`src/store/state/StationProductionFlowMap.ts`

**内容**：
- 定义 `ComputeDeps` 接口（复用 StationComputeDeps 或简化）
- compute() 实现：
  - 从 empireStore 或传入参数获取 StationPlan
  - 调用 `calculateProductionFlows` 计算 productionFlows
  - 存入 `flowsMap.set(stationId, productionFlows)`
  - 更新 empireFlowsCache 和 sectorFlowsCache

**依赖**：Task 1

## Task 3: 实现 computeAll 方法

**文件**：`src/store/state/StationProductionFlowMap.ts`

**内容**：
- computeAll() 实现：
  - 遍历 empire.stations
  - 每个 station 执行 compute(stationId, deps)
  - 调用 `mergeFlows()` 计算 empireFlowsCache
  - 调用 `groupBySector()` 计算 sectorFlowsCache

**依赖**：Task 2

## Task 4: 实现 getter 方法

**文件**：`src/store/state/StationProductionFlowMap.ts`

**内容**：
- getStationFlows(stationId): 返回 `flowsMap.get(stationId) || []`
- getSectorFlows(sectorId): 返回 `sectorFlowsCache.get(sectorId) || []`
- getEmpireFlows(): 返回 `empireFlowsCache`
- getGrouped(stationId): 
  - 获取 flows = getStationFlows(stationId)
  - 调用 `groupProductionFlows(flows)` 返回 GroupedFlows

**依赖**：Task 3

## Task 5: 迁移 helper 函数

**文件**：`src/store/state/StationProductionFlowMap.ts`

**内容**：
- 从 StationStateMap.ts 迁移以下函数：
  - `createEmptyGroupedFlows()`
  - `filterProductionFlowsByPriority()`
  - `convertProductionFlowToWareFlow()`
  - `groupProductionFlows()`
- 实现聚合 helper：
  - `mergeFlows(flowsArray: WareProductionFlow[][]): WareProductionFlow[]`
  - `groupBySector(flowsMap, empire): Map<string, WareProductionFlow[]>`

**依赖**：Task 1

## Task 6: 移除 StationStateMap flow 相关字段

**文件**：`src/store/state/StationStateMap.ts`

**内容**：
- StationState 移除 `productionFlows` 字段
- 移除方法：
  - `getProductionFlows()`
  - `getFilteredProductionFlows()`
  - `getGroupedFlows()`
  - `getFilteredGroupedFlows()`
- 移除 helper 函数（已迁移到 Task 5）
- recompute() 保持调用 calculateProductionFlows，但不存储 productionFlows
- recompute() 返回值仅用于 autoIndustryModules / warePriorityLevels / stationAnalysis

**依赖**：Task 5

## Task 7: 更新 stationComputeService

**文件**：`src/store/logic/stationComputeService.ts`

**内容**：
- 导入 `stationProductionFlowMap`
- 新增函数：
  - `computeAllProductionFlows(empire: EmpirePlan, deps: StationComputeDeps)` → 调用 `stationProductionFlowMap.computeAll`
  - `getEmpireFlows()` → `stationProductionFlowMap.getEmpireFlows()`
  - `getSectorFlows(sectorId)` → `stationProductionFlowMap.getSectorFlows(sectorId)`
- 修改现有函数：
  - `getProductionFlows(stationId)` → `stationProductionFlowMap.getStationFlows(stationId)`
  - `getGroupedFlows(stationId)` → `stationProductionFlowMap.getGrouped(stationId)`
  - `getFilteredGroupedFlows(stationId)` → 基于 stationProductionFlowMap 计算
  - `recomputeStation(stationId)` → 调用 `stationProductionFlowMap.compute(stationId, deps)`
- 移除对 StationStateMap.productionFlows 的直接访问

**依赖**：Task 1-4

## Task 8: 更新 useBlueprintProductionStore 和 useLiveProductionStore

**文件**：
- `src/store/useBlueprintProductionStore.ts`
- `src/store/useLiveProductionStore.ts`

**内容**：
- 通过 stationComputeService 获取 flow 数据（已封装在 Task 7）
- 新增 getter（如需要）：
  - `empireFlows` → `stationComputeService.getEmpireFlows()`
  - `sectorFlows(sectorId)` → `stationComputeService.getSectorFlows(sectorId)`
- loadEmpire / activateStation 时调用 `stationComputeService.computeAllProductionFlows`

**依赖**：Task 6, Task 7

## Task 9: 更新 UI 组件

**文件**：
- `src/components/empire/StationWareFlowsDashboard.vue`
- `src/components/empire/StationPlanningPanel.vue`
- 其他使用 productionFlows/groupedFlows 的组件

**内容**：
- 检查所有使用 StationStateMap.getProductionFlows 的组件
- 改为通过 store getter 获取（store 内部调用 stationProductionFlowMap）
- 确保 UI 显示正常

**依赖**：Task 8

## Task 10: 构建验证

**命令**：`npm run build`

**验证**：
- 无 TypeScript 编译错误
- 无运行时错误（开发环境）

**依赖**：Task 1-9

## 执行顺序

```
Task 1 → Task 5 (可并行)
  ↓
Task 2 → Task 3 → Task 4
  ↓
Task 6
  ↓
Task 7 → Task 8 (串行)
  ↓
Task 9 → Task 10
```