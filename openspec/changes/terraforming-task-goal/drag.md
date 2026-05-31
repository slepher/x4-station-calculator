# terraforming-task-goal Drag & Drop Implementation Notes

## 需求

编辑模式下从 TerraformingTaskList（中列）拖拽 task 到 TerraformingResourcePanel（右侧 log 区域）：
- 手柄拖拽（`↔` 在按钮右方）
- 落点预览：与 target entry head 行样式一致（虚线蓝色边框 + 项目名）
- 松手后在插入位置添加任务

## 参考实现：LogicFlow 跨区拖拽

Logic-flow 的拖拽预览采用**两层隔离**架构：

### 源端

`LogicFlowCandidateZone.vue` — 用 vuedraggable group sharing 做 clone source：

```html
<draggable
  :model-value="waresByTier[tier] || []"
  :group="{ name: 'wares', pull: 'clone', put: false }"
  :sort="false"
/>
```

`@start` → store 记录 `isDragging + draggingWareId`。`@end` → 清除。

### 目标端

`LogicFlowPlanningZone.vue` — compact view 下**完全绕过 vuedraggable 的 ghost 机制**：

1. CSS 隐藏默认 ghost：
   ```css
   :deep(.sortable-ghost) { display: none; }
   :deep(.sortable-fallback) { display: none; }
   ```

2. **Vue reactive state 驱动预览渲染** — 不在 `#item` slot 内：
   - `logicFlow.isDragging` / `logicFlow.hoveredGroupId` / `logicFlow.previewNodes`
   - `nodesWithPreview(Group)` 将 preview node 合并到显示列表
   - Template 中渲染 preview node（`animate-pulse`、dashed border、blue tint）

3. **Draggable `put` gate** — 用回调函数判断是否允许 drop（检查 ware 与 group 关系）

4. **Drop** — vuedraggable `@add` 事件触发 `handleAddFromDrop` → store 处理

### 核心差异

| | LogicFlow | Terraforming |
|---|---|---|
| Preview 渲染 | Store reactive state 驱动，Vue template 外层渲染 | 当前尝试在 target draggable 内部插入 clone |
| Ghost 控制 | SortableJS ghost 完全禁用 | 当前尝试用 CSS 转换 ghost |
| Drop 位置 | Dedicated "New Line" + per-group drop zones | 插入到 log entries 列表 |
| State 管理 | Store 跨组件 reactive state | 需要 cross-component 通信 |

## 当前状态与问题

### 已实现
- TaskList 端 vuedraggable clone source（`group: 'terraforming-tasks'`, `pull: 'clone'`, `handle: '.drag-to-log'`）
- ResourcePanel 端 vuedraggable 接受 drop（`put: () => true`）
- `@add` 事件提 projectId + newIndex → `appendDraftProject`
- `displayPlanEntries` ref 解耦显示列表与 presenter 数据

### 未完成
- **落点预览样式**：当前尝试通过 SortableJS ghost（CSS `::after` attr）+ Vue `#item` template 实现，均无法在 drag-over 阶段渲染出目标 entry head 行样式的预览
- **SortableJS ghost** 是 source DOM 的 clone，CSS 无法稳定裁剪其内部子元素并显示干净的项目名
- **Vue `#item` template** 的 `_type: 'drag-clone'` 渲染仅在 `@add` 后触发（松手时），drag-over 时 clone 未被 Vue 的 reactive 系统识别

### 计划方案
参照 LogicFlow 架构：
1. CSS `:deep(.sortable-ghost) { display: none }` 禁用 SortableJS ghost
2. `@change` 事件更新 reactive state（`dragHoverIndex`, `dragProjectName`）
3. 在 vuedraggable **外部**用 Vue 渲染预览元素
4. 需跨组件 state 通信（TaskList `@start` → ResourcePanel preview），方案待定（provide/inject 或 shared composable）
