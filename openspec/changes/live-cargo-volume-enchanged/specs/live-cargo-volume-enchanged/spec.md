# Live Cargo Volume Enhanced Specification

## Purpose

扩展 `LiveStationAllocationView` 覆盖范围为 station + transit-hub，支持有/无 archive 两种数据模式，并在 transit-hub 模式下隐藏 fav/lock 操作按钮。

## ADDED Requirements

### Requirement: Allocation View for Station Without Archive

系统 SHALL 在 station workbench 的 `live + volume` 视图下，即使没有 archive station，也使用 `LiveStationAllocationView` 渲染 allocation 对比视图。

#### Scenario: 无 archive 时 station 显示 allocation 降级视图

**前提** workbenchMode 为 `station`，viewMode 为 `volume`，且 `archiveStation` 为 null
**当** 系统渲染 volume 面板
**那么** 系统 MUST 渲染 `LiveStationAllocationView`
**并且** 每个 ware 的 `currentCount` MUST 为 0
**并且** 每个 ware 的 `targetCount` MUST 等于 `recommendedCount`
**并且** progress bar MUST 显示 `0 / recommendedCount`
**并且** 展开 detail 时 Fill From Current 卡片 MUST NOT 出现
**并且** 所有 detail section 的 `includeTargetColumn` MUST 为 `false`
**并且** `liveCargoOnlyItems` MUST 为空数组

#### Scenario: 有 archive 时 station 行为不变

**前提** workbenchMode 为 `station`，viewMode 为 `volume`，且 `archiveStation` 不为 null
**当** 系统渲染 volume 面板
**那么** 系统 MUST 继续使用完整的四卡片 detail + 全列
**并且** `currentCount` MUST 来源于 `archiveStation.cargo`
**并且** `targetCount` MUST 来源于 `archiveStation.targetCounts`
**并且** fav 和 lock 按钮 MUST 存在

### Requirement: Allocation View for Transit-Hub

系统 SHALL 在 transit-hub workbench 的 `live + volume` 视图下渲染 `LiveStationAllocationView`，并隐藏 fav/lock 操作按钮。

#### Scenario: transit-hub 有 archive 时显示完整 allocation

**前提** workbenchMode 为 `transit`，viewMode 为 `volume`，且 `archiveStation` 不为 null
**当** 系统渲染 volume 面板
**那么** 系统 MUST 渲染 `LiveStationAllocationView`
**并且** fav 按钮 MUST NOT 出现
**并且** lock 按钮 MUST NOT 出现
**并且** `currentCount` MUST 来源于 `archiveStation.cargo`
**并且** `targetCount` MUST 来源于 `archiveStation.targetCounts`

#### Scenario: transit-hub 无 archive 时显示降级 allocation

**前提** workbenchMode 为 `transit`，viewMode 为 `volume`，且 `archiveStation` 为 null
**当** 系统渲染 volume 面板
**那么** 系统 MUST 渲染 `LiveStationAllocationView`
**并且** fav 按钮 MUST NOT 出现
**并且** lock 按钮 MUST NOT 出现
**并且** `currentCount` MUST 为 0
**并且** `targetCount` MUST 等于 `recommendedCount`
**并且** Fill From Current 卡片 MUST NOT 出现
**并且** 所有 detail section 的 `includeTargetColumn` MUST 为 `false`

#### Scenario: transit-hub planning 模式不切换

**前提** workbenchMode 为 `transit`，viewMode 为 `volume`，mode 为 `planning`
**当** 系统渲染 volume 面板
**那么** 系统 MUST 继续渲染旧 `TransitHubStorageView`
**并且** MUST NOT 渲染 `LiveStationAllocationView`

### Requirement: Transit-Hub Station Breakdown Section

系统 SHALL 在 transit-hub 的 allocation detail 展开区新增 Station Breakdown section，按参与站展示生产/消费时间维度。

#### Scenario: Station Breakdown 包含生产站和消费站

**前提** transit-hub 的 `derivedProductionFlow` 的 `contributions` 中包含 `class === 'station'` 的条目
**当** 该 ware 的 detail 展开
**那么** 系统 MUST 渲染 Station Breakdown section
**并且** 该 section MUST 默认折叠
**并且** 生产站行 MUST 展示 `rate / target fill / recommended fill`（从空库存开始）
**并且** 生产站行 MUST NOT 显示 current 列
**并且** 消费站行 MUST 展示 `rate / current drain / target drain / recommended drain`

#### Scenario: Station Breakdown 无 archive 时去 target 列

**前提** transit-hub 无 archive，且 Station Breakdown section 存在
**当** section 被渲染
**那么** `includeCurrentColumn` MUST 为 `true`（消费站需要 current 列）
**并且** `includeTargetColumn` MUST 为 `false`
**并且** 生产站行的 `targetMinutes` MUST 为 `undefined`
**并且** 消费站行的 `targetMinutes` MUST 为 `undefined`

#### Scenario: Station Breakdown 有 archive 时全列

**前提** transit-hub 有 archive，且 Station Breakdown section 存在
**当** section 被渲染
**那么** `includeCurrentColumn` MUST 为 `true`
**并且** `includeTargetColumn` MUST 为 `true`

## MODIFIED Requirements

### Requirement: Allocation View Entry Condition

系统 SHALL 将 `LiveStationAllocationView` 的启用条件从 "station + archive" 扩展为 "station 或 transit-hub"。

#### Scenario: useAllocationVolumeView 条件放宽

**前提** 系统评估 `useAllocationVolumeView`
**当** `workbenchMode` 为 `station` 或 `transit`
**那么** `useAllocationVolumeView` MUST 为 `true`
**并且** MUST NOT 要求 `archiveStation !== null`

### Requirement: Allocation Detail Section

`LiveVolumeAllocationDetailSection` SHALL 新增 `includeTargetColumn` 字段，控制 target 列的渲染。

#### Scenario: 有 archive 时 target 列可见

**前提** detail section 由 `buildAllocationDetailSections` 生成，且 `hasArchiveData` 为 true
**当** section 被渲染于 `LiveStationAllocationRow`
**那么** `includeTargetColumn` MUST 为 `true`
**并且** target 列头和单元格 MUST 可见

#### Scenario: 无 archive 时 target 列隐藏

**前提** detail section 由 `buildAllocationDetailSections` 生成，且 `hasArchiveData` 为 false
**当** section 被渲染于 `LiveStationAllocationRow`
**那么** `includeTargetColumn` MUST 为 `false`
**并且** target 列头和单元格 MUST NOT 可见

### Requirement: LiveStationAllocationRow Action Rail

`LiveStationAllocationRow` SHALL 支持 `hideActions` prop 控制操作按钮的可见性。

#### Scenario: hideActions 为 true 时隐藏操作区

**前提** `LiveStationAllocationRow` 接收 `hideActions = true`
**当** 组件渲染
**那么** `flow-action-rail` MUST NOT 出现在 DOM 中
**并且** 组头 spacer MUST NOT 出现

#### Scenario: hideActions 为 false 时保留操作区

**前提** `LiveStationAllocationRow` 接收 `hideActions = false`（默认）
**当** 组件渲染
**那么** `flow-action-rail` MUST 出现在 DOM 中
**并且** fav 和 lock 按钮 MUST 按既有逻辑渲染
