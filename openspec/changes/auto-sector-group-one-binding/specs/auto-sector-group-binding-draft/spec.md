# Binding Preview Draft Specification

## Purpose

定义 binding 模式下 group 方案的共享草案状态、地图渲染草案数据的规则、以及存档时间比对的重算策略。

## ADDED Requirements

### Requirement: Shared Group Editing State

系统 MUST 在 `useLiveProductionStore` 中维护 binder 共享编辑状态，使 live 面板和 map 面板读写同一份数据。共享编辑状态 MUST 是全局唯一 draft，表示当前 active binding/archive 的草案；系统 SHALL NOT 同时维护多个 binding 的并行草案。

#### Scenario: State moved to liveStore

- **前提** 系统启动
- **当** `useLiveProductionStore` 初始化
- **那么** SHALL 包含以下状态和方法：
  - `autoGroupResult: ShallowRef<AutoGroupResult | null>`
  - `calculationMode: Ref<'result' | 'edit'>`
  - `prefJumpRange: Ref<number>`
  - `bridgeSearchJumpRange: Ref<number>`
  - `prefThreshold: Ref<number>`
  - `calculationBaseline: Ref<CalculationBaseline | null>`
  - `needsAutoGroupRecalc: Computed<boolean>`
  - `virtualStationDrafts: Ref<BindingStationPlan[]>`
  - `virtualStationDraftInitializedKey: Ref<string | null>`
  - `initAutoGroupDraft()` — 双路径数据生成
  - `buildAssignmentsFromBinding()` — 从 binding 构建 assignments

#### Scenario: Presenter reads from liveStore

- **前提** `useAutoSectorGroupPresenter` 被调用
- **当** presenter 需要读写共享状态
- **那么** SHALL 通过 `storeToRefs(liveStore)` 获取
- **并且** `handleColorChange` SHALL NOT 调用 `saveBindingStore.updateGroup()`

#### Scenario: Two panels share state

- **前提** live 面板和 map 面板同时激活
- **当** 任一面板修改 `autoGroupResult`
- **那么** 另一面板 SHALL 立即看到更新

#### Scenario: Virtual station draft belongs to shared state

- **前提** Map binding 面板创建、移动或删除 virtual station draft
- **当** Live 或 Map 读取当前 active binding/archive 的 shared draft
- **那么** 系统 SHALL 通过同一 `useLiveProductionStore.virtualStationDrafts` 暴露这些修改
- **并且** SHALL NOT 为 Map 单独维护另一份 virtual station draft

#### Scenario: Single draft resets on context switch

- **前提** 当前唯一 draft 已包含某个 binding/archive 的未提交编辑
- **当** active binding 或 selected archive 切换
- **那么** 系统 SHALL 使用新上下文重新初始化这份唯一 draft
- **并且** SHALL NOT 在新上下文继续显示上一上下文的未提交 draft
- **并且** SHALL NOT 为旧上下文缓存另一份并行 draft

### Requirement: Store Initialization Data Generation

系统 MUST 在 Store 初始化（或 activeBinding/archive 切换）时完成 `autoGroupResult` 的数据生成，根据变化 flag 分两条路径。`initAutoGroupDraft()` MUST 对同一 guid+archiveTime 上下文幂等：内部 SHALL 维护最近一次执行时的 context key（`gameGuid:archiveTime`），调用时若当前 key 与上次相同则直接返回，数据生成 SHALL 只在 key 变化时执行。

#### Scenario: Grouping algorithm runs when change flag is set

- **前提** `needsAutoGroupRecalc` 为 true
- **当** `initAutoGroupDraft()` 被调用
- **那么** 系统 SHALL 执行分组算法（`groupCleanSlate` 或 `groupIncremental`）生成 `autoGroupResult`

#### Scenario: Assignments built from binding when no change

- **前提** `needsAutoGroupRecalc` 为 false
- **当** `initAutoGroupDraft()` 被调用
- **那么** 系统 SHALL 调用 `buildAssignmentsFromBinding()` 从已有 binding groups 构建 assignments
- **并且** SHALL NOT 执行分组算法
- **并且** 不重新决定分组结构

#### Scenario: Draft is initialized once per binding-archive context

- **前提** activeBinding 为 G，selectedArchive 为 T，context key 为 `G:T`
- **当** `initAutoGroupDraft()` 被首次调用
- **那么** 系统 SHALL 执行数据生成并写入 `autoGroupResult`
- **当** `initAutoGroupDraft()` 在同一 `G:T` 上下文下再次被调用
- **那么** 系统 SHALL 直接返回，SHALL NOT 重新生成或覆盖 `autoGroupResult`

#### Scenario: Draft reinitializes on context change

- **前提** 当前 context key 为 `G:T`
- **并且** 用户切换 binding（key 变为 `G2:T`）或上传新存档（key 变为 `G:T2`）
- **当** `initAutoGroupDraft()` 被调用
- **那么** 系统 SHALL 重新执行数据生成并写入新的 `autoGroupResult`

#### Scenario: Navigating between panels preserves unsaved edits

