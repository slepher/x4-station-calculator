# player-stations-table 变更请求

## 目标

将导入存档中的 `player_stations` 和 `player_buildstorages` 从 `SaveArchive.sectors` 内嵌存储分离为独立的 IndexedDB 表记录，实现数据按游戏版本隔离存储，提升大数据量存档的存储和查询效率。

## 已确认方案（审核重点）

### 1. IndexedDB 数据库分版本

**数据库按游戏版本分离**：

- 8.0 正式版：`x4_save_archive_db`
- 9.0 Beta：`x4_save_archive_db_v9_beta`

每个数据库内包含两张表：`archive_data` 和 `player_stations`（表名不再分版本）

### 2. 表结构设计

**archive_data 表**：

```typescript
interface ArchiveDataRecord {
  id: string        // archiveId (主键)
  archiveId: string // archiveId (冗余，用于查询)
  data: SaveArchive // sectors 不再包含 player_stations/player_buildstorages
}
```

**player_stations 表**（主键与 archive_data 相同）：

```typescript
interface PlayerStationsRecord {
  id: string        // archiveId (主键，与 archive_data 相同)
  archiveId: string // archiveId (冗余，用于查询)
  data: {
    player_stations: Record<string, Record<string, PlayerStationEntry>>    // sectorMacro -> code -> entry
    player_buildstorages: Record<string, Record<string, BuildStorageEntry>> // sectorMacro -> code -> entry
  }
}
```

### 3. 索引设计

两张表索引相同：

- 主键 `id`（自动索引，等于 archiveId）
- 索引 `archiveId`（冗余，可用于查询）
- 索引 `guid`（用于按游戏 GUID 查询，一个 GUID 可能对应多个存档时间点）

### 4. 数据存储流程

导入存档时：

1. 从 `SaveArchive.sectors` 提取所有 `player_stations` 和 `player_buildstorages`
2. 按 `sectorMacro` 归组，构建 `PlayerStationsRecord.data` 结构
3. `archive_data` 表写入基础存档数据（不含 player_stations/buildstorages）
4. `player_stations` 表写入空间站数据

### 5. 数据加载流程

`restoreSelectedArchive()` 时：

1. 从 `archive_data` 表加载基础存档元数据
2. 从 `player_stations` 表加载（同一 archiveId）
3. 将 `player_stations` 和 `player_buildstorages` 合并回 `SaveArchive.sectors`
4. 返回完整 `SaveArchive` 对象

### 6. 版本迁移

直接清空旧 `X4SaveArchiveDB` 数据库，不进行数据迁移。

### 7. versions.json 配置

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

移除原有的 `indexeddb_tables` 配置（表名不再分版本）。

## TypeScript 文件修改说明

### src/types/saveArchive.ts

**删除**：

```typescript
export type PlayerStationType = 'station' | 'buildstorage'

export interface PlayerStationRecord {
  id: string
  archiveId: string
  sectorMacro: string
  code: string
  type: PlayerStationType
  data: PlayerStationEntry | BuildStorageEntry
}
```

**新增**：

```typescript
export interface PlayerStationsRecord {
  id: string        // archiveId
  archiveId: string
  data: {
    player_stations: Record<string, Record<string, PlayerStationEntry>>
    player_buildstorages: Record<string, Record<string, BuildStorageEntry>>
  }
}
```

### src/assets/versions.json

**修改**：

移除 `indexeddb_tables` 配置，新增 `indexeddb_name` 配置：

```json
{
  "versions": [
    {
      "version": "8.0",
      "indexeddb_name": "x4_save_archive_db",
      "storage_keys": {
        "save_archives": "x4_save_archives"
      }
    },
    {
      "version": "9.0",
      "beta": true,
      "indexeddb_name": "x4_save_archive_db_v9_beta",
      "storage_keys": {
        "save_archives": "x4_save_archives_v9_beta"
      }
    }
  ]
}
```

### src/db/saveArchiveDB.ts

**核心变更**：

1. **数据库类改为动态创建**，根据版本配置选择数据库名：

```typescript
import { getVersionConfig } from '@/utils/versionConfig'

function getDBName(scopeKey: string): string {
  const config = getVersionConfig(scopeKey)
  return config.indexeddb_name ?? 'x4_save_archive_db'
}

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
```

2. **DB 实例缓存改为 Map**：

