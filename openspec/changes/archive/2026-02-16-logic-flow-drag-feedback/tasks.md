# Tasks

## 1. Cleanup & Refactor
- [ ] 移除 `DraggingResourcePreview.vue` 组件文件。
- [ ] 在 `LogicFlowCandidateZone.vue` 中移除对 preview 组件的引用。

## 2. Store Logic Update
- [ ] 在 `useLogicFlowStore.ts` 中实现 `getSortedGroupT0Resources(nodes)` 方法。
  - [ ] 逻辑：`nodes.flatMap(node => getT0(node)).unique()`。
  - [ ] 确保与现有的 `calculateRequiredT0Wares` 兼容或复用。

## 3. Candidate Zone UI
- [ ] 修改 `LogicFlowCandidateZone.vue` 的 `.ware-card` 模板。
- [ ] 添加资源显示行：使用 `text-xs text-gray-400`，显示 i18n 短名。

## 4. Planning Zone Logic
- [ ] 更新 `LogicFlowPlanningZone.vue` 中的 `getFormattedResources`。
  - [ ] 使用新的 `getSortedGroupT0Resources`。
  - [ ] 确保在拖拽悬停（Phantom Node）时，将幻影节点插入到正确的排序位置后再计算资源，以体现“新产生的需求靠后”或“跟随节点位置”。

## 5. Verification
- [ ] 运行 E2E 测试，验证候选区显示。
- [ ] 运行 E2E 测试，验证产线组标题栏的资源排序逻辑（Dependency-Follow）。

## 6. Lock Logic & Candidate Zone (New)
- [x] **Store**: 修改 `isWareInAnyGroup` 忽略锁定节点。
- [x] **Store**: 修改 `expandUpstream` 遇到锁定节点停止递归。
- [x] **UI**: 候选区 T0 资源隐藏 "+" 按钮（Energy Cells 除外）。
- [x] **UI**: 修复 "+" 菜单点击后不关闭的问题。

## 7. Drag-to-Unlock & Visual Distinction (Added)
- [x] **Store**: 实现 `unlockAndExpand(groupId, wareId)` 动作。
- [x] **UI**: 在 `LogicFlowNode.vue` 中实现 Manual/Auto 节点的视觉区分（虚实线）。
- [x] **UI Cleanup**: 移除 `FlowNode.vue` 中的手动 `expand` 按钮。
- [x] **UI**: 在 `LogicFlowPlanningZone.vue` 中实现 `locked`/`unlock` 拖拽反馈标签。
- [x] **UI**: 更新 `nodesWithPreview` 逻辑，在拖拽到 Locked 节点上方时显示 Phantom Node。

## 8. Node Permissions & Transitions (New)
- [x] **Store**: 实现 `isNodeDepended(groupId, wareId)` 用于判断节点是否为依赖项.
- [x] **Store**: 实现 `downgradeNode(groupId, nodeId)` (Manual -> Auto).
- [x] **Store**: 实现 `convertToLockedAuto(groupId, nodeId)` (Manual -> Auto -> Locked).
- [x] **UI**: 更新 `FlowNode.vue` 的按钮显示逻辑。
  - [x] 删除按钮仅在 `source === 'manual'` 时显示。
  - [x] 锁定按钮仅在节点有下游依赖时显示。
- [x] **UI**: 更新 `FlowNode.vue` 的点击事件。
  - [x] 删除点击：调用 `downgradeNode` 或 `removeNode`。
  - [x] 锁定点击：调用 `convertToLockedAuto` 或 `toggleLock`。

## 9. Auto Node Promotion (New)
- [x] **Store**: 实现 `promoteNode(groupId, wareId)` 动作。
- [x] **UI**: 在 `LogicFlowPlanningZone.vue` 中实现 `auto`/`manual` 拖拽反馈标签。
- [x] **UI**: 更新 `nodesWithPreview` 逻辑，在拖拽到 Auto 节点上方时显示 Phantom Node。
- [x] **UI**: 更新 `isDuplicate` 逻辑，排除 `source === 'auto'` 的情况。
- [x] **UI**: 更新 `handleAddToExistingGroup` 处理 Auto 节点的转正逻辑。

## 10. T0 Resource Derivation (New)
- [x] **Store**: 在 `useGameDataStore.ts` 的 `precomputeCandidateWares` 中实现完整的产业链回溯逻辑。
  - [x] 移除硬编码的 T0 种子添加逻辑。
  - [x] 确保 `trace` 递归能够正确收集到所有底层 T0 资源。
- [x] **UI**: 修改 `LogicFlowCandidateZone.vue` 的 `filteredWares` 过滤逻辑。
  - [x] 移除 `allowedGroups` 和 `w.tier === 0` 的硬编码判断。
  - [x] 完全依赖 `currentWareSet.has(w.id)`。
- [x] **UI**: 验证 N 矿和原始废料是否已从候选区消失。
- [x] **UI**: 验证 Terran 种族下是否正确隐藏了非地球人产业链的资源。
- [x] **Store**: 修复地球人农业产线回溯 Nitrogen (氮) 缺失的问题 (修正 `trace` 函数中的 `findModuleForWare` 种族优先级)。
- [x] **Store**: 优化 `trace` 逻辑，停止对 T0 资源的生产模块搜索，并增加 `modulesByOutputMap` 索引提升性能。
