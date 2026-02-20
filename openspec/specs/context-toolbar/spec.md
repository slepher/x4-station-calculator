# Context Toolbar Specification

## Purpose
描述动态工具栏能力，根据当前选中的 Tab 显示不同内容，高度固定为 56px。

## Requirements

### Requirement: 工具栏高度固定 (Fixed Toolbar Height)
工具栏 SHALL 固定高度为 56px，不随内容变化。

#### Scenario: 工具栏高度一致性
- **前提** 用户切换不同标签
- **当** 工具栏内容变化时
- **那么** 工具栏高度 SHALL 保持 56px 不变

### Requirement: 帝国总览工具栏 (Empire Overview Toolbar)
当选中"帝国总览"标签时，工具栏 SHALL 显示极简模式：
- **方案总名称输入框**: 大号、无边框，用于修改整个规划文件的名称
- **右侧留空**: 或放置全局导出按钮

#### Scenario: 编辑帝国名称
- **前提** 用户选中"帝国总览"标签
- **当** 用户点击方案名称输入框
- **那么** 输入框 SHALL 变为可编辑状态
- **并且** 用户按 Enter 或失焦后保存新名称

### Requirement: 分站工具栏布局 (Station Toolbar Layout)
当选中任意分站标签时，工具栏 SHALL 显示单行紧凑布局，使用垂直分割线分为三组：
- **第一组**: 身份定义（导入、分站名称、类型徽章、数量）
- **第二组**: 环境参数（星区矿物、日光强度）
- **第三组**: 技术与运营（偏好种族、工人运算、站内补给）

#### Scenario: 分站工具栏显示
- **前提** 用户选中某个分站标签
- **当** 工具栏渲染时
- **那么** 工具栏 SHALL 显示三组控件
- **并且** 各组之间 SHALL 有垂直分割线

### Requirement: 身份定义组 (Identity Group)
第一组 SHALL 包含以下控件：
- **[图标按钮] 导入**: 点击弹出模态框，支持预设蓝图、复制现有分站、导入字符串
- **[输入框] 分站名称**: 无边框背景，加粗字体
- **[徽章] 类型**: 仅显示图标+简写（如 🏭 工业、📦 补给）
- **[组合输入] 数量**: 显示为 `x N` 的小胶囊样式，设置建造数量倍率

#### Scenario: 导入蓝图
- **前提** 用户点击导入按钮
- **当** 导入模态框打开时
- **那么** 用户 SHALL 能选择预设蓝图或粘贴导入字符串

#### Scenario: 编辑分站名称
- **前提** 用户查看分站工具栏
- **当** 用户点击分站名称输入框
- **那么** 输入框 SHALL 变为可编辑状态
- **并且** 编辑完成后自动保存

### Requirement: 环境参数组 (Environment Group)
第二组 SHALL 包含以下控件：
- **[徽章+气泡] 星区矿物**: 默认显示 `[💎 3]`，悬停/点击弹出多选菜单
- **[输入框] 日光强度**: 显示为 `☀️ [ 100 ] %`

#### Scenario: 星区矿物选择
- **前提** 用户点击星区矿物徽章
- **当** 多选菜单弹出时
- **那么** 用户 SHALL 能选择/取消选择矿物类型（矿石、硅、冰、氢气等）
- **并且** 徽章 SHALL 显示已选数量

#### Scenario: 日光强度调整
- **前提** 用户查看日光强度输入框
- **当** 用户修改数值时
- **那么** 分站的 settings.sunlight SHALL 更新
- **并且** 光伏发电效率 SHALL 重新计算

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

### Requirement: 偏好种族影响 (Race Preference Impact)
选择偏好种族后，系统 SHALL 自动修改该分站默认的模块类型：
- 居住舱类型
- 存储容器类型
- 光伏板类型

#### Scenario: 切换偏好种族
- **前提** 用户选择 Terran 作为偏好种族
- **当** 系统生成自动模块时
- **那么** 居住舱、存储容器、光伏板 SHALL 优先选择 Terran 类型模块
