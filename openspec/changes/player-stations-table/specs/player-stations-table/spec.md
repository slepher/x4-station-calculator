# Player Stations Table Specification

## Purpose

定义将导入存档中的玩家空间站和建造存储数据从内嵌存储分离为独立 IndexedDB 表记录的规范，支持按游戏版本隔离存储，提升大数据量存档的存储和查询效率。

## ADDED Requirements

### Requirement: IndexedDB Table Structure

新增两张 IndexedDB 表，表名按游戏版本动态生成：

#### Scenario: 版本表名生成

**前提** `versions.json` 配置了 `indexeddb_tables` 字段

**当** 游戏版本为 8.0 正式版

**那么** 表名为 `archive_data` 和 `player_station`

**并且** 游戏版本为 9.0 Beta 时，表名为 `archive_data_v9_beta` 和 `player_station_v9_beta`

#### Scenario: player_station 表结构

**前提** DB 初始化时创建 `player_station` 表

**当** 写入玩家空间站记录

**那么** 记录结构为 `{ id, archiveId, sectorMacro, code, type, data }`

**并且** `id` 格式为 `${archiveId}:${code}`

**并且** `type` 为 `'station'` 或 `'buildstorage'`

**并且** 索引包含 `id, archiveId, sectorMacro, type`

#### Scenario: archive_data 表结构

**前提** DB 初始化时创建 `archive_data` 表

**当** 写入存档元数据记录

**那么** 记录结构为 `{ id, archiveId, data }`

**并且** `id` 与 `archiveId` 均为 `${guid}_${time}` 格式

**并且** `data` 为 `SaveArchive`，其 `sectors` 不包含 `player_stations` 和 `player_buildstorages`

### Requirement: SectorData Type Change

移除 `SectorData` 中的 `player_stations` 和 `player_buildstorages` 字段：

#### Scenario: SectorData 类型定义

**前提** 定义 `SectorData` 类型

**当** 检查其字段

**那么** 不存在 `player_stations` 字段

**并且** 不存在 `player_buildstorages` 字段

**并且** 保留 `xenon_stations`, `khaak_stations`, `npc_stations`, `datavaults`, `erlking_vaults`, `abandoned_ships` 字段

### Requirement: Save Archive Loading

加载存档时从独立表合并数据：

#### Scenario: restoreSelectedArchive 流程

**前提** 用户选中某个存档

**当** 执行 `restoreSelectedArchive(archiveId)`

**那么** 从 `archive_data` 表加载基础存档数据

**并且** 通过 `archiveId` 索引从 `player_station` 表查询所有关联记录

**并且** 按 `sectorMacro` 归组，将记录合并到 `SaveArchive.sectors` 中

**并且** `type='station'` 的记录放入 `player_stations`

**并且** `type='buildstorage'` 的记录放入 `player_buildstorages`

**并且** 返回完整的 `SaveArchive` 对象

### Requirement: Save Archive Import

导入存档时分离写入：

#### Scenario: addArchive 流程

**前提** 用户上传存档文件

**当** 解析完成后执行 `addArchive(archive)`

**那么** 将存档基础数据（不含 player_stations/buildstorages）写入 `archive_data` 表

**并且** 遍历所有 `player_stations`，写入 `player_station` 表（type='station'）

**并且** 遍历所有 `player_buildstorages`，写入 `player_station` 表（type='buildstorage'）

### Requirement: Version Configuration

更新 `versions.json` 配置：

#### Scenario: indexeddb_tables 配置项

**前提** 加载 `versions.json`

**当** 检查每个版本配置

**那么** 存在 `indexeddb_tables` 字段

**并且** 包含 `archive_data` 和 `player_station` 表名配置

**并且** 表名使用 snake_case 格式

### Requirement: Database Migration

DB 版本升级时的数据迁移：

#### Scenario: 版本升级迁移

**前提** DB_VERSION 从 3 升级到 4

**当** 用户首次打开新版本应用

**那么** 检查旧版 `archiveData` 表是否存在数据

**并且** 若存在，迁移到新版表结构

**并且** 迁移失败时清理无效数据，不阻塞应用启动

## REMOVED Requirements

### Requirement: Embedded Player Stations Storage

移除内嵌存储方式：

- **原因**：分离存储提升效率，支持版本隔离
- `SaveArchive.sectors` 中不再直接存储 `player_stations` 和 `player_buildstorages` 的完整数据