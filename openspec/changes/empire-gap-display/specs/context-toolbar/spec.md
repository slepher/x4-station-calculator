# Context Toolbar Specification

## Purpose
描述动态工具栏能力，根据当前选中的 Tab 显示不同内容，高度固定为 56px。

## MODIFIED Requirements

### Requirement: 技术与运营组 (Tech & Ops Group)
第三组 SHALL 包含以下控件：
- **[下拉菜单] 偏好种族**: 选项包括 Argon/Terran/Teladi 等
- **[按钮开关] 工人运算**: 映射到 settings.considerWorkforceForAutoFill
- **[按钮开关] 站内补给**: 映射到 settings.internalSupply
- **[按钮开关] 显示缺口**: 映射到 settings.showEmpireGaps，控制是否在空间站视图显示帝国缺口

#### Scenario: 切换工人运算
- **前提** 用户查看工人运算开关
- **当** 用户点击开关切换为 ON 时
- **那么** settings.considerWorkforceForAutoFill SHALL 设为 true
- **并且** 按钮 SHALL 变为绿色
- **并且** 系统 SHALL 计算居住需求和产出加成

#### Scenario: 切换站内补给
- **前提** 用户查看站内补给开关
- **当** 用户点击开关切换为 OFF 时
- **那么** settings.supplyWorkforceBonus SHALL 设为 false
- **并且** 按钮 SHALL 变为灰色
- **并且** calculateAutoFill SHALL 不生成补给区

#### Scenario: 切换显示缺口
- **前提** 用户查看显示缺口开关
- **当** 用户点击开关切换为 ON 时
- **那么** settings.showEmpireGaps SHALL 设为 true
- **并且** 按钮 SHALL 变为绿色
- **并且** 空间站视图 SHALL 显示帝国缺口分组

#### Scenario: 关闭显示缺口
- **前提** 用户查看显示缺口开关且当前为 ON
- **当** 用户点击开关切换为 OFF 时
- **那么** settings.showEmpireGaps SHALL 设为 false
- **并且** 按钮 SHALL 变为灰色
- **并且** 空间站视图 SHALL 隐藏帝国缺口分组
