# Map Resources File Specification

## Purpose

定义 `map_resources.json` 作为地图资源副文件的输出边界、结构和处理职责。

## ADDED Requirements

### Requirement: Separate Map Resources Output

系统 MUST 输出独立的 `map_resources.json` 作为地图资源正式出口。

#### Scenario: 资源处理输出副文件

**当** `x4_resource_processor.py` 运行完成
**那么** 系统 SHALL 输出 `map_resources.json`
**并且** 该文件 SHALL 包含地图资源正式消费所需的数据

#### Scenario: 地图主文件保持不变

**前提** `maps.json` 已由 `x4_data_processor.py` 生成
**当** `x4_resource_processor.py` 运行
**那么** 系统 SHALL NOT 修改该 `maps.json`

### Requirement: Unified Sector Resource Access Shape

`8.0` 与 `9.0` 的 `map_resources.json` 对外 SHALL 提供统一的 sector 访问形状。

#### Scenario: 按 sectorId 读取资源数据

**当** 前端按 `sectorId` 查询资源数据
**那么** SHALL 可以读取 `regions`
**并且** SHALL 可以读取 `resources`
**并且** SHALL 可以读取 `areas`

#### Scenario: 9.0 提供 definitions 顶层数据

**当** 当前版本为 `9.0`
**那么** `map_resources.json` SHALL 额外提供 `regionyield_definitions`

#### Scenario: 8.0 顶层 definitions 可为空

**当** 当前版本为 `8.0`
**那么** `regionyield_definitions` MAY 为空数组

### Requirement: Resource Input References Stay In Resource Domain

原 `sector.regions` SHALL 视为资源域数据，并从地图主文件迁移到资源副文件。

#### Scenario: regions 迁移到副文件

**当** 系统构建某个 sector 的资源数据
**那么** `sector.regions` SHALL 写入 `map_resources.json.sectors[sectorId].regions`
**并且** SHALL NOT 再写入 `maps.json`
