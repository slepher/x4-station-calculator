# Map Json Shape Specification

## Purpose

将 `maps.json` 的正式数据结构重构为顶层 `clusters` 与顶层 `sectors` 双索引，并统一 cluster / sector 相关 id 为小写，消除旧嵌套结构与兼容桥接。

## ADDED Requirements

### Requirement: Top-Level Cluster And Sector Indexes

`maps.json` SHALL 使用顶层 `clusters` 与顶层 `sectors` 作为正式结构。

#### Scenario: 顶层双索引存在

**当** 系统加载 `maps.json`
**那么** 顶层包含 `clusters` 节点
**并且** 顶层包含 `sectors` 节点
**并且** `clusters` 的 value 为 `Record<string, Cluster>`
**并且** `sectors` 的 value 为 `Record<string, Sector>`

#### Scenario: cluster 不再内嵌 sector 主数据

**当** 开发者检查任意 cluster 节点
**那么** sector 主数据不再以内嵌 `sectors: Record<string, Sector>` 作为正式入口
**并且** `Cluster` 只保留 `sectors: string[]` 形式的 sector id 列表
**并且** `Sector` 保留 `cluster_id: string` 指向所属 cluster
**并且** sector 读取应从顶层 `sectors` 开始

### Requirement: Lowercase Map Entity Ids

cluster 与 sector 相关 id SHALL 统一为小写。

#### Scenario: 顶层 key 小写

**当** 系统写出 `maps.json`
**那么** `clusters` 的每个 key 为小写 cluster id
**并且** `sectors` 的每个 key 为小写 sector id

#### Scenario: 内部引用字段小写

**当** 系统写出 cluster / sector 关联字段
**那么** `Cluster.id`、`Cluster.sectors[]`、`Sector.id`、`Sector.cluster_id`
**并且** `target_cluster_id`、`sector_a_id`、`sector_b_id`
**并且** 其他 cluster / sector 引用字段
**那么** 都使用小写值

### Requirement: No Compatibility Bridge For Old Map Shape

系统 SHALL 直接切换到新结构，而不是保留旧结构兼容层。

#### Scenario: 运行时代码不再依赖旧入口

**当** 运行时代码读取 sector 数据
**那么** 不再依赖 `clusters.<cluster-id>.sectors` 作为正式结构入口
**并且** 不保留仅为兼容旧 `maps.json` 形状而存在的桥接逻辑

#### Scenario: 生成链路直接输出新结构

**当** 地图处理脚本生成 `maps.json`
**那么** 输出结果直接为新结构
**并且** 不先生成旧结构再在运行时转换

## MODIFIED Requirements

### Requirement: Maps Json Consumer Access Pattern

所有直接消费 `maps.json` 的代码默认访问模式调整为“cluster 从 `maps.clusters` 读取，sector 从 `maps.sectors` 读取”。

#### Scenario: sector 名称与坐标查找

**当** save parser 配置、地图搜索或资源提取逻辑需要读取 sector 名称、坐标或资源
**那么** 默认从顶层 `maps.sectors` 读取
**并且** 不再通过双层遍历 cluster 内嵌 sector 结构获取
