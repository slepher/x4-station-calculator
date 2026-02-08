# module-list-ui Specification

## Purpose
Enhance the module list UI with intelligent color coding, multi-level sorting, and tier-based prioritization to improve user navigation and visual distinction of different module types in X4 station calculator.
## Requirements
### Requirement: 规划区数量调整
系统SHALL提供快速调整规划模块数量的选项。

#### Scenario: 快速数量调整
- **前提** 用户需要快速调整规划区的模块数量
- **当** 用户点击1x, 2x, 3x, 5x, 10x选项按钮
- **那么** 规划区所有模块数量应按比例调整
- **并且** 保持与手动输入功能的兼容性

### Requirement: 劳动力加成选项位置调整和UI优化
系统SHALL优化劳动力加成选项的界面位置和用户体验。

#### Scenario: 选项位置移动
- **前提** 用户需要更直观地访问劳动力加成选项
- **当** 系统将计算劳动力加成选项移动到自动工业区标题栏
- **那么** 选项功能应保持不变
- **并且** 用户界面应更加直观易用

#### Scenario: 补给区选项移动
- **前提** 用户需要统一的管理界面
- **当** 系统将计算补给区劳动力加成选项移动到自动补给区标题栏
- **那么** 相关功能应正常工作
- **并且** 界面布局应更加协调

#### Scenario: 统一选项文字和tooltip
- **前提** 用户需要简洁的界面显示
- **当** 系统统一选项文字为"考虑工人效率加成"，工业区和补给区使用相同名称
- **那么** 文字说明应改为图标上的tooltip提示
- **并且** 界面简洁性应得到提高

#### Scenario: 点击事件传播阻止
- **前提** 用户需要精确的交互控制
- **当** 用户点击复选框时
- **那么** 应阻止点击事件传播到标题栏
- **并且** 防止触发标题栏折叠/展开

#### Scenario: 布局结构优化
- **前提** 用户需要精确的视觉对齐
- **当** 系统优化布局结构
- **那么** 应使用嵌套容器确保精确垂直对齐
- **并且** 调整CSS样式，固定容器高度，微调图标位置

### Requirement: 种族偏好选择
系统SHALL提供自动工业区的种族偏好选择功能。

#### Scenario: 种族下拉列表
- **前提** 用户需要为自动工业区选择偏好种族
- **当** 用户打开种族选择下拉列表
- **那么** 系统应从consumption.json加载可用种族列表
- **并且** 选择结果应影响生产计算逻辑

#### Scenario: 数据源集成
- **前提** 系统需要获取可用的种族数据
- **当** 初始化种族选择下拉列表
- **那么** 应从consumption数据源正确解析种族信息
- **并且** 下拉列表应显示完整的种族选项

### Requirement: 模块颜色编码系统
系统 SHALL 根据模块类型或类别为模块分配不同颜色，以改善视觉区分。

#### Scenario: 显示彩色模块标记
- **WHEN** 用户查看模块列表或搜索结果
- **THEN** 每个模块 SHALL 具有与其类型/类别相对应的彩色标记，而不是默认的蓝色

### Requirement: 按模块类型的颜色映射
系统 SHALL 通过解析来自 colors_final.xml 的游戏数据并将映射到 holomap 组件颜色来将模块类型映射到特定颜色：
- Production modules: 映射到 'holomap_component_production' -> 实际颜色
- Storage modules: 映射到 'holomap_component_storage' -> 实际颜色
- Habitation modules: 映射到 'holomap_component_habitation' -> 实际颜色
- Defense modules: 映射到 'holomap_component_defence' -> 实际颜色
- Dockarea modules: 映射到 'holomap_component_dockingbay' -> 实际颜色
- Connection modules: 映射到 'holomap_component_connection' -> 实际颜色
- Processing modules: 映射到 'holomap_component_processing' -> 实际颜色
- Venture platform modules: 映射到 'holomap_component_ventureplatform' -> 实际颜色
- Other modules: 使用基础颜色作为默认值

### Requirement: 远征组颜色逻辑
系统 SHALL 特殊处理远征组模块的颜色分配：
- WHEN 模块属于远征组 (group name 包含 'venture')
- THEN IF 模块类型包含 'dock' -> 映射到 'venturedock'
- AND IF 模块类型包含 'connection' -> 映射到 'ventureconnection'
- AND ELSE -> 映射到 'ventureplatform'

### Requirement: 模块排序逻辑
系统 SHALL 根据定义的层次结构对自动生成的模块列表中的模块进行排序，以改善用户导航。

#### Scenario: 对模块列表中的模块进行排序
- **WHEN** 生成模块列表
- **THEN** 模块 SHALL 根据定义的层次结构进行排序

### Requirement: 多级排序层次结构
系统 SHALL 使用多级层次结构对模块进行排序：
- 主级别：按模块类型分组
- 次级别：在每种类型内，按层级排序（较高等级优先）
- 第三级别：在同一层级内，按名称字母顺序排序
- 备用：使用基础颜色作为默认值

#### Scenario: 应用多级排序
- **WHEN** 用户查看模块列表
- **THEN** 模块 SHALL 按类型分组，每组按层级排序，然后按字母顺序排序

### Requirement: 层级(Tier)计算
系统 SHALL 实现物品生产链深度解析算法，以确定每个物品的层级：
- Tier 0: 基础材料 (无上游生产)
- Tier N: 高级产品 (需要 N 级生产链)

#### Scenario: 自动填充层级优先级
- **WHEN** 系统执行自动填充算法
- **THEN** 应优先处理高Tier物品的缺口
- **AND** 最终输出应按Tier降序排序

