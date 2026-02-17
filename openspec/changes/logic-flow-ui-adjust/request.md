# Request: Logic Flow UI Adjust

## Feature Description

优化逻辑组网视图的 UI 布局，包括：
1. 修改候选区和规划区的 4 个 tier 列宽度比例，从等宽 `1:1:1:1` 改为 `2:3:3:4`
2. 修改候选区 ware-grid 的 padding 为 16px
3. 修改候选区 ware-grid 的 gap 为 48px（与规划区一致）
4. 在 ware-card 中显示压缩率（T0 除外）
5. 实现 ware-card hover 时展开+按钮（T0 除外）

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

## Ware Card Layout

**布局结构**：
```
默认状态：
[状态点] [图标] [产品名(完整)] [T0标签] [压缩率]

Hover 状态：
[状态点] [图标] [产品名(完整)] [T0标签] [压缩率] [+]
```

**核心规则**：
1. **产品名**：完整显示，不截断；被 T0 标签覆盖时使用渐变遮罩
2. **T0 标签**：紧靠压缩率左侧；使用 Grid 重叠 + 渐变遮罩覆盖产品名
3. **压缩率**：显示百分比 + 体积图标；≤100% 绿色，>100% 红色
4. **+按钮**：hover 时向右展开；不影响其他元素位置；压缩率位置不变
5. **T0 资源**：不显示压缩率和+按钮

**技术实现**：
- Grid 重叠布局：`grid-template-columns: 1fr auto auto`
- 渐变遮罩：`linear-gradient(to right, transparent, slate-900/80% 30%, slate-900)`

| 层级 | 元素 | Grid 位置 |
|------|------|-----------|
| Layer 1 | 产品名 | col 1-3, row 1 |
| Layer 2 | T0标签+压缩率 | col 2, row 1, z-10 |
| Layer 3 | +按钮 | col 3, row 1, z-20 |

## Files to Modify

| File | Change |
|------|--------|
| LogicFlowCandidateZone.vue | tier 宽度、padding、gap、ware-card 布局和交互 |
| LogicFlowPlanningZone.vue:405 | tier 宽度 |
| LogicFlowPlanningZone.vue:492 | tier 宽度 |
| ProductionLineGroup.vue:368 | tier 宽度 |

## Acceptance Criteria

1. 候选区 4 个 tier 列宽度比例为 2:3:3:4
2. 规划区紧凑视图 4 个 tier 列宽度比例为 2:3:3:4
3. 规划区节点网格 4 个 tier 列宽度比例为 2:3:3:4
4. ProductionLineGroup 4 个 tier 列宽度比例为 2:3:3:4
5. 候选区 ware-grid padding 为 16px
6. 候选区 ware-grid gap 为 48px
7. 非 T0 ware-card 显示压缩率（百分比 + 图标，颜色编码）
8. 非 T0 ware-card hover 时向右展开显示+按钮，其他元素位置不变
9. T0 ware-card 不显示压缩率和+按钮
10. 产品名被 T0 标签覆盖时使用渐变遮罩效果

## Test Strategy

- **Unit Tests**: 无需（纯 UI 修改）
- **E2E Tests**: 验证压缩率显示和 hover 交互
