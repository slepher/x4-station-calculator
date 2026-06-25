# Ship Toolbar Anchor

## 第一章：定位总览（最简）


- `guide.ship.new` -> 点击 `data-testid="toolbar-new-btn"`，断言 `ship-build` 视图保持可见
- `guide.ship.save` -> 点击 `data-testid="toolbar-save-btn"`，断言 `ship-build` 视图保持可见
- `guide.ship.save-as` -> 点击 `data-testid="toolbar-save-as-btn"`，断言 `SmartSaveDialog` 可见
- `guide.ship.load` -> `ship-build` 视图不显示全局 toolbar 载入按钮；蓝图载入通过配装面板 header 的蓝图菜单完成

## 第二章：锚点定义（详细）

- `guide.ship.toolbar.new-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-new-btn"`
- `guide.ship.toolbar.save-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-save-btn"`
- `guide.ship.toolbar.save-as-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-save-as-btn"`
- `guide.ship.dialog.save-flow`
  - `type`: `dialog`
  - `locator`: `SmartSaveDialog`

## Pending

pending: []
