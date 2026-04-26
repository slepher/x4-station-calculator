# user-save-binding-station Refactory 5

## Purpose

本文件定义 `StationPlanningPanel` 的下一轮收口方案。

当前问题不在于组件是否已经 props 化，而在于它对外暴露的编辑接口仍然过细，仍然沿用旧的 `stationStore` 思路：

- `add-module`
- `remove-module`
- `update-module-count`
- `reorder-modules`
- `apply-scale`
- `transfer-auto-module`

这会导致两个问题：

1. 入口 store 被迫暴露过细粒度的模块编辑命令
2. 面板内部的批量编辑、拖拽排序、搜索与高亮等 UI 逻辑继续泄漏到外部 contract

Refactory 5 的目标是把 `StationPlanningPanel` 收敛为 **方案 B：整包提交 `plannedModules`**。

---

## Current Problem

### R5-1. `StationPlanningPanel` 当前对外暴露的是 UI 交互事件，不是最小领域接口

当前面板对外的 emit 是：

- `updateSearchQuery`
- `addModule`
- `removeModule`
- `updateModuleCount`
- `reorderModules`
- `applyScale`
- `transferAutoModule`

这些事件里，只有“最终的 `plannedModules` 结果”属于领域状态。

其余大部分只是：

- 输入框局部状态
- 拖拽行为
- 批量缩放动作
- 自动模块转入动作

它们不应该继续作为入口 store 的公开接口。

### R5-2. 当前 contract 混入了不需要外传的中间数据

当前 `StationPlanningPanelProps` 中还包含：

- `searchQuery`
- `filteredModulesGrouped`
- `flashingModuleIds`
- `highlightedModuleIds`

这些数据都不是持久业务状态：

- `searchQuery` 是搜索框局部输入
- `filteredModulesGrouped` 是搜索派生结果
- `flashingModuleIds` / `highlightedModuleIds` 是纯动画表现态

它们不应该继续由入口组件或 store 提供。

### R5-3. `apply-scale` 不是 store 原语

`apply-scale` 的真实语义是：

- 基于当前 `plannedModules`
- 生成一份整体缩放后的新数组
- 再提交更新

所以它不是独立的领域原语，而是 panel 内部的一次批量变换。

`transfer-auto-module` 也是同类问题：

- 它只是把 `autoIndustryModules` 中某个模块合并进 `plannedModules`
- 结果仍然是一份新的 `plannedModules`

因此这两类动作都不应继续作为外部命令存在。

---

## Target

### G5-1. `StationPlanningPanel` 对外只提交 `plannedModules`

Refactory 5 完成后，`StationPlanningPanel` 对外只保留一个写接口：

- `updatePlannedModules(modules: SavedModule[])`

面板内部所有编辑动作都必须先在组件内生成新的 `plannedModules` 数组，再通过该接口整包提交。

### G5-2. 面板内部自行处理搜索与局部动画态

以下状态必须内聚在 `StationPlanningPanel` 或其内部专用 composable 中：

- `searchQuery`
- `filteredModulesGrouped`
- `highlightedModuleIds`
- `flashingModuleIds`

这些状态不得再出现在入口级 store API 中。

### G5-3. 外部只保留真正需要注入的业务数据

Refactory 5 完成后，`StationPlanningPanel` 仅保留以下外部输入：

- `plannedModules`
- `autoIndustryModules`
- `enforceDlcActivation`

其中：

- `plannedModules` 是真实规划结果
- `autoIndustryModules` 是外部计算得到的只读派生结果
- `enforceDlcActivation` 是显示规则开关

### G5-4. 新入口主路径停止依赖面板细粒度编辑事件

Refactory 5 完成后：

- `BlueprintProductionWorkbenchView` 不再向 `StationPlanningPanel` 传递细粒度模块编辑 handler
- `LiveProductionWorkbenchView` 不再向 `StationPlanningPanel` 传递细粒度模块编辑 handler
- 新入口主路径只处理 `updatePlannedModules`
- 新入口不得继续为了 `StationPlanningPanel` 保留细粒度中间适配层

---

## Contract

### C5-1. 新的 `StationPlanningPanelProps`

```ts
interface StationPlanningPanelProps {
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  enforceDlcActivation: boolean
}
```

### C5-2. 新的 `StationPlanningPanelEmits`

```ts
interface StationPlanningPanelEmits {
  updatePlannedModules: (modules: SavedModule[]) => void
}
```

### C5-3. 必须删除的旧接口

以下 props 必须从 contract 中删除：

