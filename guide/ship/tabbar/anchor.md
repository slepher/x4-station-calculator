# Ship Tabbar Anchor

## 第一章：定位总览（最简）


- `guide.ship.new` -> 点击 `button[/新建|New/i]`，断言 `ship-build` 视图保持可见
- `guide.ship.save` -> 点击 `button[/保存|Save/i]`，断言 `ship-build` 视图保持可见
- `guide.ship.save-as` -> 点击 `button[/另存为|Save As/i]`，断言 `SmartSaveDialog` 可见
- `guide.ship.load` -> 点击 `button[/加载|Load/i]`，断言已选船时 `LoadShipBlueprintModal` 可见

## 第二章：锚点定义（详细）

- `guide.ship.toolbar.new-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/新建|New/i]`
- `guide.ship.toolbar.save-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/保存|Save/i]`
- `guide.ship.toolbar.save-as-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/另存为|Save As/i]`
- `guide.ship.toolbar.load-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/加载|Load/i]`
- `guide.ship.dialog.save-flow`
  - `type`: `dialog`
  - `locator`: `SmartSaveDialog`
- `guide.ship.dialog.load-blueprint`
  - `type`: `modal`
  - `locator`: `LoadShipBlueprintModal`

## Pending

pending: []
