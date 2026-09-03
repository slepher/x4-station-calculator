# Station Sidebar Navigation Specification

## Purpose

定义生产工作区导航的用户可观察行为。Sidebar 是原导航行为的新表现；行为权威是选中状态、工作区模式、菜单动作和站点顺序，不是某个历史 DOM 组件或 CSS class。

## Implementation boundary

- Vue：`src/components/empire/ProductionSidebar.vue`
- Presenter：`src/components/empire/presenters/useProductionSidebarPresenter.ts`
- Blueprint store：`src/store/useBlueprintProductionStore.ts`
- 最终站点顺序 owner：`src/store/useEmpireDataStore.ts` 的 `reorderStationsInEmpire()`
- Blueprint 与 live 入口：`src/components/empire/BlueprintProductionWorkbenchView.vue`、`src/components/empire/LiveProductionWorkbenchView.vue`

## Requirements

### Requirement: Sidebar layout

Sidebar SHALL 垂直展示固定入口与动态站点入口。Blueprint 动态区平铺站点；live 动态区按星区展示 Transit 与站点树。Sidebar SHALL 支持折叠/展开，折叠只改变表现，不改变当前工作区或选中站点。

#### Scenario: Sidebar 表现

- **WHEN** 用户进入 blueprint 或 live 生产工作区
- **THEN** 页面显示 Sidebar 导航
- **AND** 折叠/展开不改变当前工作区或选中站点

### Requirement: Overview navigation

Sidebar SHALL 提供固定概览入口。点击概览后，`activeStationId` SHALL 为 `null`，工作区 SHALL 显示帝国概览；live 与 blueprint 的概览内容保持各自现有语义。

#### Scenario: 切换概览

- **WHEN** 用户点击 Sidebar 概览入口
- **THEN** `activeStationId` 为 `null`
- **AND** 工作区显示帝国概览

### Requirement: Station navigation

每个站点 SHALL 显示名称和类型图标。点击站点后 SHALL 选中其 ID，并显示该站点工作区；当前 active station ID 在导航表现变化中保持不变。

#### Scenario: 切换站点

- **WHEN** 用户点击某个 Sidebar 站点入口
- **THEN** 该站点 ID 成为 active station ID
- **AND** 工作区显示该站点

### Requirement: Blueprint station reorder

Blueprint Sidebar SHALL 支持站点拖拽重排。重排后 Sidebar 顺序与 `stations` 顺序 SHALL 同步，`activeStationId` SHALL 保持原值。排序请求必须是当前站点 ID 的完整排列；非法集合 SHALL 被拒绝。唯一领域写入 owner 是 `useEmpireDataStore.reorderStationsInEmpire()`，不得创建第二份排序状态。

Live SHALL 保持现有星区/站点顺序语义，不新增跨星区持久化重排语义。

#### Scenario: 重排 blueprint 站点

- **WHEN** 用户在 blueprint Sidebar 中拖拽站点
- **THEN** `stations` 按新顺序更新
- **AND** active station ID 不变

### Requirement: Station menu

站点上下文菜单 SHALL 保留：跳转 binding、重命名、复制和删除。删除 SHALL 先显示确认对话框；确认后移除站点。唯一站点场景 SHALL 保留其现有 delete-only 语义。

#### Scenario: 删除站点

- **WHEN** 用户从站点上下文菜单选择删除
- **THEN** 系统先显示删除确认对话框
- **AND** 仅在确认后移除站点

### Requirement: Other navigation entries

live Sidebar SHALL 保留概览、terraforming、research、NPC trade、blueprint recipe、auto-sector-group、Transit 与 station 入口的现有模式切换语义。固定入口的显示由 presenter 能力决定；Sidebar 不直接组装 store 数据。

#### Scenario: 切换固定入口

- **WHEN** 用户点击 live Sidebar 的固定入口
- **THEN** workbench 按入口切换到对应现有模式

## Stable UI contract

以下 `data-testid` 是行为锚点，实体身份放在 `data-station-id` 或 `data-sector-id`，不得把名称、翻译或序号编码进 ID：

| 行为 | 锚点 |
| --- | --- |
| Sidebar 根/折叠 | `production-sidebar` / `sidebar-toggle` |
| 固定入口 | `sidebar-overview`、`sidebar-terraforming`、`sidebar-research`、`sidebar-npc-trade`、`sidebar-blueprint-recipe`、`sidebar-tech-tree`、`sidebar-auto-sector-group` |
| 星区/星区折叠 | `sidebar-sector` + `data-sector-id` / `sidebar-sector-toggle` + `data-sector-id` |
| 站点列表/站点 | `sidebar-station-list` / `sidebar-station` + `data-station-id` |
| 新建站点 | `sidebar-add-station` |
| 上下文菜单 | `sidebar-context-menu`、`sidebar-menu-jump-binding`、`sidebar-menu-rename`、`sidebar-menu-duplicate`、`sidebar-menu-delete` |
| 删除确认 | `sidebar-delete-dialog`、`sidebar-delete-confirm`、`sidebar-delete-cancel` |

## Compatibility and migration

历史实现名称 `StationTabBar`、`SectorStationTabBar` 仅用于描述从水平 TabBar 到 Sidebar 的迁移背景；当前规范、guide anchor 和行为断言不得依赖这些名称或旧 `.overview-tab`、`.station-tab` class。测试目录以 `tests/unified-unit/`、`tests/unified-e2e/` 为 current；`tests/unit/`、`tests/e2e/` 仅作为 legacy migration source。
