# Empire Sidebar Anchor

当前目录路径保留 `tabbar` 作为历史 guide 路径；当前 UI 名称与 anchor 均为 Sidebar。

## 稳定锚点

- `guide.empire.sidebar.root` -> `src/components/empire/ProductionSidebar.vue` 的 `data-testid="production-sidebar"`
- `guide.empire.sidebar.toggle` -> `data-testid="sidebar-toggle"`
- `guide.empire.sidebar.overview` -> `data-testid="sidebar-overview"`
- `guide.empire.sidebar.station-list` -> `data-testid="sidebar-station-list"`
- `guide.empire.sidebar.station` -> `data-testid="sidebar-station"` + `data-station-id="<stationId>"`
- `guide.empire.sidebar.add-station` -> `data-testid="sidebar-add-station"`
- `guide.empire.sidebar.sector` -> `data-testid="sidebar-sector"` + `data-sector-id="<sectorId>"`
- `guide.empire.sidebar.sector-toggle` -> `data-testid="sidebar-sector-toggle"` + `data-sector-id="<sectorId>"`
- `guide.empire.sidebar.context-menu` -> `data-testid="sidebar-context-menu"`
- `guide.empire.sidebar.menu-jump-binding` -> `data-testid="sidebar-menu-jump-binding"`
- `guide.empire.sidebar.menu-rename` -> `data-testid="sidebar-menu-rename"`
- `guide.empire.sidebar.menu-duplicate` -> `data-testid="sidebar-menu-duplicate"`
- `guide.empire.sidebar.menu-delete` -> `data-testid="sidebar-menu-delete"`
- `guide.empire.sidebar.delete-dialog` -> `data-testid="sidebar-delete-dialog"`
- `guide.empire.sidebar.delete-confirm` -> `data-testid="sidebar-delete-confirm"`
- `guide.empire.sidebar.delete-cancel` -> `data-testid="sidebar-delete-cancel"`
- `guide.empire.station.module-input` -> `data-testid="station-module-search-input"`
- `guide.empire.station.module-candidate-popover` -> `data-testid="station-module-candidate-popover"`
- `guide.empire.station.module-candidate-item` -> `data-testid="station-module-candidate-<moduleId>"`

固定入口仍使用 `sidebar-overview`、`sidebar-terraforming`、`sidebar-research`、`sidebar-npc-trade`、`sidebar-blueprint-recipe`、`sidebar-tech-tree`、`sidebar-auto-sector-group`。

## Owner trace

`ProductionSidebar.vue` 只负责交互表现；`useProductionSidebarPresenter.ts` 负责 tabs、active entry、能力和 emit 组装；blueprint 重排经 `useBlueprintProductionStore.reorderStations()` 到 `useEmpireDataStore.reorderStationsInEmpire()`。workbench 入口为 `BlueprintProductionWorkbenchView.vue` 与 `LiveProductionWorkbenchView.vue`。

## 迁移边界

历史 `StationTabBar`、`SectorStationTabBar`、`.overview-tab`、`.station-tab` 只属于迁移语境；当前 anchor 不依赖旧 component/class 或可变文本。

## Pending

pending: []
