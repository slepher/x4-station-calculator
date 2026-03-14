# Map Resource Calc Specification

## Purpose
定义 region 资源数据提取、group 产额回填、资源聚合，以及基于统一柏林噪声概率模型的模拟密度输出行为。

## ADDED Requirements

### Requirement: Region Definition Extraction
系统 MUST 从 region 定义 XML 中提取后续资源计算所需的 region 级结构化数据。

#### Scenario: 提取 region 级 noise 属性
- **前提** 处理脚本读取 `region_definitions_final.xml`
- **当** 系统解析某个 `<region>`
- **那么** 系统 SHALL 提取 `density`、`rotation`、`noisescale`、`seed`、`minnoisevalue`、`maxnoisevalue`

#### Scenario: 提取 boundary 与 falloff
- **前提** 某个 region 定义包含 `boundary` 与 `falloff`
- **当** 系统迁移该 region
- **那么** 系统 SHALL 保留 `boundary` 结构
- **并且** SHALL 保留 `falloff` 的 `lateral` 与 `radial` step 数据

#### Scenario: 提取 fields
- **前提** 某个 region 定义包含 `fields`
- **当** 系统迁移该 region
- **那么** 系统 SHALL 保留各 field 的对象类型与属性
- **并且** SHALL 仅保留资源分析所需字段

### Requirement: Group Yield Inline Merge
系统 MUST 将资源 field 对应 group 的关键产额信息直接内联到 field。

#### Scenario: 带 groupref 的资源 field 回填 group 数据
- **前提** 某个 field 带有 `groupref`
- **并且** `regionobjectgroups_final.xml` 中存在同名 `<group>`
- **当** 系统迁移该 field
- **那么** 系统 SHALL 回填 `resource`
- **并且** SHALL 回填 `yield`
- **并且** SHALL 回填 `yieldvariation`

#### Scenario: 不建立单独 group catalog
- **前提** 多个 region field 引用相同 `groupref`
- **当** 系统输出 `regions.json`
- **那么** 系统 SHALL 允许重复内联相同 group 的关键字段
- **并且** SHALL NOT 要求单独维护 `group_catalog`

#### Scenario: 忽略 select macro 列表
- **前提** 某个 group 含有多个 `<select macro=\"...\">`
- **当** 系统回填 group 信息
- **那么** 系统 SHALL NOT 将 `select macro` 列表写入 field 输出

### Requirement: Region Resource Aggregation
系统 MUST 在每个 region 下输出按资源类型聚合的 `resources` 摘要。

#### Scenario: 按 ware 聚合 field
- **前提** 某个 region 下存在多个 field
- **并且** 其中多个 field 回填后指向同一 `resource`
- **当** 系统生成 region 聚合结果
- **那么** 系统 SHALL 按 `ware` 聚合这些 field

#### Scenario: 输出累计密度摘要
- **前提** 某个资源在 region 内至少命中一个 field
- **当** 系统生成 `resources`
- **那么** 系统 SHALL 输出该资源的累计密度摘要
- **并且** SHALL 使结果可用于后续排序与比较

#### Scenario: 体积与储量统一按 km³ 口径输出
- **前提** 系统已根据 boundary 与 falloff 得到有效体积
- **当** 系统输出资源聚合结果
- **那么** 系统 SHALL 使用 `km³` 作为体积输出单位
- **并且** SHALL 在储量计算前将 `m³` 体积除以 `10^9`

#### Scenario: 显式输出 noise 覆盖率与密度系数
- **前提** 系统已基于统一噪声模型得到覆盖概率
- **当** 系统输出 field 或 resource 聚合结果
- **那么** 系统 SHALL 显式输出 `noise_coverage`
- **并且** SHALL 保留 `densityfactor` 或聚合后的 `densityfactor_sum` 以支持解释结果

#### Scenario: nebula 多资源拆分聚合
- **前提** 某个 `nebula` field 的 `resources` 同时包含多个气体资源
- **当** 系统生成资源聚合结果
- **那么** 系统 SHALL 将这些资源拆分后分别参与聚合

#### Scenario: 气体资源使用专用常量
- **前提** 某个资源来源于 `nebula`
- **当** 系统计算其模拟密度与储量
- **那么** 系统 SHALL 使用气体专用常量 `K_gas`
- **并且** 当前阶段 SHALL 按 `1000` 处理

### Requirement: Sector Resource Aggregation
系统 MUST 在每个 sector 下输出按资源类型聚合的资源摘要。

#### Scenario: 计算 sector 资源总量
- **前提** 某个 sector 下有多个 region 命中同一 `ware`
- **当** 系统生成 sector 资源聚合结果
- **那么** 系统 SHALL 将这些 region 的该资源总量累计为 sector 总量

