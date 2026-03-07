# Logic Flow Tabbar Anchor

## 第一章：定位总览（最简）


- `guide.logic-flow.new` -> 点击 `button[/新建|New/i]`，断言 `.flow-layout`
- `guide.logic-flow.save` -> 点击 `button[/保存|Save/i]`，断言 `.flow-layout`
- `guide.logic-flow.save-as` -> 点击 `button[/另存为|Save As/i]`，断言 `SmartSaveDialog` 可见
- `guide.logic-flow.load` -> 点击 `button[/加载|Load/i]`，断言 `LoadFlowPlanModal` 可见

## 第二章：锚点定义（详细）

- `guide.logic-flow.toolbar.new-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/新建|New/i]`
- `guide.logic-flow.toolbar.save-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/保存|Save/i]`
- `guide.logic-flow.toolbar.save-as-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/另存为|Save As/i]`
- `guide.logic-flow.toolbar.load-btn`
  - `type`: `button`
  - `locator`: `role=button[name=/加载|Load/i]`
- `guide.logic-flow.dialog.save-flow`
  - `type`: `dialog`
  - `locator`: `SmartSaveDialog`
- `guide.logic-flow.dialog.load-flow-plan`
  - `type`: `modal`
  - `locator`: `LoadFlowPlanModal`

## Pending

pending: []
