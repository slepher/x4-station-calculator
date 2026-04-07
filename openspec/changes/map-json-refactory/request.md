# map-json-refactory Change Request

## 目标

将 `maps.json` 的主数据结构一次性重构为顶层双索引：

- `clusters: Record<string, Cluster>`
- `sectors: Record<string, Sector>`

并将所有 `cluster-id`、`sector-id` 统一改为小写。此次变更为硬切重构，不保留旧结构兼容层，不做双写，不接受“先兼容后清理”的中间状态。

## 已确认方案（审核重点）

### 1. `maps.json` 顶层结构重组

- 旧结构中的 `clusters.<cluster-id>.sectors` 不再作为 sector 主索引存在。
- 新结构以顶层 `clusters` 与顶层 `sectors` 作为唯一正式入口。
- `clusters` 节点只保留 cluster 自身信息与 cluster 级关联信息。
- `Cluster` 明确包含 `sectors: string[]`，用于声明该 cluster 下的 sector id 列表。
- `sectors` 节点承载全部 sector 明细。

### 2. id 统一小写

- 顶层 `clusters` 的 key 一律使用小写 cluster id。
- 顶层 `sectors` 的 key 一律使用小写 sector id。
- `Cluster.id`、`Cluster.sectors[]`、`Sector.id`、`Sector.cluster_id`、`target_cluster_id`、`sector_a_id`、`sector_b_id` 等内部引用字段也统一写为小写。
- 运行时代码不再承担旧大小写兼容。

### 3. 不保留旧遍历方式

- 不再允许通过 `maps.clusters[clusterId].sectors` 遍历全量 sector。
- 所有消费方统一改为直接读取顶层 `maps.sectors`，或按需要从顶层 `maps.clusters` 读取 cluster 级信息。
- cluster 节点中的 `sectors` 仅作为 sector id 列表存在，不再内嵌 sector 对象。
- 所有“从旧结构派生新结构”的临时适配层都不保留。

### 4. 生成链路同步切换

- `maps.json` 生成脚本直接输出新结构，而不是先产旧结构再转换。
- 资源提取、save 解析辅助、地图渲染、地图搜索、resource filter、导入导出、分析脚本与测试 fixture 同步切换到新结构。
- 本次重构完成后，仓库内不应残留对旧 `cluster.sectors` 主结构的运行时依赖。

### 5. 实施方式

- 先修改类型定义，明确新 `X4Map` 结构与引用字段小写约束。
- 再修改 `maps.json` 生成脚本与已有静态数据产物。
- 再批量修改所有运行时消费代码与脚本。
- 最后修改测试、fixture 与 mock 数据，消除旧结构假设。

## 边界

### In Scope

- `maps.json` 的主结构重组为顶层 `clusters` + 顶层 `sectors`。
- cluster / sector 相关 id 及引用字段统一小写。
- `src/types/**`、`src/store/**`、`src/utils/**`、`src/components/map/**`、`src/workers/**` 中直接消费 `maps.json` 的逻辑同步修改。
- `scripts/**`、`analysis/**`、`tests/**` 中直接依赖旧结构的脚本、fixture、mock 与断言同步修改。
- 更新静态 `maps.json` 产物与生成脚本，保证新旧实现之间不存在长期分叉。

### Out of Scope

- 地图产品流程、地图视觉样式、tooltip 文案或筛选交互语义调整。
- 额外拆分新的独立数据文件，例如 `clusters.json`、`sectors.json`。
- 保留兼容读取、迁移桥接或灰度切换逻辑。
- 借本次重构顺手修改资源算法、sector 搜索规则或 save 业务语义。

## 验收标准（DoD）

1. `maps.json` 顶层正式结构为 `clusters: Record<string, Cluster>` 与 `sectors: Record<string, Sector>`。
2. 每个 `Cluster` 包含小写的 `sectors: string[]`，每个 `Sector` 包含小写的 `cluster_id`。
3. 仓库中的正式运行时代码不再依赖 `clusters.<cluster-id>.sectors` 作为 sector 主结构。
4. `cluster-id`、`sector-id` 及其内部引用字段全部统一为小写，并由类型与实现共同约束。
5. `src/utils/saveParserConfig.ts`、`src/utils/saveResourceExtract.ts`、地图渲染/搜索逻辑、save parser 相关逻辑已切换到新结构。
6. `scripts/x4_data_map_processor.py` 及相关处理链路直接生成新结构，不保留旧结构输出路径。
7. 与 `maps.json` 直接相关的测试、fixture、mock 数据已同步更新，不再混用旧大小写与旧结构。
8. 仓库中不存在仅为兼容旧 `maps.json` 结构而保留的运行时桥接代码。

## 未决项

无。
