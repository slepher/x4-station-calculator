## Bug: 点击shield标签切换时无反应
- **ID**: BUG-SBS-001
- **Description**: 在Ship Build配装界面点击"S"（shield）标签切换到护盾槽位时，界面没有反应，选中的装备数量保持0/n，不更新。
- **Steps to Reproduce**:
  1. 进入ship-build，选择一艘飞船进入配装区。
  2. 点击"S"（shield）标签切换到护盾槽位。
  3. 观察group tabs和option cards是否显示。
- **Expected Behavior**: 切换到shield标签后，应显示护盾相关的group tabs，点击group后应显示护盾装备选项，点击装备后数量应更新（如0/1变为1/1）。
- **Actual Behavior**: 点击shield标签后界面无变化，group tabs区域为空或显示其他类型的内容，装备数量保持0/n。
- **Root Cause**: 有两个问题：
  1. `connectionRows` 只在 blueprint 有 shield 配置时才生成 shield rows（针对附加在 engine/weapon 上的 shield）
  2. `applyConnectionAssignment` 只处理 5 部分 key（附加 shield），不处理 4 部分 key（直接 shield slot）
- **Fix**:
  1. 修改 connectionRows 逻辑：始终为所有 slots 生成对应的 shield rows
  2. 修改 applyConnectionAssignment：区分直接 shield slot（4 部分 key）和附加 shield（5 部分 key）
- **Status**: Verified
- **Related Test**: `openspec/changes/ship-build-storage/test_tasks.md` - `3.12 Bug修复验证 BUG-SBS-001`

---

## Bug: 新建方案未正确重置状态
- **ID**: BUG-SBS-002
- **Description**: 点击新建按钮，在弹出的 SmartSaveDialog 中选择"覆盖并新建"后，页面仍然保持原来的飞船选择和蓝图配置，未能正确创建新方案。
- **Steps to Reproduce**:
  1. 进入 ship-build，选择一艘飞船并配置装备。
  2. 保存方案（使 isDirty = false）。
  3. 修改装备配置（使 isDirty = true）。
  4. 点击"新建"按钮。
  5. 在 SmartSaveDialog 中选择"覆盖并新建"。
- **Expected Behavior**: 选择"覆盖并新建"后，应清空当前飞船选择、筛选条件和蓝图配置，返回到初始状态。
- **Actual Behavior**: 页面仍然显示原来的飞船选择和蓝图配置，未能创建新方案。
- **Status**: New
- **Related Test**: 待添加

---

## Bug: 切换飞船未清空配装选中状态
- **ID**: BUG-SBS-003
- **Description**: 点击"更换飞船"按钮后返回选船列表，重新选择另一艘飞船时，原来的配装栏中仍然选中了原来飞船的装备。
- **Steps to Reproduce**:
  1. 进入 ship-build，选择一艘飞船（如大太刀）进入配装区。
  2. 配置引擎/护盾等装备。
  3. 点击"更换飞船"按钮。
  4. 选择另一艘同类飞船（如 Osaka 或其他 Terran M 级护卫舰）。
- **Expected Behavior**: 选择新飞船后，配装栏应显示新飞船的槽位，原来的装备选择应被清空。
- **Actual Behavior**: 配装栏中仍然显示原来飞船的选中装备（高亮状态）。
- **Note**: 需要更换同类型飞船（如 M 级护卫舰换 M 级护卫舰），因为不同级别飞船装备差异太大无法正确显示。
- **Status**: New
- **Related Test**: `openspec/changes/ship-build-storage/test_tasks.md` - `3.14`
