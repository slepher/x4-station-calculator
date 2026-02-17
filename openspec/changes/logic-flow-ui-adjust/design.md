# Logic Flow UI Adjust - Design Document

## Architecture

这是一个 UI 层面的修改，主要涉及 CSS 布局和 Vue 模板调整。

## Decisions

### D1: 使用 Tailwind 任意值语法

**选择**: `grid-cols-[2fr_3fr_3fr_4fr]`

**理由**:
- Tailwind 原生支持任意值语法
- 无需修改 tailwind.config.js
- 代码可读性好，比例一目了然

### D2: 统一修改所有相关组件

**范围**:
1. `LogicFlowCandidateZone.vue` - 候选区 tier 列布局 + 间距 + ware-card 增强
2. `LogicFlowPlanningZone.vue` - 紧凑视图 tier 列布局
3. `LogicFlowPlanningZone.vue` - 节点网格 tier 列布局
4. `ProductionLineGroup.vue` - 规划组 tier 列布局

**理由**: 保持 UI 一致性，所有 tier 列使用相同比例

### D3: 统一候选区和规划区间距

**选择**: `p-4` (16px) 和 `gap-12` (48px)

**理由**:
- 与规划区 ProductionLineGroup 的间距保持一致
- 提升视觉一致性
- 减少不必要的空间浪费

### D4: 压缩率显示复用 FlowNode 逻辑

**选择**: 复用 `getModuleVolumeCompression()` 和颜色逻辑

**实现**:
```typescript
const getWareCompressionRate = (wareId: string): number | undefined => {
  const module = gameData.findModuleForWare(wareId, activeSubCategory.value)
  return gameData.getModuleVolumeCompression(module?.id)
}
```

**理由**:
- 保持与 FlowNode 一致的显示效果
- 复用现有逻辑，减少代码重复

### D5: Hover 展开使用 CSS Transition

**选择**: 使用 `overflow-hidden` + `width` transition

**实现**:
```css
.ware-card {
  @apply overflow-hidden transition-all duration-200;
}
.quick-add-container {
  @apply w-0 group-hover:w-5 transition-all duration-200;
}
```

**理由**:
- 纯 CSS 实现，性能好
- 平滑的动画效果

## Implementation Notes

### ware-card 新结构
```
[Status Dot] [Icon] [Name] [T0 Tags...] [压缩率] [+ (hover展开)]
```

### 压缩率显示
- 位置：T0 标签右侧
- 格式：百分比 + 体积图标 SVG
- 颜色：`text-emerald-400` (≤100%), `text-red-400` (>100%)

### Hover 交互
- 默认：+按钮隐藏（宽度为 0）
- Hover：ware-card 向右扩展，+按钮显示
- T0：不显示+按钮
