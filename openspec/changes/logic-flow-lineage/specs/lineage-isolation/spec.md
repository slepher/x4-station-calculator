## ADDED Requirements

### Requirement: 基于 Module ID 的物理隔离
系统必须使用 `moduleId` 作为规划组内节点的唯一主键。即使产物相同，只要 `moduleId` 不同，它们也应当作为独立的节点存在。

#### Scenario: 不同体系的相同产物并存
- **WHEN** 用户在已有一个“通用船体部件”节点的组中，拖入一个“泰拉迪船体部件”
- **THEN** 系统应当在组内创建第二个独立的节点
- **AND** 两个节点分别显示其对应的模块名称

### Requirement: 血统元数据与递归回溯
每个手动添加的节点必须保存其来源体系（Lineage）。当系统为该节点自动生成上游产线时，必须优先使用父节点的 `lineage` 作为 `findModuleForWare` 的 `race` 参数。

#### Scenario: 自动继承父节点血统
- **WHEN** 一个带有 `industrial_terran` 血统的节点产生上游需求
- **THEN** 自动生成的上游节点也应当默认使用 `industrial_terran` 模块
- **AND** 即使存在通用的同类产物模块，也应当优先匹配泰拉迪/特兰体系的模块

### Requirement: T0 资源强制合并
所有 Tier 0 资源（如矿石、能量电池等）不具备血统属性，在规划组内必须始终合并为同一个资源节点。

#### Scenario: 跨体系 T0 资源合并
- **WHEN** 泰拉迪产线和通用产线都需要“能量电池”
- **THEN** 规划组内只应当出现一个“能量电池”节点
- **AND** 该节点的总需求量应为各方需求之和
