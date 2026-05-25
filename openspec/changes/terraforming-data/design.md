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
- ranges: 额外补出 `start`，使每个 range 成为语义明确的 value → state 映射单元
- projects: 含 conditions, effects, sideEffects, resources(wares/pricescale/payout), deliveries, rebates, removedProjects, blockedProjects, blockedGroups
- `repeatCooldown`: `null` = 一次性(属性缺失), `0` = 可无限重复(属性显式为0), `>0` = 带冷却重复

### state/value 语义约束

基于 `libraries/terraforming/terraforming.xsd`：

- `condition.min/max` 表示 **state 边界**，不是原始 value 边界
- `condition.minvalue/maxvalue` 表示 **真实 value 边界**
- `effect.min/max` 表示 **该 effect 应用 change 后的结果 clamp**
- `effect.value` 表示 **直接设值**，不受 `effect.min/max` 影响

因此数据层不预烘焙任何 view 专用文案，但必须输出足够的领域语义，让消费方能够：

1. 把任意 stat 的当前 value 映射到唯一的 state 与颜色
2. 正确解释项目条件到底是 state 区间要求还是 value 阈值要求
3. 正确解释项目效果里的 `min/max` 只是该 effect 的局部结果钳制

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
  2. 调用 `_compute_actual_ware_amounts(projects, wares_data)` — 资源实际消耗量计算
  3. 调用 `_build_delivery_ships(projects, component_to_ware, ware_index)` — 构建顶层 deliveryShips
  4. `projects[].deliveries` 移除 `buildDuration`（统一到 deliveryShips）
  5. 调用 parse_md → clusters, predecessors_map
  6. `_load_cluster_name_ids(base_path)`: 加载 maps.json, 构建 `macro_id → display_nameId`
  7. `resolve_cluster_objective_texts(clusters, cluster_name_map)`: 后处理 objectives
  8. 合并 predecessors_map 到 projects
  9. 注入所有 nameId 到 `loader.needed_raw_names`（含 deliveryShips nameId）
  10. 挂载 `loader.terraforming_data`
- 错误处理: XML 缺失/解析异常 → terraforming_data=None, save() 跳过

### deliveryShips 名称解析

`_build_delivery_ships(projects, component_to_ware, ware_index)` 在 build.py 中调用，构建顶层 `deliveryShips` 数组：

- 遍历所有 project 的 `deliveries`，按 `macro` 去重
- 通过 `loader.component_to_ware[macro]` 获取 ware_id
- 从 `loader.ware_index[ware_id].nameId` 获取 i18n key
- 保留 `buildDuration` 到 `deliveryShips` 层
- `projects[].deliveries` 中**移除** `buildDuration`（只保留 `macro` + `amount`）

输出后由 `inject_english_names()` 管线注入 `name` 字段（英文 locale）。

**背景**: terraforming 交付舰船在 wares.xml 中 `transport="ship"`，被 `build_database()` 的商品筛选排除，不输出到 `wares.json` / `ships.json` / `drones.json`。`loader.ware_index` 保留全量 ware 索引，在 build 阶段直接解析 nameId 注入 `deliveryShips`。

### 资源实际消耗计算

`_compute_actual_ware_amounts(projects, wares_data)` 根据 X4 游戏经济机制计算实际消耗量，写入 `resources.wares[].actualAmount`。

公式: `actualAmount = amount × ⌊price / Σ(amount × maxPrice)⌋`

其中 `maxPrice` 来自 wares.xml `<price max="...">`，由 `loader.wares_data` 提供（即 `wares.json` 的同源数据）。依据 `terraforming.xsd` — `resources` 注解: *"The amounts will be scaled, using the average prices, to reach the defined total price."* 实测确认游戏实际使用 **maxPrice** 进行缩放。

这些字段**不产生新的顶层或嵌套结构**，仅扩展现有 `wares[]` 条目。

### 建造港槽位数提取（modules.json）

`x4_data_processor.py::scan_assets()` 中，对每个 `class="buildmodule"` 的宏：

- `buildProcessorCount`: 统计 `<connections>` 下 `connection[@ref='buildprocessorconnection']` 的数量
- `buildShipClasses`: 读取 `properties/builder/@classes` 属性，按空格分割

写入 modules.json 的 `X4Module` 条目。**不属于 terraforming data 输出**，但由 terraforming-view presenter 消费用于建造时间计算。

典型值:

| 模块 | buildProcessorCount | buildShipClasses |
|------|-------------------|-----------------|
| S/M 综合建造港 (dock area) | 8 | [ship_m, ship_s] |
| S 建造港 | 6 | [ship_s] |
| M 建造港 | 3 | [ship_m] |
| L 建造港 | 1 | [ship_l] |
| XL 建造港 | 1 | [ship_xl] |
| Equip docks (维护港) | 1-8 | [] (空) |

