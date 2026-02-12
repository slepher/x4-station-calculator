## Context

当前项目使用 Vue 3 + Tailwind CSS + Tippy.js (via `vue-tippy`) 实现 UI。`FavoriteButton` 和 `LockButton` 是核心交互组件，频繁使用。目前的 Tooltip 实现较为简单，无法满足用户对状态持续可见性和详细缓冲信息的需求。

## Goals / Non-Goals

**Goals:**
*   实现 Fav/Lock 按钮 Tooltip 点击不消失。
*   在 Fav Tooltip 中展示准确的缓冲小时数 (AH/BH)。
*   优化 Tooltip 布局以适应多语言环境。
*   **[New]** 统一资源交互逻辑：无生产能力的资源不可切换优先级，但必须显示 Tooltip。
*   **[New]** 动态 Tooltip 内容：Tooltip 仅显示当前资源**合法可用**的切换选项（Available Levels）。
*   **[New]** 简化时间显示：当生产缓冲为 0 时，仅显示资源缓冲时间。
*   **[New]** 修复 Bug：netRate < 0 的资源应正常显示 Tooltip，且不应因禁用状态而导致图标过暗不可见。

**Non-Goals:**
*   重构整个 `StationWareflow` 组件。
*   修改缓冲计算的核心逻辑 (只负责展示)。

## Decisions

### Decision 1: 使用 `hideOnClick: false`
*   **选择**: 在 `v-tippy`指令配置中显式设置 `hideOnClick: false`。
*   **理由**: 这是 Tippy.js 原生支持的特性，成本最低，效果最稳定。

### Decision 2: 拆分 Locale Key 并精简文本
*   **选择**: 将 `Long+Resource Buffer` 拆分为 `Long` 和 `Res` 等独立 Key，并使用缩写。
*   **理由**: "Resource Buffer" 在英文中太长，拆分后可灵活组合并节省空间。

### Decision 3: Props 传递策略
*   **选择**: 从 `StationWareflow` 计算状态，通过 Props 传给 `FavoriteButton`。
*   **理由**: 保持 `FavoriteButton` 为纯展示组件。

### Decision 4: 统一不可操作资源逻辑 (Updated)
*   **选择**: 移除对 `transport === 'container'` 的特殊检查。改为根据 `availableLevels` 数组长度判断交互。
*   **逻辑**: 
    *   如果 `availableLevels.length > 1` (存在可切换选项): 按钮启用 (Normal)，点击切换到下一个可用 Level。
    *   如果 `availableLevels.length === 1` (通常是 Level 0): 按钮禁用 (Visual Disabled)，不可点击切换。
    *   **无论哪种情况，Tooltip 始终显示**，且仅显示 `availableLevels` 中包含的行。
*   **样式修正**: 针对 `disabled` 且 `availableLevels.length === 1` 的情况（即纯消耗资源），**不应**应用低透明度样式（opacity-30），以确保图标清晰可见，表明它仅是“不可切换”而非“完全无效”。

### Decision 5: 动态 Available Levels 逻辑 (New)
*   **选择**: 在 `StationWareFlow` 中计算 `availableLevels` 数组。
*   **规则**:
    1.  **Planned Ware (用户规划产物)**: 用户明确添加了生产该资源的模块。
        *   Allowed: `[1, 2]` (Secondary, Primary)。不可设为 0 (No Demand)。
    2.  **Auto/Byproduct Ware (自动/副产物)**: 仅由自动填充模块或作为副产物产生。
        *   Allowed: `[0, 1]` (No Demand, Secondary)。不可设为 2 (Primary)。
    3.  **Consumption Only (纯消耗)**: 无生产。
        *   Allowed: `[0]` (No Demand)。
*   **判断逻辑**: 
    *   `isPlanned`: 检查 `store.plannedModules` 是否包含产出该 Ware 的模块。
    *   `hasProduction`: 检查当前 Ware 是否有产出量。
    *   `isPlanned ? [1, 2] : (hasProduction ? [0, 1] : [0])`。

### Decision 6: 简化时间显示 (New)
*   **选择**: 当 pHours (生产缓冲) <= 0.01 时，格式化字符串仅显示资源缓冲部分。
*   **示例**: `0h + 2h` -> `2h`。
*   **理由**: 提升信息密度，避免冗余的 `0h` 干扰。

### Decision 7: Tooltip 响应式网格布局与对齐 (New)
*   **选择**: 采用“单网格容器 + `display: contents`”的布局架构。
*   **结构**: 
    *   外部容器 `.priority-tooltip-container` 设置 `display: grid` 和 `grid-template-columns: auto auto auto 1fr`。
    *   每一行 `.priority-tooltip-row` 设置 `display: contents`，使其子元素（图标、标签、时间、描述）直接参与父级网格布局。
*   **理由**: 
    *   传统的嵌套 Grid 无法跨行对齐（每行根据自身内容自适应，导致列错位）。
    *   `display: contents` 允许所有行的单元格共享同一个网格上下文，从而实现跨行的完美对齐。
    *   `auto` 关键字确保在内容较少时自动收缩，消除冗余空白。

### Decision 8: 交互语义增强 (New)
*   **选择**: 当 Tooltip 仅包含一行时，取消该行的选中高亮样式（`is-active`）。
*   **理由**: 
    *   如果只有一行且带高亮，用户可能会尝试点击切换。
    *   取消高亮背景和文字颜色增强，可以从视觉上清晰传达“该状态是固定的/不可修改的”语义，常用于矿石、气体等纯消耗资源。

## Risks / Trade-offs

*   **Risk**: Tooltip 变得过宽。
    *   **Mitigation**: 使用 4 列 Grid 布局。
    *   **[Update]** 采用自适应宽度：通过 `auto` 列宽配合 `whitespace-nowrap`，使 Tooltip 宽度随内容动态调整，既不溢出也不留白。
*   **Risk**: 用户困惑为什么某些资源不能设为主产物。
    *   **Mitigation**: 这是为了防止自动填充逻辑死循环或错误优化（如将副产物误判为主产物导致无限扩建）。通过 Tooltip 仅显示可用选项，隐式引导用户理解。
