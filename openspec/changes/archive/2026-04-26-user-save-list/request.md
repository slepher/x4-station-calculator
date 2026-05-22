# user-save-list Change Request

## 目标

重整地图中的存档首页，使 `savePanel` 的最外层列表稳定承担“存档入口首页”的职责，承接存档分组展示、guid/time 级 active 投影、POI 与绑定入口图标，以及统一的面包屑根导航。

## 已确认方案（审核重点）

### 1. 首页层级与入口

- 地图底部保留“存档”入口按钮，打开 `savePanel`。
- `savePanel` 打开后默认停留在最外层存档首页，不再自动跳转到 POI 分类列表。
- 首页显示上传区、默认地图项、按玩家分组的存档列表。

### 2. 首页分组容器

- 每个 `guid` 分组使用统一外容器包裹标题与所有 time 条目。
- 外容器始终有弱背景；guid 级 active 时，外容器使用与 time active 同色系但更弱的填充。
- 外容器本身可点击，触发 guid 级 active 选择；不再仅限标题文字可点击。
- 外容器保留 `0.5rem` padding。

### 3. 标题与 time 项结构

- 标题行左侧显示玩家名与存档数量，右侧显示 POI 图标与绑定图标。
- 存档数量紧靠玩家名显示，不再被大空隙拉开。
- time 项继续显示时间、文件名，以及 POI / 绑定图标。
- 图标常驻显示；hover 时仅增强“可操作”反馈。
- POI 图标去掉外边框，与绑定图标使用同一套轻量样式。

### 4. 首页点击职责

- 点击标题或 guid 外容器：仅触发 guid 级 active，不进入 POI 列表。
- 点击标题上的 POI 图标：进入该 guid 的 POI 分类列表。
- 点击具体 time 条目主体：切换到该 time 的查看状态。
- 点击具体 time 的 POI 图标：进入该 time 的 POI 分类列表。
- time 区域与图标点击不得冒泡成 guid 外容器点击。

### 5. 首页高亮投影

- `activeArchiveId` 支持 `guid` 级与 `guid+time` 级两种粒度。
- 若 `activeArchiveId` 为 `guid`：
  - 标题外容器高亮
  - 最新 time 同时显示镜像高亮
- 若 `activeArchiveId` 为 `guid+time`：
  - 仅对应 time 高亮
- active 的颜色优先级高于 hover，hover 不得覆盖 active 颜色。
- 首页容器与 time 条目的高亮只由 `activeArchiveId` 决定；地图当前显示哪份 archive 不得反向覆盖首页 active 结果。

### 6. 面包屑根导航

- `savePanel` 顶部统一使用面包屑。
- 点击 root 面包屑仅负责切回存档首页，不再恢复或改写 archive active。
- 进入 POI 列表时，二级面包屑仅显示存档名。
- 进入 binding 流程时，二级面包屑显示 `存档名 绑定`，但其详细语义归 `user-save-binding` change 管理。

### 7. active 与地图预览职责拆分

- `savePanel` 内部独占管理 `saveStore.activeArchiveId` 的切换：
  - guid 级点击使用 `selectArchiveGroup`
  - time 级点击使用 `selectArchive`
- 地图层不再借首页事件回写 `activeArchiveId`。
- 首页发出的 archive 事件仅用于告诉地图“当前应显示哪份 archive 的 POI”。
- 因此：
  - guid 级 active 可以保持为 `guid`
  - 地图仍可预览某个具体 `time` 的 archive 实体
  - 刷新后首页高亮与地图内容不会互相覆盖。

## 边界

### In Scope

- `savePanel` 首页默认层级
- guid 外容器、标题、time 条目与图标的首页布局
- guid/time 级 active 投影
- 首页点击职责与冒泡边界
- root 面包屑回首页行为

### Out of Scope

- POI 分类菜单、坐标列表、tooltip 与地图 POI 叠加层细节
- binding 的数据模型与 Step 2 / Step 3 工作流
- POI / binding 图标的业务规则细节

## 验收标准（DoD）

1. 打开 `savePanel` 后，默认停留在存档首页，不自动进入 POI 分类列表。
2. guid 分组外容器始终显示弱背景，guid 级 active 时显示更强但弱于 time 的高亮。
3. 点击 guid 外容器或标题，可触发 guid 级 active，而不会进入 POI 列表。
4. 点击标题 POI 图标会进入该 guid 的 POI 分类列表。
5. 点击 time 主体只切换到该 time 的查看状态；点击 time 的 POI 图标进入该 time 的 POI 分类列表。
6. time 主体和图标点击不会冒泡触发 guid 级 active。
7. `activeArchiveId=guid` 时，标题与最新 time 投影高亮；`activeArchiveId=guid+time` 时，仅对应 time 高亮。
8. active 颜色在 hover 下保持优先，不会被 hover 覆盖。
9. 点击 root 面包屑仅切换回首页，不恢复旧的 archive active。
10. guid 级 active 与地图当前预览 archive 的职责分离；地图预览切换不会把 guid 级 active 降级成具体 time。

## 未决项

无
