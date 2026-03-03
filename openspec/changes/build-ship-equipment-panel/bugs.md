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

## Bug: 选择空候选槽后PanelEquipment不显示

- **ID**: BUG-002
- **Description**: 当前槽位有装备时，选择空候选槽（取消装备），PanelEquipment面板不显示。期待显示当前装备的数值。
- **Steps to Reproduce**:
  1. 进入船只建造视图，选择一艘船（如大太刀）
  2. 确保某槽位已有装备（如weapon槽位有武器）
  3. 点击该槽位打开Picker
  4. 选择空候选槽（取消装备）
  5. 观察PanelEquipment面板
- **Expected Behavior**: PanelEquipment显示当前装备的数值（因为还没有真正取消，只是选择了空候选）
- **Actual Behavior**: PanelEquipment面板不显示
- **Status**: Fixed
- **Related Test**: 待添加

## Bug: 无装备槽位打开Picker后候选槽无法点击

- **ID**: BUG-003
- **Description**: 当前槽位没有装备时，打开Picker后，候选槽无法点击。期待候选槽可以点击，点击后显示候选槽属性。
- **Steps to Reproduce**:
  1. 进入船只建造视图，选择一艘船（如大太刀）
  2. 选择一个没有装备的槽位（如新武器槽位）
  3. 点击该槽位打开Picker
  4. 尝试点击候选列表中的候选槽
  5. 观察PanelEquipment是否显示候选属性
- **Expected Behavior**: 候选槽可以点击，点击后PanelEquipment显示候选装备属性
- **Actual Behavior**: 候选槽点击后没有反应，PanelEquipment不显示
- **Status**: Fixed
- **Related Test**: 待添加
