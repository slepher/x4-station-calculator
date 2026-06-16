# Binding Preview Draft Specification

## Purpose

定义 binding 模式下 group 方案的共享草案状态、地图渲染草案数据的规则、以及存档时间比对的重算策略。

## ADDED Requirements

### Requirement: Shared Group Editing State

系统 MUST 在 `useLiveProductionStore` 中维护 binder 共享编辑状态，使 live 面板和 map 面板读写同一份数据。共享编辑状态 MUST 是全局唯一 draft，表示当前 active binding/archive 的草案；系统 SHALL NOT 同时维护多个 binding 的并行草案。

#### Scenario: State moved to liveStore

- **前提** 系统启动
- **当** `useLiveProductionStore` 初始化
- **那么** SHALL 包含以下状态：
  - `autoGroupResult: ShallowRef<AutoGroupResult | null>`
  - `calculationMode: Ref<'result' | 'edit'>`
  - `autoGroupConfirmed: Ref<boolean>`
  - `prefJumpRange: Ref<number>`
  - `bridgeSearchJumpRange: Ref<number>`
  - `prefThreshold: Ref<number>`

#### Scenario: Presenter reads from liveStore

- **前提** `useAutoSectorGroupPresenter` 被调用
- **当** presenter 需要读写上述 6 个状态
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

### Requirement: Archive time-based recalculation

系统 MUST 通过 `SaveBindingPlan.appliedAutoGroupArchiveTime` 避免重复计算。

#### Scenario: Skip recalculation on same archive time

- **前提** `binding.appliedAutoGroupArchiveTime` 等于当前存档 `meta.time`
- **并且** `liveStore.autoGroupResult` 非 null
- **当** `runAutoGroup()` 被调用
- **那么** 系统 SHALL NOT 执行重算
- **并且** SHALL 复用已有 `autoGroupResult`

#### Scenario: Recalculate on newer archive time

- **前提** 存档 time 大于 `binding.appliedAutoGroupArchiveTime`
- **当** `runAutoGroup()` 被调用
- **那么** 系统 SHALL 执行计算（`groupCleanSlate` 或 `groupIncremental`）

#### Scenario: Applied time recorded on confirm

- **前提** 用户确认 auto group 结果
- **当** `handleConfirm` 执行完成
- **那么** `binding.appliedAutoGroupArchiveTime` SHALL 设置为当前存档 time

#### Scenario: Applied time survives reload

- **前提** `SaveBindingPlan` 已保存 `appliedAutoGroupArchiveTime`
- **当** 系统从持久化状态恢复 binding
- **那么** `normalizeState()` SHALL 保留 `appliedAutoGroupArchiveTime`

### Requirement: Map rendering from shared draft

系统 MUST 在 binding 模式（step 2 / step 3）下优先使用 `liveStore.autoGroupResult` 渲染地图。

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
