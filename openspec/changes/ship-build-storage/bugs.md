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
- **Related Test**: `openspec/changes/ship-build-storage/test_tasks.md` - `3.11 Bug修复验证 BUG-SBS-001`
