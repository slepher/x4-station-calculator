# x4-import-move Specification

## Purpose
将导入流程统一为 3-tab 视图，并抽离顶部视图切换组件，在保持原入口路径不变的前提下提升复用性与一致性。

## ADDED Requirements

### Requirement: Unified Import Modal With Three Tabs
系统 MUST 提供单一导入视图，包含 logic-flow、游戏蓝图、x4-station 字符串三个 Tab，并允许用户在一个 modal 内切换。

#### Scenario: Open from StationToolbar Import Button
**Given** 用户在 StationToolbar 点击 Import 按钮
**When** 导入 modal 打开
**Then** 用户可以看到并切换三个导入 Tab

#### Scenario: Open from ContextToolbar Logic-Flow Entry
**Given** 用户在 ContextToolbar 点击 logic-flow 导入入口
**When** 导入 modal 打开
**Then** 默认定位在 logic-flow Tab，并可继续导入流程

#### Scenario: Logic-Flow Body Is Embedded
**Given** 用户切换到 logic-flow Tab
**When** 查看导入区域
**Then** flow 导入主体直接内嵌显示
**And** 不通过按钮再弹出旧 flow 导入弹窗

### Requirement: Logic-Flow Import Target Follows Current Context
系统 MUST 不提供 logic-flow 导入目标手动切换入口，并按当前界面上下文自动决定导入目标。

#### Scenario: In Empire Overview
**Given** 当前在帝国总览界面
**When** 用户在 logic-flow 导入 Tab 执行导入
**Then** 系统按帝国导入逻辑执行

#### Scenario: In Station Context
**Given** 当前在空间站界面
**When** 用户在 logic-flow 导入 Tab 执行导入
**Then** 系统按空间站导入逻辑执行

### Requirement: Blueprint Import Uses File Upload With Strategy Selection
系统 MUST 将游戏蓝图导入改为文件上传流程，并在解析后展示模块数量再确认导入。

#### Scenario: Empire Context Auto Create Station
**Given** 当前在帝国总览界面并上传有效 XML 蓝图
**When** 用户确认导入
**Then** 系统自动新建空间站并导入该蓝图

#### Scenario: Station Context With Non-Empty Station
**Given** 当前在空间站界面且当前空间站非空并上传有效 XML 蓝图
**When** 用户确认导入
**Then** 系统弹出覆盖/添加/新空间站三选项供用户选择

#### Scenario: New Station Naming Rule
**Given** 用户选择“新空间站”导入
**When** XML 存在名称
**Then** 新空间站使用 XML 名称
**And** 若 XML 无名称则使用上传文件名（去扩展名）前 20 字符

### Requirement: x4-Station Import Accepts x4-game Share Format Only
系统 MUST 仅接受 x4-game 分享链接/串格式进行 x4-station 导入，不再支持 JSON 输入。

#### Scenario: Import by x4-game Link in Empire Overview
**Given** 当前在帝国总览界面且输入有效 x4-game 分享串
**When** 用户确认导入
**Then** 系统新建空间站并导入模块
**And** 新建空间站名称使用 `empire.new_station_name`（与“新建空间站”按钮一致）

#### Scenario: Import by x4-game Link in Station Context
**Given** 当前在空间站界面且输入有效 x4-game 分享串
**When** 用户确认导入
**Then** 系统覆盖当前活动空间站模块配置

### Requirement: Extract Top View Switch Component
系统 MUST 将 StationToolbar 顶部 production/flow/ship-build 切换按钮抽离为独立可复用组件。

#### Scenario: View Switching Works After Extraction
**Given** 用户在顶部视图切换组件上点击任一视图
**When** 触发切换
**Then** active view 更新且视觉样式与原行为一致
