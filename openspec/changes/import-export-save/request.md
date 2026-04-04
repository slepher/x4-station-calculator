# import-export-save 需求说明

## 目标
在现有导入导出系统中接入用户存档（Save Archive）模块，使其成为第四个可导入导出的模块，与 Empire、Logic Flow、Ship Blueprints 保持一致的导入导出流程。Save 模块导出包含存档索引和完整正文，导入时强制校验版本匹配，并对每条存档执行 parser_version 和 post_processor_version 校验与处理。

## 已确认方案（审核重点）

### 1. 导出数据结构
- Save 模块导出 payload 结构：`{ state: SavedSaveArchivesState, archives: SaveArchive[] }`
- `state` 包含：meta 列表、activeId、settings（与 localStorage 结构一致）
- `archives` 包含：完整存档正文数组，与 meta 列表一一对应
- 导出文件顶层保留现有 `game_vsn / beta` 元数据，标记来源版本
- 导出文件体积增大（包含所有存档正文），但可实现完整备份和一键恢复

### 2. 导出流程
- 从当前版本作用域的 localStorage 读取 `savedArchivesState`
- 遍历 `list` 中每条 meta，从当前版本作用域的 IndexedDB 读取对应正文
- 组装 `{ state, archives }` 结构
- 写入导出文件的 `data.x4_save_archives` 字段

### 3. 导入流程（完整版）

#### 3.1 migrate
- 对 `state` 执行 `migrateSaveArchivesStateToCurrent`（当前 v1，提供接口不做实质操作）
- 对每条 `archive` 正文执行 `normalizeSectorData` 等数据归一化

#### 3.2 sanitize（版本 + parser_version 校验）
- **版本校验**：存档 `meta.version` 与 `gameDataStore.currentVersion` 不匹配 → 跳过该存档，统计跳过数量和详情
- **parser_version 校验**：存档 `meta.parser_version` 与 `CURRENT_PARSER_VERSION` 不匹配 → 跳过该存档，统计跳过数量和详情
- **输出**：仅保留版本和 parser_version 均匹配的存档列表
- **UI 展示**：显示有效数量和跳过详情列表（可折叠）

#### 3.3 post_processor_version 校验 + re-process
- 遍历每条保留的存档：
  - 若 `meta.post_processor_version` 与 `CURRENT_POST_PROCESSOR_VERSION` 不匹配：
    - 执行 `postProcessRustSaveArchive` 重新处理
    - 更新 `meta.post_processor_version` 到当前版本
    - 更新 `meta.isValid` 和其他派生字段
  - 若匹配：直接使用原正文

#### 3.4 同名存档覆盖
- **判定**：相同 `guid + time` 的存档
- **处理**：直接覆盖 meta 和正文（不创建新 ID）
- **增量模式 ID 冲突**：同名存档覆盖，其他存档追加（使用原有 ID）

#### 3.5 apply（写入 localStorage + IndexedDB）

**覆盖模式**：
1. 获取当前版本作用域：`scopeKey = gameDataStore.getStorageKey('save_archives')`
2. 清理当前作用域：
   - 清理 `localStorage[scopeKey]`（写入空状态）
   - 调用 `clearArchivesFromDB(scopeKey)` 清理 IndexedDB
3. 写入新数据：
   - 写入 state 到 `localStorage[scopeKey]`
   - 写入所有 archives 到 IndexedDB（主键 `${scopeKey}:${archiveId}`）

**增量模式**：
1. 获取当前版本作用域：`scopeKey`
2. 读取当前作用域状态：`localStorage[scopeKey]`
3. 合并 meta 列表：
   - 同名存档（相同 guid+time）：覆盖 meta 和 IndexedDB 正文
   - 其他存档：追加到 meta 列表和 IndexedDB
4. activeId 决策：
   - 若当前无 activeArchiveId → 使用导入的 activeArchiveId
   - 若当前有 activeArchiveId → 保持不变

#### 3.6 context refresh
- **触发条件**：当前视图为 `maps`，且 `activeArchiveId` 发生变化
- **刷新动作**：
  - 清空当前 overlay
  - 若新 `activeArchiveId` 对应正文存在，恢复 overlay
  - 若正文不存在（异常情况），显示空地图

### 4. 版本作用域隔离（关键约束）

#### 4.1 作用域定义
- 作用域来源：`useGameDataStore.getStorageKey('save_archives')`
- 不同版本的作用域 key：
  - 8.0 stable: `x4_save_archives_8_0`
  - 8.0 beta: `x4_save_archives_8_0_beta`
  - 9.0 stable: `x4_save_archives_9_0`
  - 9.0 beta: `x4_save_archives_9_0_beta`
- IndexedDB 主键：`${scopeKey}:${archiveId}`，天然隔离不同版本

#### 4.2 导入导出隔离规则
- **导出**：从当前版本作用域读取数据，导出文件标记来源版本
- **导入**：所有写入操作使用当前版本作用域的 `scopeKey`
- **跨版本导入**：
  - 存档 `meta.version` 与当前版本不匹配 → 存档跳过（符合版本强制校验规则）
  - 导入操作不影响其他版本作用域的数据
