# Dlc Tag Specification

## Purpose
定义数据处理链路中 `dlc_tag` 的语义、生成范围、XML 判定规则，以及从源头实体向派生实体的传播约束。

## Requirements

### Requirement: Introduced-By DLC Tag Semantics
系统 MUST 将 `dlc_tag` 固定定义为实体首次定义来源，而不是最后修改来源。

#### Scenario: 基础层实体使用 `base`
- **前提** 某实体首次定义于对应 XML 的 `base.xml`
- **当** 系统为该实体生成 `dlc_tag`
- **那么** 系统 SHALL 输出 `dlc_tag = "base"`

#### Scenario: DLC 层实体使用 DLC 名称
- **前提** 某实体首次定义于某个 `<dlc-name>.xml`
- **当** 系统为该实体生成 `dlc_tag`
- **那么** 系统 SHALL 输出 `dlc_tag = "<dlc-name>"`

#### Scenario: 修改不改变首次定义来源
- **前提** 某实体已经在更早层中被定义
- **当** 后续 DLC 层只对该实体进行修改
- **那么** 系统 SHALL NOT 改写该实体既有的 `dlc_tag`

### Requirement: XML Shape-Based DLC Resolution
系统 MUST 根据 XML 自身内容判断采用 patch 解析规则还是非 patch 解析规则。

#### Scenario: `<diff>` 根节点按 patch 处理
- **前提** 某 DLC XML 的根节点为 `<diff>`
- **当** 系统解析该 XML
- **那么** 系统 SHALL 将其视为 patch 文件

#### Scenario: 与 `base.xml` 同根节点按非 patch 处理
- **前提** 某 DLC XML 的根节点与对应 `base.xml` 的根节点相同
- **当** 系统解析该 XML
- **那么** 系统 SHALL 将其视为非 patch 的实体集合文件

### Requirement: Ware DLC Tag Resolution
系统 MUST 为 `ware` 实体生成 `dlc_tag`，并正确区分“新增实体”与“修改已有实体”。

#### Scenario: base wares 记为 `base`
- **前提** 某 `ware` 定义出现在 `base.xml` 的 `/wares/ware[@id]`
- **当** 系统扫描 `ware` 定义
- **那么** 系统 SHALL 为该 `ware` 记录 `dlc_tag = "base"`

#### Scenario: 非 patch DLC 顶层 ware 记为对应 DLC
- **前提** 某 DLC XML 为非 patch 形态
- **并且** 其中包含顶层 `/wares/ware[@id]`
- **当** 系统扫描该 DLC 文件
- **那么** 系统 SHALL 将这些首次出现的 `ware` 记为当前 DLC 来源

#### Scenario: 直接 `add sel="/wares"` 记为新增 ware
- **前提** 某 DLC XML 为 patch 形态
- **并且** 存在 `add sel="/wares"` 节点
- **并且** 其下新增 `<ware @id>`
- **当** 系统扫描该 patch
- **那么** 系统 SHALL 将该 `ware` 记为当前 DLC 首次定义

#### Scenario: 打到 `ware` 内部的 patch 只算修改
- **前提** 某 DLC XML 为 patch 形态
- **并且** patch 目标为 `/wares/...` 的下级路径
- **当** 系统扫描该 patch
- **那么** 系统 SHALL 将其视为已有 `ware` 的修改
- **并且** 系统 SHALL NOT 因此改写该 `ware` 的 `dlc_tag`

### Requirement: Cluster DLC Tag Resolution
系统 MUST 为 `cluster` 实体生成 `dlc_tag`，并按来源文件直接判定。

#### Scenario: base cluster 记为 `base`
- **前提** 某 `cluster` 定义出现在 `base.xml`
- **当** 系统扫描 `cluster` 定义
- **那么** 系统 SHALL 为该 `cluster` 记录 `dlc_tag = "base"`

#### Scenario: DLC cluster 直接记为来源 DLC
- **前提** 某 `cluster` 定义出现在某个 `<dlc-name>.xml`
- **并且** 该类 DLC 内容只包含直接新增的 cluster 实体
- **当** 系统扫描该文件
- **那么** 系统 SHALL 为该 `cluster` 记录 `dlc_tag = "<dlc-name>"`

### Requirement: Derived Entity DLC Tag Propagation
系统 MUST 在迁移阶段将 `ware.dlc_tag` 传播到依赖 `ware` 的派生实体。

#### Scenario: module 继承对应 ware 的 `dlc_tag`
- **前提** 某 `module` 在迁移阶段关联到某个 `ware`
- **当** 系统生成该 `module`
- **那么** 系统 SHALL 将对应 `ware.dlc_tag` 写入该 `module`

#### Scenario: ship 与 equipment 继承对应 ware 的 `dlc_tag`
- **前提** 某 `ship` 或 `equipment` 在迁移阶段关联到某个 `ware`
- **当** 系统生成该派生实体
- **那么** 系统 SHALL 将对应 `ware.dlc_tag` 写入该派生实体

#### Scenario: drone、consumable 与 missile 继承对应 ware 的 `dlc_tag`
- **前提** 某 `drone`、`consumable` 或 `missile` 在迁移阶段关联到某个 `ware`
- **当** 系统生成该派生实体
- **那么** 系统 SHALL 将对应 `ware.dlc_tag` 写入该派生实体

### Requirement: DLC Tag Output Scope
系统 MUST 只在本次已确认的输出 JSON 范围内落盘 `dlc_tag`。

#### Scenario: 源头标签落在 wares 与 maps clusters
- **前提** 系统完成 `ware` 与 `cluster` 的首次定义来源判定
- **当** 系统写出源头实体 JSON
- **那么** 系统 SHALL 将 `ware.dlc_tag` 写入 `wares.json`
- **并且** 系统 SHALL 将 `cluster.dlc_tag` 写入 `maps.json` 的 `clusters` 节点

#### Scenario: 派生标签落在六类由 ware 派生的 JSON
- **前提** 系统完成 migration 阶段的 `ware.dlc_tag` 传播
- **当** 系统写出派生实体 JSON
- **那么** 系统 SHALL 将 `dlc_tag` 写入 `modules.json`、`ships.json`、`equipments.json`、`drones.json`、`consumables.json`、`missiles.json`

#### Scenario: 非传播范围 JSON 不新增 `dlc_tag`
- **前提** 系统写出非本次传播范围内的 JSON
- **当** 输出 `bullets.json`、`module_groups.json`、`ship_types.json`、`ship_races.json`、`equipment_types.json`、`slot_tags.json`、`ship_slots.json` 或 `default_maxes.json`
- **那么** 系统 SHALL NOT 因本次 change 为这些文件增加 `dlc_tag`

### Requirement: Dedicated DLC Resolution Module
系统 MUST 将 DLC 判定抽成独立模块供处理链路复用。

#### Scenario: 独立模块负责 XML 语义判定
- **前提** 数据处理链路需要为实体生成 `dlc_tag`
- **当** 系统执行 DLC 判定
- **那么** 系统 SHALL 调用独立的 DLC 判定模块
- **并且** 该模块 SHALL 负责识别 patch / 非 patch XML
- **并且** 该模块 SHALL NOT 以路径查找工具的职责形态存在
