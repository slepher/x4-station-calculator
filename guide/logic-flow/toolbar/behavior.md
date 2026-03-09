# Logic Flow Toolbar Behavior

## 第一章：操作定义


- `guide.logic-flow.new`
  - `action`: 点击工具栏“新建”按钮。
  - `expected`: 清空当前逻辑组网内容；若存在未保存改动，则进入保存确认流程。
- `guide.logic-flow.save`
  - `action`: 点击工具栏“保存”按钮。
  - `expected`: 当前逻辑组网方案被保存；若不满足直接保存条件，则进入保存流程对话。
- `guide.logic-flow.save-as`
  - `action`: 点击工具栏“另存为”按钮。
  - `expected`: 打开保存流程对话并要求输入新名称。
- `guide.logic-flow.load`
  - `action`: 点击工具栏“载入”按钮。
  - `expected`: 打开逻辑组网载入弹窗（LoadFlowPlanModal）。
