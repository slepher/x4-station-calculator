# user-save-binding-station Station Store Refactory

## Purpose

本文件定义 `useStationStore` 废弃后的重构落点。

目标不是把 `useStationStore` 改小，而是把其中仍有价值的能力强制迁移到正确位置：

- blueprint 入口能力迁移到 `useBlueprintProductionStore`
- live 入口能力迁移到 `useLiveProductionStore`
- 纯计算与纯命令逻辑迁移到共享模块

本文件必须作为接手 agent 的直接施工依据。  
所有措辞均为强制措辞，不留自由解释空间。

---

## Refactor Goal

Refactory 完成后，production 相关能力必须满足以下结构：

```text
BlueprintProductionWorkbenchView -> useBlueprintProductionStore
LiveProductionWorkbenchView      -> useLiveProductionStore

共享模块：
- stationComputeService
- stationCommands
- stationImporter
- StationStateMap
- station query / mapper / helper
```

禁止出现以下结构：

- `BlueprintProductionWorkbenchView -> useStationStore -> useBlueprintProductionStore`
- `LiveProductionWorkbenchView -> useStationStore -> useLiveProductionStore`
- 新建任何替代 `useStationStore` 的 source-aware facade

---

## Mandatory Placement

### SSR-1. 必须迁入 `useBlueprintProductionStore` 的职责

以下职责必须由 `useBlueprintProductionStore` 直接提供：

- 当前 blueprint 活动站点的 `plannedModules`
- 当前 blueprint 活动站点的 `settings`
- 当前 blueprint 活动站点的 `lockedWares`
- 当前 blueprint 活动站点的 `warePriority`
- 当前 blueprint 活动站点的 `autoIndustryModules`
- 当前 blueprint 活动站点的 `groupedFlows`
- 当前 blueprint 活动站点的 `stationAnalysis`
- 当前 blueprint 活动站点的 `currentEfficiency`
- 当前 blueprint 活动站点的 `actualWorkforce`
- 当前 blueprint 活动站点的 `buildPriceMultiplier`
- `updatePlannedModules`
- `updateStationSettings`
- `toggleWareLock`
- `toggleWarePriority`
- `getResolvedLevel`
- `isWareLocked`
- `isWareOperable`

这些能力必须以 blueprint 自己的 `activeStationId` 为上下文。  
禁止再经由共享桥接层路由。

### SSR-2. 必须迁入 `useLiveProductionStore` 的职责

以下职责必须由 `useLiveProductionStore` 直接提供：

- 当前 live 活动站点的 `plannedModules`
- 当前 live 活动站点的 `settings`
- 当前 live 活动站点的 `lockedWares`
- 当前 live 活动站点的 `warePriority`
- 当前 live 活动站点的 `autoIndustryModules`
- 当前 live 活动站点的 `groupedFlows`
- 当前 live 活动站点的 `stationAnalysis`
- 当前 live 活动站点的 `currentEfficiency`
- 当前 live 活动站点的 `actualWorkforce`
- 当前 live 活动站点的 `buildPriceMultiplier`
- `updatePlannedModules`
- `updateStationSettings`
- `toggleWareLock`
- `toggleWarePriority`
- `getResolvedLevel`
- `isWareLocked`
- `isWareOperable`

这些能力必须以 live 自己的 `activeStationId` 为上下文。  
禁止再通过 `productionSource` 判断。

### SSR-3. 必须抽为共享模块的职责

以下内容不得复制到两个 production store 中，必须保留为共享模块：

- `buildStationComputeDeps`
- `syncPersistedToStateMap`
- `recomputeStation`
- `getStationState`
- `ensureStationState`
- `patchStationState`
- `getGroupedFlows`
- `getSettings`
- `deepClone`
- `stationCommands`
- `stationImporter`
- `generateFilteredModulesGrouped`

两个 production store 必须调用同一份共享实现。  
禁止复制粘贴一份 blueprint 版本和一份 live 版本。

### SSR-4. 必须迁到独立模块的职责

以下内容不得迁入两个 production store，必须迁到独立模块：

- `savedPlans`
- `loadData`
- `saveCurrentPlan`
- `loadPlan`
- `mergePlan`
- `deletePlan`

这些职责必须由独立的 station plan library 承担。  
禁止继续挂在任一 production store 上。

---

## Mandatory Refactor Sequence

### Phase S1. 建立两个 production store 的 station compute 门面

必须先在 `useBlueprintProductionStore` 和 `useLiveProductionStore` 中建立以下内部结构：

1. `getComputeDeps`
2. `ensureActiveStationState`
3. `syncPersistedActiveStationToStateMap`
4. `syncStateMapBackToPersistedActiveStation`
5. `recomputeActiveStation`

这一步完成后，两个 production store 必须能够独立完成：

- persisted station -> state-map
- recompute
- state-map -> persisted station

在 S1 完成前，禁止删除 `useStationStore` 的桥接实现。

### Phase S2. 接管 planning 主路径

必须按以下顺序执行：

