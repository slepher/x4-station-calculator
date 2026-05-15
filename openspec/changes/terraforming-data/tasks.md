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
