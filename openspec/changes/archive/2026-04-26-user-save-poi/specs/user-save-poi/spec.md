# User Save POI Specification

## Purpose

将存档中的兴趣点按分类、可见性、坐标列表与地图叠加层统一组织，形成完整的 POI 浏览与定位工作流。

## ADDED Requirements

### Requirement: Save POI Category Navigation

系统 MUST 提供分类导航页作为进入 POI 详情的入口。

#### Scenario: 用户进入分类页

- **前提** 用户已从存档首页进入 POI 流程
- **当** 分类页渲染
- **那么** 系统 SHALL 显示 7 个 POI 分类
- **并且** 每个分类 SHALL 显示数量与进入详情按钮

### Requirement: Save POI Visibility Control

系统 MUST 通过地图右上角控件控制 POI 可见性。

#### Scenario: 用户勾选或取消勾选分类

- **前提** 当前存在已选存档
- **当** 用户在右上角控件中切换某分类 checkbox
- **那么** 系统 SHALL 更新该分类在地图上的可见性

### Requirement: Save POI Coordinate List

系统 MUST 提供按星区分组的坐标列表与搜索。

#### Scenario: 用户在坐标列表搜索星区

- **前提** 用户已进入某分类的坐标列表
- **当** 用户输入星区关键词
- **那么** 系统 SHALL 仅显示匹配星区分组

### Requirement: Save POI Overlay and Tooltip

系统 MUST 在地图上渲染 save POI，并为其提供 tooltip。

#### Scenario: 用户点击地图上的 save POI

- **前提** 某类 POI 当前可见
- **当** 用户点击地图上的 save POI
- **那么** 系统 SHALL 显示对应 tooltip
- **并且** tooltip SHALL 使用与列表同源的数据与名称
