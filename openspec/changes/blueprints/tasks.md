# tasks.md — blueprints

## 实施任务

### 1. 创建 blueprints 模块目录

- [x] 创建 `scripts/x4-game/blueprints/__init__.py`
- [x] 创建 `scripts/x4-game/blueprints/build.py`
- [x] 创建 `scripts/x4-game/blueprints/run.py`

### 2. 实现 build_blueprints_data (build.py)

- [x] 从 data_processor loader 已解析的数据（modules/ships/equipments/missiles/consumables/drones）逐条提取
- [x] 遍历所有条目，映射字段：id, nameId, type, subtype, price (average), licence, factions, missiononly, noplayerblueprint
- [x] 过滤 `noblueprint: true`
- [x] equipment/missile/consumable/drone 统一 `type: "equipment"`
- [x] `missiononly` / `noplayerblueprint` 为 false 时省略
- [x] `price` / `licence` / `factions` 缺失时省略
- [x] nameId 加入 `i18n_collector`
- [x] 返回 dict 挂载到 `loader.blueprints_data`

### 3. 实现 process_blueprints(loader)

- [x] 接收 loader 实例
- [x] 调用 `build_blueprints_data()`
- [x] 挂载 `loader.blueprints_data`

### 4. 实现 run.py 独立运行入口

- [x] 仿 `research/run.py`，支持 `--version`, `--beta`, `--stable`
- [x] 通过 data_processor loader 从原始 XML 解析数据
- [x] 输出 `blueprints.json`

### 5. 集成到 x4_data_processor.py

- [x] 添加 `_get_process_blueprints()` 动态导入
- [x] `run_for_config()` — research 之后调用 `process_blueprints(loader)`
- [x] `save()` — 检查 `loader.blueprints_data` 写入 `blueprints.json`
- [x] `inject_english_names()` — 处理 blueprint nameId

### 6. 定义存档蓝图 TypeScript 类型

- [x] `src/types/saveArchive.ts` 中 `SaveArchive` 新增 `playerBlueprints?: string[]`
- [x] `PlayerStationsRecord.data` 新增 `player_blueprints: string[]`

### 7. 创建 blueprints.rs 解析模块

- [x] 创建 `rust-parser/src/blueprints.rs`（仿 `research.rs`）
- [x] 识别 `<blueprints>` tag，收集 `<blueprint ware="..."/>`
- [x] 集成到现有流式解析流程

### 8. 集成 blueprints.rs 到 rust parser

- [x] `core.rs` 中复用 blueprints 解析器，在 universe 路径下分派
- [x] `finish_archive()` 包含 `player_blueprints`
- [x] `model.rs` 中 `SaveArchive` 新增 `player_blueprints`

### 9. IndexedDB 持久化

- [x] `stripPlayerStationsFromArchive()` 剥离 `player_blueprints`
- [x] `extractPlayerStationsData()` 写入 `data.player_blueprints`
- [x] `mergePlayerStationsIntoArchive()` 合并回 archive
- [x] 旧数据缺失按 `[]` 处理

### 10. 构建验证

- [x] 执行 `npm run build` 确认编译通过
- [ ] 确认 `blueprints.json` 由 data_processor 生成
- [ ] 确认存档解析后 archive JSON 包含 `player_blueprints`