- `searchQuery`
- `filteredModulesGrouped`
- `flashingModuleIds`
- `highlightedModuleIds`

以下 emits 必须从 contract 中删除：

- `updateSearchQuery`
- `addModule`
- `removeModule`
- `updateModuleCount`
- `reorderModules`
- `applyScale`
- `transferAutoModule`

---

## Implementation Rules

### I5-1. 所有面板交互都转成对 `plannedModules` 的纯数组变换

以下行为必须在面板内部完成数组变换：

- 添加模块
- 删除模块
- 修改模块数量
- 拖拽排序
- 批量缩放
- 将自动模块转入规划区

完成变换后统一调用：

- `emit('updatePlannedModules', nextModules)`

### I5-2. 搜索逻辑下沉到面板内部

面板内部必须直接维护：

- 搜索输入
- 搜索结果过滤

`StationModulePicker` 继续作为展示组件，但不再要求入口层提供 `searchQuery` 和 `filteredModulesGrouped`。

### I5-3. 高亮与数字闪烁保留在面板内部

当前高亮与数字闪烁已经主要在面板内部维护。

Refactory 5 要求：

- 删除这两个状态在 props contract 中的残留定义
- 不再由外部传递空数组占位

### I5-4. 入口 store 只接收整包模块结果

`BlueprintProductionWorkbenchView` 与 `LiveProductionWorkbenchView` 不再处理面板细粒度模块编辑事件。

两个入口只接收：

- `updatePlannedModules(nextModules)`

并将其路由到各自入口的持久化/命令层。

### I5-5. `apply-scale` 必须降级为 panel 内部批量变换

`apply-scale` 不再作为 store 命令或入口 handler 保留。

面板必须执行以下流程：

1. 读取当前 `plannedModules`
2. 生成缩放后的 `nextModules`
3. 调用 `updatePlannedModules(nextModules)`

`transfer-auto-module` 同样处理：

1. 读取当前 `plannedModules`
2. 将目标自动模块合并进新数组
3. 调用 `updatePlannedModules(nextModules)`

---

## Impact

### P5-1. 对入口组件的影响

两个入口 workbench view 将减少一整组 handler：

- `handleAddModule`
- `handleRemoveModule`
- `handleUpdateModuleCount`
- `handleReorderModules`
- `handleApplyScale`
- `handleTransferAutoModule`

入口层只保留一个模块更新入口。

### P5-2. 对 store 的影响

两个入口 store 不再需要暴露面向 panel 的细粒度编辑 API。

它们需要提供的最小能力变成：

- 读取 `plannedModules`
- 接收整包 `plannedModules` 更新

### P5-3. 对后续 Refactory 4 的影响

这项收口会直接降低 Refactory 4 的复杂度：

- 两个入口组件更容易摆脱 `useStationStore`
- station 编辑命令层更容易统一为入口级整包写入

---

## Success Criteria

Refactory 5 只有在以下条件全部满足后才算完成：

- `StationPlanningPanel` props 只剩 `plannedModules`、`autoIndustryModules`、`enforceDlcActivation`
- `StationPlanningPanel` emits 只剩 `updatePlannedModules`
- `searchQuery` 与模块筛选逻辑完全内聚到面板内部
- `highlightedModuleIds` 与 `flashingModuleIds` 不再出现在面板对外 contract 中
- `BlueprintProductionWorkbenchView` 不再实现 `handleAddModule`、`handleRemoveModule`、`handleUpdateModuleCount`、`handleReorderModules`、`handleApplyScale`、`handleTransferAutoModule`
- `LiveProductionWorkbenchView` 不再实现同类细粒度 handler
- 两个入口 store 对规划面板暴露的写接口收敛为整包 `plannedModules` 更新
- 新入口主路径不再为了规划面板细粒度交互依赖 `useStationStore`
- `StationPlanningPanel` 不再把 UI 事件模型泄漏到 store 边界

---

## Definition of Done

只有满足以下条件，才可认为 Refactory 5 完成：

- `StationPlanningPanel` 对外只保留 `updatePlannedModules`
- `searchQuery` / `filteredModulesGrouped` 不再由入口组件提供
- `flashingModuleIds` / `highlightedModuleIds` 已从 contract 中删除
- `apply-scale` 与 `transfer-auto-module` 已变成 panel 内部数组变换逻辑
- `BlueprintProductionWorkbenchView` / `LiveProductionWorkbenchView` 不再处理面板细粒度模块编辑事件
- 两个入口 store 只接收整包模块结果，而不再暴露面向 panel 的细粒度编辑接口
