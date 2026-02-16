## 1. Store 层实现

- [x] 1.1 在 `useLogicFlowStore.ts` 中添加 `previewNodes` 状态
- [x] 1.2 实现 `handleHover(targetGroupId)` 方法
- [x] 1.3 实现 `handleMoveOut(targetGroupId)` 方法
- [x] 1.4 实现 `handleDrop(targetGroupId)` 方法
- [x] 1.5 修改 `stopDragging()` 方法，清除预览节点
- [x] 1.6 实现 `getNodesWithPreview(groupId)` 方法
- [x] 1.7 在 store 返回中导出新状态和方法

## 2. 组件层实现

- [x] 2.1 在 `LogicFlowPlanningZone.vue` 中移除所有 `removeChild` 操作
- [x] 2.2 修改 `handleDragEnter` 调用 `logicFlow.handleHover()`
- [x] 2.3 修改 `handleDragLeave` 调用 `logicFlow.handleMoveOut()`
- [x] 2.4 修改 `handleAddToExistingGroup` 调用 `logicFlow.handleDrop()`
- [x] 2.5 修改 `handleAddFromDrop` 调用 `logicFlow.handleDrop('new')`
- [x] 2.6 移除 `dummyList` 相关代码（保留，用于 draggable 组件）

## 3. 预览节点显示

- [x] 3.1 在紧凑模式中使用 `getNodesWithPreview` 显示预览节点
- [x] 3.2 添加预览节点样式（`animate-pulse`, `border-dashed`）

## 4. 候选区优化

- [x] 4.1 在 `LogicFlowCandidateZone.vue` 中优化 `:clone` 配置
- [x] 4.2 确保 `:clone` 返回干净副本，添加 `instanceId`

## 5. 清理工作

- [x] 5.1 移除所有 `setTimeout` 相关代码（拖拽相关）
- [x] 5.2 移除所有手动 DOM 操作代码（拖拽相关）
- [x] 5.3 确保代码符合 Vue 响应式单向数据流原则
