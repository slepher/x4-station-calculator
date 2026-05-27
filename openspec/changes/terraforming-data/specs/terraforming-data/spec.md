# terraforming-data Specification

## ADDED Requirements

### Requirement: 解析改造属性定义

**前提** 存在 `libraries/terraforming/final.xml` 文件

**当** 运行 terraforming 数据解析模块

**那么** 输出 `stats` 数组，每个元素包含:
- `id`: 属性标识符
- `nameId`: 多语言文本引用
- `default`: 默认值
- `dynamic`: 是否为动态属性
- `icon`: UI 图标引用
- `inactiveTextId`: 非活跃时文本引用
- `ranges`: 数值区间数组, 每个区间含 `start`, `end`, `state`, `habitable`, `rgb`, `descriptionId`

**并且** 动态属性在 ranges 中包含 `state=0` 的隐藏区间

**并且** `ranges` 足以唯一确定任意 value 所对应的 state 与颜色

### Requirement: 解析项目分组

**前提** 存在 `libraries/terraforming/final.xml` 文件

**当** 运行 terraforming 数据解析模块

**那么** 输出 `projectGroups` 数组, 每个含 `id` 和 `nameId`

### Requirement: 解析项目定义

**前提** 存在 `libraries/terraforming/final.xml` 文件

**当** 运行 terraforming 数据解析模块

**那么** 输出 `projects` 数组, 每个含:
- `id`, `group`, `nameId`, `descriptionId`
- `duration` (秒, null=无时长)
- `repeatCooldown` (null=一次性, 0=可无限重复, >0=冷却秒数)
- `resilient`, `chance`, `version`, `research`
- `conditions`, `effects`, `sideEffects`
- `resources` (`{ price, pricescale?, payout?, minWares?, maxWares?, maxPrice?, scale, wares: [{ware, amount, actualAmount?, nameId?}] }`)
- `deliveries` (`[{ macro, amount, buildDuration, nameId? }]`)
- `rebates` (`[{ ware?, wareGroup?, value }]`)
- `removedProjects`, `blockedProjects`, `blockedGroups`
- `predecessors` (`[{ ref, type: "project"|"group", any }]`)

**并且** `conditions[]` 中保留原始 `min/max/minvalue/maxvalue`

**并且** 对每个 condition 标记其是 state 语义还是 value 语义

### Requirement: condition state/value 语义保留

**前提** X4 terraforming XSD 定义 `condition.min/max` 为 state 边界、`condition.minvalue/maxvalue` 为真实 value 边界

**当** 运行 terraforming 数据解析模块

**那么** 输出数据必须保留这两套语义的区别

**并且** 消费方无需重新猜测 `min/max` 究竟表示 state 还是 value

### Requirement: 全局 predecessor 收集

**前提** 存在 `md/terraforming/final.xml` 文件

**当** 运行 terraforming 数据解析模块

**那么** 扫描全文件所有 `add_terraforming_project` 元素 (含 library 定义中的)

**并且** 提取其 `<predecessors>` 到 predecessors_map

**并且** 全局结果与 cluster 局部解析结果合并

### Requirement: 解析星球初始化配置

**前提** 存在 `md/terraforming/final.xml` 文件

**当** 运行 terraforming 数据解析模块

**那么** 输出 `clusters` 数组, 每个含:
- `id`, `macro`, `partName`
- `initialStats`: 初始属性值
- `projectIds`: 项目 ID 列表
- `removedStats`: 被 mission cue 或 patch 显式移除的 stat 列表
- `values`: MD `set_value` 捕获的已知数值 (如 housing target)
- `variableTexts`: `substitute_text` 运行时变量映射
- `objectives`: 任务目标列表 `[{ step, action, textId, encyclopedia?, textReplaces? }]`

**并且** `values` 中保留会影响运行时推导的 cluster 级参数，例如 `$AddedAtmoPressureTable.*`、`$GlobalWarmingLimitTable.*` 与各类 `Ignore*`

