# user-save-binding-station Station Store Remove

## Purpose

本文件定义 `useStationStore` 的删除顺序与删除边界。

本文件只回答三个问题：

1. `useStationStore` 中哪些职责必须删除
2. 删除前必须完成哪些前置迁移
3. 删除顺序必须如何执行

本文件不是重构设计文档。  
重构落点与迁移归属由 `station-store-refactory.md` 定义。

---

## Removal Goal

`useStationStore` 必须从 production 主路径中退场。

最终状态必须满足：

- `BlueprintProductionWorkbenchView` 不再导入 `useStationStore`
- `LiveProductionWorkbenchView` 不再导入 `useStationStore`
- `ProductionWorkbenchView` 不再作为兼容入口保留
- `StationWareFlow` 不再导入 `useStationStore`
- `StationWareFlowGroup` 不再导入 `useStationStore`
- `MainWorkbench` 不再依赖 `useStationStore.isReady`
- `useStationStore` 不再承担 blueprint/live 的活动站点桥接

只有在以上条件全部满足后，才允许删除 `useStationStore.ts` 文件。

---

## Deletion Boundary

### DSR-1. 必须删除的旧桥接职责

以下职责不得继续保留在 `useStationStore`：

- `productionSource`
- `activeStation`
- `getActiveContext`
- `syncStateFromActiveStation`
- `syncActiveStationFromState`
- `syncBindingStationPlanFromState`
- `getActiveStationId`
- `applyAndRecompute`
- 基于 `activeView` 的 blueprint/live 路由

这些职责属于跨入口桥接层。  
Refactory 完成后，这一层必须消失，不得保留兼容包装。

### DSR-2. 必须删除的旧细粒度规划接口

以下接口不得继续作为 production 主路径 API 保留：

- `addModule`
- `updateModuleId`
- `updateModuleCount`
- `removeModule`
- `removeModuleById`
- `transferModuleFromAutoIndustry`
- `clearAll`

`StationPlanningPanel` 已改为整包提交 `plannedModules`。  
继续保留这组接口只会让新入口继续依赖旧桥接层。

### DSR-3. 必须迁出后删除的旧 plan library 职责

以下状态与函数不得继续保留在 `useStationStore`：

- `savedPlans`
- `loadData`
- `saveCurrentPlan`
- `loadPlan`
- `mergePlan`
- `deletePlan`

这些职责必须迁移到独立 plan library 模块后，再从 `useStationStore` 删除。

### DSR-4. 必须从子组件移除的直接引用

以下组件不得继续直接读取 `useStationStore`：

- `BlueprintProductionWorkbenchView.vue`
- `LiveProductionWorkbenchView.vue`
- `ProductionWorkbenchView.vue`
- `StationWareFlow.vue`
- `StationWareFlowGroup.vue`
- `MainWorkbench.vue`

`LoadPlanModal.vue` 不得继续从 `useStationStore` 读取模块显示信息；模块元数据必须改从 `useGameDataStore` 或专用只读模块获取。

---

## Removal Order

### Phase R1. 先切断主路径引用

必须按以下顺序执行：

1. 删除 `BlueprintProductionWorkbenchView.vue` 对 `useStationStore` 的所有引用
2. 删除 `LiveProductionWorkbenchView.vue` 对 `useStationStore` 的所有引用
3. 删除 `ProductionWorkbenchView.vue` 的剩余主路径引用
4. 删除 `StationWareFlow.vue` 对 `useStationStore` 的引用
5. 删除 `StationWareFlowGroup.vue` 对 `useStationStore` 的引用
6. 删除 `MainWorkbench.vue` 对 `useStationStore.isReady` 的引用

在 Phase R1 完成前，禁止修改 `useStationStore.ts` 删除导出。  
必须先移除调用方，再删除 store 内部实现。

### Phase R2. 再切断旧功能引用

必须按以下顺序执行：

1. 将 `LoadPlanModal.vue` 从 `useStationStore.modules` 切换到只读模块元数据源
2. 将 plan library UI 从 `useStationStore.savedPlans` 切换到独立 plan library
3. 删除 `useStationStore` 中旧 plan library 的导出

### Phase R3. 再删除细粒度规划接口

必须按以下顺序执行：

1. 确认 `StationPlanningPanel` 不再通过任何间接层调用细粒度模块编辑接口
2. 确认两个入口 view 不再调用 `addModule/removeModule/updateModuleCount`
3. 删除旧细粒度规划接口实现
4. 删除对应的返回导出

### Phase R4. 最后删除桥接骨架

必须按以下顺序执行：

1. 删除 `productionSource` / `activeStation` 路由
2. 删除 `getActiveContext` / `applyAndRecompute` / 同步函数
3. 删除 `commandContext` 中跨入口分发逻辑
4. 删除整个 `useStationStore.ts`

禁止跳过前置阶段直接删除整个文件。

---

## Non-Removable Shared Logic

以下内容不得随 `useStationStore` 一起删除：

- `stationComputeService`
- `stationCommands`
- `stationImporter`
- `StationStateMap`
- `generateFilteredModulesGrouped`
- 与 station 计算有关的纯函数工具

这些内容不是 `useStationStore` 的私有实现。  
它们必须作为共享模块保留，并由两个 production store 直接调用。

---

## Immediate Delete Candidates

在满足调用方迁移完成后，以下内容应作为第一批删除对象：

- `addModule`
- `updateModuleId`
- `updateModuleCount`
- `removeModule`
- `removeModuleById`
- `transferModuleFromAutoIndustry`
- `clearAll`
- `searchQuery`
- `filteredModulesGrouped`

这些内容已经不再符合新的 planning panel contract。

---

## Success Criteria

只有在以下条件全部满足后，才允许标记“station-store remove 完成”：

- production 主路径中不存在 `useStationStore()` 调用
- `BlueprintProductionWorkbenchView.vue` 不再导入 `useStationStore`
- `LiveProductionWorkbenchView.vue` 不再导入 `useStationStore`
- `StationWareFlow.vue` 不再导入 `useStationStore`
- `StationWareFlowGroup.vue` 不再导入 `useStationStore`
- `LoadPlanModal.vue` 不再导入 `useStationStore`
- `MainWorkbench.vue` 不再依赖 `useStationStore.isReady`
- `useStationStore.ts` 文件已删除
- 不存在新的兼容 facade 重新承接旧职责

未满足以上任一条件，不得宣称 `useStationStore` 已废弃。
