# dlc-tag 设计说明

## 设计目标
为数据处理链路增加一套最小可用的 DLC 首次定义标记机制，先覆盖 `ware` 与 `cluster` 两类源头实体，并保证后续所有由 `ware` 派生的运行时实体都可以通过迁移链路继承 `ware.dlc_tag`。
设计重点是将“文件分层产出”与“业务实体归属判断”分离，避免 distiller 与 processor 对同一语义重复建模。

## 1. 分层设计

### 1.1 distiller 职责
- `distiller` 继续只负责产出分层文件结构：
  - `base.xml`
  - `<dlc-name>.xml`
  - `final.xml`
- `distiller` 不直接判断实体首次定义来源。
- `distiller` 不直接写业务层 `dlc_tag`。

### 1.2 processor 职责
- `processor` 负责理解 XML 语义并判断实体是否首次定义于某一层。
- `processor` 为两类源头实体直接生成 `dlc_tag`：
  - `ware`
  - `cluster`
- `processor` 不从 `final.xml` 倒推来源，而是直接读取 `base.xml` 与各 `<dlc-name>.xml`。

### 1.3 migration 职责
- migration 只消费 `processor` 已生成的 `dlc_tag`。
- migration 不重新解析 XML 判断归属。
- migration 负责将 `ware.dlc_tag` 传递到：
  - `module`
  - `ship`
  - `equipment`
  - `drone`
  - `consumable`
  - `missile`

## 2. DLC 判定模块设计

### 2.1 模块定位
- DLC 判定逻辑抽成独立模块，对外导出可复用函数。
- 该模块的职责是：
  - 识别 XML 是 patch 还是非 patch
  - 从 XML 中提取首次定义的实体 key
  - 返回实体到 `dlc_tag` 的映射或单实体判定结果
- 该模块不是路径工具，不采用 `get_xml_path(data)` 这类命名或职责。

### 2.2 XML 形态识别
- 根节点为 `<diff>` 时，按 patch XML 处理。
- 根节点与 `base.xml` 根节点相同的 XML，按非 patch 实体集合处理。
- 当前设计只要求支持这两类形态。

### 2.3 抽象方式
- 模块内部采用“实体规格 + XML 形态识别”的通用框架。
- 规格至少包含：
  - 实体容器路径
  - 实体标签
  - 主键字段
- `ware` 与 `cluster` 共用框架，但使用不同规格与不同解析分支。

## 3. `ware` 判定设计

### 3.1 基础层扫描
- 先扫描 `wares/base.xml` 中的 `/wares/ware[@id]`。
- 每个 `ware/@id` 初始记为 `dlc_tag = "base"`。

### 3.2 非 patch DLC 扫描
- 若某个 DLC `wares` 文件与 `base.xml` 同根节点，则按实体集合处理。
- 顶层 `/wares/ware[@id]` 中首次出现的实体，记为当前 DLC 的 `dlc_tag`。

### 3.3 patch DLC 扫描
- 若某个 DLC `wares` 文件根节点为 `<diff>`，则按 patch 规则处理。
- 只认“直接加到实体容器”的新增为首次定义：
  - `add sel="/wares"` 下的 `<ware @id>`
- 以下 patch 都视为修改已有实体，不改变 `dlc_tag`：
  - `add sel="/wares/..."`
  - `replace sel="/wares/..."`
  - `remove sel="/wares/..."`

### 3.4 首次定义优先
- `ware` 一旦在某层首次出现并记录 `dlc_tag`，后续层只允许修改内容，不允许覆盖该值。

## 4. `cluster` 判定设计

### 4.1 直接来源判定
- `cluster` 的 DLC 内容均为直接添加实体，不需要引入复杂 patch 语义判断。
- 因此 `cluster.dlc_tag` 可直接按来源文件层确定：
  - `base.xml` 中的 cluster → `base`
  - `<dlc-name>.xml` 中的 cluster → `<dlc-name>`

### 4.2 主键复用
- `cluster` 的唯一标识应直接复用现有 map processor 已采用的稳定主键。
- 本次设计不额外引入新的 cluster 识别字段，以减少迁移对齐风险。

## 5. 数据传播设计

### 5.1 源头实体输出
- `ware` 输出 `dlc_tag: string`
- `cluster` 输出 `dlc_tag: string`
- 取值统一使用单值字符串，不设计数组或来源集合。
- `ware.dlc_tag` 落在 `wares.json`。
- `cluster.dlc_tag` 落在 `maps.json` 的 `clusters` 节点中，不新增独立 `clusters.json`。

### 5.2 派生实体继承
- `module` 的 `dlc_tag` 来自关联 `ware`
- `ship` 的 `dlc_tag` 来自关联 `ware`
- `equipment` 的 `dlc_tag` 来自关联 `ware`
- `drone` 的 `dlc_tag` 来自关联 `ware`
- `consumable` 的 `dlc_tag` 来自关联 `ware`
- `missile` 的 `dlc_tag` 来自关联 `ware`
- 这样可以将 DLC 语义集中在两类源头实体上，避免各派生实体重复做 XML 来源解析。

### 5.3 本次涉及的 JSON 文件
- 直接生成源头标签的文件：
  - `wares.json`
  - `maps.json`（cluster 节点）
- 继承 `ware.dlc_tag` 的文件：
  - `modules.json`
  - `ships.json`
  - `equipments.json`
  - `drones.json`
  - `consumables.json`
  - `missiles.json`
- 明确不纳入本次传播范围的文件：
  - `bullets.json`
  - `module_groups.json`
  - `ship_types.json`
  - `ship_races.json`
  - `equipment_types.json`
  - `slot_tags.json`
  - `ship_slots.json`
  - `default_maxes.json`

## 6. 风险与对策

- 风险：`ware` patch 的 `sel` 规则覆盖不全，导致把修改误判为新增。
  - 对策：先将“新增”严格限制在 `add sel="/wares"`，其余 `/wares/...` 路径一律按修改处理。
- 风险：不同实体类型自行发散实现 DLC 判定。
  - 对策：统一由独立 DLC 判定模块输出，processor 与 migration 只消费结果。
- 风险：后续新增实体类型时复用困难。
  - 对策：判定模块基于“实体规格 + XML 形态识别”实现，保留扩展空间。
