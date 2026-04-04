# import-export-save 设计说明

## 设计目标
本次设计在现有导入导出系统中接入 Save Archive 模块，使其成为第四个可导入导出的模块。核心目标是：
1. Save 模块导出包含存档索引和完整正文（不同于仅导出 meta 的方案 A）
2. Save 模块导入强制校验版本匹配，不匹配的存档不导入
3. Save 模块导入对每条存档执行 parser_version 和 post_processor_version 校验与处理
4. Save 模块导入导出严格按版本作用域隔离，不影响其他版本数据
5. 导出界面全选行为特殊处理（不自动勾选 Save）

## 1. 导出数据结构设计

### 1.1 Export Payload 结构扩展

现有导出 payload 结构：
```typescript
{
  format: 'x4-import-export',
  version: 1,
  exportedAt: string,
  game_vsn: string,
  beta: boolean,
  data: {
    x4_empire_data: SavedEmpiresState,
    x4_logic_flow_plans: SavedFlowPlansState,
    x4_ship_blueprints: SavedShipBlueprintsState
  }
}
```

新增 Save 模块后的结构：
```typescript
{
  format: 'x4-import-export',
  version: 1,
  exportedAt: string,
  game_vsn: string,
  beta: boolean,
  data: {
    x4_empire_data: SavedEmpiresState,
    x4_logic_flow_plans: SavedFlowPlansState,
    x4_ship_blueprints: SavedShipBlueprintsState,
    x4_save_archives: SaveArchiveExportData  // 新增
  }
}
```

### 1.2 SaveArchiveExportData 结构

```typescript
interface SaveArchiveExportData {
  state: SavedSaveArchivesState    // 存档索引 + activeId + settings
  archives: SaveArchive[]          // 完整存档正文数组
}
```

**字段说明**：
- `state`：从 localStorage 读取的完整状态，包含：
  - `version`：状态版本号（当前 v1）
  - `activeArchiveId`：当前激活存档 ID
  - `list`：所有存档的 meta 列表
  - `settings`：Save 地图设置（POI 可见性、删除条件小站点等）
- `archives`：从 IndexedDB 读取的完整正文数组，每条正文包含：
  - `meta`：存档元数据
  - `sectors`：所有星区数据
  - `isCompatible`：版本兼容性标记
  - `isValid`：parser_version 兼容性标记

### 1.3 导出流程设计

**步骤**：
1. 获取当前版本作用域：`scopeKey = gameDataStore.getStorageKey('save_archives')`
2. 从 localStorage 读取 `savedArchivesState`：`localStorage[scopeKey]`
3. 遍历 `state.list` 中每条 meta，从 IndexedDB 读取对应正文：
   - 主键：`${scopeKey}:${archiveId}`
   - 调用：`loadArchiveDetailFromDB(scopeKey, archiveId)`
4. 组装 `SaveArchiveExportData`
5. 写入导出 payload 的 `data.x4_save_archives` 字段

**异步处理**：
- IndexedDB 读取是异步操作，需要 `await` 或 Promise.all
- 导出整体流程需要改为异步函数

### 1.4 导出文件体积考虑

**文件体积增大原因**：
- 包含所有存档的完整正文（星区数据、站点、船只、vault 等）
- 每条存档正文可能包含数十个星区，每个星区包含多个站点和 POI

**权衡**：
- 优点：完整备份，导入后可一键恢复，无需重新上传存档文件
- 缺点：导出文件较大，导出和导入耗时增加

**UI 提示**：
- 在 Save 模块旁显示："包含存档索引和正文，文件体积较大"
- 用户可独立勾选是否导出 Save 模块

## 2. 导入流程设计

### 2.1 导入流程总览

**完整流水线**（与其他模块一致，但 sanitize 规则特殊）：
```
normalize -> migrate -> sanitize -> re-process -> apply -> context refresh
```

### 2.2 normalize 阶段

**输入**：导入文件的 `data.x4_save_archives`

**处理**：
- 解析 JSON，提取 `SaveArchiveExportData`
- 验证结构合法性：
  - `state` 必须包含 `version / activeArchiveId / list / settings`
  - `archives` 必须是数组
  - `state.list.length` 应等于 `archives.length`

**输出**：合法的 `SaveArchiveExportData` 对象

### 2.3 migrate 阶段

**输入**：normalized `SaveArchiveExportData`

**处理**：
- 对 `state` 执行 `migrateSaveArchivesStateToCurrent`（当前 v1，无实质操作）
- 对每条 `archive` 正文执行数据归一化：
  - 执行 `normalizeSectorData(sectorId, sector)` 
  - 确保 `sectors` 结构符合当前版本要求