- **前提** 用户在 Live 面板编辑了 draft（修改 assignment、coverage 等）
- **并且** context key 未变化（同一 binding + 同一 archive）
- **当** Map 面板挂载并间接触发 `initAutoGroupDraft()`
- **那么** 系统 SHALL 直接返回
- **并且** `autoGroupResult` SHALL 保留用户编辑内容

#### Scenario: Virtual station draft initializes after groups are generated

- **前提** 系统生成 `autoGroupResult.groups`
- **并且** 当前 binding 中存在无 `saveStationCode` 的 `BindingStationPlan`
- **当** 当前 binding/archive context 尚未初始化 virtual station draft
- **那么** 系统 SHALL 从 binding 读取这些 station plans
- **并且** SHALL clone 到 `virtualStationDrafts`
- **并且** SHALL 记录当前 virtual station draft 初始化 key

#### Scenario: Same context does not overwrite virtual station draft

- **前提** 用户已在当前 binding/archive context 编辑 `virtualStationDrafts`
- **当** 组件挂载、打开 Virtual Station tab、或 Live/Map 面板切换再次触发共享 draft 读取
- **那么** 系统 SHALL 保留当前 `virtualStationDrafts`
- **并且** SHALL NOT 从 binding 重新初始化并覆盖用户编辑

#### Scenario: Recalculate preserves virtual station draft

- **前提** 用户已编辑 `virtualStationDrafts`
- **当** 用户点击 [计算] 或 [快速计算] 重新生成 `autoGroupResult.groups`
- **那么** 系统 SHALL 保留当前 virtual station draft 内容
- **并且** SHALL 基于最新 groups 重新计算每个 draft 的 group 归属
- **并且** 无当前 group 归属的 draft SHALL 保留为未分组状态

#### Scenario: Save station plans are excluded from virtual station draft

- **前提** 当前 binding 中同时存在带 `saveStationCode` 和不带 `saveStationCode` 的 `BindingStationPlan`
- **当** 系统初始化 virtual station draft
- **那么** 系统 SHALL 只读取不带 `saveStationCode` 的 station plans
- **并且** SHALL NOT 将带 `saveStationCode` 的 save station plans 纳入 Virtual Station tab 草案

#### Scenario: Applied time recorded on confirm

- **前提** 用户确认 auto group 结果
- **当** `handleConfirm` 执行完成
- **那么** `binding.appliedAutoGroupArchiveTime` SHALL 设置为当前存档 time

#### Scenario: Applied time survives reload

- **前提** `SaveBindingPlan` 已保存 `appliedAutoGroupArchiveTime`
- **当** 系统从持久化状态恢复 binding
- **那么** `normalizeState()` SHALL 保留 `appliedAutoGroupArchiveTime`

### Requirement: Map rendering from shared draft

系统 MUST 在 binding 模式（step 2 / step 3）下从 `liveStore.autoGroupResult` 渲染地图草案。

#### Scenario: Binding mode map renders from draft

- **前提** `mapBindingStage` 为 `'select-sector'` 或 `'select-station'`
- **并且** `liveStore.autoGroupResult` 非 null
- **当** `MapWorkbenchView` 计算 `sectorGroupColorMap`
- **那么** SHALL 从 `autoGroupResult.groups` 计算
- **并且** `handleColorChange` SHALL NOT 调用 `saveBindingStore.updateGroup()`

#### Scenario: Non-binding mode renders from persisted state

- **前提** 不在 binding 模式
- **当** `MapWorkbenchView` 计算 `sectorGroupColorMap`
- **那么** SHALL 从 `saveBindingStore.activeBinding.groups` 计算

### Requirement: Panels do not trigger automatic calculation

Live 和 Map 面板 SHALL NOT 因组件挂载、面板切换或模式切换触发分组算法。初始数据由 Store 在初始化/上下文切换时生成；计算模式内用户显式点击「计算」时，系统 MAY 运行分组算法更新共享 draft。

#### Scenario: Panels do not trigger automatic calculation

- **前提** 系统处于任何状态
- **当** 组件挂载、面板切换、模式切换
- **那么** Live 和 Map 面板 SHALL NOT 调用分组算法或 `initAutoGroupDraft()`

#### Scenario: Detail button shows change hint via red dot

- **前提** `needsAutoGroupRecalc` 为 true
- **当** 详情按钮渲染
- **那么** SHALL 显示红点 + tooltip 提示用户重新计算

#### Scenario: Detail button disabled without result

- **前提** `autoGroupResult` 为 null
- **当** 详情按钮渲染
- **那么** SHALL 置灰禁用

#### Scenario: Sidebar detail entry shows change hint via red dot

- **前提** `needsAutoGroupRecalc` 为 true
- **当** Live sidebar 星区编辑详情入口渲染
- **那么** SHALL 显示红点 + tooltip 提示用户重新计算

#### Scenario: Sidebar detail entry disabled without result

- **前提** `autoGroupResult` 为 null
- **当** Live sidebar 星区编辑详情入口渲染
- **那么** SHALL 置灰禁用

### Requirement: Live panel dual mode

系统 SHALL 在 live 面板提供展示模式和计算模式，通过 `liveMode` 切换。展示模式与详情模式切换本身不触发计算，只读取 store 中已有数据；计算模式内用户显式点击「计算」时，系统 MAY 更新共享 draft。

