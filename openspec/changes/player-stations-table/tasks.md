# player-stations-table 任务列表

## 任务

### 1. 更新 versions.json 配置

**文件**：`src/assets/versions.json`

**内容**：
- 移除 `indexeddb_tables` 配置项
- 为每个版本新增 `indexeddb_name` 配置项
- 8.0：`x4_save_archive_db`
- 9.0 Beta：`x4_save_archive_db_v9_beta`

- [x] 完成

### 2. 更新类型定义

**文件**：`src/types/saveArchive.ts`

**内容**：
- 删除 `PlayerStationType` 类型
- 删除 `PlayerStationRecord` 类型（旧版）
- 新增 `PlayerStationsRecord` 类型（新版）
- 保留 `ArchiveDataRecord` 类型不变
- 保留 `SectorData` 中 `player_stations` 和 `player_buildstorages` 字段（运行时需要）

- [x] 完成

### 3. 重构 saveArchiveDB.ts

**文件**：`src/db/saveArchiveDB.ts`

**内容**：
- 修改 `X4SaveArchiveDB` 类：
  - 构造函数接收 `dbName` 参数
  - 表定义改为 `archive_data` 和 `player_stations`
  - 索引改为 `id, archiveId, guid`
- 新增 `dbCache: Map<string, X4SaveArchiveDB>` 缓存
- 新增 `getDBName(scopeKey)` 函数，从 versions.json 读取 `indexeddb_name`
- 新增 `getDB(scopeKey)` 函数，动态创建/获取数据库实例
- 重写 `saveArchiveToDB()`：
  - 提取 player_stations/buildstorages 按 sectorMacro 归组
  - 两表各写入一条记录（同一 archiveId）
- 重写 `loadArchiveDetailFromDB()`：
  - 两次 `get()` 查询两表
  - 合并 data 到 sectors
- 重写 `removeArchiveFromDB()`：
  - 两次 `delete()` 删除两表记录
- 重写 `clearArchivesFromDB()`：
  - 清理两表数据
- 重写 `clearLegacySaveDB()`：
  - 清理缓存
  - 删除旧 `X4SaveArchiveDB` 数据库
- 删除 `loadPlayerStationsByArchiveId()` 函数（不再需要）
- 删除 `createStationRecordId()` 函数（不再需要）
- 删除 `getArchiveDataTable()` 函数（不再需要）
- 删除 `getPlayerStationTable()` 函数（不再需要）
- 删除 `VERSION_TABLE_MAP` 常量（不再需要）

- [x] 完成

### 4. 适配 useSaveStore.ts

**文件**：`src/store/useSaveStore.ts`

**内容**：
- 检查 `addArchive()` 调用点，确认无需变更
- 检查 `restoreSelectedArchive()` 调用点，确认无需变更
- 检查 `removeArchive()` 调用点，确认无需变更
- 检查 `clearAll()` 调用点，确认无需变更

- [x] 完成（预期无需变更）

### 5. 适配其他依赖点

**文件**：搜索所有导入 `PlayerStationRecord` 或 `PlayerStationType` 的文件

**内容**：
- 检查是否有外部代码依赖旧版类型
- 如有，更新导入和用法

- [x] 完成

### 6. 构建验证

**命令**：`npm run build`

**内容**：
- 执行构建，确认无编译错误
- 如有类型错误，修复依赖点

- [x] 完成

## 任务依赖关系

```
1 (versions.json) ──> 3 (saveArchiveDB.ts)
                         │
2 (types) ───────────────┘
                         │
4 (useSaveStore) ────────┴─> 5 (其他依赖点)
                                 │
                               6 (build)
```

## 验收检查点

1. **类型变更后**：`npm run typecheck` 通过
2. **DB 函数完成后**：手动测试导入存档，确认数据写入两张表
3. **加载流程完成后**：手动测试选中存档，确认 UI 正常显示玩家空间站
4. **构建完成后**：`npm run build` 无错误