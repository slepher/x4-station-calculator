# Role
你是一个精通 Vue 3 和 Tailwind CSS 的前端开发专家。

# Task
请帮我实现一个高度定制化的列表项组件 (List Item Component)。

# Requirements

1. **布局结构 (Structure)**:
   - 使用 CSS Grid 或 Absolute Positioning 实现“图层分离”。
   - **底层 (Background Layer)**: 负责 Hover 交互。当鼠标悬停时，背景宽度向右延伸 (e.g., width 100% -> calc(100% + 40px))，同时一个“+”按钮从右侧滑入。
   - **顶层 (Content Layer)**: 宽度必须锁定为原始宽度的 100%，确保无论背景如何伸缩，内部的文字和标签都不发生位移。

2. **内容元素与顺序**:
   - 左侧：**Element A (Title)**。要求显示全称，禁止换行，禁止省略号 (No truncate, whitespace-nowrap)。
   - 右侧（靠右对齐）：依次排列 **Element C (Resource Tags)** 和 **Element B (Multiplier Tag)**。
   - **顺序要求**: [Title] ............ [Element C] [Element B]

3. **高级层级与遮罩逻辑 (Z-Index & Masking)**:
   - **Element A (Title)** 必须处于底层 (z-0)。当文字很长时，它应该直接延伸到右侧标签的**下方**。
   - **Element C (Resource Tags)** 和 **Element B** 必须处于顶层 (z-10)，盖住文字。
   - **关键细节**: 为了美观，**Element C** (作为文字遇到的第一个遮挡物) 必须拥有一个背景渐变遮罩 (Gradient Mask)。
     - 效果：背景色应从左侧的 `transparent` 渐变到右侧的 `solid background color`。
     - 目的：让底层穿过的长文字呈现“淡出”或“半透明遮盖”的效果，而不是生硬地被切断。

4. **Tech Stack**:
   - Vue 3 (Composition API)
   - Tailwind CSS

请提供完整的 Vue 组件代码。