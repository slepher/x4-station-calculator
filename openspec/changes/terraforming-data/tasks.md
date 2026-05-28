# terraforming-data Tasks

## 1. 创建模块目录结构

- [x] 创建 `scripts/x4-game/terraforming/__init__.py`
- [x] 创建 `scripts/x4-game/terraforming/parse_library.py`
- [x] 创建 `scripts/x4-game/terraforming/parse_md.py`
- [x] 创建 `scripts/x4-game/terraforming/build.py`

## 2. 实现 parse_library.py

- [x] 解析 `<stats>` → `stats` 数组（含 ranges 的 rgb 合成）
- [x] 解析 `<projectgroups>` → `projectGroups` 数组
- [x] 解析 `<projects>` → `projects` 数组（含 conditions, effects, sideEffects, resources, deliveries, rebates, removedProjects, blockedProjects, blockedGroups）
- [x] `repeatCooldown`: null=一次性(属性缺失), 0=可无限重复, >0=冷却秒数
- [x] 收集所有 nameId/descriptionId 文本引用

## 3. 实现 parse_md.py

- [x] 提取顶级 cluster cue（排除 debug 前缀, 检查 find_cluster/initialise_terraforming）
- [x] 解析 cluster 的 macro, partName, initialStats
- [x] `_collect_all_predecessors(root)`: 全局扫描所有 add_terraforming_project 提取 predecessor
- [x] `_extract_objectives(cue)`: 从 create_offer/update_mission 的 briefing 提取任务目标
- [x] `_extract_variable_texts(cue)`: 提取 substitute_text 运行时变量映射
- [x] `resolve_cluster_objective_texts()`: 后处理 $Variable textId → {page,id} 模板 + textReplaces
- [x] `_resolve_replace_value()`: 解析 $HQName, $Cluster_X.knownname, 数值变量
- [x] 内联展开已知 library 调用的 project 模板
- [x] 提取 set_value 到 cluster.values（housing target 等数值）

## 4. 实现 build.py

- [x] 导出 `process_terraforming(loader)` 函数
- [x] `_load_cluster_name_ids(base_path)`: 从 maps.json 构建 macro_id → 显示名映射 (多sector取cluster名, 单sector取sector名)
- [x] 调用 resolve_cluster_objective_texts 后处理
- [x] 将 predecessors_map 合并到 projects
- [x] 注入所有 nameId 到 `loader.needed_raw_names`
- [x] 挂载 `loader.terraforming_data`
- [x] 错误处理: XML 缺失/异常 → terraforming_data=None, save() 跳过

## 5. 集成到 x4_data_processor.py

- [x] `run_for_config()`: 在 `extract_and_resolve_languages()` 之后、`refresh_exported_i18n()` 之前调用
- [x] `save()`: 新增 `data/terraforming.json` 输出
- [x] `inject_english_names()`: 新增 terraforming 数据的 name 注入
- [x] 动态导入 terraforming 模块 (目录名 x4-game 含 hyphen)

## 6. 实现 src/store/logic/terraformingTaskResolver.ts

- [x] 类型定义: TerraformingStat, TerraformingProject, TerraformingCluster (含 objectives, values, variableTexts), TaskNode, TaskTree
- [x] `resolveAvailableTasks()`: cluster + state → 分组依赖树
- [x] `evaluateProject()`: stat 条件 + project 前置检查; group 前置不阻塞,仅标注
- [x] `printTaskTree()`: 按 projectGroups 原始顺序输出缩进树, 含依赖标注/重复性标签/阻塞标记
- [x] `printObjectives()`: 输出任务目标, 含 step/action/中文文本
- [x] `resolveTerraformingText()`: 解析 `{page,id}`, `terraforming.stat.X.name`, `terraforming.project.Y.name`
- [x] `getDependencyLabel()`: 生成 `⟸` / `⟸ 任一:` 依赖标注
- [x] `getRepeatLabel()`: 生成 `[一次性]` / `[可重复]` / `[冷却:Ns]` 标签
- [x] `translateBlockedReason()`: 阻塞原因中文化
- [x] `groupLabel()`: i18n 解析组名
- [x] `loadTerraformingData(version)`: 动态加载对应版本的 terraforming.json

## 7. 实现 analysis/scripts/terraforming/terraforming.ts

- [x] 使用 `getopts` 解析 CLI 参数: `--planet`, `--lang`, `--version`, `--completed`, stat 覆盖, `--list-planets`, `--json`
- [x] `loadLocale()`: 加载 `locales/<lang>.json` 供 i18n 解析
- [x] 调用 `printObjectives()` + `printTaskTree()` 输出
- [x] `--list-planets` 列出所有候选星球
- [x] 修复 parseStatArgs: skip empty string (getopts 未设置 string 参数返回 "")
- [x] `--json` 输出含 objectives 的 JSON

## 8. 构建验证

- [x] `npm run build` 通过
- [x] Python 处理器: 15 stats, 15 groups, 107 projects, 10 clusters, 287 terraforming i18n 条目
- [x] ScalePlateGreen objectives: 5 steps, textId 已解析为 {page,id} 模板, textReplaces 含已解析值
- [x] 48 projects 含 predecessor 数据
- [x] 76 一次性 / 25 可无限重复 / 6 带冷却

## 9. Cluster 级参数处理

- [x] 9.1 `_process_library_call`: 识别 `Biosphere=false`, 跳过 `SetupGeneralProjects_Biosphere` 项目
- [x] 9.2 `_process_library_call`: 识别 `EnergyProject` 参数, 替换 `pwr_antimatter` (BlackHoleSun→pwr_wind, AtiyasMisfortune→pwr_geothermal)
- [x] 9.3 `_process_library_call`: 从直接调用的 `SetupStatDependentProjects` 捕获 `Ignore*` flags
- [x] 9.4 cluster values 与 known_values 合并修复: `known_values.update(cluster["values"])` 避免 library 写入被覆盖