- **覆盖导入隔离**：
  - 清理和写入限定在当前版本作用域
  - 例如：在 9.0 作用下导入，不影响 8.0 作用域的数据

#### 4.3 版本切换后的导入导出
- 用户切换版本后，`getStorageKey('save_archives')` 返回新作用域 key
- 导入导出操作自动切换到新作用域
- 各版本数据完全隔离，无串读串写

### 5. 三项特殊行为

#### 5.1 导出界面全选行为
- 用户点击"全选"时，默认勾选 Empire/Flow/Ship，**不自动勾选 Save**
- Save 模块旁显示说明："包含存档索引和正文，文件体积较大"
- 降低误导出风险，用户可能不需要备份存档

#### 5.2 版本强制匹配
- Save 存档导入强制校验版本匹配，不匹配的存档不导入（不可自动转换）
- 对比其他模块：Empire/Flow/Ship 版本不匹配时可导入，但会 sanitize 无效引用
- 理由：Save 存档与游戏版本强绑定（星区数据、站点定义等），跨版本存档可能导致地图渲染错误

#### 5.3 parser_version / post_processor_version 校验
- **parser_version 校验**：不匹配的存档不导入（结构不可用）
- **post_processor_version 校验**：不匹配则重新执行 post_process（更新到最新版本）
- **同名存档处理**：直接覆盖 meta 和正文

### 6. UI 调整

#### 6.1 导出界面
- Save 模块统计展示："存档 (3)" 显示 meta 数量
- Save 模块说明文案："包含存档索引和正文，文件体积较大"
- 全选行为：不自动勾选 Save

#### 6.2 导入界面
- Save 模块区域：
  - 显示有效数量："导入 3 条存档"
  - 显示跳过数量："跳过 2 条存档（版本/parser 不匹配）"
  - 显示跳过详情列表（可折叠）
- 模块选择：Save 模块可独立勾选

### 7. 模块定位与命名

#### 7.1 内部存储键
- `x4_save_archives`（与 save-local-storage design 一致）

#### 7.2 用户显示名
- 中文：`存档`
- 英文：`Save Archive`

#### 7.3 i18n key 统一
- 与 empire/logic_flow/ship_blueprints 共用 `module_*` 命名体系

## 边界

### In Scope
1. Save 模块接入导入导出流水线（成为第四模块）
2. 导出 payload 中新增 `x4_save_archives` 模块数据（state + archives）
3. 导入支持 Save 模块的 migrate、sanitize、apply 流程
4. Save 模块的 activeId 决策规则（复用现有规则模式）
5. Save 模块导入后的 context refresh（maps 视图刷新）
6. 版本作用域隔离（复用 `storage_keys.save_archives`）
7. UI 展示 Save 模块统计与模块级多选
8. 导出界面全选行为特殊处理（不自动勾选 Save）
9. 导入时版本强制校验（不匹配的存档不导入）
10. 导入时 parser_version 和 post_processor_version 校验与处理
11. 同名存档覆盖逻辑
12. 覆盖导入清理当前版本作用域的 IndexedDB

### Out of Scope
1. 不改变现有 Save 模块持久化结构（已按 save-local-storage design 实现）
2. 不改变导入导出 UI 布局（复用现有 TabBar 按钮 + Modal 流程）
3. 不引入 Save 模块独立的导入入口（不新增独立 UI 通路）
4. 不扩展到其他未规划模块
5. 不实现跨版本存档自动转换
6. 不改变现有 Empire/Flow/Ship 导入导出流程

## 验收标准（DoD）

1. 导出 payload 包含 `x4_save_archives`，结构为 `{ state, archives }`
2. 导出界面全选时不自动勾选 Save 模块
3. 导入界面显示 Save 模块有效数量和跳过详情
4. Save 存档导入强制校验版本匹配，不匹配的存档跳过
5. Save 存档导入强制校验 parser_version，不匹配的存档跳过
6. Save 存档导入时，post_processor_version 不匹配则重新执行 post_process
7. 同名存档（相同 guid+time）直接覆盖 meta 和正文
8. Save 模块提供 migrate 接口（当前 v1 无实质操作）
9. Save 模块导入后的 activeId 决策符合规则
10. Save 模块导入后，若当前在 maps 视图且 activeArchiveId 变化，触发 context refresh
11. 现有 Empire/Flow/Ship 导入导出不受影响
12. 覆盖导入 Save 模块时，清理当前版本作用域下的 IndexedDB 正文（调用 `clearArchivesFromDB(scopeKey)`）
13. 覆盖导入 Save 模块时，清理当前版本作用域下的 localStorage 状态
14. 覆盖导入 Save 模块时，不影响其他版本作用域的数据（如 8.0 导入不影响 9.0 数据）
15. 增量导入 Save 模块时，合并操作限定在当前版本作用域
16. 导出 payload 的 `game_vsn / beta` 标记来源版本
17. 导入时校验存档版本与当前版本匹配，不匹配的存档跳过
18. Save 模块的导入导出使用 `getStorageKey('save_archives')` 获取版本作用域 key
19. IndexedDB 正文主键使用 `${scopeKey}:${archiveId}` 格式，天然隔离不同版本

## 未决项
无。