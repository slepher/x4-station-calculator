# Auto Sector Group Map Integration Specification

## Purpose

定义自动星区划分系统接入 Map 界面的行为规范：系统 SHALL 在 Map 的 Save Panel binding-sector 层中提供与 Live Production 一致的自动分组能力，支持 Hub / 分配方案 / Trade Station / Virtual Station 视图切换、双上下文样式适配、pill 聚焦地图、拖拽排序，并复用 `useLiveProductionStore` 中的唯一共享 draft。

## ADDED Requirements

### Requirement: Map Context View Switching

系统 MUST 在 map 上下文中用 Hub / 分配方案 / Trade Station / Virtual Station 视图分离群组管理、星区分配、交易站选择和虚拟生产空间站编辑界面，并且这些视图 MUST 读写同一份 shared draft。

#### Scenario: Hub tab displays group management
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **当** 用户位于 Hub tab
- **那么** 系统 SHALL 显示共用 `AutoSectorBar(view='map')`
- **并且** Hub tab SHALL 显示 `SectorGroupStatBar(view='map')` 和 `SectorGroupList(view='map')`
- **并且** `SectorGroupList` SHALL 支持拖拽排序
- **并且** SHALL NOT 渲染 Col 1 的 `SaveUploadPanel`

#### Scenario: Allocation view displays assignment cards
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **并且** Hub tab 不处于编辑输入态
- **当** 用户切换到分配方案 tab
- **那么** 系统 SHALL 显示 `SectorAllocationList(view='map')`
- **并且** 顶部共用 `AutoSectorBar` SHALL 保持可见
- **并且** SHALL 不重新计算 autoGroupResult

#### Scenario: Trade Station view displays station cards
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **并且** Hub tab 不处于编辑输入态
- **当** 用户切换到 Trade Station 视图
- **那么** 系统 SHALL 显示 `SectorTradeStationList(view='map')`
- **并且** 顶部共用 `AutoSectorBar` SHALL 保持可见
- **并且** SHALL 不重新计算 autoGroupResult

#### Scenario: Map trade station view shows candidates
- **前提** Map Trade Station 视图已打开
- **当** 系统渲染任意 hub group card
- **那么** 每个 card SHALL 展示候选站 radio、score、containerCap 和虚拟交易站选项

#### Scenario: Virtual Station tab displays virtual station editor
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **当** 用户切换到 Virtual Station tab
- **那么** 系统 SHALL 显示 blueprint station 来源列表
- **并且** SHALL 显示空白空间站来源项
- **并且** SHALL 显示按当前 groups 分组的 virtual station draft 列表
- **并且** SHALL 不重新计算 autoGroupResult

#### Scenario: Live does not display virtual station tab
- **前提** Live 计算模式渲染 `AutoSectorGroupPanel layout="columns"`
- **当** 系统显示三列布局
- **那么** 系统 SHALL NOT 显示 Virtual Station tab

#### Scenario: Virtual Station tab remains available in map states
- **前提** 用户位于 Map binding 界面
- **当** Hub 处于 edit 或 result 模式，或用户切换 Allocation / Trade Station / Virtual Station tab
- **那么** 系统 SHALL 允许 virtual station draft 继续被地图拖拽创建、移动或删除
- **并且** virtual station 编辑 SHALL NOT 依赖 Virtual Station tab 当前激活

#### Scenario: Map confirmed state hides draft tabs
- **前提** 自动分组已确认完成
- **当** 系统渲染 map binding wrapper
- **那么** 系统 SHALL NOT 显示 Hub / 分配方案 / Trade Station / Virtual Station tab
- **并且** 系统 SHALL NOT 显示 `SectorAllocationList` 或 `SectorTradeStationList`
- **并且** 系统 SHALL 在每个 group 上显示进入 station binding 的按钮

### Requirement: Context-Aware Component Styling

系统 MUST 根据 `view` prop 适配子组件的布局和交互。

