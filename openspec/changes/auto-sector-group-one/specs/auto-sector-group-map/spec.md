# Auto Sector Group Map Integration Specification

## Purpose

定义自动星区划分系统接入 Map 界面的行为规范：系统 SHALL 在 Map 的 Save Panel binding-sector 层中提供与 Live Production 一致的自动分组能力，支持 Hub / 分配方案 / Trade Station 视图切换、双上下文样式适配、pill 聚焦地图、拖拽排序，并复用 `useLiveProductionStore` 中的唯一共享 draft。

## ADDED Requirements

### Requirement: Map Context View Switching

系统 MUST 在 map 上下文中用 Hub / 分配方案 / Trade Station 视图分离群组管理、星区分配和交易站选择界面，并且三个视图 MUST 读写同一份 `autoGroupResult`。

#### Scenario: Hub tab displays group management
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **当** 用户位于 Hub tab
- **那么** 系统 SHALL 显示 `SectorConfirmBar(view='map')` 和 `SectorGroupList(view='map')`
- **并且** `SectorGroupList` SHALL 支持拖拽排序
- **并且** SHALL NOT 渲染 Col 1 的 `SaveUploadPanel`

#### Scenario: Allocation view displays assignment cards
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **并且** Hub tab 不处于编辑输入态
- **当** 用户切换到分配方案 tab
- **那么** 系统 SHALL 显示 `SectorAllocationList(view='map')` 和 `AllocationConfirmBar`
- **并且** SHALL 不重新计算 autoGroupResult

#### Scenario: Trade Station view displays station cards
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **并且** Hub tab 不处于编辑输入态
- **当** 用户切换到 Trade Station 视图
- **那么** 系统 SHALL 显示 `SectorTradeStationList(view='map')` 和 `AllocationConfirmBar`
- **并且** SHALL 不重新计算 autoGroupResult

#### Scenario: Map edit mode blocks allocation and trade station views
- **前提** Hub tab 处于编辑输入态
- **当** 系统渲染 map binding wrapper
- **那么** 分配方案和 Trade Station 视图 SHALL disabled
- **并且** 用户 SHALL NOT 能切换到 `SectorAllocationList` 或 `SectorTradeStationList`

#### Scenario: Map confirmed state hides draft tabs
- **前提** 自动分组已确认完成
- **当** 系统渲染 map binding wrapper
- **那么** 系统 SHALL NOT 显示 Hub / 分配方案 / Trade Station tab
- **并且** 系统 SHALL NOT 显示 `SectorAllocationList` 或 `SectorTradeStationList`
- **并且** 系统 SHALL 在每个 group 上显示进入 station binding 的按钮

### Requirement: Context-Aware Component Styling

系统 MUST 根据 `view` prop 适配子组件的布局和交互。

#### Scenario: Map context uses compact layout
- **前提** `SectorGroupList` 的 `view` prop 为 `'map'`
- **当** 系统渲染 group 列表
- **那么** 系统 SHALL 使用适配 360px 侧边栏宽度的紧凑样式
- **并且** pill SHALL 不溢出容器宽度

#### Scenario: Live context uses three-column layout
- **前提** `SectorOverviewPanel` 渲染 live overview
- **当** 系统渲染三列布局
- **那么** Col 1 SHALL 显示 SaveUploadPanel + SaveList
- **并且** Col 2 SHALL 显示 `SectorConfirmBar(view='live') + SectorGroupList(view='live')`
- **并且** Col 3 SHALL 显示 `SectorAllocationList(view='live') + AllocationConfirmBar`、`SectorTradeStationList(view='live') + AllocationConfirmBar` 或完成态内容

#### Scenario: SectorConfirmBar keeps calculation mode separate from view
- **前提** `SectorConfirmBar` 渲染
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

系统 MUST 在 map 上下文中使用 `MapBindSectorMenu`（teleported popup + 定位地图按钮），在 live 上下文中使用 `SectorHubAddMenu`（fixed overlay popup）。

#### Scenario: Map context uses MapBindSectorMenu
- **前提** Hub tab 处于编辑态
- **并且** `view` 为 `'map'`
- **当** 用户点击 [添加枢纽]
- **那么** 系统 SHALL 以 teleported popup 方式打开 `MapBindSectorMenu`
- **并且** popup SHALL 锚定到触发按钮元素
- **并且** SHALL 显示"定位地图"按钮
- **并且** 选择 sector 后 SHALL 创建 hub draft 并关闭 popup

#### Scenario: Live context uses SectorHubAddMenu
- **前提** Live 上下文中的 Col 2 处于编辑态
- **并且** `view` 为 `'live'`
- **当** 用户点击 [添加枢纽]
- **那么** 系统 SHALL 以 fixed overlay modal 方式打开 `SectorHubAddMenu`
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
- **那么** presenter SHALL 返回包含 `autoGroupResult`、`calculationMode`、`prefJumpRange`、`editSnapshot` 等响应式 Ref
- **并且** SHALL 返回 `runAutoGroup`、`enterEditMode`、`cancelEdit`、`confirmAndWrite` 等方法
- **并且** 这些方法 SHALL 修改状态时不直接操作 DOM

#### Scenario: Presenter consumes shared draft
- **前提** `useLiveProductionStore` 已初始化 `autoGroupResult`
- **当** Live 或 Map 调用 `useAutoSectorGroupPresenter()`
- **那么** presenter SHALL 通过 `storeToRefs(liveStore)` 读写共享 draft
- **并且** SHALL NOT 为 Map 或 Live 创建独立的跨面板 draft

### Requirement: Step 2 Replacement in MapSavePanel

系统 MUST 在生产入口 `MapSavePanel.vue` 中用 map binding wrapper 替换 `MapBindingSectorGroup`，并清理无生产入口的 `MapBindingPanel.vue`。

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

#### Scenario: MapBindingSectorGroup is removed
- **前提** `MapSavePanel` 的 `binding-sector` 层已迁移到 map binding wrapper
- **并且** 无生产入口的 `MapBindingPanel.vue` 已清理
- **当** 系统构建
- **那么** `MapBindingSectorGroup.vue` SHALL 不存在于代码库中

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

#### Scenario: English tab labels
- **前提** 当前语言为 en
- **当** map 上下文渲染 tab
- **那么** Hub tab SHALL 显示"Hub"
- **并且** 分配方案 tab SHALL 显示"Allocation"
- **并且** Trade Station tab SHALL 显示"Trade Station"
