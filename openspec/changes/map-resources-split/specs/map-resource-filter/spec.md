# Map Resource Filter Specification

## Purpose

定义地图资源筛选、tooltip 与资源覆盖效果在资源数据拆分后的正式读取边界。

## MODIFIED Requirements

### Requirement: Resource Match Candidate List

系统 MUST 将地图资源筛选所需的 sector 资源数据从 `map_resources.json` 读取，而不是从 `maps.json` 读取。

#### Scenario: 候选计算读取副文件

**前提** 地图资源筛选需要遍历 sector 资源
**当** 系统计算命中候选
**那么** SHALL 从 `map_resources.json.sectors[sectorId].resources` 读取资源摘要
**并且** SHALL NOT 依赖 `maps.json.sectors[sectorId].resources`

### Requirement: Search And Resource Highlight Coexistence

资源高亮、资源扇形与资源徽标的数据来源 MUST 切换到地图资源副文件。

#### Scenario: 资源扇形读取副文件

**前提** 地图需要渲染 sector 资源扇形
**当** 系统构建 sector 资源切片
**那么** SHALL 从 `map_resources.json` 读取 sector 资源摘要

#### Scenario: 资源 tooltip 读取副文件

**前提** 用户悬停某个 sector
**当** 系统构建 tooltip 中的资源列表
**那么** SHALL 从 `map_resources.json` 读取 sector 资源摘要
**并且** `maps.json` 只提供名称、归属、日光、坐标等地图字段
