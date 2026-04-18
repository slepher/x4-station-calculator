# Player Stations Table Specification

## Purpose

定义将导入存档中的玩家空间站和建造存储数据从内嵌存储分离为独立 IndexedDB 表记录的规范，使用数据库级别版本隔离，提升大数据量存档的存储和查询效率。

## ADDED Requirements

### Requirement: Database Level Versioning

每个游戏版本使用独立的 IndexedDB 数据库：

#### Scenario: 数据库名生成

**前提** `versions.json` 配置了 `indexeddb_name` 字段

**当** 游戏版本为 8.0 正式版

**那么** 数据库名为 `x4_save_archive_db`

**并且** 游戏版本为 9.0 Beta 时，数据库名为 `x4_save_archive_db_v9_beta`

#### Scenario: 数据库内表名固定

**前提** 数据库初始化

**当** 创建数据库表

**那么** 表名固定为 `archive_data` 和 `player_stations`

**并且** 不同版本的数据库使用相同的表名

### Requirement: Table Structure

两张表使用相同主键结构：

#### Scenario: archive_data 表结构

**前提** DB 初始化时创建 `archive_data` 表

**当** 写入存档元数据记录

**那么** 记录结构为 `{ id, archiveId, data }`

**并且** `id` 等于 `archiveId`，格式为 `${guid}_${time}`

**并且** `data` 为 `SaveArchive`，其 `sectors` 不包含 `player_stations` 和 `player_buildstorages`

**并且** 索引为 `id`（主键自动索引）和 `guid`

#### Scenario: player_stations 表结构

**前提** DB 初始化时创建 `player_stations` 表

**当** 写入玩家空间站记录

**那么** 记录结构为 `{ id, archiveId, data }`

**并且** `id` 等于 `archiveId`，与 `archive_data` 表主键相同

**并且** `data` 结构为 `{ player_stations, player_buildstorages }`

**并且** `player_stations` 和 `player_buildstorages` 按 `sectorMacro` 归组存储

**并且** 索引为 `id`（主键自动索引）和 `guid`

### Requirement: Save Archive Loading

加载存档时从两张表合并数据：

#### Scenario: restoreSelectedArchive 流程

**前提** 用户选中某个存档

**当** 执行 `restoreSelectedArchive(archiveId)`

**那么** 从 `archive_data` 表通过主键加载基础存档数据

**并且** 从 `player_stations` 表通过同一主键加载空间站数据

**并且** 将 `player_stations` 数据合并到 `SaveArchive.sectors` 中

**并且** 将 `player_buildstorages` 数据合并到 `SaveArchive.sectors` 中

**并且** 返回完整的 `SaveArchive` 对象

### Requirement: Save Archive Import

导入存档时分离写入两张表：

#### Scenario: addArchive 流程

**前提** 用户上传存档文件

**当** 解析完成后执行 `addArchive(archive)`

**那么** 将存档基础数据（不含 player_stations/buildstorages）写入 `archive_data` 表

**并且** 将所有 `player_stations` 按 `sectorMacro` 归组写入 `player_stations` 表

**并且** 将所有 `player_buildstorages` 按 `sectorMacro` 归组写入 `player_stations` 表

**并且** 两表使用相同主键 `archiveId`

### Requirement: Version Configuration

更新 `versions.json` 配置：

#### Scenario: indexeddb_name 配置项

**前提** 加载 `versions.json`

**当** 检查每个版本配置

**那么** 存在 `indexeddb_name` 字段

**并且** 数据库名使用 snake_case 格式

**并且** 不存在 `indexeddb_tables` 字段（已移除）

### Requirement: Database Migration

版本升级时清理旧数据库：

#### Scenario: 清理旧数据库

**前提** 用户首次使用新版本应用

**当** 初始化 IndexedDB

**那么** 检测旧数据库 `X4SaveArchiveDB` 是否存在

**并且** 若存在，调用 `Dexie.delete('X4SaveArchiveDB')` 清理

**并且** 不进行数据迁移

## REMOVED Requirements

### Requirement: Table Level Versioning

移除表级别版本隔离：

- **原因**：改为数据库级别隔离，更彻底且简化代码
- 不再使用动态表名（如 `archive_data_v9_beta`）

### Requirement: Per Station Record Storage

移除每条空间站独立记录的存储方式：

- **原因**：改为每存档一条记录，主键与 archive_data 相同
- `player_stations` 表不再存储 `{ id, archiveId, sectorMacro, code, type, data }` 结构
- 不再需要 `sectorMacro`、`code`、`type` 索引