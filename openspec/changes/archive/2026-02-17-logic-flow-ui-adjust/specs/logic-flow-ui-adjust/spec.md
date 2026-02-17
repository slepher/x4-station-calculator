# Logic Flow UI Adjust Specification

## Purpose

优化逻辑组网视图的 UI 布局，包括 tier 列宽度比例、候选区 padding 和 gap、ware-card 压缩率显示和交互优化，提升用户体验和空间利用率。

---

## MODIFIED Requirements

### Requirement: Tier Column Width Ratio

The system SHALL apply non-uniform width ratio `2:3:3:4` to the four tier columns in candidate zone and ProductionLineGroup.

**宽度分配**：
- Tier 0: `2fr` (最窄，基础资源数量少)
- Tier 1: `3fr` (中等宽度)
- Tier 2: `3fr` (中等宽度)
- Tier 3: `4fr` (最宽，高级产品数量多)

**适用范围**：
- 候选区 `ware-grid`
- ProductionLineGroup tier 列

**不适用**：
- 紧凑区使用等宽 `grid-cols-4`

#### Scenario: Candidate zone displays tier columns with 2:3:3:4 ratio
- **前提** 用户打开逻辑组网视图
- **当** 候选区渲染时
- **那么** 4 个 tier 列 SHALL 按 `2fr:3fr:3fr:4fr` 比例分配宽度

#### Scenario: ProductionLineGroup displays tier columns with 2:3:3:4 ratio
- **前提** 规划组包含多个 tier 的节点
- **当** ProductionLineGroup 渲染时
- **那么** 4 个 tier 列 SHALL 按 `2fr:3fr:3fr:4fr` 比例分配宽度

#### Scenario: Compact view uses equal width layout
- **前提** 用户开始拖拽操作
- **当** 紧凑视图显示时
- **那么** 4 个 tier 列 SHALL 使用等宽 `grid-cols-4` 布局

---

### Requirement: Candidate Zone Spacing

The system SHALL apply consistent spacing in the candidate zone ware grid.

**间距设置**：
- Padding: `pl-4 pr-8` (左 16px, 右 32px)
- Gap: `48px` (gap-12，与规划区一致)
- draggable-area mb: `6px` (mb-1.5，与内部 gap 一致)

#### Scenario: Candidate zone ware grid uses consistent spacing
- **前提** 用户打开逻辑组网视图
- **当** 候选区渲染时
- **那么** ware-grid 的 padding SHALL 为 `pl-4 pr-8`，gap SHALL 为 48px

---

### Requirement: Planning Zone Spacing

The system SHALL apply consistent spacing in the planning zone.

**间距设置**：
- Padding: `pl-4 pr-8` (左 16px, 右 32px)
- ProductionLineGroup 内部无 padding

#### Scenario: Planning zone uses consistent spacing
- **前提** 用户打开逻辑组网视图
- **当** 规划区渲染时
- **那么** planning-zone 的 padding SHALL 为 `pl-4 pr-8`

---

### Requirement: Ware Card Layout and Interactions

The system SHALL display ware-card with proper layout and hover interactions.

**布局结构**：
```
默认状态：
[状态点] [图标] [产品名(完整)] [T0标签] [压缩率]

Hover 状态：
[状态点] [图标] [产品名(完整)] [压缩率] [+]
```

**核心规则**：
1. **产品名**：完整显示，不截断；被 T0 标签覆盖时使用半透明背景遮罩
2. **T0 标签**：紧靠压缩率左侧；使用 `bg-slate-900/70` 半透明背景；hover 时渐变消失
3. **压缩率**：显示百分比 + 体积图标；≤100% 绿色，>100% 红色；hover 时保持显示
4. **+按钮**：hover 时背景层向右扩展，+按钮从右侧滑入；不影响其他元素位置
5. **T0 资源**：不显示压缩率和+按钮，但保留背景染色

**技术实现**：
- Grid 重叠布局：`grid-template-columns: 1fr auto`
- T0 标签背景：`bg-slate-900/70` 半透明遮罩
- Hover 时 T0 标签消失：`hover:opacity-0`

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
- **那么** 背景层 SHALL 向右扩展，+按钮 SHALL 从右侧滑入

#### Scenario: No add button for T0 ware
- **前提** ware 的 tier === 0
- **当** 用户 hover ware-card 时
- **那么** +按钮 SHALL NOT 显示，但背景染色 SHALL 正常显示

#### Scenario: T0 tags disappear on hover
- **前提** ware 的 tier > 0
- **当** 用户 hover ware-card 时
- **那么** T0 标签 SHALL 渐变消失，露出完整产品名

---

### Requirement: New Line Preview Position

The system SHALL display new line preview node in the first column.

#### Scenario: New line preview displays in first column
- **前提** 用户拖拽 ware 到新建规划区
- **当** 预览节点显示时
- **那么** 预览节点 SHALL 始终显示在第1列
