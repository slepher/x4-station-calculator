# Empire Tabbar Anchor

## 第一章：定位总览（最简）


- `guide.empire.new` -> 点击 `button[/新建|New/i]`，断言 `.station-workbench`
- `guide.empire.save` -> 点击 `button[/保存|Save/i]`，断言 `.station-workbench`
- `guide.empire.save-as` -> 点击 `button[/另存为|Save As/i]`，断言 `SmartSaveDialog` 可见
- `guide.empire.load` -> 点击 `button[/加载|Load/i]`，断言 `LoadPlanModal` 可见

## 第二章：锚点定义（详细）

- `guide.empire.toolbar.new-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/新建|New/i]`
- `guide.empire.toolbar.save-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/保存|Save/i]`
- `guide.empire.toolbar.save-as-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/另存为|Save As/i]`
- `guide.empire.toolbar.load-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/加载|Load/i]`
- `guide.empire.dialog.save-flow`
  - `type`: `dialog`
  - `locator`: `SmartSaveDialog`
- `guide.empire.dialog.load-plan`
  - `type`: `modal`
  - `locator`: `LoadPlanModal`

## Pending

pending: []
