# Station Workbench Specification

## Purpose
描述空间站工作台（StationWorkbench）的整体布局结构，作为应用的主容器，协调工具栏、标签栏、动态工具栏和内容区域的协作关系。

## MODIFIED Requirements

### Requirement: 整体布局结构 (Overall Layout Structure)
系统 SHALL 采用垂直布局，从上到下分为四个部分：
- **顶栏**: 保存/加载/分享按钮（保持不变）
- **标签栏**: 用于切换"帝国总览"和"各个分站"
- **动态工具栏**: 高度固定 56px，根据当前选中的 Tab 显示不同内容
- **内容区域**: 根据选中的 Tab 显示总览视图或分站三列布局

#### Scenario: 布局层级
- **前提** 用户打开应用
- **当** 工作台渲染时
- **那么** 顶栏 SHALL 显示在最上方
- **并且** 标签栏 SHALL 紧随顶栏下方
- **并且** 动态工具栏 SHALL 紧随标签栏下方
- **并且** 内容区域 SHALL 占据剩余空间

### Requirement: 内容区域切换 (Content Area Switching)
内容区域 SHALL 根据当前选中的 Tab 动态切换：
- **选中"帝国总览"**: 显示总览视图（"Coming Soon" 占位符）
- **选中"分站"**: 显示现有的三列布局（模块列表、资源产出、建设成本）

#### Scenario: 切换到帝国总览
- **前提** 用户点击"帝国总览"标签
- **当** 视图切换时
- **那么** 内容区域 SHALL 显示总览视图
- **并且** 总览视图 SHALL 显示 "Coming Soon" 占位符

#### Scenario: 切换到分站视图
- **前提** 用户点击某个分站标签
- **当** 视图切换时
- **那么** 内容区域 SHALL 显示三列布局
- **并且** 数据源 SHALL 绑定到当前选中的分站对象

### Requirement: 分站视图数据绑定 (Station View Data Binding)
分站视图 SHALL 通过当前激活分站标识（`currentStationId`）绑定数据源，并通过统一代理访问分站运行态：
- `StationPlanningPanel`: 绑定到当前分站的 `plannedModules`
- `StationWareFlowsDashboard`: 绑定到当前分站的资源流计算结果
- `StationDashboard`: 绑定到当前分站的建设成本与汇总计算结果

#### Scenario: 分站数据隔离
- **前提** 用户切换到分站 A
- **当** 用户修改模块配置时
- **那么** 修改 SHALL 仅影响分站 A 的运行态数据
- **并且** 其他分站的数据 SHALL 不受影响

#### Scenario: 切站后视图同步
- **前提** 帝国中至少有两个分站
- **当** 用户从分站 A 切换到分站 B
- **那么** 三列视图 SHALL 同步显示分站 B 的状态与计算结果
- **并且** 分站 A 的可见数据 SHALL 不再出现在分站 B 视图

#### Scenario: 可写代理兼容
- **前提** 规划区组件通过 `v-model` 绑定 `plannedModules`
- **当** 用户执行拖拽、增删或数量修改
- **那么** 变更 SHALL 写入当前分站运行态
- **并且** 相关派生模块与资源流 SHALL 被同步刷新

## ADDED Requirements

### Requirement: 标签栏组件集成 (Tab Bar Integration)
工作台 SHALL 包含标签栏组件，用于管理帝国总览和各分站的切换。

#### Scenario: 标签栏渲染
- **前提** 工作台初始化完成
- **当** 标签栏组件渲染时
- **那么** 标签栏 SHALL 显示所有分站标签
- **并且** 当前激活的标签 SHALL 有高亮样式

### Requirement: 动态工具栏组件集成 (Context Toolbar Integration)
工作台 SHALL 包含动态工具栏组件，根据当前选中的 Tab 显示不同内容。

#### Scenario: 工具栏内容切换
- **前提** 用户切换标签
- **当** 选中的 Tab 变化时
- **那么** 工具栏内容 SHALL 动态更新
- **并且** 工具栏高度 SHALL 保持 56px 不变
