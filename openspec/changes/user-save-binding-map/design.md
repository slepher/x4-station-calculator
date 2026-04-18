# user-save-binding-map Design

## 设计目标

本变更提供 binding UI 工作流，使 binding 以独立 binding store 为数据源，并把 Step 2/Step 3 从"逐个绑定 empire station"改为"星区覆盖自动派生 save station + 按需规划模块"。

## UI 设计

### Save homepage (Step 1)

存档首页 binding 图标打开或创建对应 `gameGuid` 的唯一 binding。点击 guid 级入口打开 latest 视角，点击 time 级入口更新 `selectedArchiveTime` 并打开同一个 binding。

进入 binding 前需要处理当前 ordinary empire 的未保存改动：如果量化生产当前 active source 是 `empire` 且 active empire dirty，系统先显示与"新建帝国"同源的 SmartSave 确认。用户选择保存或放弃后才继续进入 binding；用户关闭确认时停留在原状态。

成功进入 binding 后，调用 `useEmpireStore.switchToBinding(gameGuid)` 将量化生产 active source 切换为当前 `gameGuid` 的 save-binding。

### Step 2: Binding groups

Step 2 不再显示"帝国星区"，改为 binding 星区列表。用户在这里创建、排序、重命名 group，设置 anchor、coverage、jump range 和 connected groups。

新建 group 复用编辑 group 的 anchor sector 选择菜单。点击"新建星区"时只打开候选菜单，不立即创建空 group；用户选择一个未被其他 group 占用的 save sector 后，UI 展开一个新 group draft：

- `sectorMacro` 使用被点击的 save sector
- `name` 默认使用该 save sector 的显示名称
- coverage 按当前默认 jump range 自动计算
- 菜单候选、样式和禁用逻辑与编辑 anchor sector 完全一致

### Step 3: Station planning

Step 3 的主对象是 group coverage 派生出的 save stations、用户显式创建的 virtual stations 以及 group 默认的 tradestation。用户不需要逐个绑定已有 save station。额外操作集中在：

- 选择 blueprint empire，用其中 station 作为空间站蓝图导入模板。
- 将 blueprint empire station 的规划模块导入到某个 save station plan。
- 创建 virtual station 占位。
- 编辑或清空规划 modules。
- 绑定/解绑 save station 到 group 的默认中转站。

### 星区中转站自动创建

每个 group 绑定定位星区时自动创建/更新一个默认 tradestation，无需用户手动拖拽：
- `position` = 星区中心坐标（从定位星区数据获取）
- `sectorMacro` = 该 group 的定位星区
- 若 tradestation 已存在，则更新位置并解除绑定

Step 3 不再显示"自由空间站"区域的中转站占位，因为每个 group 已有默认 tradestation。

绑定规则：
- save station 可绑定到该 group 的默认 tradestation（一对一）
- 绑定时 position 使用 save station 的实际位置
- 已被绑定的 tradestation 显示已绑定状态，不可再被其他 save station 绑定

解绑规则：
- 解绑时 save station 位置重置到星区中心点
- 转换为 virtual station（保留规划但无 `saveStationCode`）
- tradestation 保留原位置，可被其他 save station 绑定

定位星区变化：
- tradestation 的 sectorMacro 和 position 更新为新星区中心
- 若已绑定 save station，则解除绑定

显示规则：
- 已绑定的 save station 在地图上显示为 tradestation 图标（设置 `tag: 'tradestation'`）
- 已绑定的 tradestation overlay 不显示（由 save station POI 代替）

### 拖拽交互

#### 从 save panel 拖拽

- 拖拽自由空间站到地图 → 创建 `BindingStationPlan`（无 `saveStationCode`）
- 注：星区中转站已自动创建，不再需要手动拖拽

#### 拖拽已放置的 station

- 拖拽已放置的 binding station → 移动位置（调用 `setStationPlanPosition`）
- 拖拽星区中转站 → 移动位置（调用 `setTradeStationPosition`）

#### 拖拽预览

拖拽时显示与 POI 一致的图标风格：
- 正确的图标大小和 owner 颜色
- 虚线外圈表示 binding overlay
- 使用 `activeBindingDragPreview` 构建 `savePoiVisual`

### Binding save status

save panel 的 binding 分支标题栏右侧提供保存控制：

- `取消`：放弃当前 binding draft 改动
- `保存`：写入 `x4_save_bindings`
- `关闭`：关闭 binding 面板

面板底部只显示 dirty 状态，例如 `绑定已保存` / `绑定有未保存改动`。量化生产界面只选择 `empire` / `save-binding` 数据源，不再提供保存 binding 或放弃 binding 改动的入口。

## 关键决策

### D1: binding 状态与首页 active 状态彻底分离

- 首页容器和 time 条目的高亮只读 `activeArchiveId`。
- binding 只影响 binding 图标点亮。
- binding 图标点击可以导致 `activeArchiveId` 改变，但那是显式 active 切换的结果，不是绑定状态本身直接参与渲染条件。

### D2: savePanel 独占管理 activeArchiveId

- `MapSavePanel` 内部负责 `selectArchive` / `selectArchiveGroup`。
- 地图层只接收"显示哪份 archive"的事件，不再通过 `select-archive` 回写 `saveStore.activeArchiveId`。
- guid 级 binding 可以保持 `activeArchiveId = guid`，同时地图仍预览 latest archive 实体。

### D3: binding UI 以独立 binding store 为数据源

