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
- [x] Task 11: WareProductionFlow 移除价格字段，新增 volume 字段
- [x] Task 12: calculateProductionFlows 计算 volume 数据
- [x] Task 13: 价格从 waresMap 获取（Stage 2）
- [x] Task 14: StationFlowCache 增加 resolvedModules
- [x] Task 15: settings 不缓存，从 activeStation.settings 获取
- [x] Task 16: 构建验证（Phase 2）
- [x] Task 17: autoInfrastructureModules 移至 Stage 1
- [x] Task 18: 移除 calculateWareFlowDerived 中的 autoInfrastructure 计算
- [x] Task 19: 创建 useWareFlowGrouping composable
- [x] Task 20: StationWareFlowsDashboard 重构
- [x] Task 21: Presenter 层改动
- [x] Task 22: Contract + Store 层改动
- [x] Task 25: 创建 useTransitHubFlowGrouping composable
- [x] Task 26: TransitHubCenterDashboard 改用原始数据 props
- [x] Task 27: empireFlowFacade 只提供原始数据
- [x] Task 28: transitHubViewModel 移除分组逻辑（保留供测试使用）
- [x] Task 29: Presenter 层改动
- [x] Task 30: 构建验证
- [ ] Task 23: 删除 StationStateMap.ts
- [ ] Task 24: 构建验证

---

## Phase 1: StationProductionFlowMap 基础架构（已完成）

Task 1-10 已完成，建立了 StationProductionFlowMap 作为 ProductionFlow 计算的独立层。

## Phase 2: 两阶段计算架构（已完成）

Task 11-16 已完成，实现了 WareProductionFlow volume 计算和 Stage 1 缓存。

## Phase 3: autoInfrastructureModules 移至 Stage 1（已完成）

Task 17-18 已完成，autoInfrastructureModules 现在在 Stage 1 计算，存入 resolvedModules。

---

## Phase 4: Vue 组件重构（已完成）

Task 19-22 已完成，实现了 Vue 组件接收原始数据 props + 内部 composable 计算派生数据。

---

## Phase 5: Transit Hub 重构（已完成）

Task 25-30 已完成，Transit Hub 界面现在接收原始数据 props + 内部 composable 计算派生数据。

### Task 25: 创建 useTransitHubFlowGrouping composable

**目标**：提供 Transit Hub 专用分组+价格计算函数

**改动**：
- 创建 `src/components/empire/composables/useTransitHubFlowGrouping.ts`
- 合并本 sector flows + link flows（跨 sector 运输）
- 返回 `TransitHubGroupedFlows`（含价格、分组、storage/transport 计算）

**状态**：⏳ 待实现

---

### Task 26: TransitHubCenterDashboard 改用原始数据 props

**目标**：组件接收原始数据 props，内部用 composable 计算 groupedFlows

**改动**：
- 删除 `groupedFlows`、`storageFlows` props
- 新增 `productionFlows`、`solverOutput` props
- 内部用 `useTransitHubFlowGrouping` 计算 `groupedFlows` 和 `storageFlows`
- `waresMap` 直接访问 `gameDataStore`

**状态**：⏳ 待实现

---

### Task 27: empireFlowFacade 只提供原始数据

**目标**：Facade 只提供原始数据，不调用 buildTransitHubViewModel

**改动**：
- 新增 `getSectorFlows(sectorId)` 返回 `WareProductionFlow[]`
- 新增 `getSectorSolverOutput(sectorId)` 返回 `SolverOutput`
- 删除或简化 `getTransitHubViewModel`

**状态**：⏳ 待实现

---

### Task 28: transitHubViewModel 移除分组逻辑

**目标**：移除 Store 层分组逻辑，只保留 link flows 合并

**改动**：
- `mergeLinkFlowsIntoGroupedFlows` 移到 Vue composable
- `buildTransitHubStorageFlows` 移到 Vue composable
- `buildTransitHubStorageModulePlans` 移到 Vue composable
- 可选择完全删除此文件，逻辑迁移到 composable

