# active-binding Specification

## Purpose
TBD - created by archiving change active-binding. Update Purpose after archive.
## Requirements
### Requirement: Active Binding Synchronization

`live-production` SHALL use `activeViewStore.activeBinding` as the single active binding entry, and all binding-domain stores SHALL synchronize from it.

#### Scenario: Restore active binding from persisted active view

**前提** `activeViewStore.activeView` 为 `live-production`
**并且** `activeViewStore.activeBinding` 为某个有效 `gameGuid`
**当** 系统恢复 `live-production` 内存状态
**那么** `useSaveBindingStore` 必须装载同一 `gameGuid` 的 binding draft
**并且** `useSaveStore.selectedArchive` 必须对齐到该 binding 约束下的 archive

#### Scenario: Clear active binding when persisted active becomes invalid

**前提** `activeViewStore.activeBinding` 指向某个 `gameGuid`
**并且** 该 `gameGuid` 已无任何有效 archive
**当** 系统恢复或重新校验 active 状态
**那么** `activeViewStore.activeBinding` 必须被清空
**并且** `useSaveBindingStore.activeBinding` 必须同时为 `null`

#### Scenario: Editing binding data does not switch current active binding

**前提** 当前工作台已指向某个 active binding
**当** 系统执行 binding 数据编辑动作，例如更新 `selectedArchiveTime`、保存 binding、更新 stationPlans 或 bindingName
**那么** 这些动作不得隐式切换当前 active binding
**并且** 当前工作台指向必须保持不变，除非调用显式的 binding 载入/切换动作

### Requirement: Archive Guid Consistency

Realtime archive data MUST NOT be exposed when the selected archive guid does not match the active binding guid.

#### Scenario: Block cross-guid realtime data

**前提** 当前 active binding 的 `gameGuid` 为 A
**并且** 当前 selected archive 的 `meta.guid` 为 B
**当** `useLiveProductionStore` 解析 `playerStationRecords` 与 `archiveStation`
**那么** realtime/archive 数据必须视为无效
**并且** `archiveStation` 必须返回 `null`
**并且** 界面不得显示来自 B 的 realtime 站点内容

### Requirement: Binding Activation Rebuild

Binding activation SHALL rebuild binding-related compute caches and aggregation inputs.

#### Scenario: Switch binding during runtime

**前提** 当前已在 `live-production` 中打开某个 binding
**当** 用户切换到另一个 binding
**那么** 系统必须重建 `planningDerivedMap`
**并且** 系统必须重建 `liveFlowMap`
**并且** overview / station / transit 聚合必须读取新 binding 的结果

#### Scenario: Use one activation path for initialize and runtime switch

**前提** 系统支持首次初始化与运行中切换 binding
**当** 任一路径激活 binding
**那么** 两者必须复用同一条 binding 激活事务
**并且** 不得出现仅初始化路径重建缓存、运行时切换路径不重建的差异

### Requirement: Dirty-Driven Recompute

Binding editing MUST use dirty-driven recompute instead of recomputing all results whenever the user enters `live-production`.

#### Scenario: Do not recompute all results only because the user enters live-production

**前提** 当前 binding 结果没有新的 dirty 标记
**当** 用户进入或返回 `live-production`
**那么** 系统不得仅因为视图切换而重算全部结果

#### Scenario: Mark whole binding dirty when sector edit changes structure

**前提** 用户在 binding 界面执行星区编辑
**当** 该编辑影响了连接关系，或影响了范围内空间站集合
**那么** 当前 binding 的结果必须整体标记为 dirty
**并且** 整体脏状态必须使用显式的 `dirty = 'all'` 表示

#### Scenario: Keep clean state when sector edit changes nothing relevant

**前提** 用户在 binding 界面执行星区编辑
**当** 该编辑既未影响连接关系，也未影响范围内空间站集合
**那么** 系统不得标记 dirty

#### Scenario: Treat free-station bind or unbind as station-module change

**前提** 用户在 binding 界面执行自由空间站绑定或解绑
**当** 操作完成
**那么** 该操作必须等价视为站点级模块变更
**并且** 仅目标空间站被标记为 dirty
**并且** 不得提升为星区 dirty 或全局 dirty

