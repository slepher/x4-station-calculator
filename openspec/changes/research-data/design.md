# design.md — research-data

## 架构

仿照 `terraforming` 模块，新增 `scripts/x4-game/research/` 目录：

```
scripts/x4-game/research/
├── __init__.py
├── build.py          # process_research(loader) + build_research_data()
└── run.py            # 独立运行入口: python scripts/x4-game/research/run.py --version 8.0
```

## 数据流

```
wares/final.xml
  → parse_wares() 提取 transport="research" 的 <ware>
    → 提取 cost (primary 节点)
    → 提取 dependencies (双层嵌套 research 块)
    → 提取 tags 分类
  → 构建 items[] 数组
  → 写入 loader.research_data
  → save() → data/research.json
```

## 关键决策

### 1. 分类合并

`hidden + missiononly` = `mission_progress`。
仅 `hidden`（不含 `missiononly`）= `abandoned`。

### 2. 依赖解析

使用 XML ElementTree 遍历，而非正则。查找模式：`ware.findall('.//research/research/ware')` 其中 `ware.get('ware')` 以 `research_` 开头。

### 3. game ID 引用

`unlock.params` 存储 game ID，不在本模块内解析为 nameId：

| 参数 | 示例 | 解析来源 |
|------|------|---------|
| `sectorMacro` | `"cluster_31_sector001_macro"` | maps.json sectors |
| `shipWareId` | `"ship_ter_s_fighter_04_a"` | ware_index |
| `itemWareId` | `"inv_condensate_sample"` | ware_index |
| `npcNameId` | `"{30201,2}"` | i18n registry |
| `count` | `2` | 纯数字 |

`npcNameId` 为 `{30201,2}`（Boso Ta），需硬编码加入 `loader.needed_raw_names`。

### 4. 硬编码映射

每个 conditional 项硬编码 unlock key 和 params。

| research ware | key | params |
|-------------|-----|--------|
| agentslot_01/02 | embassy | — |
| diplomacy_network | default | — |
| equipment_xenon | xen_equipment | `{itemWareId}` |
| interference_network | interference_network | `{count}` |
| xenon_crisis_01/02 | xenon_crisis_01/02 | — |
| condensate_sample | condensate_sample | `{npcNameId, itemWareId}` |
| erlking_core | erlking | `{shipWareId}` |
| ship_ter_s_fighter_01 | abandoned_ship | `{sectorMacro, shipWareId}` |
| ship_ter_m_corvette_01 | abandoned_ship | `{sectorMacro, shipWareId}` |
| ship_ter_l_flagship_01 | abandoned_ship | `{sectorMacro, shipWareId}` |
| ship_arg_s_racing_01 | abandoned_ship | `{sectorMacro, shipWareId}` |
| ship_tel_s_racing_01 | abandoned_ship | `{sectorMacro, shipWareId}` |
| ship_par_s_racing_01 | abandoned_ship | `{sectorMacro, shipWareId}` |
| ship_gen_m_corvette_02 | abandoned_ship | `{shipWareId}` (无 sectorMacro) |
| tf_tech | tf_tech | — |

### 5. 集成点

在 `x4_data_processor.py` 中：
- `run_for_config()`: terraforming 之后调用 `process_research(loader)`
- `save()`: 检查 `loader.research_data` 并写入 `research.json`
- `inject_english_names()`: 新增 research 部分的 name 注入
- 动态导入: 仿照 `_get_process_terraforming()` 添加 `_get_process_research()`
