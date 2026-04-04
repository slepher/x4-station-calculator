# save-local-storage 设计说明

## 设计目标
本次设计只调整 Save Import 的持久化边界，不改变现有上传、解析、后处理与详情展示能力。目标是让 Save 模块与其他业务 store 采用一致的“版本作用域 + 一份状态对象”持久化模式：
- `localStorage` 负责当前版本下的目录状态与激活项
- IndexedDB 负责当前版本下的完整正文
- 版本隔离直接复用现有 `storage_keys` 设计
- 未正式上线阶段不做旧数据迁移，只做条件清库

## 1. 作用域设计

### 1.1 复用现有 storage_keys
- Save 模块不定义新的版本 scope 结构。
- 直接扩展 `VersionConfig.storage_keys`，新增 `save_archives`。
- 该 key 与 `empire / logic_flow / ship_blueprints / setting` 一样，由 `versions.json` 为每个游戏版本明确提供。
- Save Store 通过 `useGameDataStore.getStorageKey('save_archives')` 获取当前作用域 key。

### 1.2 作用域语义
- 当前作用域 key 同时代表：
  - 当前版本的 Save 目录 `localStorage` 槽位
  - 当前版本的 Save 正文 IndexedDB 查询范围
- 不额外引入 `versionScope` 概念给业务层消费，避免出现“双重作用域定义”。
- IndexedDB 层内部可以保存 `scopeKey` 字段，但该字段语义直接等于 `getStorageKey('save_archives')` 的返回值。

## 2. localStorage 状态设计

### 2.1 状态结构
Save 模块新增与其他 store 一致的持久化状态对象：

```ts
interface SavedSaveArchivesState {
  version: number
  activeArchiveId: string | null
  list: ArchiveMeta[]
  settings: SaveArchiveSettings
}
```

说明：
- `version` 是 save 目录状态自身的 schema 版本，用于后续本模块演进
- `activeArchiveId` 表示当前版本作用域下的激活存档
- `list` 保存当前版本作用域下的全部 `ArchiveMeta`
- `settings` 保存当前版本作用域下的 save 地图 UI 选项

### 2.2 为什么不拆两个 key
- 现有 `empire / flow / ship blueprints` 都采用“一份状态对象，一个 key”的模式。
- Save 模块拆成 `meta key + active key` 会破坏项目内一致性，也会增加初始化和修复逻辑复杂度。
- 因此 `activeArchiveId` 必须跟 `list` 一起持久化。

### 2.3 SaveArchiveSettings 的职责
`settings` 用于保存“当前版本下的 save 地图展示偏好”，而不是某条存档自己的状态：

```ts
interface SaveArchiveSettings {
  visibility: SavePoiVisibility
  excludeConditionalSmallStations: boolean
}
```

约束：
- `visibility` 保存各个 POI 分类 checkbox 的状态
- `excludeConditionalSmallStations` 保存“删除条件小站点” checkbox 状态
- 这些值在关闭面板、切换激活存档、刷新页面后都应保持
- 这些值只受版本作用域隔离，不受 archive 切换影响

### 2.4 ArchiveMeta 的职责
- `ArchiveMeta` 负责左侧列表和恢复入口所需的轻量信息。
- 其中保留现有业务字段：
  - `guid`
  - `time`
  - `playerName`
  - `version`
  - `filename`
  - `parser_version`
  - `post_processor_version`
  - `source`
  - `isCompatible`
  - `isValid`
  - `createdAt`
  - `sectorCount`
- `id` 继续使用 `${guid}_${time}`。

## 3. IndexedDB 正文设计

### 3.1 收敛为正文仓库
- 新设计下 IndexedDB 不再负责存档列表元数据。
- 旧的 `archives` 表可被移除或视为 legacy 结构。
- DB 层只保留正文记录表，例如：

```ts
interface ArchiveDataRecord {
  id: string
  scopeKey: string
  archiveId: string
  data: SaveArchive
}
```

### 3.2 主键与索引
- `archiveId = ${guid}_${time}`
- `id = ${scopeKey}:${archiveId}`
- 额外保存 `scopeKey` 与 `archiveId` 字段，便于：
  - 按当前作用域批量清空
  - 调试时快速定位

Dexie 表建议最少包含：

```ts
archiveData: 'id, scopeKey, archiveId'
```

### 3.3 查询边界
- `loadArchiveDetailFromDB(scopeKey, archiveId)` 只读当前作用域对应记录
- `removeArchiveFromDB(scopeKey, archiveId)` 只删当前作用域对应记录
- `clearArchivesFromDB(scopeKey)` 只清当前作用域的正文

这样即使同一个 `guid_time` 在不同版本中都存在，也不会互相覆盖。

## 4. Save Store 设计

### 4.1 Store 内部状态
建议保留现有面向 UI 的高层状态，但底层来源改造：
- `savedArchivesState: Ref<SavedSaveArchivesState>`
- `archives: computed<Map<string, ArchiveGroup>>` 或保留现有分组映射形态
- `selectedArchive: Ref<SaveArchive | null>`
- `isParsing / parseProgress / parseError` 保持不变

核心变化是：
- 左侧列表来自 `savedArchivesState.list`
- 当前选中项恢复入口来自 `savedArchivesState.activeArchiveId`
- 存档面板 checkbox 状态来自 `savedArchivesState.settings`
- 完整正文来自 IndexedDB

### 4.2 初始化流程
初始化顺序改为：

1. 获取当前 `scopeKey = gameDataStore.getStorageKey('save_archives')`
2. 执行 legacy cleanup gate
3. 从 `localStorage[scopeKey]` 读取 `SavedSaveArchivesState`
4. 若读取失败或为空，则初始化为空状态
5. 若旧状态中缺少 `settings`，则迁移补默认值并回写
6. 若 `activeArchiveId` 存在，则从 IndexedDB 读取正文
7. 若正文不存在，则清空无效的 `activeArchiveId` 并回写 `localStorage`

