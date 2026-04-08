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

### D4: Step 3 的普通站与虚拟中转站统一收敛到同一套 binding 语义

- 普通 empire 站与虚拟中转站都以“是否存在 binding 记录、是否存在 `saveStationCode`”判断自由 / 已放置 / 已绑定。
- 不再使用单独的 `free` 语义字段；不存在记录就是自由站点。
- save station 改绑目标时，被顶替的旧目标一律清理旧 binding 并回归自由。
- 显式解绑也直接清理旧 binding 并回归自由，不保留额外的 placed 壳状态。

### D5: Step 3 绑定菜单表达状态，但不承担额外说明文案

- 菜单项仅通过背景色、active、高亮、置灰表达状态。
- 不再显示“已设置位置”“虚拟中转站”等右侧备注文字。
- 已拖拽到地图但未绑定的对象在菜单中仍视为不可绑定候选，只作为状态提示出现。
- 不可绑定项行为上仍然禁用，但 cursor/hover 反馈保持克制，不使用强烈的禁止态视觉。

### D6: Step 3 绑定菜单定位与 Step 2 一致

- 菜单继续从面板右侧弹出，不改变 X 轴弹出方向。
- 菜单的 Y 轴对齐对应 `station-item`。
- 当向下空间不足时，菜单改为向上弹出，并保持菜单底边与触发条目底边齐平。
- Step 3 菜单滚动条风格与 Step 2 绑定菜单统一。

### D7: 导入 save station 时仅以 `module_id` 导入模块

- save parser 已为模块聚合结果补充 `module_id`。
- 从 Step 3 绑定菜单导入新建 empire station 时，只接受带 `module_id` 的模块并写入 `StationPlan.modules`。
- 不回退到 `ref`，避免导入宏 ID 而不是 station 规划侧需要的模块 ID。

### D8: 异常 binding 允许在 Step 3 内直接修复

- 若 save station 指向的 `stationBinding` 仍存在，但其 `stationId` 已无法解析到 empire station，则该 save station 进入异常态。
- 异常态按钮显示红色 `绑定异常`，仍可打开绑定菜单重新选择目标。
- 绑定菜单中额外插入一条“异常空间站”，提供 `x` 动作以清理这条坏 binding。
- 这里的“异常”只影响绑定按钮与菜单，不改变首页 active、Step 2 或其他 save station 的语义。

### D9: 异常导入/转绑必须先释放旧坏 binding

- 当 save station 当前处于异常绑定态时，从菜单执行“导入空间站”或重新绑定到其他 empire station，必须先释放该 `saveStationCode` 上残留的旧 binding。
- 释放旧 binding 时同步清理被替换 station 的 `sectorId` 引用，避免坏记录残留导致按钮仍保持异常态。
- 该规则与普通转绑保持一致：同一个 `saveStationCode` 在同一时刻只允许绑定一个目标。

### D10: 模块搜索面板与 Step 3 导入共享同一套默认排序规则

- `generateFilteredModulesGrouped()` 负责生成搜索面板结果，但不再作为 Step 3 导入排序的数据来源。
- 模块搜索面板默认顺序被抽取为共享 comparator：
  - 组排序使用同一套 type/group 优先级
  - 组内模块排序使用同一套 tier/name 规则
- 搜索面板和 Step 3 导入都调用这套共享 comparator，避免“导入靠拍平 UI 结果”带来的隐性漂移。

## 任务映射来源

- 主要来自旧 `station-binding` change 的 1-24 号任务
- 其中首页 Step 1 入口相关部分，保留在本 change 中作为 binding 首页入口能力
