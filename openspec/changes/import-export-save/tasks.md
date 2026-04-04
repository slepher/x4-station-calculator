# import-export-save 实现任务

## Phase 1: 导出能力

### Task 1.1: 扩展类型定义和常量
- [x] 在 `importExport.ts` 中新增 `SAVE_KEY` 常量：`'x4_save_archives'`
- [x] 扩展 `ImportModuleKey` 类型：新增 `'x4_save_archives'`
- [x] 新增 `SaveArchiveExportData` 类型定义：`{ state: SavedSaveArchivesState, archives: SaveArchive[] }`
- [x] 扩展 `STORAGE_KEY_MAP`：新增 Save 模块的 storage key 映射
- [x] 扩展 `ModuleImportStats`：支持 Save 模块统计
- [x] 扩展 `ImportApplyOptions`：新增 `saveStore` 参数
- [x] 扩展 `ImportApplyResult`：支持 Save 模块应用结果

### Task 1.2: 实现导出数据构建
- [x] 在 `importExport.ts` 中新增 `buildSaveExportData` 异步函数
- [x] 从当前版本作用域的 localStorage 读取 `savedArchivesState`
- [x] 从当前版本作用域的 IndexedDB 读取每条存档正文
- [x] 使用 `getStorageKey('save_archives')` 获取作用域 key
- [x] 使用 `loadArchiveDetailFromDB(scopeKey, archiveId)` 读取正文
- [x] 组装 `{ state, archives }` 结构
- [x] 处理异步读取（Promise.all 或顺序 await）

### Task 1.3: 扩展导出 payload 构建
- [x] 扩展 `buildExportPayload` 函数：新增 `save` 参数
- [x] 在 payload 的 `data` 字段中新增 `x4_save_archives`
- [x] 确保 `game_vsn / beta` 元数据标记当前版本
- [x] 调整函数为异步（因 Save 导出需要异步读取 IndexedDB）

### Task 1.4: 扩展导出 UI 组件
- [x] 在 `StorageExportWizard.vue` 中新增 Save 模块展示
- [x] 显示模块名称："存档"（中文）/ "Save Archive"（英文）
- [x] 显示条目统计："存档 (3)"
- [x] 显示说明文案："包含存档索引和正文，文件体积较大"
- [x] 新增 Save 模块勾选框（可独立勾选）

### Task 1.5: 实现全选按钮特殊行为
- [x] 在 `StorageExportWizard.vue` 中调整全选按钮逻辑
- [x] 全选时：勾选 Empire/Flow/Ship，**不勾选 Save**
- [x] 在 Save 模块旁显示特殊标记或提示文案
- [x] 确保 Save 模块可手动勾选

### Task 1.6: 扩展 i18n
- [x] 在 `locales/en.json` 和 `locales/zh-CN.json` 中新增 Save 模块相关文案：
  - 模块名称 key
  - 说明文案 key
  - 统计展示 key

## Phase 2: 导入能力

### Task 2.1: 实现 normalize 和 migrate
- [x] 在 `importExport.ts` 中新增 Save 模块的 normalize 逻辑
- [x] 解析导入文件的 `data.x4_save_archives`
- [x] 验证结构合法性（state + archives）
- [x] 调用 `migrateSaveArchivesStateToCurrent`（当前 v1 无实质操作）
- [x] 对每条 archive 正文执行 `normalizeSectorData`

### Task 2.2: 实现 sanitize 函数
- [x] 在 `importExport.ts` 中新增 `sanitizeSaveArchives` 函数
- [x] 版本校验：`normalizeVersion(archive.meta.version)` vs `currentVersion`
- [x] parser_version 校验：`archive.meta.parser_version` vs `CURRENT_PARSER_VERSION`
- [x] 不匹配的存档跳过，统计跳过数量
- [x] 收集跳过详情列表（filename + 原因）
- [x] 返回：`{ validArchives, validMetas, skipCount, skipDetails }`

