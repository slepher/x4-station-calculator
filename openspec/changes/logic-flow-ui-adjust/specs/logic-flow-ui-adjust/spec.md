# Logic Flow UI Adjust Specification

## Purpose

优化逻辑组网视图的 UI 布局，包括 tier 列宽度比例、候选区 padding 和 gap、ware-card 压缩率显示和交互优化，提升用户体验和空间利用率。

---

## MODIFIED Requirements

### Requirement: Tier Column Width Ratio

The system SHALL apply non-uniform width ratio `2:3:3:4` to the four tier columns in candidate zone and planning zone.

**宽度分配**：
- Tier 0: `2fr` (最窄，基础资源数量少)
- Tier 1: `3fr` (中等宽度)
- Tier 2: `3fr` (中等宽度)
- Tier 3: `4fr` (最宽，高级产品数量多)

#### Scenario: Candidate zone displays tier columns with 2:3:3:4 ratio
- **前提** 用户打开逻辑组网视图
- **当** 候选区渲染时
- **那么** 4 个 tier 列 SHALL 按 `2fr:3fr:3fr:4fr` 比例分配宽度

#### Scenario: Planning zone compact view displays tier columns with 2:3:3:4 ratio
- **前提** 用户开始拖拽操作
- **当** 紧凑视图显示时
- **那么** 4 个 tier 列 SHALL 按 `2fr:3fr:3fr:4fr` 比例分配宽度

#### Scenario: ProductionLineGroup displays tier columns with 2:3:3:4 ratio
- **前提** 规划组包含多个 tier 的节点
- **当** ProductionLineGroup 渲染时
- **那么** 4 个 tier 列 SHALL 按 `2fr:3fr:3fr:4fr` 比例分配宽度

---

### Requirement: Candidate Zone Spacing

The system SHALL apply consistent spacing in the candidate zone ware grid.

**间距设置**：
- Padding: `16px` (p-4)
- Gap: `48px` (gap-12，与规划区一致)

#### Scenario: Candidate zone ware grid uses consistent spacing
- **前提** 用户打开逻辑组网视图
- **当** 候选区渲染时
- **那么** ware-grid 的 padding SHALL 为 16px，gap SHALL 为 48px

---

### Requirement: Ware Card Layout and Interactions

The system SHALL display ware-card with proper layout and hover interactions.

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

#### Scenario: Display compression rate for non-T0 ware
- **前提** ware 的 tier > 0
- **当** ware-card 渲染时
- **那么** 压缩率 SHALL 显示在 T0 标签右侧

#### Scenario: Hide compression rate for T0 ware
- **前提** ware 的 tier === 0
- **当** ware-card 渲染时
- **那么** 压缩率 SHALL NOT 显示

#### Scenario: Show add button on hover for non-T0 ware
- **前提** ware 的 tier > 0
- **当** 用户 hover ware-card 时
- **那么** ware-card SHALL 向右扩展并显示+按钮，其他元素位置不变

#### Scenario: No add button for T0 ware
- **前提** ware 的 tier === 0
- **当** 用户 hover ware-card 时
- **那么** +按钮 SHALL NOT 显示

#### Scenario: Product name with gradient mask when overlapped
- **前提** 产品名长度超过可用空间
- **当** T0 标签覆盖产品名时
- **那么** 产品名 SHALL 使用渐变遮罩实现平滑过渡效果