#### Scenario: Map context uses compact layout
- **前提** `SectorGroupList` 的 `view` prop 为 `'map'`
- **当** 系统渲染 group 列表
- **那么** 系统 SHALL 使用适配 360px 侧边栏宽度的紧凑样式
- **并且** pill SHALL 不溢出容器宽度
- **并且** group card SHALL 收紧 padding、header margin、label 字号、pill gap 和 jump row 间距

#### Scenario: Live context uses three-column layout
- **前提** `SectorOverviewPanel` 渲染 live overview
- **当** 系统渲染三列布局
- **那么** 面板顶部 SHALL 显示共用的 `AutoSectorBar`
- **并且** Col 1 SHALL 显示 `SectorGroupList(view='live')`
- **并且** Col 2 SHALL 显示 `SectorAllocationList(view='live')`
- **并且** Col 3 SHALL 显示 `SectorTradeStationList(view='live')` 或完成态内容

#### Scenario: Shared bars keep calculation mode separate from view
- **前提** `AutoSectorBar` 或 `SectorGroupStatBar` 渲染
- **当** 系统传递 props
- **那么** `mode` SHALL 继续表示 `'result' | 'edit'`
- **并且** `view` SHALL 表示 `'map' | 'live'`

### Requirement: Pill Click Focus Sector on Map

系统 MUST 在 map 上下文中的 pill 点击事件触发地图聚焦到对应星区。

#### Scenario: Coverage pill click focuses sector
- **前提** Map 上下文中的 Hub tab 处于结果态
- **当** 用户点击 group 的 coverage/candidate/connected pill
- **那么** 系统 SHALL emit `focus-sector` 事件并携带 sectorMacro
- **并且** 父组件 `MapWorkbenchView` SHALL 将地图视口平移到该 sector 居中

#### Scenario: Anchor and trade station pills focus anchor sector
- **前提** Map 上下文中的 Hub tab 显示 group card
- **当** 用户点击 anchor pill 或 trade station pill
- **那么** 系统 SHALL emit `focus-sector` 事件并携带该 group 的 anchor sector macro
- **并且** Live 上下文 SHALL NOT 因点击这些 pill emit `focus-sector`

#### Scenario: Assignment sector name click focuses sector
- **前提** Map 上下文中的分配方案 tab 显示 assignment card
- **当** 用户点击 assignment card 中的 sector 名
- **那么** 系统 SHALL emit `focus-sector` 事件并携带该 sector 的 macro
- **并且** 地图 SHALL 聚焦到该 sector

#### Scenario: Live context does not emit focus-sector
- **前提** `SectorGroupList` 的 `view` prop 为 `'live'`
- **当** 用户点击 pill
- **那么** 系统 SHALL NOT emit `focus-sector` 事件

### Requirement: Hub Add Menu Context Selection

系统 MUST 在 Map 和 Live 上下文复用 `HubAddMenu`，并按上下文切换呈现方式与地图定位能力：Map 使用默认/侧栏入口并显示定位地图按钮，Live 使用 `mode='overlay'` fixed overlay。

#### Scenario: Map context uses HubAddMenu with locate action
- **前提** Hub tab 处于编辑态
- **并且** `view` 为 `'map'`
- **当** 用户点击 [添加枢纽]
- **那么** 系统 SHALL 打开 `HubAddMenu`
- **并且** SHALL 显示"定位地图"按钮
- **并且** 点击"定位地图"按钮 SHALL emit `focus-sector`
- **并且** 选择 sector 后 SHALL 创建 hub draft 并关闭 popup

#### Scenario: Live context uses overlay HubAddMenu
- **前提** Live 上下文中的 Col 2 处于编辑态
- **并且** `view` 为 `'live'`
- **当** 用户点击 [添加枢纽]
- **那么** 系统 SHALL 以 `HubAddMenu mode='overlay'` 打开 fixed overlay
- **并且** SHALL NOT 显示"定位地图"按钮

#### Scenario: Already-anchor sector cannot be added in either context
- **前提** 某 sector 已是任意 group anchor
- **当** 任一上下文中的 hub 添加菜单显示该 sector
- **那么** 系统 SHALL 不提供添加操作

### Requirement: Group Drag-and-Drop Sorting in Hub Tab

系统 MUST 在 Hub tab 中支持拖拽排序 group 列表。

