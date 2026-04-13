# player-stations-table 任务列表

## 任务

### 1. 更新 versions.json 配置

**文件**：`src/assets/versions.json`

**内容**：
- 为每个版本新增 `indexeddb_tables` 配置项
- 8.0：`archive_data`, `player_station`
- 9.0 Beta：`archive_data_v9_beta`, `player_station_v9_beta`

- [x] 完成

### 2. 新增 IndexedDB 类型定义

**文件**：`src/types/saveArchive.ts`

**内容**：
- 新增 `PlayerStationRecord` 类型
- 新增 `ArchiveDataRecord` 类型（简化版，移除 scopeKey）
- 新增 `PlayerStationType = 'station' | 'buildstorage'` 类型

- [x] 完成（类型定义移至 saveArchiveDB.ts）

### 3. 移除 SectorData 内嵌字段

**文件**：`src/types/saveArchive.ts`

**内容**：
- 移除 `SectorData.player_stations` 字段
- 移除 `SectorData.player_buildstorages` 字段
- 保留其他 POI 字段不变

- [x] 完成（保留字段用于运行时合并，存储时分离）

### 4. 重构 saveArchiveDB.ts

**文件**：`src/db/saveArchiveDB.ts`

**内容**：
- 升级 `DB_VERSION` 到 4
- 新增 `getPlayerStationTableName(scopeKey)` 函数
- 新增 `getArchiveDataTableName(scopeKey)` 函数
- 新增 `PlayerStationRecord` 和 `ArchiveDataRecord` 表定义
- 新增索引：`id, archiveId, sectorMacro, type`
- 新增 `savePlayerStationToDB()` 函数
- 新增 `loadPlayerStationsByArchiveId()` 函数
- 修改 `saveArchiveToDB()`：分离写入 archive_data 和 player_station
- 修改 `loadArchiveDetailFromDB()`：合并读取 archive_data + player_station
- 修改 `removeArchiveFromDB()`：同时删除 archive_data 和关联 player_station 记录
- 修改 `clearArchivesFromDB()`：清理对应版本的所有表数据
- 修改 `clearLegacySaveDB()`：处理 v3 到 v4 的迁移

- [x] 完成

### 5. 适配 useSaveStore.ts

**文件**：`src/store/useSaveStore.ts`

**内容**：
- 确认 `addArchive()` 调用 `saveArchiveToDB()` 无需变更（内部已处理分离）
- 确认 `restoreSelectedArchive()` 调用 `loadArchiveDetailFromDB()` 无需变更（内部已处理合并）
- 确认 `removeArchive()` 调用 `removeArchiveFromDB()` 无需变更
- 确认 `clearAll()` 调用 `clearArchivesFromDB()` 无需变更
- 检查 `normalizeSectorData()` 函数：移除 `player_stations` 和 `player_buildstorages` 的默认值设置

- [x] 完成（无需变更，函数已兼容）

### 6. 适配 saveParser.post.ts

**文件**：`src/workers/saveParser.post.ts`

**内容**：
- 检查 `postProcessRustSaveArchive()` 返回的 `SaveArchive` 结构
- 确认返回数据中 `sectors` 不再包含 `player_stations` 和 `player_buildstorages`（由原始解析器决定）
- 如需调整，修改后处理逻辑以适配新存储结构
- 升级 `CURRENT_POST_PROCESSOR_VERSION` 到 v10

- [x] 完成

### 7. 更新 useGameDataStore.ts

**文件**：`src/store/useGameDataStore.ts`

**内容**：
- 新增 `getTableConfig(version)` 函数，返回该版本的 IndexedDB 表名配置
- 确认 `getStorageKey()` 可获取 `indexeddb_tables` 配置

- [x] 完成（saveArchiveDB.ts 内部通过 VERSION_TABLE_MAP 处理）

### 8. 构建验证

**命令**：`npm run build`

**内容**：
- 执行构建，确认无编译错误
- 如有类型错误，修复依赖点

- [x] 完成

## 任务依赖关系

```
1 (versions.json) ─┬─> 4 (saveArchiveDB.ts)
                   │
2 (types) ─────────┴─> 4 (saveArchiveDB.ts)
                          │
3 (SectorData) ───────────┴─> 5 (useSaveStore.ts)
                                │
4 (saveArchiveDB) ──────────────┴─> 6 (saveParser.post)
                                    │
7 (useGameDataStore) ──────────────┴─> 4 (saveArchiveDB.ts)
                                        │
                                      8 (build)
```

## 验收检查点

1. **类型变更后**：`npm run typecheck` 通过
2. **DB 函数完成后**：手动测试导入存档，确认数据写入两张表
3. **加载流程完成后**：手动测试选中存档，确认 UI 正常显示玩家空间站
4. **构建完成后**：`npm run build` 无错误