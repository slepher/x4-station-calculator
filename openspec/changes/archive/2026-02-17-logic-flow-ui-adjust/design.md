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

### D2: 布局分离策略

**tier 宽度比例适用范围**：
- ✅ 候选区 `ware-grid`
- ✅ ProductionLineGroup tier 列
- ❌ 紧凑区（使用等宽 `grid-cols-4`）

**理由**:
- 候选区和 ProductionLineGroup 是主要工作区，需要按内容量分配空间
- 紧凑区是临时预览，等宽布局更简洁

### D3: Padding 抽取到父级

**选择**: 将 `px-4` 从 ProductionLineGroup 内部移到 planning-zone 父级

**理由**:
- 减少重复代码
- 统一控制整个区域的左右边距
- 更清晰的层级结构

**最终结构**：
```
planning-zone (pl-4 pr-8)
├── ProductionLineGroup (无 padding)
│   ├── Header (无 padding)
│   └── Grid (无 padding)
└── compact-view (无水平 padding)

ware-grid (pl-4 pr-8)
```

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

### D5: Ware Card 使用 Grid 重叠 + 半透明遮罩

**选择**: 使用 CSS Grid 的 layering 特性实现重叠效果

**实现**:
```css
.ware-content-grid {
  grid-template-columns: 1fr auto;
}

.ware-name {
  grid-column: 1 / 3;  /* 占满前两列 */
  grid-row: 1;
}

.ware-info-overlay {
  grid-column: 2;      /* 第二列 */
  grid-row: 1;         /* 与产品名同行，实现重叠 */
  z-index: 10;
}
```

**理由**:
- 比 absolute 定位更稳定
- 保持垂直居中对齐
- 半透明背景遮罩实现覆盖效果

### D6: Hover 展开使用背景层扩展

**选择**: 背景层向右扩展，+按钮从右侧滑入

**实现**:
```css
.ware-card-bg {
  width: 100%;
  transition: width 0.3s;
}

.group:hover .ware-card-bg {
  width: calc(100% + 28px);
}

.ware-card-add-btn {
  transform: translateX(100%);
  transition: transform 0.3s;
}

.group:hover .ware-card-add-btn {
  transform: translateX(0);
}
```

**理由**:
- 内容层位置不变，压缩率位置不变
- 平滑的动画效果
- 不影响其他元素布局

### D7: T0 标签 hover 时消失

**选择**: T0 标签使用 `hover:opacity-0` 在 hover 时消失

**实现**:
```css
.resource-preview-container {
  transition-opacity duration-300;
}

.resource-preview-container:hover {
  opacity: 0;
}
```

**理由**:
- hover 时露出完整产品名
- 用户可以看到被遮挡的产品名
- 平滑的过渡效果

## Implementation Notes

### ware-card 结构
```
.ware-card-wrapper (relative, z-index 管理)
├── .ware-card-bg (背景层，hover 时向右扩展)
│   └── .ware-card-add-btn (+按钮，从右侧滑入)
└── .ware-card-content (内容层，absolute 定位)
    └── .ware-content-grid (Grid 重叠布局)
        ├── .ware-name (Layer 1，完整显示)
        └── .ware-info-overlay (Layer 2)
            ├── .resource-preview-container (T0 标签，hover 时消失)
            └── .compression-rate-container (压缩率，hover 时保持)
```

### T0 资源特殊处理
- 有背景层（显示 planned 状态染色）
- 无+按钮
- 无压缩率显示
- 无 T0 标签（因为 T0 不需要自身）

### 新建规划区预览
- 移除复杂的 `gridColumnStart` 计算
- 预览节点始终显示在第1列