#### Scenario: Drag reorder groups
- **前提** Hub tab 显示多个 group
- **当** 用户拖拽一个 group card 到新位置
- **那么** 系统 SHALL 更新 groups 数组顺序
- **并且** SHALL NOT 触发重新计算
- **并且** 确认写入时 SHALL 按 groups 数组顺序持久化新顺序
- **并且** `order` 字段 SHALL NOT 作为排序权威

#### Scenario: Drag uses handle and placeholder
- **前提** Hub tab 允许拖拽排序
- **当** 系统渲染 group card
- **那么** card SHALL 显示专用 drag handle
- **当** 用户拖拽 card
- **那么** 落点 SHALL 显示虚线 placeholder
- **并且** placeholder SHALL NOT 改变 coverage、connection、jumpRange、isPinned 或 assignment 状态

#### Scenario: Drag does not alter group data
- **前提** 用户拖拽排序 group
- **当** 排序完成
- **那么** 系统 SHALL 保留各 group 的 coverage、connectedGroupIds、jumpRange、isPinned 不变

### Requirement: Shared Draft Lifecycle In Map

系统 MUST 由 `useLiveProductionStore` 初始化并维护当前 active binding/archive 的唯一共享 draft。Map 面板 MUST 复用该 draft，不得通过独立 flag 触发 presenter 维护第二套自动分组状态。

#### Scenario: Refresh initializes shared draft
- **前提** 页面刷新后 active binding 和 selected archive 已恢复
- **当** `useLiveProductionStore` 完成初始化
- **那么** 系统 SHALL 根据 `needsAutoGroupRecalc` 调用 `initAutoGroupDraft()`
- **并且** Map 面板 SHALL 读取该共享 `autoGroupResult`

#### Scenario: Binding switch resets shared draft
- **前提** 用户手动切换 active binding
- **当** 新 binding 与 selected archive 有效匹配
- **那么** `useLiveProductionStore` SHALL 为新上下文重新初始化唯一 `autoGroupResult`
- **并且** Map 面板 SHALL NOT 继续显示上一 binding 的未提交 draft

#### Scenario: Archive switch resets shared draft
- **前提** 上传新存档或 archive timing 变化导致 selected archive 切换
- **当** selected archive 与 active binding 的 gameGuid 匹配
- **那么** `useLiveProductionStore` SHALL 载入玩家站记录、同步 live flow map，并调用 `initAutoGroupDraft()`

#### Scenario: Map panel does not auto calculate
- **前提** Map 面板挂载、tab 切换或从其他 map layer 返回 binding-sector
- **当** `autoGroupResult` 已由 store 初始化
- **那么** Map 面板 SHALL NOT 自行调用分组算法或 `initAutoGroupDraft()`

### Requirement: Map Archive Target Lifecycle

系统 MUST 使用一个明确的 Map archive target 表达地图当前显示目标，并将该目标与 save panel layer 生命周期分离。该 target SHALL 支持 `default-map` 与具体 archive 两种状态；`selectedArchive=null` SHALL NOT 被用作“默认地图”的隐式语义。

#### Scenario: Entering map defaults to active binding archive
- **前提** 用户进入 Map
- **并且** 用户尚未显式选择 Map archive target
- **并且** 当前存在 active binding
- **并且** 该 binding 对应 guid 下存在可用 archive
- **当** 系统初始化地图显示目标
- **那么** Map archive target SHALL 指向该 active binding 对应 archive
- **并且** 普通地图模式下星区组染色和 hub 连线 SHALL 不显示，直到用户进入 binding 界面

#### Scenario: Default map is explicit target
- **前提** 用户在存档列表点击默认地图
- **当** 系统更新地图显示目标
- **那么** Map archive target SHALL 为 `default-map`
- **并且** 系统 SHALL 隐藏星区组染色
- **并且** 系统 SHALL 隐藏 hub 连线

