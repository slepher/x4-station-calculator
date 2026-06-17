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

### Requirement: Panels do not trigger calculation

Live 和 Map 面板 SHALL NOT 触发分组算法。数据由 Store 在初始化/上下文切换时生成，面板仅读取。

#### Scenario: Panels do not trigger calculation

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

系统 SHALL 在 live 面板提供展示模式和计算模式，通过 `liveMode` 切换。两种模式均为纯 view 层，不触发计算，只读取 store 中已有数据。

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

#### Scenario: Detail button switches to calculate mode

- **前提** 展示模式
- **当** 点击「详情」
- **那么** SHALL 仅设置 `liveMode = 'calculate'`（不触发计算，store 数据已由 `initAutoGroupDraft()` 生成）

#### Scenario: Submit returns to display mode

- **前提** 计算模式
- **当** 点击「提交」
- **那么** SHALL 调用 `handleConfirm` 后回到展示模式
