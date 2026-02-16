# Station Workbench Specification

## Purpose
描述空间站工作台（StationWorkbench）的整体布局结构，作为应用的主容器，协调工具栏、规划面板、资源流仪表盘和建设仪表盘的协作关系。

## Requirements

### Requirement: 整体布局结构 (Overall Layout Structure)
系统 SHALL 采用垂直布局，顶部为工具栏，下方为根据视图模式切换的内容区域。
- **工具栏区域**: 固定在顶部，包含视图切换、功能按钮、标题编辑和语言选择。
- **内容区域**: 根据当前视图模式（production/flow）动态渲染不同的布局。

### Requirement: 工具栏组件 (Toolbar Component)
工具栏 SHALL 包含以下功能区块，从左到右排列：
- **视图切换器**: 双按钮组，切换"量化生产"和"逻辑组网"视图。
- **功能按钮组**: 新建、保存、另存为、加载、分享、导入。
- **标题区域**: 居中显示当前方案名称，支持点击编辑。
- **语言选择器**: 右侧位置，切换界面语言。

#### Scenario: 视图切换
- **前提**: 用户正在查看工作台
- **当** 用户点击视图切换按钮
- **那么** 内容区域 SHALL 切换到对应的视图布局
- **并且** 当前激活的按钮 SHALL 显示高亮样式

#### Scenario: 标题编辑
- **前提** 用户查看工具栏标题
- **当** 用户点击标题区域
- **那么** 标题 SHALL 变为可编辑输入框
- **并且** 用户按 Enter 或点击确认按钮后保存新标题

### Requirement: 量化生产视图布局 (Production View Layout)
当 `activeView` 为 `production` 时，内容区域 SHALL 采用 12 列网格布局：
- **左侧 (3列)**: StationPlanningPanel - 模块规划面板
- **中间 (5列)**: StationWareFlowsDashboard - 资源流仪表盘
- **右侧 (4列)**: StationDashboard - 建设仪表盘

### Requirement: 逻辑组网视图布局 (Logical Flow View Layout)
当 `activeView` 为 `flow` 时，内容区域 SHALL 采用垂直堆叠布局：
- **候选区**: LogicFlowCandidateZone - 展示可拖拽的产物候选卡片
- **规划区**: LogicFlowPlanningZone - 产业链拓扑画布

### Requirement: 状态监控组件 (Status Monitor)
系统 SHALL 在工作台内包含一个状态监控组件，用于显示临时消息和状态反馈。
