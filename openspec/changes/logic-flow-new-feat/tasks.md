## 1. 类型定义与数据模型

- [x] 1.1 在 `types/x4.ts` 中为 `ProductionLineGroup` 接口添加 `customName?: string` 可选字段
- [x] 1.2 在 `useLogicFlowStore.ts` 中添加 `hoveredNodeId: string | null` 状态

## 2. 产线组标题编辑功能

- [x] 2.1 在 `ProductionLineGroup.vue` 中添加标题编辑模式状态（`isEditingTitle`, `editingValue`, `lastValidTitle`）
- [x] 2.2 实现标题点击进入编辑模式的逻辑（`startEditing` 方法）
- [x] 2.3 实现编辑确认逻辑（`confirmEditing` 方法），包括空值回退
- [x] 2.4 实现编辑取消逻辑（`finishEditing` 方法），失焦时触发
- [x] 2.5 添加编辑模式 UI：输入框 + 确认按钮，样式与 Toolbar 一致
- [x] 2.6 修改 `getGroupName` computed，优先显示 `customName`，否则显示自动计算的名称
- [x] 2.7 在 `useLogicFlowStore.ts` 中添加 `updateGroupName(groupId, name)` 方法

## 3. 上下游高亮链路追踪

- [x] 3.1 在 `useLogicFlowStore.ts` 中添加 `highlightedNodeIds` computed 属性
- [x] 3.2 在 `useLogicFlowStore.ts` 中添加 `highlightedConnectionIds` computed 属性
- [x] 3.3 实现上游追踪算法（递归查找输入依赖，排除能量电池，包含 isolated 节点）
- [x] 3.4 实现下游追踪算法（查找消费该产物的节点，包含 isolated 节点）
- [x] 3.5 在 `FlowNode.vue` 中添加 `@mouseenter` 和 `@mouseleave` 事件处理
- [x] 3.6 在 `FlowNode.vue` 中根据 `highlightedNodeIds` 应用高亮样式
- [x] 3.7 在 `ProductionLineGroup.vue` 中根据高亮节点应用容器高亮样式
- [x] 3.8 在 `ProductionLineGroup.vue` 中根据 `highlightedConnectionIds` 应用连线高亮样式

## 4. 视图切换按钮位置调整

- [x] 4.1 在 `StationToolbar.vue` 中将视图切换按钮从左侧移动到右侧
- [x] 4.2 调整布局顺序：`[按钮组] ... [标题] ... [视图切换] [语言选择]`
- [x] 4.3 确保视图切换按钮与语言选择器之间无其他元素

## 5. 样式优化

- [x] 5.1 定义产线组容器高亮样式类（边框发光、背景变化）
- [x] 5.2 定义连线高亮样式（提高透明度、颜色变化、线宽增加）
- [x] 5.3 确保编辑模式与非编辑模式的高度稳定性

## 6. 补充需求：紧凑模式与预览区自定义标题

- [x] 6.1 紧凑模式产线组标题支持自定义标题显示
- [x] 6.2 预览区菜单按钮添加的对象显示自定义标题
- [x] 6.3 预览区标题显示优先级：T0 产物完整显示 > 自定义标题缩略显示
- [x] 6.4 菜单标题支持缩略显示

## 7. 解锁规划区血统检查逻辑优化

- [x] 7.1 修改 `getWareGroupStatus` 函数，仅在锁定状态检查血统兼容性
- [x] 7.2 解锁状态允许跨 category 添加产物（工业/农业混合）
- [x] 7.3 更新 `getEffectiveLineage` 逻辑，解锁状态使用 `group.subCategory` 作为默认值

## 8. 混合血统显示与锁定禁用

- [x] 8.1 添加 `hasMixedLineage` computed 属性检测混合血统
- [x] 8.2 混合血统时显示"混合"文字
- [x] 8.3 锁定按钮禁用（`:disabled="hasMixedLineage"`）
- [x] 8.4 添加 i18n 翻译：`zh-CN` 和 `en`
