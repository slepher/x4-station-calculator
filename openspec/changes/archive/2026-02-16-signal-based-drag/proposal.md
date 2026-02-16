## Problem Statement

当前拖拽系统存在以下问题：

1. **候选区产物消失**：拖拽产物到规划区后，候选区的产物节点消失
2. **手动 DOM 操作**：代码中使用 `removeChild` 手动删除 DOM 节点，打断 vuedraggable 的同步机制
3. **v-show 切换视图**：拖拽时切换到紧凑模式，DOM 结构剧烈变动，vuedraggable 无法稳定识别目标容器
4. **pull: 'clone' 被破坏**：退化为"移动"行为，导致源节点消失

## Proposed Solution

实现**纯信号式拖拽**系统：

```
拖拽 → 发送信号 → Store 处理 → Vue 渲染
```

### 核心原则

- 拖拽只负责发送 `wareId` 和 `lineage`
- Store 负责生成预览节点和正式节点
- Vue 负责渲染 UI
- **禁止手动 DOM 操作**

### Store API 设计

```typescript
// 状态
draggingWareId: string | null
draggingLineage: string | null
isDragging: boolean
hoveredGroupId: string | null
isHoveringNewZone: boolean
previewNodes: Map<string, FlowNode>

// 方法
startDragging(wareId, lineage)  // 开始拖拽
handleHover(targetGroupId)       // 悬停进入目标
handleMoveOut(targetGroupId)     // 离开目标区域
handleDrop(targetGroupId)        // 放置确认
stopDragging()                   // 停止拖拽（清理）
getNodesWithPreview(groupId)     // 获取包含预览的节点列表
```

## Goals / Non-Goals

**Goals:**
- 实现纯信号式拖拽，移除所有手动 DOM 操作
- 实现预览节点系统，拖拽时显示预览效果
- 修复候选区产物消失的 bug
- 保持现有拖拽功能不变

**Non-Goals:**
- 不改变现有的产线组数据结构
- 不改变现有的血统检查逻辑
- 不实现跨规划区的拖拽