**状态**：⏳ 待实现

---

### Task 29: Presenter 层改动

**目标**：Presenter 只提供原始数据，不调用 buildTransitHubViewModel

**改动**：
- 删除 `transitHubModel` 计算
- 新增 `sectorFlows`、`solverOutput` 原始数据获取
- 从 `empireFlowFacade.getSectorFlows()` 和 `getSectorSolverOutput()` 获取

**状态**：⏳ 待实现

---

### Task 30: 构建验证

**目标**：确保所有改动后构建通过

**状态**：✅ 构建已通过，E2E 测试已通过

---

## Phase 6: 清理 StationStateMap（待实现）

Task 23-24 待实现，删除 StationStateMap.ts（41处调用需迁移）。

### Task 19: 创建 useWareFlowGrouping composable

**目标**：提供分组+价格计算函数，不依赖模块列表

**改动**：
- 创建 `src/components/empire/composables/useWareFlowGrouping.ts`
- `computeGroupedFlows(props)` - 接收 productionFlows + waresMap + settings + warePriorityLevels
- 返回 `groupedFlows`（含价格、分组、transportDemand、volume 计算）

**状态**：⏳ 待实现

---

### Task 20: StationWareFlowsDashboard 重构

**目标**：组件接收原始数据 props，内部用 composable 计算 groupedFlows

**改动**：
- 删除 `groupedFlows`、`wares`、`modulesMap` props
- 新增 `productionFlows`、`warePriorityLevels` props
- 内部用 `useWareFlowGrouping` 计算 `groupedFlows`
- `waresMap` 直接访问 `gameDataStore`

**状态**：⏳ 待实现

---

### Task 21: Presenter 层改动

**目标**：Presenter 只提供原始数据，不计算 groupedFlows

**改动**：
- 删除 `groupedFlows` 计算
- 新增 `productionFlows`、`warePriorityLevels` 原始数据获取
- 从 `stationProductionFlowMap.getProductionFlows(stationId)` 获取

**状态**：⏳ 待实现

---

### Task 22: Contract + Store 层改动

**目标**：移除派生计算方法，只提供原始数据

**改动**：
- 删除 `getGroupedFlows()`、`getStationAnalysis()`、`getCurrentEfficiency()`、`getActualWorkforce()`
- 新增 `getProductionFlows()`、`getResolvedModules()`、`getWarePriorityLevels()`

**状态**：⏳ 待实现

---

### Task 23: 删除 StationStateMap.ts - BlueprintStore 和 LiveStore 已重构

**已完成**：
- BlueprintProductionStore: 所有 computed 直接从 activeStation 和 StationProductionFlowMap 获取数据
- LiveProductionStore: 同上，并保持 updateBindingStationPlan 同步
- 移除了 Store 层对 stationComputeService getter 函数的依赖

**下一步**：
- 清理 stationComputeService.ts 中不再使用的函数
- 删除 StationStateMap.ts（仅测试和 empireFlowFacade 可能仍需要）

**状态**：✅ Store 层重构完成

---

### Task 24: 构建验证

**状态**：✅ 构建已通过

---

## 执行顺序

```
Phase 3（autoInfrastructure 移至 Stage 1）✅：
  Task 17 → StationProductionFlowMap.compute 增加 autoInfrastructure
  Task 18 → 清理 calculateWareFlowDerived，移除 autoInfrastructure 计算
  
Phase 4（Vue 组件重构）✅：
  Task 19 → 创建 useWareFlowGrouping composable
  Task 20 → StationWareFlowsDashboard 改用原始数据 props + 内部 composable
  Task 21 → Presenter 改动（提供 productionFlows + warePriorityLevels）
  Task 22 → Contract + Store 改动（移除派生计算方法）

Phase 5（清理 StationStateMap）⏳：
  Task 23 → 需要更多迁移工作（41 处调用点）
  Task 24 → 构建验证 ✅ 已通过
```