### Task 2.3: 实现 re-process 函数
- [x] 在 `importExport.ts` 中新增 `reprocessSaveArchives` 函数
- [x] 遍历每条有效存档，检查 `post_processor_version`
- [x] 若不匹配 `CURRENT_POST_PROCESSOR_VERSION`：
  - 执行 `postProcessRustSaveArchive(archive, modulesByMacroId, maps)`
  - 更新 `meta.post_processor_version`
  - 更新 `meta.isValid` 和其他派生字段
- [x] 若匹配：直接使用原 archive

### Task 2.4: 实现覆盖模式导入
- [x] 在 `importExport.ts` 中新增 `applySaveImport` 函数（覆盖模式部分）
- [x] 获取当前版本作用域：`scopeKey = getStorageKey('save_archives')`
- [x] 清理当前作用域：
  - 清理 localStorage：写入空状态或 `removeItem`
  - 调用 `clearArchivesFromDB(scopeKey)` 清理 IndexedDB
- [x] 构造新的 state：
  - `version: CURRENT_SAVE_ARCHIVES_VERSION`
  - `activeArchiveId`：使用导入的值或回退到第一条
  - `list: validMetas`
  - `settings`：使用导入的值或默认值
- [x] 写入 localStorage：`localStorage[scopeKey]`
- [x] 写入 IndexedDB：遍历 `validArchives`，调用 `saveArchiveToDB(scopeKey, archive)`
- [x] 主键：`${scopeKey}:${archiveId}`

### Task 2.5: 实现增量模式导入
- [x] 在 `importExport.ts` 中实现增量模式部分
- [x] 获取当前版本作用域：`scopeKey`
- [x] 读取当前作用域状态：`localStorage[scopeKey]`
- [x] 合并 meta 列表：
  - 使用 `upsertArchiveMeta` 函数（同名存档覆盖）
- [x] 合并 IndexedDB 正文：
  - 同名存档：调用 `saveArchiveToDB(scopeKey, archive)`（覆盖）
  - 其他存档：调用 `saveArchiveToDB(scopeKey, archive)`（追加）
- [x] activeId 决策：
  - 若当前 `activeArchiveId` 为空 → 使用导入的 `activeArchiveId`
  - 若当前 `activeArchiveId` 非空且 `selectedArchive` 非空 → 保持不变
- [x] 写入合并后的 state 到 localStorage

### Task 2.6: 整合 applySaveImport 函数
- [x] 在 `importExport.ts` 中新增 `applySaveImport` 函数
- [x] 根据 `options.mode` 分支调用覆盖或增量函数
- [x] 执行 sanitize、re-process、apply 流程
- [x] 收集 warnings 和跳过详情
- [x] 返回应用结果

### Task 2.7: 扩展 applyImportPayload 函数
- [x] 在 `applyImportPayload` 中新增 Save 模块应用分支
- [x] 若 `selectedModules.x4_save_archives` 为 true：
  - 调用 `applySaveImport` 函数
  - 收集应用结果和 warnings
- [x] 若为 false：跳过 Save 模块

### Task 2.8: 扩展 prepareImportPayload 函数
- [x] 在 `prepareImportPayload` 中新增 Save 模块处理
- [x] 执行 normalize 和 migrate
- [x] 执行 sanitize（收集跳过详情）
- [x] 执行 re-process
- [x] 返回 prepared payload（包含 Save 模块数据）

### Task 2.9: 扩展 getModuleImportStats 函数
- [x] 在 `getModuleImportStats` 中新增 Save 模块统计
- [x] 统计导入文件中的存档数量（meta 列表长度）
- [x] 返回 `{ key: SAVE_KEY, count: number }`

### Task 2.10: 扩展导入 UI 组件
- [x] 在 `StorageImportWizard.vue` 中新增 Save 模块展示
- [x] 显示模块名称："存档"（中文）/ "Save Archive"（英文）
- [x] 显示有效数量："导入 3 条存档"
- [x] 显示跳过数量："跳过 2 条存档（版本/parser 不匹配）"
- [x] 新增跳过详情列表（可折叠）：
  - 每条跳过存档的 filename + 原因
- [x] 新增 Save 模块勾选框（可独立勾选）

