# Empire Gap Display Specification

## Purpose
描述空间站视图显示帝国运营/补给的功能，包括开关控制、分组展示和快速添加模块。

## ADDED Requirements

### Requirement: 显示缺口开关 (Show Empire Gaps Toggle)
系统 SHALL 在 ContextToolbar 的技术与运营组提供"显示缺口"开关：
- 开关位于"站内补给"旁边
- 开关绑定到 `settings.showEmpireGaps` 字段
- 默认关闭
- 开关状态持久化到 localStorage

#### Scenario: 开启显示缺口
- **前提** 用户选中某个空间站
- **当** 用户点击"显示缺口"开关切换为 ON
- **那么** `settings.showEmpireGaps` SHALL 设为 true
- **并且** 空间站视图 SHALL 显示帝国缺口分组

#### Scenario: 关闭显示缺口
- **前提** 用户选中某个空间站且"显示缺口"为 ON
- **当** 用户点击"显示缺口"开关切换为 OFF
- **那么** `settings.showEmpireGaps` SHALL 设为 false
- **并且** 空间站视图 SHALL 隐藏帝国缺口分组

### Requirement: 帝国运营显示 (Empire Operations Display)
系统 SHALL 在空间站视图顶部显示帝国运营：
- 数据来自 `empireGroupedFlows.operations` + `empireGroupedFlows.products` 的合并结果
- 过滤条件：`netRate < 0` 或当前有效 `priority > 0`
- priority 使用空间站内“修正后的优先级”计算结果
- 仅在资源视图显示，经济视图与体积视图不显示
- 如果运营分组为空，则不显示该分组
- 分组标题为"帝国运营"
- 分组内排序：tier 高的在前，同 tier 以字母序排序

#### Scenario: 显示帝国运营
- **前提** 用户开启"显示缺口"开关
- **并且** 帝国运营组存在满足过滤条件的资源
- **当** 用户查看资源视图
**那么** 系统 SHALL 在顶部显示"帝国运营"分组
- **并且** 分组内显示所有满足过滤条件的运营/产品资源

#### Scenario: 帝国运营为空时不显示
- **前提** 用户开启"显示缺口"开关
- **并且** 帝国运营组不存在满足过滤条件的资源
- **当** 用户查看资源视图
- **那么** 系统 SHALL 不显示"帝国运营"分组

### Requirement: 帝国补给显示 (Empire Supply Display)
系统 SHALL 在空间站视图顶部显示帝国补给：
- 数据来自 `empireGroupedFlows.supply`（不再按 `netRate` 过滤）
- 仅在资源视图显示，经济视图与体积视图不显示
- 如果补给分组为空，则不显示该分组
- 分组标题为"帝国补给"

#### Scenario: 显示帝国补给
- **前提** 用户开启"显示缺口"开关
- **并且** 帝国补给组存在资源
- **当** 用户查看资源视图
**那么** 系统 SHALL 在顶部显示"帝国补给"分组
- **并且** 分组内显示所有补给资源

#### Scenario: 帝国补给为空时不显示
- **前提** 用户开启"显示缺口"开关
- **并且** 帝国补给组不存在资源
- **当** 用户查看资源视图
**那么** 系统 SHALL 不显示"帝国补给"分组

### Requirement: 缺口项 + 按钮 (Gap Item Add Button)
系统 SHALL 为每个缺口项提供 + 按钮：
- + 按钮位于缺口项右侧，位置对应锁按钮
- 点击 + 按钮直接添加该资源对应的默认产线模块
- 缺口项不显示收藏按钮，该位置留空

#### Scenario: 点击 + 按钮添加模块
- **前提** 用户查看帝国缺口分组
- **当** 用户点击某个缺口项的 + 按钮
- **那么** 系统 SHALL 添加该资源对应的默认产线模块
- **并且** 缺口数据 SHALL 实时更新

#### Scenario: 缺口项不显示收藏按钮
- **前提** 用户查看帝国缺口分组
- **当** 缺口项渲染时
- **那么** 缺口项 SHALL 不显示收藏按钮
- **并且** 收藏按钮位置 SHALL 留空

### Requirement: 分组显示顺序 (Gap Group Display Order)
系统 SHALL 按以下顺序显示分组：
- 帝国运营 → 帝国补给 → 产品 → 运营 → 补给 → 资源

#### Scenario: 验证分组顺序
- **前提** 用户开启"显示缺口"开关
- **并且** 运营缺口和补给缺口都不为空
- **当** 用户查看资源视图
- **那么** 分组 SHALL 按以下顺序显示：
  1. 帝国运营
  2. 帝国补给
  3. 产品
  4. 运营
  5. 补给
  6. 资源

### Requirement: 缺口数据展开明细 (Gap Item Detail Expansion)
系统 SHALL 支持展开缺口项查看各空间站贡献：
- 点击缺口项可展开明细
- 明细显示各空间站对该缺口的贡献
- 与帝国总览的明细展示一致

#### Scenario: 展开缺口明细
- **前提** 用户查看帝国缺口分组
- **当** 用户点击某个缺口项
- **那么** 系统 SHALL 展开该缺口项的明细
- **并且** 明细 SHALL 显示各空间站对该缺口的贡献