**输出**：迁移后的 `SaveArchiveExportData`

**扩展性**：
- 迁移接口必须可扩展，以支持未来版本演进
- 当前 v1 到 v1：返回原数据
- 未来 v1 到 v2：执行实质性迁移逻辑

### 2.4 sanitize 阶段（关键差异点）

**与其他模块的差异**：
- Empire/Flow/Ship：版本不匹配时可导入，但会清理无效引用
- Save：版本或 parser_version 不匹配时**整条存档跳过**，不可导入

**处理流程**：
1. 获取当前游戏版本：`currentVersion = gameDataStore.currentVersion`
2. 遍历每条 archive：
   - **版本校验**：
     - `normalizeVersion(archive.meta.version)` vs `normalizeVersion(currentVersion)`
     - 不匹配 → 跳过，记录详情
   - **parser_version 校验**：
     - `archive.meta.parser_version` vs `CURRENT_PARSER_VERSION`
     - 不匹配 → 跳过，记录详情
3. 统计有效存档数量和跳过存档数量
4. 收集跳过详情列表（每条跳过存档的 filename + 原因）

**输出**：
- `validArchives`：通过校验的存档列表
- `validMetas`：对应的 meta 列表
- `skipCount`：跳过存档数量
- `skipDetails`：跳过详情列表

**UI 展示**：
- 显示："导入 3 条存档，跳过 2 条存档（版本/parser 不匹配）"
- 提供可折叠的跳过详情列表

### 2.5 re-process 阶段

**目的**：确保导入存档的 post_processor_version 为最新版本

**处理流程**：
1. 遍历每条 `validArchive`：
   - 检查 `archive.meta.post_processor_version`
   - 若与 `CURRENT_POST_PROCESSOR_VERSION` 不匹配：
     - 执行 `postProcessRustSaveArchive(archive, modulesByMacroId, maps)`
     - 更新 `archive.meta.post_processor_version`
     - 更新 `archive.meta.isValid` 和其他派生字段
   - 若匹配：直接使用原 archive

**依赖**：
- `modulesByMacroId`：当前版本的游戏模块映射
- `maps`：当前版本的地图数据

**输出**：所有存档正文均已更新到最新 post_processor_version

### 2.6 apply 阶段（写入 localStorage + IndexedDB）

#### 2.6.1 覆盖模式

**步骤**：
1. 获取当前版本作用域：`scopeKey = gameDataStore.getStorageKey('save_archives')`
2. 清理当前作用域：
   - 清理 localStorage：`localStorage.removeItem(scopeKey)` 或写入空状态
   - 清理 IndexedDB：调用 `clearArchivesFromDB(scopeKey)`
3. 构造新的 state：
   - `version: CURRENT_SAVE_ARCHIVES_VERSION`
   - `activeArchiveId: validMetas[0]?.id || null`（或使用导入的 activeArchiveId）
   - `list: validMetas`
   - `settings: importedState.settings` 或保持默认值
4. 写入 localStorage：`localStorage[scopeKey] = JSON.stringify(state)`
5. 写入 IndexedDB：
   - 遍历 `validArchives`，调用 `saveArchiveToDB(scopeKey, archive)`
   - 主键：`${scopeKey}:${archiveId}`

**关键约束**：
- 清理和写入必须限定在当前版本作用域
- 不能删除或写入其他版本作用域的数据

#### 2.6.2 增量模式

**步骤**：
1. 获取当前版本作用域：`scopeKey`
2. 读取当前作用域状态：`current = localStorage[scopeKey]`
3. 合并 meta 列表：
   - 遍历 `validMetas`：
     - 若存在同名存档（相同 guid+time）：覆盖 meta
     - 若不存在：追加到 `list`
   - 使用 `upsertArchiveMeta` 函数（已存在 useSaveStore.ts:343）
4. 合并 IndexedDB 正文：
   - 同名存档：调用 `saveArchiveToDB(scopeKey, archive)`（覆盖）
   - 其他存档：调用 `saveArchiveToDB(scopeKey, archive)`（追加）
5. activeId 决策：
   - 若当前 `activeArchiveId` 为空 → 使用导入的 `activeArchiveId`
   - 若当前 `activeArchiveId` 非空且 `selectedArchive` 非空 → 保持不变
6. 写入合并后的 state 到 localStorage

### 2.7 context refresh 阶段

