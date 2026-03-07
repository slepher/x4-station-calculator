# Empire Tabbar Behavior

## 第一章：操作定义

- `guide.empire.new`
  - `action`: 点击工具栏“新建”按钮。
  - `expected`: 清空当前帝国编辑内容；若存在未保存改动，则进入保存确认流程。
- `guide.empire.save`
  - `action`: 点击工具栏“保存”按钮。
  - `expected`: 当前帝国方案被保存；若不满足直接保存条件，则进入保存流程对话。
- `guide.empire.save-as`
  - `action`: 点击工具栏“另存为”按钮。
  - `expected`: 打开保存流程对话并要求输入新名称。
- `guide.empire.load`
  - `action`: 点击工具栏“载入”按钮。
  - `expected`: 打开帝国载入弹窗（LoadPlanModal）。
