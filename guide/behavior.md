# Guide Behavior Tree

## 第一章：行为定义

- `guide.switch-to-empire`
  - `index`: `guide.empire`
  - `action`: 点击 `guide.empire` Tab。
  - `expected`: 进入帝国生产视图（`StationTabBar` 可见）。
  - `runtime_view`: `production`
- `guide.switch-to-logic-flow`
  - `index`: `guide.logic-flow`
  - `action`: 点击 `guide.logic-flow` Tab。
  - `expected`: 进入逻辑组网视图（`LogicFlowCandidateZone` 与 `LogicFlowPlanningZone` 可见）。
  - `runtime_view`: `flow`
- `guide.switch-to-ship`
  - `index`: `guide.ship`
  - `action`: 点击 `guide.ship` Tab。
  - `expected`: 进入船只建造视图（`ShipBuildView` 可见）。
  - `runtime_view`: `ship-build`
- `guide.open-import-wizard`
  - `index`: `guide.import`
  - `action`: 点击工具栏导入按钮。
  - `expected`: 导入弹窗可见。
- `guide.open-export-wizard`
  - `index`: `guide.export`
  - `action`: 点击工具栏导出按钮。
  - `expected`: 导出弹窗可见。
- `guide.language.switcher`
  - `index`: `guide.language`
  - `action`: 通过语言下拉框切换语言。
  - `expected`: 语言切换成功并刷新界面文案。
- `guide.toolbar-dirty-guard`
  - `index`: `guide.empire`
  - `action`: 在任一主视图制造未保存改动后，点击工具栏 `New|新建` 或 `Save|保存`。
  - `expected`: 进入保存确认流程并出现 SmartSaveDialog（可通过标题与按钮文本定位）。
- `guide.toolbar-dirty-choice-result`
  - `index`: `guide.empire`
  - `action`: 在 SmartSaveDialog 中选择 `丢弃并新建|Discard & New` 或 `保存|Save` 路径。
  - `expected`: 弹窗关闭；流程继续执行对应路径（丢弃后进入新建态，保存后进入已保存态）。