**触发条件**：
- 当前视图为 `maps`
- Save 模块导入导致 `activeArchiveId` 变化

**刷新动作**：
1. 清空当前 maps overlay
2. 若新 `activeArchiveId` 对应正文存在（导入后必然存在）：
   - 恢复 overlay：调用 `deriveSavePoiCategoryData` 和 `flattenSavePoiCategoryData`
3. 若正文不存在（异常情况）：
   - 显示空地图
   - 可考虑显示提示："存档正文不存在，请重新上传"

**实现位置**：
- 在 `applySaveImport` 完成后判断 `currentView === 'maps'`
- 触发地图组件的 overlay 刷新逻辑

## 3. 版本作用域隔离设计

### 3.1 作用域来源

**作用域 key 定义**：
- 来源：`useGameDataStore.getStorageKey('save_archives')`
- 依据：`versions.json` 中每个版本的 `storage_keys.save_archives`

**不同版本的作用域 key 示例**：
- 8.0 stable: `x4_save_archives_8_0`
- 8.0 beta: `x4_save_archives_8_0_beta`
- 9.0 stable: `x4_save_archives_9_0`
- 9.0 beta: `x4_save_archives_9_0_beta`

### 3.2 IndexedDB 主键设计

**主键格式**：`${scopeKey}:${archiveId}`

**示例**：
- 8.0 作用域下的存档：`x4_save_archives_8_0:guid_1234567890`
- 9.0 作用域下的存档：`x4_save_archives_9_0:guid_1234567890`

**天然隔离**：
- 即使同一个 `guid_time`，在不同版本下也有不同的主键
- IndexedDB 查询和写入自动限定到当前作用域

### 3.3 导入导出隔离规则

#### 3.3.1 导出隔离

**规则**：
- 导出仅读取当前版本作用域的数据
- `localStorage[scopeKey]`：读取当前作用域的 state
- IndexedDB：仅查询 `scopeKey` 下的正文

**跨版本导出不可能**：
- 用户在 9.0 作用下无法导出 8.0 的存档数据
- 版本切换后，导出数据自动切换到新版本作用域

#### 3.3.2 导入隔离

**规则**：
- 导入写入仅限定在当前版本作用域
- 清理：仅清理当前作用域的 localStorage 和 IndexedDB
- 写入：仅写入当前作用域的 localStorage 和 IndexedDB

**跨版本导入不可能**：
- 用户在 9.0 作用下导入文件，不会影响 8.0 作用域的数据
- 即使导入文件版本为 8.0，sanitize 会跳过所有存档（版本不匹配）

#### 3.3.3 覆盖导入不影响其他版本

**场景示例**：
- 当前游戏版本：9.0
- 导入文件版本：9.0
- 同时存在 8.0 版本的历史数据（`localStorage[x4_save_archives_8_0]`）

**导入行为**：
- 清理 9.0 作用域：`localStorage[x4_save_archives_9_0]` 和 IndexedDB `scopeKey=x4_save_archives_9_0`
- 写入导入数据到 9.0 作用域
- 8.0 作用域的数据完全不受影响（`localStorage[x4_save_archives_8_0]` 保持不变）

### 3.4 版本切换后的导入导出

**用户切换版本后**：
- `useGameDataStore.currentVersion` 变化
- `getStorageKey('save_archives')` 返回新作用域 key
- 导入导出操作自动切换到新作用域
- 各版本数据完全隔离，无串读串写

## 4. UI 调整设计

### 4.1 导出界面

#### 4.1.1 Save 模块展示

**位置**：导出弹窗的模块选择区域

**内容**：
- 模块名称："存档" / "Save Archive"
- 条目统计："存档 (3)"（显示 meta 列表长度）
- 说明文案："包含存档索引和正文，文件体积较大"

**样式**：
- 与 Empire/Flow/Ship 模块并列展示
- 可独立勾选

#### 4.1.2 全选按钮行为

**默认行为**：
- 点击"全选"按钮：
  - 勾选 Empire
  - 勾选 Flow
  - 勾选 Ship
  - **不勾选 Save**

**理由**：
- Save 模块导出文件体积较大
- 用户可能不需要每次导出都备份存档
- 降低误导出风险

**UI 可选方案**：
- 方案 A：全选按钮旁显示提示："存档不包含在全局选择中"
- 方案 B：Save 模块旁显示特殊标记（如星号或图标）

### 4.2 导入界面

#### 4.2.1 Save 模块统计展示

**位置**：导入配置步骤的模块列表区域

