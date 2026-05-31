# request.md — research-data

## 目标

仿照 `terraforming.json` 模式，在 `scripts/x4_data_processor.py` 的数据处理流水线中新增 `research.json` 生成模块。
从 `wares.xml` 中提取所有 `transport="research"` 的 ware（共 57 个），输出研究项列表，包含名称、标签、研究时间、资源消耗、依赖关系、解锁条件类别及必要的游戏内 ID。

## 已确认方案（审核重点）

### 1. 数据来源

- `libraries/wares/final.xml`: 所有 `transport="research"` 的 `<ware>` 定义
  - id, nameId, tags, research time, `<primary>` 消耗
  - 内层 `<research><research><ware ware="research_xxx"/></research></research>` → 研究依赖关系

### 2. 分类规则

基于 `tags` 属性组合，分为 4 类：

| 分类 | 判断规则 | 说明 |
|------|---------|------|
| `default` | 在默认 story ref 列表中 | 研究功能解锁后自动可用 (30个) |
| `abandoned` | `hidden` 且不含 `missiononly` | 已废弃，不在前端展示 (3个) |
| `mission_progress` | `missiononly`（含 hidden+missiononly） | 任务脚本自动添加 (9个) |
| `conditional` | 不在默认列表 + 非 hidden/missiononly | 需要特定脚本事件触发解锁 (15个) |

### 3. 解锁条件参数

所有 `conditional` 项 SHALL 携带 `unlock` 字段，含 `key` 和可选的 `params`。除 `npcNameId` 外，所有 params 同时携带原始 game ID 和对应的 `nameId`，由 `build_research_data()` 从 wares.xml 和 `SECTOR_NAMEIDS` 硬编码表解析：

| 参数 (raw) | 参数 (resolved) | 示例 |
|-----------|----------------|------|
| `sectorMacro` | `sectorNameId` | `cluster_502_sector001_macro` → `{20004,5020011}` |
| `shipWareId` | `shipNameId` | `ship_pir_xl_battleship_01_a` → `{20101,121101}` |
| `itemWareId` | `itemNameId` | `inv_quantum_data_shard` → `{20201,56001}` |
| `npcNameId` | (无需解析) | `{30201,2}` (Boso Ta) |
| `count` | (无需解析) | `2` |

nameId 全部加入 `i18n_collector`，由 `refresh_exported_i18n()` 同步到游戏数据 locale 文件。

完整 conditional 映射（params 同时含 raw ID 和 nameId）：

| research ware | key | params |
|-------------|-----|--------|
| agentslot_01 | embassy | — |
| agentslot_02 | embassy | — |
| equipment_xenon | xen_equipment | `{itemWareId, itemNameId}` |
| interference_network | interference_network | `{count}` |
| xenon_crisis_01 | xenon_crisis_01 | — |
| xenon_crisis_02 | xenon_crisis_02 | — |
| condensate_sample | condensate_sample | `{npcNameId, itemWareId, itemNameId}` |
| erlking_core | erlking | `{shipWareId, shipNameId, sectorMacro, sectorNameId}` |
| ship_ter_s_fighter_01 | abandoned_ship | `{sectorMacro, sectorNameId, shipWareId, shipNameId}` |
| ship_ter_m_corvette_01 | abandoned_ship | `{sectorMacro, sectorNameId, shipWareId, shipNameId}` |
| ship_ter_l_flagship_01 | abandoned_ship | `{sectorMacro, sectorNameId, shipWareId, shipNameId}` |
| ship_arg_s_racing_01 | abandoned_ship | `{sectorMacro, sectorNameId, shipWareId, shipNameId}` |
| ship_tel_s_racing_01 | abandoned_ship | `{sectorMacro, sectorNameId, shipWareId, shipNameId}` |
| ship_par_s_racing_01 | abandoned_ship | `{sectorMacro, sectorNameId, shipWareId, shipNameId}` |
| ship_gen_m_corvette_02 | abandoned_ship | `{shipWareId, shipNameId}` (无 sectorMacro) |
| tf_tech | tf_tech | — |

### 4. 依赖解析

从 wares.xml 中解析研究项自身的嵌套 `<research>` 块：
- `<research time="..."><primary>…</primary></research>` → 成本
- `<research><research><ware ware="research_xxx"/></research></research>` → 依赖关系

### 5. 模块结构

`scripts/x4-game/research/`（仿照 `scripts/x4-game/terraforming/`）：
- `build.py`: 主编排函数 `process_research(loader)`，输出挂载到 `loader.research_data`
- `run.py`: 可选独立运行入口

## 边界

### In Scope

- 解析 wares.xml 提取 57 个 research ware
- 生成 research.json（含 items 数组，包含 nameId、descriptionId、unlock 含 nameId params）
- 集成到 `x4_data_processor.py` 的 `run_for_config()` 和 `save()` 流水线
- 通过 `refresh_exported_i18n()` 将 research 的 nameId/descriptionId/unlock nameId 全部纳入游戏数据 locale

### Out of Scope

- 前端 Vue 组件（由 research-view change 处理）
- 测试代码

## 验收标准（DoD）

1. `npm run build` 成功
2. `research.json` 包含 57 个研究项
3. 每个项含 `id`, `nameId`, `name`, `dlcTag`, `tags`, `category`, `researchTime`, `cost`, `dependencies`
4. `conditional` 项包含 `unlock` 字段（含 `sectorMacro`/`shipWareId` 等 game ID）
5. 分类符合上述 4 类规则：default 30, abandoned 3, mission_progress 9, conditional 15

## 未决项

无
