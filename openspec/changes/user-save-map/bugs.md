# user-save-map Bugs

## 2026-04-01 地图兴趣点 overlay 未渲染

- 现象：
  存档分类计数和坐标列表正常，但勾选分类后地图上没有任何兴趣点 marker，导致 focus 和 tooltip 链路失效。
- 根因：
  存档数据中的 `sectorMacro` 使用小写格式（如 `cluster_100_sector001_macro`），地图数据中的 sector id 使用首字母大写格式（如 `Cluster_100_Sector001_macro`）。
  地图页与坐标列表使用严格区分大小写的 sector 匹配，导致 overlay 渲染、focus 和 sector 名解析全部 miss。
- 修复：
  新增共享 helper `resolveMapSectorByMacro()`，统一用 case-insensitive 方式解析 sector macro，并接入：
  - `MapSaveCoordList.vue`
  - `MapSvgCanvas.vue`
  - `MapWorkbenchView.vue`
- 验证：
  修复后勾选分类可渲染 marker，点击坐标可 focus marker，点击 marker 可显示 tooltip。
