# Station Tab Bar Specification

## Purpose

定义 StationTabBar 组件的行为规范，区分星区版与简化版。

## ADDED Requirements

### Requirement: Simplified StationTabBar

简化版 StationTabBar 用于无星区场景（BlueprintProduction）。 SHALL pass validation

#### Scenario: Display station list only

**前提** BlueprintProduction 有 3 个站点
**当** 用户打开 BlueprintProductionWorkbenchView
**那么** StationTabBar 显示 3 个站点标签
**并且** 无 Overview 标签
**并且** 无 Transit 标签
**并且** 无星区分组展开逻辑

#### Scenario: Add new station

**前提** 用户在 BlueprintProduction 中
**当** 用户点击添加按钮
**那么** 触发 `createStation` 事件
**并且** 新站点标签出现在列表末尾

#### Scenario: Context menu operations

**前提** 用户右键点击站点标签
**当** 系统显示上下文菜单
**那么** 菜单包含：重命名、复制、删除选项
**并且** 无星区相关操作

### Requirement: SectorStationTabBar

星区版 StationTabBar 用于有星区场景（LiveProduction），保留原有功能。 SHALL pass validation

#### Scenario: Display sector grouped stations

**前提** LiveProduction 有星区和站点数据
**当** 用户打开 LiveProductionWorkbenchView
**那么** SectorStationTabBar 显示 Overview 标签
**并且** 显示 Transit 标签（每个星区一个）
**并且** 点击 Transit 标签展开显示该星区下的站点

#### Scenario: Navigate to Transit Hub

**前提** 用户点击 Transit 标签
**当** 系统响应选择事件
**那么** 触发 `selectTransit` 事件
**并且** 视图切换到 Transit Hub 面板

#### Scenario: Navigate to Overview

**前提** 用户点击 Overview 标签
**当** 系统响应选择事件
**那么** 触发 `selectOverview` 事件
**并且** 视图切换到 EmpireWareFlowsDashboard

## MODIFIED Requirements

### Requirement: BlueprintProductionStore Station List

BlueprintProductionStore 的站点列表不再按星区分组。 SHALL pass validation

#### Scenario: Get ordered stations

**前提** Empire 有 3 个站点，分布在不同星区或无星区
**当** BlueprintProductionStore 计算 `orderedStations`
**那么** 返回按创建顺序排列的站点列表
**并且** 无 `sectorId` 分组逻辑

#### Scenario: No transit sector selection

**前提** 用户在 BlueprintProduction 中
**当** 用户尝试访问 Transit 功能
**那么** 系统无响应（功能已移除）

## REMOVED Requirements

- BlueprintProductionStore 的 `sectors` 属性
- BlueprintProductionStore 的 `sectorLinks` 属性
- BlueprintProductionStore 的 `activeTransitSectorId` computed
- BlueprintProductionStore 的 `selectTransitSector` 方法
- BlueprintProductionStore 的 `selectOverview` 方法
- BlueprintProductionStore 的 `getTransitHubViewModel` 方法
- BlueprintProductionWorkbenchView 的 Transit Hub 视图模板
- BlueprintProductionWorkbenchView 的 Overview 视图模板

移除原因：BlueprintProduction 用于纯蓝图规划，不涉及存档数据的星区概念。星区功能仅在 LiveProduction（Binding 模式）中使用。