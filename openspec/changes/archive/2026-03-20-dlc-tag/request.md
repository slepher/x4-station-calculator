# dlc-tag 需求说明

## 目标
为 X4 数据处理链路引入统一的 `dlc_tag` 字段，用于标记实体首次定义所属的 DLC 层。
本次 change 先覆盖 `ware` 与 `cluster` 两类源头实体，并在迁移阶段将 `ware.dlc_tag` 传递给由 `ware` 派生出的运行时实体。

## 已确认方案（审核重点）

### 1. `dlc_tag` 语义
- `dlc_tag` 的语义固定为 `introduced_by`，即实体首次被定义出来的来源层。
- 不采用“最后修改来源”或“最终覆盖来源”语义。
- 字段类型固定为单值字符串：`dlc_tag: string`。

### 2. 分层职责
- `distiller` 不直接生成 `dlc_tag`。
- `distiller` 继续负责产出可比较的分层文件结构：`base.xml`、`<dlc-name>.xml`、`final.xml`。
- `processor` 负责根据 XML 内容判断实体是否首次定义于某一层，并生成 `dlc_tag`。
- 迁移阶段不重新判断 DLC 归属，只消费 `processor` 已生成的 `dlc_tag`。

### 3. XML 判定方式
- DLC 判定模块需要根据 XML 自身内容判断文件类型，而不是依赖外部显式传参。
- 根节点为 `<diff>` 的 XML 视为 patch 文件。
- 根节点与对应 `base.xml` 根节点相同的 XML 视为非 patch 的实体集合文件。
- 暂不要求为其他根节点形态提供通用判定逻辑。

### 4. `ware.dlc_tag` 生成规则
- `base.xml` 中 `/wares/ware[@id]` 定义的实体，`dlc_tag = "base"`。
- 对于非 patch DLC 文件，顶层同级的 `/wares/ware[@id]` 视为该 DLC 新增实体，`dlc_tag = "<dlc-name>"`。
- 对于 patch DLC 文件，只认“直接新增到实体容器”的 patch 为新增实体：
  - `add sel="/wares"` 下新增的 `<ware>` 视为首次定义。
- 对于 patch DLC 文件，打到实体内部路径的 patch 一律视为修改，不改变 `introduced_by`：
  - 例如 `add sel="/wares/..."`、`replace sel="/wares/..."`、`remove sel="/wares/..."`。

### 5. `cluster.dlc_tag` 生成规则
- `cluster` 的 DLC 内容均为直接新增实体，不需要解析复杂 patch 语义。
- `base.xml` 中已有的 cluster，`dlc_tag = "base"`。
- 各 `<dlc-name>.xml` 中直接添加的 cluster，`dlc_tag = "<dlc-name>"`。

### 6. 传播规则
- 本次只要求 `processor` 直接生成两类源头标签：
  - `ware.dlc_tag`
  - `cluster.dlc_tag`
- 迁移阶段根据 `ware.dlc_tag` 为以下派生实体赋值：
  - `module`
  - `ship`
  - `equipment`
  - `drone`
  - `consumable`
  - `missile`
- 本次不要求这些派生实体自行重新解析 XML 决定 DLC 归属。

### 7. 需要落盘的 JSON 范围
- `ware.dlc_tag` 直接落在 `wares.json`。
- `cluster.dlc_tag` 直接落在 `maps.json` 的 `clusters` 节点中，不单独新增 `clusters.json`。
- 迁移继承后的 `dlc_tag` 需要落在以下 JSON：
  - `modules.json`
  - `ships.json`
  - `equipments.json`
  - `drones.json`
  - `consumables.json`
  - `missiles.json`
- 本次不要求为以下 JSON 增加 `dlc_tag`：
  - `bullets.json`
  - `module_groups.json`
  - `ship_types.json`
  - `ship_races.json`
  - `equipment_types.json`
  - `slot_tags.json`
  - `ship_slots.json`
  - `default_maxes.json`

### 8. 模块化要求
- DLC 判定逻辑需要抽成独立模块并导出函数，供处理链路复用。
- 该模块的职责是根据 XML 内容识别 patch / 非 patch，并据此提取实体的首次定义来源。
- 该模块不负责路径查找，不以 `get_xml_path(data)` 这类路径工具语义命名。

## 边界

### In Scope
- 为 `ware` 生成 `dlc_tag`。
- 为 `cluster` 生成 `dlc_tag`。
- 在迁移阶段将 `ware.dlc_tag` 传递到 `module`、`ship`、`equipment`、`drone`、`consumable`、`missile`。
- 抽出独立的 DLC 判定模块。
- 基于 `base.xml` 与各 `<dlc-name>.xml` 内容进行判定。

### Out of Scope
- 为所有实体类型直接实现独立的 DLC 判定逻辑。
- 将 `dlc_tag` 直接写入 distiller 输出。
- 设计多值 `dlc_tags` 或来源集合结构。
- 将 `dlc_tag` 语义扩展为“最后修改来源”。

## 验收标准（DoD）
- 数据处理链路能为 `ware` 输出稳定的 `dlc_tag: string`。
- 数据处理链路能为 `cluster` 输出稳定的 `dlc_tag: string`。
- `ware` 的 `dlc_tag` 按“首次定义来源”判定，而不是按最后修改来源判定。
- `cluster` 的 `dlc_tag` 按来源文件直接判定。
- DLC 判定模块能够根据 XML 根节点识别 patch / 非 patch 两类输入。
- 对于 `ware` patch，只有直接 `add sel="/wares"` 的新增实体会引入新的 `dlc_tag`。
- 打到 `ware` 下级路径的 patch 不会改变已有实体的 `dlc_tag`。
- `wares.json` 中的 `ware` 包含稳定的 `dlc_tag: string`。
- `maps.json` 中的 `clusters` 节点包含稳定的 `dlc_tag: string`。
- 迁移后的 `modules.json`、`ships.json`、`equipments.json`、`drones.json`、`consumables.json`、`missiles.json` 能继承对应 `ware.dlc_tag`。

## 未决项
无。