#### Scenario: Display mode layout

- **前提** `liveMode` 为 `'display'`
- **当** SectorOverviewPanel 渲染
- **那么** SHALL 显示 `[存档 3fr] | [星区 4fr] | [资源 5fr]` 布局
- **并且** 星区列表列顶部 SHALL 展示桥接跳数、覆盖跳数、Hub 阈值（纯数值只读）
- **并且** SHALL 显示「详情」按钮和「地图」按钮

#### Scenario: Calculate mode layout

- **前提** `liveMode` 为 `'calculate'`
- **当** SectorOverviewPanel 渲染
- **那么** SHALL 显示 `[星区 5fr] | [分配 4fr] | [交易站 3fr]` 布局，三列复用 AutoSectorGroupPanel 现有结构
- **并且** AutoSectorGroupPanel 顶部 SHALL 显示共用的 `AutoSectorBar`
- **并且** Allocation 区域 SHALL 显示 `SectorAllocationList`
- **并且** Trade Station 区域 SHALL 显示 `SectorTradeStationList`

#### Scenario: Detail button switches to calculate mode

- **前提** 展示模式
- **当** 点击「详情」
- **那么** SHALL 仅设置 `liveMode = 'calculate'`（不触发计算，store 数据已由 `initAutoGroupDraft()` 生成）

#### Scenario: Sidebar detail entry switches to calculate mode

- **前提** Live 处于展示模式
- **当** 用户点击 sidebar 分隔线区域的星区编辑详情入口
- **那么** SHALL 设置 `activeBindingWorkbench` 为星区编辑详情专用值
- **并且** SHALL 通过 active view storage 持久化该 sidebar 菜单选择
- **并且** SHALL 显示计算/详情视图
- **并且** SHALL NOT 调用分组算法
- **并且** SHALL NOT 调用 `initAutoGroupDraft()`

#### Scenario: Sidebar detail entry persists across reload

- **前提** 用户已点击 sidebar 星区编辑详情入口
- **当** 页面刷新并从 `x4_station_active_view` 恢复 active view state
- **那么** 系统 SHALL 恢复到星区编辑详情 workbench
- **并且** SHALL 显示 `AutoSectorGroupPanel layout="columns"`
- **并且** SHALL NOT 因恢复菜单选择运行分组算法或 `initAutoGroupDraft()`

#### Scenario: Sidebar detail entry is protected from station selection fallback

- **前提** `activeBindingWorkbench` 为星区编辑详情专用值
- **当** `activeBindingStation` 或 active transit sector 发生变化
- **那么** 系统 SHALL NOT 将 `activeBindingWorkbench` 自动改写为 `station` 或 `overview`

#### Scenario: Sidebar detail icon follows fixed menu style

- **前提** Live sidebar 渲染星区编辑详情入口
- **当** 系统显示入口图标
- **那么** SHALL 使用与蓝图配方和研究入口一致的单色 SVG 图标风格
- **并且** 图标 SHALL 表达星区节点、连接和编辑语义

#### Scenario: Submit disables confirm button

- **前提** 计算模式
- **当** 点击「提交」
- **那么** SHALL 调用 `handleConfirm` 后将确认按钮置灰
- **并且** 不跳转到展示模式

### Requirement: Live Calculation Trade Station View

系统 SHALL 在 Live 计算模式中展示 trade station 选择，并与 allocation 使用同一全局确认 gate。

#### Scenario: Live trade station column displays station cards

- **前提** 用户在 Live Production Overview 计算模式
- **并且** 自动分组结果已生成
- **当** Trade Station 区域渲染
- **那么** 系统 SHALL 显示所有成为 hub 的 group card（`SectorTradeStationList`）
- **并且** 每个 card SHALL 展示候选站 radio、score、containerCap 和虚拟交易站选项

#### Scenario: Allocation and trade station share confirm gate

- **前提** allocation 已解决
- **并且** 存在未解决的 trade station
- **当** AutoSectorGroupPanel 渲染顶部共用 `AutoSectorBar`
- **那么** 共用确认按钮 SHALL disabled
- **并且** SHALL NOT 写入 binding

#### Scenario: Shared reset restores full baseline

- **前提** 用户在共用 `AutoSectorBar` 点击 [重置]
- **当** 系统执行重置
- **那么** SHALL 从 `calculationBaseline` 克隆恢复整份 shared draft
- **并且** SHALL 同时恢复 group、assignment、bridge decision、trade station、hub color、retain 字段和 virtual station drafts 到最近计算基线
- **并且** SHALL NOT 切换 active binding/archive 或重新运行分组算法

#### Scenario: Shared draft preserves hub color assigned by map color rules

- **前提** 用户在 shared draft 中通过独立成组、bridge 或其他交互新增路径产生 hub/group card
- **并且** one-map Hub color 规则已经为该 hub 写入 `group.color`
- **当** Live 或 Map binding 面板读取同一 shared draft
- **那么** 系统 SHALL 保留该 `group.color`
- **并且** SHALL 在确认前不直接写入持久化 binding
- **并且** 确认成功时 SHALL 将该颜色作为 group 数据的一部分写入 binding

#### Scenario: Trade station card list follows groups