#### Scenario: Archive target controls binding overlay
- **前提** 当前 active binding guid 为 A
- **当** 用户在存档列表选择 guid 为 A 的 archive 且未进入 binding 界面
- **那么** Map archive target SHALL 指向该 archive
- **并且** 系统 SHALL 隐藏星区组染色和 hub 连线
- **当** 用户进入 guid 为 A 的 binding 界面
- **那么** 系统 SHALL 显示星区组染色和 hub 连线
- **当** 用户在存档列表选择 guid 为 B 的 archive
- **那么** Map archive target SHALL 指向 B 的 archive
- **并且** 系统 SHALL 隐藏 A 的星区组染色和 hub 连线

#### Scenario: Guid-level archive entry resolves to latest valid archive
- **前提** 存档列表中玩家存档组 G 下存在至少一个有效 archive
- **当** 用户点击该玩家存档组标题
- **那么** Map archive target SHALL 指向 G 下最新有效 archive
- **并且** save panel SHALL 保持在 list layer
- **当** 用户点击该玩家存档组的组级 POI/详情入口
- **那么** Map archive target SHALL 指向 G 下最新有效 archive
- **并且** save panel SHALL 进入 category layer 并显示该 archive 的二级分类菜单

#### Scenario: Region fills stay below map structures
- **前提** 地图同时显示 faction owner 区域染色或 sector group 区域染色
- **当** 系统渲染 sector 六边形、高速路、星门、superhighway、空间站、POI 和路线
- **那么** faction owner 区域染色和 sector group 区域染色 SHALL 位于底层背景
- **并且** sector 六边形边框 SHALL 绘制在这些染色上方
- **并且** 高速路、星门、superhighway、空间站、POI 和路线 SHALL 绘制在这些染色上方，不得被染色遮蔽

#### Scenario: Sector group fill has priority over faction fill per sector
- **前提** 势力背景色开关打开
- **并且** 用户处于 binding 界面
- **并且** 某个 sector 属于星区组且存在 sector group color
- **当** 系统渲染该 sector 背景
- **那么** 该 sector SHALL 只显示 sector group color
- **并且** faction owner fill SHALL NOT 叠加、透出或覆盖该 sector group color

#### Scenario: Faction fill remains visible outside binding visuals
- **前提** 势力背景色开关打开
- **并且** 用户不处于 binding 界面
- **并且** `sectorGroupColorMap` 中仍存在某个 sector 的颜色数据
- **当** 系统渲染该 sector 背景
- **那么** 该 sector SHALL 显示 faction owner fill
- **并且** 系统 SHALL NOT 因存在 `sectorGroupColorMap[sectorId]` 而隐藏 faction owner fill 或退回默认地图背景

#### Scenario: Panel reopen restores last layer
- **前提** 用户在 save panel 的任意 layer 关闭面板
- **当** 用户再次打开 save panel 且未通过显式导航入口指定目标 layer
- **那么** 系统 SHALL 恢复关闭前的 `mapSavePanelLayer`、`mapBindingStage` 与 binding context
- **并且** 系统 SHALL NOT 因重新打开面板改变 Map archive target

#### Scenario: Explicit navigation overrides restored layer
- **前提** save panel 关闭前停留在某个 layer
- **当** 用户通过明确入口进入 binding-sector、binding-station、category 或 list
- **那么** 系统 SHALL 按该入口指定的 layer/stage 打开
- **并且** SHALL NOT 受关闭前 layer 限制

### Requirement: Map-only Virtual Station Editing

系统 MUST 在 Map 自动分组面板中提供 Virtual Station tab，用于创建、移动、删除无 `saveStationCode` 的 virtual station drafts。

#### Scenario: Blueprint empire selector is shared
- **前提** 用户打开 Virtual Station tab
- **当** 系统显示 blueprint 来源
- **那么** 系统 SHALL 显示 blueprint empire 选择器
- **并且** 该选择 SHALL 复用当前 binding 的 `blueprintEmpireId`
- **并且** 已创建的 virtual station SHALL NOT 随 blueprint empire 后续切换同步变化

#### Scenario: Blueprint station list supports dragging
- **前提** 已选择 blueprint empire
- **当** 系统显示 blueprint station 列表
- **那么** 系统 SHALL 显示该 blueprint empire 中可作为 station plan 来源的空间站
- **并且** 列表样式和拖拽交互 SHALL 参照原 Step 3 blueprint station 列表

