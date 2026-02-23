# Tasks: button-tooltip-side

## 1. Implementation

- [x] 1.1 FavoriteButton tooltip placement
  - [x] 步骤 1：定位 `src/components/common/FavoriteButton.vue` 中 `<tippy>` 使用处。
  - [x] 步骤 2：为该 `<tippy>` 增加 `placement="left"`，确保仅影响收藏按钮 tooltip。

- [x] 1.2 LockButton tooltip placement
  - [x] 步骤 1：定位 `src/components/common/LockButton.vue` 中 `<tippy>` 使用处。
  - [x] 步骤 2：为该 `<tippy>` 增加 `placement="right"`，确保仅影响锁定按钮 tooltip。

- [x] 1.3 回归自查（非测试实现）
  - [x] 步骤 1：确认 tooltip 内容、样式与交互逻辑未被更改。
  - [x] 步骤 2：确认仅 StationWareFlow 相关按钮被影响，其他组件不受影响。
