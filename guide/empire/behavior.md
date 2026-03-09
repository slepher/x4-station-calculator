# Empire Behavior

## 第一章：行为定义

- `guide.empire.tabbar-ref`
  - `type`: `zone`
  - `index`: `guide.empire.tabbar`
  - `zone`: `tabbar`
  - `target`: `tabbar/behavior.md`
- `guide.empire.toolbar-ref`
  - `type`: `zone`
  - `index`: `guide.empire.toolbar`
  - `zone`: `toolbar`
  - `target`: `toolbar/behavior.md`
- `guide.empire.tab-structure`
  - `action`: 在帝国页查看标签栏。
  - `expected`: 第一个标签为帝国概览，后续标签为各空间站。
- `guide.empire.add-station-by-plus`
  - `action`: 点击标签栏末尾的加号按钮。
  - `expected`: 添加新空间站并新增对应空间站标签（该动作属于 Tabbar，不属于 Toolbar）。
- `guide.empire.station-module-input`
  - `action`: 切换到任一空间站标签（非概览）。
  - `expected`: 出现模块添加输入框（`data-testid="station-module-search-input"`），可搜索并添加模块。
- `guide.empire.station-module-candidates`
  - `action`: 在空间站页聚焦模块输入框。
  - `expected`: 候选框显示（`data-testid="station-module-candidate-popover"`）；候选项可通过 `data-testid="station-module-candidate-<moduleId>"` 精确定位并点击添加模块。
- `guide.empire.station-module-search-linkage`
  - `action`: 在模块输入框中输入/修改搜索词。
  - `expected`: 候选框内容随输入实时更新（空输入展示默认候选，命中时收敛为匹配项，无命中时候选为空）。
