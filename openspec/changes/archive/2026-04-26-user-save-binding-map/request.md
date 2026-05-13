# user-save-binding-map Change Request

## 目标

为 binding UI 提供完整的工作流：从首页 binding 入口图标开始，进入 Step 2 的星区组编辑，再进入 Step 3 的空间站绑定与地图交互。binding UI 以独立 binding store 为数据源，并把 Step 2/Step 3 从"逐个绑定 empire station"改为"星区覆盖自动派生 save station + 按需规划模块"。

## 已确认方案（审核重点）

### 1. Step 1 绑定入口

- binding Step 1 并入 `savePanel` 首页。
- 首页中的绑定图标既是状态指示，也是绑定操作入口。
- 若 binding 落在 `guid`：
  - 标题与最新 time 显示绑定图标
- 若 binding 落在具体 `time`：
  - 仅该 time 显示绑定图标
- 点击标题绑定图标：打开或创建该 `gameGuid` 的唯一 binding，并进入 Step 2。
- 点击 time 绑定图标：打开同一 `gameGuid` 的 binding，更新 `selectedArchiveTime`，并进入 Step 2。
- 进入 binding 前需要处理当前 ordinary empire 的未保存改动：如果量化生产当前 active source 是 `empire` 且 active empire dirty，系统先显示与 dirty empire 点击新建同源的确认流程。
- binding 的激活仅影响绑定图标显示，不参与首页容器或 time 条目的 active 高亮。
- `savePanel` 内部独占管理 `activeArchiveId`；地图层只接收"显示哪份 archive"的事件，不再反写 active。

### 2. Step 2 星区组编辑

- Step 2 整合进 `savePanel` 面包屑，标题显示 `存档名 绑定`。
- 上方显示 empire sector 列表，下方显示存档星区列表。
- 收缩态标题行为"手柄 + 名称 | 详情图标 + 编辑"。
- 收缩态正文直接显示定位星区药丸与按跳数分组的结果。
- 展开态只编辑单个 empire sector：
  - 名称输入框
  - `绑定星区>` 菜单
  - 定位星区药丸 + 跳数控件
  - 覆盖星区 / 候选星区 / 连接星区
  - 底部删除 / 取消 / 确认
- 连接星区基于定位星区 5 跳内其他已定位 empire sector 自动计算，并双向保存到 `groupBinding`。
- 若某个 map sector 已被其他 binding group 用作定位星区或 coverage：
  - 不能进入当前 group 的 coverage
  - 但仍显示在 candidate 列表中
  - 且不显示 `+`，只作为锁定候选展示
- 新建星区复用定位星区选择菜单：用户点击一个可用 save sector 后才创建 group，名称默认使用该 save sector 显示名称。

### 3. Step 3 空间站绑定

- Step 3 继续以 `map sector` 为分组轴。
- save station 为主显示对象。
- 正常绑定且当前 time 可解析的 empire station 不再重复独立显示。
- 用户不需要逐个绑定已有 save station；coverage 派生的 save stations 自动显示。
- 额外操作集中在：
  - 选择 blueprint empire，用其中 station 作为空间站蓝图导入模板
  - 将 blueprint empire station 的规划模块导入到 save station plan
  - 创建 virtual station 占位
  - 编辑或清空规划 modules
  - 绑定/解绑 save station 到 group 的默认中转站
- binding 可以记住一个 `blueprintEmpireId` 作为 UI 上的"空间站蓝图"来源。
- 从 blueprint empire station 导入时，只复制当时的规划，后续不与 source empire 同步。
- 绑定菜单 UI 细节：
  - 仅用背景色、置灰表达状态，不显示备注文字
  - Y 轴对齐 station-item，空间不足时向上弹出
  - 滚动条样式与 Step 2 统一
- 模块搜索面板与 Step 3 导入共享同一套默认排序规则，通过共享 comparator 实现。

### 3.1 星区中转站自动创建

- 星区组绑定定位星区时自动创建/更新默认 tradestation：
  - `position` = 星区中心坐标
  - `sectorMacro` = 该 group 的定位星区
  - 若 tradestation 已存在，则更新位置并解除绑定