### Task 2.11: 扩展导入 i18n
- [x] 在 `locales/en.json` 和 `locales/zh-CN.json` 中新增导入相关文案：
  - 有效数量展示 key
  - 跳过数量展示 key
  - 跳过详情展示 key

## Phase 3: 版本作用域隔离

### Task 3.1: 验证导出作用域隔离
- [x] 确保导出仅读取当前版本作用域的数据
- [x] 使用 `getStorageKey('save_archives')` 获取作用域 key
- [x] IndexedDB 查询使用 `scopeKey` 参数
- [ ] 测试：在不同版本下导出，验证数据来源正确

### Task 3.2: 验证导入作用域隔离
- [x] 确保导入写入仅限定在当前版本作用域
- [x] 清理操作使用当前作用域 key
- [x] 写入操作使用当前作用域 key
- [x] IndexedDB 主键使用 `${scopeKey}:${archiveId}`
- [ ] 测试：在不同版本下导入，验证数据写入位置正确

### Task 3.3: 验证跨版本导入不影响其他版本
- [ ] 测试：在 9.0 作用下导入文件，验证 8.0 数据不受影响
- [ ] 测试：在 8.0 作用下导入文件，验证 9.0 数据不受影响
- [ ] 测试：版本切换后，导入导出自动切换到新作用域

## Phase 4: Context Refresh

### Task 4.1: 实现 maps 视图 context refresh
- [x] 在 `applySaveImport` 中判断 `currentView === 'maps'`
- [x] 若 `activeArchiveId` 变化：
  - 清空当前 overlay
  - 若新 `activeArchiveId` 对应正文存在，恢复 overlay
  - 若正文不存在，显示空地图
- [x] 调用 `deriveSavePoiCategoryData` 和 `flattenSavePoiCategoryData`
- [x] 触发地图组件的 overlay 刷新逻辑

### Task 4.2: 扩展 ImportApplyOptions 类型
- [x] 新增 `currentView` 参数：`'production' | 'flow' | 'ship-build' | 'maps' | 'save-import'`
- [x] 在调用 `applyImportPayload` 时传入当前视图信息

## Phase 5: Delta Spec 应用

### Task 5.1: 应用 delta spec 到主 spec
- [ ] 将 `openspec/changes/import-export-save/specs/import-export/spec.md` 的 ADDED/MODIFIED Requirements 应用到 `openspec/specs/import-export/spec.md`
- [ ] 更新主 spec 的内容，保持一致性

## Phase 6: 集成与构建验证

### Task 6.1: 集成导出和导入流程
- [x] 在 `StorageExportWizard` 和 `StorageImportWizard` 中集成 Save 模块处理
- [x] 确保 Save 模块勾选状态正确传递到导出/导入函数
- [x] 确保 warnings 和跳过详情正确显示

### Task 6.2: 构建验证
- [x] 执行 `npm run build`
- [x] 检查编译错误
- [x] 若有错误，修复代码并重新构建
- [x] 直到构建通过

### Task 6.3: 类型检查
- [x] 执行 `npm run typecheck`（如果有）
- [x] 检查类型错误
- [x] 修复类型问题

## Implementation Notes

- **零代码策略**：本 phase 仅实现功能代码，不包含测试代码编写或测试执行
- **异步处理**：Save 模块导出和导入涉及 IndexedDB 异步操作，需要正确处理 async/await
- **版本作用域**：所有 localStorage 和 IndexedDB 操作必须使用 `getStorageKey('save_archives')` 获取作用域 key
- **IndexedDB 主键**：必须使用 `${scopeKey}:${archiveId}` 格式，确保版本隔离
- **复用现有函数**：优先复用 `useSaveStore.ts` 和 `workers/saveParser.post.ts` 中的现有函数，避免重复实现
- **同名存档覆盖**：使用 `upsertArchiveMeta` 函数实现同名覆盖逻辑
- **post_process**：复用 `postProcessRustSaveArchive` 函数，传入 `modulesByMacroId` 和 `maps`
- **sanitize 特殊规则**：Save 模块 sanitize 规则与其他模块不同（版本不匹配时跳过存档，而非清理无效引用）