- `MapSavePanel` / `MapBindingSectorGroup` / `MapBindingStation` 都使用 `useSaveBindingStore`。
- 不再读写 `useEmpireStore` 的 saveBindings 或 sectors。

### D4: Step 2 候选星区锁定逻辑

- 若某个 map sector 已被其他 binding group 占用为定位星区或 coverage，该 map sector 不能进入当前 draft 的 coverage。
- 这类 map sector 仍然保留在 candidate 星区列表中，避免用户误以为它在跳数范围内消失。
- candidate 列表中的这类项使用锁定样式展示，但不显示 `+`，也不能加入 coverage。
- 当前 group 自己已有的 coverage 在打开编辑时会保留，不受这条跨组占用规则误伤。

### D5: Step 2 新建星区复用定位星区菜单

- 新建时只打开候选菜单，不立即创建空 group。
- 用户选择可用 save sector 后才创建 group draft。
- 名称默认使用该 save sector 显示名称。

### D6: Step 3 绑定菜单 UI 细节

- 菜单项仅通过背景色、active、高亮、置灰表达状态。
- 不显示"已设置位置""虚拟中转站"等右侧备注文字。
- 菜单继续从面板右侧弹出，Y 轴对齐对应 `station-item`。
- 当向下空间不足时，菜单改为向上弹出，并保持菜单底边与触发条目底边齐平。
- 菜单滚动条风格与 Step 2 绑定菜单统一。

### D7: Step 3 以 coverage 派生 save stations 为主显示对象

- coverage 派生的 save stations 自动显示。
- 用户不需要逐个绑定已有 save station。
- 已有 `BindingStationPlan` 显示其规划 modules/settings/name。
- 没有 plan 的 save station 显示空规划状态。

### D11: 星区中转站自动创建与绑定规则

- 每个 group 绑定定位星区时自动创建/更新默认 tradestation，无需用户手动拖拽。
- 默认 tradestation 的 position = 星区中心，sectorMacro = 定位星区。
- Step 3 不显示"自由空间站"区域的中转站占位。
- save station 与 tradestation 是一对一绑定关系。
- 绑定时使用 save station 的实际位置。
- 已被绑定的 tradestation 不可再被其他 save station 绑定。
- 解绑时 save station 变为 virtual station，位置重置到星区中心。
- 定位星区变化时，tradestation 更新到新星区中心并解除绑定。
- 已绑定的 save station 显示 tradestation 图标。

### D8: Blueprint empire 作为导入模板来源

- `blueprintEmpireId` 只用于显示可导入候选，不代表持续同步关系。
- 导入时复制当时的规划数据，后续不与 source empire 同步。

### D9: 模块搜索面板与 Step 3 导入共享排序规则

- `generateFilteredModulesGrouped()` 负责生成搜索面板结果，但不再作为 Step 3 导入排序的数据来源。
- 模块搜索面板默认顺序被抽取为共享 comparator：
  - 组排序使用同一套 type/group 优先级
  - 组内模块排序使用同一套 tier/name 规则
- 搜索面板和 Step 3 导入都调用这套共享 comparator，避免"导入靠拍平 UI 结果"带来的隐性漂移。

### D10: Binding POI 常驻显示但拖拽受限

- binding POI 常驻显示，受 `playerStation` 可见性控制。
- 只有在对应 `sectorGroup` 的 Step 3 上下文中允许拖拽。
- 其他 context 下只显示并支持 tooltip。

### D12: ConstructionSite Tag 判断

- 当 modules=[] 时，tag='constructionsite'（表示正在建造的站点）
- 判断逻辑在 `enrichPlayerStation`、`enrichNpcStation`、`enrichFactionStation` 中统一处理
- 所有站点类型（player/npc/xenon/khaak）均适用此规则

### D13: Station Label 逻辑统一

- Tooltip 和 Step 3 绑定界面使用同一套 label 逻辑
- `savePoiLabel.ts` 的 `getNpcStationPoiLabel` 是唯一 label 来源
- `MapBindingStation.vue` 复用此函数，避免独立维护 tagLabelKeys

### D14: Module Pattern 判断精确化

- shipyard: `_ships_xl_` 或 `_ships_l_`（XL 和 L 级造船模块）
- wharf: `_ships_m_`（M 级造船模块）
- equipmentdock: `_equip_`（设备模块）
- pattern 必须带下划线，避免误匹配

## 错误与边界处理

- 如果当前 archive 缺失，Step 2/3 显示当前 time 不可用状态，派生 save station view 为空。
- 如果 `blueprintEmpireId` 指向不存在的 empire，Step 3 清空候选列表。
- 如果用户关闭 dirty binding 面板，提供保存、放弃或继续编辑的选择。

## 测试关注点

- 首页 binding 图标入口正确创建/打开 binding。
- dirty empire 确认流程正确执行。
- Step 2 新建星区菜单正确复用定位星区选择逻辑。
- Step 3 coverage 派生 save stations 自动显示。
- Blueprint 导入只复制当时规划，后续不同步。
- binding POI 拖拽权限受 Step 3 context 限制。
- binding save status UI 正确显示 dirty 状态。
- Group 绑定定位星区时自动创建/更新 tradestation（位置=星区中心）。
- Save station 绑定/解绑 tradestation 正确执行。
- 已绑定 tradestation 不可再被绑定。
- 定位星区变化时 tradestation 正确更新并解除绑定。
- 已绑定的 save station 显示 tradestation 图标。
- ConstructionSite 站点（modules=[]）正确显示建筑仓库图标和标签。
- Tooltip 和 Step 3 绑定界面显示一致的 station label。