- Step 3 不再显示"自由空间站"区域的中转站占位（因为每个 group 已有默认 tradestation）。
- save station 可绑定到该 group 的默认 tradestation（一对一关系）：
  - 绑定时设置 `saveStationCode`，position 使用 save station 的实际位置
  - 已绑定的 tradestation 不可再被其他 save station 绑定
- 解绑行为：当 save station 解绑 tradestation 时：
  - 位置重置到星区中心点
  - 转换为 virtual station（保留规划但无 `saveStationCode`）
  - tradestation 保留在原位置，可被其他 save station 绑定
- 定位星区变化时：
  - tradestation 的 sectorMacro 和 position 更新为新星区中心
  - 若已绑定 save station，则解除绑定（saveStationCode 清除）
- 已绑定的 save station 在地图上显示为 tradestation 图标（而非 factory 图标）

### 4. Binding POI 与地图行为

- binding POI 与 save POI 共用类型、owner 与尺寸语义，仅额外增加虚线六边形外框。
- binding POI 常驻显示，受 `playerStation` 可见性控制。
- 只有在对应 `sectorGroup` 的 Step 3 上下文中允许拖拽；否则只显示并支持 tooltip。

### 5. 拖拽交互

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

### 6. Binding save status UI

- save panel 的 binding 分支标题栏右侧提供保存控制：
  - `取消`：放弃当前 binding draft 改动
  - `保存`：写入 `x4_save_bindings`
  - `关闭`：关闭 binding 面板
- 面板底部只显示 dirty 状态，例如 `绑定已保存` / `绑定有未保存改动`。
- 量化生产界面只选择 `empire` / `save-binding` 数据源，不再提供保存 binding 或放弃 binding 改动的入口。

## 边界

### In Scope

- 首页 binding 图标入口与状态投影
- Step 2 星区组编辑 UI
- Step 3 空间站规划 UI（派生视图、blueprint 导入、virtual station）
- binding POI 展示、拖拽权限、tooltip 上下文
- binding save status UI（取消/保存/关闭）

### Out of Scope

- Binding 数据层与存储（属于 user-save-binding-data）
- productionSource 路由（属于 user-save-binding-data）
- POI 分类页、坐标列表与右上角可见性控件
- `savePanel` 首页的通用分组容器交互与非 binding 高亮规则

## 验收标准（DoD）

1. 首页 binding 图标可创建/切换 guid 级或 time 级 binding，并进入 Step 2。
2. binding 图标状态投影正确；binding 不影响首页容器 active。
3. savePanel 独占管理 `activeArchiveId`，地图层不回写。
4. Step 2 提供星区组编辑、连接星区与删除清理能力。
5. Step 2 候选星区锁定逻辑正确：被占用星区显示锁定样式，不显示 `+`。
6. Step 2 新建星区复用定位星区菜单，用户点击可用 save sector 后才创建 group。
7. Step 3 按 coverage 自动列出 save stations，无需逐个绑定。
8. Step 3 绑定菜单 UI 正确：仅用背景色/置灰表达状态，Y 轴对齐，滚动条统一样式。
9. Step 3 模块排序规则与搜索面板共享。
10. Step 3 可选择 blueprint empire 并导入规划模块。
11. binding POI 常驻显示，但拖拽权限受当前 Step 3 上下文限制。
12. binding save status UI 正确显示取消/保存/关闭，dirty 状态正确。
13. Group 创建时自动创建 tradestation（position=星区中心，sectorMacro=定位星区）。
14. Step 3 不显示"自由空间站"区域的中转站占位。
15. Save station 可绑定到 group 默认 tradestation（一对一）。
16. 已绑定 tradestation 不可再被其他 save station 绑定。
17. 解绑时 save station 变为 virtual station，位置重置到星区中心。
18. 定位星区变化时，tradestation 更新到新星区中心并解除绑定。
19. 已绑定的 save station 显示 tradestation 图标。

## 未决项

无