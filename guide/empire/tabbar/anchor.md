# Empire Tabbar Anchor

## 第一章：定位总览（最简）

### Tabbar（站点标签栏）
- `guide.empire.tab.overview` -> 第一个标签为帝国概览，定位 `.station-tab-bar-container .overview-tab`
- `guide.empire.tab.station` -> 后续标签为空间站，定位 `.station-tab-bar-container .station-tab`
- `guide.empire.tab.add-station` -> 最后一个标签后的加号按钮用于添加空间站，定位 `.station-tab-bar-container .add-btn`
- `guide.empire.station.module-input` -> 空间站页模块添加输入框，定位 `data-testid="station-module-search-input"`
- `guide.empire.station.module-candidate-popover` -> 模块候选框容器，定位 `data-testid="station-module-candidate-popover"`
- `guide.empire.station.module-candidate-item` -> 模块候选项，定位 `data-testid="station-module-candidate-<moduleId>"`

## 第二章：锚点定义（详细）

- `guide.empire.tab.overview`
  - `type`: `tab`
  - `locator`: `.station-tab-bar-container .overview-tab`
  - `note`: `StationTabBar` 中固定第一个标签，表示帝国概览。
- `guide.empire.tab.station`
  - `type`: `tab`
  - `locator`: `.station-tab-bar-container .station-tab`
  - `note`: 概览标签之后的标签项均为空间站标签（按站点列表渲染）。
- `guide.empire.tab.add-station`
  - `type`: `button`
  - `locator`: `.station-tab-bar-container .add-btn`
  - `note`: 位于最后一个标签后方的加号按钮，用于新建空间站标签。
- `guide.empire.station.module-input`
  - `type`: `input`
  - `locator`: `data-testid="station-module-search-input"`
  - `note`: 仅在选中空间站（非概览）时可见，用于搜索并添加模块到规划区。
- `guide.empire.station.module-candidate-popover`
  - `type`: `popover`
  - `locator`: `data-testid="station-module-candidate-popover"`
  - `note`: 输入框聚焦后显示；失焦或按 `Esc` 后关闭。
- `guide.empire.station.module-candidate-item`
  - `type`: `item`
  - `locator`: `data-testid="station-module-candidate-<moduleId>"`
  - `note`: 候选项按模块 id 生成；点击后向规划区添加对应模块。

## Pending

pending: []
