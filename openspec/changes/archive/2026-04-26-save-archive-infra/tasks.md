# Save Archive Infrastructure - tasks.md

## Sub-module A: Save Import (存档导入与解析)

### A1: 类型定义与 Store
- [x] 定义 `SaveArchive`, `SectorData`, `StationEntry`, `DatavaultEntry`, `AbandonedShipEntry` 类型
- [x] 定义 `ArchiveGroup` 类型
- [x] 创建 `useSaveStore` (Pinia)
- [x] 实现 `addArchive`, `selectArchive`, `removeArchive`, `exportToJson` 方法
- [x] 实现 IndexedDB 持久化与列表/详情读取
- [x] 为 `SaveArchive.meta` 增加 `parser_version/post_processor_version`
- [x] 为 `SaveArchive` 增加 `isValid`
- [x] 按版本规则恢复缓存

### A2: 流式解析链路
- [x] 创建上传桥接模块，按 `parse_start / parse_chunk / parse_end` 协议发送原始文件字节
- [x] 在 Rust worker 中维护解析会话
- [x] 在 Rust 端实现 gzip 检测、header/trailer 处理与增量 gunzip
- [x] 冻结 SAX 解析链路为备用/CLI 默认解析器
- [x] 实现 sector `owner` 提取
- [x] 将 station 按 `player/xenon/khaak/npc` 四组分类
- [x] 为非玩家 station 提取聚合模块 `modules: [{ ref, amount }]`
- [x] 为 `npcStations/xenonStations` 提取 `isShipyard/isWharf/isEquipmentdock/isTradestation`
- [x] 为 `khaakStations` 提取 `isNest/isHive`
- [x] 将派生判定落实在 `saveParserRust.worker.ts` 层
- [x] 为 datavaults 与 erlkingVaults 提取 `unlocked` 与聚合 `wares`
- [x] 提取 abandonedShips
- [x] 实现坐标累加（position 栈）
- [x] 提取存档元信息：guid, seed, time, playerName, version
- [x] 实现流式进度报告与 `finalizing` 阶段补发
- [x] 实现早期版本校验
- [x] Rust parser 原始输出写入 `parser_version = v2`

### A3: 上传界面组件
- [x] 创建拖拽上传区域 UI 和文件选择按钮
- [x] 支持 .xml, .xml.gz, .json 文件类型
- [x] XML/XML.GZ → 启动流式上传并驱动 Worker 解析
- [x] JSON → 直接加载（跳过解析），校验 `meta.version`
- [x] 显示上传状态和进度，进度条绑定 worker 返回的 `percent`
- [x] XML 导入完成后统一经过 TS `postProcess` 再写入 Store/DB

### A4: 存档列表组件
- [x] 从 Store 读取 archives 数据，按 guid 分组显示
- [x] 分组标题使用 playerName，组内按 time 降序排列
- [x] 每个存档项显示时间信息、版本兼容状态、`isValid` 无效存档状态
- [x] 点击存档项触发选中事件
- [x] 提供"下载 JSON"按钮

### A5: 详情面板组件
- [x] 创建详情面板容器，未选中时显示提示信息
- [x] 按 sector 分组展示，展示 sector `owner`
- [x] 分别展示 `playerStations/xenonStations/khaakStations/npcStations` 及聚合模块列表
- [x] 展示 `isShipyard/isWharf/isEquipmentdock/isTradestation` 等派生标记
- [x] 展示 datavaults 和 erlkingVaults 的 `unlocked` 与聚合 `wares`
- [x] 展示 abandonedShips 列表
- [x] Sector 名称显示翻译后名称
- [x] `isValid=false` 时显示需要重新导入的提示

### A6: 主视图容器
- [x] 创建主视图容器，左侧放置 SaveUploadPanel 和 SaveList，右侧放置 SaveDetailPanel
- [x] 连接 Store 状态，处理上传事件 → addArchive
- [x] 处理选中事件 → selectArchive，处理下载事件 → exportToJson

### A7: TopViewSwitch 集成
- [x] 在 `defaultTabs` 新增 `{ key: 'save-import', label: t('view.save_import') }`
- [x] 确保 Tab 切换逻辑正常工作

### A8: MainWorkbench 集成
- [x] 新增 `isSaveImportView` 条件判断，导入并渲染 SaveImportView

### A9: JSON 导出功能
- [x] 定义标准 JSON 格式校验函数和生成函数
- [x] 实现下载触发（URL.createObjectURL + `<a download>`）
- [x] 文件名生成：`{playerName}_{guid}_{seed}.json`

### A10: 国际化文本
- [x] 新增 `view.save_import`、上传相关、列表相关、详情相关、无效存档相关文本

