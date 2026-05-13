# Save Archive Infrastructure - design.md

## Architecture Overview

整个基础设施分为四个层次：

```
┌──────────────────────────────────────────────────────────────────┐
│                        TopViewSwitch                              │
│   [量化生产] [星区地图] [逻辑组网] [船只建造] [存档同步]            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SaveImportView                                │
│  ┌─────────────────────┐  ┌────────────────────────────────┐    │
│  │   SaveUploadPanel   │  │      SaveDetailPanel           │    │
│  │  ┌───────────────┐  │  │  ┌────────────────────────┐    │    │
│  │  │ UploadZone    │  │  │  │ SectorList             │    │    │
│  │  │ (drag/select) │  │  │  │ - stations (4 groups)  │    │    │
│  │  └───────────────┘  │  │  │ - datavaults           │    │    │
│  │                     │  │  │ - erlkingVaults        │    │    │
│  │  ┌───────────────┐  │  │  │ - abandonedShips       │    │    │
│  │  │ SaveList      │  │  │  └────────────────────────┘    │    │
│  │  │ (by guid)     │  │  │                                │    │
│  │  └───────────────┘  │  │                                │    │
│  └─────────────────────┘  └────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      useSaveStore (Pinia)                         │
│  - savedArchivesState: SavedSaveArchivesState (localStorage)     │
│  - selectedArchive: SaveArchive | null (IndexedDB body)          │
│  - isParsing, parseProgress, parseError                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Persistence Layer                               │
│  localStorage (versioned scopeKey):                                │
│    { version, activeArchiveId, list: ArchiveMeta[], settings }     │
│                                                                   │
│  IndexedDB (per-version database):                                 │
│    ├─ archive_data: { id, archiveId, data: SaveArchive }          │
│    └─ player_stations: { id, archiveId, data: {                  │
│         player_stations, player_buildstorages } }                 │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Import / Export Pipeline                          │
│  normalize → migrate → sanitize → re-process → apply → refresh   │
│  Export: buildExportPayload({ x4_save_archives })                 │
│  Import: applyImportPayload → applySaveImport                     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Rust Parser Worker (WASM)                         │
│  High-performance XML parsing with incremental gunzip             │
│  Three-stage protocol: parse_start / parse_chunk / parse_end      │
│  Progress reporting via ProgressInfo                              │
└──────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### D1: Rust/WASM Streaming Parser

**问题**: 存档文件可达 100MB+，直接解析会阻塞 UI。

**方案**: 使用 Rust 编译为 WebAssembly，在 Web Worker 中执行流式解析。

- 三段式协议：parse_start（filename/currentVersion/expectedTotalBytes）→ parse_chunk（原始字节）→ parse_end
- gzip 检测、header/trailer 处理、增量 gunzip 全部在 Rust/WASM 内完成
- Worker 向主线程报告 ProgressInfo 进度（phase/percent/sectorCount/tagCount）
- 坐标累加采用 position 栈（component 层级 offset）
- SAX 解析链路冻结为兼容/备用用途，后续演进只进入 Rust/WASM

### D2: parser/post-processor 双层版本管理

**问题**: 单一版本号无法区分"原始 parser 产物过期"和"后处理逻辑过期"。

**方案**: `parser_version` 表示 parser 原始产物版本，`post_processor_version` 表示后处理版本。

- 当前基线：`parser_version = "v2"`, `post_processor_version = "v2"`
- parser_version 不匹配 → 标记 isValid=false，保留列表但禁止深层消费
- post_processor_version 不匹配 → 自动重新执行 postProcess
- 版本常量定义在 `src/workers/saveParser.post.ts`

### D3: 版本化 localStorage + IndexedDB 分工

**问题**: 存档需支持版本隔离，同时保证目录状态轻量和正文存储可靠。

**方案**: localStorage 存储轻量目录状态，IndexedDB 存储完整正文。

- localStorage 保存：`SavedSaveArchivesState { version, activeArchiveId, list: ArchiveMeta[], settings }`
- IndexedDB 仅保存完整 `SaveArchive` 正文
- 使用 `getStorageKey('save_archives')` 实现版本作用域隔离
- 新增/更新/删除/清空全部按当前作用域操作
- 不同版本数据完全隔离，无串读串写

### D4: 数据库按游戏版本分离 + 玩家空间站独立表

**问题**: 玩家空间站数据量大需分离，同时多版本需数据库级隔离。

**方案**: 每个游戏版本使用独立数据库，表名固定，player_stations 独立为表。

- 数据库名：`versions.json` 中 `indexeddb_name` 配置（如 `x4_save_archive_db`）
- 两张表 `archive_data` 和 `player_stations`，主键共享（archiveId）
- player_stations 表 data 按 sectorMacro 归组存储
- 导入时分离写入，加载时合并恢复，UI 层无感知
- 数据库实例缓存到 Map，按 scopeKey 动态获取

### D5: Save 模块接入导入导出系统

**问题**: 需将存档纳入导入导出系统，但对版本匹配要求更严格。

**方案**: Save 作为第四模块，版本/parser_version 强制匹配，不匹配的跳过。

- 导出结构：`{ state: SavedSaveArchivesState, archives: SaveArchive[] }`
- 导入流水线：normalize → migrate → sanitize → re-process → apply → context refresh
- sanitize 特殊规则：版本或 parser_version 不匹配的存档跳过（非清理无效引用）
- 同名存档（相同 guid+time）覆盖
- 全选不自动勾选 Save，避免误导出大文件
- 导入后 maps 视图 context refresh

### D6: 旧结构清理策略

**问题**: 功能未正式上线，旧 IndexedDB 结构与新结构不兼容。

**方案**: 不做数据迁移，条件满足时直接清理旧库。

- 遍历所有版本配置的 save storage key
- 全部不存在 → 清理旧 X4SaveArchiveDB
- 任意存在 → 跳过清理

## Data Models

### SavedSaveArchivesState (localStorage)
```typescript
interface SavedSaveArchivesState {
  version: number
  activeArchiveId: string | null
  list: ArchiveMeta[]
  settings: {
    visibility: SavePoiVisibility
    excludeConditionalSmallStations: boolean
  }
}
```

### ArchiveMeta (localStorage list entry)
```typescript
interface ArchiveMeta {
  id: string              // ${guid}_${time}
  guid: string
  time: number
  playerName: string
  version: string
  filename: string
  parser_version: string
  post_processor_version?: string
  source: 'original' | 'imported'
  isCompatible: boolean
  isValid: boolean
  createdAt: Date
  sectorCount: number
}
```

### IndexedDB Records
```typescript
interface ArchiveDataRecord {
  id: string              // archiveId
  archiveId: string
  data: SaveArchive       // without player_stations/player_buildstorages
}