#### Scenario: Blank station source exists
- **前提** 用户打开 Virtual Station tab
- **当** 系统显示 blueprint station 列表
- **那么** 系统 SHALL 额外显示一个空白空间站来源项
- **并且** 该来源项表示 `modules=[]` 的 virtual station 模板

#### Scenario: Blueprint drag copies station plan fields
- **前提** 用户从 blueprint station 列表拖拽某个 station 到有效地图 sector
- **当** 系统创建 virtual station draft
- **那么** 系统 SHALL 复制 source station 的 `name`
- **并且** SHALL 复制 `type`
- **并且** SHALL deep clone `modules`
- **并且** SHALL deep clone `settings`
- **并且** SHALL deep clone `lockedWares`
- **并且** SHALL deep clone `warePriority`
- **并且** SHALL NOT 复制 source station 的 `id`、`sectorId` 或持续同步引用
- **并且** 新 draft 的 `saveStationCode` SHALL 为 `undefined`

#### Scenario: Blank station drag creates empty industrial plan
- **前提** 用户拖拽空白空间站到有效地图 sector
- **当** 系统创建 virtual station draft
- **那么** draft SHALL 使用本地化“虚拟空间站”作为名称
- **并且** `type` SHALL 为 `industrial`
- **并且** `modules` SHALL 为空数组
- **并且** `settings` SHALL 使用 `DEFAULT_STATION_SETTINGS`
- **并且** `lockedWares` SHALL 为空数组
- **并且** `warePriority` SHALL 为空对象
- **并且** `saveStationCode` SHALL 为 `undefined`

#### Scenario: Drag to covered sector creates draft
- **前提** 用户拖拽 blueprint station 或空白空间站
- **并且** 目标 sector 属于某个当前 draft group 的 anchor 或 coverage
- **当** 用户释放拖拽
- **那么** 系统 SHALL 创建 virtual station draft
- **并且** SHALL 设置 `sectorMacro` 为目标 sector
- **并且** SHALL 设置 `position` 为地图落点
- **并且** SHALL 设置 `groupId` 为覆盖该 sector 的 group id

#### Scenario: Drag to uncovered sector is rejected
- **前提** 用户拖拽 blueprint station、空白空间站或已有 virtual station
- **并且** 目标 sector 不属于任何当前 draft group 的 anchor 或 coverage
- **当** 用户释放拖拽
- **那么** 系统 SHALL 拒绝该落点
- **并且** SHALL 保持原 draft 不变

#### Scenario: Active coverage is unique
- **前提** 用户拖拽 virtual station 到目标 sector
- **当** 系统查找目标 sector 的 group 归属
- **那么** 系统 SHALL 期望命中唯一 group
- **并且** 若代码发现命中多个 group，系统 SHALL 拒绝落点
- **并且** SHALL NOT 自动选择第一个、最近或任意 fallback group

#### Scenario: Existing virtual station can be dragged again
- **前提** virtual station draft 已存在
- **当** 用户从列表或地图 overlay 再次拖拽该 virtual station 到有效 sector
- **那么** 系统 SHALL 使用该 draft 自身 id 更新现有 draft
- **并且** SHALL 更新 `sectorMacro`
- **并且** SHALL 更新 `position`
- **并且** SHALL 更新 `groupId`
- **并且** SHALL NOT 创建重复 virtual station draft

#### Scenario: Virtual station list is grouped by current groups
- **前提** Virtual Station tab 渲染
- **当** 当前存在 virtual station drafts
- **那么** 系统 SHALL 按当前 `autoGroupResult.groups` 顺序分组显示
- **并且** 每组内 SHALL 按 sector 显示名再按创建顺序排序

#### Scenario: Virtual station row content
- **前提** 某个 virtual station draft 归属于 group G
- **当** 系统渲染该 item
- **那么** item SHALL 显示该 draft 的 `name` 属性
- **并且** SHALL 显示所属 sector 的本地化名称
- **并且** SHALL 显示坐标
- **并且** SHALL 显示 `×` 删除按钮
- **并且** SHALL NOT 显示所属 sector group 名

