# Logic Flow UI Adjust Specification

## Purpose
优化逻辑组网视图的 UI 布局和交互体验，包括 tier 列宽度比例调整、间距优化、压缩率显示改进、hover 交互增强以及新建规划区预览位置修正。

## Requirements

### Requirement: Tier Column Width Ratio
The system SHALL 使用 2:3:3:4 的比例设置 tier 列宽度。

#### Scenario: Candidate Zone Grid
- **前提** 用户打开逻辑组网视图
- **那么** 候选区的 ware-grid SHALL 使用 `grid-cols-[2fr_3fr_3fr_4fr]` 设置列宽
- **并且** T0 列宽度 SHALL 为 2fr
- **并且** T1, T2 列宽度 SHALL 各为 3fr
- **并且** T3 列宽度 SHALL 为 4fr

#### Scenario: ProductionLineGroup Grid
- **前提** 用户创建产线组
- **那么** ProductionLineGroup 的节点网格 SHALL 使用 `grid-cols-[2fr_3fr_3fr_4fr]` 设置列宽

#### Scenario: Compact View Grid
- **前提** 用户拖拽商品时显示紧凑视图
- **那么** 紧凑视图 SHALL 使用等宽布局 `grid-cols-4`

### Requirement: Spacing Optimization
The system SHALL 优化候选区和规划区的间距。

#### Scenario: Candidate Zone Padding
- **前提** 用户打开逻辑组网视图
- **那么** 候选区 ware-grid SHALL 设置 `pl-4 pr-8` 的 padding
- **并且** draggable-area SHALL 设置 `mb-1.5` 的底部间距

#### Scenario: Planning Zone Padding
- **前提** 用户创建产线组
- **那么** planning-zone SHALL 设置 `pl-4 pr-8` 的 padding
- **并且** ProductionLineGroup 内部 SHALL 无额外 padding

### Requirement: Compression Rate Display
The system SHALL 在非 T0 的 ware-card 上显示压缩率。

#### Scenario: Show Compression Rate
- **前提** ware-card 的 tier 为 1, 2 或 3
- **那么** ware-card SHALL 在 T0 标签右侧显示压缩率
- **并且** 压缩率 SHALL 显示为百分比数值加图标

#### Scenario: Compression Rate Color
- **前提** ware-card 显示压缩率
- **当** 压缩率 ≤ 100%
- **那么** 压缩率文本颜色 SHALL 为绿色（text-emerald-400）
- **当** 压缩率 > 100%
- **那么** 压缩率文本颜色 SHALL 为红色（text-red-400）

#### Scenario: Hide Compression Rate for T0
- **前提** ware-card 的 tier 为 0
- **那么** ware-card SHALL 不显示压缩率

### Requirement: Hover Expansion
The system SHALL 在 hover 时扩展 ware-card 背景层并显示操作按钮。

#### Scenario: Background Expansion
- **前提** 用户 hover 一个非 T0 的 ware-card
- **那么** 背景层 SHALL 向右扩展 32px
- **并且** 扩展 SHALL 使用 transition 动画

#### Scenario: Add Button Slide In
- **前提** 用户 hover 一个非 T0 的 ware-card
- **那么** +按钮 SHALL 从右侧滑入显示
- **并且** +按钮 SHALL 在扩展区域内

#### Scenario: No Expansion for T0
- **前提** 用户 hover 一个 T0 的 ware-card
- **那么** ware-card SHALL 不扩展背景层
- **并且** ware-card SHALL 不显示+按钮
- **并且** 资源染色 SHALL 正常显示

### Requirement: T0 Label Hover Behavior
The system SHALL 在 hover 时隐藏 T0 标签。

#### Scenario: T0 Label Fade Out
- **前提** ware-card 有 T0 标签
- **当** 用户 hover 该 ware-card
- **那么** T0 标签 SHALL 渐变消失（opacity: 0）
- **并且** 产品名 SHALL 完整显示

#### Scenario: Compression Rate Remains Visible
- **前提** 用户 hover 一个有压缩率的 ware-card
- **那么** 压缩率 SHALL 保持显示

### Requirement: New Group Preview Position
The system SHALL 确保新建规划区预览节点始终在第1列。

#### Scenario: Preview Node Position
- **前提** 用户拖拽商品到新建规划区
- **那么** 预览节点 SHALL 始终显示在第1列
- **并且** 无论商品的 tier 是多少，预览节点位置 SHALL 不变
