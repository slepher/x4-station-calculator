# Logic Flow Toolbar Anchor

## 第一章：定位总览（最简）


- `guide.logic-flow.new` -> 点击 `data-testid="toolbar-new-btn"`，断言 `.flow-layout`
- `guide.logic-flow.save` -> 点击 `data-testid="toolbar-save-btn"`，断言 `.flow-layout`
- `guide.logic-flow.save-as` -> 点击 `data-testid="toolbar-save-as-btn"`，断言 `SmartSaveDialog` 可见
- `guide.logic-flow.load` -> 点击 `data-testid="toolbar-load-btn"`，断言 `LoadFlowPlanModal` 可见

## 第二章：锚点定义（详细）

- `guide.logic-flow.toolbar.new-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-new-btn"`
- `guide.logic-flow.toolbar.save-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-save-btn"`
- `guide.logic-flow.toolbar.save-as-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-save-as-btn"`
- `guide.logic-flow.toolbar.load-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-load-btn"`
- `guide.logic-flow.dialog.save-flow`
  - `type`: `dialog`
  - `locator`: `SmartSaveDialog`
- `guide.logic-flow.dialog.load-flow-plan`
  - `type`: `modal`
  - `locator`: `LoadFlowPlanModal`

## Pending

pending: []
