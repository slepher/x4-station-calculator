# terraforming-data Design

## 架构

```
scripts/x4-game/terraforming/
  __init__.py           # 导出 process_terraforming(loader)
  parse_library.py      # 解析 libraries/terraforming/final.xml → stats, projectGroups, projects
  parse_md.py           # 解析 md/terraforming/final.xml → clusters, predecessors, objectives, variableTexts
  build.py              # 组装输出数据, 注入到 loader, 加载 maps.json 做名称解析
```

```
analysis/scripts/terraforming/
  terraforming.ts                    # CLI 入口

src/store/logic/
  terraformingTaskResolver.ts        # 核心推理逻辑 + 格式化输出
```

### 调用链

```
x4_data_processor.py::run_for_config()
  ...
  loader.extract_and_resolve_languages()
  --------------------------------------------------
  + process_terraforming(loader)           # terraforming 解析
  --------------------------------------------------
  loader.refresh_exported_i18n()           # 重新收集 nameId (含 terraforming)
  loader.inject_english_names()
  ...
  loader.save()                            # 新增 terraforming.json 输出
```

## 模块职责

### parse_library.py

- 输入: `libraries/terraforming/final.xml`
- 输出: `(stats, projectGroups, projects, collected_nameIds)`
- stats: 含 ranges(rgb合成), inactiveTextId, dynamic 属性的隐式 range
- projects: 含 conditions, effects, sideEffects, resources(wares/pricescale/payout), deliveries, rebates, removedProjects, blockedProjects, blockedGroups
- `repeatCooldown`: `null` = 一次性(属性缺失), `0` = 可无限重复(属性显式为0), `>0` = 带冷却重复

### parse_md.py

- 输入: `md/terraforming/final.xml`
- 输出: `clusters`, `predecessors_map`
- 顶级 cluster 提取:
  1. XPath `.//cue[@name='Start']/cues/cue` 定位
  2. 名称为 `Terraforming_<Name>` 且 actions 含 `find_cluster`/`initialise_terraforming`
  3. 排除 DEBUG 前缀
- 递归解析 `do_if`/`do_else`/`do_elseif` 块
- `_collect_all_predecessors(root)`: **扫描全文件** 所有 `add_terraforming_project` 提取 predecessor (覆盖 library 定义中的依赖)
- `_extract_objectives(cue)`: 从 create_offer/update_mission 的 briefing 提取任务目标
- `_extract_variable_texts(cue)`: 提取 substitute_text 映射 (如 `$RelocateObjectiveText` → `{1004,1091}`)
- `resolve_cluster_objective_texts(clusters, cluster_name_map)`: 后处理, 将 `$Variable` textId 解析为 `{page,id}` 模板 + textReplaces
- 库模板(food类): 从 `_KNOWN_LIBRARIES` 硬编码展开

### build.py

- 负责组装:
  1. 调用 parse_library → stats, groups, projects
  2. 调用 parse_md → clusters, predecessors_map
  3. `_load_cluster_name_ids(base_path)`: 加载 maps.json, 构建 `macro_id → display_nameId` (多 sector 取 cluster 名, 单 sector 取 sector 名)
  4. `resolve_cluster_objective_texts(clusters, cluster_name_map)`: 后处理 objectives
  5. 合并 predecessors_map 到 projects
  6. 注入所有 nameId 到 `loader.needed_raw_names`
  7. 挂载 `loader.terraforming_data`
- 错误处理: XML 缺失/解析异常 → terraforming_data=None, save() 跳过

## 输出结构

```json
{
  "stats": [{ "id": "temperature", "nameId": "{1001,11401}", "ranges": [...], "icon": "..." }],
  "projectGroups": [{ "id": "power", "nameId": "{1001,11473}" }],
  "projects": [{
    "id": "ind_factories",
    "group": "industry",
    "repeatCooldown": null,
    "predecessors": [{ "ref": "ind_refineries_clean", "type": "project", "any": true }],
    "resources": { "price": 25000000, "wares": [{ "ware": "energycells", "amount": 133 }] },
    "deliveries": [{ "macro": "...", "amount": 10, "buildDuration": 30 }]
  }],
  "clusters": [{
    "id": "ScalePlateGreen",
    "macro": "macro.cluster_21_macro",
    "initialStats": { "temperature": 3 },
    "projectIds": ["pwr_antimatter", ...],
    "values": { "$Terraforming_ScalePlateGreen_HousingTargetAmount": "1000000000" },
    "variableTexts": { "$RelocateObjectiveText": { "source": "{1004,1091}", "replaces": [...] } },
    "objectives": [{ "step": 1, "action": "objective.relocate", "textId": "{1004,1091}", "textReplaces": [...] }]
  }]
}
```

## 依赖解析策略

两阶段收集:
1. `_collect_all_predecessors(root)` — 扫描全文件所有 `add_terraforming_project` 的 `<predecessors>`
2. `_parse_cluster_actions` — 各 cluster 的局部解析

转换:
```xml
<predecessors any="true">
  <predecessor id="'ind_refineries_clean'"/>
  <predecessor group="'power'"/>
</predecessors>
```
→
```json
{ "predecessors": [
    {"ref": "ind_refineries_clean", "type": "project", "any": true},
    {"ref": "power", "type": "group", "any": true}
  ]
}
```

**阻塞规则**: 只有 `type=project` 的前置未完成才阻塞可用性; `type=group` 仅展示为 `⟸ [组: 能源]` 信息, 不阻塞。

## CLI 架构

### 参数

```
--planet <id>        星球 ID
--version <folder>   数据版本 (默认 versions.json 稳定版)
--lang <code>        界面语言 (默认 zh-CN)
--temperature <n> ... --salinity <n>    覆盖星球状态
--completed <ids>    已完成项目, 逗号分隔
--list-planets       列出所有候选星球
--json               JSON 格式输出
```

### 数据流

```
terraforming.json + locales/<lang>.json
        ↓
terraformingTaskResolver.ts
    - loadTerraformingData(version)
    - resolveAvailableTasks(cluster, state, data)
    - printObjectives(cluster, data, i18nMap)
    - printTaskTree(tree, i18nMap)
        ↓
    CLI output (中文)
```

### 输出要素

- 任务目标区 (step, action, 中文文本, replaces 已填充)
- 按 projectGroups 原始顺序的分组树
- 每个节点: 中文名, 效果摘要 `(+2 temp)`, 重复性 `[一次性]/[可重复]/[冷却:Ns]`, 阻塞状态 `[BLOCKED]`
- 依赖标注: `⟸` / `⟸ 任一:` + 解析后的项目/组名
- 阻塞原因: `需要:` + 中文项目名
