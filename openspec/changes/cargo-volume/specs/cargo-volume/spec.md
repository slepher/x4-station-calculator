# Cargo Volume Specification

## Purpose

将 `live-cargo-volume` 的 allocation volume 视图从仅有 archive 数据的 live 模式扩展到 live + blueprint 双模式通用，并修复无 `archiveStation` 场景下的 UI 缺陷。本 spec 是对 `live-cargo-volume/spec.md` 的扩展和部分覆盖。

## ADDED Requirements

### Requirement: Blueprint Production Volume Mode Must Use Allocation View

blueprint（planning）模式下的 `volume` 视图 MUST 使用 allocation volume 视图（`StationAllocationView`），而不是渲染空态或旧的 planning volume 组件。

#### Scenario: Blueprint volume shows allocation view

**前提** 用户位于 blueprint 生产工作台的 station workbench  
**并且** 当前 `viewMode = volume`  
**当** 中间资源面板渲染  
**那么** 系统渲染 `StationAllocationView` 组件  
**并且** 每个 ware 行显示 ware 名称和 `recommendedCount`

#### Scenario: Blueprint allocation view has no progress bar

**前提** 用户在 blueprint 模式 `volume` 视图下查看某个 ware 行  
**当** 系统渲染该行  
**那么** 行中 MUST NOT 显示进度条（`bar-shell`）  
**并且** 行中 MUST NOT 显示 `currentCount / targetCount` overlay

#### Scenario: Blueprint allocation group header shows recommended only

**前提** 用户在 blueprint 模式 `volume` 视图下查看 group header  
**当** 系统渲染组头摘要  
**那么** 仅显示 `Rec xxx m³`  
**并且** MUST NOT 显示 `Cur` 或 `Tar` 汇总

### Requirement: Allocation Detail Table Must Use Fixed Column Positions

明细表 MUST 使用固定列布局，隐藏列通过空占位保持 grid track 不变，确保"每小时量"列在任何列显隐组合下都保持相同的水平位置。

#### Scenario: Rate column stays fixed when Current column hidden

**前提** drain section 的 `includeCurrentColumn = false`  
**当** 明细表渲染  
**那么** "每小时量"列的水平位置与 `includeCurrentColumn = true` 时相同  
**并且** "当前"列位置渲染为空占位

#### Scenario: Rate column stays fixed when Target column hidden

**前提** fill-current section 的 `includeTargetColumn = false`（无 archive 时）  
**当** 明细表渲染  
**那么** "每小时量"列的水平位置与全列显示时相同

### Requirement: Drain Sections Must Hide Current Column Without Archive Data

当 `hasArchiveData === false` 时，drain / downstream / station-breakdown section MUST NOT 显示"当前"列，且对应行的 `currentMinutes` MUST 为 `undefined`。

#### Scenario: Drain section without archive has no Current column

**前提** 用户查看一个 `hasArchiveStation = false` 的 station 的 allocation volume  
**并且** 展开某个 ware 的明细  
**当** 渲染 drain section  
**那么** 明细表不显示"当前"列头  
**并且** 各行的 `currentMinutes` 不渲染

#### Scenario: Downstream section without archive has no Current column

**前提** 用户查看一个 `hasArchiveStation = false` 的 station 的 allocation volume  
**并且** 展开某个 ware 的明细并展开 downstream section  
**当** 渲染 downstream 明细  
**那么** 明细表不显示"当前"列  
**并且** 各行的 `currentMinutes` 不渲染

### Requirement: Live Mode Without Archive Station Behaves Same As Blueprint

live 模式在失去 `archiveStation` 绑定（`archiveStation === null`）时，MUST 采用与 blueprint 模式相同的简化行为：无进度条、组头仅显示 Rec、明细无"当前"列。

#### Scenario: Live station without archive shows simplified view

**前提** 用户在 live 模式下但当前 station 的 `archiveStation === null`  
**并且** 当前 `viewMode = volume`  
**当** 系统渲染 allocation view  
**那么** 行为与 blueprint 模式一致  
**并且** 不显示进度条  
**并且** 组头仅显示 Rec 汇总  
**并且** drain/downstream 明细不显示"当前"列

## MODIFIED Requirements

### Requirement: Allocation View Must Be VisualMode-Agnostic

原 `live + volume` 专属的 allocation 视图现 MUST 在 `station` workbench 模式下不论 `visualMode` 均生效。视图的行为差异仅由 `hasArchiveStation` 决定。

#### Scenario: Allocation view used in both live and blueprint

**前提** `workbenchMode = station` 且 `viewMode = volume`  
**当** 系统渲染资源面板  
**那么** 无论 `visualMode = live` 还是 `visualMode = planning`，均渲染 `StationAllocationView`

### Requirement: Allocation View Components Use Generic Naming

所有与 allocation volume 相关的类型、组件、store 属性 MUST 使用通用命名（去掉 `Live` 前缀），不再暗示仅限 live 模式使用。

#### Scenario: No Live-prefixed types remain

**前提** 系统编译通过  
**当** 检查 `production-workbench-contract.ts`  
**那么** 不存在以 `Live` 开头的 allocation 类型  
**并且** 所有引用已更新为 `Allocation*` 类型

#### Scenario: No Live-prefixed components remain

**前提** 系统编译通过  
**当** 检查 `src/components/empire/`  
**那么** 不存在 `LiveStationAllocationView.vue`  
**并且** 不存在 `LiveStationAllocationRow.vue`  
**并且** 不存在 `LiveStationCargoOnlyRow.vue`  
**并且** 对应文件已重命名为 `StationAllocationView.vue`、`StationAllocationRow.vue`、`StationCargoOnlyRow.vue`

## RENAMED Requirements

- FROM: ### Requirement: Live Volume Must Use A Dedicated Allocation View
- TO:   ### Requirement: Allocation View Must Be VisualMode-Agnostic

(原 requirement 描述修改为 live + blueprint 通用)
