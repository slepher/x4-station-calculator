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
- `ranges`: 数值区间数组, 每个区间含 `end`, `state`, `habitable`, `rgb`, `descriptionId`

**并且** 动态属性在 ranges 中包含 `state=0` 的隐藏区间

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
- `resources` (`{ price, pricescale?, payout?, minWares?, maxWares?, maxPrice?, wares: [{ware, amount}] }`)
- `deliveries` (`[{ macro, amount, buildDuration }]`)
- `rebates` (`[{ ware?, wareGroup?, value }]`)
- `removedProjects`, `blockedProjects`, `blockedGroups`
- `predecessors` (`[{ ref, type: "project"|"group", any }]`)

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
- `values`: MD `set_value` 捕获的已知数值 (如 housing target)
- `variableTexts`: `substitute_text` 运行时变量映射
- `objectives`: 任务目标列表 `[{ step, action, textId, encyclopedia?, textReplaces? }]`

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
