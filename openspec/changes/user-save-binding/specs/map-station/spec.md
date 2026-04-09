# Map Station Specification

## Purpose
在地图工作台中提供完整的 `SaveBinding` 工作流，使用户可以从首页 binding 入口进入 Step 2 / Step 3，并完成星区组编辑、已有 station 绑定、导入新 station，以及空闲 empire station 的直接放置。

## ADDED Requirements

### Requirement: Binding Entry in Save Homepage

系统 MUST 在存档首页提供 binding 图标入口。

#### Scenario: 用户点击标题 binding 图标
- **前提** 用户位于某个 guid 分组的首页项
- **当** 用户点击标题 binding 图标
- **那么** 系统 SHALL 将该 guid 绑定到最新 time
- **并且** SHALL 进入 Step 2

### Requirement: Step 2 Sector Group Editing

系统 MUST 提供 Step 2 星区组编辑能力。

#### Scenario: 用户编辑 empire sector
- **前提** 用户已进入 Step 2
- **当** 用户展开某个 empire sector
- **那么** 系统 SHALL 允许编辑名称、定位星区、jumpRange、coverage 与连接星区

### Requirement: Step 3 Station Binding

系统 MUST 提供 Step 3 空间站绑定能力。

#### Scenario: 用户在 Step 3 绑定空间站
- **前提** 用户已进入某个 empire sector 的 Step 3
- **当** 用户通过 save station 的绑定入口选择候选 empire station
- **那么** 系统 SHALL 建立或更新对应 station binding
