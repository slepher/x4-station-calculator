# Request: Logic Flow UI Adjust

## Feature Description

优化逻辑组网视图的 UI 布局，包括：
1. 修改候选区和规划区的 4 个 tier 列宽度比例，从等宽 `1:1:1:1` 改为 `2:3:3:4`
2. 修改候选区 ware-grid 的 padding 为 `pl-4 pr-8`
3. 修改规划区 planning-zone 的 padding 为 `pl-4 pr-8`
4. 抽取 ProductionLineGroup 内部 padding 到父级
5. 在 ware-card 中显示压缩率（T0 除外）
6. 实现 ware-card hover 时展开+按钮（T0 除外）
7. 统一 draggable-area 的 mb 与内部 gap
8. 修正紧凑区布局使用等宽 `grid-cols-4`
9. 简化新建规划区预览算法

## Business Context

- **T0 (Tier 0)**: 基础资源，数量少但重要，需要较窄的列，不显示压缩率和+按钮
- **T1 (Tier 1)**: 一级加工品，数量适中
- **T2 (Tier 2)**: 二级加工品，数量适中
- **T3 (Tier 3)**: 高级产品，数量多且复杂，需要最宽的列

新的比例 `2:3:3:4` 更符合各 tier 的实际内容量，优化空间利用率。

压缩率显示帮助用户识别哪些模块能有效压缩资源体积，优化空间站存储和运输效率。

## Technical Approach

1. **Tier 宽度**: 使用 Tailwind CSS 的任意值语法：`grid-cols-[2fr_3fr_3fr_4fr]`
2. **压缩率获取**: ware → module 映射使用 `findModuleForWare(wareId, lineage)`
3. **颜色逻辑**: 与 FlowNode 一致（≤100% 绿色，>100% 红色）
4. **Hover 展开**: CSS transition 实现宽度增长
5. **布局分离**: tier 宽度比例仅用于候选区和 ProductionLineGroup，紧凑区使用等宽布局

## Ware Card Layout

**布局结构**：
```
默认状态：
[状态点] [图标] [产品名(完整)] [T0标签] [压缩率]

Hover 状态：
[状态点] [图标] [产品名(完整)] [压缩率] [+]
```

**核心规则**：
1. **产品名**：完整显示，不截断；被 T0 标签覆盖时使用半透明背景遮罩
2. **T0 标签**：紧靠压缩率左侧；hover 时渐变消失，露出完整产品名
3. **压缩率**：显示百分比 + 体积图标；≤100% 绿色，>100% 红色；hover 时保持显示
4. **+按钮**：hover 时背景层向右扩展，+按钮从右侧滑入；不影响其他元素位置
5. **T0 资源**：不显示压缩率和+按钮，但保留背景染色

**技术实现**：
- Grid 重叠布局：`grid-template-columns: 1fr auto`
- T0 标签背景：`bg-slate-900/70` 半透明遮罩
- Hover 时 T0 标签消失：`hover:opacity-0`

## Files to Modify

| File | Change |
|------|--------|
| LogicFlowCandidateZone.vue | tier 宽度、padding、ware-card 布局和交互、draggable-area mb |
| LogicFlowPlanningZone.vue | padding、紧凑区布局、预览算法 |
| ProductionLineGroup.vue | 移除内部 padding |

## Acceptance Criteria

1. 候选区 4 个 tier 列宽度比例为 2:3:3:4
2. ProductionLineGroup 4 个 tier 列宽度比例为 2:3:3:4
3. 紧凑区使用等宽 `grid-cols-4` 布局
4. 候选区 ware-grid padding 为 `pl-4 pr-8`
5. 规划区 planning-zone padding 为 `pl-4 pr-8`
6. ProductionLineGroup 内部无 padding
7. draggable-area mb 为 1.5（与内部 gap 一致）
8. 非 T0 ware-card 显示压缩率（百分比 + 图标，颜色编码）
9. 非 T0 ware-card hover 时背景层向右扩展，+按钮从右侧滑入
10. T0 ware-card 不显示压缩率和+按钮，但保留背景染色
11. T0 标签使用半透明背景遮罩产品名，hover 时消失
12. 新建规划区预览节点始终显示在第1列

## Test Strategy

- **Unit Tests**: 无需（纯 UI 修改）
- **E2E Tests**: 验证压缩率显示、hover 交互、布局比例