初始化阶段不再从 IndexedDB 全量扫描 meta 列表。

### 4.3 新增存档流程
`addArchive(archive)` 调整为：

1. 规范化 `archive.sectors`
2. 重新计算 `isCompatible / isValid`
3. 生成 `archiveId`
4. 构造或更新 `ArchiveMeta`
5. 更新 `savedArchivesState.list`
6. 设置 `savedArchivesState.activeArchiveId = archiveId`
7. 回写 `localStorage`
8. 设置 `selectedArchive = archive`
9. 异步写入 IndexedDB 正文

该顺序与其他 store 的“先更新当前作用域状态，再处理附属仓库”模式一致。

### 4.4 选择存档流程
`selectArchive(guid, time)` 调整为：

1. 生成 `archiveId`
2. 若目录状态中不存在该条 meta，则清空 `selectedArchive` 并返回
3. 更新 `savedArchivesState.activeArchiveId`
4. 回写 `localStorage`
5. 从 IndexedDB 读取 `${scopeKey}:${archiveId}`
6. 若读到正文，则恢复 `selectedArchive`
7. 若读不到，则：
   - 清空 `selectedArchive`
   - 清空 `activeArchiveId`
   - 回写修正后的 `localStorage`

### 4.5 删除流程
`removeArchive(guid, time)`：

1. 从 `savedArchivesState.list` 删除对应 meta
2. 若该项是当前激活项，则清空 `activeArchiveId`
3. 若该项是当前选中项，则清空 `selectedArchive`
4. 回写 `localStorage`
5. 删除当前作用域下的正文记录

### 4.6 清空流程
`clearAll()`：

1. 重置当前作用域下的 `SavedSaveArchivesState`
2. 保留当前作用域下已有的 `settings`
3. 清空 `selectedArchive`
4. 保留解析 UI 的重置逻辑
5. 回写当前作用域的空状态
6. 删除当前作用域下的全部正文

这里必须只清当前 `scopeKey`，不能删除其他版本作用域的数据。

### 4.7 maps 视图与激活存档
地图页需要把“当前地图是否按存档渲染”和“存档面板是否展开”拆成两个状态来源：

- 地图渲染来源：
  - 优先使用 `saveStore.selectedArchive`
  - 若已恢复激活存档，则进入 `maps` 时直接按该存档渲染 overlays / sector override
- 面板 UI 状态：
  - 仅由 `isSavePanelOpen` 控制
  - 不因为激活存档恢复而自动打开

这样可以满足：
- 进入 `maps` 时自动回到激活存档的地图态
- 但不会自动弹出存档面板

## 5. 旧结构清理设计

### 5.1 不做迁移
- 当前功能尚未正式上线，因此不把旧 IndexedDB 中的 meta / 正文搬运到新结构。
- 旧结构只做“条件满足时清理”。

### 5.2 legacy cleanup gate
初始化前执行以下判定：

1. 遍历全部 `versionsConfig`
2. 收集每个版本的 `storage_keys.save_archives`
3. 检查这些 key 在 `localStorage` 中是否全部不存在

若“全部不存在”：
- 说明系统没有任何可信的 Save 目录状态
- 可以直接清理旧 save IndexedDB 结构

若“任意一个存在”：
- 跳过旧 DB 清理
- 按当前版本作用域正常启动

### 5.3 清理方式
优先推荐：直接删除整个 save 专用 DB。

原因：
- 当前 `X4SaveArchiveDB` 只服务 save 模块
- 直接删库比逐表清理更简单
- 能避免 legacy schema 与新 schema 并存造成的判断分支

若实现层面对删库有顾虑，也可退化为只清 legacy 表，但首选删库。

## 6. 版本与后处理规则保持不变

本次不改变以下业务语义：
- `checkVersionCompatibility`
- `parser_version` 失配时 `isValid = false`
- `post_processor_version` 落后时重新执行 post-process
- `isCompatible / isValid` 的页面展示含义

差异只在于：
- 这些状态在目录层由 `localStorage` 保存
- 完整正文在按需读取后再决定是否需要 reprocess

即：
- 目录状态负责“显示什么”
- 正文仓库负责“内容是什么”

## 7. 风险与对策

### 风险 1：目录状态与正文写入顺序不同步
- 现有 `addArchive()` 已经是异步写 DB。
- 新设计仍保留“目录先更新，正文后落库”的行为。
- 对策：
  - 初始化与选择路径都要处理“有目录但正文不存在”的修复逻辑。

### 风险 2：版本切换后误读旧版本正文
- 若 DB API 忘记带 `scopeKey`，容易命中跨版本正文。
- 对策：
  - DB API 全部显式接收 `scopeKey`
  - 主键使用 `${scopeKey}:${archiveId}`

### 风险 3：legacy cleanup 条件误判
- 若只检查当前版本 key，会把其他版本仍有效的数据误判为“无目录状态”。
- 对策：
  - 必须遍历全部 `versionsConfig` 的 save key 做全量检查。

### 风险 4：Save 目录状态结构未来演进
- 新增本地状态结构后，后续字段变更需要迁移入口。
- 对策：
  - 目录状态单独维护 `version`
  - 预留 `migrateSaveArchivesStateToCurrent` 之类的入口

### 风险 5：面板设置误绑定到 archive
- 如果 checkbox 仍然存在于地图页局部 `ref`，切换 archive 或关闭面板时容易被重置。
- 对策：
  - 统一从 `savedArchivesState.settings` 读取与写回
  - UI 层不再把这些 checkbox 当作单条 archive 的局部状态