### Requirement: 保留 cluster 级运行时调参

**前提** cluster 通过 `set_value` 或 library 参数传入 terraforming 调参

**当** 运行 terraforming 数据解析模块

**那么** 输出数据必须保留消费方重建运行时规则所需的 cluster 级调参

**并且** 至少包括：
- `Ignore*` 系列开关
- `removedStats`
- `$AddedAtmoPressureTable.*`
- `$GlobalWarmingLimitTable.*`

**并且** 消费方无需重新扫描原始 MD XML 才能得知这些规则

### Requirement: 暴露空气压力派生语义

**前提** 游戏中的 `airpressure` 不是单纯持久化输入，而是由大气成分与 cluster 补正共同派生

**当** 运行 terraforming 数据解析模块

**那么** 输出数据必须保留消费方重建 `airpressure` 所需的语义

**并且** 消费方能够基于气体总量每满四格增加一档贡献的语义，重建当前运行时空气压力

### Requirement: 暴露 stat 删除语义

**前提** 某些 terraforming cluster 会在 cue 或 patch 中调用 `remove_terraforming_stat`

**当** 运行 terraforming 数据解析模块

**那么** 输出数据必须保留这些被删除的 stat

**并且** 消费方能够把它们视为“不存在的 stat”

**并且** 这些 stat 不得继续参与派生计算、动态项目池、条件显示和可用性判定

### Requirement: 暴露温室效应事件语义

**前提** 游戏中的 `evt_globalwarming_*` 由 `SetupStatDependentProjects` 通用事件规则注入

**当** 运行 terraforming 数据解析模块

**那么** 输出数据必须保留消费方命中这些通用动态事件所需的语义

**并且** 甲烷 / 二氧化碳命中 helper 条件时，相关 warming event 必须进入 cluster 初始项目集合或运行时动态项目池规则

**并且** 消费方应通过通用 event/project 命中逻辑处理这些 warming event，而不是要求单独硬编码温度回推

### Requirement: 暴露动态项目池规则

**前提** `SetupStatDependentProjects` 中的若干项目与事件存在性依赖当前 stat，而非仅依赖初始值

**当** 运行 terraforming 数据解析模块

**那么** 输出数据必须保留消费方重建动态项目池所需的阈值与 ignore gating 语义

**并且** 消费方能够在 stat 变化后重新决定某项目或事件应出现还是移除

### Requirement: 任务目标提取

**前提** cluster cue 的 create_offer/update_mission 含 briefing

**当** 解析时遇到 `<objective>` 元素

**那么** 提取 step, action, textId, encyclopedia, completedVariable

**并且** 优先取 update_mission 的 objective (更完整)

### Requirement: 变量文本解析

**前提** cluster cue 含 `<substitute_text>` 元素

**当** 后处理 objectives

**那么** `$Variable` textId 解析为 `{page,id}` 源模板

**并且** `$Cluster_X.knownname` 从 maps.json 解析为星区/sector 的 nameId

**并且** `$HQName` 解析为 `{20102,2011}` (默认总部名)

**并且** `$Terraforming_X_HousingTargetAmount` 等已知数值从 cluster.values 解析

**并且** 结果存入 objective 的 `textReplaces`

### Requirement: 星区名称解析

**前提** maps.json 存在且含 clusters/sectors 数据

**当** 解析 `$LOCATION$` → `$Cluster_X.knownname` 时

**那么** 从 macro 查 maps.json:
- 多 sector cluster → 取 cluster 的 nameId
- 单 sector cluster → 取唯一 sector 的 nameId

### Requirement: 集成到数据处理器

**前提** `x4_data_processor.py` 正常运行

**当** `run_for_config()` 被调用

**那么** terraforming 解析在 `extract_and_resolve_languages()` 之后执行

**并且** 解析结果中的 nameId/descriptionId 加入 `needed_raw_names`

**当** `save()` 被调用

**那么** `data/terraforming.json` 被输出

**并且** name/description 字段已注入英文翻译

