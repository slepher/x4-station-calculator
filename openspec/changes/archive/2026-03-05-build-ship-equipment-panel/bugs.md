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

## Bug: 候选数为0时的逻辑判断错误

- **ID**: BUG-002
- **Description**: 将 isSingleCandidate 判断条件从 `=== 1` 改为 `=== 0`，但这导致当没有候选装备时也触发自动选择逻辑
- **Steps to Reproduce**: 待复现
- **Expected Behavior**: 当候选数为 0 时不应触发自动选择
- **Actual Behavior**: 待确认
- **Status**: New
- **Related Test**: 待添加

## Bug: Tag 组合过滤后候选缺失

- **ID**: BUG-003
- **Description**: 在大太刀飞船的装备 Picker 中，同时选择 Tag 过滤条件“导弹”和“高级”后，候选列表只显示 3 个导弹发射器，未显示预期的全部武器+导弹候选。
- **Steps to Reproduce**:
  1. 选择飞船“大太刀”
  2. 打开任一武器槽位的 Picker
  3. 在 Tag 过滤中同时选择“导弹”和“高级”
  4. 观察候选列表
- **Expected Behavior**: 显示所有符合筛选预期的 7 个候选（武器 + 导弹）
- **Actual Behavior**: 仅显示 3 个导弹发射器
- **Status**: Verified
- **Related Test**: tests/e2e/build-ship-equipment-panel/bug-build-ship-equipment-panel.spec.ts (4.6), tests/e2e/build-ship-equipment-panel/bugfix-build-ship-equipment-panel.spec.ts (4.7)
- **Fix Notes**: `ShipBuildPanelFit.vue` 将 Tag 组合过滤从交集（`every`）改为并集（`some`），使“导弹+高级”并选时展示两类候选合集
- **Verification Evidence**:
  - 复现前命令：`npx playwright test tests/e2e/build-ship-equipment-panel/bug-build-ship-equipment-panel.spec.ts -g "4.6 BUG-003: Tag 组合过滤后候选缺失 - 修复前"` -> Pass（候选数=3）
  - 修复后命令：`npx playwright test tests/e2e/build-ship-equipment-panel/bugfix-build-ship-equipment-panel.spec.ts -g "4.7 BUG-003"` -> Pass（候选数=7）
  - 修复后回归复现命令：`npx playwright test tests/e2e/build-ship-equipment-panel/bug-build-ship-equipment-panel.spec.ts -g "4.6 BUG-003"` -> Fail（Expected 3, Received 7）

## Bug: 更换飞船后 Picker 收起但 Fit 面板仍保持展开宽度

- **ID**: BUG-004
- **Description**: 打开任意槽位展开 Picker 后，点击“更换飞船”并完成切换，Picker 会被收起，但 `PanelFit` 仍保持展开态宽度，未恢复到未展开布局。
- **Steps to Reproduce**:
  1. 进入船只建造页面并选择任意飞船
  2. 点击任意槽位，展开 Picker
  3. 点击“更换飞船”
  4. 完成新飞船选择并返回配装界面
  5. 观察 Fit 面板宽度与布局状态
- **Expected Behavior**: 更换飞船后应同时取消 Picker 展开状态，并恢复为未展开模式（Fit 面板宽度缩回）
- **Actual Behavior**: Picker 收起，但 Fit 面板仍维持展开宽度
- **Status**: Verified
- **Related Test**: tests/e2e/build-ship-equipment-panel/bug-build-ship-equipment-panel.spec.ts (4.8), tests/e2e/build-ship-equipment-panel/bugfix-build-ship-equipment-panel.spec.ts (4.8)
- **Fix Notes**: 在 `ShipBuildView.vue` 监听 `selectedShipId` 变化，强制重置 `isPickerOpen/showMaterial/pickerTarget/highlightedEquipmentId/currentSlotType/currentEquipmentId/currentIsShield`，避免更换飞船后保留旧的展开态布局。
- **Verification Evidence**:
  - 复现前命令：`npx playwright test tests/e2e/build-ship-equipment-panel/bug-build-ship-equipment-panel.spec.ts -g "4.8 BUG-004"` -> Pass（宽度仍为 `col-span-8`）
  - 修复后命令：`npx playwright test tests/e2e/build-ship-equipment-panel/bugfix-build-ship-equipment-panel.spec.ts -g "4.8 BUG-004"` -> Pass（宽度回到 `col-span-4`，Material 显示）
  - 修复后回归复现命令：`npx playwright test tests/e2e/build-ship-equipment-panel/bug-build-ship-equipment-panel.spec.ts -g "4.8 BUG-004"` -> Fail（Expected `col-span-8`, Received `col-span-4`）
