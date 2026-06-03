# Blueprints Specification

## ADDED Requirements

### Requirement: Game Data Blueprint Catalog Generation

data_processor SHALL generate `blueprints.json` containing all non-noblueprint game data items with name, type, subtype, and optional metadata.

#### Scenario: skip noblueprint items

- **前提** game data 中存在 `noblueprint: true` 的条目
- **当** data_processor 生成 `blueprints.json`
- **那么** 这些条目 SHALL NOT 出现在输出中

#### Scenario: filter noplayerblueprint items

- **前提** game data 中存在 `noplayerblueprint: true` 的条目
- **当** data_processor 生成 `blueprints.json`
- **那么** 这些条目 SHALL 输出 `noplayerblueprint: true`
- **并且** `noplayerblueprint: false` 的条目 SHALL 省略该字段

#### Scenario: output core fields

- **前提** game data 条目包含 `id`, `nameId`, `type`
- **当** data_processor 生成 `blueprints.json`
- **那么** 每条 SHALL 包含 `id`, `name`, `nameId`, `type`, `subtype`
- **并且** `name` 由 `inject_english_names()` 注入英文名

#### Scenario: output optional fields

- **前提** game data 条目包含 `averageprice`, `restriction.licence`, `owner.faction`
- **当** data_processor 生成 `blueprints.json`
- **那么** 存在值时 SHALL 输出 `price`, `licence`, `factions`
- **并且** 缺失值时 SHALL 省略对应字段

#### Scenario: missiononly detection

- **前提** game data 条目 `tags` 包含 `missiononly`
- **当** data_processor 生成 `blueprints.json`
- **那么** 该条目 SHALL 输出 `missiononly: true`
- **并且** 不含 `missiononly` 的条目 SHALL 省略该字段

#### Scenario: equipment type unification

- **前提** 条目来源于 equipments.json / missiles.json / consumables.json / drones.json
- **当** data_processor 生成 `blueprints.json`
- **那么** `type` SHALL 统一为 `"equipment"`
- **并且** `subtype` SHALL 保留原名（如 `shields`, `turrets`, `missile`, `consumable`, `drone`）

### Requirement: faction_blueprints and general_blueprints Summary

data_processor SHALL generate `faction_blueprints` and `general_blueprints` summary structures in `blueprints.json`.

#### Scenario: faction_blueprints structure

- **前提** `blueprints` 数组包含 class/factions/licence 信息
- **当** data_processor 生成 `blueprints.json`
- **那么** SHALL 输出 `faction_blueprints` 字段，结构为 `{ <class>: { <faction>: { <licence>: <count> } } }`
- **并且** 无 factions 或无 licence 的蓝图 SHALL NOT 纳入

#### Scenario: general_blueprints structure

- **前提** `blueprints` 数组包含 class 信息
- **当** data_processor 生成 `blueprints.json`
- **那么** SHALL 输出 `general_blueprints` 字段，结构为 `{ <class>: <count> }`
- **并且** count SHALL 为该 class 下所有蓝图总数

### Requirement: Save XML Blueprint List Extraction

rust parser 通过独立模块 `blueprints.rs` SHALL 提取玩家已掌握的蓝图 ID 列表。

#### Scenario: locate blueprints block in universe

- **前提** 存档 XML 中 `<universe>` 包含 `<blueprints>` block
- **当** rust parser 解析存档
- **那么** parser SHALL 提取 `<blueprints>` 内每个 `<blueprint ware="..."/>` 的 `ware` 属性
- **并且** 输出为 `player_blueprints: string[]`

#### Scenario: store in archive and IndexedDB

- **前提** archive 包含 `player_blueprints`
- **当** archive 写入 IndexedDB
- **那么** `player_stations.data.player_blueprints` SHALL 包含该数据
- **并且** strip/extract/merge 与 `terraforming_clusters` 相同模式

#### Scenario: backward compatible missing field

- **前提** 旧 IndexedDB 记录没有 `player_blueprints`
- **当** 读取 archive
- **那么** 系统 SHALL 将其视为 `[]`，且不抛错