**内容**：
- 模块名称："存档" / "Save Archive"
- 有效数量："导入 3 条存档"
- 跳过数量："跳过 2 条存档（版本/parser 不匹配）"
- 跳过详情列表（可折叠）：
  - `[Player1] save_001.xml: version mismatch (8.0 vs 9.0)`
  - `[Player2] save_002.xml: parser_version mismatch (v1 vs v2)`

#### 4.2.2 模块选择

**行为**：
- Save 模块可独立勾选/取消勾选
- 勾选 Save 模块后，执行导入时会处理 Save 数据
- 取消勾选 Save 模块后，跳过 Save 数据导入

#### 4.2.3 版本差异提示

**显示位置**：导入配置界面顶部或文件信息区域

**内容**：
- 若导入文件 `game_vsn / beta` 与当前版本不匹配：
  - 显示警告："文件版本 (8.0) 与当前版本 (9.0) 不匹配"
  - 提示："存档模块需要版本匹配，不匹配的存档将被跳过"

## 5. 实现边界设计

### 5.1 需要新增的实现

**importExport.ts 扩展**：
- 新增 `SAVE_KEY` 常量：`'x4_save_archives'`
- 新增 `SaveArchiveExportData` 类型定义
- 新增 `sanitizeSaveState` 函数（版本 + parser_version 校验）
- 新增 `reprocessSaveArchives` 函数（post_processor_version 校验）
- 新增 `applySaveImport` 函数（写入 localStorage + IndexedDB）
- 扩展 `buildExportPayload` 函数（新增 Save 参数）
- 扩展 `prepareImportPayload` 函数（新增 Save 模块处理）

**UI 组件调整**：
- `StorageExportWizard.vue`：
  - 新增 Save 模块展示
  - 调整全选按钮行为
  - 新增 Save 模块说明文案
- `StorageImportWizard.vue`：
  - 新增 Save 模块统计展示
  - 新增跳过详情列表（可折叠）
  - 新增 Save 模块勾选框

**i18n 扩展**：
- 新增 Save 模块的显示名称 key
- 新增 Save 模块的说明文案 key
- 新增跳过详情的文案 key

### 5.2 需要复用的实现

**useSaveStore.ts**：
- `migrateSaveArchivesStateToCurrent`：迁移接口（当前 v1 无实质操作）
- `upsertArchiveMeta`：同名存档覆盖逻辑（已存在）
- `normalizeSectorData`：星区数据归一化（已存在）
- `postProcessRustSaveArchive`：post-process 逻辑（已存在）
- `clearArchivesFromDB`：清理 IndexedDB 正文（已存在）
- `saveArchiveToDB`：写入 IndexedDB 正文（已存在）
- `loadArchiveDetailFromDB`：读取 IndexedDB 正文（已存在）

**useGameDataStore.ts**：
- `getStorageKey('save_archives')`：获取版本作用域 key（已存在）
- `currentVersion`：当前游戏版本（已存在）
- `modulesByMacroId`：模块映射（已存在）
- `maps`：地图数据（已存在）

**workers/saveParser.post.ts**：
- `CURRENT_PARSER_VERSION`：parser 版本常量（已存在）
- `CURRENT_POST_PROCESSOR_VERSION`：post_processor 版本常量（已存在）

### 5.3 需要修改的实现

**importExport.ts**：
- `ImportModuleKey` 类型：新增 `'x4_save_archives'`
- `ModuleImportStats` 类型：新增 Save 模块统计
- `ImportApplyOptions` 类型：新增 `saveStore` 参数
- `ImportApplyResult` 类型：新增 Save 模块应用结果
- `applyImportPayload` 函数：新增 Save 模块应用分支

**Existing spec imports**：
- `openspec/specs/import-export/spec.md`：需要应用 delta spec（ADDED/MODIFIED）

## 6. 风险与对策

### 风险 1：导入文件体积大，导入耗时增加

**风险描述**：
- Save 模块导出包含所有存档正文，文件体积可能达到数十 MB
- 导入时需要解析、校验、处理大量数据，耗时较长

**对策**：
- UI 提示用户："存档模块包含大量数据，导入可能需要较长时间"
- 使用异步处理，避免阻塞 UI
- 显示导入进度（可选）

### 风险 2：跨版本导入导致存档全部跳过

**风险描述**：
- 用户在 9.0 作用下导入 8.0 的导出文件
- sanitize 阶段所有存档被跳过（版本不匹配）
- 用户可能困惑："为什么导入后没有存档？"

