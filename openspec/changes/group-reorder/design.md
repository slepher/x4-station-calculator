## Context

当前规划区的产线组顺序是固定的，用户无法调整。当用户需要重新组织产线布局时，只能删除后重新创建。

## Goals / Non-Goals

**Goals:**
- 实现产线组上下移动排序功能
- 通过上下箭头按钮实现简单直观的排序操作
- 边界状态自动隐藏不可用的箭头

**Non-Goals:**
- 不使用拖拽排序（交互复杂）
- 不需要紧凑模式支持排序
- 不隐藏新建产线区域（上下箭头排序不影响紧凑模式）

## Decisions

### 1. 排序交互方式

**决策**：使用上下箭头按钮替代拖拽手柄

**方案**：
```
原拖拽手柄位置 → 显示上下箭头按钮
    ↓
点击上箭头 → 产线组向上移动一位
点击下箭头 → 产线组向下移动一位
    ↓
边界处理：
- 第一个产线组：隐藏上箭头
- 最后一个产线组：隐藏下箭头
```

**优点**：
- 交互简单直观，无需进入紧凑模式
- 实现简单，不需要 vuedraggable
- 边界状态清晰（箭头隐藏表示无法移动）

### 2. Store 函数设计

**决策**：新增 `moveGroupUp(groupId)` 和 `moveGroupDown(groupId)` 函数

```typescript
function moveGroupUp(groupId: string) {
  const index = groups.findIndex(g => g.id === groupId)
  if (index <= 0) return
  const [moved] = groups.splice(index, 1)
  groups.splice(index - 1, 0, moved)
}

function moveGroupDown(groupId: string) {
  const index = groups.findIndex(g => g.id === groupId)
  if (index < 0 || index >= groups.length - 1) return
  const [moved] = groups.splice(index, 1)
  groups.splice(index + 1, 0, moved)
}
```

### 3. UI 设计

**决策**：上下箭头按钮替代原拖拽手柄位置

**布局**：
```
[标题]                    [锁定开关] [删除] [↑][↓]
```

**样式**：
- 箭头按钮使用小尺寸图标
- 悬停时高亮显示
- 不可用时隐藏（opacity-0 或 v-if）

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 快速连续点击可能导致动画不连贯 | 使用 CSS transition 平滑过渡 |
| 单个产线组时两个箭头都隐藏 | 正常情况，无需特殊处理 |
