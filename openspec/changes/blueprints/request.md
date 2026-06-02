# request.md — blueprints

## 目标

仿 `research-data` 模式，在 `scripts/x4_data_processor.py` 的数据处理流水线中新增 `blueprints.json` 生成模块。从 game data XML library 中提取所有非 `noblueprint` 的模块/飞船/装备/导弹/消耗品/无人机条目，输出蓝图目录文件。同时在 rust parser 中新增对存档 `<blueprints>` block 的解析，提取玩家已掌握蓝图 ID 列表。

## 已确认方案（审核重点）

### 1. Game Data 蓝图目录生成（data_processor 新增）

#### 1.1 数据来源

`process_blueprints(loader)` 直接从 data_processor 的 loader 内存数据（`loader.all_modules` / `loader.ships_data` / `loader.equipments_data` / `loader.missiles_data` / `loader.consumables_data` / `loader.drones_data`）逐条提取。这些数据由 data_processor 从原始 XML 解析而来。

#### 1.2 过滤规则

- `noblueprint: true` → 跳过，不输出
- `noplayerblueprint: true` → 保留，标记 `noplayerblueprint: true`

#### 1.3 字段

| 字段 | 来源 | 说明 |
|------|------|------|
| `id` | `.id` | |
| `name` | 英文名 | 由 `inject_english_names()` 注入 |
| `nameId` | `.nameId` | `{page,id}` 格式 |
| `type` | 来源 tags | `module` / `ship` / `equipment` |
| `class` | 见下表 | |
| `price` | `.averageprice` / `.buildCost` / `.cost` 汇总 | 缺失或为零时省略 |
| `licence` | `.restriction.licence` | 缺失则省略 |
| `factions` | `.owner.faction` 或 `.race` | 数组，缺失则省略 |
| `missiononly` | `.tags` 含 `missiononly` | false 时省略该字段 |
| `noplayerblueprint` | `.noplayerblueprint` | false 时省略该字段 |

#### 1.4 class 映射

| type | class 来源 |
|------|-------------|
| `module` | `.type` (production, storage, dockarea, ...) |
| `ship` | `.class` (ship_s, ship_m, ship_l, ship_xl) |
| `equipment` | `.type` / `missile` / `consumable` / `drone` |

equipment / missile / consumable / drone 统一 `type: "equipment"`。

#### 1.5 nameId 处理

- `nameId` 加入 `i18n_collector`，由 `refresh_exported_i18n()` 同步到游戏数据 locale 文件
- 英文名由 `inject_english_names()` 注入 `name` 字段

### 2. 存档蓝图列表提取（rust parser 新增）

#### 2.1 数据来源

存档 XML 中 `<universe>` 下的 `<blueprints>` block：

```xml
<universe>
  <blueprints>
    <blueprint ware="module_ter_prod_energycells_01"/>
    <blueprint ware="clothingmod_0001"/>
    ...
  </blueprints>
</universe>
```

`<blueprints>` 位于 `<universe>` 内，与 `<known>` 平级。

#### 2.2 提取方式

- rust parser 识别 `<blueprints>` tag，遍历子 `<blueprint>` 元素
- 提取 `ware` 属性即蓝图 ID
- 输出为字符串数组：`["module_ter_prod_energycells_01", "clothingmod_0001", ...]`

#### 2.3 存储位置

- 写入 `SaveArchive.player_blueprints: string[]`
- `PlayerStationsRecord.data.player_blueprints` 同 player_stations/buildstorages/research/terraforming_clusters 平级
- strip/extract/merge 与 terraforming_clusters 相同模式

### 3. 模块结构

`scripts/x4-game/blueprints/`（仿 `scripts/x4-game/research/`）：
- `build.py`: 主编排函数 `process_blueprints(loader)`，输出挂载到 `loader.blueprints_data`
- `run.py`: 独立运行入口，`python scripts/x4-game/blueprints/run.py --version 9.0`

### 4. 集成点（仿 research-data）

**`x4_data_processor.py`：**
- `run_for_config()` — research 之后调用 `process_blueprints(loader)`
- `save()` — 检查 `loader.blueprints_data` 写入 `blueprints.json`
- 动态导入 `_get_process_blueprints()`
- `inject_english_names()` — 处理 blueprint nameId

## 边界

### In Scope

- Game data 蓝图目录生成（blueprints.json），含 name/nameId/type/subtype/price/licence/factions/missiononly/noplayerblueprint
- rust parser 解析存档 `<blueprints>` block，提取 players 已掌握蓝图 ID 列表
- 存档蓝图列表持久化（IndexedDB strip/extract/merge）
- `scripts/x4-game/blueprints/run.py` 独立运行入口
- nameId 纳入 i18n_collector，刷新游戏数据 locale

### Out of Scope

- 前端 UI 展示
- 蓝图与模块选择器联动筛选
- 测试代码

## 验收标准（DoD）

1. `npm run build` 成功
2. `blueprints.json` 由 data_processor 生成，不包含 `noblueprint` 条目
3. 每条含 `id`, `name`, `nameId`, `type`, `class`
4. `price` / `licence` / `factions` / `missiononly` 按规则输出（缺失或 false 时省略）
5. equipment/missile/consumable/drone 统一 `type: "equipment"`
6. 存档解析后 archive JSON 包含 `player_blueprints` 字符串数组
7. IndexedDB 中 `player_stations.data.player_blueprints` 与同级字段一致，旧记录缺失不报错

## 未决项

无
