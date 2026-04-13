# player-stations-table 变更请求

## 目标

将导入存档中的 `player_stations` 和 `player_buildstorages` 从 `SaveArchive.sectors` 内嵌存储分离为独立的 IndexedDB 表记录，实现数据按游戏版本隔离存储，提升大数据量存档的存储和查询效率。

## 已确认方案（审核重点）

### 1. IndexedDB 表结构

**新表 `player_station`（snake_case 命名）**：

```typescript
interface PlayerStationRecord {
  id: string                      // ${archiveId}:${code}
  archiveId: string               // ${guid}_${time}
  sectorMacro: string
  code: string
  type: 'station' | 'buildstorage'
  data: PlayerStationEntry | BuildStorageEntry
}
```

**索引**：`id, archiveId, sectorMacro, type`

### 2. 版本表名生成规则

表名根据 `src/assets/versions.json` 中的 `indexeddb_tables` 配置动态生成：

- 8.0 正式版：`archive_data`, `player_station`
- 9.0 Beta：`archive_data_v9_beta`, `player_station_v9_beta`

需更新 `versions.json`，新增 `indexeddb_tables` 配置项。

### 3. archiveData 表简化

移除 `scopeKey` 字段，主键改为 `${archiveId}`：

```typescript
interface ArchiveDataRecord {
  id: string                      // ${archiveId}
  archiveId: string
  data: SaveArchive               // sectors 不再包含 player_stations/buildstorages
}
```

### 4. SectorData 结构变化

`SaveArchive.sectors` 中的 `player_stations` 和 `player_buildstorages` **完全移除**：

```typescript
interface SectorData {
  // player_stations 和 player_buildstorages 已移除
  xenon_stations?: CodeMap<FactionStationEntry>
  khaak_stations?: CodeMap<FactionStationEntry>
  npc_stations?: CodeMap<NpcStationEntry>
  datavaults?: CodeMap<DatavaultEntry>
  erlking_vaults?: CodeMap<DatavaultEntry>
  abandoned_ships?: CodeMap<AbandonedShipEntry>
}
```

### 5. 加载策略（保持现状）

`restoreSelectedArchive()` 时：
1. 从 `archive_data` 表加载基础存档元数据
2. 通过 `archiveId` 索引批量查询 `player_station` 表
3. 按 `sectorMacro` 归组，合并到内存中的 `SaveArchive.sectors`
4. 返回完整 `SaveArchive` 对象供上层使用

### 6. 数据迁移

DB_VERSION 升级时，需处理旧版数据：
- 旧 `archiveData` 表数据迁移到新表结构
- 清理无效的旧版 parser 数据

## 边界

### In Scope

- `src/db/saveArchiveDB.ts` - IndexedDB 表结构和 CRUD 函数重构
- `src/store/useSaveStore.ts` - 加载/保存流程适配
- `src/assets/versions.json` - 新增 `indexeddb_tables` 配置
- `src/types/saveArchive.ts` - `SectorData` 类型变更
- `src/workers/saveParser.post.ts` - 后处理函数适配（分离 station/buildstorage 写入）
- DB 版本迁移逻辑

### Out of Scope

- `npc_stations`, `xenon_stations`, `khaak_stations` 等其他 POI 类型的存储变更
- UI 组件变更（加载策略保持现状，UI 无感知）
- 测试代码（由 `/x4:test` 处理）

## 验收标准（DoD）

1. **存储正确性**：导入存档后，`player_station` 表中能正确查询到所有 station 和 buildstorage 记录
2. **加载正确性**：`restoreSelectedArchive()` 返回的 `SaveArchive` 包含完整的 `player_stations` 和 `player_buildstorages` 数据
3. **版本隔离**：不同游戏版本的数据存储在各自的表中，互不干扰
4. **索引查询**：通过 `archiveId` 索引能高效批量查询某存档的所有空间站
5. **数据迁移**：旧版 DB 数据能正确迁移到新表结构，或清理无效数据
6. **编译通过**：`npm run build` 无编译错误

## 未决项

无