- **前提** Trade Station 区域中存在 N 个 group card
- **当** 用户新增或删除 hub group
- **那么** `SectorTradeStationList` SHALL 同步增加或移除对应 card

### Requirement: Shared Auto Sector Bar And Retain Controls

系统 SHALL 在 Live/Map 共享面板顶部用统一 `AutoSectorBar` 承载返回、地图、计算、重置、提交、参数输入和全局确认 gate；Allocation 和 Trade Station 只渲染各自列表，不再拥有独立确认栏。系统 SHALL 另外提供 trade station retain 控件。

#### Scenario: Shared bar blocks unresolved assignment

- **前提** Allocation 区域存在未解决的 sector assignment
- **当** 系统渲染共用 `AutoSectorBar`
- **那么** 提交操作 SHALL 被全局 gate 拦截
- **并且** 系统 SHALL NOT 写入 binding

#### Scenario: Shared bar allows all resolved

- **前提** trade station 均已解决
- **并且** uncertain assignment 已解决或用户已通过二次确认
- **当** 用户通过共用 `AutoSectorBar` 点击提交
- **那么** 系统 SHALL 执行 `doConfirm()`
- **并且** SHALL 将当前 shared draft 写入 binding

#### Scenario: Shared bar reports trade station gate

- **前提** 存在未解决的 trade station
- **当** 用户通过共用 `AutoSectorBar` 点击提交
- **那么** 系统 SHALL 拦截提交并保持在计算模式
- **并且** SHALL NOT 打开 uncertain assignment 二次确认 popup

#### Scenario: Trade station retain controls

- **前提** 共享自动分组面板渲染
- **当** 用户查看参数栏或 edit 模式 group card
- **那么** 参数栏 SHALL 显示 `tradeStationRetainEnabled` 主开关
- **并且** edit 模式 group card SHALL 显示对应 group 的 `tradeStationRetainEnabled` 开关

#### Scenario: Retain masters are derived and mixed defaults off

- **前提** 共享自动分组面板渲染
- **当** 用户查看桥接保留、覆盖保留或交易站保留主开关
- **那么** 主开关 SHALL 由当前各 group 的对应 retain 字段聚合得出
- **并且** 当部分 group 为 true、部分 group 为 false 时，主开关 SHALL 显示 indeterminate
- **并且** 当当前 retain 状态为 mixed 且用户新增 hub 时，新 hub SHALL 默认取 false

### Requirement: Binding Button Semantics

系统 SHALL 明确定义 Live/Map 共享自动分组面板中的按钮语义，避免按钮隐式触发计算、提交或恢复。

#### Scenario: Display detail button

- **前提** Live 处于展示模式
- **当** 用户点击「详情」
- **那么** 系统 SHALL 只设置 `liveMode = 'calculate'`
- **并且** SHALL NOT 调用分组算法
- **并且** SHALL NOT 调用 `initAutoGroupDraft()`

#### Scenario: Sidebar detail entry

- **前提** Live 处于展示模式
- **当** 用户点击 sidebar 星区编辑详情入口
- **那么** 系统 SHALL 设置并持久化星区编辑详情 workbench 选择
- **并且** SHALL NOT 调用分组算法
- **并且** SHALL NOT 调用 `initAutoGroupDraft()`

#### Scenario: Back button

- **前提** Live 处于计算模式
- **当** 用户点击「返回」
- **那么** 系统 SHALL 回到展示模式
- **并且** SHALL NOT 提交
- **并且** SHALL NOT 重置 shared draft
- **并且** SHALL NOT 运行分组算法

#### Scenario: Calculate buttons

- **前提** 用户位于计算模式
- **当** 用户点击「计算」或「快速计算」
- **那么** 系统 SHALL 使用当前编辑输入运行核心算法
- **并且** SHALL 更新 `autoGroupResult`
- **并且** SHALL 更新 `calculationBaseline`
- **并且** SHALL 根据未解决项切换到第一个待处理 tab

#### Scenario: Reset button

- **前提** `calculationBaseline` 非 null
- **当** 用户点击「重置」
- **那么** 系统 SHALL 从 `calculationBaseline` clone 恢复 `autoGroupResult`
- **并且** SHALL 从 `calculationBaseline` clone 恢复 `virtualStationDrafts`
- **并且** SHALL NOT 切换 active binding
- **并且** SHALL NOT 切换 selected archive

#### Scenario: Edit and exit buttons

- **前提** 自动分组结果已显示
- **当** 用户点击「编辑」
- **那么** 系统 SHALL 设置 `calculationMode = 'edit'`
- **并且** SHALL NOT 创建用于取消恢复的 edit snapshot
- **当** 用户点击「退出」
- **那么** 系统 SHALL 设置 `calculationMode = 'result'`
- **并且** SHALL NOT 恢复进入编辑前的 draft

#### Scenario: Confirm gates

- **前提** 用户点击「提交」
- **当** 当前处于 edit 模式、无 result 或 trade station 未解决
- **那么** `handleConfirm()` SHALL 返回 false
- **并且** SHALL NOT 写入 binding
- **当** 存在 uncertain assignment 且确认 popup 未打开
- **那么** 系统 SHALL 打开二次确认 popup
- **并且** `handleConfirm()` SHALL 返回 false
- **当** 所有 gate 通过
- **那么** 系统 SHALL 写入 binding
- **并且** `handleConfirm()` SHALL 返回 true

