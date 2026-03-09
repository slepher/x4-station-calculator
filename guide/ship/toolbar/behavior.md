# Ship Toolbar Behavior

## 第一章：操作定义


- `guide.ship.new`
  - `action`: 点击工具栏“新建”按钮。
  - `expected`: 清空当前选中船只的配装；若存在未保存改动，则进入保存确认流程。
- `guide.ship.save`
  - `action`: 点击工具栏“保存”按钮。
  - `expected`: 当前蓝图被保存；若不满足直接保存条件，则进入保存流程对话。
- `guide.ship.save-as`
  - `action`: 点击工具栏“另存为”按钮。
  - `expected`: 打开保存流程对话并要求输入新名称。
- `guide.ship.load`
  - `action`: 点击工具栏“载入”按钮。
  - `expected`: 在已选择船只时打开蓝图载入弹窗（LoadShipBlueprintModal）；未选船只时按钮不可用。
