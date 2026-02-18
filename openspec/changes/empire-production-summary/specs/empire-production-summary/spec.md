# Empire Production Summary Specification

## Purpose
描述帝国级生产汇总视图的能力，包括缓存机制、数据聚合逻辑和 UI 展示。

## Requirements

### Requirement: 空间站流量缓存 (Station Flow Cache)
系统 SHALL 在 EmpireStore 中维护每个空间站的流量分析缓存：
- 缓存键为 `stationId`，值为 `GroupedFlows` 对象
- 初始化时为所有空间站执行 `analyzeWareFlow` 并缓存结果
- 空间站模块更新时自动更新对应的缓存

#### Scenario: 初始化缓存
- **前提** EmpireStore 初始化完成
- **当** 系统加载帝国数据
- **那么** 系统 SHALL 为每个空间站执行 `analyzeWareFlow`
- **并且** 结果 SHALL 存储到 `stationFlowCache` 中

#### Scenario: 更新缓存
- **前提** 用户修改空间站模块
- **当** `updateStationModules` 被调用
- **那么** 系统 SHALL 重新计算该空间站的流量分析
- **并且** 更新 `stationFlowCache` 中对应的缓存

### Requirement: 补给组聚合 (Supply Group Aggregation)
系统 SHALL 从各空间站的 `rateGroups.supply` 中直接获取补给组数据：
- 按 `wareId` 聚合所有空间站的补给数据
- 汇总 `production`、`consumption`、`workforceConsumption`、`netRate`

#### Scenario: 补给组数据聚合
- **前提** 多个空间站有补给消耗
- **当** 系统计算帝国级补给组
- **那么** 系统 SHALL 从各站的 `rateGroups.supply` 获取数据
- **并且** 按 `wareId` 汇总所有补给数据

### Requirement: 产品组与运营组聚合 (Products and Operations Aggregation)
系统 SHALL 从各空间站的 `rateGroups.operations` 和 `rateGroups.positive`（过滤 `warePriority > 0`）中获取候选数据，汇总后根据 `netRate` 归类：
- `netRate > 0` 归为产品组
- `netRate < 0` 归为运营组

#### Scenario: 产品组数据聚合
- **前提** 某物品在多个空间站有产出和消耗
- **当** 系统计算帝国级产品组
- **那么** 系统 SHALL 从各站的 `rateGroups.operations` 获取数据
- **并且** 从各站的 `rateGroups.positive` 中过滤 `warePriority > 0` 的数据
- **并且** 汇总后 `netRate > 0` 的物品 SHALL 归为产品组

#### Scenario: 运营组数据聚合
- **前提** 某物品在多个空间站有消耗
- **当** 系统计算帝国级运营组
- **那么** 系统 SHALL 使用与产品组相同的数据源
- **并且** 汇总后 `netRate < 0` 的物品 SHALL 归为运营组

### Requirement: 帝国视图组件 (Empire View Component)
系统 SHALL 提供 `EmpireWareFlowsDashboard` 组件，复制 `StationWareFlowsDashboard` 的两级子模块结构：
- 一级子模块：`EmpireWareFlowGroup`（分组容器）
- 二级子模块：`EmpireWareFlow`（单个资源流项）

#### Scenario: 组件渲染
- **前提** 用户进入帝国总览界面
- **当** `activeStationId` 为 null
- **那么** 系统 SHALL 渲染 `EmpireWareFlowsDashboard` 组件
- **并且** 组件 SHALL 显示产品组、运营组、补给组三个分组

### Requirement: 双视图切换 (Dual View Switching)
系统 SHALL 在帝国视图中提供数量视图和经济视图切换：
- 数量视图：显示净产量（/h）
- 经济视图：显示经济价值（Credits/h）

#### Scenario: 数量视图显示
- **前提** 用户在帝国总览界面
- **当** 用户选择数量视图
- **那么** 系统 SHALL 显示每个物品的净产量
- **并且** 分组标题 SHALL 显示为"产品"、"运营"、"补给"

#### Scenario: 经济视图显示
- **前提** 用户在帝国总览界面
- **当** 用户选择经济视图
- **那么** 系统 SHALL 显示每个物品的经济价值
- **并且** 分组标题 SHALL 显示为"产品收入"、"运营支出"、"补给"

### Requirement: 产物明细展示 (Contribution Details Display)
系统 SHALL 在展开物品明细时显示各空间站的贡献：
- 空间站名称
- 该空间站对该物品的产出/消耗量

#### Scenario: 展开明细
- **前提** 用户点击某个物品
- **当** 明细面板展开
- **那么** 系统 SHALL 显示所有贡献该物品的空间站
- **并且** 每个空间站 SHALL 显示名称和产出/消耗量
- **并且** 产出 SHALL 显示为正数，消耗 SHALL 显示为负数

### Requirement: 补给组收支显示 (Supply Group Income/Expense Display)
补给组 SHALL 根据净产量的正负显示为"补给收入"或"补给支出"：
- `netRate > 0`：补给收入
- `netRate < 0`：补给支出

#### Scenario: 补给收入显示
- **前提** 某补给物品净产量为正
- **当** 用户查看经济视图
- **那么** 该物品 SHALL 显示为"补给收入"

#### Scenario: 补给支出显示
- **前提** 某补给物品净产量为负
- **当** 用户查看经济视图
- **那么** 该物品 SHALL 显示为"补给支出"
