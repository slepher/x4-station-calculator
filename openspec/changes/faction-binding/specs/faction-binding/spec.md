# Faction Binding Specification

## ADDED Requirements

### Requirement: Save XML Faction Relation Extraction

rust parser 通过新增模块 `faction.rs` SHALL 提取玩家与各 faction 的声望关系。

#### Scenario: locate player faction relations

- **前提** 存档 XML 中 `<universe><factions>` 包含 `<faction id="player">`
- **当** rust parser 解析存档
- **那么** parser SHALL 识别 `<faction id="player">` 进入玩家 faction 上下文
- **并且** 在玩家 faction 上下文中，提取每个 `<relation faction="X" relation="Y"/>` 的 `faction` 和 `relation` 属性
- **并且** 输出为 `player_relations: Record<string, number>`

#### Scenario: ignore non-player faction relations

- **前提** 存档 XML 中存在非 player 的 `<faction id="xxx">` 及其 `<relations>` 子元素
- **当** rust parser 解析存档
- **那么** parser SHALL NOT 提取这些 faction 的 relation 数据

#### Scenario: exit faction context on close

- **前提** player faction 的 `</faction>` 关闭标签到达
- **当** rust parser 解析存档
- **那么** parser SHALL 退出玩家 faction 上下文
- **并且** 后续的 `<relation>` / `<licence>` 元素 SHALL NOT 被收集

### Requirement: Save XML Licence Extraction

rust parser SHALL 提取玩家已解锁的证书列表。

#### Scenario: extract player licences

- **前提** 存档 XML 中玩家 faction 内包含 `<licences>` 块
- **当** rust parser 解析存档
- **那么** parser SHALL 提取每个 `<licence type="T" factions="F1 F2"/>` 元素
- **并且** `type` 作为 key，`factions` 按空格 split 为 `string[]` 作为 value
- **并且** 输出为 `player_licences: Record<string, string[]>`

#### Scenario: handle multiple licences of same type

- **前提** 玩家 faction 内同一 `type` 出现多个 `<licence>` 元素
- **当** rust parser 解析存档
- **那么** parser SHALL 合并 factions 列表（可能去重或保持原始多次收录）

### Requirement: Archive Output Fields

`SaveArchive` SHALL 包含 `player_relations` 和 `player_licences` 字段。

#### Scenario: player_relations in archive

- **前提** rust parser 完成解析
- **当** 调用 `finish_archive()`
- **那么** 返回的 `SaveArchive` SHALL 包含 `player_relations: HashMap<String, f64>`
- **并且** serde 序列化后 key 为 `playerRelations`

#### Scenario: player_licences in archive

- **前提** rust parser 完成解析
- **当** 调用 `finish_archive()`
- **那么** 返回的 `SaveArchive` SHALL 包含 `player_licences: HashMap<String, Vec<String>>`
- **并且** serde 序列化后 key 为 `playerLicences`

### Requirement: IndexedDB Persistence

faction 数据 SHALL 持久化到 IndexedDB，与 `player_blueprints` 相同模式。

#### Scenario: store in player_stations record

- **前提** archive 包含 `player_relations` 和 `player_licences`
- **当** archive 写入 IndexedDB
- **那么** `player_stations.data.player_relations` SHALL 包含声望数据
- **并且** `player_stations.data.player_licences` SHALL 包含证书数据
- **并且** strip/extract/merge 与 `player_blueprints` 相同模式

#### Scenario: backward compatible missing fields

- **前提** 旧 IndexedDB 记录没有 `player_relations` 或 `player_licences`
- **当** 读取 archive
- **那么** 系统 SHALL 将其视为 `{}`（空对象），且不抛错