#### Scenario: Delete removes draft only
- **前提** 用户点击 virtual station item 的 `×`
- **当** 系统处理删除
- **那么** 系统 SHALL 从 store draft 中移除该 virtual station
- **并且** SHALL NOT 立即修改 binding

#### Scenario: Coverage edit moves station to ungrouped list
- **前提** 某个 virtual station draft 原本归属于 group G
- **当** 用户编辑 group/coverage 后，该 station 的 `sectorMacro` 不再属于任何 group
- **那么** 系统 SHALL 保留该 virtual station draft
- **并且** SHALL 将其显示在未分组区域
- **并且** SHALL NOT 立即删除该 draft

#### Scenario: Ungrouped station can recover
- **前提** 某个 virtual station draft 显示在未分组区域
- **当** 用户将其拖拽到有效 group sector，或编辑 coverage 使其 sector 重新被某个 group 覆盖
- **那么** 系统 SHALL 将该 virtual station 恢复显示到对应 group 列表

#### Scenario: Ungrouped warning text
- **前提** 未分组区域中存在 virtual station draft
- **当** 系统渲染该区域
- **那么** 系统 SHALL 在列表下方显示说明
- **并且** 说明 SHALL 表达这些 virtual stations 当前不属于任何 sector group，提交时会被移除

### Requirement: Virtual Station And Trade Station Map Overlays

系统 MUST 在 Map binding draft 编辑态从 shared draft 渲染 virtual station 和 virtual trade station overlay，并通过地图拖拽更新 draft。

#### Scenario: Virtual station overlay renders from draft
- **前提** 用户打开 Map binding 界面
- **并且** `liveStore.virtualStationDrafts` 中存在 virtual station draft
- **当** 地图渲染 binding draft overlay
- **那么** 系统 SHALL 从 virtual station draft 渲染虚拟生产空间站 overlay

#### Scenario: Virtual station draggable in map binding
- **前提** 用户打开 Map binding 界面
- **并且** 存在 virtual station overlay
- **当** 用户拖动该 overlay 到有效 group sector
- **那么** 系统 SHALL 更新该 virtual station draft 的 `sectorMacro`、`position` 和 `groupId`
- **并且** 该能力 SHALL NOT 要求 Virtual Station tab 当前激活

#### Scenario: Virtual trade station draggable in map binding
- **前提** 用户打开 Map binding 界面
- **并且** 某个 group 的 trade station 选择为 virtual
- **当** 用户在地图上拖动该 virtual trade station overlay
- **那么** 系统 SHALL 更新该 group draft 的 trade station position
- **并且** SHALL NOT 直接写 binding
- **并且** 该能力 SHALL NOT 要求 Trade Station tab 当前激活

#### Scenario: Virtual trade station drop outside hub sector is rejected
- **前提** 用户拖动 virtual trade station
- **当** 用户释放到非 hub sector
- **那么** 系统 SHALL 拒绝该落点
- **并且** SHALL 保持原 position 不变

#### Scenario: Trade Station tab shows coordinates for virtual selection
- **前提** 用户在 Trade Station tab 中将某个 group 的 trade station 选项切换为 virtual
- **当** 系统渲染该 group 的 trade station card
- **那么** 系统 SHALL 显示当前 virtual trade station 坐标

#### Scenario: Existing overlay visuals are reused
- **前提** 系统渲染 virtual station 或 virtual trade station overlay
- **当** 地图显示这些 overlay
- **那么** 系统 SHALL 沿用现有 overlay 图标、颜色和样式
- **并且** SHALL NOT 为本 change 新增额外视觉区分设计

### Requirement: Presenter Extraction from SectorOverviewPanel

系统 MUST 将自动分组面板的 UI 组装和交互编排收敛到 `useAutoSectorGroupPresenter.ts`，使其遵守 `store → presenter → vue` 三层架构。

