## Context

当前拖拽系统使用 vuedraggable 实现，但存在以下问题：

1. **手动 DOM 操作**：`LogicFlowPlanningZone.vue` 中使用 `removeChild` 删除 DOM 节点
2. **v-show 切换**：拖拽时切换到紧凑模式，导致 DOM 结构变动
3. **clone 退化为 move**：`pull: 'clone'` 配置被破坏，导致源节点消失

## Goals / Non-Goals

**Goals:**
- 实现纯信号式拖拽，移除所有手动 DOM 操作
- 实现预览节点系统
- 修复候选区产物消失的 bug

**Non-Goals:**
- 不改变现有的产线组数据结构
- 不改变现有的血统检查逻辑

## Decisions

### D1: Store 状态设计

**决策**: 新增 `previewNodes` 状态存储预览节点

```typescript
const previewNodes = ref<Map<string, FlowNode>>(new Map())
```

**理由**:
- 使用 Map 存储每个产线组的预览节点
- key 为 `groupId` 或 `'__new__'`（新建区域）
- 便于快速查找和清除

### D2: Store 方法设计

**决策**: 新增 `handleHover`、`handleMoveOut`、`handleDrop` 方法

```typescript
/**
 * 悬停进入目标 - 生成预览节点
 */
function handleHover(targetGroupId: string | 'new') {
  hoveredGroupId.value = targetGroupId === 'new' ? null : targetGroupId
  isHoveringNewZone.value = targetGroupId === 'new'
  
  if (!draggingWareId.value) return
  
  // 清除其他组的预览节点
  previewNodes.value.clear()
  
  // 生成预览节点
  const lineage = draggingLineage.value || 'default'
  const previewNode = createPreviewNode(draggingWareId.value, lineage)
  
  const key = targetGroupId === 'new' ? '__new__' : targetGroupId
  previewNodes.value.set(key, previewNode)
}

/**
 * 离开目标区域 - 清除该目标的预览节点
 */
function handleMoveOut(targetGroupId: string | 'new') {
  const key = targetGroupId === 'new' ? '__new__' : targetGroupId
  previewNodes.value.delete(key)
  
  if (targetGroupId === 'new') {
    isHoveringNewZone.value = false
  } else if (hoveredGroupId.value === targetGroupId) {
    hoveredGroupId.value = null
  }
}

/**
 * 放置确认 - 将预览转为正式节点
 */
function handleDrop(targetGroupId: string | 'new') {
  if (!draggingWareId.value) return
  
  const lineage = draggingLineage.value || 'default'
  
  if (targetGroupId === 'new') {
    // 创建新产线组
    const group = addGroup(...)
    expandUpstream(group.id, draggingWareId.value, 'manual', lineage)
  } else {
    // 添加到现有产线组
    const status = getWareGroupStatus(targetGroupId, draggingWareId.value, lineage)
    switch (status) {
      case 'isolated':
        connectAndExpand(targetGroupId, draggingWareId.value, lineage)
        break
      case 'replace':
        replaceNodeWithLineage(targetGroupId, draggingWareId.value, lineage)
        break
      case 'auto':
        const node = groups.value.find(g => g.id === targetGroupId)?.nodes.find(n => n.wareId === draggingWareId.value)
        if (node) promoteNode(targetGroupId, node.id)
        break
      case 'available':
        expandUpstream(targetGroupId, draggingWareId.value, 'manual', lineage)
        break
    }
  }
  
  stopDragging()
}

/**
 * 停止拖拽 - 完全清理
 */
function stopDragging() {
  draggingWareId.value = null
  draggingLineage.value = null
  isDragging.value = false
  hoveredGroupId.value = null
  isHoveringNewZone.value = false
  previewNodes.value.clear()
}
```

### D3: 组件改动设计

**决策**: 移除所有手动 DOM 操作，使用纯信号式处理

**LogicFlowPlanningZone.vue**:
```typescript
// 悬停事件
const handleDragEnter = (groupId: string) => {
  logicFlow.handleHover(groupId)
}

const handleNewZoneDragEnter = () => {
  logicFlow.handleHover('new')
}

// 离开事件
const handleDragLeave = (groupId: string) => {
  logicFlow.handleMoveOut(groupId)
}

const handleNewZoneDragLeave = () => {
  logicFlow.handleMoveOut('new')
}

// 放置事件
const handleDropSignal = (event: any, targetGroupId: string | 'new') => {
  logicFlow.handleDrop(targetGroupId)
}
```

**LogicFlowCandidateZone.vue**:
```vue
<draggable 
  :clone="(ware) => ({ ...ware, instanceId: Date.now() + Math.random() })"
/>
```

### D4: 预览节点显示

**决策**: 在紧凑模式中使用 `getNodesWithPreview` 显示预览节点

```typescript
function getNodesWithPreview(groupId: string): FlowNode[] {
  const group = groups.value.find(g => g.id === groupId)
  if (!group) return []
  
  const nodes = [...group.nodes]
  
  const preview = previewNodes.value.get(groupId)
  if (preview) {
    nodes.push({ ...preview, isPreview: true })
  }
  
  return nodes
}
```

**UI 显示**:
```vue
<div 
  v-for="node in logicFlow.getNodesWithPreview(group.id)" 
  :key="node.id"
  :class="{ 'animate-pulse border-dashed border-blue-500': node.isPreview }"
>
  {{ node.name }}
</div>
```

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 预览节点与正式节点冲突 | 使用 `isPreview` 标记区分 |
| 多个产线组之间快速切换 | `handleHover` 时清除其他组的预览 |
| 取消拖拽时预览残留 | `stopDragging` 时清除所有预览 |