### A11: CLI --skip-post 参数
- [x] 在 parseArgs 中添加 `--skip-post` 参数解析
- [x] extractSaveWasm 中根据 skipPost 决定是否调用 postProcessRustSaveArchive
- [x] 实现 loadModulesByMacroId 函数

### A12: saveParser.post.ts 重构
- [x] 重命名文件 saveParserRust.post.ts → saveParser.post.ts
- [x] 更新所有导入引用
- [x] AggregatedStationModule 新增可选字段：module_id, type, group
- [x] 新增 enrichModulesWithGameData 函数
- [x] 修改 postProcessRustSaveArchive 签名，接收 modulesByMacroId 参数
- [x] 修改 tag 判断逻辑（isFactory 改为检查 type === 'production'，factoryGroup 等）
- [x] 定义 `CURRENT_PARSER_VERSION = "v2"` 和 `CURRENT_POST_PROCESSOR_VERSION = "v2"`
- [x] postProcessRustSaveArchive 写入 `post_processor_version` 并计算 `isValid`
- [x] Rust parser 类型更新（relative_position: Vector3, zone_id）
- [x] Rust parser zone tracking
- [x] 基于 `zone_id + maps.zones` 补全最终 `position`

### A13: 地图数据与消费方同步
- [x] 将 zones 从数组改为对象，主键为 ref/id
- [x] 将 map 处理链路中的 zone_id 统一为小写
- [x] 将 shcon_anchors 并回 zones
- [x] 修改所有消费 shcon_anchors 的代码
- [x] 地图侧无效存档显示禁用态且不可进入二级菜单

### A14: 构建验证
- [x] 运行 `npm run build`，修复所有编译错误
- [x] Rust 相关改动后运行 `cargo test` 和 `./build.sh`

### A15: Save Parser Shape 扩展 (P1-P12)
- [x] P1. PlayerStationConstruction 增加 `id` 字段
- [x] P2. PlayerStationEntry 增加 `component_id` / `cargo` / `reservation` / `buildstorage_code`
- [x] P3. SectorData 增加 `player_buildstorages` map
- [x] P4. buildstorage 仅解析 inprogress
- [x] P5. buildstorage.progress 仅保留 start/end/sequenceindex
- [x] P6. 建立 station_code/buildstorage_code 引用
- [x] P7. parser 输出的 id/component_id 去掉外层 `[]`
- [x] P8. SectorData 下实体集合改为 snake_case map
- [x] P9. BuildStorageRef 重命名为 BuildStorageEntry
- [x] P10. player_buildstorages constructions 补齐 equipments
- [x] P11. modules/equipments 改为 Record<ref, entry>
- [x] P12. postProcess 为 modules 补 module_id，equipments 补 equipment_id

---

## Sub-module B: Save Local Storage (版本化持久化)

### B1: 版本作用域接入
- [x] 扩展 `VersionConfig.storage_keys`，新增 `save_archives`
- [x] 更新 `versions.json`，为每个版本提供 save storage key
- [x] 扩展 `getStorageKey` 支持 save 模块

### B2: Save 目录状态建模
- [x] 新增 SavedSaveArchivesState 类型（version / activeArchiveId / list / settings）
- [x] 补充默认空状态创建逻辑
- [x] 预留迁移入口
- [x] 将 save 地图 checkbox 建模为 settings

### B3: IndexedDB 正文仓库重构
- [x] 重构 saveArchiveDB.ts，移除 meta 来自 IndexedDB 的设计
- [x] 正文记录改为带 scopeKey + archiveId 的唯一身份
- [x] 新增按当前作用域读取、删除、清空正文的 DB API
- [x] 移除或废弃 legacy meta 表读取入口

### B4: Save Store 初始化改造
- [x] 改造 initialize()，先从当前作用域 localStorage 恢复目录状态
- [x] 按 activeArchiveId 恢复当前选中正文
- [x] 目录存在但正文缺失时自动修复与回写
- [x] 移除对 IndexedDB meta 列表的全量扫描依赖

### B5: Save Store 行为改造
- [x] 改造 addArchive()：目录状态先更新，正文后落库
- [x] 改造 selectArchive()：持久化 activeArchiveId 后再读正文
- [x] 改造 removeArchive()：同步更新目录状态与正文
- [x] 改造 clearAll()：只清当前版本作用域，保留 settings
- [x] 保持现有 parser_version / isValid 语义不变
- [x] 存档面板 checkbox 读写 Store settings，跨面板/跨切换保持

### B6: 地图入口行为
- [x] 进入 maps 视图时，存在激活存档则直接按该存档渲染
- [x] 地图按存档渲染与存档面板开关解耦

