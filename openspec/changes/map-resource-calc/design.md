# map-resource-calc 设计说明

## 设计目标
为地图资源数据处理链路补充 region 级详细结构，让 `regions.json` 同时承担“原始有效数据缓存”和“模拟资源密度摘要”的职责。
设计重点不是完全复刻引擎，而是用低成本、可解释的方式构建可比较的资源模型，支撑后续体积、丰度与资源分布分析。

## 1. 数据结构设计

### 1.1 region 主体
- 每个 region 保留以下层次：
  - region 级属性：`density`、`rotation`、`noisescale`、`seed`、`minnoisevalue`、`maxnoisevalue`
  - `boundary`
  - `falloff`
  - `fields`
  - `resources`
- 其中 `fields` 用于承载原子级分析参数，`resources` 用于承载按资源聚合后的摘要结果。

### 1.2 field 结构
- `fields` 中每个对象保留：
  - 对象类型，如 `asteroid`、`debris`
  - 自身属性，如 `densityfactor`、`rotation`、`rotationvariation`、`noisescale`、`seed`、`minnoisevalue`、`maxnoisevalue`
  - `groupref`
  - 从 group 内联回填的 `resource`、`yield`、`yieldvariation`
- `select macro` 不进入输出结构，因为当前资源密度模型不使用该信息。
- `nebula.resources` 若为以空格分隔的多资源字符串，需要拆成资源数组逐个参与聚合。

### 1.3 resources 聚合结构
- `resources` 以每个 `ware` 为一条聚合记录。
- 每条记录至少需要表达：
  - `ware`
  - 该资源由多少 field 构成
  - 按当前模型累计得到的模拟密度结果
- 如需解释性更强，可同时保留若干累计中间量，例如原始 field 数、累计 `densityfactor` 或累计 `yield` 权重。

### 1.4 sector resources 聚合结构
- 在 sector 层继续按 `ware` 聚合 region 资源结果。
- 每条 sector 资源记录至少表达：
  - `ware`
  - `total_amount`
  - `max_density`
  - `representative_amount`
  - `representative_density`
  - `max_amount_region_density`
- sector 聚合结果直接写入 `resources`。
- 每条 sector 资源记录额外输出：
  - `yield`
  - `level`
- 其中 `yield/level` 基于 `representative_density` 分档。
- 其中：
  - `representative_*` 来自“最高密度下探到 `1/3` 后仍达标的矿区中，总量最大的那片”
  - `max_amount_region_density` 只是“总量最高矿区”的密度补充字段，不参与代表矿区选择

## 2. 数据来源与合并方式

### 2.1 region 定义来源
- `region_definitions_final.xml` 提供 region 主体结构：
  - region 级 noise 参数
  - `boundary`
  - `falloff`
  - `fields`
- 该文件是 `regions.json` 的主要结构来源。

### 2.2 group 产额来源
- `regionobjectgroups_final.xml` 仅作为 field 补充来源使用。
- 处理时先建立 `group name -> {resource, yield, yieldvariation}` 的最小索引。
- 再在遍历 region `fields` 时，根据 `groupref` 将产额字段直接 merge 到当前 field。
- 由于数据量不大，接受重复内联，不做共享 catalog。

### 2.3 多版本处理入口
- `x4_data_processor.py` 与 `x4_data_map_processor.py` 都需要支持：
  - 默认处理配置当前版本
  - `--version <x.y>` 处理指定版本
  - `--beta / --stable` 选择版本风味
  - `--all-versions` 处理配置中的全部版本
- 版本选择逻辑不应在多个脚本中各自手写，应抽到共享辅助模块中复用。
- 运行时按目标版本动态切换输入输出根目录，保证每个 `folder_name` 仍写回各自目录。
- 对现有脚本，优先采用“共享版本解析 + 运行时重设全局路径”的方式，以控制改动范围。

## 3. noise 模型设计

