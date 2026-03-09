# Empire Toolbar Anchor

## 第一章：定位总览（最简）

- `guide.empire.new` -> 点击 `data-testid="toolbar-new-btn"`，断言 `.station-workbench`
- `guide.empire.save` -> 点击 `data-testid="toolbar-save-btn"`，断言 `.station-workbench`
- `guide.empire.save-as` -> 点击 `data-testid="toolbar-save-as-btn"`，断言 `h3[/保存更改|保存新方案|Save/i]` 可见
- `guide.empire.load` -> 点击 `data-testid="toolbar-load-btn"`，断言 `LoadPlanModal` 可见
- `guide.empire.dialog.discard-new` -> 点击 `button[/丢弃并新建|Discard\\s*&\\s*New/i]`，断言保存对话框关闭
- `guide.empire.dialog.discard` -> 点击 `button[/丢弃|Discard/i]`，断言保存对话框关闭（兼容旧文案）
- `guide.empire.dialog.save` -> 点击 `button[/保存|Save/i]`，断言保存对话框关闭
- `guide.empire.dialog.save-as` -> 点击 `checkbox[/另存为副本|Save As Copy/i]`，断言命名输入框可见

## 第二章：锚点定义（详细）

- `guide.empire.toolbar.new-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-new-btn"`
- `guide.empire.toolbar.save-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-save-btn"`
- `guide.empire.toolbar.save-as-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-save-as-btn"`
- `guide.empire.toolbar.load-btn`
  - `type`: `button`
  - `locator`: `data-testid="toolbar-load-btn"`
- `guide.empire.dialog.save-flow`
  - `type`: `dialog`
  - `locator`: `h3[/保存更改|保存新方案|Save Changes|Save New Plan/i]`（对话框根可用 `.fixed.inset-0:has(h3...)`）
- `guide.empire.dialog.load-plan`
  - `type`: `modal`
  - `locator`: `LoadPlanModal`
- `guide.empire.dialog.discard-new`
  - `type`: `button`
  - `locator`: `role=button[name=/丢弃并新建|Discard\\s*&\\s*New/i]`
- `guide.empire.dialog.discard`
  - `type`: `button`
  - `locator`: `role=button[name=/丢弃|Discard/i]`
- `guide.empire.dialog.save`
  - `type`: `button`
  - `locator`: `role=button[name=/保存|Save/i]`
- `guide.empire.dialog.save-as`
  - `type`: `checkbox`
  - `locator`: `role=checkbox[name=/另存为副本|Save As Copy/i]`

## Pending

pending: []