## 10. 动态项目条件化添加

- [x] 10.1 `_add_stat_dependent_projects_static()`: 根据 cluster initialStats 条件化添加项目 (temperature/methane/CO2/toxicity/radioactivity/humidity/airpressure/seismic)
- [x] 10.2 温度项目仅当 `"temperature" in stats` 时添加, 且根据值判断降温/升温方向
- [x] 10.3 `atm_outgassing` 仅当 `"airpressure" in stats` 且值 < 5 时添加
- [x] 10.4 所有分支受对应 `$Ignore*` flag 控制
- [x] 10.5 `SetupStatDependentProjects` 命中的通用动态事件 (`evt_globalwarming_*`, `evt_quake_*`) 与项目一起进入初始/运行时项目池规则

## 11. 变量与 predecessor 解析

- [x] 11.1 `build.py`: `$PilotTrainingCourseProject` 解析为 `trn_pilot`
- [x] 11.2 `parse_md.py`: cluster 级 `$PilotTrainingCourseProject` 参数存储与 predecessor 替换
- [x] 11.3 `evaluateProject`: predecessor 仅当引用项目在该 cluster projectIds 中存在时有效

## 12. I18nLookup 重构

- [x] 12.1 `I18nLookup` 类型导出: `(key: string) => string`
- [x] 12.2 `resolveTerraformingText`, `resolveWithReplaces`, `printTaskTree`, `printObjectives` 签名更新
- [x] 12.3 helper (`groupLabel`, `getDependencyLabel`, `translateBlockedReason`, `resolveGroupName`) 同步更新
- [x] 12.4 CLI `terraforming.ts`: `i18nMap` 包装为 `(key) => i18nMap[key] || ''`
- [x] 12.5 CLI `run()` 返回类型改为 `{ output, currentStats }`；显示代码复用 run() 的 stats

## 13. blockedProjects/removedProjects 语义修正

- [x] 13.1 XSD 校对: `blockedProjects` 是 "阻塞直到完成"（未完成 → 阻塞，完成 → 解锁）
- [x] 13.2 `evaluateProject`: `!completed && cp.blockedProjects.includes(pid)` 生成阻塞
- [x] 13.3 被 `removedProjects` 移除的项目其 `blockedProjects` 不再生效

## 14. state/value 语义补全

- [x] 14.1 `parse_library.py`: 为每个 `stats[].ranges[]` 补出 `start`
- [x] 14.2 `parse_library.py`: 确保 `rgb/state/habitable` 原样保留，供前端还原游戏方块颜色
- [x] 14.3 `parse_library.py`: 对 `projects[].conditions[]` 保留 `min/max/minvalue/maxvalue`
- [x] 14.4 `parse_library.py`: 为 condition 新增 `usesStateBounds` / `usesValueBounds`
- [x] 14.5 `terraformingTaskResolver.ts`: 校正条件解释，明确 `condition.min/max` 按 state 判定，`minvalue/maxvalue` 按真实 value 判定
- [x] 14.6 验证 `ame_resort_tropical` 的 `temperature min=2 max=3` 可被消费方解释为温度 state 2..3，而非 value 2..3

## 15. 运行时派生规则输出

- [x] 15.1 `parse_md.py` / `build.py`: 明确保留 cluster 级 `Ignore*`、`$AddedAtmoPressureTable.*`、`$GlobalWarmingLimitTable.*`
- [x] 15.2 `deriveAirPressure`: 从绝对覆写改为 delta 叠加 `airpressure = effectStats.airpressure + currentContribution - initialContribution`，保留项目效果值；且当 cluster 不存在 airpressure stat 时跳过不计算
- [x] 15.3 定义并输出 warming event 所需语义，使消费方通过通用动态 event 命中逻辑处理 `evt_globalwarming_*`
- [x] 15.4 将 `SetupStatDependentProjects` 的项目/事件阈值规则整理为可复用的动态项目池语义，而非仅在初始解析时静态扩表
- [x] 15.5 验证 `AtiyasMisfortune`、`OceanOfFantasy`、`GetsuFune` 三类 cluster 的 ignore / warming / dynamic rules 均可被消费方识别
- [x] 15.6 `parse_md.py`: 解析 cluster cue / patch 中的 `remove_terraforming_stat`，输出 `removedStats`
- [x] 15.7 runtime 消费方将 `removedStats` 与 `Ignore*` 合并，统一视为 stat 不存在

## 16. Cluster 奖励提取

- [x] 16.1 `parse_md.py`: 新增 `_extract_cluster_rewards(cue)` — 遍历子 cue 提取 milestone/completion 中的 faction、blueprint、NPC 奖励
- [x] 16.2 `parse_md.py`: 新增 `_extract_reward_actions()` — 解析单个 milestone cue 的 `<actions>` + `<patch>` 中的奖励动作
- [x] 16.3 `parse_md.py`: 新增 `_resolve_npc_nameid()` — 从 `create_cue_actor` 映射 actor 变量到 locale nameId
- [x] 16.4 `build.py`: 新增 `_build_cluster_rewards()` — 将 raw reward 数据转为最终 `factionRewards` / `rewards` 字段，nameId 加入 i18n_collector
- [x] 16.5 重建 `terraforming.json`（8.0 和 9.0 版本）
- [x] 16.6 TypeScript 类型: `TerraformingFactionReward`, `TerraformingClusterRewardItem`, 扩展 `TerraformingCluster`
