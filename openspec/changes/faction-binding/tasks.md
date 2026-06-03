# tasks.md — faction-binding

## 实施任务

### 1. Rust: faction.rs 模块

- [x] 创建 `rust-parser/src/faction.rs`
- [x] 定义 `FactionParser` 结构体（`player_relations: HashMap<String, f64>`, `player_licences: HashMap<String, Vec<String>>`, `in_player_faction: bool`）
- [x] 实现 `FactionParser::open()`:
  - name == "faction" && attrs["id"] == "player" → `in_player_faction = true`
  - `in_player_faction` && name == "relation" → 读取 `faction` + `relation` 属性，插入 `player_relations`
  - `in_player_faction` && name == "licence" → 读取 `type` + `factions` 属性，split 后合并到 `player_licences`
- [x] 实现 `FactionParser::close()`:
  - name == "faction" && `in_player_faction` → 复位标志位
- [x] 实现 accessor 方法:
  - `relations() -> &HashMap<String, f64>`
  - `licences() -> &HashMap<String, Vec<String>>`

### 2. Rust: model.rs 更新

- [x] `SaveArchive` 结构体新增 `player_relations: HashMap<String, f64>` 字段
- [x] `SaveArchive` 结构体新增 `player_licences: HashMap<String, Vec<String>>` 字段

### 3. Rust: lib.rs 注册模块

- [x] 添加 `mod faction;`

### 4. Rust: core.rs 集成

- [x] 导入 `use crate::faction::FactionParser;`
- [x] `SaveParserCore` 新增 `faction: FactionParser` 字段
- [x] `new()` 中初始化 `faction: FactionParser::default()`
- [x] `open()` 中添加 `self.faction.open(name, a, &self.path);`
- [x] `close()` 中添加 `self.faction.close(name);`
- [x] `finish_archive()` 中添加 `player_relations` / `player_licences` 字段引用

### 5. TS: 类型定义

- [x] `src/types/saveArchive.ts`: `SaveArchive` 新增 `playerRelations?: Record<string, number>` / `playerLicences?: Record<string, string[]>`
- [x] `src/types/saveArchive.ts`: `PlayerStationsRecord.data` 新增 `player_relations` / `player_licences`

### 6. TS: IndexedDB 持久化

- [x] `src/db/saveArchiveDB.ts`: `stripPlayerStationsFromArchive` 中排除 `playerRelations` / `playerLicences`
- [x] `src/db/saveArchiveDB.ts`: `extractPlayerStationsData` 中提取 `player_relations` / `player_licences`（默认 `{}`）
- [x] `src/db/saveArchiveDB.ts`: `mergePlayerStationsIntoArchive` 中回填 `playerRelations` / `playerLicences`

### 7. 构建验证

- [x] `npm run build-rust`（rust parser WASM 编译）
- [x] `npm run build`（完整项目编译，含 TS 类型检查）
