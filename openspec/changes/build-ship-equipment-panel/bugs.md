# Bug Reports

## Bug: Picker展开后material未隐藏且宽度未变化

- **ID**: BUG-001
- **Description**: 点击槽位打开Picker时，期待行为是Picker展开且material面板隐藏，但实际上Picker虽然展开了，但宽度没变（应该变宽），material面板也没有隐藏
- **Steps to Reproduce**:
  1. 进入船只建造视图，选择一艘船（如大太刀）
  2. 点击任一槽位（如weapon槽位）
  3. 观察Picker和Material面板的状态
- **Expected Behavior**: Picker展开（宽度增加），Material面板隐藏
- **Actual Behavior**: Picker展开但宽度未变化，Material面板仍然显示
- **Status**: Fixed
- **Related Test**: 4.1 BUG-001: 点击槽位打开Picker后material未隐藏且宽度未变化
- **Root Cause**: handlePickerOpenChange 中尝试修复但仍未完全解决，需要进一步调试
