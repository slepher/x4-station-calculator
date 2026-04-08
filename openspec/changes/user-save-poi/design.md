# user-save-poi Design

## 设计目标

把 user-save 的 POI 相关能力收敛为一套独立 change：分类导航、坐标列表、右上角可见性控件、地图叠加层、tooltip 与命名解析统一归档。

## 组件边界

- `MapSaveCategoryMenu.vue`
  - 分类导航入口
- `MapSaveCoordList.vue`
  - 坐标列表、分组与搜索
- `MapSavePoiVisibilityControl.vue`
  - 右上角 POI checkbox 控件
- `MapSavePoiTooltip.vue`
  - 地图 POI tooltip
- `MapSvgCanvas.vue`
  - save POI 覆盖层渲染
- `useSaveStore.ts`
  - POI 分类、overlay item、统一命名输入数据

## 关键决策

### D1: 分类与显示控制分离

- 分类菜单只承担导航。
- 可见性 checkbox 移到地图右上角独立控件。
- 详情层临时显示类别由 `checkbox 勾选项 + 当前详情类别` 的并集决定。

### D2: 坐标列表只关心 POI 数据

- 坐标列表按星区分组，搜索只筛星区分组。
- 点击坐标项触发地图 focus，不负责写 `activeArchiveId`。

### D3: 统一命名与 overlay 组装

- `createOverlayItem` / 统一命名逻辑为列表与 tooltip 提供同源数据。
- 空间站命名、总部标签、弃船 ship name 与 purpose 解析都归 POI change 管理。

## 任务映射来源

- 主要来自 `user-save-map` 中与分类、可见性、坐标列表、地图 POI、tooltip、命名相关的任务。