### Range 输出约定

对每个 stat 的 `ranges[]`：

- `start`: 当前 range 覆盖的最小 value
- `end`: 当前 range 覆盖的最大 value
- `state`: X4 原始 state 编号
- `rgb`: 当前 state 的 UI 颜色
- `habitable`: 若 XML 显式为 false 则保留 false，未提供则视为 true

### Condition 输出约定

对每个 `projects[].conditions[]`：

- 原始字段 `min/max/minvalue/maxvalue` 原样保留
- 新增：
  - `usesStateBounds: boolean`
  - `usesValueBounds: boolean`

规则：

- 若存在 `minvalue` 或 `maxvalue`，则 `usesValueBounds=true`
- 若仅存在 `min`/`max`，则 `usesStateBounds=true`
- 数据层不生成 `conditionDisplayBlocks`、`stateLabel` 等 view 专用字段

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
{
  "stats": [{ "id": "temperature", "nameId": "{1001,11401}", "name": "Temperature", "ranges": [{ "start": 0, "end": 3, "state": 0, "rgb": "#FFFFFF" }], "icon": "..." }],
  "projectGroups": [{ "id": "power", "nameId": "{1001,11473}", "name": "Power" }],
  "projects": [{
    "id": "ind_factories",
    "group": "industry",
    "nameId": "{20227,1002}",
    "name": "Factories",
    "repeatCooldown": null,
    "conditions": [{ "stat": "temperature", "min": 2, "max": 3, "usesStateBounds": true, "usesValueBounds": false }],
    "predecessors": [{ "ref": "ind_refineries_clean", "type": "project", "any": true }],
    "resources": { "price": 25000000, "wares": [{ "ware": "energycells", "amount": 133, "actualAmount": 263473 }] },
    "deliveries": [{ "macro": "ship_gen_m_transdrone_container_01_a_macro", "amount": 10 }]
  }],
  "clusters": [{
    "id": "ScalePlateGreen",
    "macro": "macro.cluster_21_macro",
    "initialStats": { "temperature": 3 },
    "projectIds": ["pwr_antimatter", ...],
    "removedStats": ["airpressure"],
    "values": { "$Terraforming_ScalePlateGreen_HousingTargetAmount": "1000000000" },
    "variableTexts": { "$RelocateObjectiveText": { "source": "{1004,1091}", "replaces": [...] } },
    "objectives": [{ "step": 1, "action": "objective.relocate", "textId": "{1004,1091}", "textReplaces": [...] }]
  }],
  "deliveryShips": [
    { "macro": "ship_gen_m_transdrone_container_01_a_macro", "nameId": "{20101,101601}", "buildDuration": 30, "name": "Medium Drop Drone" }
  ]
}
```

**阻塞规则**: 只有 `type=project` 的前置未完成才阻塞可用性; `type=group` 仅展示为 `⟸ [组: 能源]` 信息, 不阻塞。

### Cluster 级参数处理

`SetupGeneralProjects` 库支持 cluster 级参数，解析器已实现：

| 参数 | 默认值 | 影响 |
|---|---|---|
| `Biosphere` | `true` | `false` 时跳过 `SetupGeneralProjects_Biosphere`（如 GetsuFune, ScalePlateGreen） |
| `EnergyProject` | `pwr_antimatter` | 替换电力项目（BlackHoleSun→`pwr_wind`, AtiyasMisfortune→`pwr_geothermal`） |
| `Ignore*` 系列 | `false` | `true` 时跳过对应 stat 依赖项目（OceanOfFantasy→`IgnoreHumidity`,`IgnoreMethane`） |
| `removedStats[]` | 空 | cluster cue / patch 中被 `remove_terraforming_stat` 删除的 stat，视为该 stat 不存在 |
| `$AddedAtmoPressureTable.*` | `0` | cluster 级额外空气压力补正，参与运行时 `airpressure` 派生 |
| `$GlobalWarmingLimitTable.*` | 缺失 | cluster 级温室效应上限，控制 warming event 的最高回推温度 |

### 动态项目（SetupStatDependentProjects）

当前实现里，`_add_stat_dependent_projects_static()` 会在 cluster 解析后根据 `initialStats` 条件化添加一批**项目与事件**：

- 温度 < 5 → `tmp_moholes`, `tmp_blackdust`, `atm_methane_import`（仅当 temperature stat 存在）
- 温度 > 5 → `tmp_cloudparticles`
- 氧气 < 4 → `bio_cyanobacteria`
- 甲烷 > 0 → `atm_methane_oxidizers`, `atm_methane_oxidize`, `evt_globalwarming_methane`
- 二氧化碳 > 0 → `atm_carbon_mineralizers`, `atm_carbon_mineralize`, `evt_globalwarming_co2`
- 毒性 > 0 → `atm_toxin_cleanup`
- 放射性 > 0 → `ter_radioactive_cleanup`
- 湿度 < 6 → 水项目（`wat_import`, `wat_irrigation`, `wat_surfacing`）
- 气压存在 → `atm_nitrogen_fix`, `atm_helium_import`
- 气压 < 5 **且**气压存在 → `atm_outgassing`
- 地震活动 > 0 → `evt_quake_mild`, `evt_quake_moderate`, `evt_quake_severe`, `ter_tectonic_scaffolding`

所有分支均受对应 `$Ignore*` flag 控制。

但从游戏规则语义看，这一层不能只停留在“初始时静态扩表”。目标模型应当把这些规则保留为**运行时项目池规则**，由消费方在当前 stats 变化后重复评估：

- 当 stat 从 `0 → >0` 或跨越温度/湿度/气压阈值时，项目应动态加入
- 当 stat 从 `>0 → 0` 或跨回阈值另一侧时，项目应动态移除
- `$Ignore*` 仍然是最高优先级开关，ignore 的 stat 不参与该类项目池规则

因此 `cluster.projectIds` 只表示“初始注入 + 静态项目集合”，不是最终运行时可见项目全集。

### 运行时派生规则

terraforming 的若干关键 stat 和事件不是“项目 effect 直接累加”即可得到，而是运行时派生结果：

1. **空气压力**
   - 原始 MD 语义是“每满 4 格气体额外提供 1 点空气压力贡献”
   - 运行时表现为：根据 `(oxygen + methane + carbondioxide) / 4` 的整除结果变化量，增量修正现有 `airpressure`
   - `AddedAtmoPressureTable.*` 记录的是当前已计入的气体贡献，不应被表述为独立常量偏移
   - 若 cluster 显式 `IgnoreAirPressure=true`，或该 stat 被 `remove_terraforming_stat` 删除，则该 stat 不参与项目池、条件显示和可用性判定

2. **温室效应与其他 stat 驱动事件**
   - `evt_globalwarming_methane`、`evt_globalwarming_co2`、`evt_quake_*` 等都属于 `SetupStatDependentProjects` 命中的通用动态事件
   - 数据层必须把“当前 stat 命中 helper 规则时应出现哪些事件”保留下来
   - 消费方应通过同一套运行时项目池规则命中这些事件，而不是为温室效应单独硬编码 stat 回推
   - cluster 若设置 `$GlobalWarmingLimitTable.*`，仍需保留该调参，供消费方在事件可用性或事件效果解释中使用

3. **stat 驱动的项目池**
   - `SetupStatDependentProjects` 生成的项目和事件都不是固定常量列表
   - 它们的存在性由“当前 stats + Ignore 开关”共同决定
   - 消费方需要能够依据当前运行时 stats 重新推导项目池，而不是只读取一次静态 `projectIds`

因此数据层需要额外输出足够的运行时语义，让消费方可重建：

- `derived stat` 公式参数
- `warming event` 判定规则与 cluster 上限
- `dynamic project rules` 的阈值与 ignore gating
- `remove_terraforming_stat` 导致的 stat 缺失语义

### 变量解析

`$PilotTrainingCourseProject` 在 `build.py` 中解析为 `trn_pilot`（默认）。cluster 可传入自定义值（目前均使用默认）。

### I18nLookup 重构

`terraformingTaskResolver.ts` 的 i18n 函数从 `i18nMap: Record<string, string>` 改为 `i18nLookup: (key: string) => string`：

- CLI：`(key) => i18nMap[key] || ''`
- Web：`(key) => i18n.global.t(key) || ''`
- 影响：`resolveTerraformingText`, `resolveWithReplaces`, `printTaskTree`, `printObjectives` 及所有 helper

### blockedProjects/removedProjects 语义

根据 XSD 校对：

- **`removedProjects`**: 完成此项目后移除目标项目（互斥关系）
- **`blockedProjects`**: 目标项目**阻塞直到**此项目完成（非完成阻塞，未完成才阻塞）
- **`blockedGroups`**: 同上，目标为整个组
- 被 `removedProjects` 移除的项目其 `blockedProjects` 不再生效

### Predecessor 过滤

`evaluateProject` 中 predecessor 引用仅当目标项目在该 cluster 的 `projectIds` 中存在时才有效。解决 `Biosphere=false` cluster 中 `agr_fertilize` 不存在但其 predecessor 仍生效的问题。

### 方案边界

本 change 采用方案 A：

- 数据层只补足领域语义，不生成 `conditionDisplayBlocks`、`stateLabel` 等 view 专用字段
- 方块展示、tooltip 文案、状态对比均由 presenter / vue 在 `terraforming-view` 中消费这些领域字段完成

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

## Known Limitations (运行时动态层)

### 温室效应事件 (temperature floor)

`evt_globalwarming_methane` / `evt_globalwarming_co2` 是**可重复事件** (`repeatCooldown=0`)，持续叠加 +1 temp 直到 **max 6**：

```
evt_globalwarming_methane (60s, 极快):
  条件: methane >= 1, temperature <= 5
  效果: temperature +1 (max: 6)
  证据: libraries/terraforming/final.xml, repeatcooldown="0"