interface PlayerStationsRecord {
  id: string              // archiveId
  archiveId: string
  data: {
    player_stations: Record<string, Record<string, PlayerStationEntry>>
    player_buildstorages: Record<string, Record<string, BuildStorageEntry>>
  }
}
```

### SaveArchiveExportData (import/export payload)
```typescript
interface SaveArchiveExportData {
  state: SavedSaveArchivesState
  archives: SaveArchive[]
}
```

## File Structure

```
src/
├── assets/
│   ├── versions.json                # storage_keys.save_archives + indexeddb_name
│   └── x4_game_data/*/data/maps.json # zones 改为对象，zone_id 统一小写
├── components/
│   └── save/
│       ├── SaveImportView.vue
│       ├── SaveUploadPanel.vue
│       ├── saveUploadStreaming.ts
│       ├── SaveList.vue
│       ├── SaveListItem.vue
│       ├── SaveDetailPanel.vue
│       └── SectorDetailList.vue
├── common/importExport/
│   └── importExport.ts             # SAVE_KEY, sanitize, apply, reprocess, etc.
├── db/
│   └── saveArchiveDB.ts            # 动态数据库，两表：archive_data + player_stations
├── locales/
│   ├── en.json
│   └── zh-CN.json
├── store/
│   ├── useSaveStore.ts             # 版本化 localStorage + IndexedDB body
│   └── useGameDataStore.ts         # getStorageKey('save_archives')
├── types/
│   └── saveArchive.ts              # SaveArchive, PlayerStationsRecord, etc.
├── workers/
│   ├── saveParserRust.worker.ts    # Rust WASM worker (UI)
│   ├── saveParser.worker.ts        # SAX worker (CLI default, frozen)
│   └── saveParser.post.ts          # postProcess, CURRENT_PARSER_VERSION, etc.
├── wasm/
│   ├── save_parser.js
│   ├── save_parser_bg.wasm
│   └── save_parser.d.ts
└── utils/
    ├── saveParserConfig.ts
    ├── saveResourceExtract.ts
    └── saveJsonFormat.ts

scripts/
└── extract_save.tsx                # CLI extraction tool (--wasm, --skip-post)

rust-parser/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── model.rs
│   ├── core.rs
│   └── stream.rs
└── pkg/
    ├── save_parser.js
    ├── save_parser_bg.wasm
    └── save_parser.d.ts
```

## Integration Points

- **TopViewSwitch**: 新增 `{ key: 'save-import', label: t('view.save_import') }`
- **MainWorkbench**: 条件渲染 `<SaveImportView v-else-if="isSaveImportView" />`
- **GameDataStore**: 版本校验 `currentVersion`，strings 表，`getStorageKey('save_archives')`
- **importExport.ts**: `SAVE_KEY = 'x4_save_archives'`，扩展 `ImportModuleKey`
- **maps view**: 存在激活存档时直接渲染，context refresh 在导入后触发
