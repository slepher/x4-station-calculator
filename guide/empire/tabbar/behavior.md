# Empire Tabbar Behavior

## 第一章：操作定义

### Tabbar（站点标签栏）
- `guide.empire.tab-structure`
  - `action`: 观察帝国页 `StationTabBar` 标签顺序。
  - `expected`: 第一个标签固定为帝国概览；其后标签为各空间站标签。
- `guide.empire.add-station-by-plus`
  - `action`: 点击最后一个标签后的加号按钮（`.add-btn`）。
  - `expected`: 新增一个空间站标签并切换到新空间站上下文。
- `guide.empire.station-module-input-visible`
  - `action`: 进入任一空间站标签（非概览标签）。
  - `expected`: 左侧规划区可见模块添加输入框（`data-testid="station-module-search-input"`），可用于搜索并添加模块。
- `guide.empire.station-module-candidate-popover-visible`
  - `action`: 在空间站标签中聚焦模块输入框（`data-testid="station-module-search-input"`）。
  - `expected`: 出现候选框（`data-testid="station-module-candidate-popover"`）；若输入为空则可展示全部可选分组，输入关键字后按筛选结果刷新。
- `guide.empire.station-module-search-linkage`
  - `action`: 在 `station-module-search-input` 持续输入/修改关键字。
  - `expected`: 候选框内容与输入值实时联动刷新：
    - 输入为空：展示默认候选分组与候选项。
    - 输入命中：仅展示匹配关键字的分组与候选项（`station-module-candidate-<moduleId>` 集合变化）。
    - 输入无命中：候选列表清空（无候选项可点击）。
- `guide.empire.station-module-candidate-popover-hide`
  - `action`: 输入框失焦且焦点不在候选框内，或按 `Esc`。
  - `expected`: 候选框关闭（`station-module-candidate-popover` 不可见）。
