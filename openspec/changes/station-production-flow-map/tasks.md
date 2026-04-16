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

## Phase 6: 清理 StationStateMap（已完成）

- [x] Task 23: 删除 StationStateMap.ts
- [x] Task 24: 构建验证

### Task 23: 删除 StationStateMap.ts

**已完成**：
- BlueprintProductionStore: 所有 computed 直接从 activeStation 和 StationProductionFlowMap 获取数据
- LiveProductionStore: 同上，并保持 updateBindingStationPlan 同步
- 移除了 Store 层对 stationComputeService getter 函数的依赖
- StationStateMap.ts 文件已删除
- stationComputeService.ts 已删除（改为 stationSettings.ts）
- stationContextService.ts 已删除

**状态**：✅ 已完成

### Task 24: 构建验证

**状态**：✅ 构建已通过

---

## Phase 7: Auto Modules 分拆显示（已完成）

- [x] Task 31: autoModules 分拆为 industry/habitation/infrastructure 三组
- [x] Task 32: StationPlanningPanel 分三组显示 auto 模块
- [x] Task 33: 构建验证

### Task 31: autoModules 分拆

**改动**：
- `StationProductionFlowMap.compute` 输出 `autoIndustryModules`, `autoHabitationModules`, `autoInfrastructureModules`
- 分组逻辑基于 module.group

**状态**：✅ 已完成

### Task 32: UI 分三组显示

**改动**：
- StationPlanningPanel 显示三组：自动工业区、自动居住区、自动基础设施
- 各组独立展开/折叠

**状态**：✅ 已完成

---

## 执行顺序

```
Phase 1（StationProductionFlowMap 基础架构）✅：
  Task 1-10 已完成

Phase 2（两阶段计算架构）✅：
  Task 11-16 已完成

Phase 3（autoInfrastructure 移至 Stage 1）✅：
  Task 17-18 已完成

Phase 4（Vue 组件重构）✅：
  Task 19-22 已完成

Phase 5（Transit Hub 重构）✅：
  Task 25-30 已完成

Phase 6（清理 StationStateMap - 数据层）✅：
  Task 23-24 已完成
  StationStateMap.ts 已删除
  stationComputeService.ts / stationContextService.ts 已删除

Phase 7（Auto Modules 分拆 - 数据层）✅：
  Task 31-32 已完成
  StationProductionFlowMap.compute 输出分拆为 autoIndustry/autoHabitation/autoInfrastructure
```

---

## Phase 8: LiveProductionStore 重构（已完成）

- [x] Task R1: 新增 `stationContext` computed
- [x] Task R2: view 改用 `stationContext`
- [x] Task R3: 创建共享 helper 文件
- [x] Task R4: 拆散 `productionSourceAdapter.ts`
- [x] Task R5: 移除对外的 `bindingStation/archiveStation`

### Task R1: 新增 stationContext

**改动**：
- `useLiveProductionStore.ts` 新增 `stationContext` computed
- `useBlueprintProductionStore.ts` 新增 `stationContext: null` 兼容字段
- `stationContext` 聚合 hasBinding, hasArchive, stationCode, sectorName, sectorNameId, sectorResources, sectorSunlight, position, archiveModules, buildingModules

**状态**：✅ 已完成

### Task R2: view 改用 stationContext

**改动**：
- `LiveProductionWorkbenchView.vue` 移除直接读取 `bindingStation`/`archiveStation`
- toolbar 所需数据全部从 `stationContext` 获取
- `StationPlanningPanelWrapper.vue` 改为 props 驱动，接收 archiveModules/buildingModules/hasArchive

**状态**：✅ 已完成

### Task R3: 创建共享 helper 文件

**改动**：
- 创建 `src/store/logic/productionStationShared.ts`
- 包含：buildComputeDeps, buildActiveStationState, computeStationFlow, isWareOperable, isWareLocked, isPlannedWare, isAutoWare, getResolvedLevel, toggleWareLockForActiveStation, toggleWarePriorityForActiveStation, getFallbackModuleInfo, addModuleToStation, removeModuleFromStation, updateModuleCountInStation, updateStationSettingsDirect, getDefaultStationPlan

**状态**：✅ 已完成

### Task R4: 拆散 productionSourceAdapter.ts

**改动**：
- 创建 `src/store/logic/liveStationResolver.ts` - station 解析函数
- 创建 `src/store/logic/liveProductionFlows.ts` - flow source 组织函数
- 删除 `src/store/logic/productionSourceAdapter.ts`
- 更新引用方使用新文件

**状态**：✅ 已完成

### Task R5: 移除对外 bindingStation/archiveStation

**改动**：
- 从 `useLiveProductionStore` return 语句移除 `bindingStation` 和 `archiveStation`
- 保留为内部 computed，供 `stationContext` 使用

**状态**：✅ 已完成

---

## 完成状态总结

**数据层改动（本 change）**：
- StationProductionFlowMap 基础架构已建立
- 两阶段计算架构已实现
- StationStateMap.ts 已删除
- stationComputeService.ts / stationContextService.ts 已删除
- Auto Modules 计算逻辑分三组输出

**Store 重构（Phase 1-8）**：
- `useLiveProductionStore` 对外只暴露 `activeStation + stationContext`
- `useBlueprintProductionStore` 提供 `stationContext: null` 兼容
- `productionSourceAdapter.ts` 已删除，拆分为三个职责明确的文件
- 共享 helper 函数已提取到 `productionStationShared.ts`

**UI 层改动（归属 user-save-binding-station）**：
- StationPlanningPanel 分三组显示（见 user-save-binding-station T167-T171）
- Vue 组件接收原始数据 props + 内部 composable（见 user-save-binding-station T140-T146）