## Bug: 简化模式冲突判定误伤炮塔+护盾组合
- **ID**: BUG-001
- **Description**: 在标准模式中为同一组同时选择主槽位（如炮塔/引擎）与其从属护盾后，系统错误提示“同类型已存在多种装备，无法切换到简化模式”，导致简化模式切换按钮被禁用。
- **Steps to Reproduce**:
  1. 进入 `ship-build`，选择存在主槽位+从属护盾的飞船。
  2. 在标准模式下，为同一标签中的主槽位选择任意装备。
  3. 在同一标签中的护盾区选择任意装备。
  4. 观察简化模式切换按钮状态。
- **Expected Behavior**: 主槽位与从属护盾属于不同聚合桶，二者同时已选不应触发冲突；简化模式应可切换。
- **Actual Behavior**: 系统将该组合误判为“同类型多装备冲突”，简化模式按钮置灰并显示禁用提示。
- **Status**: Verified
- **Related Test**: `openspec/changes/ship-build-equipment/test_tasks.md` - `3.1 场景：Bug修复验证 BUG-001（主槽位+从属护盾不再误触发冲突）`