### Requirement: Active Invalidation After Save Removal

Removing archives SHALL invalidate or realign the current active binding context.

#### Scenario: Remove the last valid archive of current active binding

**前提** 当前 active binding 指向某个 `gameGuid`
**并且** 该 `gameGuid` 只剩一个有效 archive
**当** 用户删除该 archive
**那么** `activeViewStore.activeBinding` 必须被清空
**并且** `activeViewStore.activeBindingStation` 必须被清空
**并且** `useSaveBindingStore` 必须清空当前 draft

#### Scenario: Remove one archive while the binding still has remaining valid archives

**前提** 当前 active binding 指向某个 `gameGuid`
**并且** 该 `gameGuid` 仍有其他有效 archive
**当** 用户删除其中一个 archive
**那么** 系统必须将 `selectedArchive` 对齐到剩余合法 archive
**并且** 系统必须重建对应 realtime 计算缓存

### Requirement: Invalid Binding Entry Behavior

Bindings without any valid archive MUST be presented as invalid and MUST NOT be loadable from normal UI entry points.

#### Scenario: Show invalid label for binding without valid archive

**前提** 某个 binding 对应的 `gameGuid` 已无任何有效 archive
**当** 系统渲染 binding 列表或载入入口
**那么** 该项名称后必须显示红色 `[存档失效]` 标签

#### Scenario: Disable load action for invalid binding

**前提** 某个 binding 对应的 `gameGuid` 已无任何有效 archive
**当** 用户查看 binding 载入入口
**那么** 该 binding 的载入按钮必须处于禁用状态
**并且** 常规交互不得触发 binding 激活事务

### Requirement: Upload Unrelated Archive Does Not Clear Active Binding

Uploading a save archive of a different game MUST NOT affect the currently active binding's station records.

#### Scenario: Upload archive of different guid while binding is active

**前提** 当前 active binding 指向 gameGuid A
**并且** 当前 `playerStationRecords` 已加载 A 的站点数据
**当** 用户上传一个 gameGuid 为 B 的新存档
**那么** `playerStationRecords` 必须保持不变
**并且** 当前 binding 的站点列表必须保持不变

### Requirement: Upload Related Archive Follows Binding Time Constraint

Uploading a save archive of the same game SHALL auto-update the active binding's station data only if the binding has no pinned `selectedArchiveTime`.

#### Scenario: Auto-update when binding has no pinned archive time

**前提** 当前 active binding 指向 gameGuid A
**并且** `binding.selectedArchiveTime === null`（绑定仅关联 guid）
**并且** 当前 `playerStationRecords` 已加载存档 T1 的数据
**当** 用户上传 gameGuid A 且时间较新的存档 T2
**那么** 系统必须将 `playerStationRecords` 切换到存档 T2 的数据

#### Scenario: Keep data when binding has pinned archive time

**前提** 当前 active binding 指向 gameGuid A
**并且** `binding.selectedArchiveTime` 为某个具体时间 T1
**并且** 当前 `playerStationRecords` 已加载存档 T1 的数据
**当** 用户上传 gameGuid A 且时间较新的存档 T2
**那么** `playerStationRecords` 必须保持不变
**并且** binding 仍固定指向存档 T1

### Requirement: Load Binding From List Must Activate

Loading a binding from the binding list panel SHALL call the full activation transaction, not just load the draft.

#### Scenario: Load binding from panel

**前提** 用户通过 `LoadLivePlanModal` 载入某个 binding
**当** 用户点击该 binding 的载入按钮
**那么** 系统必须执行完整的 binding 激活事务（`activateBinding`）
**并且** 该事务必须重建 `planningDerivedMap` 并正确加载 `playerStationRecords`

### Requirement: Switch Binding Clears Expanded Sector

Switching the active binding SHALL clear `expandedSectorId` to prevent stale expansion state.

#### Scenario: Clear expanded sector on binding switch

**前提** 当前工作台在某个星区的空间站上，该星区处于展开状态
**当** 用户切换到另一个 binding
**那么** `expandedSectorId` 必须被清空
**并且** 当前页面回到星区总览

