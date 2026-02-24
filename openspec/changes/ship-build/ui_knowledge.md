# UI Knowledge: ship-build

## 页面入口与区域

- 入口：与“量化生产”“逻辑组网”同级的“船只建造”切换按钮。
- 顶部按钮组：复用“新建/保存/载入”按钮组位置，仅主题变为绿色系。
- 上部区域：选择船只筛选区（`class`/`race`/`type`）。
- 下部区域：三列占位区（配装 / 配装后船体属性 / 建造材料）。

## 建议的测试定位（如需新增 data-testid）

- 视图切换按钮：`ship-build-tab`
- 顶部按钮组容器：`ship-build-toolbar`
- 筛选区容器：`ship-build-filters`
- `class` 选择控件：`ship-build-filter-class`
- `race` 选择控件：`ship-build-filter-race`
- `type` 选择控件：`ship-build-filter-type`
- 飞船列表容器：`ship-build-list`
- 空列表占位：`ship-build-list-empty`
- 飞船名称文本：`ship-build-ship-name`
- `race` 标签计数：`ship-build-race-count`
- `type` 标签计数：`ship-build-type-count`
- 下部三列容器：`ship-build-panels`
- 左列/中列/右列占位：`ship-build-panel-fit` / `ship-build-panel-stats` / `ship-build-panel-materials`

## 断言建议

- 列表显示条件：通过 `ship-build-list` 是否存在或可见进行断言。
- 空列表：使用 `ship-build-list-empty` 判断在未满足筛选条件时的隐藏或占位状态。
- 主题色：通过按钮组容器或按钮类名断言绿色主题类是否生效。
- 名称本地化：通过飞船名称文本内容断言是否为 `x4i18n` 翻译结果。
- 计数显示：通过 `ship-build-race-count` / `ship-build-type-count` 断言标签内计数与筛选结果一致。
