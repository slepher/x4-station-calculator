# Empire Production Summary Specification

## Purpose
描述帝国级生产汇总视图的能力，包括缓存机制、数据聚合逻辑和 UI 展示。

## Requirements

### Requirement: 空间站数量字段 (Station Count Field)
系统 SHALL 在 `StationPlan` 中支持 `count` 字段：
- 默认值为 `1`
- 从 localStorage 加载时，如果 `count` 为 `null` 或 `undefined`，自动设为 `1`
- `count` 为 `0` 表示该空间站不参与帝国聚合计算
- `count` 大于 `1` 时，产出和消耗按倍数计算

#### Scenario: 加载旧数据迁移
- **前提** localStorage 中存在旧的空间站数据，无 `count` 字段
- **当** 系统加载空间站数据
- **那么** 系统 SHALL 将 `count` 设为 `1`

#### Scenario: 数量为 0 不参与计算
- **前提** 某空间站的 `count` 为 `0`
- **当** 系统计算帝国级聚合数据
- **那么** 该空间站 SHALL 被跳过
- **并且** 不计入帝国总览

#### Scenario: 数量倍数计算
- **前提** 某空间站的 `count` 为 `2`
- **当** 系统计算帝国级聚合数据
- **那么** 该空间站的产出和消耗 SHALL 乘以 `2`

### Requirement: 空间站数量 UI 绑定 (Station Count UI Binding)
系统 SHALL 在 ContextToolbar 中提供空间站数量输入框：
- 输入框绑定到 `activeStation.count`
- 最小值为 `0`
- 修改数量后自动更新 `lastUpdated`

#### Scenario: 修改空间站数量
- **前提** 用户选中某个空间站
- **当** 用户在 ContextToolbar 中修改数量
- **那么** `activeStation.count` SHALL 更新
- **并且** `activeStation.lastUpdated` SHALL 更新
- **并且** 帝国总览数据 SHALL 重新计算

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
- **当** `lastUpdated` 发生变化
- **那么** 系统 SHALL 重新计算该空间站的流量分析
- **并且** 更新 `stationFlowCache` 中对应的缓存

#### Scenario: 切换 tab 不更新缓存
- **前提** 用户从一个空间站切换到另一个
- **当** `activeStationId` 变化
- **那么** 系统 SHALL 不更新任何缓存

### Requirement: 补给组聚合 (Supply Group Aggregation)
系统 SHALL 从各空间站的 `rateGroups.supply` 中直接获取补给组数据：
- 按 `wareId` 聚合所有空间站的补给数据
- 汇总 `production`、`consumption`、`workforceConsumption`、`netRate`
- 跳过 `count` 为 `0` 的空间站
- 数据乘以 `count` 倍数

#### Scenario: 补给组数据聚合
- **前提** 多个空间站有补给消耗
- **当** 系统计算帝国级补给组
- **那么** 系统 SHALL 从各站的 `rateGroups.supply` 获取数据
- **并且** 按 `wareId` 汇总所有补给数据
- **并且** 数据 SHALL 乘以各站的 `count`

### Requirement: 产品组与运营组聚合 (Products and Operations Aggregation)
系统 SHALL 从各空间站的 `rateGroups.operations` 和 `rateGroups.positive`（过滤 `warePriority > 0`）中获取候选数据，并在归类时先判断补给归属：
- 如果 `wareId` 属于 `supply`，SHALL 优先归入补给组
- `netRate > 0` 归为产品组
- `netRate < 0` 归为运营组
- 跳过 `count` 为 `0` 的空间站
- 数据乘以 `count` 倍数

#### Scenario: 候选数据中的补给资源优先归类
- **前提** 某 `wareId` 同时出现在候选数据中并属于 `supply`
- **当** 系统执行帝国级归类
- **那么** 该 `wareId` SHALL 归入补给组
- **并且** SHALL 不参与产品组与运营组的 `netRate` 判定

#### Scenario: 产品组数据聚合
- **前提** 某物品在多个空间站有产出和消耗
- **当** 系统计算帝国级产品组
- **那么** 系统 SHALL 从各站的 `rateGroups.operations` 获取数据
- **并且** 从各站的 `rateGroups.positive` 中过滤 `warePriority > 0` 的数据
- **并且** 仅当该物品 `wareId` 不属于 `supply` 时参与产品组判定
- **并且** 汇总后 `netRate > 0` 的物品 SHALL 归为产品组
- **并且** 数据 SHALL 乘以各站的 `count`

#### Scenario: 运营组数据聚合
- **前提** 某物品在多个空间站有消耗
- **当** 系统计算帝国级运营组
- **那么** 系统 SHALL 使用与产品组相同的数据源
- **并且** 仅当该物品 `wareId` 不属于 `supply` 时参与运营组判定
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
- 空间站数量（如果大于 1）
- 该空间站对该物品的产出/消耗量

#### Scenario: 展开明细
- **前提** 用户点击某个物品
- **当** 明细面板展开
- **那么** 系统 SHALL 显示所有贡献该物品的空间站
- **并且** 每个空间站 SHALL 显示名称和产出/消耗量
- **并且** 如果空间站 `count > 1`，SHALL 显示数量倍数

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

### Requirement: 产物过滤逻辑仅针对空间站 (Station-Scoped Product Filtering)
系统 SHALL 在空间站缓存层进行产物过滤，而非聚合后过滤：
- 每个空间站独立判断产物的优先级
- 如果某产物在该空间站的 `priorityLevel === 0`，即使净产量为正，也不计入帝国总览
- 过滤发生在 `refreshStationFlowCache` 中，调用 `filterGroupedFlowsByPriority` 函数

#### Scenario: 非主要产物不计入帝国总览
- **前提** 空间站 A 的主要产物包含电子黏土（priorityLevel = 2）
- **并且** 空间站 B 的 autoIndustryModule 顺带产出电子黏土（priorityLevel = 0）
- **当** 系统计算帝国总览
- **那么** 电子黏土的明细 SHALL 仅显示空间站 A 的数据
- **并且** 空间站 B 的顺带产出 SHALL 不计入帝国总览

#### Scenario: 缓存层过滤
- **前提** 某空间站计算流量分析完成
- **当** 系统存储缓存前
- **那么** 系统 SHALL 调用 `filterGroupedFlowsByPriority`
- **并且** `rateGroups.positive` 中 `priorityLevel === 0` 的资源 SHALL 被过滤掉
- **并且** `rateGroups.operations`、`rateGroups.supply`、`rateGroups.resources` SHALL 不受影响

### Requirement: 缓存更新触发 (Cache Update Trigger)
系统 SHALL 在空间站数据变化时自动更新缓存：
- `lockedWares` 变化时触发缓存更新
- `warePriority` 变化时触发缓存更新
- 模块变化时触发缓存更新
- 设置变化时触发缓存更新

#### Scenario: 锁定资源触发缓存更新
- **前提** 用户在空间站中锁定某个资源
- **当** `lockedWares` 更新
- **那么** `lastUpdated` SHALL 更新
- **并且** 该空间站的缓存 SHALL 重新计算

#### Scenario: 优先级变化触发缓存更新
- **前提** 用户修改某个资源的优先级
- **当** `warePriority` 更新
- **那么** `lastUpdated` SHALL 更新
- **并且** 该空间站的缓存 SHALL 重新计算
- **并且** 产物过滤 SHALL 基于新的优先级
