# design.md — faction-binding

## 架构

仿 `blueprints.rs` 模式，在 `rust-parser/src/` 下新增 `faction.rs`：

```
rust-parser/src/
├── faction.rs         # FactionParser: open() / close() / 数据 accessor
├── model.rs           # SaveArchive 新增 player_relations / player_licences 字段
├── core.rs            # 集成 FactionParser
└── lib.rs             # 注册 mod faction;
```

## 数据流

```
存档 XML <factions><faction id="player">
  ├── <relations>
  │     ├── <relation faction="argon" relation="0.1"/>
  │     └── <relation faction="xenon" relation="-1"/>
  └── <licences>
        ├── <licence type="station_gen_basic" factions="antigone argon"/>
        └── <licence type="capitalship" factions="terran"/>
          ↓ core.rs open() → faction.open(name, attrs, path)
          ↓ FactionParser 维护 HashMap<String, f64> + HashMap<String, Vec<String>>
          ↓ core.rs finish_archive() → SaveArchive { player_relations, player_licences }
          ↓ serde_json → archive JSON
```

## 关键决策

### 1. 解析策略：基于 faction id="player" 进入上下文

`FactionParser` 使用标志位 `in_player_faction: bool` 控制数据收集范围：

```rust
pub(crate) struct FactionParser {
    player_relations: HashMap<String, f64>,
    player_licences: HashMap<String, Vec<String>>,
    in_player_faction: bool,
}
```

- `open()`: name == "faction" && attrs["id"] == "player" → `in_player_faction = true`
- `in_player_faction` 为 true 时，识别 `<relation>` 和 `<licence>` 元素收集数据
- `close()`: name == "faction" && `in_player_faction` → 复位标志位

### 2. 与 `blueprints.rs` 一致：不传额外路径参数

`FactionParser::open()` 接受 `(name, attrs, path)`，与 `BlueprintsParser::open()` 签名一致：

```rust
pub(crate) fn open(
    &mut self,
    name: &str,
    attrs: &HashMap<String, String>,
    _path: &VecDeque<String>,
)
```

不依赖 `path` 做路径匹配，仅通过 `in_player_faction` 标志位 + `name` 匹配元素。

### 3. licence 同一 type 多条合并

若玩家 faction 内同一 `type` 出现多个 `<licence>` 元素（XML 中极罕见），采用**合并去重**策略：

```rust
// 每个 type 收集到的 factions 去重
let existing = self.player_licences.entry(licence_type).or_default();
for f in factions.split_whitespace() {
    let f = f.to_string();
    if !existing.contains(&f) {
        existing.push(f);
    }
}
```

### 4. 序列化字段命名

使用 serde `#[serde(rename_all = "camelCase")]` 确保 Archive JSON 中 key 为：

- `playerRelations` (Rust: `player_relations`)
- `playerLicences` (Rust: `player_licences`)

### 5. SaveArchive 新增字段

```rust
#[derive(Clone, Serialize)]
pub(crate) struct SaveArchive {
    // ...existing fields...
    pub(crate) player_blueprints: Vec<String>,
    pub(crate) player_relations: HashMap<String, f64>,
    pub(crate) player_licences: HashMap<String, Vec<String>>,
}
```

### 6. core.rs 集成点

- `SaveParserCore` 新增 `faction: FactionParser` 字段
- `new()`: 初始化 `faction: FactionParser::default()`
- `open()`: 在 `self.blueprints.open(...)` 同位置添加 `self.faction.open(name, a, &self.path);`
- `close()`: 在 `self.blueprints.close(name)` 同位置添加 `self.faction.close(name);`
- `finish_archive()`: 添加:
  ```rust
  player_relations: self.faction.relations().clone(),
  player_licences: self.faction.licences().clone(),
  ```

### 7. TS 端类型与 DB 对齐

**`src/types/saveArchive.ts`**:
```ts
export interface SaveArchive {
  // ...
  playerBlueprints?: string[]
  playerRelations?: Record<string, number>        // 新增
  playerLicences?: Record<string, string[]>       // 新增
}

export interface PlayerStationsRecord {
  data: {
    // ...
    player_blueprints: string[]
    player_relations: Record<string, number>       // 新增
    player_licences: Record<string, string[]>      // 新增
  }
}
```

**`src/db/saveArchiveDB.ts`**:
- `stripPlayerStationsFromArchive`: 删除 `playerRelations: ___, playerLicences: ____`（与 `playerBlueprints` 并列）
- `extractPlayerStationsData`: 返回 `player_relations: archive.playerRelations ?? {}` / `player_licences: archive.playerLicences ?? {}`
- `mergePlayerStationsIntoArchive`: 回填 `playerRelations: stationsData.player_relations ?? {}` / `playerLicences: stationsData.player_licences ?? {}`