### Requirement: Virtual Station Draft Apply

系统 MUST 在 auto group 提交成功路径中同步 virtual station drafts，且该同步只影响无 `saveStationCode` 的 station plans。

#### Scenario: Apply order

- **前提** 用户提交 auto group shared draft
- **并且** 当前存在 virtual station drafts
- **当** 系统执行确认写入
- **那么** 系统 SHALL 先应用 auto groups、coverage、connections、colors 和 trade station
- **并且** SHALL 再按最终 groups 重算 virtual station draft 归属
- **并且** SHALL 最后同步 virtual station drafts 到 binding station plans

#### Scenario: Apply creates updates and deletes virtual station plans

- **前提** 当前 store 中存在 virtual station drafts
- **当** 系统同步 virtual station drafts 到 binding
- **那么** draft 中存在且 binding 中不存在的 virtual station SHALL 被创建
- **并且** draft 中存在且 binding 中存在的 virtual station SHALL 被更新
- **并且** binding 中存在但 draft 中不存在的同 scope virtual station SHALL 被删除
- **并且** 仍未分组的 drafts SHALL NOT 写回 binding
- **并且** 若 binding 中存在对应旧 virtual station plan，系统 SHALL 删除它
- **并且** 所有写回的 station plans SHALL 保持 `saveStationCode=undefined`

#### Scenario: Apply does not modify save station plans

- **前提** binding 中存在带 `saveStationCode` 的 station plans
- **当** 系统同步 virtual station drafts
- **那么** 这些 save station plans SHALL 保持不变

### Requirement: Snapshot And Baseline Timing

系统 SHALL 区分重置快照 `calculationBaseline` 和 saved binding UI diff 基线 `calcBaselinePillState`。

#### Scenario: Calculation baseline timing

- **前提** 系统通过初始化或显式计算得到新的 `AutoGroupResult`
- **当** 系统调用 live store `setAutoGroupResult(result)`
- **那么** SHALL clone `result` 写入 `calculationBaseline`
- **并且** [重置] SHALL 使用该 baseline 恢复 shared draft

#### Scenario: Pin and unpin do not capture baseline

- **前提** 当前 shared draft 已存在 `calculationBaseline`
- **当** 用户对 hub 执行 pin 或 unpin
- **那么** 系统 SHALL 修改当前 shared draft
- **并且** SHALL NOT 更新 `calculationBaseline`
- **当** 用户随后点击「重置」
- **那么** 系统 SHALL 恢复到 pin / unpin 之前最近一次 baseline 对应的 shared draft

#### Scenario: Pill baseline timing

- **前提** 当前 active binding 存在已保存 `SaveBindingPlan.groups`
- **当** 系统初始化 shared draft 或刷新 UI diff baseline
- **那么** 系统 SHALL 从已保存 binding groups 记录 coverage 和 connected group ids
- **并且** SHALL 使用 hub `sectorMacro` 作为 `calcBaselinePillState` key
- **并且** 显式「计算」、快速计算、重置、pin / unpin SHALL NOT 用当前计算结果覆盖该 baseline
- **当** 用户确认成功
- **那么** 系统 SHALL 先写入 binding
- **并且** SHALL 从保存后的 binding groups 刷新 `calcBaselinePillState`

#### Scenario: Group new highlight uses saved binding baseline

- **前提** 某 runtime group 的 `id` 与 `sectorMacro` 不一致
- **并且** 已保存 binding groups 中存在同一 `sectorMacro`
- **当** 系统渲染 group card
- **那么** 该 group SHALL NOT 显示新增 group 高亮
- **并且** coverage/connected pill diff SHALL 以 saved binding 中同一 `sectorMacro` 的 group 作为 baseline

#### Scenario: Post-confirm saved UI state

- **前提** 当前 result 中仍存在 uncertain assignment
- **并且** trade station gate 已通过
- **当** 用户点击「确定」并在二次确认 popup 中再次点击「确定」
- **那么** 系统 SHALL 保存当前 draft
- **并且** `hasChanges` SHALL 变为 false
- **并且** 顶部「确定」按钮 SHALL 置灰/禁用
- **并且** 当前页面 SHALL 继续停留在星区编辑页面
- **并且** result groups SHALL 清理 `isNew` 等仅表示未保存新增的 transient 高亮标记
- **并且** `calcBaselinePillState` SHALL 从保存后的 binding groups 刷新，group 新增高亮和 coverage/connected pill SHALL NOT 继续显示相对确认前的差异高亮
- **并且** uncertain assignment 提示 MAY 继续显示，但 SHALL NOT 被解释为未保存改动

#### Scenario: Styled secondary confirm dialog

- **前提** 当前 result 中仍存在 uncertain assignment
- **并且** trade station gate 已通过
- **当** 用户第一次点击「确定」
- **那么** 系统 SHALL 展示二次确认 popup
- **并且** popup SHALL 使用应用内弹窗面板、遮罩、主按钮和次按钮样式
- **并且** popup SHALL NOT 使用无修饰纯文本按钮
- **当** 用户点击 popup「取消」
- **那么** 系统 SHALL 只关闭 popup，不修改 draft、binding 或 baseline

