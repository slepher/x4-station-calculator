# player-stations-table 设计文档

## Architecture

### 存储架构变更

**现状**：
```
localStorage: SavedSaveArchivesState (元数据)
IndexedDB.archiveData: SaveArchive (完整存档，含 player_stations/buildstorages)
```

**变更后**：
```
localStorage: SavedSaveArchivesState (元数据)
IndexedDB.archive_data: SaveArchive (存档基础数据，不含 stations)
IndexedDB.player_station: PlayerStationRecord[] (独立空间站记录)
```

### 数据流

```
导入存档
  └─ SaveParserWorker 解析原始文件
  └─ postProcessRustSaveArchive 后处理
  └─ addArchive()
      ├─ 写入 archive_data 表 (基础存档)
      ├─ 遍历 player_stations → player_station 表 (type='station')
      └─ 遍历 player_buildstorages → player_station 表 (type='buildstorage')

加载存档
  └─ restoreSelectedArchive(archiveId)
      ├─ 读取 archive_data 表
      ├─ 查询 player_station 表 (where archiveId)
      ├─ 按 sectorMacro 归组
      ├─ 合并到 SaveArchive.sectors
      └─ 返回完整对象
```

## Decisions

### 1. 表名动态生成

**决策**：根据 `versions.json` 中的 `indexeddb_tables` 配置动态生成表名

**原因**：
- 不同游戏版本数据需隔离存储
- 表名后缀规则可配置，避免硬编码
- snake_case 格式与 localStorage key 保持一致

**实现**：
```typescript
// versions.json
{
  "indexeddb_tables": {
    "archive_data": "archive_data",
    "player_station": "player_station"
  }
}
// Beta 版本
{
  "indexeddb_tables": {
    "archive_data": "archive_data_v9_beta",
    "player_station": "player_station_v9_beta"
  }
}
```

### 2. Station/Buildstorage 合并存储

**决策**：将 station 和 buildstorage 合并到同一 `player_station` 表，通过 `type` 字段区分

**原因**：
- 两者的数据结构相似（都有 modules, equipments, cargo）
- 合并存储简化表结构管理
- `type` 索引支持按类型查询

### 3. 索引设计

**决策**：索引 `id, archiveId, sectorMacro, type`

| 索引 | 用途 |
|------|------|
| id | 主键查询 |
| archiveId | 批量加载存档所有空间站 |
| sectorMacro | 按星区查询 |
| type | 按类型区分 station/buildstorage |

### 4. ID 格式简化

**决策**：`id` 格式为 `${archiveId}:${code}`，移除 `scopeKey`

**原因**：
- 表名已按版本隔离，无需在 ID 中重复 scopeKey
- archiveId 已包含 guid+time，可唯一标识存档
- 简化 ID 格式便于调试和日志追踪

### 5. 加载策略保持现状

**决策**：`restoreSelectedArchive()` 时一次性合并加载完整数据

**原因**：
- 上层代码依赖 `SaveArchive` 完整对象
- 暂不引入按需加载，避免 UI 层变更
- 通过 `archiveId` 索引批量查询性能可接受

### 6. DB 迁移策略

**决策**：升级时清理旧数据而非迁移

**原因**：
- 旧版 parser 数据可能已失效（版本不兼容）
- 迁移逻辑复杂度高，收益有限
- 用户可重新导入存档文件

**实现**：检测旧版表存在时，直接清理并重建

## Implementation Notes

### versions.json 更新

```json
{
  "versions": [
    {
      "version": "8.0",
      "indexeddb_tables": {
        "archive_data": "archive_data",
        "player_station": "player_station"
      }
    },
    {
      "version": "9.0",
      "beta": true,
      "indexeddb_tables": {
        "archive_data": "archive_data_v9_beta",
        "player_station": "player_station_v9_beta"
      }
    }
  ]
}
```

### saveArchiveDB.ts 重构

```typescript
// 新增类型
interface PlayerStationRecord {
  id: string
  archiveId: string
  sectorMacro: string
  code: string
  type: 'station' | 'buildstorage'
  data: PlayerStationEntry | BuildStorageEntry
}

interface ArchiveDataRecord {
  id: string
  archiveId: string
  data: SaveArchive
}

// DB schema
this.version(DB_VERSION).stores({
  archive_data: 'id, archiveId',
  player_station: 'id, archiveId, sectorMacro, type'
})

// 新增函数
async function savePlayerStationToDB(
  scopeKey: string,  // 用于确定表名
  archiveId: string,
  sectorMacro: string,
  code: string,
  type: 'station' | 'buildstorage',
  data: PlayerStationEntry | BuildStorageEntry
): Promise<void>

async function loadPlayerStationsByArchiveId(
  scopeKey: string,
  archiveId: string
): Promise<PlayerStationRecord[]>

// 修改函数
async function saveArchiveToDB(scopeKey: string, archive: SaveArchive): Promise<void> {
  // 分离写入 archive_data 和 player_station
}

async function loadArchiveDetailFromDB(scopeKey: string, archiveId: string): Promise<SaveArchive | null> {
  // 合并读取 archive_data + player_station
}
```

### useSaveStore.ts 适配

```typescript
// addArchive() 无需变更，saveArchiveToDB 内部处理分离

// restoreSelectedArchive() 无需变更，loadArchiveDetailFromDB 内部处理合并
```

### SectorData 类型变更

```typescript
// 移除字段
interface SectorData {
  // player_stations?: CodeMap<PlayerStationEntry>  // 已移除
  // player_buildstorages?: CodeMap<BuildStorageEntry>  // 已移除
  xenon_stations?: CodeMap<FactionStationEntry>
  khaak_stations?: CodeMap<FactionStationEntry>
  npc_stations?: CodeMap<NpcStationEntry>
  datavaults?: CodeMap<DatavaultEntry>
  erlking_vaults?: CodeMap<DatavaultEntry>
  abandoned_ships?: CodeMap<AbandonedShipEntry>
}
```

### DB_VERSION 升级

```typescript
const DB_VERSION = 4  // 从 3 升级

// 清理旧版数据
async function clearLegacySaveDB(): Promise<void> {
  // 删除旧表 archiveData（v3）
  // 重建新表 archive_data, player_station
}
```

## Risks

### 1. 数据迁移失败

**风险**：旧版数据迁移时解析失败导致数据丢失

**缓解**：不迁移，直接清理；用户可重新导入存档文件

### 2. 类型兼容性

**风险**：上层代码依赖 `SectorData.player_stations` 字段导致编译错误

**缓解**：确保所有依赖点通过 `SaveArchive` 对象访问，加载时已合并完整数据

### 3. DB 锁冲突

**风险**：并发写入 `archive_data` 和 `player_station` 表时锁冲突

**缓解**：使用 Dexie 事务确保原子写入