1. 在两个 production store 中实现 `updatePlannedModules`
2. 让 `BlueprintProductionWorkbenchView` 改为直接调用 blueprint store 的 `updatePlannedModules`
3. 让 `LiveProductionWorkbenchView` 改为直接调用 live store 的 `updatePlannedModules`
4. 删除两个入口 view 对 `stationStore.plannedModules` 的读取
5. 删除两个入口 view 对 `stationStore.autoIndustryModules` 的读取

完成 S2 后，`StationPlanningPanel` 主路径不得再经过 `useStationStore`。

### Phase S3. 接管 station settings / flows / dashboard 主路径

必须按以下顺序执行：

1. 两个 production store 直接暴露 `settings`
2. 两个 production store 直接暴露 `groupedFlows`
3. 两个 production store 直接暴露 `stationAnalysis`
4. 两个 production store 直接暴露 `currentEfficiency`
5. 两个 production store 直接暴露 `actualWorkforce`
6. 两个 production store 直接暴露 `buildPriceMultiplier`
7. 两个入口 view 改为只读取各自 production store

完成 S3 后，toolbar / ware-flows / dashboard 主路径不得再经过 `useStationStore`。

### Phase S4. 接管 ware lock / priority / gap 辅助逻辑

必须按以下顺序执行：

1. 两个 production store 直接暴露 `lockedWares`
2. 两个 production store 直接暴露 `warePriority`
3. 两个 production store 直接暴露 `toggleWareLock`
4. 两个 production store 直接暴露 `toggleWarePriority`
5. 两个 production store 直接暴露 `getResolvedLevel`
6. `StationWareFlow` / `StationWareFlowGroup` 改为接收 props 或读取入口注入值

完成 S4 后，ware-flow 子树不得再直接导入 `useStationStore`。

### Phase S5. 切断旧 plan library

必须按以下顺序执行：

1. 建立独立 station plan library
2. 将 `LoadPlanModal` 接到新 plan library
3. 删除 `useStationStore.savedPlans` 相关实现

### Phase S6. 删除剩余兼容引用

必须按以下顺序执行：

1. 删除 `MainWorkbench` 对 `useStationStore.isReady` 的依赖
2. 删除 `App.vue` 对 window `stationStore` 的测试暴露，或改为暴露新入口 store
3. 删除 `ProductionWorkbenchView` 的残留 `useStationStore` 依赖
4. 删除 `useStationStore.ts`

---

## File-Level Migration Map

### Map-1. 入口视图必须如何改

`BlueprintProductionWorkbenchView.vue` 必须：

- 只导入 `useBlueprintProductionStore`
- 不导入 `useStationStore`
- 不再调用 `stationStore.updateSetting`
- 不再读取 `stationStore.plannedModules`
- 不再读取 `stationStore.groupedFlows`
- 不再读取 `stationStore.stationAnalysis`

`LiveProductionWorkbenchView.vue` 必须：

- 只导入 `useLiveProductionStore`
- 不导入 `useStationStore`
- 不再调用 `stationStore.updateSetting`
- 不再读取 `stationStore.plannedModules`
- 不再读取 `stationStore.groupedFlows`
- 不再读取 `stationStore.stationAnalysis`

### Map-2. 子组件必须如何改

`StationWareFlow.vue` 必须：

- 删除 `useStationStore`
- 改为通过 props 接收：
  - `nonOperable`
  - `isPlanned`
  - `priorityLevel`
  - `transportMinutes`
  - 模块显示信息

`StationWareFlowGroup.vue` 必须：

- 删除 `useStationStore`
- 改为通过 props 接收：
  - `transportMinutes`
  - `locked` / `priorityLevel`
  - 变更事件回调

`LoadPlanModal.vue` 必须：

- 删除 `useStationStore`
- 模块翻译和模块元数据改从 `useGameDataStore` 或专用只读 helper 获取

### Map-3. 共享模块必须如何补齐

必须新增或补齐以下共享模块能力：

- station active-context helper
- station state-map sync helper
- station settings update helper
- ware priority resolve helper
- ware operability helper

这些 helper 必须是纯函数或无 source-aware 路由的共享函数。  
禁止再形成新的超级 facade。

---

## Hard Constraints

以下行为被明确禁止：

- 在两个 production store 中复制 `useStationStore` 全量实现
- 保留 `productionSource` 作为两个 production store 的内部判断
- 新建 `useProductionStationStore`、`useStationFacadeStore` 或任何等价桥接层
- 让 `StationPlanningPanel` 回退到细粒度编辑事件
- 让 `StationWareFlow` / `StationWareFlowGroup` 继续直接读取任一大 store

---

## Success Criteria

只有在以下条件全部满足后，才允许标记“station-store refactory 完成”：

- `BlueprintProductionWorkbenchView` 只依赖 `useBlueprintProductionStore`
- `LiveProductionWorkbenchView` 只依赖 `useLiveProductionStore`
- `StationPlanningPanel` 主路径不再经过 `useStationStore`
- `StationWareFlow` 与 `StationWareFlowGroup` 不再导入 `useStationStore`
- `LoadPlanModal` 不再导入 `useStationStore`
- station 计算逻辑未在 blueprint/live 两份 store 中重复实现
- 共享纯逻辑已抽到独立模块
- `useStationStore.ts` 已删除

未满足以上任一条件，不得标记完成。
