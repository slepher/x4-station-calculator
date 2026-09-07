# DLC UI 修复范围

## MODIFIED Requirements

### Requirement: Station Module DLC Tag Display
已添加非 base 模块的可见 DLC 标签 SHALL 使用游戏 i18n DLC 名称；base 不显示。

#### Scenario: 当前翻译标签
- **当** Terran 模块在中文规划列表渲染
- **那么** 标签显示人类的摇篮。

### Requirement: Existing Inactive Modules Stay Visible But Restricted
受限未激活模块 SHALL 保持可见、数量禁用并可删除。

#### Scenario: 数量禁用与删除
- **当** inactiveByDlc 为 true
- **那么** 数量输入禁用，删除操作继续可用。

#### Scenario: 限制关闭
- **当** inactiveByDlc 为 false 且没有其他 countDisabled 条件
- **那么** 数量可编辑。
