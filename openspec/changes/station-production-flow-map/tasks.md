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

### Task 23: 删除 StationStateMap.ts（需要更多迁移工作）

**目标**：所有依赖已迁移，删除旧状态管理

**当前状态**：StationStateMap 仍有 41 处调用，需要逐步迁移功能：
- `plannedModules` → `activeStation.modules`
- `lockedWares` → `activeStation.lockedWares`
- `warePriority` → `activeStation.warePriority`
- `settings` → `activeStation.settings`
- `autoIndustryModules` → 从 `resolvedModules` 过滤
- `warePriorityLevels` → 从 `warePriority` 计算
- `actualWorkforce/currentEfficiency` → 实时计算
- `stationAnalysis` → 实时计算

**状态**：⏳ 需要额外 Phase 处理

---

### Task 24: 构建验证（当前阶段）

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