### Requirement: 任务推理引擎

**前提** `terraforming.json` 数据存在

**当** 调用 `resolveAvailableTasks(cluster, state, data)`

**那么** 返回分组依赖树, 含可用/阻塞项目

**并且** 条件检查: stat min/max 约束

**并且** 前置检查: type=project 未完成 → 阻塞; type=group → 仅标注, 不阻塞

**并且** 任务推理所使用的 stat 必须允许接入派生后的运行时值，而不局限于 `initialStats + project effects`

### Requirement: CLI 参数解析

**前提** `analysis/scripts/terraforming/terraforming.ts` 可执行

**当** `--planet=ScalePlateGreen`

**那么** 加载 `terraforming.json` + `locales/<lang>.json`, 定位 cluster

**并且** `--temperature=N` 等参数覆盖当前状态

**并且** `--completed=ids` 解析为已完成项目集

**并且** `--list-planets` 列出所有候选星球及其初始 stats

**并且** `--lang=zh-CN` 控制界面语言, 默认 zh-CN

### Requirement: 任务列表输出

**前提** CLI 参数已解析

**当** 调用推理引擎

**那么** 输出按 projectGroups 原始顺序分组, 每项含: 中文名, 效果摘要, 重复性标签 `[一次性]/[可重复]/[冷却:Ns]`, 阻塞标记 `[BLOCKED]`

**并且** 依赖关系标注: `⟸` / `⟸ 任一:` + 解析后的项目/组名

**并且** 阻塞原因用中文显示

**并且** 顶部显示任务目标, 含 step/action/中文文本 (replaces 已填充)

### Requirement: 文本引用收集

**前提** 解析过程中遇到文本引用

**当** 从 XML 提取 nameId/descriptionId/textId

**那么** 所有引用保持原格式存储

**并且** 加入 `loader.needed_raw_names`

**并且** 经 `inject_english_names()` 管线注入翻译后的 name 字段

### Requirement: 资源实际消耗量计算

**前提** `wares.json` 中每个 ware 有 `maxPrice` 字段

**当** 运行 terraforming 数据解析模块

**那么** `resources.wares[].actualAmount` 输出游戏内实际消耗量

**计算**: `actualAmount = amount × ⌊price / Σ(amount × maxPrice)⌋`

**并且** 不产生新的顶层或嵌套结构，仅扩展现有 `wares[]` 条目

### Requirement: deliveryShips 顶层列表

**前提** 项目 `deliveries` 中包含舰船 macro 引用

**当** 运行 terraforming 数据解析模块

**那么** 顶层输出 `deliveryShips` 数组，按 `macro` 去重

**每个条目**: `{ macro, nameId, buildDuration, name }`

- `nameId` 通过 `component_to_ware[macro] → ware_index[ware_id].nameId` 解析
- `buildDuration` 从 `deliveries` 中提取，统一到 `deliveryShips` 层
- `name` 由 `inject_english_names()` 管线注入

**并且** `projects[].deliveries[].buildDuration` 移除，只保留 `macro` + `amount`

### Requirement: Cluster MUST 固化 taskProjectIds

Cluster 数据 MUST 在生成时预计算 `taskProjectIds` — 该 planet 为"前端唯一源"的固定 task 集合。

#### Scenario: 动态项目按 stat 可用性过滤

**前提** 某 cluster 通过 `Ignore*` flag 或 `removedStats` 忽略了某 stat（如 temperature）

**当** build.py 为该 cluster 计算 `taskProjectIds`

**那么** 依赖该 stat 的动态项目 MUST NOT 出现在 `taskProjectIds` 中

**并且** 非动态项目（不依赖特定 stat 阈值的）MUST 全部保留

#### Scenario: 前端直接消费

**前提** `terraforming.json` 已生成

**当** 前端构建任务树

**那么** MUST 使用 `cluster.taskProjectIds` 作为 project 候选集合

**并且** MUST NOT 在运行时根据 `currentStats` 或 `completedProjects` 动态增删 project