### Requirement: Pin Unpin Group Card State

系统 SHALL 将 pin / unpin 作为 hub/group card 上的 shared draft 状态变换处理。unpin 后 card SHALL 保留在当前 hub 列表中；`isPinned=false` 只影响下一次显式计算是否作为 pinned base input。

#### Scenario: Unpin keeps hub card and toggles pinned state

- **前提** 当前 `autoGroupResult.groups` 中存在 hub group `G`
- **并且** `G.sectorMacro=S`
- **当** 用户对 `G` 执行 unpin
- **那么** `autoGroupResult.groups` SHALL 继续包含 `G`
- **并且** `G.isPinned` SHALL 变为 `false`
- **并且** `autoGroupResult.assignments` SHALL 包含 `sectorMacro=S` 的 assignment
- **并且** 该 assignment SHALL 默认选中 standalone option
- **并且** 该 assignment SHALL 在 assignment 列表最上方的 unpin 专门位置展示
- **并且** 该 assignment 的 `displayBucket` SHALL 设为 `'unpin'`
- **并且** 该 assignment 的 `unpinOrder` SHALL 记录 unpin 先后顺序，用于 unpin 组内排序
- **并且** 该 assignment 的 absorb options SHALL 复用标准 assignment 展示规则，当前范围内命中的 absorb 候选 SHALL 全部显示
- **并且** 无当前范围命中时 SHALL 只显示最小扩展候选
- **并且** 超过最大不确定扩展跳数的 absorb option SHALL NOT 显示
- **并且** 系统 SHALL NOT 调用 standalone coverage 计算
- **并且** 系统 SHALL NOT 修改 group 顺序、coverage、connections、trade station、virtual station draft 或其他 assignment 选择

#### Scenario: Multiple unpin assignments keep unpin order

- **前提** 当前 `autoGroupResult.groups` 中存在 hub group `G1` 和 `G2`
- **并且** `G1.sectorMacro=S1`
- **并且** `G2.sectorMacro=S2`
- **当** 用户先对 `G1` 执行 unpin，再对 `G2` 执行 unpin
- **那么** assignment 列表 SHALL 将 `S1` 和 `S2` 放在最上方的 unpin 专门位置
- **并且** `S1` SHALL 排在 `S2` 之前
- **并且** 其他非 unpin assignment SHALL 排在这些 unpin assignment 之后

#### Scenario: Absorb preserves unpin display position

- **前提** 当前 `autoGroupResult.assignments` 中存在 `displayBucket='unpin'` 的 assignment `A`
- **并且** `A.sectorMacro=S`
- **当** 用户对 `A` 选择 absorb 到目标 group `T`
- **那么** 系统 SHALL 更新 `A.selectedOptionIndex` 和 `A.status` 为 `'auto'`
- **并且** SHALL NOT 改变 `A.displayBucket`
- **并且** SHALL NOT 改变 `A.unpinOrder`
- **并且** `A` SHALL 继续留在 assignment 列表最上方的 unpin 专门位置
- **并且** 系统 SHALL 将 `S` 加入目标 group `T` 的 coverage

#### Scenario: Pin removes hub assignment

- **前提** 当前 `autoGroupResult.groups` 中存在 hub group `G`
- **并且** `G.sectorMacro=S`
- **并且** `G.isPinned=false`
- **并且** `autoGroupResult.assignments` 中存在 `sectorMacro=S` 的 assignment
- **当** 用户对 `G` 执行 pin
- **那么** `autoGroupResult.groups` SHALL 继续包含 `G`
- **并且** `G.isPinned` SHALL 变为 `true`
- **并且** `autoGroupResult.assignments` SHALL NOT 包含 `sectorMacro=S` 的 assignment
- **并且** 系统 SHALL NOT 修改 group 顺序、coverage、connections、trade station、virtual station draft 或其他 assignment 选择

#### Scenario: Pinned base input excludes unpinned groups

- **前提** 当前 `autoGroupResult.groups` 中存在 `isPinned=false` 的 group `G`
- **当** 用户点击显式「计算」或「快速计算」
- **那么** `buildRecalculateBaseGroups()` SHALL NOT 将 `G` 输出到 pinned base groups
- **并且** 下一次计算 SHALL NOT 把 `G` 作为固定 hub 输入

#### Scenario: Reappeared unpinned sector becomes normal calculated hub

- **前提** 当前 `autoGroupResult.groups` 中存在 `isPinned=false` 的 group `G`
- **并且** `G.sectorMacro=S`
- **当** 用户点击显式「计算」或「快速计算」
- **并且** 计算结果中 `S` 重新成为 hub/group card
- **那么** 该计算结果中的 `S` group SHALL NOT 保持 unpin 状态
- **并且** 该计算结果中的 `S` group `isPinned` SHALL 为 `true`
- **并且** `autoGroupResult.assignments` SHALL NOT 保留 `sectorMacro=S` 的 unpin assignment

#### Scenario: Pin unpin button is a group card action