evt_globalwarming_co2 (3600s):
  条件: CO2 >= 1, methane == 0, temperature <= 5
  效果: temperature +1 (max: 6)
```

每星区 `GlobalWarmingLimit` 限定触发上限：

| 星区 | Limit | 说明 |
|------|-------|------|
| ScalePlateGreen | 3 | 事件完全不触发 (temp=3, 需 ≤2) |
| BlackHoleSun | 6 | 仅在 temp 降到 5 时触发 |
| FrontierEdge | 4 | temp=3 可升温到 4 后停止 |
| 18Billion | 5 | |
| OceanOfFantasy | 5 | |
| **AtiyasMisfortune** | **未设置** | 事件**无限**触发 |

**后果**：AtiyasMisfortune (methane=2, 无 limit) 在 temp 降到 5 后，warming 事件持续将 temp 推回 6。需先完成 `atm_methane_oxidizers`(一次性) → `atm_methane_oxidize`×2(可重复, -1 CH4/+1 CO2) → `atm_carbon_mineralizers`(一次性) → `atm_carbon_mineralize`×2(可重复, -1 CO2) 清除全部温室气体，才能打破循环。但即使清除后，降温项目 min clamps 阻止进入 1-3 宜居区。

### 空气压力公式

`airpressure = base + floor((O2 + CH4 + CO2) / 4)` — 由 `StatChanged_AnyAtmosphere` (md line 1109-1126) 动态触发：
```
<set_terraforming_stat cluster="event.object" id="'airpressure'" 
  value="old_airpressure + $AddedAirPressure - $AddedAtmoPressureTable.{...}"/>
