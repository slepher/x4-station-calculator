# Auto Sector Group Virtual Station Specification

## Purpose

定义 Map binding 自动分组面板中的虚拟生产空间站草案编辑能力：系统 SHALL 在地图上下文新增 Virtual Station tab，并在 store 中维护从现有 binding 初始化的无 `saveStationCode` station plan drafts。该能力替代原 Step 3 中虚拟生产空间站的创建、移动和删除，但不迁入 save station 绑定、save station 导入、trade station 绑定或 station plan 详细编辑。

## ADDED Requirements

### Requirement: Map-only Virtual Station Tab

系统 MUST 在 Map 自动分组面板中提供仅地图界面可见的 Virtual Station tab。

#### Scenario: Map displays virtual station tab
- **前提** Map binding-sector 面板渲染 `AutoSectorGroupPanel layout="tabs"`
- **当** 系统显示 tab 列表
- **那么** 系统 SHALL 显示 Virtual Station tab
- **并且** 该 tab SHALL 与 Hub、Allocation、Trade Station tab 共享同一份 store draft

#### Scenario: Live does not display virtual station tab
- **前提** Live 计算模式渲染 `AutoSectorGroupPanel layout="columns"`
- **当** 系统显示三列布局
- **那么** 系统 SHALL NOT 显示 Virtual Station tab

#### Scenario: Virtual station tab remains available in map states
- **前提** 用户位于 Map binding 界面
- **当** Hub 处于 edit 或 result 模式，或用户切换 Allocation / Trade Station / Virtual Station tab
- **那么** 系统 SHALL 允许虚拟生产空间站 draft 继续被地图拖拽创建、移动或删除
- **并且** 虚拟生产空间站编辑 SHALL NOT 依赖 Virtual Station tab 当前激活

### Requirement: Virtual Station Draft Lifecycle

系统 MUST 在 store 中维护虚拟生产空间站 draft，并从现有 binding 初始化。

#### Scenario: Draft initializes when auto group result is generated
- **前提** 系统生成 `autoGroupResult.groups`
- **并且** 当前 binding 中存在无 `saveStationCode` 的 `BindingStationPlan`
- **当** 系统初始化自动分组共享 draft
- **那么** 系统 SHALL 从现有 binding 读取这些 virtual station plans
- **并且** SHALL 将其 clone 到 store 中的 virtual station draft
- **并且** SHALL NOT 因组件挂载或打开 Virtual Station tab 再次初始化覆盖用户编辑

#### Scenario: Recalculate preserves current virtual station draft
- **前提** 用户已编辑 virtual station draft
- **当** 用户点击 [计算] 或 [快速计算] 重新生成 auto group result
- **那么** 系统 SHALL 保留当前 virtual station draft 内容
- **并且** SHALL 基于最新 `autoGroupResult.groups` 重新计算每个 virtual station 的 group 归属

#### Scenario: Existing binding plans with save station code are excluded
- **前提** 当前 binding 中存在带 `saveStationCode` 的 `BindingStationPlan`
- **当** 系统初始化或应用 virtual station draft
- **那么** 系统 SHALL NOT 将这些 save station plans 纳入 Virtual Station tab
- **并且** SHALL NOT 通过 Virtual Station tab 的应用流程修改它们

### Requirement: Blueprint Source Section

系统 MUST 在 Virtual Station tab 中提供 blueprint station 来源列表，并支持空白空间站模板。

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
- **那么** draft SHALL 使用本地化“新空间站”作为名称
- **并且** `type` SHALL 为 `industrial`
- **并且** `modules` SHALL 为空数组
- **并且** `settings` SHALL 使用 `DEFAULT_STATION_SETTINGS`
- **并且** `lockedWares` SHALL 为空数组
- **并且** `warePriority` SHALL 为空对象
- **并且** `saveStationCode` SHALL 为 `undefined`

### Requirement: Virtual Station Placement And Group Ownership

系统 MUST 根据当前 auto group draft 的 anchor/coverage 决定 virtual station 的归属，并拒绝无 group 覆盖的落点。

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