- **前提** 当前页面处于 result 模式或 edit 模式
- **当** 系统渲染 hub/group card
- **那么** card SHALL 显示 pin / unpin 按钮
- **并且** result 模式 SHALL NOT 隐藏该按钮
- **并且** assignment card SHALL NOT 显示 pin / unpin 按钮

#### Scenario: Pure pin unpin is not dirty

- **前提** 当前 draft 与已保存 binding 在可持久化字段上一致
- **当** 用户只执行 pin 或 unpin，且未进一步选择 absorb 或显式 standalone
- **那么** `hasChanges` SHALL 保持 false
- **并且** 顶部「确定」按钮 SHALL 保持置灰/禁用

#### Scenario: Explicit standalone keeps existing standalone behavior

- **前提** sector `S` 出现在 assignment 列表中
- **当** 用户显式选择「独立成组」
- **那么** 系统 SHALL 使用既有 standalone 逻辑创建 `S` 的 hub group
- **并且** SHALL 按 `prefJumpRange` 计算 coverage 并排除已占用 sector
- **并且** SHALL 向邻近 assignment 追加以 `S` 为 hub 的 derived absorb candidates
- **并且** 对距离 `≤ prefJumpRange` 的 sector SHALL 追加 `extendsRange=false` 的 absorb option
- **并且** 对距离 `> prefJumpRange` 且 `≤ MAX_UNCERTAIN_JUMP` 的 sector SHALL 追加 `extendsRange=true` 的 absorb option
- **并且** 对距离 `> MAX_UNCERTAIN_JUMP` 的 sector SHALL NOT 追加 absorb option
- **并且** 若新候选是更优选择，邻近 sector MAY 被该 standalone hub 吸收到 coverage
- **并且** 被追加候选的 assignment SHALL 按以下规则更新 `selectedOptionIndex` 和 `status`

#### Scenario: Standalone derived candidate default selection

- **前提** sector `S` 显式独立成组后，系统为邻近 sector `T` 追加以 `S` 为 hub 的 derived absorb candidate
- **当** 新 hub `S` 到 `T` 的距离 `≤ prefJumpRange`（`extendsRange=false`）
- **并且** `T` 当前已有选中项（`selectedOptionIndex !== null`）
- **当** 新 hub `S` 比当前选中项更优（距离更近，或同距离 score 更高）
- **那么** `T.selectedOptionIndex` SHALL 切换到新 hub `S` 对应的 option
- **并且** `T.status` SHALL 为 `'auto'`
- **当** 新 hub `S` 不比当前选中项更优
- **那么** `T.selectedOptionIndex` SHALL 保持不变
- **并且** `T.status` SHALL 保持不变
- **当** 新 hub `S` 加入后与当前选中项产生 score 平局
- **那么** `T.selectedOptionIndex` SHALL 保持不变
- **并且** `T.status` SHALL 保持不变

#### Scenario: Standalone derived candidate resolves uncertain tie

- **前提** sector `T` 当前为 `uncertain_tie`（`selectedOptionIndex === null`，多个 range 内候选 score 平局）
- **当** 新 hub `S` 到 `T` 的距离 `≤ prefJumpRange`（`extendsRange=false`）
- **当** 新 hub `S` 明确打破原有平局（距离更近，或同距离 score 明显更优）
- **那么** `T.selectedOptionIndex` SHALL 指向新 hub `S` 对应的 option
- **并且** `T.status` SHALL 为 `'auto'`
- **当** 新 hub `S` 加入后仍存在 score 平局
- **那么** `T.selectedOptionIndex` SHALL 保持 `null`
- **并且** `T.status` SHALL 保持 `'uncertain_tie'`

#### Scenario: Standalone derived candidate preserves explicit standalone selection

- **前提** sector `T` 当前 `status='standalone'`，`selectedOptionIndex` 指向 standalone option
- **当** 新 hub `S` 独立成组后，系统为 `T` 追加 derived absorb candidate
- **当** 新 hub `S` 到 `T` 的距离 `≤ prefJumpRange`（`extendsRange=false`）
- **那么** `T.selectedOptionIndex` SHALL 保持指向 standalone option
- **并且** `T.status` SHALL 保持 `'standalone'`
- **并且** 系统 SHALL 只追加 option，不自动切换选择
- **当** 新 hub `S` 到 `T` 的距离 `> prefJumpRange`（`extendsRange=true`）
- **那么** `T.selectedOptionIndex` SHALL 保持指向 standalone option
- **并且** `T.status` SHALL 保持 `'standalone'`

#### Scenario: Standalone derived candidate extension only

- **前提** sector `S` 显式独立成组后，系统为邻近 sector `T` 追加 derived absorb candidate
- **当** 新 hub `S` 到 `T` 的距离 `> prefJumpRange` 且 `≤ MAX_UNCERTAIN_JUMP`（`extendsRange=true`）
- **并且** `T` 的 options 中无其他 range 内 absorb 命中
- **那么** `T.selectedOptionIndex` SHALL 为 `null`
- **并且** `T.status` SHALL 保持 `'uncertain_extend'`
- **并且** UI SHALL 显示「需要扩展」tag 且无 radio 默认选中
- **当** `T` 的 options 中同时存在其他 range 内 absorb 命中
- **那么** `T.selectedOptionIndex` SHALL 保持不变
- **并且** `T.status` SHALL 保持不变

