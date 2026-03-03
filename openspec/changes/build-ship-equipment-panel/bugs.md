# Bugs: build-ship-equipment-panel

## Bug: 标准模式槽位分组未生效

- **ID**: BUG-001
- **Description**: 在标准模式（connection 模式）下，选择阿斯加德战列舰，切换到 T（turret）槽位类型时，显示 L1-L8 和 M1-M3 共 11 个槽位，已超过 8 个，但仍然显示在 1 行内，未按 size 分成两行显示
- **Steps to Reproduce**:
  1. 选择更换飞船
  2. 选择 XL 战列舰
  3. 选择阿斯加德
  4. 切换到 T 槽位类型
  5. 观察槽位显示（显示 L1-L8, M1-M3 共 11 个）
- **Expected Behavior**: 当槽位数量 > 8 时，应按 size 分成多行显示（large 一行，medium 一行）
- **Actual Behavior**: 11 个槽位全部显示在 1 行内
- **Status**: Confirmed
- **Related Test**: 待添加
- **Fix Notes**: 问题在于使用了 `slotTargets`（只包含当前激活的槽位），应改为使用 `connectionRows`（包含所有槽位）

## Bug: 候选数为0时的逻辑判断错误

- **ID**: BUG-002
- **Description**: 将 isSingleCandidate 判断条件从 `=== 1` 改为 `=== 0`，但这导致当没有候选装备时也触发自动选择逻辑
- **Steps to Reproduce**: 待复现
- **Expected Behavior**: 当候选数为 0 时不应触发自动选择
- **Actual Behavior**: 待确认
- **Status**: New
- **Related Test**: 待添加
