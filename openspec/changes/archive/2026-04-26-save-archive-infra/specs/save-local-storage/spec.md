# Save Local Storage Specification

## Purpose
定义 Save Import 持久化从“IndexedDB 同时承载 meta 与正文”调整为“版本化 `localStorage` 承载目录状态，IndexedDB 只承载正文”的要求，并确保 Save 模块复用现有游戏版本作用域设计。

## ADDED Requirements

### Requirement: Save Store SHALL Use Versioned LocalStorage State
Save Store MUST 使用当前游戏版本配置中的 save storage key，将存档目录状态持久化到 `localStorage`。

#### Scenario: Persist Save Directory State In Current Version Scope
- **前提** 当前游戏版本已经通过 `useGameDataStore` 选择并生效
- **当** Save Store 读取或写入存档目录状态
- **那么** 它 MUST 使用当前版本配置下的 save storage key
- **并且** 该状态 MUST 包含 `version`、`activeArchiveId`、全部 `ArchiveMeta` 与 save 地图 settings

#### Scenario: Isolate Save Directory Across Game Versions
- **前提** 用户在两个不同游戏版本下都导入过存档
- **当** 用户切换到其中一个游戏版本
- **那么** Save Store SHALL 只恢复该版本作用域下的存档目录状态
- **并且** 不得显示其他版本作用域下的存档目录

### Requirement: Save Store SHALL Persist Active Archive In LocalStorage
Save Store MUST 将当前激活存档作为版本化目录状态的一部分持久化，而不是仅保留在内存中。

#### Scenario: Restore Active Archive After Reload
- **前提** 当前版本作用域下存在 `activeArchiveId`
- **并且** IndexedDB 中存在该存档的正文
- **当** 页面刷新并重新初始化 Save Store
- **那么** Save Store SHALL 恢复该 `activeArchiveId`
- **并且** SHALL 读取正文并恢复 `selectedArchive`

#### Scenario: Repair Broken Active Archive Reference
- **前提** 当前版本作用域下存在 `activeArchiveId`
- **并且** IndexedDB 中不存在该正文
- **当** Save Store 初始化或选择该存档
- **那么** Save Store SHALL 清空无效的 `activeArchiveId`
- **并且** SHALL 回写修正后的目录状态到当前版本作用域

### Requirement: Save Map Settings SHALL Be Persisted Per Version Scope And Not Per Archive
存档面板中的地图展示 settings MUST 保存在当前版本作用域的 save localStorage 状态中，并且 MUST NOT 绑定到具体 archive。

#### Scenario: Persist Save Checkbox Settings Across Panel Close
- **前提** 用户已经在存档面板中修改了 POI 分类 checkbox 或“删除条件小站点” checkbox
- **当** 用户关闭存档面板
- **那么** Save Store SHALL 保留当前版本作用域下的这些 settings
- **并且** 下次重新打开面板时 SHALL 恢复同样的勾选状态

#### Scenario: Persist Save Checkbox Settings Across Archive Switch
- **前提** 用户已经在当前版本作用域下设置了存档面板 checkbox 状态
- **当** 用户切换激活存档
- **那么** 系统 SHALL 继续使用同一份当前版本作用域下的 settings
- **并且** SHALL NOT 因 archive 切换而重置这些 checkbox

#### Scenario: Keep Save Checkbox Settings When Clearing Archives
- **前提** 当前版本作用域下已经存在 save 地图 settings
- **当** 用户执行清空存档目录与正文
- **那么** 系统 SHALL 清空存档目录与正文
- **并且** SHALL 保留当前版本作用域下的 save 地图 settings

### Requirement: Save Archive Body SHALL Be Stored In IndexedDB Only
完整 `SaveArchive` 正文 MUST 只保存在 IndexedDB，不再作为目录状态写入 `localStorage`。

#### Scenario: Save Archive Body With Scoped Identity
- **前提** 用户在当前版本作用域中新增或更新一条存档
- **当** Save Store 持久化该存档正文
- **那么** IndexedDB 记录 MUST 携带当前版本作用域标识
- **并且** MUST 使用“作用域 + archiveId”形成唯一身份