#### Scenario: SectorOverviewPanel delegates to presenter
- **前提** `useAutoSectorGroupPresenter.ts` 已创建
- **当** `SectorOverviewPanel.vue` 渲染
- **那么** 组件 SHALL 通过 presenter 访问所有响应式状态和业务方法
- **并且** 新增 UI 逻辑 SHALL NOT 绕过 presenter 直接组装 store 数据
- **并且** 所有面向 UI 的组装逻辑 SHALL 留在 presenter 层

#### Scenario: Presenter returns reactive state and methods
- **前提** Vue 组件调用 `useAutoSectorGroupPresenter()`
- **当** presenter 初始化
- **那么** presenter SHALL 返回包含 `autoGroupResult`、`calculationMode`、`prefJumpRange`、`calculationBaseline`、`calcBaselinePillState` 等响应式状态
- **并且** SHALL 返回 `runAutoGroup`、`enterEditMode`、`cancelEdit`、`confirmAndWrite` 等方法
- **并且** 这些方法 SHALL 修改状态时不直接操作 DOM

#### Scenario: Presenter consumes shared draft
- **前提** `useLiveProductionStore` 已初始化 `autoGroupResult`
- **当** Live 或 Map 调用 `useAutoSectorGroupPresenter()`
- **那么** presenter SHALL 通过 `storeToRefs(liveStore)` 读写共享 draft
- **并且** SHALL NOT 为 Map 或 Live 创建独立的跨面板 draft

### Requirement: Step 2 Replacement in MapSavePanel

系统 MUST 在生产入口 `MapSavePanel.vue` 中用 map binding wrapper 替换旧 `MapBindingSectorGroup` 渲染路径；旧组件不得再作为 Map binding-sector 的生产入口。无生产入口的 `MapBindingPanel.vue` 应清理。

#### Scenario: MapSavePanel binding-sector uses map binding wrapper
- **前提** `MapSavePanel` 的 layer 为 `'binding-sector'`
- **当** 系统渲染该层
- **那么** 系统 SHALL 渲染 map binding wrapper
- **并且** SHALL forward `focus-sector`、`fit-sectors` 事件到父组件
- **并且** `MapSavePanel` SHALL 保持原有 binding context-change emission

#### Scenario: Confirmed map group button enters station binding
- **前提** map binding wrapper 处于完成态
- **当** 用户点击 group 上的进入 station binding 按钮
- **那么** 系统 SHALL emit `select-group` 并携带该 group id
- **并且** 父级 MapSavePanel SHALL 切换到 station binding 阶段

#### Scenario: Confirming auto group does not auto-enter station binding
- **前提** 用户在分配方案 tab 点击确定并完成写入
- **当** 写入成功
- **那么** 系统 SHALL 进入完成态
- **并且** SHALL NOT 自动切换到 station binding 阶段

#### Scenario: MapBindingSectorGroup is not used by production entry
- **前提** `MapSavePanel` 的 `binding-sector` 层已迁移到 map binding wrapper
- **并且** 无生产入口的 `MapBindingPanel.vue` 已清理
- **当** 系统构建
- **那么** `MapSavePanel.vue` SHALL NOT import 或 render `MapBindingSectorGroup.vue`

#### Scenario: Legacy MapBindingPanel is removed
- **前提** `MapWorkbenchView` 的生产入口只渲染 `MapSavePanel`
- **当** 系统构建
- **那么** `MapBindingPanel.vue` SHALL 不存在于代码库中

### Requirement: Localization

系统 MUST 为新增的 tab 标签提供中英文本地化。

#### Scenario: Chinese tab labels
- **前提** 当前语言为 zh-CN
- **当** map 上下文渲染 tab
- **那么** Hub tab SHALL 显示"枢纽"
- **并且** 分配方案 tab SHALL 显示"分配方案"
- **并且** Trade Station tab SHALL 显示"交易站"
- **并且** Virtual Station tab SHALL 显示"虚拟空间站"

#### Scenario: English tab labels
- **前提** 当前语言为 en
- **当** map 上下文渲染 tab
- **那么** Hub tab SHALL 显示"Hub"
- **并且** 分配方案 tab SHALL 显示"Allocation"
- **并且** Trade Station tab SHALL 显示"Trade Station"
- **并且** Virtual Station tab SHALL 显示"Virtual Station"
