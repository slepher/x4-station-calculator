# Save Archive Infrastructure - request.md

## 目标

新增完整的存档持久化基础设施流水线：支持上传 X4 存档文件（原始 XML/XML.GZ 或已提取 JSON），通过 Rust/WASM 解析器高性能解析，将解析结果按版本作用域持久化到 localStorage（目录状态）与 IndexedDB（完整正文），将玩家空间站数据分离为独立 IndexedDB 表以提升存储和查询效率，并将存档模块作为第四个模块接入导入导出系统。

整个流水线覆盖四个子模块：

1. **Import** — 存档上传、Rust/WASM 解析、后处理、详情展示
2. **Persistence** — 版本化 localStorage 目录状态 + IndexedDB 正文仓库
3. **IndexedDB** — 玩家空间站数据分离为独立表，数据库按游戏版本隔离
4. **ImportExport** — 存档模块作为第四模块接入导入导出系统

---

### 模块 1：Save Import — 存档导入与解析

已实现：
- 新增"存档同步"Tab，位于 TopViewSwitch 第5位（排在"船只建造"之后），Tab key `save-import`
- 左侧面板：上传界面 + 存档列表（按 guid 分组显示）
- 右侧面板：存档详情（选中存档后展示）
- 支持两种上传方式：原始存档文件（.xml / .xml.gz）和已提取 JSON 文件
- 上传链路采用三段式 worker 协议（parse_start / parse_chunk / parse_end）
- Rust/WASM 解析器负责高性能流式解析，gzip 解压在 Rust 端完成
- SAX 解析器冻结为兼容/备用链路
- 存档按 guid 分组，按 time 降序排列，分组标题使用 playerName
- 每个存档项提供下载 JSON 和删除按钮
- 详情面板展示空间站（按 player/xenon/khaak/npc 分类）、datavault、erlking_vault、弃船
- 版本校验：存档 version 匹配 gameDataStore.currentVersion
- parser_version / post_processor_version 双层版本管理
- 无效存档（parser_version 不匹配）保留列表但禁止进入深层消费界面
- 支持 CLI 提取工具 `scripts/extract_save.tsx`，支持 `--wasm` 和 `--skip-post` 参数

### 模块 2：Save Local Storage — 版本化持久化

已实现：
- Save 模块使用版本化 storage_keys（与 empire/logic_flow/ship_blueprints 一致）
- localStorage 保存目录状态：ArchiveMeta 列表 + activeArchiveId + settings
- IndexedDB 仅保存完整 SaveArchive 正文，不再承担列表元数据来源
- 版本作用域复用现有 `getStorageKey` 设计，不同版本数据相互隔离
- Save 地图设置（POI 可见性 checkbox、"删除条件小站点" checkbox）持久化到 localStorage，不绑定具体 archive
- 新增/更新/删除/清空行为全部限定在当前版本作用域
- maps 视图在存在激活存档时直接基于存档渲染，但不自动展开存档面板
- 所有版本 save storage key 均不存在时，清理旧结构 IndexedDB

### 模块 3：Player Stations Table — IndexedDB 玩家空间站分离

已实现：
- 将 player_stations 和 player_buildstorages 从 SaveArchive.sectors 内嵌存储分离为独立 IndexedDB 表
- 数据库按游戏版本分离：8.0 使用 `x4_save_archive_db`，9.0 Beta 使用 `x4_save_archive_db_v9_beta`
- 两张表 `archive_data` 和 `player_stations` 共享主键 archiveId
- 导入时分离写入，加载时合并恢复，UI 层无感知
- 清理旧 `X4SaveArchiveDB` 数据库，不执行数据迁移

### 模块 4：Import Export Save — 导入导出第四模块

已实现：
- Save 模块接入导入导出流水线，成为第四模块
- 导出 payload 包含 `{ state: SavedSaveArchivesState, archives: SaveArchive[] }`
- 导入强制校验版本匹配（不匹配的存档跳过），parser_version 校验（不匹配的跳过）
- 导入时 post_processor_version 不匹配则重新执行 post_process
- 同名存档（相同 guid+time）直接覆盖 meta 和正文
- 版本作用域隔离：导入导出限定当前作用域，不影响其他版本数据
- 导出界面全选不自动勾选 Save 模块，Save 模块旁显示说明文案
- 导入界面显示有效数量和跳过详情列表（可折叠）
- Save 模块导入后若在 maps 视图且 activeArchiveId 变化，触发 context refresh

## 验收标准（DoD）

所有子模块的验收标准已通过代码实现和构建验证：
1. 存档同步 Tab 正常显示与切换
2. 上传原始存档和 JSON 后正确解析/加载并分组显示
3. 存档按 guid 分组、time 降序排列，版本不匹配时显示警告
4. 详情面板正确显示空间站/datavault/erlking_vault/弃船及所有派生标记
5. 大文件（100MB+）流式解析不阻塞 UI
6. CLI 提取工具正常工作
7. 版本化 localStorage 持久化存档目录状态，版本间相互隔离
8. localStorage 保存 activeArchiveId、存档列表和地图设置
9. IndexedDB 仅保存完整正文，按版本作用域隔离
10. player_stations 和 player_buildstorages 分离为独立表
11. 数据库按游戏版本分离，表名固定
12. Save 模块在导入导出中作为第四模块工作
13. 导出包含完整存档索引和正文，全选不自动勾选 Save
14. 导入时执行版本和 parser_version 强制校验
15. 同名存档覆盖，增量合并正确

## 未决项

无。
