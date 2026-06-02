# design.md — blueprints

## 架构

仿 `research-data` 模式，新增 `scripts/x4-game/blueprints/` 目录：

```
scripts/x4-game/blueprints/
├── __init__.py
├── build.py          # process_blueprints(loader) + build_blueprints_data()
└── run.py            # 独立运行入口: python scripts/x4-game/blueprints/run.py --version 9.0
```

## 数据流

```
data_processor XML 解析产物 (loader 内存数据)
  loader.all_modules / loader.ships_data / loader.equipments_data
  loader.missiles_data / loader.consumables_data / loader.drones_data
    → build_blueprints_data()
      → 逐条映射 id/nameId/type/subtype/price/licence/factions/tags
      → 过滤 noblueprint: true
      → 写入 loader.blueprints_data
    → save() → data/blueprints.json
```

## 关键决策

### 1. 数据来源：data_processor 已解析的 XML 数据

在 data_processor 流水线中，`process_blueprints(loader)` 直接访问 loader 上已由 XML 解析填充的模块/飞船/装备等数据列表。run.py 通过同款 loader 实例从原始 XML 生成数据后调用同一函数。

### 2. 过滤规则

- `noblueprint: true` → 跳过（这些条目在游戏中没有对应的蓝图）
- `noplayerblueprint: true` → 保留，标记 `noplayerblueprint: true`

### 3. type 统一与 class 归并

- equipments / missiles / consumables / drones → `type: "equipment"`
- `missileturret` → `turret`
- `missilelauncher` → `weapon`
- `ship_xs` / `ship_s`（equipment 条目） → `drone`
- `mine` / `satellite` / `scanner` / `countermeasure` / `navbeacon` / `resourceprobe`（equipment 条目） → `consumable`

### 4. 字段省略规则

| 字段 | 省略条件 |
|------|---------|
| `price` | `.averageprice` 为 null/undefined/0 |
| `licence` | `.restriction.licence` 不存在 |
| `factions` | `.owner.faction` 不存在且 `.factions` 为空 |
| `missiononly` | `.tags` 不包含 `missiononly` |
| `noplayerblueprint` | 为 false/undefined |

### 5. nameId 处理

每个 blueprints 条目的 `nameId` 加入 `i18n_collector`，由 `refresh_exported_i18n()` 统一刷新到 `src/assets/x4_game_data/{version}/locales/` 目录下的 locale JSON 文件。

英文名由 `inject_english_names()` 写入 `name` 字段，与现有 modules/ships/equipments 的处理方式一致。

### 6. 集成点

在 `x4_data_processor.py` 中：
- `_get_process_blueprints()`: 仿 `_get_process_research()`，延迟导入 `scripts/x4-game.blueprints.build`
- `run_for_config()`: research 之后调用 `process_blueprints(loader)`
- `save()`: 检查 `loader.blueprints_data` 并写入 `blueprints.json`
- `inject_english_names()`: 新增 blueprints 部分的 name 注入

### 7. Standalone (run.py)

仿 `research/run.py`：
```python
"""Standalone script: build blueprints.json from game data XML.

Usage:
    python scripts/x4-game/blueprints/run.py --version 9.0 --beta
"""
```
- 接受 `--version`, `--beta`, `--stable`, `--all-versions`
- 读取 `x4-station-calculator.config.json` 确定数据路径
- 通过 data_processor loader 从原始 XML 解析数据
- 调用 `process_blueprints()` 生成并写入 `blueprints.json`

### 7.1 输出结构

```json
{
  "blueprints": [
    {
      "id": "module_ter_prod_energycells_01",
      "name": "Terran Energy Cell Production",
      "nameId": "{20104,15201}",
      "type": "module",
      "price": 144.0,
      "licence": "station_gen_basic",
      "factions": ["antigone"],
      "class": "production",
      "missiononly": true,
      "noplayerblueprint": true
    }
  ],
  "types": [
    { "id": "module", "name": "", "nameId": "{1001,56}" },
    { "id": "ship", "name": "", "nameId": "{1001,6}" },
    { "id": "equipment", "name": "", "nameId": "{1001,7935}" }
  ],
  "classes": [
    { "id": "production", "name": "Production Modules", "nameId": "{1001,2421}", "type": "module" }
  ]
}
```

字段顺序：`id` → `name` → `nameId` → 其余。

### 8. 存档蓝图解析（rust parser + TS 模块）

存档 XML 中 `<blueprints>` 块位于 `<universe>` 下：

```xml
<universe>
  <known>...</known>
  <blueprints>
    <blueprint ware="module_ter_prod_energycells_01"/>
    <blueprint ware="clothingmod_0001"/>
  </blueprints>
</universe>
```

解析策略：
- 在 `core.rs` 的 `open()` 中识别 `name == "blueprints"`（于 universe 路径下）
- 遍历子 `<blueprint ware="..."/>`，收集 `ware` 属性
- 在 `</blueprints>` 关闭时将列表写入 archive
- 复用现有流式解析架构，不新增读取路径

Archive 输出：
```ts
archive.player_blueprints = ["module_ter_prod_energycells_01", "clothingmod_0001", ...]
```

IndexedDB 持久化：
- `PlayerStationsRecord.data.player_blueprints: string[]`
- strip/extract/merge 与 terraforming_clusters 相同模式
- 旧记录缺失 → `[]`

#### 8.1 Rust 蓝图解析模块

`rust-parser/src/blueprints.rs`（仿 `rust-parser/src/research.rs`）：

```rust
pub(crate) struct BlueprintsParser {
    player_blueprints: Vec<String>,
    in_player_blueprints: bool,
}
```

职责：
- `open()` 中识别 `<blueprints>` tag（于 `<universe>` 路径下）
- 遍历 `<blueprint ware="..."/>`，收集 `ware` 属性
- `</blueprints>` 关闭时将列表写入 archive.player_blueprints
- 复用现有流式解析架构
- 不新增从 save XML 文件开头重新扫描的流程