### 3.1 为什么不做逐 region 精算
- 当前目标是得到稳定、便宜、可比较的模拟数据，而不是复刻引擎空间细节。
- 若按每个 region、每个 field、每个 `seed` 独立采样，计算量与复杂度都会显著上升。
- 对当前需求而言，只需要“统一概率意义上的 noise 覆盖率”即可支撑资源密度比较。

### 3.2 统一柏林噪声概率模型
- 先基于统一参数的柏林噪声生成经验分布，或进一步生成经验 CDF。
- 对任意 noise 区间，覆盖率按以下口径求得：
  - `coverage = P(min <= noise <= max)`
  - 若使用经验 CDF，则为 `CDF(max) - CDF(min)`
- 该模型默认不按不同 `seed` 拆分查表，因为当前只关心总体概率，不关心小区域空间相位差异。

### 3.3 近似边界
- 该模型只表达“统一噪声分布下，该阈值区间大致覆盖多少概率质量”。
- 它不保证等同于具体某个有限 region 内的实际团块覆盖率。
- 因此输出中应明确属于模拟近似，不应表述为真实引擎结果。

## 4. 模拟密度聚合设计

### 4.1 field 级贡献
- 单个 field 的贡献由以下信息构成：
  - `densityfactor`
  - `yield`
  - field noise 区间对应的概率覆盖率
- 若后续需要再叠加 region 级 noise 概率，也应保持该阶段与 field 聚合阶段分离，避免公式耦合死。

### 4.2 resource 级累计
- 同一 region 内，所有同 `resource` 的 field 贡献累计后写入 `resources`。
- 聚合后的结果主要用于：
  - 比较 region 内各资源的相对密度
  - 为地图资源分析或排序提供稳定输入
- 本阶段不把结果定义为“真实总量”或“可开采库存”。
- 体积口径统一输出为 `volume_km3`。
- `amount` 基于 `km³` 体积计算，即几何体积若先按 `m³` 求得，需先转换为 `km³`。
- `noise_coverage` 作为显式结果保留在 field 与 resource 聚合层。
- `densityfactor_sum` 作为聚合解释字段保留在 resource 层。
- 对 `nebula` 气体资源：
  - 不走固体 `yield` 公式
  - 使用 `region_density * (uniformdensity + localdensity * 0.5 * noise_coverage) * K_gas`
  - 当前 `K_gas = 1000`
  - 同时额外输出 `probe_density`

### 4.3 sector 级代表矿区选择
- 对每个 `sector + ware`：
  - 先累计所有 region 的该资源总量，得到 `total_amount`
  - 再找出该资源在这些 region 中的 `max_density`
  - 计算 `density_threshold = max_density / 3`
  - 仅保留 `density >= density_threshold` 的矿区
  - 在这些候选矿区中选择 `amount` 最大者作为代表矿区
- 输出代表矿区的：
  - `representative_amount`
  - `representative_density`
- 另行输出 `max_amount_region_density`：
  - 它表示单纯按总量比较时，最大矿区自身的密度
  - 它不改变上面的代表矿区筛选逻辑

## 5. 风险与对策

- 风险：`regions.json` 结构变重，旧消费方可能只依赖原有平铺字段。
  - 对策：保持现有 region 挂载语义不丢失，在新增详细字段时避免破坏必要标识字段。
- 风险：不同 XML 中的数值格式不统一，例如 `0`、`0.0`、`0.00`。
  - 对策：处理脚本统一做数值归一化，再参与 noise 区间统计与聚合。
- 风险：统一柏林噪声模型被误解为游戏真实算法。
  - 对策：在设计与字段命名上明确标注 `estimated`、`simulated`、`coverage probability` 等近似语义。
- 风险：sector 代表矿区与总量最高矿区不是同一片，使用方容易混淆。
  - 对策：字段命名明确区分 `representative_*` 与 `max_amount_region_density`，并在文档中说明后者只是补充字段。
- 风险：后续若要引入更精细模型，现有结构可能不够扩展。
  - 对策：保留 field 级原始 noise 参数、group 产额参数与 region 级 geometry/falloff，为后续升级留下空间。
