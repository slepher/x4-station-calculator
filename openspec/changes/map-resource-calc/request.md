# map-resource-calc 需求说明

## 目标
为 X4 地图资源数据增加一套可离线计算的 region 资源模型，将 `region_definitions_final.xml` 与 `regionobjectgroups_final.xml` 中的有效字段迁移到 `regions.json`。
新模型需要保留后续资源分析所需的几何、falloff、field 与 group 产额信息，并在每个 region 下输出按资源聚合的 `resources` 摘要。
本次仅要求提供稳定的模拟密度数据，不追求逐 region 精确复刻游戏引擎内部噪声覆盖结果。

## 已确认方案（审核重点）

### 1. region JSON 提取范围
- `regions.json` 不再只保留地图挂载关系与离散 yield 信息，而是补充 region 定义中的有效数据。
- 每个 region 需要保留：
  - region 级属性：`density`、`rotation`、`noisescale`、`seed`、`minnoisevalue`、`maxnoisevalue`
  - `boundary`
  - `falloff`
  - `fields`
- `fields` 中保留资源分析必需字段，不保留无明确用途的 `select macro` 列表。

### 2. group 产额信息内联
- 对所有带 `groupref` 的资源 field，从 `regionobjectgroups_final.xml` 回填：
  - `resource`
  - `yield`
  - `yieldvariation`
- 不单独建立 `group_catalog` 文件或独立节点，直接内联到 field。
- 可接受同一 `groupref` 在多个 region 中重复出现，因为数据量不大。

### 3. resources 聚合层
- 在每个 region 下新增 `resources` 字段，按该空间内每种资源聚合 field 数据。
- `resources` 至少按 `ware` 聚合，并累计同资源 field 的密度贡献。
- 聚合目标是生成可排序、可比较的模拟密度结果，而不是引擎真实库存值。
- `nebula` 的 `resources` 允许一次包含多个气体资源，例如 `methane hydrogen helium`，需要拆分为多种资源分别参与聚合。

### 4. sector 聚合层
- 除 `region -> resources` 外，还需要继续聚合到 `sector -> resources`。
- 每个 sector 的每种资源都需要至少计算：
  - 该资源在 sector 内所有矿区的总量
  - 最高密度矿区的密度
  - 最高密度的 `1/3` 作为代表矿区筛选阈值
  - 通过该密度阈值筛出的矿区中，总量最大的代表矿区
  - 代表矿区的总量与密度
  - “总量最高矿区”的密度值作为独立补充字段
- “总量最高矿区”的密度字段仅用于补充展示或分析，不改变代表矿区的筛选规则。
- sector 输出继续使用 `resources` 字段名，不再使用 `resource_stats`。
- `yield` 与 `level` 需要重新输出，并按代表密度做固定对数分档：
  - `nividium`：`0.1 ~ 1000` 按 10 倍步进分 5 档
  - 其他资源：`1 ~ 10000` 按 10 倍步进分 5 档
  - 档位名依次为 `low`、`midlow`、`medium`、`midhigh`、`high`

### 5. noise 模型
- noise 相关密度不采用逐 region 重采样的高成本方案。
- 采用统一柏林噪声分布的概率模型，仅计算噪声值落入阈值区间的概率。
- 由于当前目标是模拟数据，不要求按不同 `seed` 分别建立覆盖表。
- `noise coverage` 计算口径为：
  - 先基于统一柏林噪声生成经验分布或经验 CDF
  - 再按 `P(min <= noise <= max)` 计算每个区间的覆盖概率
- 该结果作为模拟密度的一部分使用，并明确属于近似模型。

### 5.1 气体资源临时常量
- 气体资源的专用常量 `K_gas` 当前阶段固定按 `1000` 处理。
- 后续若拿到更可靠的游戏内标定值，再整体替换。

### 6. 密度与体积输出
- region 层应输出几何相关信息，至少支持后续计算体积。
- 体积相关输出统一使用 `km³` 口径，而不是 `m³`。
- 若底层几何计算得到 `m³`，则写入储量前必须先除以 `10^9`。
- 资源密度应区分：
  - field 原始参数
  - 按资源聚合后的模拟密度
- `noise_coverage` 需要作为显式字段保留在 JSON 中，不能只隐含在最终结果里。
- `densityfactor` 也需要保留可追溯字段，而不是只体现在累计结果中。
- sector 层应同时区分：
  - 资源总量
  - 代表矿区的总量与密度
  - 总量最高矿区的密度补充字段
- 本次 change 聚焦“提取 + 聚合 + 轻量概率模型”，不要求完整复刻所有引擎内部刷新逻辑。

### 7. 多版本处理能力
- 数据处理脚本需要与 distiller 保持一致的版本选择能力。
- 默认处理当前配置版本。
- 支持通过 `--version` 配合 `--beta / --stable` 处理指定版本。
- 支持通过 `--all-versions` 一次处理配置中的全部版本。
- 各版本输出必须仍按各自 `folder_name` 写回对应目录。

## 边界

### In Scope
- 解析 `region_definitions_final.xml` 的 region 级属性、boundary、falloff、fields。
- 解析 `regionobjectgroups_final.xml` 并回填 `resource/yield/yieldvariation`。
- 为 `regions.json` 增加 region 详细结构与 `resources` 聚合层。
- 为 sector 增加按资源聚合的总量、代表矿区与补充密度字段。
- 引入统一柏林噪声经验分布或经验 CDF 的近似计算口径。
- 产出适合后续体积与资源排序分析的模拟密度字段。
- 为数据处理脚本增加当前版本 / 指定版本 / 所有版本的处理入口。

### Out of Scope
- 精确复刻 X4 引擎内部实际噪声实现与逐 region 覆盖率。
- 为不同 `seed`、不同 region 单独做高成本实时采样。
- 改造前端地图 UI。
- 修改运行时资源筛选逻辑。

## 验收标准（DoD）
- `regions.json` 中每个 region 都包含 region 级 noise 属性、`boundary`、`falloff` 与 `fields`。
- 带 `groupref` 的资源 field 都已内联 `resource`、`yield`、`yieldvariation`。
- `fields` 不包含无明确用途的 `select macro` 数组。
- 每个 region 都新增 `resources` 聚合字段，并按 `ware` 输出累计结果。
- 每个 sector 都新增按 `ware` 聚合的资源摘要。
- sector 资源摘要能够输出该资源总量、代表矿区总量、代表矿区密度，以及总量最高矿区的密度字段。
- sector 代表矿区按“最高密度下探到 `1/3` 后，在达标矿区中选总量最大者”的规则产生。
- noise 密度采用统一柏林噪声概率模型计算，不按每个 `seed` 单独查表。
- 文档中明确该 noise 结果为模拟近似，不宣称精确还原游戏底层。
- 数据处理脚本支持像 distiller 一样处理单个目标版本或所有版本。

## 未决项
无。