#### Scenario: Absorb removes own hub by sector macro

- **前提** sector `S` 出现在 assignment 列表中
- **并且** 当前 result 中存在一个或多个 `sectorMacro=S` 的 hub group
- **当** 用户选择将 `S` absorb 到目标 group `T`
- **那么** 系统 SHALL 删除所有 `sectorMacro=S` 的自身 hub group
- **并且** SHALL 清理其他 group 中指向被删除 group 的 `connectedGroupIds`
- **并且** SHALL 清理 assignment options 中指向被删除 group 的引用
- **并且** SHALL 将 `S` 加入目标 group `T` 的 coverage
- **并且** 被删除自身 hub 的 trade station SHALL 被丢弃，不转移到 `T`

#### Scenario: No edit restore snapshot

- **前提** 用户进入 edit 模式并修改 draft
- **当** 用户点击「退出」
- **那么** 系统 SHALL 保留当前 shared draft
- **并且** SHALL NOT 恢复进入 edit 前的 coverage、connection、assignment、trade station 或 color

### Requirement: Save Binding Group Identity Migration

Save binding state SHALL use version 2 for sector group identity based on hub `sectorMacro`.

#### Scenario: Migrate legacy group ids to sector macros

- **前提** localStorage 中存在 version 1 save binding state
- **并且** groups 中存在旧 `id` 字段
- **当** 系统 normalize save binding state
- **那么** 输出 state version SHALL 为 2
- **并且** 每个有效 group SHALL NOT 包含持久化 `id` 字段
- **并且** group identity SHALL be represented by `sectorMacro`
- **并且** `connectedGroupIds` 中旧 group id SHALL 被替换为对应 group 的 `sectorMacro`
- **并且** `stationPlans.groupId` 中旧 group id SHALL 被替换为对应 group 的 `sectorMacro`

#### Scenario: Runtime draft ids use sector macro

- **前提** 系统从 binding 或自动分组结果生成 `GroupDraftInfo`
- **当** group 存在定位星区 `sectorMacro`
- **那么** runtime `GroupDraftInfo.id` SHALL 等于该 `sectorMacro`
- **并且** 系统 SHALL NOT 为该 group 生成随机 auto uuid 作为身份

### Requirement: Group Card JumpRange Incremental Assignment Rebuild

系统 SHALL 在 group card 上的 jumpRange 修改后增量重算受影响 assignment，不重建全部 assignments。

#### Scenario: JumpRange increase recalculates affected sector options

- **前提** hub group `G` 的 `jumpRange` 为 `oldRange`
- **并且** sector `T` 距离 `G` 为 `d`，`oldRange < d ≤ newRange`
- **当** 用户将 `G` 的 `jumpRange` 从 `oldRange` 增大到 `newRange`
- **那么** 系统 SHALL 重算 `T` 的 options，`G` 对应 option 的 `extendsRange` 从 `true` 变为 `false`
- **并且** 距离 `≤ oldRange` 的 sector SHALL NOT 重算 options

#### Scenario: JumpRange increase switches selection when hub becomes range hit

- **前提** sector `T` 当前 `selectedOptionIndex=null`，`status='uncertain_extend'`
- **并且** `T` 之前主动选择了 `G` 的扩展选项（`extendsRange=true`）
- **当** `G` 的 `jumpRange` 增大使 `G` 对 `T` 从扩展候选变为 range 内候选
- **那么** `T.selectedOptionIndex` SHALL 指向 `G` 对应的 option
- **并且** `T.status` SHALL 变为 `'auto'`

#### Scenario: JumpRange increase keeps selection when hub not better than current

- **前提** sector `T` 当前已选中其他 hub `H` 的 range 内 absorb option
- **并且** `G` 的 jumpRange 增大使 `G` 对 `T` 从扩展候选变为 range 内候选
- **当** `G` 对 `T` 的距离不比 `H` 更近
- **那么** `T.selectedOptionIndex` SHALL 保持指向 `H`
- **并且** `T.status` SHALL 保持不变

#### Scenario: JumpRange decrease recalculates affected sector options

- **前提** hub group `G` 的 `jumpRange` 为 `oldRange`
- **并且** sector `T` 距离 `G` 为 `d`，`newRange < d ≤ oldRange`
- **当** 用户将 `G` 的 `jumpRange` 从 `oldRange` 减小到 `newRange`
- **那么** 系统 SHALL 重算 `T` 的 options，`G` 对应 option 的 `extendsRange` 从 `false` 变为 `true`
- **并且** 距离 `≤ newRange` 的 sector SHALL NOT 重算 options

#### Scenario: JumpRange decrease downgrades selection when hub becomes extension

- **前提** sector `T` 当前 `selectedOptionIndex` 指向 `G` 的 range 内 absorb option
- **并且** `T.status='auto'`
- **当** `G` 的 `jumpRange` 减小使 `G` 对 `T` 从 range 内候选变为扩展候选
- **并且** `T` 无其他 range 内 absorb 命中
- **那么** `T.selectedOptionIndex` SHALL 变为 `null`
- **并且** `T.status` SHALL 变为 `'uncertain_extend'`
