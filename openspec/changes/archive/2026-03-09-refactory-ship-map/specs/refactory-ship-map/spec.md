# Refactory Ship Map Specification

## Purpose

在不改变 ship-build 现有筛选和展示结果的前提下，统一 ship/equipment 相关查询入口，减少组件层重复 map 构建与重复 id 扫描，提高可维护性与一致性。

## ADDED Requirements

### Requirement: Ship Lookup MUST Use Store-Level `findShip` Entry

#### Scenario: Resolve Ship By Id In Runtime Paths
- **前提**：运行时需要根据 `shipId` 获取飞船对象。
- **当**：业务代码执行查找。
- **那么**：系统 MUST 通过 `useShipBuildStore.findShip(shipId)` 完成查找。
- **并且**：系统 SHALL NOT 在已覆盖路径继续重复编写 `ships.find(...)`。

### Requirement: Ship Selector MUST Read `shipMap` From Store Directly

#### Scenario: Render Ship Selector Candidate Context
- **前提**：`ShipBuildSelector` 渲染候选飞船列表。
- **当**：组件建立筛选上下文。
- **那么**：系统 MUST 直接读取 store 导出的 `shipMap`。
- **并且**：`ShipBuildSelectorView` SHALL NOT 继续通过 props 透传 `shipMap`。

### Requirement: Ship-Build Raw Data Source MUST Be Centralized

#### Scenario: Initialize Ship-Build Store Data
- **前提**：store 初始化 ship-build 数据。
- **当**：读取 ships/equipments/types/races/wares/slotTags。
- **那么**：系统 MUST 从 `getShipBuildRawData()` 统一获取。
- **并且**：系统 SHALL 使用 `buildShipBuildDatas` 构建四类核心 map。

### Requirement: Ship-Build Equipment Candidate Pipeline MUST Be Single-Source

#### Scenario: Resolve Equipment Candidates For Picker
- **前提**：`ShipBuildPanelFit` 或相关面板需要装备候选。
- **当**：计算候选与 facets。
- **那么**：系统 MUST 以 `extractEquipmentSlotCandidatesWithFacets(...)` 作为单一候选来源。
- **并且**：系统 SHALL NOT 继续在 `slotTargets`/`connectionRows` 维护冗余 `options` 缓存。

### Requirement: Non-Ship Collections MUST Be Refactored Based On Real Usage Evidence

#### Scenario: Decide Array vs Map/Find Migration
- **前提**：涉及 `equipments/equipmentTypes/shipTypes/shipRaces/wares`。
- **当**：决定重构策略。
- **那么**：系统 MUST 先给出真实使用点清单。
- **并且**：仅在“按 id 查找”高频路径推进 map/find 迁移。
- **并且**：列表展示路径 SHALL 保留数组入口。

## MODIFIED Requirements

### Requirement: Ship Selector Data Wiring Uses Store-Centric Query Boundary

#### Scenario: Pass Data From View To Selector
- **前提**：`ShipBuildSelectorView` 负责为 `ShipBuildSelector` 提供输入。
- **当**：组件装配 props。
- **那么**：系统 SHALL 只传筛选状态（selectedClass/selectedRaces/selectedTypes/selectedShipId）。
- **并且**：ship 主数据查找边界 MUST 收敛到 store，不再由 View 层透传 map。
