# Ship Blueprint Favorite Specification

## Purpose
为飞船配装蓝图新增收藏功能，支持收藏/取消收藏、收藏状态持久化、菜单与模态框中展示收藏标记，以及收藏蓝图在列表中优先排列。

## ADDED Requirements

### Requirement: Favorite Toggle on Main Interface

**主界面收藏按钮**位于"载入飞船配装"按钮左侧，用于切换当前用户蓝图的收藏状态。

#### Scenario: Show Favorite Button for User Blueprint
- **前提**：用户已选择飞船，且当前活动蓝图是用户蓝图（非内置预设）。
- **当**：配装面板 header 渲染。
- **那么**：收藏按钮 SHALL 出现在"载入飞船配装"按钮左侧。
- **并且**：若已收藏，按钮显示实心星形图标。
- **并且**：若未收藏，按钮显示空心星形图标。

#### Scenario: Hide Favorite Button for Built-in Preset
- **前提**：当前活动蓝图是内置预设（空配/低配/中配/高配）。
- **当**：配装面板 header 渲染。
- **那么**：收藏按钮 SHALL 隐藏。

#### Scenario: Toggle Favorite On Click
- **前提**：收藏按钮可见。
- **当**：用户点击收藏按钮。
- **那么**：当前蓝图的 `favorite` 状态 SHALL 在 `true` 和 `false` 之间切换。
- **并且**：按钮图标 SHALL 立即更新。
- **并且**：状态 SHALL 立即写入 localStorage。

### Requirement: Favorite Indicator in Dropdown Menu

**下拉菜单**中每个用户蓝图行在名称和删除按钮之间显示星形收藏标记。

#### Scenario: Show Favorite Star for Favorited Blueprint
- **前提**：下拉菜单打开，存在已收藏的用户蓝图。
- **当**：渲染该蓝图行。
- **那么**：在蓝图名称和删除按钮之间 SHALL 显示实心星形图标。

#### Scenario: No Star for Non-Favorited Blueprint
- **前提**：下拉菜单打开，存在未收藏的用户蓝图。
- **当**：渲染该蓝图行。
- **那么**：蓝图名称和删除按钮之间 SHALL 不显示星形图标（或显示空心/无图标状态）。

#### Scenario: No Star for Built-in Preset
- **前提**：下拉菜单打开，存在内置预设蓝图。
- **当**：渲染预设蓝图行。
- **那么**：SHALL 不显示收藏星形图标。

#### Scenario: Star in Menu is Not Clickable
- **前提**：下拉菜单显示星形图标。
- **当**：用户点击星形图标。
- **那么**：SHALL 不触发收藏状态切换（切换仅通过主界面按钮执行）。

### Requirement: Favorite Sorting in Dropdown Menu

**用户配装组内**，已收藏的蓝图排在未收藏前面。

#### Scenario: Favorited Blueprints Sorted First
- **前提**：用户配装组包含已收藏和未收藏的蓝图。
- **当**：下拉菜单渲染用户配装组。
- **那么**：已收藏蓝图 SHALL 排在未收藏蓝图之前。
- **并且**：收藏蓝图之间的相对顺序 SHALL 保持原有顺序。
- **并且**：未收藏蓝图之间的相对顺序 SHALL 保持原有顺序。

### Requirement: Favorite Indicator in Modal

**模态框**（`LoadShipBlueprintModal.vue`）中每个用户蓝图卡片显示收藏标记。

#### Scenario: Show Favorite Star in Modal
- **前提**：模态框打开，存在已收藏的用户蓝图。
- **当**：渲染蓝图卡片。
- **那么**：卡片中 SHALL 显示星形收藏标记（实心）。
- **并且**：未收藏的蓝图 SHALL 不显示星形标记。

#### Scenario: Star in Modal is Not Clickable
- **前提**：模态框中蓝图卡片显示星形图标。
- **当**：用户点击星形图标。
- **那么**：SHALL 不触发收藏状态切换。

### Requirement: Favorite State Persistence

**收藏状态**持久化到 `x4_ship_blueprints` localStorage key。

#### Scenario: Favorite State Persists Across Sessions
- **前提**：用户收藏了一个蓝图。
- **当**：刷新页面或重新打开应用。
- **那么**：该蓝图的收藏状态 SHALL 保持不变。

#### Scenario: New Blueprint Defaults to Not Favorited
- **前提**：用户创建新的蓝图。
- **当**：蓝图被保存。
- **那么**：新蓝图的 `favorite` SHALL 为 `false`。

#### Scenario: Migration from Version 3 to 4
- **前提**：localStorage 中存在 version=3 的蓝图数据。
- **当**：store 加载蓝图数据。
- **那么**：所有缺少 `favorite` 字段的蓝图 SHALL 自动设置为 `favorite: false`。
- **并且**：迁移后数据 version 升级为 `4`。
