# Test Task List: WareFlow UI Refactor

- [x] **Test Case 1: Title Style Verification**
  - **描述**: 验证 `StationWareFlowsDashboard` 标题是否应用了正确的样式类。
  - **操作步骤**:
    - 加载 WareFlow 仪表盘。
    - 检查标题元素 (`.header-title`)。
    - 验证其计算样式包含 `text-slate-100` (rgb(241, 245, 249)) 和 `font-bold`。

- [x] **Test Case 2: Switcher Button Style Verification**
  - **描述**: 验证视图切换按钮在激活和非激活状态下的样式。
  - **操作步骤**:
    - 检查 "Quantity" 按钮（默认激活）。
    - 验证其背景色是否为蓝色系 (`rgba(14, 165, 233, 0.2)`) 且文字为天蓝色。
    - 检查 "Volume" 按钮（非激活）。
    - 验证其文字颜色为灰色 (`text-slate-500`)。
    - 点击 "Volume" 按钮。
    - 验证 "Volume" 按钮变为激活样式，"Quantity" 变为非激活样式。