```
解析器仅取 initialStats 快照，未实时计算。影响 `atm_outgassing` 可用性（需 airpressure < 5）。

### 动态项目增删 (StatAdded/StatRemoved)

`StatAdded_*` / `StatRemoved_*` 在 stat 值跨越 0 时动态增删项目，均未实现：

| 事件 | 触发条件 | 操作 |
|------|---------|------|
| `StatAdded_Methane` | methane>0 | 添加 oxidizers + oxidize + warming 事件 |
| `StatRemoved_Methane` | methane→0 | 移除以上（除非 oxidizers 已完成） |
| `StatAdded_CO2` | CO2>0 | 添加 mineralizers + mineralize + warming 事件 |
| `StatRemoved_CO2` | CO2→0 | 移除以上 |
| `StatAdded_Toxicity` | toxicity>0 | 添加 `atm_toxin_cleanup` |
| `StatAdded_Radioactivity` | radioactivity>0 | 添加 `ter_radioactive_cleanup` |
| `StatAdded_SeismicActivity` | seismic>0 | 添加 `evt_quake_mild/moderate/severe` |

部分缓解：`_add_stat_dependent_projects_static` 已按 initialStats 一次性添加，但不会随 stat 变化增减。

### 冰融反馈

`evt_icemelt` (temp ≥ 1 → airpressure +1) 仅手动添加于 FrontierEdge，非动态触发。

### 行星演化事件 (OceanOfFantasy only)

```
evt_solidify_crust: temp≤7, seismic=2 → seismic-1, humidity-2
evt_volcano_extinction: temp≤6, seismic=1 → seismic-1, humidity-1
evt_salinization: salinity≤2, humidity≥2 → salinity+1
```

### DLC 补丁

- **Boron DLC** (dlc_boron.xml): OceanOfFantasy 额外项目 + 外部信号
- **Terran DLC** (dlc_terran.xml): `Add_Terran_Terraforming_Projects` 向全部星区注入 `ind_von_neumann`, `wat_surfacing`, `atm_outgassing`, `ter_tectonic_scaffolding` — **但已通过 base library 解析覆盖**，无需额外处理。

### research 解锁 (未检查)

4 项目需 `research_tf_tech`：`wat_surfacing`, `atm_outgassing`, `ter_tectonic_scaffolding`, `ind_von_neumann`。

### 副作用与概率 (未实现)

6 项目有 `sideEffects`：3 quake 事件 (setback)、`bio_jumpstart` (25% spawn bio_cull)、`bio_toxicfruit_cull` (25% spawn parasites)、`ind_refineries_cheap` (25% +1 toxicity)。`bio_jumpstart` 自身成功率 25%, `eco_bank_supply` 10%。

### 韧性项目 (未区分)

17 个项目 `resilient: true`（setback 后效果保留），当前无区分。