```typescript
const dbCache: Map<string, X4SaveArchiveDB> = new Map()

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

3. **saveArchiveToDB 函数重构**：

```typescript
export async function saveArchiveToDB(scopeKey: string, archive: SaveArchive): Promise<void> {
  const db = getDB(scopeKey)
  const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)
  
  // 提取 player_stations 和 player_buildstorages
  const playerStationsData: Record<string, Record<string, PlayerStationEntry>> = {}
  const playerBuildstoragesData: Record<string, Record<string, BuildStorageEntry>> = {}
  
  for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
    if (sector.player_stations) {
      playerStationsData[sectorMacro] = sector.player_stations
    }
    if (sector.player_buildstorages) {
      playerBuildstoragesData[sectorMacro] = sector.player_buildstorages
    }
  }
  
  // 移除 player_stations 和 player_buildstorages
  const strippedArchive = stripPlayerStationsFromArchive(archive)
  
  await db.transaction('rw', [db.archive_data, db.player_stations], async () => {
    await db.archive_data.put({
      id: archiveId,
      archiveId,
      data: strippedArchive
    })
    
    await db.player_stations.put({
      id: archiveId,
      archiveId,
      data: {
        player_stations: playerStationsData,
        player_buildstorages: playerBuildstoragesData
      }
    })
  })
}
```

4. **loadArchiveDetailFromDB 函数重构**：

```typescript
export async function loadArchiveDetailFromDB(scopeKey: string, archiveId: string): Promise<SaveArchive | null> {
  const db = getDB(scopeKey)
  
  const archiveRecord = await db.archive_data.get(archiveId)
  if (!archiveRecord) return null
  
  const stationsRecord = await db.player_stations.get(archiveId)
  
  return mergePlayerStationsIntoArchive(archiveRecord.data, stationsRecord?.data)
}

function mergePlayerStationsIntoArchive(
  archive: SaveArchive,
  stationsData?: { player_stations: Record<string, Record<string, PlayerStationEntry>>; player_buildstorages: Record<string, Record<string, BuildStorageEntry>> }
): SaveArchive {
  if (!stationsData) return archive
  
  const mergedSectors: Record<string, SectorData> = { ...archive.sectors }
  
  for (const [sectorMacro, sector] of Object.entries(mergedSectors)) {
    if (sector) {
      sector.player_stations = stationsData.player_stations[sectorMacro] ?? {}
      sector.player_buildstorages = stationsData.player_buildstorages[sectorMacro] ?? {}
    }
  }
  
  return { ...archive, sectors: mergedSectors }
}
```

5. **removeArchiveFromDB 函数简化**：

```typescript
export async function removeArchiveFromDB(scopeKey: string, archiveId: string): Promise<void> {
  const db = getDB(scopeKey)
  
  await db.transaction('rw', [db.archive_data, db.player_stations], async () => {
    await db.archive_data.delete(archiveId)
    await db.player_stations.delete(archiveId)
  })
}
```

6. **clearArchivesFromDB 函数简化**：

```typescript
export async function clearArchivesFromDB(scopeKey: string): Promise<void> {
  const db = getDB(scopeKey)
  await db.archive_data.clear()
  await db.player_stations.clear()
}
```

7. **clearLegacySaveDB 函数**（清理旧数据库）：

```typescript
export async function clearLegacySaveDB(): Promise<void> {
  dbCache.clear()
  await Dexie.delete('X4SaveArchiveDB')
}
```

8. **移除旧函数**：

```typescript
// 删除
export async function loadPlayerStationsByArchiveId(scopeKey: string, archiveId: string): Promise<PlayerStationRecord[]>
function createStationRecordId(archiveId: string, code: string): string
function getArchiveDataTable(scopeKey: string): Table<ArchiveDataRecord>
function getPlayerStationTable(scopeKey: string): Table<PlayerStationRecord>
```

## 边界

### In Scope

- `src/db/saveArchiveDB.ts` - IndexedDB 数据库和表结构重构
- `src/store/useSaveStore.ts` - 加载/保存流程适配
- `src/assets/versions.json` - 配置项变更
- `src/types/saveArchive.ts` - 类型定义变更
- `src/workers/saveParser.post.ts` - 后处理函数适配（无需修改，数据结构不变）

### Out of Scope

- `npc_stations`, `xenon_stations`, `khaak_stations` 等其他 POI 类型的存储变更
- UI 组件变更（加载策略保持现状，UI 无感知）
- 测试代码（由 `/x4:test` 处理）

## 验收标准（DoD）

1. **存储正确性**：导入存档后，`archive_data` 和 `player_stations` 表中能正确查询到对应数据
2. **加载正确性**：`loadArchiveDetailFromDB()` 返回的 `SaveArchive` 包含完整的 `player_stations` 和 `player_buildstorages` 数据
3. **版本隔离**：不同游戏版本使用独立数据库，互不干扰
4. **索引查询**：通过 `guid` 索引能高效查询某 GUID 的所有存档
5. **数据清理**：能正确清理旧版 `X4SaveArchiveDB` 数据库
6. **编译通过**：`npm run build` 无编译错误

## 未决项

无