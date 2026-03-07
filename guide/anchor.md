# Guide Anchor Tree

## 第一章：定位总览（最简）

- `guide.switch-to-empire` -> 点击 `top-view-btn-production`，断言 `.station-tab-bar-container`
- `guide.switch-to-logic-flow` -> 点击 `top-view-btn-flow`，断言 `.flow-layout`
- `guide.switch-to-ship` -> 点击 `top-view-btn-ship-build`，断言 `[data-testid='ship-build-filters']`
- `guide.open-import-wizard` -> 点击 `toolbar-import-btn`，断言 `storage-import-wizard`
- `guide.open-export-wizard` -> 点击 `toolbar-export-btn`，断言 `storage-export-wizard`

## 第二章：顶层锚点定义（详细）

`anchor_group`: `guide.top-tabs`

`anchors`:
- `guide.tab.empire`
  - `type`: `tab`
  - `label`: `view.production`（i18n）
  - `testid`: `top-view-btn-production`
  - `maps_to_action`: `guide.switch-module-by-tab` (target: `guide.empire`)
  - `runtime_view`: `production`
- `guide.tab.logic-flow`
  - `type`: `tab`
  - `label`: `view.logical_flow`（i18n）
  - `testid`: `top-view-btn-flow`
  - `maps_to_action`: `guide.switch-module-by-tab` (target: `guide.logic-flow`)
  - `runtime_view`: `flow`
- `guide.tab.ship`
  - `type`: `tab`
  - `label`: `view.ship_build`（i18n）
  - `testid`: `top-view-btn-ship-build`
  - `maps_to_action`: `guide.switch-module-by-tab` (target: `guide.ship`)
  - `runtime_view`: `ship-build`

`state_anchor`:
- `guide.state.active-view`
  - `value`: `guide.empire | guide.logic-flow | guide.ship`
  - `runtime_value`: `production | flow | ship-build`
  - `description`: 当前顶部 Tab 激活业务视图，运行时绑定 `shipBuildStore.activeView`。

`container_anchor`:
- `guide.top-tabs.container`
  - `type`: `tab-container`
  - `testid`: `top-view-switch`

`toolbar_action_anchor`:
- `guide.action.import.open-btn`
  - `type`: `button`
  - `testid`: `toolbar-import-btn`
  - `maps_to_action`: `guide.open-import-wizard` (target: `guide.import`)
- `guide.action.export.open-btn`
  - `type`: `button`
  - `testid`: `toolbar-export-btn`
  - `maps_to_action`: `guide.open-export-wizard` (target: `guide.export`)

`wizard_anchor`:
- `guide.wizard.import.root`
  - `type`: `modal`
  - `testid`: `storage-import-wizard`
  - `doc_path`: `import`
- `guide.wizard.export.root`
  - `type`: `modal`
  - `testid`: `storage-export-wizard`
  - `doc_path`: `export`

`page_assert_anchor`:
- `guide.page.empire`
  - `switch_from_tab`: `guide.tab.empire`
  - `locator`: `.station-tab-bar-container`
  - `assert`: `visible`
  - `doc_path`: `empire`
- `guide.page.logic-flow`
  - `switch_from_tab`: `guide.tab.logic-flow`
  - `locator`: `.flow-layout`
  - `assert`: `visible`
  - `doc_path`: `logic-flow`
- `guide.page.ship`
  - `switch_from_tab`: `guide.tab.ship`
  - `locator`: `[data-testid='ship-build-filters']`
  - `assert`: `visible`
  - `doc_path`: `ship`

`tab_active_assert`:
- `guide.tab.active`
  - `description`: 点击目标 tab 后，该 tab 应包含激活态 class（`bg-blue-600` / `bg-purple-600` / `bg-emerald-600` 之一）。

## Pending

pending: []
