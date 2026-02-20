# Empire Production Summary Specification

## Purpose
描述帝国总览资源展示的标题单位表达与明细数量样式一致性要求。

## MODIFIED Requirements

### Requirement: 双视图切换 (Dual View Switching)
系统 SHALL 在帝国视图中提供数量视图和经济视图切换，并使用基础标题文案：
- 数量视图标题 SHALL 显示为 `资源视图`
- 经济视图标题 SHALL 显示为 `经济视图`
- 帝国视图头部 SHALL 不再显示“每小时流量”标签

#### Scenario: 数量视图标题显示
- **前提** 用户在帝国总览界面
- **当** 用户选择数量视图
- **那么** 系统 SHALL 显示标题 `资源视图`
- **并且** 头部 SHALL 不显示“每小时流量”标签

#### Scenario: 经济视图标题显示
- **前提** 用户在帝国总览界面
- **当** 用户选择经济视图
- **那么** 系统 SHALL 显示标题 `经济视图`
- **并且** 头部 SHALL 不显示“每小时流量”标签

### Requirement: 产物明细展示 (Contribution Details Display)
系统 SHALL 在展开物品明细时显示各空间站贡献，并将空间站数量展示与 `StationWareFlow.vue` 保持一致：
- 明细行 SHALL 使用“数量 + x + 名称”的三段式结构
- 数量来源 SHALL 使用既有 `stationCount`（对应 `StationPlan.count`）
- 字体、`x` 的样式、间距 SHALL 与 `StationWareFlow.vue` 的明细数量展示一致
- 该展示变更 SHALL 不改变产出/消耗量计算逻辑

#### Scenario: 展开明细显示一致样式
- **前提** 用户点击某个物品
- **当** 明细面板展开
- **那么** 系统 SHALL 显示所有贡献该物品的空间站
- **并且** 每个空间站名称行 SHALL 以“数量 + x + 名称”展示

#### Scenario: 数量为 1 的展示
- **前提** 某空间站 `stationCount` 为 1
- **当** 用户查看该资源明细行
- **那么** 系统 SHALL 仍按“数量 + x + 名称”结构展示
- **并且** 视觉样式 SHALL 与 `StationWareFlow.vue` 保持一致
