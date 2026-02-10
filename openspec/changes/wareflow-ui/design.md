# WareFlow UI Refactor Specification

## Purpose
将 `StationWareFlowsDashboard` 的 UI 风格与重构后的 `StationDashboard` 对齐，确保应用内字体、按钮样式和视觉效果的一致性。

### Requirement: Header Title Style
仪表盘的标题样式 MUST 与 `StationDashboard` 保持一致。

#### Scenario: Visual Consistency
- **前提** 用户查看 `StationWareFlowsDashboard` 组件
- **当** 组件渲染时
- **那么** 标题文本应使用 `text-base` 大小、`font-bold` 字重、`text-slate-100` 颜色，以及较宽的字间距

### Requirement: View Mode Switcher Style
视图模式切换按钮 MUST 匹配 `StationDashboard` 的“蓝色辉光”风格，并弃用之前的“琥珀色实心”风格。

#### Scenario: Switcher Layout
- **前提** 切换器在标题栏可见
- **当** 用户观察按钮组容器时
- **那么** 容器应具有深色半透明背景 (`bg-slate-900/60`) 和细微边框 (`border-slate-700/30`)

#### Scenario: Active Button State
- **前提** 某个视图模式被选中（例如 "Quantity"）
- **当** 对应的按钮处于激活状态时
- **那么** 它应显示蓝色背景色调 (`bg-sky-500/20`)、蓝色文字 (`text-sky-400`) 和蓝色辉光阴影

#### Scenario: Inactive Button State
- **前提** 某个视图模式未被选中
- **当** 按钮处于非激活状态时
- **那么** 它应显示灰色文字 (`text-slate-500`)，并在悬停时变亮为 `text-slate-300`
