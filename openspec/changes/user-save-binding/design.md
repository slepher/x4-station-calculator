# user-save-binding Design

## 设计目标

把 `station-binding` 中的所有 binding 相关能力独立成 `user-save-binding`：包括 binding 数据模型、首页 binding 入口、Step 2 星区组编辑、Step 3 空间站绑定，以及 binding POI 地图交互。

## 结构拆分

### 数据层

- `useEmpireStore` / `saveBindingActions`
  - binding 创建、激活、archive time、group binding、station binding、连接星区
- `useSaveStore`
  - 提供具体 archive 预览，但不由地图层回写 binding active

### UI 层

- `MapSaveArchiveList.vue`
  - 首页 binding 图标入口与投影
- `MapSavePanel.vue`
  - binding 面包屑、Step 2/3 层切换
- `MapBindingSectorGroup.vue`
  - Step 2
- `MapBindingStation.vue`
  - Step 3
- `MapWorkbenchView.vue`
  - binding POI 展示、拖拽权限、tooltip 上下文

## 关键决策

### D1: binding 状态与首页 active 状态彻底分离

- 首页容器和 time 条目的高亮只读 `activeArchiveId`。
- binding 只影响 binding 图标点亮。
- binding 图标点击可以导致 `activeArchiveId` 改变，但那是显式 active 切换的结果，不是绑定状态本身直接参与渲染条件。

### D2: savePanel 独占管理 activeArchiveId

- `MapSavePanel` 内部负责 `selectArchive` / `selectArchiveGroup`。
- 地图层只接收“显示哪份 archive”的事件，不再通过 `select-archive` 回写 `saveStore.activeArchiveId`。
- guid 级 binding 可以保持 `activeArchiveId = guid`，同时地图仍预览 latest archive 实体。

### D3: Step 2 / Step 3 继续保留在 binding change

- Step 2 管理 empire sector 结构、定位星区、coverage、连接星区。
- Step 3 管理 save station 与 empire station 的绑定、失效态与 placement。

## 任务映射来源

- 主要来自旧 `station-binding` change 的 1-24 号任务
- 其中首页 Step 1 入口相关部分，保留在本 change 中作为 binding 首页入口能力