#### Scenario: Load Archive Body By Current Scope
- **前提** 当前版本作用域下存在某个 `activeArchiveId`
- **当** Save Store 读取该存档正文
- **那么** 它 SHALL 只查询当前版本作用域下的 IndexedDB 记录
- **并且** 不得跨版本命中其他正文

### Requirement: Save Store SHALL Update LocalStorage Directory Before Body Persistence Completes
Save Store 在新增、删除、切换存档时 MUST 先同步目录状态，再处理正文仓库读写。

#### Scenario: Add Archive Updates Directory State
- **前提** 用户导入了一条新的有效存档
- **当** Save Store 处理新增
- **那么** 它 SHALL 先更新当前版本作用域下的 `ArchiveMeta` 列表与 `activeArchiveId`
- **并且** 再写入对应正文到 IndexedDB

#### Scenario: Remove Archive Updates Directory State
- **前提** 当前版本作用域下存在一条已保存存档
- **当** 用户删除该存档
- **那么** Save Store SHALL 先从目录状态中移除对应 `ArchiveMeta`
- **并且** 若该存档为当前激活存档，则 SHALL 同步清空 `activeArchiveId`
- **并且** SHALL 删除当前版本作用域下的正文记录

### Requirement: Save Store SHALL Clear Data Per Version Scope
Save Store 的清空行为 MUST 只影响当前版本作用域。

#### Scenario: Clear Save Data In Current Scope Only
- **前提** 不同游戏版本作用域下都存在 Save 数据
- **当** 用户在当前版本执行清空
- **那么** Save Store SHALL 只清空当前版本作用域下的目录状态与正文
- **并且** 不得删除其他版本作用域的 Save 数据
- **并且** SHALL 保留当前版本作用域下的 save 地图 settings

### Requirement: Maps View SHALL Use Active Archive Without Forcing Save Panel Open
进入 `maps` 视图时，如果当前版本作用域存在可恢复的激活存档，地图主画布 MUST 直接基于该存档渲染；存档面板 MUST NOT 因此自动展开。

#### Scenario: Render Maps View From Active Archive
- **前提** 当前版本作用域下存在有效的 `activeArchiveId`
- **并且** 对应正文可以从 IndexedDB 恢复
- **当** 用户进入 `maps` 视图
- **那么** 地图主画布 SHALL 使用该激活存档的数据渲染
- **并且** 用户无需再次手动选择该存档

#### Scenario: Do Not Auto Open Save Panel When Maps View Uses Active Archive
- **前提** `maps` 视图已经基于激活存档渲染
- **当** 页面完成进入或刷新恢复
- **那么** 存档面板 SHALL 保持关闭
- **并且** 只有用户主动打开时才显示面板 UI

### Requirement: Legacy Save DB SHALL Be Cleaned When No Scoped Save Keys Exist
在未正式上线阶段，系统 MUST 使用“无 save localStorage key 时清理旧 DB”的策略替代数据迁移。

#### Scenario: Cleanup Legacy Save DB Without Scoped Directory State
- **前提** 所有已配置游戏版本的 save storage key 在 `localStorage` 中都不存在
- **当** Save Store 执行初始化前的旧结构检查
- **那么** 系统 SHALL 清理旧 save IndexedDB 数据
- **并且** SHALL 不执行旧结构数据迁移

#### Scenario: Keep Save DB When Any Scoped Key Exists
- **前提** 至少一个已配置游戏版本的 save storage key 在 `localStorage` 中存在
- **当** Save Store 执行旧结构检查
- **那么** 系统 SHALL 跳过旧 save IndexedDB 清理
- **并且** SHALL 按当前版本作用域正常初始化

### Requirement: Save Import Persistence SHALL Use LocalStorage For Directory Recovery
Save Import 恢复链路 MUST 从 IndexedDB 列表恢复改为从版本化 `localStorage` 目录状态恢复。

#### Scenario: Initialize Save List From LocalStorage Instead Of IndexedDB Meta Table
- **前提** 当前版本作用域下已经存在保存过的 Save 目录状态
- **当** Save Store 初始化左侧存档列表
- **那么** 它 SHALL 从当前版本作用域的 `localStorage` 读取 `ArchiveMeta` 列表
- **并且** SHALL 不再依赖 IndexedDB 列表表作为一级列表来源
