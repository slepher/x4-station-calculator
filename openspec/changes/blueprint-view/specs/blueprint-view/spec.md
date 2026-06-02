# Blueprint-View Specification

## Purpose

为蓝图产能界面提供蓝图配方目录功能的正式规格，定义侧边栏菜单、页面布局、蓝图数据展示和搜索过滤行为。

## ADDED Requirements

### Requirement: Sidebar Blueprint Recipe Menu

侧边栏在蓝图模式下 SHALL 显示「蓝图配方」菜单项，位于「研究」菜单之上。

#### Scenario: show in blueprint mode

- **前提** 当前界面为蓝图产能模式（`!hasSectors`）
- **当** 侧边栏渲染 fixedItems
- **那么** 「蓝图配方」菜单 SHALL 显示在 Overview 之下、Research 之上
- **并且** 菜单图标 SHALL 使用独立的 `blueprint.svg`

#### Scenario: hide in live mode

- **前提** 当前界面为实况（live/save-binding）模式（`hasSectors`）
- **当** 侧边栏渲染 fixedItems
- **那么** 「蓝图配方」菜单 SHALL NOT 显示

#### Scenario: click navigates to blueprint recipe page

- **前提** 用户在蓝图模式侧边栏中
- **当** 用户点击「蓝图配方」菜单
- **那么** 工作台 SHALL 切换到 `blueprint-recipe` 模式
- **并且** 页面 SHALL 展示蓝图配方内容

### Requirement: Blueprint Recipe Page Layout

蓝图配方页面 SHALL 采用左侧 type/class 导航 + 右侧蓝图列表的双栏布局，且无 ContextToolbar。

#### Scenario: no ContextToolbar

- **前提** 当前工作台模式为 `blueprint-recipe`
- **当** 蓝图产能界面渲染
- **那么** ContextToolbar SHALL NOT 显示

#### Scenario: left navigation by type and class

- **前提** `blueprints.json` 包含 `types` 和 `classes` 数组
- **当** 蓝图配方页面渲染左侧导航
- **那么** 导航 SHALL 按 `type`（module / ship / equipment）分组
- **并且** 每个 type 组 SHALL 可折叠展开
- **并且** 展开后 SHALL 显示该 type 下的所有 `class` 子项
- **并且** type 和 class 名称 SHALL 通过 `nameId` 走 i18n 本地化

#### Scenario: right side shows blueprints for selected class

- **前提** 用户在左侧导航选中某个 class
- **当** 右侧内容区渲染
- **那么** SHALL 展示该 class 下所有蓝图条目

### Requirement: Blueprint Item Display

每条蓝图条目 SHALL 显示本地化名称、原始 id、class、以及可选的 price、licence、factions、特殊标记。

#### Scenario: localized name via nameId

- **前提** 蓝图条目包含 `nameId` 字段
- **当** 渲染蓝图名称
- **那么** SHALL 通过 i18n 解析 `nameId` 获取本地化名称
- **并且** 如果 `nameId` 无法解析，SHALL 回退显示 `name` 字段（英文名）

#### Scenario: optional fields only when present

- **前提** 蓝图条目的 `price` 缺失或为 0，`licence` 缺失，`factions` 为空或无
- **当** 渲染该条目
- **那么** 对应字段 SHALL NOT 显示

#### Scenario: missiononly badge

- **前提** 蓝图条目 `missiononly: true`
- **当** 渲染该条目
- **那么** SHALL 显示「任务专属」badge

#### Scenario: noplayerblueprint badge

- **前提** 蓝图条目 `noplayerblueprint: true`
- **当** 渲染该条目
- **那么** SHALL 显示「不可获取」badge

### Requirement: Search and Filter

蓝图配方页面 SHALL 支持按名称、id、阵营名称搜索过滤蓝图列表。

#### Scenario: filter by search query

- **前提** 用户在搜索框中输入关键词
- **当** 搜索过滤生效
- **那么** 蓝图列表 SHALL 仅显示名称、id 或阵营名称包含关键词的条目

#### Scenario: empty state when no match

- **前提** 选中 class 的所有蓝图均不匹配搜索关键词
- **当** 渲染右侧内容区
- **那么** SHALL 显示「无结果」空状态提示

### Requirement: Player-Owned Highlighting (Future)

玩家已拥有蓝图的高亮显示 SHALL 仅在实况（live）模式下生效，蓝图模式 SHALL NOT 包含此功能。

#### Scenario: no owned highlight in blueprint mode

- **前提** 当前为蓝图模式
- **当** 渲染蓝图列表
- **那么** SHALL NOT 显示任何玩家已拥有的标记或高亮
