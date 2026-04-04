# save-local-storage 实施任务

## 1. 版本作用域接入
- [x] 扩展 `VersionConfig.storage_keys`，为 save 模块新增 `save_archives`
- [x] 更新 `src/assets/versions.json`，为每个游戏版本提供 save storage key
- [x] 扩展 `useGameDataStore.getStorageKey(...)`，支持获取 save 模块当前版本作用域 key

## 2. Save 目录状态建模
- [x] 新增 Save 目录状态类型，定义 `version / activeArchiveId / list`
- [x] 为 Save 目录状态补充默认空状态创建逻辑
- [x] 预留 Save 目录状态迁移入口，至少支持当前版本 schema 的安全加载

## 3. IndexedDB 正文仓库重构
- [x] 重构 `saveArchiveDB.ts`，移除“列表元数据来自 IndexedDB”的设计
- [x] 将正文记录改为带 `scopeKey + archiveId` 的唯一身份
- [x] 新增按当前作用域读取、删除、清空正文的 DB API
- [x] 移除或废弃 legacy meta 表读取入口

## 4. Save Store 初始化改造
- [x] 改造 `useSaveStore.initialize()`，先从当前版本作用域的 `localStorage` 恢复目录状态
- [x] 在初始化中按 `activeArchiveId` 恢复当前选中正文
- [x] 为“目录存在但正文缺失”增加自动修复与回写逻辑
- [x] 移除初始化阶段对 IndexedDB meta 列表的全量扫描依赖

## 5. Save Store 行为改造
- [x] 改造 `addArchive()`，按“目录状态先更新、正文后落库”的顺序持久化
- [x] 改造 `selectArchive()`，持久化当前作用域 `activeArchiveId` 后再读取正文
- [x] 改造 `removeArchive()`，同步更新目录状态与当前作用域正文
- [x] 改造 `clearAll()`，只清空当前版本作用域下的 Save 数据
- [x] 保持现有 `parser_version / post_processor_version / isCompatible / isValid` 语义不变

## 6. 旧结构清理 gate
- [x] 增加“遍历所有版本 save storage key”的检查逻辑
- [x] 当所有 save storage key 都不存在时，清理 legacy save IndexedDB
- [x] 当任意 save storage key 存在时，跳过 legacy 清理

## 7. 文档与验证
- [x] 更新与 save 持久化相关的类型和注释，使目录状态与正文仓库职责清晰
- [x] 为 Save Store 的初始化、作用域隔离、active 恢复、删除与清空补充单元测试
- [x] 完成代码后执行 `npm run build`，确保改造后的持久化链路可编译