#### Scenario: 计算代表矿区密度筛选阈值
- **前提** 某个 sector 的某资源在多个 region 中存在密度值
- **当** 系统生成该资源的代表矿区
- **那么** 系统 SHALL 先找到最高密度矿区
- **并且** SHALL 以该最高密度的 `1/3` 作为筛选阈值

#### Scenario: 代表矿区按密度阈值后再取总量最大
- **前提** 系统已得到某资源的密度筛选阈值
- **当** 系统筛选 sector 内该资源的 region
- **那么** 系统 SHALL 仅保留密度大于等于阈值的矿区作为候选
- **并且** SHALL 在候选矿区中选择总量最大的矿区作为代表矿区

#### Scenario: 输出代表矿区总量与密度
- **前提** 某个 sector 的某资源已经选出代表矿区
- **当** 系统写入 sector 聚合结果
- **那么** 系统 SHALL 输出代表矿区的总量
- **并且** SHALL 输出代表矿区的密度

#### Scenario: 将新聚合直接写入 sector.resources
- **前提** 系统已经生成 sector 级数值资源聚合结果
- **当** 系统写入地图数据产物
- **那么** 系统 SHALL 将聚合结果直接写入 `sector.resources`

#### Scenario: 代表密度驱动 yield 与 level 分档
- **前提** 系统已得到某个 sector 资源的 `representative_density`
- **当** 系统写入 sector 聚合结果
- **那么** 系统 SHALL 输出 `yield` 与 `level`
- **并且** `nividium` SHALL 使用 `0.1 ~ 1000` 的 10 倍对数五档
- **并且** 其他资源 SHALL 使用 `1 ~ 10000` 的 10 倍对数五档
- **并且** 档位名 SHALL 依次为 `low`、`midlow`、`medium`、`midhigh`、`high`

#### Scenario: 额外记录总量最高矿区的密度
- **前提** 某个 sector 的某资源存在总量最高矿区
- **当** 系统写入 sector 聚合结果
- **那么** 系统 SHALL 额外输出总量最高矿区的密度值
- **并且** SHALL 将该字段视为补充信息
- **并且** SHALL NOT 用该字段改写代表矿区选择规则

### Requirement: Simulated Noise Probability Model
系统 MUST 使用统一柏林噪声分布的概率模型计算 noise 相关覆盖率。

#### Scenario: 统一概率模型适配所有区间
- **前提** 系统已构建统一柏林噪声经验分布或经验 CDF
- **当** 系统计算任意 `minnoisevalue/maxnoisevalue` 区间
- **那么** 系统 SHALL 按 `P(min <= noise <= max)` 计算覆盖概率

#### Scenario: 不按 seed 单独查表
- **前提** 不同 region 或 field 具有不同 `seed`
- **当** 系统执行当前版本的模拟密度计算
- **那么** 系统 SHALL 复用统一柏林噪声概率模型
- **并且** SHALL NOT 为每个 `seed` 单独建立概率表

#### Scenario: 标记为模拟近似
- **前提** 系统输出基于统一概率模型的 noise 结果
- **当** 结果写入结构化数据
- **那么** 系统 SHALL 将该结果视为模拟近似
- **并且** SHALL NOT 表述为引擎精确覆盖率

### Requirement: Region Resource Density Output
系统 MUST 结合 field 参数与 noise 概率输出 region 资源模拟密度。

#### Scenario: 使用 field 参数参与密度累计
- **前提** 某个 field 已具备 `densityfactor`、`yield` 与 noise 区间
- **当** 系统计算该 field 的模拟密度贡献
- **那么** 系统 SHALL 使用这些字段参与计算

#### Scenario: 聚合结果可追溯到 field
- **前提** 系统已生成 region 的 `resources` 聚合结果
- **当** 需要追溯某个资源的来源
- **那么** 系统 SHALL 保留足够的 field 级原始参数以支持解释聚合结果

### Requirement: Version Selection Parity With Distiller
系统 MUST 支持按版本选择数据处理范围，并允许一次处理所有配置版本。

#### Scenario: 默认处理当前配置版本
- **前提** 用户未提供版本选择参数
- **当** 系统运行数据处理脚本
- **那么** 系统 SHALL 处理配置中的当前版本

#### Scenario: 处理指定版本
- **前提** 用户提供 `--version`
- **当** 系统运行数据处理脚本
- **那么** 系统 SHALL 仅处理匹配的目标版本
- **并且** 当存在 beta/stable 歧义时 SHALL 要求通过 `--beta` 或 `--stable` 消除歧义

#### Scenario: 处理所有版本
- **前提** 用户提供 `--all-versions`
- **当** 系统运行数据处理脚本
- **那么** 系统 SHALL 依次处理配置中的所有版本
- **并且** SHALL 将每个版本的数据写入其各自 `folder_name` 对应目录
