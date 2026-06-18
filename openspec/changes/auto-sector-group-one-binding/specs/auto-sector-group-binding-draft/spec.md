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
  - `needsAutoGroupRecalc: Computed<boolean>`
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

#### Scenario: Single draft resets on context switch

- **前提** 当前唯一 draft 已包含某个 binding/archive 的未提交编辑
- **当** active binding 或 selected archive 切换
- **那么** 系统 SHALL 使用新上下文重新初始化这份唯一 draft
- **并且** SHALL NOT 在新上下文继续显示上一上下文的未提交 draft
- **并且** SHALL NOT 为旧上下文缓存另一份并行 draft

### Requirement: Store Initialization Data Generation

系统 MUST 在 Store 初始化（或 activeBinding/archive 切换）时完成 `autoGroupResult` 的数据生成，根据变化 flag 分两条路径。

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
- **并且** AutoSectorGroupPanel 顶部 SHALL 显示三视图共用的 `AutoSectorBar`
- **并且** Allocation 区域 SHALL 显示 `SectorAllocationList`
- **并且** Trade Station 区域 SHALL 显示 `SectorTradeStationList`

#### Scenario: Detail button switches to calculate mode

- **前提** 展示模式
- **当** 点击「详情」
- **那么** SHALL 仅设置 `liveMode = 'calculate'`（不触发计算，store 数据已由 `initAutoGroupDraft()` 生成）

#### Scenario: Submit returns to display mode

- **前提** 计算模式
- **当** 点击「提交」
- **那么** SHALL 调用 `handleConfirm` 后回到展示模式

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
- **并且** SHALL 同时恢复 group、assignment、bridge decision、trade station、hub color 和 retain 字段到最近计算基线
- **并且** SHALL NOT 切换 active binding/archive 或重新运行分组算法

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

### Requirement: Binding Button Semantics

系统 SHALL 明确定义 Live/Map 共享自动分组面板中的按钮语义，避免按钮隐式触发计算、提交或恢复。

#### Scenario: Display detail button

- **前提** Live 处于展示模式
- **当** 用户点击「详情」
- **那么** 系统 SHALL 只设置 `liveMode = 'calculate'`
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

### Requirement: Snapshot And Baseline Timing

系统 SHALL 区分重置快照 `calculationBaseline` 和 UI diff 基线 `calcBaselinePillState`。

#### Scenario: Calculation baseline timing

- **前提** 系统通过初始化或显式计算得到新的 `AutoGroupResult`
- **当** 系统调用 `setAutoGroupResult(result)`
- **那么** SHALL clone `result` 写入 `calculationBaseline`
- **并且** [重置] SHALL 使用该 baseline 恢复 shared draft

#### Scenario: Pill baseline timing

- **前提** 当前 active binding/archive 初始化出第一份 result
- **当** `calcBaselinePillState` 为空
- **那么** 系统 SHALL 从当前 groups 记录 coverage 和 connected group ids
- **并且** 显式「计算」 SHALL NOT 覆盖该 baseline
- **当** 用户确认成功
- **那么** 系统 SHALL 使用确认后的 groups 更新 `calcBaselinePillState`

#### Scenario: No edit restore snapshot

- **前提** 用户进入 edit 模式并修改 draft
- **当** 用户点击「退出」
- **那么** 系统 SHALL 保留当前 shared draft
- **并且** SHALL NOT 恢复进入 edit 前的 coverage、connection、assignment、trade station 或 color
