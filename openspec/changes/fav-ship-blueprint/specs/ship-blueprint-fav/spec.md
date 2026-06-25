# Ship Blueprint Favorite Specification

## Purpose
为飞船配装蓝图新增收藏功能，支持收藏/取消收藏、收藏状态持久化、配装面板菜单展示收藏标记，以及收藏蓝图在列表中优先排列。

## ADDED Requirements

### Requirement: Favorite Toggle on Main Interface

系统 SHALL 在主界面提供收藏按钮，位于"载入飞船配装"按钮左侧，用于切换当前用户蓝图的收藏状态。

#### Scenario: Show Favorite Button for All Blueprints
- **前提**：用户已选择飞船。
- **当**：配装面板 header 渲染。
- **那么**：收藏按钮 SHALL 始终出现在"载入飞船配装"按钮左侧（含内置预设蓝图）。
- **并且**：若已收藏，按钮显示实心星形图标。
- **并且**：若未收藏，按钮显示空心星形图标。

#### Scenario: Toggle Favorite On Click
- **前提**：收藏按钮可见。
- **当**：用户点击收藏按钮。
- **那么**：当前蓝图的 `favorite` 状态 SHALL 在 `true` 和 `false` 之间切换。
- **并且**：按钮图标 SHALL 立即更新。
- **并且**：切换仅修改内存标记，SHALL NOT 立即写入 localStorage。
- **并且**：fav 标记 SHALL 随 `saveBlueprint()` 保存配装时统一持久化。

### Requirement: Favorite Indicator in Dropdown Menu

系统 SHALL 在下拉菜单的每个用户蓝图行中，在名称和删除按钮之间显示星形收藏标记。

#### Scenario: Show Star for User Blueprints Only
- **前提**：下拉菜单打开。
- **当**：渲染蓝图行。
- **那么**：用户蓝图行 SHALL 显示星形图标。
- **并且**：内置预设蓝图 SHALL NOT 显示星形图标。
- **并且**：已收藏显示实心星形，未收藏显示空心星形。

#### Scenario: Star in Menu is Clickable
- **前提**：下拉菜单显示星形图标。
- **当**：用户点击星形图标。
- **那么**：蓝图 favorite 状态 SHALL 切换。
- **并且**：非当前蓝图 SHALL 立即调用 `saveBlueprintsToStorage()` 持久化。

### Requirement: Blueprint List Sorting

系统 SHALL 将用户配装组按创建时间降序排列，相同时按名称字母序排列。

#### Scenario: Blueprints Sorted by CreatedAt
- **前提**：用户配装组包含多个蓝图。
- **当**：下拉菜单渲染用户配装组。
- **那么**：蓝图 SHALL 按 `createdAt` 降序排列（最新创建的在前）。
- **并且**：创建时间相同时 SHALL 按名称字母序排列。

### Requirement: Favorite State Persistence

系统 SHALL 将收藏状态持久化到 `x4_ship_blueprints` localStorage key。

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

#### Scenario: Migration from Version 4 to 5
- **前提**：localStorage 中存在 version=4 的蓝图数据。
- **当**：store 加载蓝图数据。
- **那么**：所有缺少 `createdAt` 字段的蓝图 SHALL 自动设置 `createdAt = lastUpdated`。
- **并且**：迁移后数据 version 升级为 `5`。

#### Scenario: Preset Switch Preserves Favorite State
- **前提**：当前蓝图是用户蓝图，具有 `favorite: true`。
- **当**：用户切换到内置预设蓝图。
- **那么**：用户蓝图的 `favorite` 标记 SHALL 保持不变。
- **并且**：`createdAt` 字段 SHALL 保持不变。
