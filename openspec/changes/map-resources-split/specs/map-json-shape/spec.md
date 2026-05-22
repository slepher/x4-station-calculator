# Map Json Shape Specification

## Purpose

约束 `maps.json` 作为纯地图结构输出，不再承载资源相关字段。

## MODIFIED Requirements

### Requirement: Maps Json Consumer Access Pattern

所有直接消费 `maps.json` 的代码 SHALL 将 `maps.json` 视为纯地图结构文件，而不是资源结果文件。

#### Scenario: 读取 sector 地图结构

**当** 运行时代码读取 `maps.json` 中的 sector 数据
**那么** 可以读取名称、归属、坐标、日光、khaak 等地图字段
**并且** 不应期待 `sector.resources` 存在
**并且** 不应期待 `sector.regions` 存在

#### Scenario: 资源消费改走副文件

**当** 地图资源 tooltip、资源过滤或资源着色逻辑需要读取 sector 资源
**那么** 系统 SHALL 从 `map_resources.json` 获取资源数据
**并且** SHALL NOT 继续从 `maps.json` 获取资源字段

### Requirement: No Compatibility Bridge For Old Map Shape

系统 SHALL 直接切换到“纯地图 `maps.json` + 资源副文件 `map_resources.json`”的新边界，而不是长期保留资源字段兼容桥。

#### Scenario: 地图主文件不再输出资源字段

**当** `x4_data_processor.py` 生成 `maps.json`
**那么** `sectors[*]` 中不包含 `regions`
**并且** `sectors[*]` 中不包含 `resources`

#### Scenario: 资源处理不回写地图主文件

**当** `x4_resource_processor.py` 处理地图资源
**那么** 只输出 `map_resources.json`
**并且** SHALL NOT 修改 `maps.json`
