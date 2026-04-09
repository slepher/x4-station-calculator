# Map Station Specification

## Purpose
在地图工作台中提供完整的 `SaveBinding` 工作流，使用户可以从首页 binding 入口进入 Step 2 / Step 3，并完成星区组编辑、已有 station 绑定、导入新 station，以及空闲 empire station 的直接放置。

## ADDED Requirements

### Requirement: Binding Entry in Save Homepage

系统 MUST 在存档首页提供 binding 图标入口。

#### Scenario: 用户点击标题 binding 图标
- **前提** 用户位于某个 guid 分组的首页项
- **当** 用户点击标题 binding 图标
- **那么** 系统 SHALL 将该 guid 绑定到最新 time
- **并且** SHALL 进入 Step 2

### Requirement: Step 2 Sector Group Editing

系统 MUST 提供 Step 2 星区组编辑能力。

#### Scenario: 用户编辑 empire sector
- **前提** 用户已进入 Step 2
- **当** 用户展开某个 empire sector
- **那么** 系统 SHALL 允许编辑名称、定位星区、jumpRange、coverage 与连接星区

### Requirement: Step 3 Station Binding

系统 MUST 提供 Step 3 空间站绑定能力。

#### Scenario: 用户在 Step 3 绑定空间站
- **前提** 用户已进入某个 empire sector 的 Step 3
- **当** 用户通过 save station 的绑定入口选择候选 empire station
- **那么** 系统 SHALL 建立或更新对应 station binding

### Requirement: Save Parser Exposes Station Buildstorage Reference

系统 MUST 为 player station 和 buildstorage 保留各自顶层结果，并通过 code 建立引用。

#### Scenario: parser 解析存在 inprogress build 的 player station
- **前提** save 中某个 `component[@class="buildstorage"][@owner="player"]` 存在 `buildtasks/inprogress/build`
- **并且** `build/@component` 命中某个 `component[@class="station"]/@id`
- **当** 系统完成 save parser 提取
- **那么** 对应 `playerStation` SHALL 包含 `component_id`
- **并且** SHALL 包含 station 自己的 `cargo`
- **并且** SHALL 包含 station 自己的 `reservation`
- **并且** SHALL 通过 `buildstorage_code` 保存关联的 buildstorage code
- **并且** 对应 `buildstorage` SHALL 保留在同一 sector 的 `player_buildstorages` 中
- **并且** 对应 `buildstorage` SHALL 通过 `station_code` 保存关联的 station code

#### Scenario: parser 为 buildstorage 提供简洁结构
- **前提** save 中某个 player buildstorage 已命中 player station
- **当** 系统完成 save parser 提取
- **那么** `buildstorage` SHALL 包含：
  - `component_id`
  - `cargo`
  - `reservation`
  - `constructions`
  - `modules`
  - `equipments`
  - `progress`
- **并且** `component_id` 与 `constructions[].id` SHALL 去掉外层 `[]`
- **并且** `constructions[].equipments` SHALL 被保留
- **并且** `progress` SHALL 仅包含 `start`、`end`、`sequenceindex`
- **并且** 系统 SHALL 不解析 `buildtasks/queue/build`

#### Scenario: parser collections use snake_case code maps
- **当前提** 系统完成 save parser 提取
- **那么** `SectorData` 中按 `code` 唯一的实体集合 SHALL 使用 `snake_case`
- **并且** `player_stations` / `npc_stations` / `xenon_stations` / `khaak_stations` / `player_buildstorages` / `datavaults` / `erlking_vaults` / `abandoned_ships` SHALL 为 `Record<code, entry>`
- **并且** `modules` / `equipments` SHALL 为 `Record<ref, entry>`

#### Scenario: parser post enriches module and equipment ids
- **前提** Rust parser 已输出原始聚合 `modules` / `equipments`
- **当** 系统执行 `postProcessRustSaveArchive()`
- **那么** 所有 station 与 `player_buildstorage` 的 `modules[*]` SHALL 补充 `module_id`
- **并且** 所有 station 与 `player_buildstorage` 的 `equipments[*]` SHALL 补充 `equipment_id`
- **并且** `constructions[*].equipments[*]` SHALL 保持 parser 原样，不在 post 中 enrich