**对策**：
- UI 显示明确的跳过详情列表
- 文件版本与当前版本不匹配时，显示警告提示
- 提示用户："存档模块需要版本匹配，请切换到对应版本后导入"

### 风险 3：IndexedDB 写入失败导致数据不一致

**风险描述**：
- 导入时 localStorage 已写入，但 IndexedDB 正文写入失败
- 导致"有 meta 无正文"的状态

**对策**：
- 先写入 IndexedDB，再写入 localStorage（或同时写入）
- 写入失败时回滚 localStorage
- 显示错误提示，让用户重试

### 风险 4：同名存档覆盖导致用户数据丢失

**风险描述**：
- 增量导入时，同名存档（相同 guid+time）直接覆盖
- 用户可能不知道原有存档被覆盖

**对策**：
- UI 提示："同名存档将被覆盖"
- 显示覆盖数量统计
- 可选：提供"保留两者"选项（生成新 ID）

### 风险 5：post_process 重新执行耗时

**风险描述**：
- 若导入存档的 `post_processor_version` 不匹配，需要重新执行 post_process
- 大量存档需要重新处理，耗时较长

**对策**：
- 异步处理，避免阻塞 UI
- 显示处理进度（可选）
- 提示用户："部分存档需要重新处理，可能需要较长时间"

### 风险 6：全选行为导致用户误导出存档

**风险描述**：
- 用户点击"全选"，预期勾选所有模块
- 但 Save 模块不自动勾选，用户可能遗漏存档备份

**对策**：
- Save 模块旁显示特殊标记或提示
- 用户明确需要备份存档时，手动勾选 Save 模块
- 降低误导出风险（用户可能不需要每次都备份存档）

### 6.5 导入空 Empire 列表后的处理

**问题描述**：
- 导入空的 empire 列表 `{version, activeId:null, list:[]}` 后
- `useEmpireStore.loadData` 中 `activeEmpire.value` 未被设置
- 导致点击 + 创建空间站无反应（`createStation` 检测到 `!activeEmpire.value` 就返回 null）

**解决方案**：
- 在 `loadData` 中增加判断：若 `list` 为空，自动创建默认 empire
- 确保 `activeEmpire.value` 始终有效

### 6.6 导入后 Save 存档列表刷新

**问题描述**：
- Save 模块导入后，存档列表和 maps 视图未刷新

**解决方案**：
- 在 `useSaveStore` 新增方法：
  - `loadData(data)` - 基础加载
  - `loadDataAndRestore(data)` - 加载并恢复 selectedArchive
  - `restoreSelectedArchive(archiveId)` - 暴露给外部调用
- `applySaveImport` 中调用 `loadDataAndRestore` 确保正确恢复

### 6.7 导出界面存档 checkbox

**需求**：
- 存档模块需要 checkbox，默认不勾选
- 其他模块无 checkbox，保持原样

**实现**：
- 新增 `includeSaveArchives` ref，默认 `false`
- 存档模块显示 checkbox
- 仅勾选时导出才包含存档数据

### 6.8 IndexedDB DataCloneError

**问题描述**：
- `ArchiveMeta.createdAt` 类型为 `Date`
- IndexedDB 无法直接存储 Date 对象
- 导致写入时报 `DataCloneError`

**解决方案**：
- 在写入 IndexedDB 前使用 `JSON.parse(JSON.stringify(archive))` 序列化
- 确保所有数据都是可克隆的基本类型

## 7. 实现顺序建议

**Phase 1：导出能力**
1. 扩展 `importExport.ts` 的类型定义和常量
2. 实现 `buildSaveExportData` 函数（读取 localStorage + IndexedDB）
3. 扩展 `buildExportPayload` 函数
4. 扩展 `StorageExportWizard.vue` 的 Save 模块展示
5. 实现全选按钮特殊行为
6. 测试导出功能

**Phase 2：导入能力**
1. 实现 `sanitizeSaveState` 函数（版本 + parser_version 校验）
2. 实现 `reprocessSaveArchives` 函数
3. 实现 `applySaveImport` 函数（覆盖 + 增量模式）
4. 扩展 `applyImportPayload` 函数
5. 扩展 `StorageImportWizard.vue` 的 Save 模块展示
6. 实现跳过详情列表展示
7. 测试导入功能

**Phase 3：集成与验收**
1. 集成导出和导入流程
2. 实现版本作用域隔离验证
3. 实现 context refresh（maps 视图）
4. 实现 i18n 扩展
5. 端到端测试
6.验收 DoD 检查