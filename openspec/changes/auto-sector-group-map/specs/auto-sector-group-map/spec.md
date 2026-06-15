# Auto Sector Group Map Integration Specification

## Purpose

定义自动星区划分系统接入 Map 界面的行为规范：系统 SHALL 在 Map 的 Save Panel binding-sector 层中提供与 Live Production 一致的自动分组能力，支持 Hub/分配方案 tab 切换、双上下文样式适配、pill 聚焦地图、拖拽排序，以及由 `liveProductionStore` 驱动的自动分组触发检查。

## ADDED Requirements

### Requirement: Map Context Tab Switching

系统 MUST 在 map 上下文中用 [Hub] [分配方案] 双 tab 分离群组管理和分配选择界面。

#### Scenario: Hub tab displays group management
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **当** 用户位于 Hub tab
- **那么** 系统 SHALL 显示 `SectorConfirmBar(view='map')` 和 `SectorGroupList(view='map')`
- **并且** `SectorGroupList` SHALL 支持拖拽排序
- **并且** SHALL NOT 渲染 Col 1 的 `SaveUploadPanel`

#### Scenario: Allocation tab displays assignment cards
- **前提** map binding wrapper 渲染在 map 上下文中
- **并且** 自动分组尚未确认完成
- **并且** Hub tab 不处于编辑输入态
- **当** 用户切换到分配方案 tab
- **那么** 系统 SHALL 显示 `SectorAllocationList(view='map')` 和 `AllocationConfirmBar`
- **并且** SHALL 不重新计算 autoGroupResult

#### Scenario: Map edit mode blocks allocation tab
- **前提** Hub tab 处于编辑输入态
- **当** 系统渲染 map binding wrapper
- **那么** 分配方案 tab SHALL disabled
- **并且** 用户 SHALL NOT 能切换到 `SectorAllocationList`

#### Scenario: Map confirmed state hides tabs and allocation
- **前提** 自动分组已确认完成
- **当** 系统渲染 map binding wrapper
- **那么** 系统 SHALL NOT 显示 Hub / 分配方案 tab
- **并且** 系统 SHALL NOT 显示 `SectorAllocationList`
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
- **并且** Col 3 SHALL 显示 `SectorAllocationList(view='live') + AllocationConfirmBar` 或完成态内容

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

### Requirement: Live Production Auto Group Check Flag

系统 MUST 由 `liveProductionStore` 检查当前 binding 是否需要自动分组计算，并通过 flag 通知 presenter 执行。

#### Scenario: Refresh checks active binding coverage
- **前提** 页面刷新后 active binding 和 selected archive 已恢复
- **当** 当前 archive 中存在玩家资产 sector 未归入任意 group anchor 或 coverage
- **那么** `liveProductionStore` SHALL 设置自动分组检查 flag
- **并且** flag SHALL 包含当前 gameGuid 和 reason `refresh`

#### Scenario: Binding switch checks active binding coverage
- **前提** 用户手动切换 active binding
- **当** 新 binding 对应 archive 中存在玩家资产 sector 未归入任意 group anchor 或 coverage
- **那么** `liveProductionStore` SHALL 设置自动分组检查 flag
- **并且** flag SHALL 包含 reason `binding-switch`

#### Scenario: Archive timing switch checks active binding coverage
- **前提** 上传新存档或 archive timing 变化导致 selected archive 切换
- **当** 当前 binding 的 coverage 不再覆盖所有玩家资产 sector
- **那么** `liveProductionStore` SHALL 设置自动分组检查 flag
- **并且** flag SHALL 包含 reason `archive-timing-switch`

#### Scenario: Presenter consumes and clears auto group check flag
- **前提** 自动分组检查 flag 表示当前 active binding 需要计算
- **当** presenter 执行 auto group 计算完成
- **那么** presenter SHALL 清除该 flag

### Requirement: Presenter Extraction from SectorOverviewPanel

系统 MUST 将 `SectorOverviewPanel.vue` 的核心逻辑抽取到 `useAutoSectorGroupPresenter.ts`，使其遵守 `store → presenter → vue` 三层架构。

#### Scenario: SectorOverviewPanel delegates to presenter
- **前提** `useAutoSectorGroupPresenter.ts` 已创建
- **当** `SectorOverviewPanel.vue` 渲染
- **那么** 组件 SHALL 通过 presenter 访问所有响应式状态和业务方法
- **并且** SHALL NOT 直接 import `useSaveBindingStore` 或 `useLiveProductionStore`
- **并且** 所有面向 UI 的组装逻辑 SHALL 留在 presenter 层

#### Scenario: Presenter returns reactive state and methods
- **前提** Vue 组件调用 `useAutoSectorGroupPresenter()`
- **当** presenter 初始化
- **那么** presenter SHALL 返回包含 `autoGroupResult`、`calculationMode`、`prefJumpRange`、`editSnapshot` 等响应式 Ref
- **并且** SHALL 返回 `runAutoGroup`、`enterEditMode`、`cancelEdit`、`confirmAndWrite` 等方法
- **并且** 这些方法 SHALL 修改状态时不直接操作 DOM

#### Scenario: Presenter owns auto group execution from store flag
- **前提** `liveProductionStore` 设置自动分组检查 flag
- **当** presenter 观察到该 flag 与当前 binding 匹配
- **那么** presenter SHALL 执行自动分组逻辑
- **并且** 执行完成后 SHALL 调用 store API 清除 flag

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

#### Scenario: English tab labels
- **前提** 当前语言为 en
- **当** map 上下文渲染 tab
- **那么** Hub tab SHALL 显示"Hub"
- **并且** 分配方案 tab SHALL 显示"Allocation"