### B7: 旧结构清理 gate
- [x] 遍历所有版本 save storage key 的检查逻辑
- [x] 全不存在时清理 legacy save IndexedDB
- [x] 任一存在时跳过清理

### B8: 文档与验证
- [x] 更新类型和注释
- [x] 补充单元测试
- [x] `npm run build` 通过

---

## Sub-module C: Player Stations Table (IndexedDB 分离)

### C1: 更新 versions.json 配置
- [x] 移除 `indexeddb_tables` 配置项
- [x] 为每个版本新增 `indexeddb_name` 配置项（8.0: `x4_save_archive_db`）

### C2: 更新类型定义
- [x] 删除 `PlayerStationType` 类型
- [x] 删除旧 `PlayerStationRecord` 类型
- [x] 新增 `PlayerStationsRecord` 类型

### C3: 重构 saveArchiveDB.ts
- [x] X4SaveArchiveDB 构造函数接收 dbName 参数
- [x] 表定义改为 archive_data 和 player_stations，索引 id + archiveId + guid
- [x] 新增 dbCache Map 和 getDB/getDBName 函数
- [x] 重写 saveArchiveToDB()：分离写入两表
- [x] 重写 loadArchiveDetailFromDB()：两次 get() + 合并
- [x] 重写 removeArchiveFromDB() / clearArchivesFromDB()
- [x] 重写 clearLegacySaveDB()：清理缓存 + 删除旧 DB
- [x] 删除 loadPlayerStationsByArchiveId 等旧函数

### C4: 适配 useSaveStore.ts
- [x] 确认 addArchive/restoreSelectedArchive/removeArchive/clearAll 无需变更

### C5: 适配其他依赖点
- [x] 检查所有导入旧类型的代码并更新

### C6: 构建验证
- [x] npm run build 通过

---

## Sub-module D: Save Import/Export (导入导出第四模块)

### D1: 导出类型与常量
- [x] 新增 `SAVE_KEY = 'x4_save_archives'` 常量
- [x] 扩展 `ImportModuleKey` 类型
- [x] 新增 `SaveArchiveExportData` 类型
- [x] 扩展 `STORAGE_KEY_MAP`、`ModuleImportStats`、`ImportApplyOptions`、`ImportApplyResult`

### D2: 导出数据构建
- [x] 实现 `buildSaveExportData` 异步函数
- [x] 从当前作用域 localStorage 读取 state，从 IndexedDB 读取 archives

### D3: 扩展导出 payload
- [x] 扩展 `buildExportPayload` 为异步，新增 Save 参数
- [x] 在 data 中新增 `x4_save_archives`

### D4: 导出 UI 组件
- [x] StorageExportWizard 展示 Save 模块名称/统计/说明文案 + 勾选框

### D5: 全选按钮特殊行为
- [x] 全选时勾选 Empire/Flow/Ship，不自动勾选 Save

### D6: 导入 normalize 和 migrate
- [x] 解析导入文件的 `data.x4_save_archives`
- [x] 验证结构合法性，调用 migrateSaveArchivesStateToCurrent

### D7: 导入 sanitize
- [x] 版本校验：不匹配跳过
- [x] parser_version 校验：不匹配跳过
- [x] 统计跳过数量和详情列表

### D8: 导入 re-process
- [x] post_processor_version 不匹配时执行 postProcessRustSaveArchive

### D9: 导入 apply（覆盖模式）
- [x] 清理当前作用域 localStorage + IndexedDB
- [x] 写入新 state 和 archives

### D10: 导入 apply（增量模式）
- [x] 合并 meta 列表（同名覆盖），合并 IndexedDB 正文
- [x] activeId 决策规则

### D11: 整合 applySaveImport 函数
- [x] 根据 mode 分支调用覆盖或增量函数

### D12: 扩展 applyImportPayload / prepareImportPayload / getModuleImportStats
- [x] 新增 Save 模块应用分支

### D13: 导入 UI 组件
- [x] StorageImportWizard 展示有效数量、跳过数量、可折叠跳过详情列表、勾选框

### D14: 导入/导出 i18n
- [x] 新增模块名称、说明文案、统计展示、跳过详情等文本

### D15: Context Refresh
- [x] 导入后在 maps 视图且 activeArchiveId 变化时，清空并恢复 overlay

### D16: 版本作用域隔离
- [x] 导出仅读取当前作用域
- [x] 导入写入仅限当前作用域
- [x] IndexedDB 主键使用 `${scopeKey}:${archiveId}`

### D17: 构建验证
- [x] npm run build 通过
- [x] 类型检查通过
