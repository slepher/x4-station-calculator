# Signal-Based Drag System

## Overview

实现纯信号式拖拽系统，解决候选区产物消失的问题。

## API Specification

### Store State

```typescript
interface LogicFlowStore {
  // 现有状态
  draggingWareId: Ref<string | null>
  draggingLineage: Ref<string | null>
  isDragging: Ref<boolean>
  hoveredGroupId: Ref<string | null>
  isHoveringNewZone: Ref<boolean>
  
  // 新增状态
  previewNodes: Ref<Map<string, FlowNode>>
}
```

### Store Methods

```typescript
interface LogicFlowStoreMethods {
  // 现有方法
  startDragging(wareId: string, lineage?: string): void
  stopDragging(): void
  
  // 新增方法
  handleHover(targetGroupId: string | 'new'): void
  handleMoveOut(targetGroupId: string | 'new'): void
  handleDrop(targetGroupId: string | 'new'): void
  getNodesWithPreview(groupId: string): FlowNode[]
}
```

## Behavior Specification

### 拖拽流程

```
1. startDragging(wareId, lineage)
   ↓
2. handleHover(targetGroupId)  // 进入目标区域
   → previewNodes.set(targetGroupId, previewNode)
   ↓
3. handleMoveOut(targetGroupId)  // 离开目标区域
   → previewNodes.delete(targetGroupId)
   ↓
4. handleDrop(targetGroupId)  // 放置确认
   → 预览转为正式节点
   → stopDragging()
   
   OR
   
4. stopDragging()  // 取消拖拽
   → previewNodes.clear()
```

### 预览节点

- 预览节点包含 `isPreview: true` 标记
- 预览节点使用特殊样式：`animate-pulse`, `border-dashed`, `border-blue-500`
- 预览节点不参与计算，仅用于显示

### 边界条件

| 条件 | 行为 |
|------|------|
| 拖拽到 rejected 状态的产线组 | 不生成预览节点 |
| 快速切换目标区域 | 清除前一个预览，生成新预览 |
| 取消拖拽（ESC 或点击其他区域） | 清除所有预览节点 |
| 放置到新建区域 | 创建新产线组并添加节点 |
