# sidebar-navigation Specification

## Purpose

将 blueprint-production 和 live-production 中的水平 TabBar 导航替换为左侧可折叠 Sidebar；这是原导航行为的新表现，概览、station、Transit、菜单和 blueprint reorder 语义保持不变。

## MODIFIED Requirements

### Requirement: Production workbench uses Sidebar

`BlueprintProductionWorkbenchView` 与 `LiveProductionWorkbenchView` SHALL 使用 `ProductionSidebar` 作为导航入口。Blueprint overview、station 内容和上下文 toolbar SHALL 保持现有语义；live SHALL 保留 overview、terraforming、research、NPC trade、blueprint recipe、Transit、station 与其他现有固定入口模式。

Sidebar 的数据与行为链路 SHALL 为 `store -> useProductionSidebarPresenter -> ProductionSidebar`。实际 store owner、稳定 test-id 和排序约束以 `openspec/specs/station-tabs/spec.md` 为准。

#### Scenario: 使用 Sidebar 导航

- **WHEN** 用户进入 blueprint 或 live 生产工作区
- **THEN** `ProductionSidebar` 显示导航
- **AND** 原导航的工作区切换语义保持不变

### Requirement: Blueprint station list and reorder

Blueprint 模式 SHALL 平铺展示站点，并支持通过 Sidebar 拖拽重排。重排必须提交完整站点 ID 排列，保持 active station ID；非法排列 SHALL 被拒绝，领域写入由 `useEmpireDataStore.reorderStationsInEmpire()` 完成。

#### Scenario: Blueprint 重排

- **WHEN** 用户拖拽 blueprint Sidebar 中的站点
- **THEN** 站点顺序更新且 active station ID 不变
- **AND** 非法 ID 集合被拒绝

### Requirement: Live tree navigation

Live 模式 SHALL 按星区分组展示 Transit 与 station。星区可展开/折叠；点击箭头只改变展开状态，点击图标/名称区域切换入口，整行可打开上下文菜单。选中站点或 Transit 的现有模式语义保持不变。

#### Scenario: Live 星区导航

- **WHEN** 用户点击星区箭头或其 Transit/station 入口
- **THEN** 箭头只切换展开状态，入口切换对应现有模式
- **AND** 上下文菜单仍可由整行右键打开

### Requirement: Sidebar collapse

Sidebar SHALL 支持展开/折叠，折叠只改变布局宽度与内容可见性，不改变 active workbench、active station、菜单或站点顺序。

#### Scenario: 折叠 Sidebar

- **WHEN** 用户点击 Sidebar 折叠按钮
- **THEN** Sidebar 改变展开状态
- **AND** active workbench、active station、菜单和站点顺序不变

### Requirement: Station context menu

Sidebar SHALL 保留站点的跳转 binding、重命名、复制、删除和删除确认行为；live 的 delete-only 限制与 blueprint 的 full menu 语义保持不变。

#### Scenario: 使用站点菜单

- **WHEN** 用户对站点入口打开上下文菜单
- **THEN** 菜单提供当前允许的 binding、重命名、复制和删除动作
- **AND** 删除必须先经过确认

## Stable UI contract

Sidebar 根、固定入口、星区、站点、重排容器、菜单动作和删除确认使用稳定 `data-testid`；站点/星区身份分别使用 `data-station-id`/`data-sector-id`。当前行为不得依赖历史 TabBar component 或 `.overview-tab`、`.station-tab` class。

## Migration note

历史 `StationTabBar`、`SectorStationTabBar` 名称仅保留在本说明中作为迁移背景，不代表当前组件、anchor 或行为权威；已归档历史不在本 delta 中重写。
