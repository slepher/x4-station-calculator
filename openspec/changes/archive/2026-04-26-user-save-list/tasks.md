# user-save-list Tasks

## Imported from user-save-map

- [x] T1.1 创建 `MapSavePanel.vue` 主组件
- [x] T1.2 创建 `MapSaveBreadcrumb.vue`
- [x] T1.3 创建 `MapSaveArchiveList.vue`
- [x] T1.4 修改 `MapWorkbenchView.vue` 添加存档按钮
- [x] T6.2 样式一致性调整（save 面板基础视觉统一）
- [x] T6.3 构建验证
- [x] T7.5 Save 面板视觉统一

## Imported from station-binding

- [x] 24.1 将 binding Step 1 并入 `MapSavePanel` 最外层，并将 Step 2 / Step 3 标题整合进 `MapSavePanel` 面包屑
- [x] 24.2 调整 Step 1 普通点击 `time` 的行为：切换 POI 到该 `time`、高亮该条目，但不修改 binding，也不自动进入 Step 2
- [x] 24.7 调整 `activeArchiveId` 结构与显示规则：支持 `guid` 级或 `guid + time` 级保存，并按标题/时间项投影逻辑显示 POI 高亮
- [x] 24.8 调整 POI 图标样式：与 binding 图标使用同一视觉系统，去除外边框，并保持常驻状态显示 + hover 操作强化

## Homepage Interaction Refinements

- [x] L1.1 guid 外容器承担 guid 级 active 点击目标，而不仅仅是标题文字
- [x] L1.2 标题 POI 图标进入 POI 列表；标题点击不进入列表
- [x] L1.3 time 区域与图标点击阻止冒泡，不触发 guid 级 active
- [x] L1.4 guid 外容器使用常驻弱背景，active 使用同色系更强填充
- [x] L1.5 active 颜色优先级高于 hover，hover 不覆盖 active
- [x] L1.6 root 面包屑仅切回首页，不再恢复 archive active
- [x] L1.7 `savePanel` 独占管理 `activeArchiveId`，地图层不再借首页事件回写 active
- [x] L1.8 新增 archive 预览路径：地图可切换具体 archive 预览，但不覆盖 guid 级 active