### Requirement: Virtual Station Grouped List

系统 MUST 在 Virtual Station tab 中按 sector group 展示 virtual station drafts。

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

### Requirement: Ungrouped Virtual Stations

系统 MUST 保留因 group/coverage 变化导致暂时未分组的 virtual stations，并在提交时移除。

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

#### Scenario: Ungrouped stations are removed on apply
- **前提** 提交时仍存在未分组 virtual station drafts
- **当** 系统应用 virtual station drafts 到 binding
- **那么** 这些 drafts SHALL NOT 写回 binding
- **并且** 若 binding 中存在对应旧 virtual station plan，系统 SHALL 删除它

### Requirement: Apply Virtual Station Drafts

系统 MUST 在 auto group 提交后应用 virtual station drafts，且只影响无 `saveStationCode` 的 station plans。

#### Scenario: Apply order
- **前提** 用户在 Map binding 中提交 auto group 与 virtual station draft
- **当** 系统执行提交
- **那么** 系统 SHALL 先应用 auto groups
- **并且** SHALL 再应用 virtual station drafts

#### Scenario: Apply creates updates and deletes virtual station plans
- **前提** 当前 store 中存在 virtual station drafts
- **当** 系统应用到 binding
- **那么** draft 中存在且 binding 中不存在的 virtual station SHALL 被创建
- **并且** draft 中存在且 binding 中存在的 virtual station SHALL 被更新
- **并且** binding 中存在但 draft 中不存在的同 scope virtual station SHALL 被删除
- **并且** 所有写回的 station plans SHALL 保持 `saveStationCode=undefined`

#### Scenario: Apply does not modify save station plans
- **前提** binding 中存在带 `saveStationCode` 的 station plans
- **当** 系统应用 virtual station drafts
- **那么** 这些 station plans SHALL 保持不变

### Requirement: Virtual Trade Station Draft Dragging

系统 MUST 保留 virtual trade station 的地图拖动能力，但该能力属于 sector group trade station draft，不属于 Virtual Station tab。

#### Scenario: Virtual trade station draggable in map binding
- **前提** 用户打开 Map binding 界面
- **并且** 某个 group 的 trade station 选择为 virtual
- **当** 用户在地图上拖动该 virtual trade station overlay
- **那么** 系统 SHALL 更新该 group draft 的 trade station position
- **并且** SHALL NOT 直接写 binding
- **并且** 该能力 SHALL NOT 要求 Trade Station tab 当前激活

#### Scenario: Virtual trade station sector macro is fixed
- **前提** 某个 group 的 trade station 选择为 virtual
- **当** 用户拖动该 virtual trade station
- **那么** `TradeStationBinding.sectorMacro` SHALL 始终等于该 group 的 hub `sectorMacro`
- **并且** 拖动 SHALL NOT 修改 trade station 的 `sectorMacro`
- **并且** 拖动 SHALL NOT 修改 group 的 `sectorMacro`

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

## MODIFIED Requirements

### Requirement: Step 3 Station Binding

系统 SHALL 不再将 Step 3 作为虚拟生产空间站创建、移动和删除的唯一入口。虚拟生产空间站能力迁入 Map-only Virtual Station tab，并使用 store draft 编辑。

#### Scenario: Step 3 no longer owns virtual production station placement
- **前提** 用户需要创建、移动或删除无 `saveStationCode` 的 virtual station plan
- **当** 用户位于 Map binding 自动分组界面
- **那么** 系统 SHALL 通过 Virtual Station tab 和地图拖拽处理该能力
- **并且** 系统 SHALL NOT 要求用户进入旧 Step 3 页面才能修改 virtual station plans

#### Scenario: Step 3 non-virtual capabilities are out of this change
- **前提** 系统仍存在 save station 绑定、save station 导入或 station plan 详细编辑能力
- **当** 本 change 实施
- **那么** 这些能力 SHALL NOT 迁入 Virtual Station tab
- **并且** 它们可由其他模块或后续 change 处理
