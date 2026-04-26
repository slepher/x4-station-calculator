# user-save-list Design

## 设计目标

将 `savePanel` 首页收敛成稳定的存档工作台首页：负责显示存档分组、承载 guid/time 级 active 投影，并为 POI 与 binding 两条后续流程提供统一入口。

## 结构拆分

### 首页组件职责

- `MapSavePanel.vue`
  - 负责面包屑与首页/子页面层级切换
- `MapSaveArchiveList.vue`
  - 负责首页列表渲染
  - 负责 guid 外容器、标题、time 条目与图标布局
  - 负责首页层的 guid/time 点击职责划分

### 状态职责

- `saveStore.activeArchiveId`
  - 唯一负责首页 active 投影
  - 支持 `guid` 与 `guid+time`
- `saveStore.selectedArchive`
  - 为地图与后续页面提供当前实际使用的 archive 实体
- 首页高亮只读取 `activeArchiveId`
  - 不混入 binding 状态
- `MapWorkbenchView`
  - 只消费“当前地图应预览哪份 archive”的事件
  - 不再借首页事件反向调用 `selectArchive()` 改写 `activeArchiveId`

## 关键决策

### D1: guid 外容器作为首页主 click target

- guid 分组外容器承担 guid 级 active 点击目标。
- 标题文本只是该 click target 的一部分，不再是唯一点击区。
- time 列表区域通过阻止冒泡，避免误触 guid 级选择。

### D2: 外容器高亮与 time 高亮分层

- 外容器使用弱背景表示分组容器。
- guid 级 active 采用与 time active 同色系但更弱的填充。
- time active 使用更强填充。
- hover 不得覆盖 active 态，因此 active 样式需要显式覆盖 hover。

### D3: 首页入口职责分离

- 标题/外容器点击：只设定 guid 级 active。
- 标题 POI 图标：进入 guid 级 POI 列表。
- time 主体点击：切换到该 time 的查看状态。
- time POI 图标：进入该 time 的 POI 列表。
- binding 图标入口由 `user-save-binding` change 定义，但仍复用首页图标框架。

### D4: root 面包屑仅做导航

- root 面包屑不再承担“退出预览后恢复 archive active”的旧职责。
- 返回首页时仅切换 `MapSavePanel` 的 layer。
- 之前的 restore 逻辑应完全移除，避免 guid 级 active 被降为 time 级。

### D5: active 状态与地图预览彻底分离

- 首页 active 语义由 `saveStore.activeArchiveId` 独占。
- 地图当前看到哪份 archive，则由 `saveStore.selectedArchive` 负责。
- `savePanel` 内部调用：
  - `selectArchiveGroup(guid)` 写 guid 级 active
  - `selectArchive(guid, time)` 写 time 级 active
- 地图层收到首页事件后，只允许切换 `selectedArchive` 对应的预览，不允许回写 `activeArchiveId`。
- 因此 guid 级 active 在刷新、进入 POI 列表、进入 binding 流程后都应稳定保留，除非用户明确执行了新的 active 切换。

## 任务映射来源

- 主要来自 `user-save-map` 的首页/面包屑/存档列表任务
- 以及 `station-binding` 中 Step 1 并入首页后的首页结构调整结果
