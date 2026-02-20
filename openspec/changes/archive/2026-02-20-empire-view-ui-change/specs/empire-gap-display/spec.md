# Empire Gap Display Specification

## Purpose
描述空间站视图中帝国运营/补给区域的标题单位表达与明细数量样式一致性要求。

## ADDED Requirements

### Requirement: 帝国资源区域标题单位展示 (Empire Section Title Unit Display)
系统 SHALL 在空间站视图中帝国资源相关区域使用基础标题文案，并移除独立标签：
- 资源视图标题 SHALL 显示为 `资源视图`
- 经济视图标题 SHALL 显示为 `经济视图`
- 头部 SHALL 不再显示“每小时流量”标签

#### Scenario: 资源视图标题显示
- **前提** 用户在空间站视图
- **当** 用户选择资源视图
- **那么** 系统 SHALL 显示标题 `资源视图`
- **并且** 头部 SHALL 不显示“每小时流量”标签

#### Scenario: 经济视图标题显示
- **前提** 用户在空间站视图
- **当** 用户选择经济视图
- **那么** 系统 SHALL 显示标题 `经济视图`
- **并且** 头部 SHALL 不显示“每小时流量”标签

## MODIFIED Requirements

### Requirement: 缺口数据展开明细 (Gap Item Detail Expansion)
系统 SHALL 支持展开缺口项查看各空间站贡献，并与帝国总览及 `StationWareFlow.vue` 的数量展示保持一致：
- 点击缺口项可展开明细
- 明细显示各空间站对该缺口的贡献
- 空间站名称行 SHALL 使用“数量 + x + 名称”三段式结构
- 字体、`x` 的显示、间距 SHALL 与 `StationWareFlow.vue` 一致

#### Scenario: 展开缺口明细
- **前提** 用户查看帝国缺口分组
- **当** 用户点击某个缺口项
- **那么** 系统 SHALL 展开该缺口项的明细
- **并且** 明细 SHALL 显示各空间站对该缺口的贡献
- **并且** 每个空间站名称行 SHALL 以“数量 + x + 名称”展示
