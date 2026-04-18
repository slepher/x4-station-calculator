# player-stations-table 设计文档

## Architecture

### 存储架构变更

**现状**：
```
localStorage: SavedSaveArchivesState (元数据)
IndexedDB.X4SaveArchiveDB:
  ├─ archive_data: SaveArchive (存档基础数据)
  ├─ archive_data_v9_beta: SaveArchive (Beta 版存档)
  ├─ player_station: PlayerStationRecord[] (每条空间站一条记录)
  └─ player_station_v9_beta: PlayerStationRecord[] (Beta 版空间站)
```

**变更后**：
```
localStorage: SavedSaveArchivesState (元数据)
IndexedDB.x4_save_archive_db (8.0):
  ├─ archive_data: ArchiveDataRecord
  └─ player_stations: PlayerStationsRecord
IndexedDB.x4_save_archive_db_v9_beta (9.0 Beta):
  ├─ archive_data: ArchiveDataRecord
  └─ player_stations: PlayerStationsRecord
```

### 数据流

```
导入存档
  └─ SaveParserWorker 解析原始文件
  └─ postProcessRustSaveArchive 后处理
  └─ addArchive()
      ├─ 写入 archive_data 表 (基础存档，不含 stations/buildstorages)
      └─ 写入 player_stations 表 (一条记录，data 按 sectorMacro 归组)

加载存档
  └─ restoreSelectedArchive(archiveId)
      ├─ 读取 archive_data 表 (基础存档)
      ├─ 读取 player_stations 表 (同一 archiveId)
      ├─ 合并 player_stations/buildstorages 到 sectors
      └─ 返回完整 SaveArchive 对象
```

## Decisions

### 1. 数据库分版本而非表分版本

**决策**：每个游戏版本使用独立数据库，表名固定不变

**原因**：
- 数据库级别隔离更彻底，避免跨版本数据污染
- 表名统一简化代码逻辑，无需动态拼接表名
- Dexie 对多数据库支持良好，通过不同 dbName 初始化

**实现**：
```typescript
// versions.json
{
  "indexeddb_name": "x4_save_archive_db"      // 8.0
}
{
  "indexeddb_name": "x4_save_archive_db_v9_beta"  // 9.0 Beta
}
```

### 2. player_stations 表与 archive_data 共享主键

**决策**：两张表使用相同主键 `archiveId`，每存档一条记录

**原因**：
- 空间站数据与存档元数据一一对应
- 主键相同简化查询逻辑（一次 `get()` 而非 `where().toArray()`)
- 按 sectorMacro 归组存储符合数据原有结构

**数据结构**：
```typescript
interface PlayerStationsRecord {
  id: string        // archiveId
  archiveId: string
  data: {
    player_stations: Record<string, Record<string, PlayerStationEntry>>
    player_buildstorages: Record<string, Record<string, BuildStorageEntry>>
  }
}
```

### 3. 索引设计

**决策**：两张表索引相同：主键 + guid

| 索引 | 用途 |
|------|------|
| id (主键) | 按 archiveId 查询存档 |
| guid | 查询某 GUID 的所有存档版本 |

**原因**：
- archiveId 已等于主键 id，无需单独索引
- guid 索引支持查找同一游戏的多个存档时间点

### 4. 动态数据库创建

**决策**：根据 scopeKey 动态创建数据库实例，缓存到 Map

**原因**：
- 不同版本需不同数据库实例
- 避免每次调用都创建新实例
- 缓存确保同一版本使用同一连接

**实现**：
```typescript
const dbCache = new Map<string, X4SaveArchiveDB>()

function getDB(scopeKey: string): X4SaveArchiveDB {
  const dbName = getDBName(scopeKey)
  let db = dbCache.get(dbName)
  if (!db) {
    db = new X4SaveArchiveDB(dbName)
    dbCache.set(dbName, db)
  }
  return db
}
```

### 5. 加载策略保持现状

**决策**：`restoreSelectedArchive()` 时一次性合并加载完整数据

**原因**：
- 上层代码依赖 `SaveArchive` 完整对象
- 两表主键相同，两次 `get()` 即可完成合并
- 无需引入按需加载，避免 UI 层变更

### 6. 版本迁移策略

**决策**：直接清空旧数据库，不进行数据迁移

**原因**：
- 数据库名变更（`X4SaveArchiveDB` → `x4_save_archive_db`）
- 旧版数据结构不兼容
- 用户可重新导入存档文件

**实现**：
```typescript
export async function clearLegacySaveDB(): Promise<void> {
  dbCache.clear()
  await Dexie.delete('X4SaveArchiveDB')
}
```

## Implementation Notes

### versions.json 更新

```json
{
  "versions": [
    {
      "version": "8.0",
      "indexeddb_name": "x4_save_archive_db"
    },
    {
      "version": "9.0",
      "beta": true,
      "indexeddb_name": "x4_save_archive_db_v9_beta"
    }
  ]
}
```

移除原有 `indexeddb_tables` 配置。

### saveArchiveDB.ts 重构

```typescript
// 新增类型
interface PlayerStationsRecord {
  id: string
  archiveId: string
  data: {
    player_stations: Record<string, Record<string, PlayerStationEntry>>
    player_buildstorages: Record<string, Record<string, BuildStorageEntry>>
  }
}

interface ArchiveDataRecord {
  id: string
  archiveId: string
  data: SaveArchive
}

// DB schema
class X4SaveArchiveDB extends Dexie {
  archive_data!: Table<ArchiveDataRecord>
  player_stations!: Table<PlayerStationsRecord>

  constructor(dbName: string) {
    super(dbName)
    this.version(1).stores({
      archive_data: 'id, archiveId, guid',
      player_stations: 'id, archiveId, guid'
    })
  }
}

// 简化的 CRUD
async function saveArchiveToDB(scopeKey: string, archive: SaveArchive) {
  // 两条 put() 完成存储
}

async function loadArchiveDetailFromDB(scopeKey: string, archiveId: string) {
  // 两次 get() + 合并
}

async function removeArchiveFromDB(scopeKey: string, archiveId: string) {
  // 两次 delete()
}
```

### SectorData 类型保持不变

**决策**：`SectorData` 类型保留 `player_stations` 和 `player_buildstorages` 字段

**原因**：
- 运行时 `SaveArchive` 需要完整数据供上层消费
- 存储时分离，加载时合并
- 类型定义反映运行时完整状态

### useSaveStore.ts 无需变更

- `addArchive()` 调用 `saveArchiveToDB()` 已处理分离
- `restoreSelectedArchive()` 调用 `loadArchiveDetailFromDB()` 已处理合并
- 函数签名和行为不变，无需适配

## Risks

### 1. 多数据库实例管理

**风险**：用户切版本时数据库实例缓存未清理

**缓解**：`clearArchivesFromDB()` 时清理缓存中对应版本的数据库实例

### 2. 类型兼容性

**风险**：上层代码依赖旧版 `PlayerStationRecord` 类型

**缓解**：检查所有导入点，确保仅使用新版类型

### 3. 旧数据库遗留

**风险**：旧 `X4SaveArchiveDB` 未清理占用存储空间

**缓解**：首次使用新版本时调用 `clearLegacySaveDB()` 清理