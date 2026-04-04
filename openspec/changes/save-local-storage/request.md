# save-local-storage 需求说明

## 目标
调整现有 Save Import 持久化结构，将“存档目录与当前激活存档”迁移到与其他 store 一致的版本化 `localStorage` 作用域中，同时让完整 `archiveData` 只保存在 IndexedDB。新设计必须复用现有游戏版本切换的作用域定义，不额外引入新的版本 scope 体系。

## 已确认方案（审核重点）

### 1. 持久化职责拆分
- `localStorage` 负责保存当前版本作用域下的存档目录状态：
  - 全部 `ArchiveMeta`
  - `activeArchiveId`
  - save 模块自身的状态版本号
- IndexedDB 只负责保存完整 `SaveArchive` 正文，不再承担列表元数据来源职责。

### 2. 版本作用域复用现有设计
- Save 模块必须复用现有 `useGameDataStore.currentVersionConfig.storage_keys` 提供的版本化 key 体系。
- 需要为 save 模块新增一个版本化 storage key，而不是引入新的独立 scope 定义。
- 当前版本切换后，Save 模块只能读取该版本作用域下的存档目录与激活状态。
- 不同游戏版本下的存档必须相互隔离，用户在某个版本下只能看到该版本自己的全部存档。

### 3. Save localStorage 状态结构
- Save 模块应像 `empire / logic_flow / ship_blueprints` 一样，使用“一个作用域 key 对应一整份状态对象”的方式持久化。
- 该状态对象至少包含：
  - `version`
  - `activeArchiveId`
  - `list: ArchiveMeta[]`
- 该状态对象还必须包含 save 地图设置：
  - 各 POI 分类 checkbox 的可见性状态
  - “删除条件小站点” checkbox 状态
- 不将 `activeArchiveId` 单独拆成第二个 key。
- 这些 save 地图设置属于当前版本作用域下的 save settings，不绑定具体某一条 archive。

### 4. IndexedDB 正文结构
- IndexedDB 仅保存完整 `SaveArchive`。
- 每条正文记录都要携带当前版本作用域标识，并以“作用域 + archiveId”形成唯一主键。
- `archiveId` 继续复用现有 `${guid}_${time}` 规则。
- 正文读写、删除、清空都必须按当前版本作用域执行，不能跨版本串读。

### 5. Save Store 初始化与恢复规则
- Save Store 初始化时先从当前版本作用域的 `localStorage` 恢复目录状态。
- 若存在 `activeArchiveId`，再按当前版本作用域去 IndexedDB 读取对应完整正文并恢复 `selectedArchive`。
- 若正文不存在，则要自动清空无效的 `activeArchiveId` 并回写 `localStorage`。
- 启动阶段不再通过 IndexedDB 全量扫描 meta 列表来恢复左侧存档列表。

### 6. 新增/更新/删除行为
- 新增存档时：
  - 先更新当前版本作用域下的 save localStorage 状态
  - 将新存档设为 `activeArchiveId`
  - 再写入 IndexedDB 正文
- 选择存档时：
  - 持久化当前版本作用域下的 `activeArchiveId`
  - 再读取对应正文
- 删除存档时：
  - 同步更新 localStorage 中的目录状态与 active 状态
  - 同步删除当前版本作用域下的 IndexedDB 正文
- 清空时：
  - 仅清空当前版本作用域下的 Save 数据
  - 不影响其他版本作用域的数据
  - 不应清空当前版本作用域下的 save 地图设置

### 7. 地图界面与激活存档的关系
- 进入星区 `maps` 视图时，如果当前版本作用域存在激活存档，地图主画布应直接基于该存档渲染。
- 该行为依赖 save localStorage 中持久化的 `activeArchiveId` 恢复结果。
- 地图进入存档态时，不应自动展开存档面板。

### 8. Save 地图设置行为
- 存档面板中的 POI 分类可见性 checkbox 与“删除条件小站点” checkbox 需要持久化到 save localStorage。
- 这些设置在关闭存档面板、切换当前激活存档、刷新页面后都应保持。
- 这些设置只按当前游戏版本作用域隔离，不随单条 archive 切换而重置。

### 9. 旧结构处理策略
- 当前功能尚未正式上线，不需要实现旧结构到新结构的数据迁移。
- 若所有版本作用域下的 save localStorage key 都不存在，则视为没有可信的 save 目录状态。
- 在该条件下，初始化时直接清理旧 save IndexedDB 对应表或整个 save DB。
- 该清理逻辑只用于旧结构兜底，不作为日常清空当前版本数据的行为入口。

### 10. 与现有 Save Import 版本校验规则的关系
- 本次仅调整 Save Import 的持久化分层和恢复入口，不改变现有：
  - `parser_version` 判定规则
  - `post_processor_version` 判定规则
  - `isCompatible / isValid` 的语义
- 这些字段仍属于 `ArchiveMeta` 与 `SaveArchive` 的业务数据，需要随目录状态与正文一并保留。

## 边界

### In Scope
- 为 save 模块新增版本化 `storage_keys`
- 将 `ArchiveMeta[] + activeArchiveId` 改为版本化 `localStorage` 持久化
- 将 save 地图设置一并纳入版本化 `localStorage` 状态
- 将 IndexedDB 收敛为仅保存正文 `SaveArchive`
- 调整 Save Store 初始化、选择、删除、清空逻辑
- 调整地图页在存在激活存档时的默认渲染入口
- 增加“所有 save localStorage key 均不存在时清理旧 IndexedDB”的兜底逻辑

### Out of Scope
- 不改变 Save Import 的 UI 布局和交互入口
- 不改变 Rust parser / post-process 的业务提取逻辑
- 不引入旧 IndexedDB 数据到新结构的迁移/搬运逻辑
- 不扩展到 import/export 其他 store 的持久化协议

## 验收标准（DoD）
1. Save 模块具有与其他 store 一样的版本化 `storage_keys` 配置入口。
2. 当前版本下的存档列表与 `activeArchiveId` 存在于 `localStorage`，而不是从 IndexedDB 列表表恢复。
3. 当前版本下的 save 地图设置存在于 `localStorage`，且不与具体 archive 绑定。
4. 当前版本切换后，只能看到该版本作用域下的全部存档，不会看到其他版本存档。
5. 完整 `SaveArchive` 正文只保存在 IndexedDB。
6. 选中某条存档并刷新页面后，可从当前版本作用域恢复 `activeArchiveId` 与对应正文。
7. 进入 `maps` 视图时，若存在激活存档，地图应直接按该存档渲染，但不自动打开存档面板。
8. 关闭存档面板、切换激活存档或执行 `clearAll()` 后，save 地图设置仍保持当前版本作用域下的持久化值。
9. 删除存档后，其目录状态与正文都会从当前版本作用域中移除。
10. 清空 Save 数据时，只影响当前版本作用域的存档目录与正文，不影响其他版本，也不重置 save 地图设置。
11. 当所有 save localStorage key 都不存在时，旧 save IndexedDB 会被自动清理。
12. 现有 `parser_version / post_processor_version / isCompatible / isValid` 语义保持不变。

## 未决项
无。
